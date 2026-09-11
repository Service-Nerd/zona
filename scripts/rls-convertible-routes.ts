// SEC-08 — which per-user routes can move off the service-role client?
//
//   npx tsx scripts/rls-convertible-routes.ts
//
// Reads every API route, extracts the (table, operation) pairs it performs, and
// cross-references `lib/supabase/rlsPolicyManifest.ts`. A route is CONVERTIBLE
// only when every operation it performs is permitted by a policy — because a
// JWT client on an uncovered table returns EMPTY instead of erroring, so a
// wrong conversion is silent.
//
// This is a REPORT, not a gate. It exists because doing 34 routes by eye is the
// same job as the one that produced the failure class it is protecting against.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { RLS_POLICIES, type PolicyOp } from '../lib/supabase/rlsPolicyManifest'
import { extractTableUsage, withHelperUsage, acceptsInternalServiceCall } from '../lib/supabase/routeTableUsage'

const ROOT = process.cwd()
const API = join(ROOT, 'app', 'api')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : /route\.tsx?$/.test(name) ? [p] : []
  })
}


const rows: {
  route: string; perUser: boolean; serviceRole: boolean; alreadyScoped: boolean
  blockers: string[]; usage: Map<string, Set<PolicyOp>>
}[] = []

for (const file of walk(API)) {
  const src = readFileSync(file, 'utf8')
  const serviceRole = src.includes('SUPABASE_SERVICE_ROLE_KEY')
  const alreadyScoped = src.includes('createUserScopedClient')
  const perUser = src.includes('getUserFromRequest')
  if (!serviceRole && !alreadyScoped) continue

  const { usage } = withHelperUsage(src, extractTableUsage(src))
  const blockers: string[] = []
  if (!alreadyScoped && acceptsInternalServiceCall(src)) {
    blockers.push('accepts an internal x-service-key call — no user JWT on that path; needs branching, not a swap')
  }
  for (const [table, ops] of Array.from(usage.entries())) {
    const allowed = RLS_POLICIES[table]
    if (!allowed) { blockers.push(`${table}: NOT IN MANIFEST`); continue }
    const missing = Array.from(ops).filter(op => !allowed.includes(op))
    if (missing.length) {
      blockers.push(`${table}: needs ${missing.join('+')}, policy allows [${allowed.join(',') || 'NOTHING'}]`)
    }
  }
  rows.push({ route: relative(ROOT, file), perUser, serviceRole, alreadyScoped, blockers, usage })
}

const scoped   = rows.filter(r => r.alreadyScoped)
const eligible = rows.filter(r => !r.alreadyScoped && r.perUser && r.blockers.length === 0 && r.usage.size > 0)
const blocked  = rows.filter(r => !r.alreadyScoped && r.perUser && r.blockers.length > 0)
const notUser  = rows.filter(r => !r.alreadyScoped && !r.perUser)
const noTables = rows.filter(r => !r.alreadyScoped && r.perUser && r.usage.size === 0)

const fmt = (u: Map<string, Set<PolicyOp>>) =>
  Array.from(u.entries()).map(([t, o]) => `${t}(${Array.from(o).sort().join('/')})`).join(' ')

console.log(`\n═══ SEC-08 — user-scoped client rollout ═══\n`)
console.log(`✅ ALREADY CONVERTED (${scoped.length})`)
for (const r of scoped) console.log(`   ${r.route}`)

console.log(`\n🟢 CONVERTIBLE — every operation is covered by a policy (${eligible.length})`)
for (const r of eligible) console.log(`   ${r.route}\n       ${fmt(r.usage)}`)

console.log(`\n🔴 BLOCKED — a JWT client would silently fail here (${blocked.length})`)
for (const r of blocked) {
  console.log(`   ${r.route}`)
  for (const b of r.blockers) console.log(`       ${b}`)
}

console.log(`\n⚪ NOT PER-USER — cron / webhook / admin, service role is correct (${notUser.length})`)
for (const r of notUser) console.log(`   ${r.route}`)

if (noTables.length) {
  console.log(`\n⚪ NO TABLE ACCESS DETECTED (${noTables.length})`)
  for (const r of noTables) console.log(`   ${r.route}`)
}

console.log(`\n─── ${rows.length} routes examined ───\n`)
