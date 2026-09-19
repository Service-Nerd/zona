import { generateRulePlan } from '../../lib/plan/ruleEngine'
import { validatePlan } from '../../lib/plan/invariants'
import { isDesignedRefusal } from '../../lib/plan/designedRefusal'
import { distanceEnvelope } from '../../lib/plan/useCaseEnvelope'
// Reproduce and characterise: which 100K inputs, and what is week 18?
let shown = 0
const profile: Record<string, number> = {}
for (const c of distanceEnvelope(100)) {
  let p; try { p = generateRulePlan(c.input,'paid') } catch(e){ if(isDesignedRefusal(e)) continue; throw e }
  const errs = validatePlan(p, c.input).filter(v=>v.severity==='error')
  if (!errs.length) continue
  const i = c.input as any
  profile[`${i.days_available}d`] = (profile[`${i.days_available}d`]??0)+1
  profile[i.fitness_level] = (profile[i.fitness_level]??0)+1
  profile[`${i.current_weekly_km}km`] = (profile[`${i.current_weekly_km}km`]??0)+1
  profile[`runway${p.weeks.length}`] = (profile[`runway${p.weeks.length}`]??0)+1
  if (shown++ === 0) {
    console.log('EXAMPLE:', c.label)
    for (const e of errs) console.log('  ', e.code, 'wk', e.week)
    const w = p.weeks.find(x => x.n === errs[0].week)!
    console.log(`  week ${w.n}: phase=${w.phase} type=${w.type} label="${w.label}"`)
    console.log(`    theme: ${w.theme}`)
    console.log('    sessions:', Object.entries(w.sessions??{}).map(([d,s])=>`${d}:${(s as any)?.type}`).join(' '))
  }
}
console.log(`\ntotal invalid: ${shown}`)
console.log('profile of the affected:', JSON.stringify(profile))
