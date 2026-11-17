// MAXHR-AGE-ABSENT-01 — the measurement the item demands before anything is proposed.
//
// READ-ONLY. The item is a COUNT ("6 of 24 runners have neither `date_of_birth` nor
// `birth_year`"), and it says so itself: *"measure what their plans actually do before
// proposing anything — the engine may already have a separate path, and this is a count,
// not a diagnosis."*
//
// `resolveMaxHr(supplied, age, source)` needs an age, because every arm of §50's asymmetry is
// relative to the Tanaka estimate. There are SIX callers. `inputs.ts:682` says *"age is always
// required"* and THROWS, so the generation path cannot be reached without one — which means the
// exposure, if any, is on the other five.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolveMaxHr, tanakaMaxHR } from '../lib/plan/maxHrGuard'

const env = readFileSync('/Users/russe/rts-training-hub/.env.local', 'utf8')
const g = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? ''
const sb = createClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('SUPABASE_SERVICE_ROLE_KEY'))

async function main() {
  const { data: settings, error: se } = await sb.from('user_settings')
    .select('id, max_hr, max_hr_source, resting_hr, birth_year, date_of_birth')
  if (se) { console.error('user_settings read failed:', se.message); process.exit(2) }
  const { data: plans, error: pe } = await sb.from('plans').select('user_id, plan_json')
  if (pe) { console.error('plans read failed:', pe.message); process.exit(2) }

  const planByUser = new Map<string, Record<string, unknown>>()
  for (const p of plans ?? []) {
    const meta = (p.plan_json as { meta?: Record<string, unknown> } | null)?.meta
    if (meta) planByUser.set(String(p.user_id), meta)
  }

  const ageless = (settings ?? []).filter(s => !s.birth_year && !s.date_of_birth)
  const withMax = ageless.filter(s => typeof s.max_hr === 'number' && (s.max_hr as number) > 0)

  console.log(`\nuser_settings rows: ${settings?.length ?? 0}`)
  console.log(`  no age on file (neither birth_year nor date_of_birth): ${ageless.length}`)
  console.log(`  of those, carrying a stored max_hr:                    ${withMax.length}`)

  // ── 1. THE GENERATION PATH. `inputs.ts` throws without an age, so a stored plan proves an
  //       age existed AT GENERATION even where `user_settings` has none now.
  let agelessWithPlan = 0, agelessPlanMaxTrusted = 0
  const detail: string[] = []
  for (const s of ageless) {
    const meta = planByUser.get(String(s.id))
    if (!meta) continue
    agelessWithPlan++
    const planAge = meta.age
    const derived = meta.hr_derived_max
    const method = meta.hr_zone_method
    const src = meta.hr_max_source
    if (method === 'karvonen' || method === 'max_hr_pct') agelessPlanMaxTrusted++
    detail.push(`  ${String(s.id).slice(0, 8)} settings max=${s.max_hr ?? 'null'} src=${s.max_hr_source ?? 'null'}`
      + ` | plan: age=${planAge ?? 'ABSENT'} derived_max=${derived ?? 'n/a'} method=${method ?? 'n/a'} max_source=${src ?? 'n/a'}`)
  }
  console.log(`\n── 1. THE GENERATION PATH (resolveMaxHr via buildHRZonesWithFallback) ──`)
  console.log(`ageless runners who HAVE a stored plan: ${agelessWithPlan}`)
  for (const d of detail) console.log(d)
  if (agelessWithPlan === 0) {
    console.log('  none — so no ageless runner has ever had a plan generated, and the engine arm is UNREACHED.')
  }

  // ── 2. WHAT THE GUARD WOULD DO IF AN AGE EXISTED. The cost of not being able to ask.
  console.log(`\n── 2. WHAT §50 WOULD SAY IF THESE RUNNERS HAD AN AGE ──`)
  console.log(`A stored max is taken as given when the guard cannot run. For each ageless runner with a`)
  console.log(`max, this is the outcome the guard WOULD return at a span of plausible ages:`)
  for (const s of withMax) {
    const outcomes = [25, 35, 45, 55, 65].map(age => {
      const r = resolveMaxHr(s.max_hr as number, age, (s.max_hr_source ?? undefined) as never)
      return `${age}:${r.outcome === 'trusted' ? 'ok' : r.outcome}(${r.effectiveMax})`
    })
    console.log(`  ${String(s.id).slice(0, 8)} max=${s.max_hr} src=${s.max_hr_source ?? 'null'}  ${outcomes.join(' ')}`)
  }
  if (withMax.length === 0) console.log('  none carry a stored max, so there is nothing for the guard to judge.')

  // ── 3. THE SPREAD THAT MATTERS: would the ANSWER differ across ages?
  console.log(`\n── 3. DOES THE MISSING AGE CHANGE THE ANSWER? ──`)
  let differs = 0
  for (const s of withMax) {
    const set = new Set([25, 35, 45, 55, 65].map(age =>
      resolveMaxHr(s.max_hr as number, age, (s.max_hr_source ?? undefined) as never).effectiveMax))
    if (set.size > 1) { differs++; console.log(`  ${String(s.id).slice(0, 8)} max=${s.max_hr} -> effective varies: ${Array.from(set).join('/')} (Tanaka 25..65 = ${tanakaMaxHR(25)}..${tanakaMaxHR(65)})`) }
  }
  console.log(`  ${differs} of ${withMax.length} would get a DIFFERENT effective max depending on their age.`)
  console.log(`  ${withMax.length - differs} would get the same answer at every age, so for them the missing age costs nothing.`)

  // ── 4. THE WORST CASE: no max AND no age, so EVERY zone rests on the invented number.
  const noMax = ageless.filter(s => !(typeof s.max_hr === 'number' && (s.max_hr as number) > 0))
  const noMaxWithPlan = noMax.filter(s => planByUser.has(String(s.id)))
  console.log(`\n── 4. NO MAX AND NO AGE — every zone rests on the assumed age ──`)
  console.log(`ageless runners with NO stored max: ${noMax.length} (of ${ageless.length} ageless)`)
  console.log(`  of those, with a generated plan: ${noMaxWithPlan.length}`)
  for (const s of noMaxWithPlan) {
    const meta = planByUser.get(String(s.id))!
    console.log(`  ${String(s.id).slice(0,8)} plan age=${meta.age} derived_max=${meta.hr_derived_max ?? 'n/a'} method=${meta.hr_zone_method}`)
  }
  console.log(`  Tanaka at the assumed 30 = ${tanakaMaxHR(30)} bpm. At 60 it is ${tanakaMaxHR(60)} — a ${tanakaMaxHR(30) - tanakaMaxHR(60)} bpm`)
  console.log(`  error on EVERY zone boundary at once, in the direction that prescribes too hard.`)
  console.log(`\n⚠️ AND THE WIZARD SHOWS A DIFFERENT NUMBER FROM THE ONE IT USES: the birth-year wheel rests at`)
  console.log(`   currentYear - 35 (GeneratePlanScreen.tsx:2207) while a skipped step is priced at age 30`)
  console.log(`   (:1024). Tanaka 35 = ${tanakaMaxHR(35)}, Tanaka 30 = ${tanakaMaxHR(30)}. The step is \`optional: true\` (:282) and`)
  console.log(`   canProceed returns true unconditionally (:976), so skipping it is a supported path.`)
}
main()
