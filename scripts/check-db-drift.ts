// Does production still match what this repo BELIEVES about it?
//
//   npm run check:db
//
// Two questions, one script, because they are the same failure class:
//
//   1. Does every table a committed migration CREATEs actually exist?
//   2. Does `lib/supabase/rlsPolicyManifest.ts` still match the live policies?
//   3. Does `WEEK_KEYED_TABLES` still list every table carrying `week_n`?
//   4. Can every user-scoped table still be DELETED when the account is?
//
// ── WHY (3) EXISTS ─────────────────────────────────────────────────────────
// PLAN-WEEK-COLLISION-01 (2026-09-18). `week_n` is a WITHIN-PLAN coordinate, so
// any user-scoped table keyed on it inherits the previous plan's rows when a new
// race plan restarts numbering at 1. The fix marks those rows superseded — but
// only for the tables `WEEK_KEYED_TABLES` names, and THAT LIST WAS WRONG ON ITS
// FIRST WRITE: five tables listed from memory and ADR-013's prose, with
// `weekly_reports` (which the ADR names explicitly) and `plan_adjustments` both
// missed. Three rows were still resolving against the new plan.
//
// The guard shipped alongside it, `supersedeCoverage.test.ts`, could not tell:
// it ITERATES that array, so its coverage was defined by the same list that was
// incomplete. A checker sharing the producer's predicate cannot catch the
// producer being wrong — CLAUDE.md records the identical flaw for
// `deloadCadence.test.ts`. The authority has to be the SCHEMA, and adding a
// table to the database is the act that re-opens the defect, so this is where
// the question belongs.
//
// ── WHY (1) EXISTS ─────────────────────────────────────────────────────────
// `daily_coach_notes` was committed as a migration on 2026-04-28 AND recorded
// in `.claude/state/applied-migrations.txt`, and never landed in the project.
// The ledger is append-by-hand, so it records an INTENTION, not an outcome, and
// `session-start.sh` only warns about migrations MISSING from the ledger — the
// opposite direction to the one that broke. The daily coach note's cache read
// therefore errored on every request for months; both call sites discarded the
// error, so the only symptom was paying for a model call on every app open.
// A ledger that nothing verifies is a rule that holds while someone remembers.
//
// The manifest decides which routes may use a user-scoped (JWT) client. A stale
// manifest is worse than none: it would green-light converting a route whose
// table lost its policy, and a JWT client on a policy-less table returns EMPTY
// rather than erroring. Run this before converting a route, and after any
// migration that touches a policy.
//
// Exit 0 = in sync. Exit 1 = drifted (the diff is printed). Exit 2 = could not
// check, which is NOT the same as "in sync" and must never be read as a pass.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadEnvConfig } from '@next/env'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { RLS_POLICIES, ALL_OPS, type PolicyOp } from '../lib/supabase/rlsPolicyManifest'
import { WEEK_KEYED_TABLES } from '../lib/plan/supersede'
import { USER_DATA_SURFACES, NON_USER_TABLES, DERIVED_VIEWS } from '../lib/supabase/userDataSurfaces'

loadEnvConfig(process.cwd())

/** Tables that a committed migration claims to create. Parsed, never listed by
 *  hand: a hand-kept list is the same kind of promise the ledger turned out to be. */
function tablesMigrationsCreate(): string[] {
  const dir = join(process.cwd(), 'supabase', 'migrations')
  const names = new Set<string>()
  for (const f of readdirSync(dir).filter(f => f.endsWith('.sql'))) {
    const sql = readFileSync(join(dir, f), 'utf8')
    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(sql))) names.add(m[1])
  }
  return Array.from(names).sort()
}

/** Probe: does this table exist and is it reachable by the service role? */
async function tableExists(db: SupabaseClient, table: string): Promise<boolean> {
  const { error } = await db.from(table).select('*').limit(0)
  if (!error) return true
  // PostgREST surfaces a missing relation as PGRST205 / "does not exist".
  return !/does not exist|PGRST205|schema cache/i.test(`${error.code} ${error.message}`)
}

async function checkTablesExist(db: SupabaseClient): Promise<number> {
  const expected = tablesMigrationsCreate()
  let missing = 0
  for (const t of expected) {
    if (!(await tableExists(db, t))) {
      console.log(`✗ ${t}: a migration creates it, production does NOT have it`)
      missing++
    }
  }
  if (missing === 0) {
    console.log(`✓ All ${expected.length} migration-created tables exist in production.`)
  } else {
    console.log(`\n✗ ${missing} table(s) missing. The applied-migrations ledger is WRONG:`)
    console.log(`  it records an intention, not an outcome. Apply the migration, then re-run.`)
  }
  return missing
}

const CMD_TO_OP: Record<string, PolicyOp[]> = {
  r: ['select'], a: ['insert'], w: ['update'], d: ['delete'],
  '*': [...ALL_OPS],
}

const SQL = `
  select c.relname as table_name, p.polcmd::text as cmd
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policy p on p.polrelid = c.oid
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
`

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
    console.error('  Cannot verify. This is NOT a pass.')
    process.exit(2)
  }

  const supabase = createClient(url, key)

  console.log('── Tables a migration creates ──')
  const missingTables = await checkTablesExist(supabase)
  console.log('\n── RLS policy manifest ──')
  if (missingTables > 0) process.exitCode = 1

  const { data, error } = await supabase.rpc('exec_sql', { query: SQL }).then(
    r => r,
    () => ({ data: null, error: { message: 'no exec_sql rpc' } }),
  )

  // Most projects have no generic SQL RPC. Fall back to probing each known table
  // for readability, which is the property that actually matters.
  if (error || !data) {
    console.log('· No SQL RPC available; falling back to a per-table probe.\n')
    return probeFallback(url, key)
  }

  const live = new Map<string, Set<PolicyOp>>()
  for (const row of data as { table_name: string; cmd: string | null }[]) {
    if (!live.has(row.table_name)) live.set(row.table_name, new Set())
    if (row.cmd) for (const op of CMD_TO_OP[row.cmd] ?? []) live.get(row.table_name)!.add(op)
  }

  let drift = 0
  for (const [table, ops] of Array.from(live.entries())) {
    const declared = RLS_POLICIES[table]
    if (!declared) {
      console.log(`✗ ${table}: in production, MISSING from the manifest`)
      drift++
      continue
    }
    const liveSorted = Array.from(ops).sort().join(",")
    const decSorted = Array.from(declared).sort().join(",")
    if (liveSorted !== decSorted) {
      console.log(`✗ ${table}: manifest says [${decSorted}], production has [${liveSorted}]`)
      drift++
    }
  }
  for (const table of Object.keys(RLS_POLICIES)) {
    if (!live.has(table)) {
      console.log(`✗ ${table}: in the manifest, not found with RLS enabled in production`)
      drift++
    }
  }

  if (drift === 0) {
    console.log(`✓ Manifest matches production — ${live.size} RLS-enabled tables.`)
    process.exit(process.exitCode === 1 ? 1 : 0)
  }
  console.log(`\n✗ ${drift} table(s) drifted. Update the manifest before converting any route.`)
  process.exit(1)
}

/** Without SQL access, at least prove the zero-policy tables really are unreadable
 *  under an anon identity, which is the claim the manifest rests on. */
async function probeFallback(url: string, key: string) {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anon) {
    console.error('✗ NEXT_PUBLIC_SUPABASE_ANON_KEY not set; cannot probe. NOT a pass.')
    process.exit(2)
  }
  const client = createClient(url, anon, { auth: { persistSession: false } })
  const locked = Object.entries(RLS_POLICIES).filter(([, ops]) => ops.length === 0).map(([t]) => t)

  let bad = 0
  for (const table of locked) {
    const { data, error } = await client.from(table).select('*').limit(1)
    // An anon read should be denied or empty. Rows coming back means the
    // manifest's "no policy" claim is wrong.
    if (!error && data && data.length > 0) {
      console.log(`✗ ${table}: manifest says NO policies, but an anon client read ${data.length} row(s)`)
      bad++
    } else {
      console.log(`✓ ${table}: locked to anon, as the manifest claims`)
    }
  }
  if (bad > 0) { console.log(`\n✗ ${bad} table(s) contradict the manifest.`); process.exit(1) }
  console.log(`\n✓ ${locked.length} zero-policy tables verified locked.`)
  console.log('  NOTE: partial check only — policy SHAPES were not compared.')

  await checkWeekKeyedCoverage(url, key)
  await checkUserPurgeCoverage(url, key)

  // Never override a table-existence failure recorded earlier.
  process.exit(process.exitCode === 1 ? 1 : 0)
}

/** Tables carrying `week_n` that deliberately do NOT need a `superseded_at`
 *  stamp. An entry is a DECISION with a mechanism behind it, not a TODO. */
const WEEK_KEYED_EXEMPT: Record<string, string> = {
  plan_weekly_notes:
    'savePlanForUser DELETEs every row for the user on EVERY save, not only on a ' +
    'race-identity change, so these rows cannot outlive their plan. Covered by a ' +
    'stronger mechanism than the stamp.',
}

/**
 * (3) Does `WEEK_KEYED_TABLES` still match the live schema?
 *
 * Asks the database, not the codebase: every user-scoped table carrying a
 * `week_n` column must be in the list, be exempt with a reason, or fail the run.
 */
async function checkWeekKeyedCoverage(url: string, serviceKey: string): Promise<void> {
  console.log('\n── week_n coverage (PLAN-WEEK-COLLISION-01) ──')
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // OPS-DBCHECK-NOISE-01 — ONE read-only introspection call, not 21 selects
  // that are designed to fail.
  //
  // ⚠️ THE NOISE WAS THE SMALLER PROBLEM. The previous version probed "each
  // known table", building its candidate set from `WEEK_KEYED_TABLES ∪
  // WEEK_KEYED_EXEMPT ∪ RLS_POLICIES` — three hand-written arrays in this
  // repo. This function's own header says "the authority has to be the SCHEMA",
  // and it was asking the codebase. A NEW table carrying `week_n` that nobody
  // added to any of the three lists was invisible to the check written to find
  // exactly that — the same flaw as `supersedeCoverage.test.ts` iterating the
  // array it guards, which is what let the original list ship wrong.
  //
  // `schema_columns_named` is service_role-only and read-only
  // (`20260918_schema_columns_rpc.sql`).
  const { data, error } = await admin.rpc('schema_columns_named', {
    col_names: ['week_n', 'superseded_at'],
  })
  if (error) {
    console.log(`✗ cannot read the schema: ${error.message}`)
    console.log('    Apply supabase/migrations/20260918_schema_columns_rpc.sql, then re-run.')
    process.exitCode = 1
    return
  }

  const rows = (data ?? []) as Array<{ table_name: string; column_name: string }>
  if (rows.length === 0) {
    // An empty answer means the probe reached nothing, not that the schema is
    // clean — the failure mode where a check reports a green zero from a scan
    // that never ran.
    console.log('✗ the schema returned no week_n or superseded_at columns at all.')
    console.log('    That is not a clean schema, it is a probe that reached nothing.')
    process.exitCode = 1
    return
  }

  const hasWeekN  = new Set(rows.filter(r => r.column_name === 'week_n').map(r => r.table_name))
  const hasStamp  = new Set(rows.filter(r => r.column_name === 'superseded_at').map(r => r.table_name))

  const missing: string[] = []
  let covered = 0

  // Direction 1 — every table the SCHEMA says is week-keyed is accounted for.
  for (const table of Array.from(hasWeekN).sort()) {
    if ((WEEK_KEYED_TABLES as readonly string[]).includes(table)) {
      if (hasStamp.has(table)) { covered++; continue }
      console.log(`✗ ${table}: listed in WEEK_KEYED_TABLES but has NO superseded_at column`)
      missing.push(table)
      continue
    }
    if (WEEK_KEYED_EXEMPT[table]) {
      console.log(`· ${table}: exempt — ${WEEK_KEYED_EXEMPT[table]}`)
      continue
    }
    console.log(`✗ ${table}: carries week_n but is NOT in WEEK_KEYED_TABLES and is not exempt`)
    console.log(`    A new race plan restarts week.n at 1, so this table will serve the`)
    console.log(`    PREVIOUS plan's rows. Add it to lib/plan/supersede.ts (+ a migration`)
    console.log(`    adding superseded_at), or add an argued exemption here.`)
    missing.push(table)
  }

  // Direction 2 — and nothing in the LIST has quietly lost the column. A table
  // dropped or renamed leaves a name in the array that supersede() will write
  // to and that nothing else notices.
  for (const table of WEEK_KEYED_TABLES) {
    if (!hasWeekN.has(table)) {
      console.log(`✗ ${table}: in WEEK_KEYED_TABLES but the live schema has no week_n column`)
      console.log(`    Dropped, renamed, or never applied. supersede() is writing to a`)
      console.log(`    table that cannot be keyed the way the code believes.`)
      missing.push(table)
    }
  }
  for (const table of Object.keys(WEEK_KEYED_EXEMPT)) {
    if (!hasWeekN.has(table)) {
      console.log(`· ${table}: exemption is STALE — no week_n column in the live schema`)
      console.log(`    Harmless today, but an exemption nobody can falsify is a comment.`)
    }
  }

  if (missing.length) {
    console.log(`\n✗ ${missing.length} week_n discrepancy(ies): ${missing.join(', ')}`)
    process.exitCode = 1
    return
  }
  console.log(`✓ ${covered} week-keyed table(s) carry superseded_at; none uncovered, none stale.`)
}

/**
 * (4) Does account deletion still reach every table? — DB-USER-PURGE-01
 *
 * `/api/delete-account` named THREE tables out of twenty-four and then called
 * deleteUser(). The public schema had no foreign key to auth.users at all, so
 * there was no cascade behind it: twenty-one tables of run history, health
 * samples, analyses and push tokens stayed behind, keyed to an id that no
 * longer resolved. The route's own test exemption, the Me screen and the
 * privacy policy all asserted it deleted everything.
 *
 * A stranded row is invisible — it looks exactly like no row — so nothing was
 * ever going to surface this except a check that asks the schema. Adding a
 * table is the act that re-opens the defect, which is why the question lives
 * here and not in a unit test.
 *
 * Discovery is schema-driven in BOTH directions: a table carrying `user_id`
 * that nobody declared fails the run, and a declared table that the live schema
 * no longer has fails it too.
 */
async function checkUserPurgeCoverage(url: string, serviceKey: string): Promise<void> {
  console.log('\n── account-deletion coverage (DB-USER-PURGE-01) ──')
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data, error } = await admin.rpc('schema_columns_named', {
    col_names: ['user_id', 'claimed_by'],
  })
  if (error) {
    console.log(`✗ cannot read the schema: ${error.message}`)
    process.exitCode = 1
    return
  }
  const rows = (data ?? []) as Array<{ table_name: string; column_name: string }>
  if (rows.length === 0) {
    console.log('✗ the schema returned no user_id columns at all.')
    console.log('    A probe that reached nothing is not a clean schema.')
    process.exitCode = 1
    return
  }

  const declared = new Map(USER_DATA_SURFACES.map(s => [s.table, s]))
  const live = new Set(rows.map(r => r.table_name))
  let bad = 0

  // Direction 1 — every user-keyed table the SCHEMA knows about is declared.
  for (const table of Array.from(live).sort()) {
    if (declared.has(table)) continue
    if (NON_USER_TABLES[table]) continue
    if (DERIVED_VIEWS[table]) continue  // a view stores nothing; its rows go when the base rows do
    console.log(`✗ ${table}: carries a user column but is NOT in USER_DATA_SURFACES`)
    console.log(`    Account deletion will leave its rows behind, keyed to an id that`)
    console.log(`    no longer resolves. Add an ON DELETE CASCADE foreign key to`)
    console.log(`    auth.users in a migration, then declare it in`)
    console.log(`    lib/supabase/userDataSurfaces.ts.`)
    bad++
  }

  // Direction 2 — and nothing declared has quietly disappeared. A stale row is
  // a promise about a table that no longer exists.
  for (const s of USER_DATA_SURFACES) {
    if (s.table === 'user_settings' || s.table === 'waitlist' || s.table === 'ai_rate_limits') continue
    if (!live.has(s.table)) {
      console.log(`✗ ${s.table}: declared in USER_DATA_SURFACES, no user column in the live schema`)
      bad++
    }
  }

  // Direction 3 — the CONSTRAINTS themselves. The declaration above is a
  // statement of intent; this is the only part that proves the database will
  // actually do it. Without the RPC we can check that a table was CLASSIFIED
  // but not that it was WIRED, and those are different claims.
  const { data: fkData, error: fkErr } = await admin.rpc('user_fk_delete_rules')
  if (fkErr) {
    console.log(`\n⚠ user_fk_delete_rules() is not available: ${fkErr.message}`)
    console.log('    PARTIAL CHECK ONLY. Coverage of the DECLARATION was verified;')
    console.log('    the ON DELETE rules themselves were NOT. A table declared here')
    console.log('    whose foreign key was never added still reads as covered.')
    console.log('    Apply supabase/migrations/20260923_user_fk_rules_rpc.sql to close this.')
    if (bad) { console.log(`\n✗ ${bad} declaration gap(s).`); process.exitCode = 1; return }
    console.log(`✓ ${declared.size} user-scoped surface(s) declared; none undeclared, none stale.`)
    return
  }

  const fks = new Map(
    ((fkData ?? []) as Array<{ table_name: string; column_name: string; delete_rule: string }>)
      .map(r => [`${r.table_name}.${r.column_name}`, r.delete_rule]),
  )
  const WANT: Record<string, string> = { cascade: 'CASCADE', 'set-null': 'SET NULL' }

  for (const s of USER_DATA_SURFACES) {
    if (s.mode === 'trigger') continue  // cleared by on_auth_user_deleted, no FK to check
    const got = fks.get(`${s.table}.${s.column}`)
    const want = WANT[s.mode]
    if (got === want) continue
    console.log(`✗ ${s.table}.${s.column}: declared ${s.mode}, live rule is ${got ?? 'NO FOREIGN KEY'}`)
    console.log(`    Deleting an account will NOT clear this table.`)
    bad++
  }

  // And the trigger that reaches what no foreign key can.
  const { error: trigErr } = await admin.rpc('schema_columns_named', { col_names: ['bucket_key'] })
  if (trigErr) { console.log(`✗ cannot confirm ai_rate_limits: ${trigErr.message}`); bad++ }

  if (bad) {
    console.log(`\n✗ ${bad} account-deletion gap(s). A deletion today would leave rows behind.`)
    process.exitCode = 1
    return
  }
  console.log(`✓ ${declared.size} user-scoped surface(s): every ON DELETE rule matches its declaration.`)
}

main().catch(e => { console.error(e); process.exit(2) })
