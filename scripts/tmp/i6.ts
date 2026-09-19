import { generateRulePlan } from '../../lib/plan/ruleEngine'
import { isDesignedRefusal } from '../../lib/plan/designedRefusal'
import { distanceEnvelope } from '../../lib/plan/useCaseEnvelope'
console.log('ZERO-QUALITY among BEGINNERS, by their actual weekly volume:')
for (const d of [5,10,21.1,42.2]) {
  const byVol: Record<number,{a:number;z:number;note:number}> = {}
  for (const c of distanceEnvelope(d)) {
    const i = c.input as any
    if (i.fitness_level !== 'beginner') continue
    let p; try { p = generateRulePlan(c.input,'paid') } catch(e){ if(isDesignedRefusal(e)) continue; throw e }
    byVol[i.current_weekly_km] ??= {a:0,z:0,note:0}
    byVol[i.current_weekly_km].a++
    let q=0
    for (const w of p.weeks) for (const s of Object.values(w.sessions??{})) {
      const ss=s as any; if (ss && ['quality','tempo','intervals','hard'].includes(ss.type)) q++
    }
    if (q===0) { byVol[i.current_weekly_km].z++
      const m = p.meta as any
      if (m.hard_pref_note || m.volume_constraint_note) byVol[i.current_weekly_km].note++ }
  }
  const parts = Object.keys(byVol).map(Number).sort((a,b)=>a-b)
    .map(k=>`${k}km ${Math.round(byVol[k].z/byVol[k].a*100)}%${byVol[k].z?`(${Math.round(byVol[k].note/byVol[k].z*100)}% explained)`:''}`)
  console.log(`  ${String(d).padStart(5)}km: ${parts.join('  ')}`)
}
