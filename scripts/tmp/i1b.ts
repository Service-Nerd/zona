import { generateRulePlan } from '../../lib/plan/ruleEngine'
import { validatePlan } from '../../lib/plan/invariants'
import { isDesignedRefusal } from '../../lib/plan/designedRefusal'
import { distanceEnvelope, DISTANCE_BANDS } from '../../lib/plan/useCaseEnvelope'
let bad = 0, n = 0
for (const d of DISTANCE_BANDS) for (const c of distanceEnvelope(d.value).filter((_,i)=>i%11===0)) {
  let p; try { p = generateRulePlan(c.input,'paid') } catch(e){ if(isDesignedRefusal(e)) continue; throw e }
  n++
  if (validatePlan(p, c.input).filter(v=>v.severity==='error').length) bad++
}
console.log(`after fix: ${bad}/${n} plans with error-severity violations`)
