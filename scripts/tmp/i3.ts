import { generateRulePlan } from '../../lib/plan/ruleEngine'
import { isDesignedRefusal } from '../../lib/plan/designedRefusal'
import { auditPlanQuality } from '../../lib/plan/planQuality'
import { effectiveStartKm } from '../../lib/plan/startVolume'
import { distanceEnvelope, DISTANCE_BANDS } from '../../lib/plan/useCaseEnvelope'
const byVol: Record<string,{a:number;s:number}> = {}
let egs: string[] = []
let ratios: number[] = []
for (const d of DISTANCE_BANDS) for (const c of distanceEnvelope(d.value).filter((_,i)=>i%17===0)) {
  let p; try { p = generateRulePlan(c.input,'paid') } catch(e){ if(isDesignedRefusal(e)) continue; throw e }
  const i = c.input as any
  const start = effectiveStartKm(c.input)
  const w1 = p.weeks.find(w=>w.n===1)?.weekly_km ?? 0
  const peak = Math.max(...p.weeks.filter(w=>w.type!=='deload').map(w=>w.weekly_km??0))
  const vb = i.current_weekly_km >= 40 ? '40+' : i.current_weekly_km >= 20 ? '20-39' : '<20'
  byVol[vb] ??= {a:0,s:0}; byVol[vb].a++
  const f = auditPlanQuality(p, c.input).find(x=>x.code==='WEEK1-LEAP')
  if (f) {
    byVol[vb].s++
    ratios.push(w1/start)
    if (egs.length<3) egs.push(`${c.label} :: start ${start.toFixed(0)} wk1 ${w1.toFixed(0)} peak ${peak.toFixed(0)} | wk1 is ${(w1/peak*100).toFixed(0)}% of peak`)
  }
}
const med=(a:number[])=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:0}
console.log('WEEK1-LEAP by starting volume:')
for (const k of Object.keys(byVol).sort()) console.log(`   ${k.padEnd(6)} ${Math.round(byVol[k].s/byVol[k].a*100)}%  (${byVol[k].s}/${byVol[k].a})`)
console.log(`median leap ratio among flagged: ${med(ratios).toFixed(2)}x  (threshold 1.30)`)
egs.forEach(e=>console.log('  ', e))
