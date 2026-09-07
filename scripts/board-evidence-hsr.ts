// Board evidence — does `hard_session_relationship` change anything a runner sees?
//
// SLT-reviewed 2026-09-07 (HSR-INERT-01). Traced statically: only two engine
// branches read it, both gated to HM/MARATHON. This proves it by DIFF rather
// than by reading, because "I read the code and it can't matter" is exactly the
// claim this repo keeps finding to be wrong.
//
//   npx tsx scripts/board-evidence-hsr.ts
//
// REPORTS ONLY — same contract as trace-plan.ts.
import { generateRulePlan } from '../lib/plan/ruleEngine'
import type { GeneratorInput, Plan } from '../types/plan'

const TODAY = '2026-09-07'
const raceDate = (w: number) => {
  const d = new Date(`${TODAY}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + w * 7)
  return d.toISOString().slice(0, 10)
}

type HSR = 'avoid' | 'neutral' | 'love' | 'overdo'

const base = (distanceKm: number, weeks: number, hsr: HSR, o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: distanceKm, race_date: raceDate(weeks), goal: 'time_target',
  target_time: distanceKm <= 10 ? '0:45:00' : distanceKm <= 21.1 ? '1:40:00' : '3:30:00',
  // Volume and recent-long-run set high enough to clear PEAK_LR_RATIO_VS_RACE,
  // otherwise the lovesHard branch is unreachable and the diff is vacuous.
  days_available: 5, age: 40, current_weekly_km: 55,
  longest_recent_run_km: Math.min(distanceKm, 22), resting_hr: 50, max_hr: 186,
  // 5yr+ DELIBERATELY. The peak long-run step-back exception (ruleEngine:3348)
  // requires it, and a '2-5yr' fixture reports HM/MARATHON as IDENTICAL —
  // a property of the fixture, not of the engine. Caught by measuring the
  // branch directly after the first run of this script claimed global inertness.
  preferred_long_run_day: 'sun', training_age: '5yr+',
  user_declared_level: 'experienced', recent_quality_training: 'regular',
  hard_session_relationship: hsr, ...o,
} as GeneratorInput)

/** Everything a runner can see, minus the field we are varying. */
const visible = (p: Plan) => JSON.stringify(
  p.weeks.map(w => ({
    n: w.n, km: w.weekly_km, type: w.type, phase: w.phase,
    s: Object.entries(w.sessions).map(([d, s]) => [
      d, s?.type, s?.label, s?.zone, s?.distance_km, s?.duration_mins,
      s?.pace_target, s?.catalogue_id, s?.coach_notes,
    ]),
  })), null, 0)

console.log('='.repeat(78))
console.log('HSR-INERT-01 — does hard_session_relationship change the delivered plan?')
console.log('='.repeat(78))
console.log('\n dist   weeks   love vs neutral   overdo vs neutral   avoid vs neutral')
console.log(' ' + '-'.repeat(74))

for (const [distanceKm, weeks, label] of [
  [5, 12, '5K'], [10, 14, '10K'], [21.1, 16, 'HM'], [42.2, 18, 'MARATHON'],
] as [number, number, string][]) {
  const ref: Record<HSR, string> = {} as Record<HSR, string>
  for (const h of ['avoid', 'neutral', 'love', 'overdo'] as HSR[]) {
    try { ref[h] = visible(generateRulePlan(base(distanceKm, weeks, h), 'paid')) }
    catch (e) { ref[h] = `ERR:${(e as Error).message.slice(0, 30)}` }
  }
  const cmp = (h: HSR) => ref[h] === ref.neutral ? 'IDENTICAL' : 'differs'
  console.log(` ${label.padEnd(9)} ${String(weeks).padStart(2)}      ` +
    `${cmp('love').padEnd(17)} ${cmp('overdo').padEnd(19)} ${cmp('avoid')}`)
}

// ── The §1 accounting question the board has to answer ──────────────────────
// §24b puts pace segments in the final two peak long runs of a 5K/10K plan. That
// session stays `type: 'easy'`, so §1 — whose numerator is `quality` sessions —
// does not count it. Quantify what it would look like if it did, because that is
// the difference between "there is headroom" and "the headroom is already spent".
console.log('\n' + '='.repeat(78))
console.log('§1 ACCOUNTING — is the §24b segmented long run an easy session?')
console.log('='.repeat(78))
const p = generateRulePlan(base(10, 14, 'love'), 'paid')
const running = p.weeks.flatMap(w => Object.values(w.sessions))
  .filter(s => s && s.type !== 'strength' && s.type !== 'cross-train')
const quality = running.filter(s => s!.type === 'quality')
const segmented = running.filter(s =>
  (s!.coach_notes ?? []).some(n => /at marathon pace|at HM pace/i.test(n ?? '')))
console.log(`  running sessions              ${running.length}`)
console.log(`  counted as quality (§1)       ${quality.length}  = ${(quality.length / running.length * 100).toFixed(1)}%`)
console.log(`  §24b segmented long runs      ${segmented.length}  (type='easy', NOT counted)`)
console.log(`  if segments counted           ${quality.length + segmented.length}  = ${((quality.length + segmented.length) / running.length * 100).toFixed(1)}%  (10K ceiling 25%)`)
for (const s of segmented) console.log(`     → "${s!.label}" zone=${s!.zone} type=${s!.type}`)
console.log()
