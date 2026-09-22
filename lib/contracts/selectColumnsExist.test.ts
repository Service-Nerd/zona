// SELECT-COLUMN-GATE-01 — every column a `.select()` names must exist.
//
// HK-ELEV-COLUMN-01: two selects asked `strava_activities` for
// `total_elevation_gain`. The column is `elevation_gain`. Supabase answers a
// bad column with `{ data: null, error }`, both call sites destructured the
// error away, and the guard that followed (`if (!hkRows?.length) return`) read
// the failure as "no runs". **HealthKit runs silently failed to load for three
// and a half months**, from 2026-06-06, and the only trace was Postgres errors
// in a log nobody reads — until the founder exported one.
//
// ⚠️ THE SAME FILE HAD IT RIGHT IN A THIRD PLACE. Three marshalling copies of
// one row shape, two wrong: the same duplication class as SESSION-KM-01/02 and
// the fourteen Anthropic calls.
//
// ⚠️ This gate reads a COMMITTED SNAPSHOT of the schema, not the live database.
// A test that needs credentials does not run in CI, and a check that does not
// run is not a check. The snapshot is refreshed by hand; a column added to the
// database and not to the snapshot reads here as missing, which is the safe
// direction to be wrong in.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { TABLE_COLUMNS } from './tableColumns'

/** 🔴 KNOWN BROKEN, DECLARED — found by this gate's FIRST RUN, 2026-09-22.
 *
 *  ⚠️ A DECLARED REASON IS NOT A FIXED PROBLEM. These are baselined so the gate
 *  can go green on everything else and NEW breakage fails the build; they are
 *  not resolved, and each is filed with its own item.
 *
 *  Both are the same shape as HK-ELEV-COLUMN-01 — wrong column, swallowed
 *  error, and a `?? []` downstream that reads the failure as "no data" — and
 *  NEITHER appeared in the Postgres log that started this, because those routes
 *  had not run that day. **The log showed one family; the gate found three.**
 *
 *  Why they are not fixed here: both change what a COACHING surface reads.
 *  `session_type` feeds the AI phase summary and race-readiness note (whose
 *  easy/recovery filter currently matches nothing, because the whole array is
 *  empty); `week_n`/`actual_load_km` feed taper recalibration, which has
 *  therefore been running on an empty map and skipping. Correcting either
 *  changes prescription or what the model is told, so they are RCA'd and routed,
 *  not patched. AI-COMPLETION-COLUMN-01 · TAPER-RECAL-COLUMN-01. */
// ✅ The two `recalibrate-taper` entries LEFT this register on 2026-09-22
// (TAPER-RECAL-COLUMN-01, Coaching Board CORRECT WITH AMENDMENT, §68 Am.1). The
// register shrinking is the point — `a declared reason is not a fixed problem`,
// and the stale-entry check below is what makes leaving mandatory rather than
// optional.
// ✅ EMPTY, 2026-09-22. All four entries this register was born with have left
// it: the two `recalibrate-taper` rows (TAPER-RECAL-COLUMN-01, §68 Am.1) and the
// two `session_type` rows (AI-COMPLETION-COLUMN-01). **The stale-entry check
// below is what made leaving mandatory rather than optional** — a register whose
// reason column is the answer, with nothing scheduling its shrink, is the debt
// pattern this repo has already recorded as growing quietly.
const BASELINE: string[] = []

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

/** `.from('x')…select('a, b')` — only literal selects; a built string is out of
 *  scope and is named as such rather than silently skipped. */
function selectsIn(src: string): { table: string; cols: string[] }[] {
  const out: { table: string; cols: string[] }[] = []
  const re = /\.from\(\s*'([a-z_]+)'\s*\)([\s\S]{0,400}?)\.select\(\s*'([^']*)'\s*\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const [, table, between, cols] = m
    // A second `.from(` between the two means we crossed into another query.
    if (between.includes('.from(')) continue
    // ⚠️ STRIP EMBEDS BEFORE SPLITTING. `charity_batches(partner_name, cap)` is
    // a JOIN on ANOTHER table, and a naive comma split hands `cap` to this one.
    // The first cut did exactly that and reported two false positives out of
    // six — bound the region, do not split the string.
    const flat = cols.replace(/[a-z_]+\s*\([^)]*\)/g, '')
    out.push({ table, cols: flat.split(',').map(c => c.trim()).filter(Boolean) })
  }
  return out
}

describe('SELECT-COLUMN-GATE-01 — a select cannot name a column that does not exist', () => {
  const files = [...walk(join(process.cwd(), 'app')), ...walk(join(process.cwd(), 'lib')), ...walk(join(process.cwd(), 'components'))]

  it('scans a real corpus — an empty sweep is not a pass', () => {
    const n = files.reduce((acc, f) => acc + selectsIn(readFileSync(f, 'utf8')).filter(s => TABLE_COLUMNS[s.table]).length, 0)
    expect(n, 'checkable selects found').toBeGreaterThan(10)
  })

  it('🔴 every named column exists on its table', () => {
    const bad: string[] = []
    for (const f of files) {
      for (const { table, cols } of selectsIn(readFileSync(f, 'utf8'))) {
        const known = TABLE_COLUMNS[table]
        if (!known) continue                       // table not snapshotted — out of scope, not a pass
        for (const c of cols) {
          if (c === '*' || c.includes('(') || c.includes(':')) continue  // count, embeds, aliases
          const name = c.replace(/\s*->.*$/, '').trim()
          if (name && !known.includes(name)) bad.push(`${f.replace(process.cwd() + '/', '')}: ${table}.${name}`)
        }
      }
    }
    const undeclared = bad.filter(b => !BASELINE.includes(b))
    expect(undeclared, 'NEW selects naming a column that does not exist').toEqual([])
    // And the debt cannot quietly disappear either: a baselined entry that has
    // been fixed must leave the register, or the register stops describing
    // anything. Same shape as SWEEP-BASELINE-01.
    const stale = BASELINE.filter(b => !bad.includes(b))
    expect(stale, 'baselined entries that are now FIXED — remove them').toEqual([])
  })
})
