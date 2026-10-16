// STRENGTH-ENGINE-01 — the strength sweep: every strength profile shape, placed
// around a stride of real generated run plans, through validateStrengthPlan().
// Phase 1 exit criterion: zero violations. `npm run verify:strength`.
//
//   npx tsx scripts/strength-sweep.ts [--stride N]

import { cohortGrid, targetedGrid, COHORT_PLAN_START } from '@/lib/plan/cohortGrid'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { isDesignedRefusal } from '@/lib/plan/designedRefusal'
import { planToRunContext } from '@/lib/strength-bridge/runContext'
import { generateStrengthPlan, validateStrengthPlan, type StrengthProfile } from '@/packages/strength'
import { strengthProfileGrid } from '@/lib/strength-bridge/profileGrid'

const strideArg = process.argv.indexOf('--stride')
const STRIDE = strideArg > 0 ? Number(process.argv[strideArg + 1]) : 97

const inputs = [...cohortGrid().filter((_, i) => i % STRIDE === 0), ...targetedGrid().filter((_, i) => i % Math.max(1, Math.floor(STRIDE / 8)) === 0)]
const profiles: StrengthProfile[] = strengthProfileGrid()
const byCode = new Map<string, number>()
let runPlans = 0, strengthPlans = 0, refused = 0
const examples: string[] = []

for (const input of inputs) {
  let plan
  try { plan = generateRulePlan(input, 'paid', COHORT_PLAN_START) } catch (e) { if (isDesignedRefusal(e)) { refused++; continue } throw e }
  runPlans++
  const ctx = planToRunContext(plan)
  for (const p of profiles) {
    const sp = generateStrengthPlan(p, ctx)
    strengthPlans++
    for (const v of validateStrengthPlan(sp, ctx)) {
      byCode.set(v.code, (byCode.get(v.code) ?? 0) + 1)
      if (examples.length < 12) examples.push(`${v.code} w${v.week} ${v.day ?? ''} ${v.detail} | ${JSON.stringify({ f: p.focus, m: p.session_minutes, n: p.sessions_per_week, e: p.experience, kit: p.equipment.join('+') })}`)
    }
  }
}
// Standalone path.
for (const p of profiles) {
  const sp = generateStrengthPlan(p, null, { standaloneStart: '2026-10-19' })
  strengthPlans++
  for (const v of validateStrengthPlan(sp, null)) { byCode.set(v.code, (byCode.get(v.code) ?? 0) + 1); if (examples.length < 12) examples.push(`standalone ${v.code} ${v.detail}`) }
}

console.log(`run plans ${runPlans} (refused ${refused}) · strength plans ${strengthPlans} · violations ${Array.from(byCode.values()).reduce((a, b) => a + b, 0)}`)
for (const [c, n] of Array.from(byCode).sort((a, b) => b[1] - a[1])) console.log(`  ${c.padEnd(22)} ${n}`)
examples.forEach(e => console.log('  e.g. ' + e))
process.exit(byCode.size ? 1 : 0)
