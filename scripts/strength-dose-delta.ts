/** Willy's binding condition on STRENGTH-PAIR-STRIDE-01: does the time freed by correct
 *  pairing change the DOSE? Sets, items, minutes, and the two things the clock drops. */
import { cohortGrid, targetedGrid, COHORT_PLAN_START } from '@/lib/plan/cohortGrid'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { isDesignedRefusal } from '@/lib/plan/designedRefusal'
import { planToRunContext } from '@/lib/strength-bridge/runContext'
import { strengthProfileGrid } from '@/lib/strength-bridge/profileGrid'
import { generateStrengthPlan, CATALOGUE_BY_ID, PATTERN_REGION } from '@/packages/strength'

const strideArg = process.argv.indexOf('--stride')
const STRIDE = strideArg > 0 ? Number(process.argv[strideArg + 1]) : 1500
const inputs = [...cohortGrid().filter((_, i) => i % STRIDE === 0),
                ...targetedGrid().filter((_, i) => i % Math.max(1, Math.floor(STRIDE / 8)) === 0)]

let sessions = 0, sets = 0, items = 0, mainSets = 0, accSets = 0, coreSets = 0, plyoSets = 0, withPlyo = 0, withUpper = 0
for (const input of inputs) {
  let rp: any
  try { rp = generateRulePlan(input, 'paid', COHORT_PLAN_START) } catch (e) { if (isDesignedRefusal(e)) continue; throw e }
  const ctx = planToRunContext(rp)
  for (const prof of strengthProfileGrid()) {
    const sp: any = generateStrengthPlan(prof, ctx)
    for (const w of sp.weeks ?? []) for (const s of w.sessions ?? []) {
      if (s.kind === 'mobility') continue
      sessions++
      let plyo = false, upper = false
      for (const b of s.blocks ?? []) {
        if (b.role === 'warmup' || b.role === 'mobility') continue
        for (const it of b.items) {
          items++; sets += it.sets ?? 0
          if (b.role === 'main') mainSets += it.sets ?? 0
          else if (b.role === 'core') coreSets += it.sets ?? 0
          else if (b.role === 'plyo') plyoSets += it.sets ?? 0
          else accSets += it.sets ?? 0
          if (b.role === 'plyo') plyo = true
          if (PATTERN_REGION[CATALOGUE_BY_ID.get(it.exercise_id)!.pattern] === 'upper') upper = true
        }
      }
      if (plyo) withPlyo++
      if (upper) withUpper++
    }
  }
}
const per = (n: number) => (n / sessions).toFixed(3)
const pct = (n: number) => (n / sessions * 100).toFixed(1) + '%'
console.log(`sessions ${sessions}`)
console.log(`items/session   ${per(items)}`)
console.log(`SETS/session    ${per(sets)}   (main ${per(mainSets)} · accessory ${per(accSets)} · core ${per(coreSets)} · plyo ${per(plyoSets)})`)
console.log(`sessions w/ jumps ${pct(withPlyo)} · w/ upper work ${pct(withUpper)}`)
