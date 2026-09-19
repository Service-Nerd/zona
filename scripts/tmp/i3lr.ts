import { generateRulePlan } from '../../lib/plan/ruleEngine'
import { distanceEnvelope } from '../../lib/plan/useCaseEnvelope'
import { sessionKmSelfPaced } from '../../lib/plan/sessionDistance'
const c = distanceEnvelope(21.1).find(x=>(x.input as any).current_weekly_km===10&&(x.input as any).days_available===4&&(x.input as any).fitness_level==='intermediate')!
const i = c.input as any
console.log(`${c.label}\n  declared ${i.current_weekly_km}km/wk, longest_recent_run ${i.longest_recent_run_km}km`)
const p = generateRulePlan(c.input,'paid')
for (const w of p.weeks.filter(w=>w.n>0).slice(0,6)) {
  let lr=0
  for (const s of Object.values(w.sessions??{})) { const ss=s as any; if(ss?.role==='long_run') lr=sessionKmSelfPaced(ss)??0 }
  console.log(`  wk${w.n} weekly=${w.weekly_km}km  longRun=${lr.toFixed(1)}km = ${((lr/(w.weekly_km||1))*100).toFixed(0)}% of week`)
}
