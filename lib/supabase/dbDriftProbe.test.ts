import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// OPS-DBCHECK-NOISE-01 — the drift check may not answer a schema question by
// making a query fail.
//
// `checkWeekKeyedCoverage` used to ask "does this table carry `week_n`?" by
// SELECTing the column and reading the error. A healthy run therefore wrote 21
// Postgres 42703 errors and 22 HTTP 400s into the production log view, and a
// dashboard that shows 40+ red lines after every clean check trains you to
// scroll past red. The founder spent time on those errors, which is the proof
// of cost.
//
// ⚠️ THE NOISE WAS THE SMALLER HALF, and this test exists mostly for the other
// one. Probing "each known table" meant the candidate set was three
// hand-written arrays in this repo — while the script's own header says "the
// authority has to be the SCHEMA", because PLAN-WEEK-COLLISION-01 was caused by
// a list written from memory and its first guard iterated that same list. A new
// table carrying `week_n` that nobody added to any array was invisible to the
// check built to find exactly that. Reverting to a probe loop silently
// reintroduces the blindness, not just the noise — so this asserts the SOURCE
// of the candidate set, not only the absence of errors.

const SRC = readFileSync(join(process.cwd(), 'scripts/check-db-drift.ts'), 'utf8')
const CODE = SRC.split('\n')
  .filter(l => {
    const t = l.trim()
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
  })
  .join('\n')

const weekKeyedFn = (() => {
  const start = CODE.indexOf('async function checkWeekKeyedCoverage')
  expect(start, 'checkWeekKeyedCoverage was renamed or removed').toBeGreaterThan(-1)
  const rest = CODE.slice(start)
  const end = rest.indexOf('\nasync function ', 1)
  return end === -1 ? rest : rest.slice(0, end)
})()

describe('OPS-DBCHECK-NOISE-01 — the week_n check reads the schema', () => {
  it('🔴 does not probe for a column by SELECTing it', () => {
    // `.select('week_n')` / `.select('superseded_at')` against a table that may
    // not have the column is the deliberately-failing probe.
    const probes = weekKeyedFn.match(/\.select\(\s*'(week_n|superseded_at)'/g) ?? []
    expect(
      probes,
      'Ask public.schema_columns_named() once instead. A failing query is not a free question: ' +
        'it is a production error row, and 21 of them per healthy run is how red stops meaning anything.',
    ).toEqual([])
  })

  it('🔴 the candidate set comes from the database, not from the arrays it audits', () => {
    expect(
      weekKeyedFn,
      'The check must call schema_columns_named. Building candidates from WEEK_KEYED_TABLES / ' +
        'WEEK_KEYED_EXEMPT / RLS_POLICIES makes it blind to exactly the table it exists to find.',
    ).toMatch(/rpc\(\s*'schema_columns_named'/)

    // The three arrays may be COMPARED against, never used to decide what to look at.
    expect(weekKeyedFn).not.toMatch(/new Set<string>\(\[\s*\n?\s*\.\.\.WEEK_KEYED_TABLES/)
  })

  it('an empty schema answer fails rather than reporting a clean zero', () => {
    // 2026-09-04: a regression comparison ran on two empty files and reported
    // success. A probe that reaches nothing must not look like a clean schema.
    expect(weekKeyedFn).toMatch(/rows\.length === 0/)
  })

  it('checks BOTH directions — a listed table that lost its column also fails', () => {
    // Direction 2. A dropped or renamed table leaves a name in the array that
    // supersede() goes on writing to.
    expect(weekKeyedFn).toMatch(/for \(const table of WEEK_KEYED_TABLES\)/)
    expect(weekKeyedFn).toMatch(/the live schema has no week_n column/)
  })

  it('the RPC it depends on is committed as a migration', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260918_schema_columns_rpc.sql'),
      'utf8',
    )
    expect(sql).toMatch(/create or replace function public\.schema_columns_named/)
    // Read-only, and reachable only by the role that already holds the service key.
    expect(sql).toMatch(/grant execute on function public\.schema_columns_named\(text\[\]\) to service_role/)
    expect(sql, 'anon must not be able to enumerate the schema').toMatch(/revoke all .* from anon/)
    expect(sql, 'security definer would widen this beyond the caller').not.toMatch(/security definer/i)
  })
})
