// measure-onset-order-cost.ts — QUALITY-ONSET-ORDER-01, the board's evidence.
//
// The finding: a runner's FIRST quality session is Zone 4-5 in 100% of beginner
// plans. The question is NOT "is that odd" but "what does each alternative
// cost", because §5's adaptation deadline is why VO2max opens build at all.
//
// Measures, for the structural-beginner cohort:
//   · goal / distance split (option 3 is "finish-goal beginners get no VO2max")
//   · how many NON-DELOAD build weeks exist (can a delay survive at all?)
//   · the adaptation runway now, and after a one-slot delay
//
// Run: NODE_ENV=production npx tsx scripts/measure-onset-order-cost.ts

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { GENERATION_CONFIG } from '../lib/plan/generationConfig'
import type { Plan, Session } from '../types/plan'

// ⚠️ 'hard' is DELIBERATELY EXCLUDED. It is the §78 recalibration 5K time trial,
// which sits on a base/build DELOAD week, is Zone 4–5 by nature (a maximal
// CONTINUOUS effort, not reps — CLAUDE.md's session-colour table says so), and is
// a BENCHMARK rather than a training stimulus. Including it produced a false
// finding: "100% of beginners meet Zone 4–5 first" was counting their time trial.
const QUALITY = new Set(['quality', 'tempo', 'intervals'])
const DAYS = ['mon','tue','wed','thu','fri','sat','sun'] as const
const isZ45 = (s: Session) => /4|5/.test(s.zone ?? '')

let plans = 0
const beginners: {
  dist: number; goal: string; weeks: number
  buildQualityWeeks: number; firstVo2Week: number | null
  taperStart: number; runwayNow: number | null; runwayDelayed: number | null
}[] = []

for (const input of cohortGrid()) {
  let plan: Plan
  try { plan = generateRulePlan(input as never, 'paid', COHORT_PLAN_START) } catch { continue }
  plans++
  if (plan.meta.fitness_level !== 'beginner') continue

  const total = plan.weeks.length
  const taperStart = plan.weeks.find(w => w.phase === 'taper')?.n ?? total
  // Build weeks that actually carry quality.
  const buildQualityWeeks = plan.weeks.filter(w =>
    w.phase === 'build' && w.type !== 'deload'
    && Object.values(w.sessions as Record<string, Session | undefined>).some(s => s && QUALITY.has(s.type))
  ).length

  let firstVo2: number | null = null
  let firstQualityWeek: number | null = null
  for (const w of plan.weeks) {
    for (const d of DAYS) {
      const s = (w.sessions as Record<string, Session | undefined>)[d]
      if (!s || !QUALITY.has(s.type)) continue
      if (firstQualityWeek == null) firstQualityWeek = w.n
      if (isZ45(s) && firstVo2 == null) firstVo2 = w.n
    }
  }
  // Runway = weeks of training between first VO2max exposure and the taper.
  const runwayNow = firstVo2 == null ? null : taperStart - firstVo2
  // A one-slot delay moves it to the next quality week (~1 week later here,
  // since beginners carry one quality session per week).
  const runwayDelayed = firstVo2 == null ? null : taperStart - (firstVo2 + 1)

  beginners.push({
    dist: plan.meta.race_distance_km as number,
    goal: (plan.meta.goal as string) ?? '?',
    weeks: total, buildQualityWeeks, firstVo2Week: firstVo2,
    taperStart, runwayNow, runwayDelayed,
  })
}

if (beginners.length === 0) { console.error('FAIL: no beginner plans reached.'); process.exit(1) }
console.log(`plans scanned: ${plans}   structural-beginner plans: ${beginners.length}`)

const MIN = GENERATION_CONFIG.VO2MAX_ONSET_MIN_ADAPTATION_WEEKS
console.log(`\n§5 requires VO2MAX_ONSET_MIN_ADAPTATION_WEEKS = ${MIN} weeks of runway.\n`)

const byGoal: Record<string, number> = {}
const byDist: Record<string, number> = {}
for (const b of beginners) {
  byGoal[b.goal] = (byGoal[b.goal] ?? 0) + 1
  byDist[String(b.dist)] = (byDist[String(b.dist)] ?? 0) + 1
}
console.log('goal split :', byGoal)
console.log('distance   :', byDist)

const withVo2 = beginners.filter(b => b.firstVo2Week != null)
console.log(`\nbeginner plans carrying any Z4–5 : ${withVo2.length} / ${beginners.length}`)
// ⚠️ Scoped to plans that ACTUALLY carry VO2max. Counting all 207 beginner
// plans buries the answer under the 141 that have no quality at all (§8's
// beginner ceiling is 0 when intensityFitness is also beginner), and would have
// reported "a delay drops VO2max in 207/207" — true of the denominator, and
// meaningless.
const oneQualityWeek = withVo2.filter(b => b.buildQualityWeeks <= 1).length
console.log(`\nof the ${withVo2.length} plans carrying VO2max, build phases with <= 1 quality week`)
console.log(`  (i.e. a one-slot delay would DROP VO2max from build entirely): ${oneQualityWeek} / ${withVo2.length}`)
const dist = withVo2.reduce((m, b) => { m[b.buildQualityWeeks] = (m[b.buildQualityWeeks] ?? 0) + 1; return m }, {} as Record<number, number>)
console.log('  build quality-week counts:', dist)

const survivesNow = withVo2.filter(b => (b.runwayNow ?? 0) >= MIN).length
const survivesDelayed = withVo2.filter(b => (b.runwayDelayed ?? 0) >= MIN).length
console.log(`\nadaptation runway ≥ ${MIN} weeks:`)
console.log(`  as shipped (VO2max opens build) : ${survivesNow} / ${withVo2.length}`)
console.log(`  after a ONE-WEEK delay          : ${survivesDelayed} / ${withVo2.length}`)
const meanNow = withVo2.reduce((s, b) => s + (b.runwayNow ?? 0), 0) / withVo2.length
console.log(`  mean runway now: ${meanNow.toFixed(1)} weeks → delayed: ${(meanNow - 1).toFixed(1)} weeks`)
