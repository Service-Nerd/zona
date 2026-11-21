// STRAVA-SOR-REVIEW-FIX-02 — one live run_analysis row per run, whichever id the caller sends.
//
// The defect: link-activity analysed a Strava-linked run by its Apple Health uuid (row written with strava_activity_id
// null), then the post-run RPE save re-analysed it by its Strava id, and analyse-run keyed that upsert on the Strava id
// it was sent. Postgres treats NULLs as distinct in both unique keys, so the second call INSERTED a second live row.
// The table below enforces the two real unique constraints (20260501_healthkit_primary.sql) with NULLs distinct.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { pickAnalysisActivity, runAnalysisKey, upsertRunAnalysis } from './runAnalysisKey'

type Row = Record<string, any>

/** run_analysis in memory: UNIQUE (user_id, apple_health_uuid) and UNIQUE (user_id, strava_activity_id), NULLs distinct. */
function memTable(initial: Row[] = []) {
  const rows: Row[] = initial.map(r => ({ ...r }))
  let nextId = rows.length + 1
  const clash = (cand: Row, self?: Row) => rows.some(r => r !== self && r.user_id === cand.user_id && (
    (cand.apple_health_uuid != null && r.apple_health_uuid === cand.apple_health_uuid) ||
    (cand.strava_activity_id != null && r.strava_activity_id === cand.strava_activity_id)))
  const db = {
    rows,
    from() {
      const f: Record<string, unknown> = {}
      let op: 'select' | 'update' | 'delete' | 'upsert' = 'select'
      let payload: Row = {}
      let conflict = ''
      const matches = (r: Row) => Object.entries(f).every(([k, v]) => (v === null ? r[k] == null : r[k] === v))
      const run = () => {
        if (op === 'select') return { data: rows.filter(matches).map(r => ({ id: r.id })), error: null }
        if (op === 'delete') { for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i])) rows.splice(i, 1); return { data: null, error: null } }
        if (op === 'update') {
          for (const r of rows.filter(matches)) { const next = { ...r, ...payload }; if (clash(next, r)) return { data: null, error: { message: 'duplicate key' } }; Object.assign(r, next) }
          return { data: null, error: null }
        }
        const cols = conflict.split(',')
        const hit = rows.find(r => cols.every(c => payload[c] != null && r[c] === payload[c]))
        const next = { ...(hit ?? { id: `ra${nextId++}`, superseded_at: null }), ...payload }
        if (clash(next, hit)) return { data: null, error: { message: 'duplicate key' } }
        if (hit) Object.assign(hit, next); else rows.push(next)
        return { data: null, error: null }
      }
      const b: Record<string, unknown> = {
        select: () => b, eq: (k: string, v: unknown) => { f[k] = v; return b }, is: (k: string, v: unknown) => { f[k] = v; return b },
        update: (p: Row) => { op = 'update'; payload = p; return b },
        delete: () => { op = 'delete'; return b },
        upsert: (p: Row, o: { onConflict: string }) => { op = 'upsert'; payload = p; conflict = o.onConflict; return b },
        then: (ok: (v: unknown) => unknown) => Promise.resolve(run()).then(ok),
      }
      return b
    },
  }
  return db
}

/** The persistence half of analyse-run, exactly as the route composes it. */
async function analyse(db: ReturnType<typeof memTable>, activityRows: Row[], request: Row, extra: Row = {}) {
  const activity = pickAnalysisActivity(activityRows)!
  const key = runAnalysisKey(activity, request)
  return upsertRunAnalysis(db, 'u1', key, { user_id: 'u1', week_n: 3, session_day: 'week_3_tue', ...extra })
}

const HK_ROW = { source: 'apple_health', apple_health_uuid: 'HK-1', strava_activity_id: 42 }

describe('one live run_analysis row per run (STRAVA-SOR-REVIEW-FIX-02)', () => {
  it('🔴 link via the Strava picker, then the RPE re-analysis by Strava id: exactly one live row, carrying both ids', async () => {
    const db = memTable()
    // link-activity resolved to the Apple Health row and sent only its uuid
    expect((await analyse(db, [HK_ROW], { apple_health_uuid: 'HK-1' }, { feedback_text: 'first' })).error).toBeNull()
    // PostRun's RPE save sends the Strava id
    expect((await analyse(db, [HK_ROW], { strava_activity_id: 42 }, { feedback_text: 'after RPE' })).error).toBeNull()
    expect(db.rows.filter(r => r.superseded_at == null)).toEqual([
      expect.objectContaining({ apple_health_uuid: 'HK-1', strava_activity_id: 42, feedback_text: 'after RPE' }),
    ])
  })
  it('the reverse order holds too, and a legacy Strava row beside the Apple Health one never wins the lookup', async () => {
    const db = memTable()
    const legacy = { source: 'strava', apple_health_uuid: null, strava_activity_id: 42 }
    await analyse(db, [legacy, HK_ROW], { strava_activity_id: 42 })
    await analyse(db, [HK_ROW], { apple_health_uuid: 'HK-1' })
    expect(db.rows).toHaveLength(1)
    expect(db.rows[0]).toMatchObject({ apple_health_uuid: 'HK-1', strava_activity_id: 42 })
  })
  it('🔴 a live duplicate written before the fix (Strava id only) is adopted, or removed when the uuid has its own row', async () => {
    const adopt = memTable([{ id: 'old', user_id: 'u1', apple_health_uuid: null, strava_activity_id: 42, superseded_at: null, feedback_text: 'kept' }])
    await analyse(adopt, [HK_ROW], { strava_activity_id: 42 }, {})
    expect(adopt.rows).toEqual([expect.objectContaining({ id: 'old', apple_health_uuid: 'HK-1', strava_activity_id: 42, feedback_text: 'kept' })])

    const both = memTable([
      { id: 'hk', user_id: 'u1', apple_health_uuid: 'HK-1', strava_activity_id: null, superseded_at: null },
      { id: 'dup', user_id: 'u1', apple_health_uuid: null, strava_activity_id: 42, superseded_at: null },
    ])
    expect((await analyse(both, [HK_ROW], { strava_activity_id: 42 })).error).toBeNull()
    expect(both.rows).toEqual([expect.objectContaining({ id: 'hk', apple_health_uuid: 'HK-1', strava_activity_id: 42 })])
  })
  it('a superseded row is history: never adopted or removed', async () => {
    const db = memTable([{ id: 'past', user_id: 'u1', apple_health_uuid: null, strava_activity_id: 42, superseded_at: '2026-10-01' }])
    await analyse(db, [HK_ROW], { apple_health_uuid: 'HK-1' })
    expect(db.rows.find(r => r.id === 'past')).toMatchObject({ apple_health_uuid: null, superseded_at: '2026-10-01' })
  })
  it('a run with no Apple Health uuid (manual or legacy Strava) keys on the Strava id, as before', () => {
    expect(runAnalysisKey({ apple_health_uuid: null, strava_activity_id: 7 }, { strava_activity_id: 7 }))
      .toEqual({ apple_health_uuid: null, strava_activity_id: 7, onConflict: 'user_id,strava_activity_id' })
  })
  it('🔴 analyse-run composes exactly these: the row is picked, keyed and stamped from the activity, not the request', () => {
    const src = readFileSync(join(process.cwd(), 'app/api/analyse-run/route.ts'), 'utf8')
    expect(src).toMatch(/pickAnalysisActivity\(activityRes\.data/)
    expect(src).toMatch(/runAnalysisKey\(activity, \{ apple_health_uuid, strava_activity_id \}\)/)
    expect(src).toMatch(/upsertRunAnalysis\(serviceSupabase, userId, analysisKey, analysisRow\)/)
    expect(src).not.toMatch(/onConflict: conflictTarget/)
    expect(src).not.toMatch(/activityFiltered\.single\(\)/)
  })
})
