import { generateRulePlan } from '../../lib/plan/ruleEngine'
import { distanceEnvelope } from '../../lib/plan/useCaseEnvelope'
import { sessionKmSelfPaced } from '../../lib/plan/sessionDistance'
// Under today's engine, where in the plan is the long-run share worst?
const shares: number[] = []
let worstWeekIdxPct: number[] = []
for (const c of distanceEnvelope(21.1).filter((_,i)=>i%53===0)) {
  const p = generateRulePlan(c.input,'paid')
  const weeks = p.weeks.filter(w=>w.n>0 && w.type!=='deload')
  let worst = 0, worstAt = 0
  weeks.forEach((w,idx)=>{
    let lr=0; for (const s of Object.values(w.sessions??{})) { const ss=s as any; if(ss?.role==='long_run') lr=sessionKmSelfPaced(ss)??0 }
    const sh = lr/(w.weekly_km||1); if (sh>worst){worst=sh;worstAt=idx/weeks.length}
  })
  shares.push(worst); worstWeekIdxPct.push(worstAt)
}
const med=(a:number[])=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]}
console.log(`HM: median worst long-run share ${(med(shares)*100).toFixed(0)}% of its week, occurring at ${(med(worstWeekIdxPct)*100).toFixed(0)}% through the plan`)
