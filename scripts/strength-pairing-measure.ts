/** STRENGTH-PAIR-STRIDE-01 — how many accessory/core items are left unpaired by the
 *  FIXED-STRIDE walk, when a non-competing partner existed elsewhere in the list? */
import { cohortGrid, targetedGrid, COHORT_PLAN_START } from '@/lib/plan/cohortGrid'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { isDesignedRefusal } from '@/lib/plan/designedRefusal'
import { planToRunContext } from '@/lib/strength-bridge/runContext'
import { strengthProfileGrid } from '@/lib/strength-bridge/profileGrid'
import { generateStrengthPlan, CATALOGUE_BY_ID, PATTERN_REGION } from '@/packages/strength'
import { sessionParts, trainingParts } from '@/lib/strength-bridge/sessionParts'

const strideArg = process.argv.indexOf('--stride')
const STRIDE = strideArg > 0 ? Number(process.argv[strideArg + 1]) : 1500
const inputs = [...cohortGrid().filter((_, i) => i % STRIDE === 0),
                ...targetedGrid().filter((_, i) => i % Math.max(1, Math.floor(STRIDE / 8)) === 0)]

let sessions = 0, strandedSessions = 0, strandedItems = 0, pairableItems = 0, partsTotal = 0, recoverable = 0
const partHist = new Map<number, number>()

for (const input of inputs) {
  let rp: any
  try { rp = generateRulePlan(input, 'paid', COHORT_PLAN_START) } catch (e) { if (isDesignedRefusal(e)) continue; throw e }
  const ctx = planToRunContext(rp)
  for (const prof of strengthProfileGrid()) {
    const sp: any = generateStrengthPlan(prof, ctx)
    for (const w of sp.weeks ?? []) for (const s of w.sessions ?? []) {
      if (s.kind === 'mobility') continue
      sessions++
      const n = trainingParts(sessionParts(s)).length
      partsTotal += n; partHist.set(n, (partHist.get(n) ?? 0) + 1)
      const pairable = (s.blocks ?? []).filter((b: any) => b.role === 'accessory' || b.role === 'core').flatMap((b: any) => b.items)
      pairableItems += pairable.length
      const unpaired = pairable.filter((i: any) => !i.superset)
      strandedItems += unpaired.length
      if (unpaired.length) strandedSessions++
      // Could any unpaired item have paired with ANOTHER unpaired item (different region)?
      const regions = unpaired.map((i: any) => PATTERN_REGION[CATALOGUE_BY_ID.get(i.exercise_id)!.pattern])
      let free = [...regions], made = 0
      for (let i = 0; i < free.length; i++) {
        if (free[i] == null) continue
        const j = free.findIndex((r, k) => k > i && r != null && r !== free[i])
        if (j > -1) { free[i] = null as any; free[j] = null as any; made++ }
      }
      recoverable += made * 2
    }
  }
}
const pct = (a: number, b: number) => b ? (a / b * 100).toFixed(1) + '%' : 'n/a'
console.log(`sessions ${sessions} · mean training parts ${(partsTotal / sessions).toFixed(2)}`)
console.log(`accessory+core items ${pairableItems} · UNPAIRED ${strandedItems} (${pct(strandedItems, pairableItems)})`)
console.log(`sessions with >=1 unpaired ${strandedSessions} (${pct(strandedSessions, sessions)})`)
console.log(`of those unpaired, pairable with ANOTHER unpaired item: ${recoverable} (${pct(recoverable, strandedItems)})`)
console.log('parts per session:', Array.from(partHist.entries()).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' '))
