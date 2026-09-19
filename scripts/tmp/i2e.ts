import { generateRulePlan } from '../../lib/plan/ruleEngine'
import { validatePlan } from '../../lib/plan/invariants'
import { isDesignedRefusal } from '../../lib/plan/designedRefusal'
import { auditPlanQuality } from '../../lib/plan/planQuality'
import { distanceEnvelope, DISTANCE_BANDS } from '../../lib/plan/useCaseEnvelope'
let fitW=0, totW=0
for (const d of DISTANCE_BANDS) {
  let tot=0, fit=0
  for (const c of distanceEnvelope(d.value).filter((_,i)=>i%13===0)) {
    tot += c.weight
    let p; try { p = generateRulePlan(c.input,'paid') } catch(e){ if(isDesignedRefusal(e)) continue; throw e }
    const m = p.meta as any
    const maint = m.volume_profile==='maintenance' && !!m.volume_constraint_note
    const errs = validatePlan(p,c.input).filter(v=>v.severity==='error')
    const objs = auditPlanQuality(p,c.input).filter(o=>!(o.code==='LONG-RUN-SHORT'&&d.value>42.2)&&!(o.code==='NEVER-BUILDS'&&maint))
    if(!errs.length&&!objs.length) fit+=c.weight
  }
  fitW+=fit*d.weight; totW+=tot*d.weight
  console.log(`  ${String(d.value).padStart(5)}km  ${(fit/tot*100).toFixed(1)}%`)
}
console.log(`WHOLE PRODUCT: ${(fitW/totW*100).toFixed(1)}%`)
