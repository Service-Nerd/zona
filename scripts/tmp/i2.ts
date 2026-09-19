import { generateRulePlan } from '../../lib/plan/ruleEngine'
import { isDesignedRefusal } from '../../lib/plan/designedRefusal'
import { auditPlanQuality } from '../../lib/plan/planQuality'
import { distanceEnvelope, DISTANCE_BANDS } from '../../lib/plan/useCaseEnvelope'
import { GENERATION_CONFIG as G } from '../../lib/plan/generationConfig'
console.log('MIN_SESSION_DISTANCE_ABSOLUTE_KM =', G.MIN_SESSION_DISTANCE_ABSOLUTE_KM)
console.log('\nDAYS-SHORT rate by declared days and by volume:')
const byDays: Record<number,{a:number;s:number}> = {}
const byVol: Record<string,{a:number;s:number}> = {}
let egLow = '', egHigh = ''
for (const d of DISTANCE_BANDS) for (const c of distanceEnvelope(d.value).filter((_,i)=>i%17===0)) {
  let p; try { p = generateRulePlan(c.input,'paid') } catch(e){ if(isDesignedRefusal(e)) continue; throw e }
  const i = c.input as any
  const f = auditPlanQuality(p, c.input).find(x=>x.code==='DAYS-SHORT')
  byDays[i.days_available] ??= {a:0,s:0}; byDays[i.days_available].a++
  const vb = i.current_weekly_km >= 40 ? '40+km/wk' : i.current_weekly_km >= 20 ? '20-39' : '<20'
  byVol[vb] ??= {a:0,s:0}; byVol[vb].a++
  if (f) {
    byDays[i.days_available].s++; byVol[vb].s++
    if (i.current_weekly_km >= 40 && !egHigh) egHigh = `${c.label} :: ${f.detail}`
    if (i.current_weekly_km < 20 && !egLow) egLow = `${c.label} :: ${f.detail}`
  }
}
for (const k of Object.keys(byDays).map(Number).sort()) console.log(`   ${k} days: ${Math.round(byDays[k].s/byDays[k].a*100)}%`)
for (const k of Object.keys(byVol).sort()) console.log(`   ${k}: ${Math.round(byVol[k].s/byVol[k].a*100)}%`)
console.log('\n LOW-volume example :', egLow)
console.log(' HIGH-volume example:', egHigh || '(none — never happens at 40+ km/wk)')
