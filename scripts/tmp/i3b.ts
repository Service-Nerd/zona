import { generateRulePlan } from '../../lib/plan/ruleEngine'
import { isDesignedRefusal } from '../../lib/plan/designedRefusal'
import { auditPlanQuality } from '../../lib/plan/planQuality'
import { effectiveStartKm } from '../../lib/plan/startVolume'
import { distanceEnvelope, DISTANCE_BANDS } from '../../lib/plan/useCaseEnvelope'
const deltas: number[] = []
const buckets: Record<string, number> = {}
for (const d of DISTANCE_BANDS) for (const c of distanceEnvelope(d.value).filter((_,i)=>i%17===0)) {
  let p; try { p = generateRulePlan(c.input,'paid') } catch(e){ if(isDesignedRefusal(e)) continue; throw e }
  if (!auditPlanQuality(p, c.input).some(x=>x.code==='WEEK1-LEAP')) continue
  const start = effectiveStartKm(c.input)
  const w1 = p.weeks.find(w=>w.n===1)?.weekly_km ?? 0
  const delta = w1 - start
  deltas.push(delta)
  const b = delta <= 2 ? 'a: <=2km' : delta <= 5 ? 'b: 2-5km' : delta <= 10 ? 'c: 5-10km' : 'd: >10km'
  buckets[b] = (buckets[b]??0)+1
}
deltas.sort((a,b)=>a-b)
console.log(`flagged WEEK1-LEAP: ${deltas.length}`)
console.log(`absolute week-1 increase among them: median ${deltas[Math.floor(deltas.length/2)].toFixed(1)}km, p90 ${deltas[Math.floor(deltas.length*0.9)].toFixed(1)}km, max ${deltas[deltas.length-1].toFixed(1)}km`)
console.log('by absolute size:')
for (const k of Object.keys(buckets).sort()) console.log(`   ${k}: ${buckets[k]} (${Math.round(buckets[k]/deltas.length*100)}%)`)
