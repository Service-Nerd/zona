import { generateRulePlan } from '../../lib/plan/ruleEngine'
import { isDesignedRefusal } from '../../lib/plan/designedRefusal'
import { auditPlanQuality } from '../../lib/plan/planQuality'
import { effectiveStartKm } from '../../lib/plan/startVolume'
import { distanceEnvelope, DISTANCE_BANDS } from '../../lib/plan/useCaseEnvelope'
const egs: string[] = []
const prof: Record<string, number> = {}
for (const d of DISTANCE_BANDS) for (const c of distanceEnvelope(d.value).filter((_,i)=>i%17===0)) {
  let p; try { p = generateRulePlan(c.input,'paid') } catch(e){ if(isDesignedRefusal(e)) continue; throw e }
  if (!auditPlanQuality(p, c.input).some(x=>x.code==='WEEK1-LEAP')) continue
  const start = effectiveStartKm(c.input)
  const w1 = p.weeks.find(w=>w.n===1)?.weekly_km ?? 0
  if (w1 - start <= 10) continue
  const i = c.input as any
  const peak = Math.max(...p.weeks.filter(w=>w.type!=='deload').map(w=>w.weekly_km??0))
  prof[`${i.race_distance_km}km`] = (prof[`${i.race_distance_km}km`]??0)+1
  prof[i.fitness_level] = (prof[i.fitness_level]??0)+1
  prof[`declared${i.current_weekly_km}`] = (prof[`declared${i.current_weekly_km}`]??0)+1
  if (egs.length<4) egs.push(`${c.label}\n      declared ${i.current_weekly_km} -> effectiveStart ${start.toFixed(1)} -> wk1 ${w1} (peak ${peak}, wk1 = ${(w1/peak*100).toFixed(0)}% of peak)`)
}
console.log('WEEK1 jumps >10km — who:'); console.log(JSON.stringify(prof))
egs.forEach(e=>console.log('  ', e))
