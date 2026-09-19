import { generateRulePlan } from '../../lib/plan/ruleEngine'
import { distanceEnvelope } from '../../lib/plan/useCaseEnvelope'
import { auditPlanQuality } from '../../lib/plan/planQuality'
const c = distanceEnvelope(5).find(x => (x.input as any).days_available===6 && (x.input as any).current_weekly_km===5)!
const p = generateRulePlan(c.input,'paid')
console.log(c.label)
for (const w of p.weeks.filter(w=>w.n>0)) {
  const runs = Object.values(w.sessions??{}).filter((s:any)=>s && !['rest','strength','cross-train'].includes(s.type))
  const mn = Math.min(...runs.map((s:any)=>s.distance_km ?? 99))
  console.log(`  wk${String(w.n).padStart(2)} ${String(w.phase).padEnd(6)} km=${String(w.weekly_km).padStart(4)} runs=${runs.length}/6  shortest=${mn===99?'-':mn+'km'}`)
}
console.log('objections:', auditPlanQuality(p, c.input).map(o=>`${o.code}(${o.detail})`).join('; '))
