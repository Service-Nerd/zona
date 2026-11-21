// STRAVA-WEBHOOK-SOR-01 — Apple Health is the system of record for run data (founder 2026-11-21; ADR-011 §3,
// INV-DATA-008). A Strava delete never removes an Apple Health row, and NO file outside the ingest gateway can write a
// strava_activities row (the tree half the staged-file commit hook cannot see).
//
// STRAVA-SOR-REVIEW-FIX-01 (code review, 2026-11-21) adds: the delete reverts the mirrors and reads every error; the
// ingest backfill closes the Strava-first race; and the tree sweep catches two shapes it missed.
//
// ⚠️ WHAT THE TREE SWEEP STILL CANNOT SEE, by construction: a table name built at runtime (a template literal, a
// concatenation, a constant imported from another file or passed in as an argument); a write through `supabase.rpc`
// or raw SQL; a write more than 2,000 characters after its `.from(...)`; and anything in a `.test.ts`, `__fixtures__`
// or a file type other than .ts/.tsx/.mjs/.js.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { fakeDb, type FakeQuery } from './__fixtures__/fakeDb'
import { deleteStravaActivity, enrichNewHealthKitRowFromStrava, findRowByStravaId } from './stravaSor'

const ops: { kind: string; detail: Record<string, unknown> }[] = []
vi.mock('@/lib/ops/recordOpsEvent', () => ({ recordOpsEvent: async (kind: string, detail: Record<string, unknown>) => { ops.push({ kind, detail }) } }))
const strava = {
  token: vi.fn(async () => ({ access_token: 't', expires_at: 0 })),
  list: vi.fn(async (..._a: unknown[]): Promise<unknown[]> => []),
  detail: vi.fn(async (_t: string, id: number) => ({ status: 200, activity: { id, type: 'Run', start_date: '2026-11-20T07:01:00Z', distance: 10_100, name: 'Morning Run', average_temp: 9, splits_metric: [] } as unknown })),
}
vi.mock('@/lib/strava', async (orig) => ({
  ...(await orig<typeof import('@/lib/strava')>()),
  getStravaToken: (...a: unknown[]) => strava.token(...(a as [])),
  fetchActivities: (...a: unknown[]) => strava.list(...a),
  fetchStravaActivity: (t: string, id: number) => strava.detail(t, id),
  fetchHRStreamSummary: async () => null,
  getUserHRZones: async () => ({ zone2Ceiling: 150, maxHR: 190, restingHR: 50 }),
}))


beforeEach(() => { ops.length = 0; strava.list.mockReset(); strava.list.mockResolvedValue([]) })

describe('deleteStravaActivity', () => {
  const run = async (errors: Record<string, string> = {}) => {
    const db = fakeDb(q => {
      const key = `${q.table}:${q.op}`
      if (errors[key]) return { error: { message: errors[key] } }
      if (key === 'strava_activities:select') return { data: [{ id: 'hk1', hr_bpm_histogram: { 120: 10, 160: 10 } }] }
      return {}
    })
    await deleteStravaActivity(db as never, 'u1', 42)
    return db.log
  }
  const find = (log: FakeQuery[], table: string, op: string) => log.filter(q => q.table === table && q.op === op)

  it('🔴 deletes only Strava-source rows and reverts the patch on an Apple Health row', async () => {
    const log = await run()
    const del = find(log, 'strava_activities', 'delete')
    expect(del).toHaveLength(1)
    expect(del[0].filters).toEqual({ user_id: 'u1', strava_activity_id: 42, source: 'strava' })
    const upd = find(log, 'strava_activities', 'update')
    expect(upd).toHaveLength(1)
    expect(upd[0].filters).toEqual({ id: 'hk1' })
    expect(upd[0].patch).toMatchObject({ strava_activity_id: null, splits_metric: null, avg_temp_c: null, suffer_score: null, name: 'Run' })
  })
  it('🔴 STRAVA-SOR-REVIEW-FIX-01: HR buckets are re-derived from the Apple Health histogram, not left as Strava\'s', async () => {
    const upd = find(await run(), 'strava_activities', 'update')[0].patch as Record<string, number | null>
    expect(upd.hr_pct_z1! + upd.hr_pct_z2! + upd.hr_pct_z3! + upd.hr_pct_z4_5!).toBeCloseTo(100, 0)
    expect(upd.hr_in_zone_pct).not.toBeNull()
  })
  it('🔴 STRAVA-SOR-REVIEW-FIX-01: nulls the mirrored id on run_analysis and session_completions', async () => {
    const log = await run()
    for (const t of ['run_analysis', 'session_completions']) {
      const u = find(log, t, 'update')
      expect(u, t).toHaveLength(1)
      expect(u[0].filters).toEqual({ user_id: 'u1', strava_activity_id: 42, superseded_at: null })
      expect(u[0].patch).toEqual({ strava_activity_id: null })
    }
  })
  it('🔴 STRAVA-SOR-REVIEW-FIX-01: every failed query is recorded, none swallowed', async () => {
    await run({ 'strava_activities:delete': 'a', 'run_analysis:update': 'b', 'session_completions:update': 'c', 'strava_activities:update': 'd' })
    expect(ops.filter(o => o.kind === 'strava_sor_write_failed').map(o => o.detail.stage).sort())
      .toEqual(['clear_run_analysis', 'clear_session_completions', 'delete_strava_row', 'revert_healthkit_row'])
  })
})

describe('findRowByStravaId', () => {
  it('prefers the Apple Health row, and answers null when no row carries the id', async () => {
    const db = fakeDb(() => ({ data: [{ source: 'strava', apple_health_uuid: null }, { source: 'apple_health', apple_health_uuid: 'HK' }] }))
    expect(await findRowByStravaId(db as never, 'u1', 7)).toEqual({ source: 'apple_health', apple_health_uuid: 'HK' })
    expect(db.log[0].filters).toEqual({ user_id: 'u1', strava_activity_id: 7 })
    expect(await findRowByStravaId(fakeDb(() => ({ data: [] })) as never, 'u1', 7)).toBeNull()
  })
})

describe('enrichNewHealthKitRowFromStrava (the Strava-first race)', () => {
  const db = (token: string | null) => fakeDb(q => {
    if (q.table === 'user_settings') return { data: token ? { strava_refresh_token: token } : null }
    if (q.table === 'strava_activities' && q.op === 'select')
      return { data: [{ id: 'hk1', apple_health_uuid: 'HK', start_date: '2026-11-20T07:00:00Z', distance_m: 10_000, strava_activity_id: null }] }
    return {}
  })

  it('🔴 patches the new Apple Health row with its Strava twin and records it', async () => {
    strava.list.mockResolvedValue([{ id: 99, type: 'Run', start_date: '2026-11-20T07:01:00Z', distance: 10_100 }])
    const d = db('rt')
    expect(await enrichNewHealthKitRowFromStrava(d as never, 'u1', '2026-11-20T07:00:00Z')).toBe('enriched')
    const patch = d.log.find(q => q.table === 'strava_activities' && q.op === 'update')
    expect(patch?.filters).toEqual({ id: 'hk1' })
    expect(patch?.patch).toMatchObject({ strava_activity_id: 99, avg_temp_c: 9 })
    expect(ops).toEqual([{ kind: 'strava_healthkit_backfill', detail: expect.objectContaining({ result: 'enriched', strava_activity_id: 99 }) }])
    // Strava was asked for one run's neighbourhood, not the athlete's whole history.
    const [, after, before] = strava.list.mock.calls[0] as [string, string, string]
    expect(new Date(before).getTime() - new Date(after).getTime()).toBe(2 * 60 * 60 * 1000)
  })
  it('a runner with no Strava token costs nothing and records nothing', async () => {
    expect(await enrichNewHealthKitRowFromStrava(db(null) as never, 'u1', '2026-11-20T07:00:00Z')).toBe('no_strava')
    expect(strava.token).not.toHaveBeenCalledWith(null)
    expect(ops).toEqual([])
  })
  it('no twin, and a Strava failure, are recorded and never thrown', async () => {
    expect(await enrichNewHealthKitRowFromStrava(db('rt') as never, 'u1', '2026-11-20T07:00:00Z')).toBe('no_match')
    strava.list.mockRejectedValueOnce(new Error('strava 500'))
    expect(await enrichNewHealthKitRowFromStrava(db('rt') as never, 'u1', '2026-11-20T07:00:00Z')).toBe('failed')
    expect(ops.map(o => o.detail.result)).toEqual(['no_match', 'failed'])
  })
})

// ── INV-DATA-008 tree sweep ─────────────────────────────────────────────────────────────────────────────────────────
const ROOT = join(__dirname, '../..')
const GATEWAY = ['app/api/health/ingest/', 'lib/coaching/healthkitConsolidate.ts']
const WRITE = /\.(insert|upsert)\(/
/** STRAVA-SOR-REVIEW-FIX-01: 400 characters missed a write further down a long chain; 2,000 is past any chain here. */
const REACH = 2000

/** Every `.from(...)` whose table is `strava_activities`, by literal or by a same-file constant holding that literal. */
function stravaActivitiesWriters(src: string): number {
  const consts = Array.from(src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*['"`]strava_activities['"`]/g)).map(m => m[1])
  const target = [`['"\`]strava_activities['"\`]`, ...consts.map(c => `${c.replace(/\$/g, '\\$')}\\b`)].join('|')
  const from = new RegExp(`\\.from\\(\\s*(?:${target})\\s*\\)`, 'g')
  let n = 0
  for (const m of Array.from(src.matchAll(from))) {
    const tail = src.slice(m.index! + m[0].length, m.index! + m[0].length + REACH)
    const next = tail.search(/\.from\(/)
    if (WRITE.test(next >= 0 ? tail.slice(0, next) : tail)) n++
  }
  return n
}

describe('INV-DATA-008 tree sweep: only the ingest gateway writes strava_activities', () => {
  const files: string[] = []
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) { if (!['node_modules', '.next', '__fixtures__', 'dist'].includes(n)) walk(p) }
      else if (/\.(ts|tsx|mjs|js)$/.test(n) && !/\.test\.(ts|tsx)$/.test(n)) files.push(p)
    }
  }
  for (const d of ['app', 'lib', 'components', 'scripts', 'packages']) walk(join(ROOT, d))

  it('the population is real: it reaches every scanned root, and the gateway writes', () => {
    const rels = files.map(f => relative(ROOT, f))
    for (const d of ['app/', 'lib/', 'components/', 'scripts/', 'packages/']) expect(rels.some(r => r.startsWith(d)), d).toBe(true)
    expect(stravaActivitiesWriters(readFileSync(join(ROOT, 'app/api/health/ingest/route.ts'), 'utf8'))).toBeGreaterThan(0)
  })
  it('🔴 no insert/upsert into strava_activities outside the gateway', () => {
    const offenders = files.map(f => relative(ROOT, f))
      .filter(rel => !GATEWAY.some(g => rel.startsWith(g)))
      .filter(rel => stravaActivitiesWriters(readFileSync(join(ROOT, rel), 'utf8')) > 0)
    expect(offenders).toEqual([])
  })
  it('🔴 STRAVA-SOR-REVIEW-FIX-01: the reader catches a table-name constant and a write far down the chain', () => {
    expect(stravaActivitiesWriters(`const T = 'strava_activities'\nawait db.from(T).upsert(row)`)).toBe(1)
    expect(stravaActivitiesWriters(`const T: string = "strava_activities"; db.from(T).insert(x)`)).toBe(1)
    // The table name is assembled so this file's own source never holds the shape the commit hook blocks.
    const SA = ['strava', 'activities'].join('_')
    expect(stravaActivitiesWriters(`db.from('${SA}')${'.eq("a", 1)'.repeat(60)}.upsert(row)`)).toBe(1)
    // and does not fire on a read, or on a write to the next table in the same chain of statements
    expect(stravaActivitiesWriters(`db.from('${SA}').select('*'); db.from('run_analysis').upsert(r)`)).toBe(0)
    expect(stravaActivitiesWriters(`const T = 'run_analysis'; db.from(T).upsert(r)`)).toBe(0)
  })
})
