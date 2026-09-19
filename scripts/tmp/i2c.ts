import { generateRulePlan } from '../../lib/plan/ruleEngine'
import { distanceEnvelope } from '../../lib/plan/useCaseEnvelope'
for (const [d, vol, days] of [[42.2, 15, 5], [21.1, 10, 5], [5, 5, 6]] as const) {
  const c = distanceEnvelope(d).find(x => (x.input as any).current_weekly_km===vol && (x.input as any).days_available===days)
  if (!c) { console.log(`no case ${d}/${vol}/${days}`); continue }
  const p = generateRulePlan(c.input,'paid')
  const counts = p.weeks.filter(w=>w.n>0).map(w=>Object.values(w.sessions??{}).filter((s:any)=>s&&!['rest','strength','cross-train'].includes(s.type)).length)
  console.log(`${d}km ${vol}km/wk ${days}d declared -> runs/week across the plan: ${counts.join(',')}  (min ${Math.min(...counts)} max ${Math.max(...counts)})`)
}
