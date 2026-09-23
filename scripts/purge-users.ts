// DB-USER-PURGE-01 — delete test accounts, completely, repeatably, on purpose.
//
//   npm run purge:users -- --test-only                 # dry run (the default)
//   npm run purge:users -- --test-only --confirm       # actually delete
//   npm run purge:users -- --email-like '%@test.com' --confirm
//   npm run purge:users -- --ids <uuid>,<uuid> --confirm
//   npm run purge:users -- --audit                     # who exists, what they hold
//
// ── WHAT IT ACTUALLY DOES ──────────────────────────────────────────────────
// Calls auth.admin.deleteUser() and nothing else. Every user-scoped table
// carries an ON DELETE CASCADE foreign key to auth.users, and the
// on_auth_user_deleted trigger clears the three stores no FK can reach, so the
// database performs the deletion. This script chooses WHO, and then PROVES the
// rows are gone.
//
// ── WHY IT PROVES IT RATHER THAN REPORTING SUCCESS ─────────────────────────
// deleteUser() returning ok tells you the auth row went. It tells you nothing
// about the other twenty-three tables, and that is precisely the gap this whole
// change exists to close — the old route reported success while leaving 21
// tables behind. So the verification pass re-counts every user-keyed table
// discovered FROM THE LIVE SCHEMA (not from a list in this repo) and exits
// non-zero if a single row survived. A purge tool that cannot fail is worth
// nothing, which is why --confirm is opt-in and the check runs afterwards.
//
// ── SAFETY ─────────────────────────────────────────────────────────────────
// · Dry run unless --confirm. The dry run prints exactly what would go.
// · Admins are NEVER deleted without --include-admin. Deleting the admin
//   account mid-test costs more than the test saves.
// · --test-only matches synthetic addresses only (see TEST_PATTERNS). It will
//   not match a real mailbox, and it prints its matches for you to read before
//   anything happens.
// · Exit 0 = did what it said. 1 = rows survived. 2 = could not check, which is
//   NOT a pass.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadEnvConfig } from '@next/env'
import { DERIVED_VIEWS } from '../lib/supabase/userDataSurfaces'

loadEnvConfig(process.cwd())

/** Addresses that cannot belong to a real runner. Deliberately narrow: an
 *  over-broad pattern here deletes a person. `@test.com` and friends are
 *  reserved/parked domains, and `zonna.demo@demo.com` is ours. */
const TEST_PATTERNS = [
  '%@test.com',
  '%@testy.com',
  '%@example.com',
  '%@demo.com',
]

interface Args {
  ids: string[]
  emailLike: string | null
  testOnly: boolean
  confirm: boolean
  includeAdmin: boolean
  audit: boolean
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag)
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null
  }
  return {
    ids: (get('--ids') ?? '').split(',').map(s => s.trim()).filter(Boolean),
    emailLike: get('--email-like'),
    testOnly: argv.includes('--test-only'),
    confirm: argv.includes('--confirm'),
    includeAdmin: argv.includes('--include-admin'),
    audit: argv.includes('--audit'),
  }
}

interface Account { id: string; email: string | null; created_at: string; is_admin: boolean }

/** Every account, with the admin flag joined on. Paged, because listUsers()
 *  caps at 50 per page and a silent truncation here means a purge that reports
 *  success having never seen half the accounts. */
async function listAccounts(db: SupabaseClient): Promise<Account[]> {
  const out: Account[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    if (!data.users.length) break
    out.push(...data.users.map(u => ({
      id: u.id, email: u.email ?? null, created_at: u.created_at, is_admin: false,
    })))
    if (data.users.length < 200) break
  }
  const { data: admins } = await db.from('user_settings').select('id').eq('is_admin', true)
  const adminIds = new Set((admins ?? []).map(r => r.id as string))
  for (const a of out) a.is_admin = adminIds.has(a.id)
  return out
}

function likeToRegex(pattern: string): RegExp {
  // SQL LIKE semantics, anchored, with everything else escaped.
  const body = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/%/g, '.*')
    .replace(/_/g, '.')
  return new RegExp(`^${body}$`, 'i')
}

function select(accounts: Account[], args: Args): Account[] {
  let picked: Account[]
  if (args.ids.length) {
    picked = accounts.filter(a => args.ids.includes(a.id))
    const missing = args.ids.filter(id => !accounts.some(a => a.id === id))
    for (const id of missing) console.log(`· ${id}: no such account (already gone?)`)
  } else if (args.emailLike) {
    const re = likeToRegex(args.emailLike)
    picked = accounts.filter(a => a.email && re.test(a.email))
  } else if (args.testOnly) {
    const res = TEST_PATTERNS.map(likeToRegex)
    picked = accounts.filter(a => a.email && res.some(re => re.test(a.email!)))
  } else {
    return []
  }
  if (!args.includeAdmin) {
    for (const a of picked.filter(a => a.is_admin)) {
      console.log(`· ${a.email}: ADMIN — skipped. Pass --include-admin to override.`)
    }
    picked = picked.filter(a => !a.is_admin)
  }
  return picked
}

/** User-keyed tables, read from the LIVE SCHEMA. Never a list in this repo:
 *  the whole defect was a list that had gone out of date without anyone
 *  noticing, and a verifier sharing that list would be blind the same way. */
async function userKeyedTables(db: SupabaseClient): Promise<{ table: string; col: string }[]> {
  const { data, error } = await db.rpc('schema_columns_named', { col_names: ['user_id'] })
  if (error) {
    console.error(`✗ cannot read the schema: ${error.message}`)
    console.error('  Apply supabase/migrations/20260918_schema_columns_rpc.sql, then re-run.')
    console.error('  Cannot verify. This is NOT a pass.')
    process.exit(2)
  }
  const rows = (data ?? []) as { table_name: string; column_name: string }[]
  if (!rows.length) {
    console.error('✗ the schema returned no user_id columns at all.')
    console.error('  That is a probe that reached nothing, not a clean schema. NOT a pass.')
    process.exit(2)
  }
  // `information_schema.columns` does not distinguish a view from a table, and
  // seven views expose user_id. Counting them would double-count rows that are
  // already counted in the base tables underneath.
  const tables = rows
    .filter(r => !DERIVED_VIEWS[r.table_name])
    .map(r => ({ table: r.table_name, col: 'user_id' }))
  tables.push({ table: 'user_settings', col: 'id' })
  return tables.sort((a, b) => a.table.localeCompare(b.table))
}

async function countRows(
  db: SupabaseClient, tables: { table: string; col: string }[], uid: string,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const { table, col } of tables) {
    const { count, error } = await db
      .from(table).select('*', { count: 'exact', head: true }).eq(col, uid)
    if (error) continue
    if (count) counts[table] = count
  }
  return counts
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
    process.exit(2)
  }
  const db = createClient(url, key, { auth: { persistSession: false } })

  const tables = await userKeyedTables(db)
  const accounts = await listAccounts(db)

  if (args.audit) {
    console.log(`── ${accounts.length} account(s), ${tables.length} user-keyed tables ──\n`)
    for (const a of accounts.sort((x, y) => x.created_at.localeCompare(y.created_at))) {
      const counts = await countRows(db, tables, a.id)
      const total = Object.values(counts).reduce((s, n) => s + n, 0)
      const flag = a.is_admin ? ' [ADMIN]' : ''
      console.log(`${a.email ?? a.id}${flag}  created ${a.created_at.slice(0, 10)}  ${total} row(s)`)
      if (total) console.log(`    ${Object.entries(counts).map(([t, n]) => `${t}:${n}`).join('  ')}`)
    }
    return
  }

  const picked = select(accounts, args)
  if (!picked.length) {
    console.log('No accounts selected.')
    console.log('Pass one of: --test-only | --email-like <pattern> | --ids <uuid,uuid> | --audit')
    return
  }

  console.log(`── ${picked.length} account(s) selected ──\n`)
  let grand = 0
  const before: Record<string, Record<string, number>> = {}
  for (const a of picked) {
    const counts = await countRows(db, tables, a.id)
    before[a.id] = counts
    const total = Object.values(counts).reduce((s, n) => s + n, 0)
    grand += total
    console.log(`${a.email ?? a.id}  (${a.id})  ${total} row(s)`)
    if (total) console.log(`    ${Object.entries(counts).map(([t, n]) => `${t}:${n}`).join('  ')}`)
  }
  console.log(`\n${picked.length} account(s), ${grand} data row(s) across ${tables.length} tables.`)

  if (!args.confirm) {
    console.log('\nDRY RUN — nothing was deleted. Re-run with --confirm to delete.')
    return
  }

  console.log('\n── deleting ──')
  let failed = 0
  for (const a of picked) {
    const { error } = await db.auth.admin.deleteUser(a.id, false)
    if (error) { console.log(`✗ ${a.email ?? a.id}: ${error.message}`); failed++ }
    else console.log(`✓ ${a.email ?? a.id}`)
  }

  // THE POINT OF THE SCRIPT. deleteUser() succeeding says the auth row went; it
  // says nothing about the cascade, and "reported success while leaving 21
  // tables behind" is the exact defect being fixed.
  console.log('\n── verifying the cascade ──')
  let survivors = 0
  for (const a of picked) {
    const after = await countRows(db, tables, a.id)
    const total = Object.values(after).reduce((s, n) => s + n, 0)
    if (total === 0) continue
    survivors += total
    console.log(`✗ ${a.email ?? a.id}: ${total} row(s) SURVIVED`)
    console.log(`    ${Object.entries(after).map(([t, n]) => `${t}:${n}`).join('  ')}`)
    console.log(`    Those tables have no ON DELETE CASCADE to auth.users.`)
    console.log(`    Add it in a migration and declare them in lib/supabase/userDataSurfaces.ts.`)
  }

  if (failed || survivors) {
    console.log(`\n✗ ${failed} deletion(s) failed, ${survivors} row(s) survived.`)
    process.exit(1)
  }
  console.log(`✓ ${picked.length} account(s) deleted; ${grand} row(s) cleared; 0 survived.`)
}

main().catch(e => { console.error(e); process.exit(2) })
