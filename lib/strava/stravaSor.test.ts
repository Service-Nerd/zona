// STRAVA-WEBHOOK-SOR-01 — Apple Health is the system of record for run data (founder 2026-11-21; ADR-011 §3,
// INV-DATA-008). A Strava delete never removes an Apple Health row, and NO file outside the ingest gateway can write a
// strava_activities row (the tree half the staged-file commit hook cannot see).
//
// STRAVA-SOR-REVIEW-FIX-03 (code review, 2026-11-21) adds: the delete reverts the Apple Health row through the merge
// owner (Strava-only fields and the name; HR untouched) and records every query error; and the tree sweep catches two shapes it missed. ⚠️ The delete deliberately does
// NOT touch run_analysis or session_completions (trimmed: see the build-log), and there is no ingest-side backfill.
//
// ⚠️ WHAT THE TREE SWEEP STILL CANNOT SEE, by construction: a table name built at runtime (a template literal, a
// concatenation, a constant imported from another file or passed in as an argument); a write through `supabase.rpc`
// or raw SQL; a write more than 2,000 characters after its `.from(...)`; and anything in a `.test.ts`, `__fixtures__`
// or a file type other than .ts/.tsx/.mjs/.js.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { fakeDb, type FakeQuery } from './__fixtures__/fakeDb'
import { deleteStravaActivity, findRowByStravaId } from './stravaSor'

const ops: { kind: string; detail: Record<string, unknown> }[] = []
vi.mock('@/lib/ops/recordOpsEvent', () => ({ recordOpsEvent: async (kind: string, detail: Record<string, unknown>) => { ops.push({ kind, detail }) } }))
beforeEach(() => { ops.length = 0 })

describe('deleteStravaActivity', () => {
  const run = async (errors: Record<string, string> = {}) => {
    const db = fakeDb(q => {
      const key = `${q.table}:${q.op}`
      if (errors[key]) return { error: { message: errors[key] } }
      if (key === 'strava_activities:select') return { data: [{ id: 'hk1' }] }
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
  it('🔴 STRAVA-SOR-REVIEW-FIX-03: the revert leaves the HR data alone (a row with no histogram keeps its zones)', async () => {
    const upd = find(await run(), 'strava_activities', 'update')[0].patch as Record<string, unknown>
    expect(Object.keys(upd).filter(k => k.startsWith('hr_') || k.startsWith('avg_hr') || k.startsWith('max_hr'))).toEqual([])
  })
  it('🔴 STRAVA-SOR-REVIEW-FIX-03: every failed query is recorded, none swallowed', async () => {
    await run({ 'strava_activities:delete': 'a', 'strava_activities:update': 'd' })
    expect(ops.filter(o => o.kind === 'strava_sor_write_failed').map(o => o.detail.stage).sort())
      .toEqual(['delete_strava_row', 'revert_healthkit_row'])
    ops.length = 0
    await run({ 'strava_activities:select': 'r' })
    expect(ops.map(o => o.detail.stage)).toEqual(['read_healthkit_rows'])
  })
  it('🔴 STRAVA-SOR-REVIEW-FIX-03: writes only strava_activities, never run_analysis or session_completions', async () => {
    const tables = (await run()).filter(q => q.op !== 'select').map(q => `${q.table}:${q.op}`)
    expect(tables).toEqual(['strava_activities:delete', 'strava_activities:update'])
    const none = fakeDb(q => (q.table === 'strava_activities' && q.op === 'select' ? { data: [] } : {}))
    await deleteStravaActivity(none as never, 'u1', 42)
    expect(none.log.filter(q => q.op !== 'select').map(q => `${q.table}:${q.op}`)).toEqual(['strava_activities:delete'])
  })
  it('STRAVA-SOR-REVIEW-FIX-03: the row revert is written by the merge owner, not by this module', () => {
    const src = readFileSync(join(__dirname, 'stravaSor.ts'), 'utf8')
    expect(src).toMatch(/revertHealthKitEnrichment\(/)
    expect(src).not.toMatch(/hr_pct_z1:/)
  })
})

describe('findRowByStravaId', () => {
  it('prefers the Apple Health row, and answers null when no row carries the id', async () => {
    const db = fakeDb(() => ({ data: [{ source: 'strava', apple_health_uuid: null }, { source: 'apple_health', apple_health_uuid: 'HK' }] }))
    expect(await findRowByStravaId(db as never, 'u1', 7)).toEqual({ source: 'apple_health', apple_health_uuid: 'HK' })
    expect(db.log[0].filters).toEqual({ user_id: 'u1', strava_activity_id: 7 })
    expect(await findRowByStravaId(fakeDb(() => ({ data: [] })) as never, 'u1', 7)).toBeNull()
  })
  it('🔴 a failed read answers "unknown", never null, so the webhook records no false discard', async () => {
    expect(await findRowByStravaId(fakeDb(() => ({ error: { message: 'x' } })) as never, 'u1', 7)).toBe('unknown')
  })
})

// ── INV-DATA-008 tree sweep ─────────────────────────────────────────────────────────────────────────────────────────
const ROOT = join(__dirname, '../..')
const GATEWAY = ['app/api/health/ingest/', 'lib/coaching/healthkitConsolidate.ts']
const WRITE = /\.(insert|upsert)\(/
/** STRAVA-SOR-REVIEW-FIX-03: 400 characters missed a write further down a long chain; 2,000 is past any chain here. */
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
  it('🔴 STRAVA-SOR-REVIEW-FIX-03: the reader catches a table-name constant and a write far down the chain', () => {
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
