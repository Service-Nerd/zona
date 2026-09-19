import { generateRulePlan } from '../../lib/plan/ruleEngine'
import { distanceEnvelope } from '../../lib/plan/useCaseEnvelope'
for (const [d,vol,days] of [[5,5,6],[42.2,15,5],[21.1,10,5],[42.2,70,5]] as const) {
  const c = distanceEnvelope(d).find(x=>(x.input as any).current_weekly_km===vol&&(x.input as any).days_available===days)
  if(!c){console.log('no case');continue}
  const m = generateRulePlan(c.input,'paid').meta as any
  console.log(`${d}km ${vol}km/wk ${days}d ->`, m.frequency_constraint_note ?? '(no note — not constrained)')
}
