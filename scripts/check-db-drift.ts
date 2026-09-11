// Does production still match what this repo BELIEVES about it?
//
//   npm run check:db
//
// Two questions, one script, because they are the same failure class:
//
//   1. Does every table a committed migration CREATEs actually exist?
//   2. Does `lib/supabase/rlsPolicyManifest.ts` still match the live policies?
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
  // Never override a table-existence failure recorded earlier.
  process.exit(process.exitCode === 1 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(2) })
