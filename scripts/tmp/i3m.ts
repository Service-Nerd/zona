import { generateRulePlan } from '../../lib/plan/ruleEngine'
import { validatePlan } from '../../lib/plan/invariants'
import { isDesignedRefusal } from '../../lib/plan/designedRefusal'
import { auditPlanQuality } from '../../lib/plan/planQuality'
import { effectiveStartKm } from '../../lib/plan/startVolume'
import { distanceEnvelope, DISTANCE_BANDS } from '../../lib/plan/useCaseEnvelope'
let tot=0, fit=0, ref=0
const codes: Record<string,number> = {}
const leaps: number[] = []; const peaks: number[] = []
for (const d of DISTANCE_BANDS) for (const c of distanceEnvelope(d.value).filter((_,i)=>i%13===0)) {
  tot += c.weight
  let p; try { p = generateRulePlan(c.input,'paid') } catch(e:any){ if(isDesignedRefusal(e)){ref+=c.weight; codes['REFUSED:'+e.name]=(codes['REFUSED:'+e.name]??0)+c.weight; continue} throw e }
  const m = p.meta as any
  const maint = m.volume_profile==='maintenance' && !!m.volume_constraint_note
  const errs = validatePlan(p,c.input).filter(v=>v.severity==='error')
  const objs = auditPlanQuality(p,c.input).filter(o=>!(o.code==='LONG-RUN-SHORT'&&d.value>42.2)&&!(o.code==='NEVER-BUILDS'&&maint))
  for (const o of objs) codes[o.code]=(codes[o.code]??0)+c.weight
  if(!errs.length&&!objs.length) fit+=c.weight
  const start = effectiveStartKm(c.input)
  const w1 = p.weeks.find(w=>w.n===1)?.weekly_km ?? 0
  leaps.push(w1/Math.max(start,0.1))
  peaks.push(Math.max(...p.weeks.filter(w=>w.type!=='deload').map(w=>w.weekly_km??0)))
}
const med=(a:number[])=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:0}
const pc=(x:number)=>(x/tot*100).toFixed(1)+'%'
console.log(`FIT ${pc(fit)} | refused ${pc(ref)} | median wk1/start ${med(leaps).toFixed(2)}x | median peak ${med(peaks).toFixed(1)}km`)
for (const [k,v] of Object.entries(codes).sort((a,b)=>b[1]-a[1])) console.log(`   ${k.padEnd(24)} ${pc(v)}`)
