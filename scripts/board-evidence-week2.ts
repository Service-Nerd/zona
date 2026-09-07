// Board evidence — CB-ONSET-03. What does "quality in calendar week 2" require?
//
// The founder asked for week 1; the board refused (§91) and delivered week 3.
// He has now asked for week 2. This measures what that costs BEFORE the board
// rules, so the sitting argues about numbers rather than intuitions.
//
//   npx tsx scripts/board-evidence-week2.ts
// REPORTS ONLY.
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import { GENERATION_CONFIG } from '../lib/plan/generationConfig'
import type { GeneratorInput, Plan } from '../types/plan'

const TODAY = '2026-09-07'
const founder = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  age: 44, goal: 'time_target', max_hr: 185, terrain: 'road',
  benchmark: { time: '0:49:00', type: 'race', distance_km: 10 },
  race_date: '2026-12-12', resting_hr: 52, target_time: '0:45:00',
  training_age: '2-5yr', max_hr_source: 'observed', days_available: 4,
  max_weekday_mins: 60, race_distance_km: 10, current_weekly_km: 30,
  days_cannot_train: ['monday', 'wednesday', 'thursday'],
  user_declared_level: 'experienced', longest_recent_run_km: 10,
  preferred_long_run_day: 'sun', recent_quality_training: 'regular',
  hard_session_relationship: 'love', ...o,
} as GeneratorInput)

const hasQuality = (w: Plan['weeks'][number]) =>
  Object.values(w.sessions).some(s => s?.type === 'quality')

console.log('='.repeat(78))
console.log('CB-ONSET-03 — what stands between the runner and calendar week 2?')
console.log('='.repeat(78))

const plan = generateRulePlan(founder(), 'paid')
const composed = composePlanWithFoundation(plan, founder(), TODAY)
console.log('\nFounder\'s plan as it ships today:')
composed.plan.weeks.slice(0, 5).forEach((w, i) => {
  console.log(`  calendar wk ${i + 1}  ${String(w.label).slice(0, 34).padEnd(34)} ` +
    `phase=${String(w.phase).padEnd(10)} quality=${hasQuality(w) ? 'YES' : 'no'}`)
})

const foundationWeeks = composed.plan.weeks.filter(w => w.phase === 'foundation').length
const baseWeeks = plan.weeks.filter(w => w.n >= 1 && w.phase === 'base').length
console.log(`\n  foundation weeks (§57, all-easy) : ${foundationWeeks}`)
console.log(`  base weeks (§4/§5, all-easy)     : ${baseWeeks}`)
console.log(`  TOTAL all-easy on-ramp           : ${foundationWeeks + baseWeeks}`)
console.log(`  MIN_BASE_WEEKS_FLOOR             : ${GENERATION_CONFIG.MIN_BASE_WEEKS_FLOOR}`)

console.log(`
  ARITHMETIC. Quality lands the week after the on-ramp ends, so:
      calendar onset = on-ramp weeks + 1
  Week 3 today because the on-ramp is 2. Week 2 requires an on-ramp of ONE.

  The on-ramp is 2 because §57 put TWO foundation weeks in front of the plan,
  and they are all-easy by §57's own session-content rule. Note what this means:
  the base floor is ALREADY fully absorbed (base = ${baseWeeks}). Lowering
  MIN_BASE_WEEKS_FLOOR from 2 to 1 would change NOTHING for this runner — the
  binding constraint is the FOUNDATION BLOCK LENGTH, not the base floor.`)

// Which runners are actually blocked by which constraint?
console.log('\n' + '='.repeat(78))
console.log('WHO IS BLOCKED BY WHAT — gated 10K runner, by weeks to race')
console.log('='.repeat(78))
console.log('  wks   foundation   base   on-ramp   onset   binding constraint')
for (const w of [12, 13, 14, 15, 16, 18, 20]) {
  const d = new Date(`${TODAY}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + w * 7)
  const inp = founder({ race_date: d.toISOString().slice(0, 10) })
  const p = generateRulePlan(inp, 'paid')
  const c = composePlanWithFoundation(p, inp, TODAY)
  const f = c.plan.weeks.filter(x => x.phase === 'foundation').length
  const b = p.weeks.filter(x => x.n >= 1 && x.phase === 'base').length
  const onset = c.plan.weeks.findIndex(hasQuality) + 1
  const binding = f > 1 ? 'foundation block length (§57)'
    : b > 0 ? 'base floor (§89/§91, Seiler)'
    : 'neither — already minimal'
  console.log(`  ${String(w).padStart(3)}   ${String(f).padStart(10)}   ${String(b).padStart(4)}   ` +
    `${String(f + b).padStart(7)}   ${String(onset).padStart(5)}   ${binding}`)
}
console.log()
