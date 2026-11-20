// Design Board evidence, 2026-11-20 — PLAN-NOTE-MULTIWEEK-RAMP-01 (encoding). READ-ONLY: generates plans in memory.
// Writes nothing, reads no production table.
//   NODE_ENV=production npx tsx scripts/board-evidence-design-plan-note-multiweek-ramp-01.ts [stride] [injury,csv]
// Simulates the Coaching Board's stamp (distinct warned weeks; scope 'non_long' where that week carries
// INV-PLAN-INJURY-CAP-DELIVERED) and measures what the ENCODING has to survive: marks per plan, consecutive
// stamped weeks (Now + Next both carrying the line), mixed scopes in one plan, collisions with deload / taper /
// race / peak / tune-up / week 1, and how many marks a Later strip list would show.
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { validatePlan } from '../lib/plan/invariants'
import { RAMP_RESIDUAL_CODES } from '../lib/plan/loadResidualNote'

const stride = Number(process.argv[2] ?? 23)
const inj = process.argv[3] ? process.argv[3].split(',') : null
const bump = (m: Record<string, number>, k: string | number) => { m[String(k)] = (m[String(k)] ?? 0) + 1 }

const grid = cohortGrid().filter((_, i) => i % stride === 0).map(x => inj ? { ...x, injury_history: inj } : x)
let plans = 0, threw = 0, warned = 0, withConsecutive = 0, mixedScope = 0, stampedTotal = 0
const marksPerPlan: Record<string, number> = {}, longestRun: Record<string, number> = {}
const collide: Record<string, number> = {}, phase: Record<string, number> = {}
for (const input of grid) {
  let plan: any
  try {
    const raw = generateRulePlan(input, 'free', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
    plan = composePlanWithFoundation(raw, input, COHORT_PLAN_START, 'add').plan
  } catch { threw++; continue }
  plans++
  const v = validatePlan(plan, input).filter(x => RAMP_RESIDUAL_CODES.includes(x.code) && (x as any).ramp && x.week > 0)
  if (!v.length) continue
  warned++
  const scope = new Map<number, string>()
  for (const x of v) {
    const s = x.code === 'INV-PLAN-INJURY-CAP-DELIVERED' ? 'non_long' : 'whole'
    if (scope.get(x.week) !== 'non_long') scope.set(x.week, s)
  }
  const wks = Array.from(scope.keys()).sort((a, b) => a - b)
  stampedTotal += wks.length
  bump(marksPerPlan, wks.length >= 4 ? '4+' : wks.length)
  let run = 1, best = 1
  for (let i = 1; i < wks.length; i++) { run = wks[i] === wks[i - 1] + 1 ? run + 1 : 1; best = Math.max(best, run) }
  bump(longestRun, best)
  if (best >= 2) withConsecutive++
  if (new Set(scope.values()).size > 1) mixedScope++
  const weeks = plan.weeks as any[]
  for (const n of wks) {
    const w = weeks.find(z => z.n === n)
    if (!w) { bump(collide, 'week missing'); continue }
    bump(phase, w.phase ?? '?')
    if (w.type === 'deload' || w.badge === 'deload') bump(collide, 'deload')
    if (w.phase === 'taper') bump(collide, 'taper')
    if (w.badge === 'race' || w.type === 'race') bump(collide, 'race')
    if (w.phase === 'peak') bump(collide, 'peak (suffix replaces · peak)')
    if (w.tune_up_callout) bump(collide, 'tune-up week')
    if (n === weeks[0]?.n) bump(collide, 'first week (no Next card precedes)')
  }
}
const pct = (a: number, b: number) => `${a} of ${b} (${b ? (100 * a / b).toFixed(1) : '0'}%)`
console.log(`\n== cohortGrid stride ${stride}, injury ${inj ?? 'none'}: ${plans} plans (${threw} threw)`)
console.log(`warned ${warned}; stamped weeks ${stampedTotal} (${(stampedTotal / warned).toFixed(2)} per warned plan)`)
console.log(`marks per warned plan`, marksPerPlan)
console.log(`longest run of consecutive stamped weeks`, longestRun, `; plans with two stamped weeks back to back ${pct(withConsecutive, warned)}`)
console.log(`plans whose stamped weeks carry BOTH scopes ${pct(mixedScope, warned)}`)
console.log(`stamped weeks' phase`, phase)
console.log(`collisions (per stamped week)`, collide)
