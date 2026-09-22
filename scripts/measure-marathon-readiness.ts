/**
 * MARATHON-READINESS-GAP-01 — measurement for the Coaching Board.
 *
 * The filed concern, in Seiler's and McMillan's words: "a beginner whose
 * largest training week is 25 km is being sent to race 42.2 km." The existing
 * fitness harness measures the LONG RUN as a share of race distance; it does
 * not measure the one the board actually asked about, which is the PEAK WEEK
 * against the race.
 *
 * ⚠️ A race is a single effort. A peak week below the race distance means the
 * runner has never, in one week of training, covered the ground they will
 * cover in one morning.
 */
import { cohortGrid, targetedGrid, COHORT_PLAN_START } from '@/lib/plan/cohortGrid'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { sessionKmSelfPaced } from '@/lib/plan/sessionDistance'
import { isLongRun } from '@/lib/plan/sessionRole'
import type { GeneratorInput, Plan, Week } from '@/types/plan'

const km = (s: unknown) => sessionKmSelfPaced(s as never) ?? 0
const weekKm = (w: Week) => Object.values(w.sessions).reduce((a, s) => a + km(s), 0)
const longOf = (w: Week) => km(Object.values(w.sessions).find(s => s && isLongRun(s)))

/**
 * ⚠️ THE RACE DISTANCE IS PER-INPUT, NOT A CONSTANT — and the first version of
 * this script got that wrong. It filtered `race_distance_km > 40`, which
 * includes ULTRAS, then subtracted a hardcoded 42.195 from every race week and
 * divided every long run by it. That reported a median of 13 km of race-week
 * shakeouts and a max of 17 km, when a real marathon race week is
 * `42.2 + 4 + 3` — SEVEN km of shakeouts, exactly as §121's `weekly_km` field
 * already says. It would have "reproduced" a defect that does not exist.
 *
 * This repo's recorded class: the denominator is where a claim fails.
 */
const MARATHON = 42.195

function pct(n: number, d: number) { return d ? +(100 * n / d).toFixed(1) : 0 }

const rows: { level: string; race: number; peakWk: number; peakLr: number; lrPct: number; ratio: number; weeks: number }[] = []
let refused = 0
const raceWeeks: number[] = []

const inputs: GeneratorInput[] = [...cohortGrid(), ...targetedGrid()]
  .filter(i => (i.race_distance_km ?? 0) > 40)

for (const input of inputs) {
  let plan: Plan
  // ⚠️ THE FIRST VERSION OF THIS SCRIPT GENERATED 0 PLANS AND REFUSED 12,416,
  // then printed a clean 0% table. That is this repo's recorded "measurement
  // scripts are checks too" class — four grids in one day printed clean tables
  // from plans that never generated. The signature is the one the working
  // harness uses: tier, plan start, and the reference date BOTH passed.
  try { plan = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START) as Plan }
  catch (e) { refused++; if (refused <= 3) console.error('refused:', (e as Error).message); continue }
  if (!plan?.weeks?.length) { refused++; continue }
  const peakWk = Math.max(...plan.weeks.map(weekKm))
  const peakLr = Math.max(...plan.weeks.map(longOf))
  const race = input.race_distance_km ?? MARATHON
  const rw = plan.weeks.find(w => w.type === 'race')
  if (rw) raceWeeks.push(weekKm(rw) - race)
  rows.push({
    level: String((input as any).fitness_level ?? '?'),
    race,
    peakWk: +peakWk.toFixed(1),
    peakLr: +peakLr.toFixed(1),
    lrPct: +(100 * peakLr / race).toFixed(1),
    ratio: +(peakWk / race).toFixed(2),
    weeks: plan.weeks.length,
  })
}

console.log(`marathon plans generated: ${rows.length}  refused: ${refused}`)
const below = rows.filter(r => r.peakWk < r.race)
console.log(`\n🔴 PEAK WEEK BELOW THE RACE DISTANCE: ${below.length} / ${rows.length} (${pct(below.length, rows.length)}%)`)

for (const lvl of Array.from(new Set(rows.map(r => r.level))).sort()) {
  const g = rows.filter(r => r.level === lvl)
  const b = g.filter(r => r.peakWk < MARATHON)
  const sorted = [...g].map(r => r.peakWk).sort((a, x) => a - x)
  const med = sorted[Math.floor(sorted.length / 2)]
  console.log(
    `  ${lvl.padEnd(14)} n=${String(g.length).padStart(5)}  below race=${String(pct(b.length, g.length)).padStart(5)}%` +
    `  median peak week=${med?.toFixed(1)}km  min=${sorted[0]?.toFixed(1)}km`,
  )
}

// ── THE PREMISE WAS WRONG, AND THE REAL TAIL IS THE LONG RUN ───────────────
// The filed concern named the peak WEEK. Measured, that is 0 of n. What the
// worst cases actually show is a peak LONG RUN of 18.5 km against a 42.195 km
// race — 44%, where the fitness harness's own median sits at ~62%. A median
// cannot show a tail, which is why this is measured as a distribution.
console.log('\n── PEAK LONG RUN as a share of race distance ──')
for (const floor of [0.70, 0.65, 0.60, 0.55, 0.50, 0.45]) {
  const n = rows.filter(r => r.lrPct < floor * 100).length
  console.log(`  below ${(floor * 100).toFixed(0)}% of THEIR OWN race: ${String(n).padStart(6)} / ${rows.length}  (${pct(n, rows.length)}%)`)
}
for (const lvl of Array.from(new Set(rows.map(r => r.level))).sort()) {
  const g = rows.filter(r => r.level === lvl)
  const lrs = g.map(r => r.lrPct).sort((a, b) => a - b)
  const p = (q: number) => lrs[Math.floor(q * (lrs.length - 1))]
  console.log(
    `  ${lvl.padEnd(14)} long run as %% of ITS OWN race — min=${p(0)?.toFixed(1)}%%  p5=${p(0.05)?.toFixed(1)}%%` +
    `  median=${p(0.5)?.toFixed(1)}%%  max=${p(1)?.toFixed(1)}%%`,
  )
}

// ── RACE-WEEK-SHAKEOUT-VOLUME-01, reproduced or refuted ────────────────────
// McMillan flagged a 59 km race week against a 42.2 km race — 16.8 km of
// shakeouts, which no coach would prescribe against §30's cap. The filing says
// in terms: "this may be an artefact of the sweep's inputs rather than real.
// Reproduce against a single named input before treating it as a defect."
console.log('\n── RACE WEEK: everything that is NOT the race ──')
{
  const shakeouts = raceWeeks.map(v => +v.toFixed(1)).sort((a, b) => b - a)
  const over = (t: number) => shakeouts.filter(v => v > t).length
  console.log(`  n=${shakeouts.length}  max non-race volume=${shakeouts[0]}km  median=${shakeouts[Math.floor(shakeouts.length / 2)]}km`)
  for (const t of [16.8, 12, 10, 8, 6]) {
    console.log(`  above ${String(t).padStart(5)}km: ${String(over(t)).padStart(6)} / ${shakeouts.length}  (${pct(over(t), shakeouts.length)}%)`)
  }
}

// The worst cases, which is what a board rules on.
const worst = [...rows].sort((a, b) => a.peakWk - b.peakWk).slice(0, 8)
console.log('\nworst 8 (peak week, long run, ratio to race, plan weeks, level):')
for (const w of worst) console.log(`  race ${String(w.race).padStart(5)}km  peak week ${String(w.peakWk).padStart(6)}km  LR ${String(w.peakLr).padStart(5)}km (${w.lrPct}%)  ${w.weeks}wk  ${w.level}`)
