/**
 * PLAN QUALITY — the single owner of "would a coach object to this plan?".
 *
 * ⚠️ EXTRACTED FROM `scripts/audit-plan-quality.ts`, NOT COPIED (2026-09-19).
 * These predicates were private to that script. `USE-CASE-ENVELOPE-01` needed
 * the same definition of "good" to answer "are 90-95% of use cases fit for
 * purpose", and writing a second set of criteria would have meant two answers
 * to one question drifting apart -- the failure class this repo has already
 * paid for in the deload cadence (five copies), the tier ladder (three) and
 * the session-distance expression (twenty). The audit script now imports this.
 *
 * ⚠️ MOST PREDICATES ARE DISTANCE-AGNOSTIC AND ONE IS NOT. `LONG-RUN-SHORT`
 * only fires at >= 42 km, because the bar it applies (55% of race distance) is
 * a marathon bar: a 5K plan's long run is routinely 200-300% of race distance
 * and the same rule would be nonsense. When the 90-95% target was extended to
 * every distance, that asymmetry became visible -- a short-race plan cannot
 * fail the long-run check at all, so its fit-for-purpose rate is measured
 * against one fewer criterion than the marathon's. Stated, not hidden.
 */

import { sessionKmSelfPaced } from './sessionDistance'
import { effectiveStartKm } from './startVolume'
import { GENERATION_CONFIG as G } from './generationConfig'
import type { GeneratorInput, Plan, Week, Session } from '@/types/plan'

// ── The predicates. Each one is "a coach would object to this". ─────────────
export interface Finding { code: string; detail: string }

const isTrainingWeek = (w: Week) =>
  w.n > 0 && w.type !== 'race' && w.phase !== 'foundation'
const runsIn = (w: Week) =>
  Object.values(w.sessions ?? {}).filter(
    (s): s is Session => !!s && s.type !== 'rest' && s.type !== 'strength' && s.type !== 'cross-train')
const kmsIn = (w: Week) => runsIn(w).map(s => sessionKmSelfPaced(s) ?? 0)

/**
 * §2 Amendment 2 — how much bigger is each of week 1's runs than the runner's
 * current average run? The ratio arm screens; this confirms.
 *
 * A weekly total is not a training stress. 10 km/week becoming 14 km/week reads
 * as "+40%" and is three runs of about half an hour where there were three runs
 * of twenty-seven minutes. Measured across every ratio-flagged plan: worst
 * per-run increase +2.40 km, worst session beyond the runner's longest-ever run
 * +0.50 km.
 */
function week1PerRunStep(weeks: Week[], startKm: number, week1Km: number): number {
  const w1 = weeks.find(w => w.n === 1)
  const runs = w1 ? runsIn(w1).length : 0
  return runs > 0 ? (week1Km - startKm) / runs : Number.POSITIVE_INFINITY
}

export function auditPlanQuality(plan: Plan, input: GeneratorInput): Finding[] {
  const f: Finding[] = []
  const weeks = plan.weeks.filter(isTrainingWeek)
  if (!weeks.length) return [{ code: 'NO-WEEKS', detail: 'plan has no training weeks' }]
  const loading = weeks.filter(w => w.type !== 'deload' && (w.phase === 'build' || w.phase === 'peak'))

  // P2 — the runner asked for N days. Did any loading week deliver fewer?
  const declared = input.days_available ?? 0
  const shortWeeks = loading.filter(w => runsIn(w).length < declared)
  if (shortWeeks.length) {
    const worst = Math.min(...shortWeeks.map(w => runsIn(w).length))
    // §18 Amendment (FREQ-SILENCE-01, 2026-09-19) — A DECLARED SHORTFALL IS NOT
    // A COACH OBJECTION. THE SILENCE WAS.
    //
    // ⚠️ THIS RAISES THE FIT-FOR-PURPOSE RATE BY ~18.7pp AND THAT IS WORTH
    // SAYING OUT LOUD, because a predicate that relaxes when a note appears
    // looks exactly like moving the goalposts. It is legitimate here only
    // because the PRESCRIPTION WAS MEASURED CORRECT FIRST: `daysVolumeCanFill`
    // caps frequency at weeklyKm / MIN_KM_PER_TRAINING_DAY, it never fires
    // above 40 km/week and fires on 65% of runners under 20 — it is volume,
    // working as designed and documented. A coach would not object to three
    // real runs instead of six token ones. A coach WOULD object to doing it
    // without telling the runner, which is what the note now fixes.
    //
    // If the cap itself is ever wrong, this exemption hides it — so the cap has
    // its own reasoning recorded at `daysVolumeCanFill` and its own measured
    // profile in the commit that added this line.
    if (!plan.meta?.frequency_constraint_note) {
      f.push({ code: 'DAYS-SHORT', detail: `${shortWeeks.length} loading week(s) under ${declared} days, fewest ${worst}` })
    }
  }

  // P3 — a loading week with <=2 runs is not a week a coach would write.
  const degenerate = loading.filter(w => runsIn(w).length <= 2)
  if (degenerate.length) f.push({ code: 'DEGENERATE-WEEK', detail: `${degenerate.length} loading week(s) with <=2 runs` })

  // P4 — a single session carrying most of the week (§52's own 60% cap).
  let worstShare = 0
  for (const w of weeks) {
    if (w.type === 'deload') continue   // §52's invariant exempts these; match it
    const k = kmsIn(w); if (!k.length || !w.weekly_km) continue
    worstShare = Math.max(worstShare, Math.max(...k) / w.weekly_km)
  }
  const shPct = Math.round(worstShare * 100)
  if (worstShare > G.LONG_RUN_MAX_PCT_OF_WEEKLY / 100 + 0.005)
    f.push({ code: shPct >= 75 ? 'BINGE-SEVERE-75' : 'BINGE-WEEK', detail: `worst single session is ${shPct}% of its week` })

  // P5 — does the plan BUILD? peak loading week vs week 1.
  const w1 = weeks.find(w => w.n === 1)?.weekly_km ?? 0
  const peak = Math.max(...weeks.filter(w => w.type !== 'deload').map(w => w.weekly_km ?? 0))
  if (w1 > 0 && peak / w1 < 1.10) f.push({ code: 'NEVER-BUILDS', detail: `peak ${Math.round(peak)} vs week 1 ${Math.round(w1)} (${((peak / w1 - 1) * 100).toFixed(0)}%)` })

  // P7 — week 1 must not be a leap from what the runner actually does.
  // ⚠️ THE DENOMINATOR IS THE RUNNER'S DECLARED VOLUME, NOT `effectiveStartKm`
  // (Coaching Board 2026-09-20, WEEK1-FLOOR-SHORT-DIST-01).
  //
  // §111 Amendment 1 moved that gate ONTO `effectiveStartKm` and this moves
  // week 1 OFF it, which looks contradictory until you read the reason both
  // share: *"the gate scored a ratio no runner experienced."* For §111 the
  // experienced quantity is the volume the engine builds FROM. For week 1 it
  // is the step from the mileage the runner actually runs to the week they are
  // handed — and `effectiveStartKm` is an internal intermediate that the
  // week-1 floor OVERRIDES before the plan exists. The runner never sees it.
  //
  // ⚠️ MEASURED CONSEQUENCE OF GETTING THIS WRONG: 79% of everything the rule
  // flagged were §29 fresh-return runners — scaled down for their own
  // protection, then scored against the reduction. Beginners, who are not
  // scaled, were 0% unfit while intermediates were 48%. The inversion was the
  // tell. Against declared volume the median flagged ratio is 1.33x, not 1.79x.
  const declaredKm = input.current_weekly_km ?? 0
  const start = declaredKm > 0 ? declaredKm : effectiveStartKm(input)
  // WEEK1-LEAP-ABS-01 (2026-09-19) — A PERCENTAGE NEEDS AN ABSOLUTE FLOOR.
  //
  // ⚠️ MEASURED: 17% of everything this predicate flagged was a week-1 increase
  // of 2 km or less. The worst offenders read "start 4 km, week 1 = 5 km" —
  // one extra short run, scored as a 43% leap. A ratio on a small base is
  // noise, and this fired on 58% of runners under 20 km/week and 0% of runners
  // over 40, which is the signature of an artefact rather than a hazard.
  //
  // ⚠️ SAME CLASS AS `LONG-RUN-SHORT` ON ULTRAS, found the same day: a
  // proportional rule applied where the absolute magnitude makes it
  // meaningless. Two of the seven predicates had it.
  //
  // ⚠️ THE RESIDUAL IS REAL AND IS NOT BEING SUPPRESSED. After this floor,
  // 9.1% still flag, and their jumps run to 15 km (a runner at 7 km/week
  // effective handed an 18 km week 1). That is a live coaching question, filed
  // separately — this line removes the noise around it, it does not answer it.
  // §2 Amendment — TWO ARMS. Weekly ratio OR per-session load, whichever fires.
  //
  // ⚠️ THE SESSION ARM IS THE ONE WILLY ASKED FOR AND IT IS INERT TODAY.
  // Measured across all 3,880 flagged plans: the worst case of a week-1 session
  // exceeding the runner's longest recent run is **+0.5 km**, so this arm
  // currently fires on nothing. That is stated rather than hidden — an arm that
  // cannot fire on the present corpus is exactly the decorative check this repo
  // gates against, and it is kept only because it is the arm that describes the
  // actual HAZARD (tissue load per session) rather than an accounting ratio.
  // Its liveness is proved by mutation, not by the corpus.
  //
  // Margin reuses §45's long-run progression cap rather than inventing a
  // number: the same board already ratified that as the step a single run may
  // grow by, and a second constant for the same idea is how they drift.
  const longestW1 = Math.max(0, ...(weeks.find(w => w.n === 1)
    ? kmsIn(weeks.find(w => w.n === 1)!) : [0]))
  const longestEver = input.longest_recent_run_km ?? 0
  const sessionStepTooBig = longestEver > 0
    && longestW1 - longestEver > G.LONG_RUN_PROGRESSION_CAP_ABS_KM
  if (sessionStepTooBig) {
    f.push({ code: 'WEEK1-LEAP', detail: `week 1's longest session is ${longestW1.toFixed(1)}km against a longest-ever run of ${longestEver}km` })
  } else if (start > 0 && w1 - start >= G.WEEK1_ABSOLUTE_STEP_MAX_KM
             && w1 / start > G.WEEK1_ABSOLUTE_STEP_MIN_RATIO) {
    // Willy's binding condition: a large ABSOLUTE step stays visible even when
    // the ratio hides it. Measured at the sitting: the ratio arm alone caught
    // only 47 of 75 weekly jumps >= 10 km, because at 40 km/week a +10 km step
    // is just 1.25x. A condition the board made binding, verified by test.
    f.push({ code: 'WEEK1-LEAP', detail: `week 1 adds ${(w1 - start).toFixed(1)}km over a declared ${start}km base` })
  } else if (start > 0 && w1 / start > 1.30 && w1 - start > 2
             && week1PerRunStep(weeks, start, w1) > G.WEEK1_PER_RUN_STEP_MAX_KM)
    f.push({ code: 'WEEK1-LEAP', detail: `week 1 is ${Math.round(w1)}km against a ${start}km base (+${((w1 / start - 1) * 100).toFixed(0)}%)` })

  // P6 — a marathon plan whose longest run never approaches the race.
  //
  // ⚠️ SCOPED TO THE MARATHON BAND, NOT ">= 42" (ULTRA-LR-BAR-01, 2026-09-19).
  // The bar is 55% of race distance. At 100K that demands a **55 km TRAINING
  // LONG RUN**, which no coach prescribes and which §24e explicitly replaces
  // with back-to-back long runs. Measured: it fired on 46 of 48 sampled 100K
  // plans whose median long run was 36 km, and on 69% of 50K plans — a
  // criterion defect that made the ultra distances read 17.1% and 0.0%
  // fit-for-purpose when they are in fact the best-served distances we have.
  //
  // ⚠️ ULTRAS NOW HAVE NO LONG-RUN ADEQUACY CHECK AT ALL, and that is an
  // HONEST GAP rather than a fixed one. Picking the right bar for a 50K/100K
  // is a coaching judgement (§24e's back-to-back structure means a single
  // longest run is the wrong unit), and inventing a number here to keep a
  // column populated is how a decorative check is born. Filed as a board
  // question; recorded in the fit-for-purpose rubric's negative space.
  //
  // The reconciliation used to live in the CALLERS — `useCaseEnvelope.test.ts`
  // filtered this code out for `distanceKm > 42.2`. That put the knowledge in
  // the consumer instead of the owner, so `audit:plans` and the envelope
  // disagreed about what a defect was. Fixed here, once.
  if (input.race_distance_km >= 42 && input.race_distance_km <= 43) {
    const peakLR = Math.max(0, ...weeks.filter(w => w.type !== 'deload').flatMap(kmsIn))
    if (peakLR < input.race_distance_km * 0.55)
      f.push({ code: 'LONG-RUN-SHORT', detail: `peak long run ${peakLR.toFixed(1)}km = ${(peakLR / input.race_distance_km * 100).toFixed(0)}% of race` })
  }

  // P8 — a plan whose volume never moves is not a plan, whatever it is called.
  const vols = weeks.filter(w => w.type !== 'deload').map(w => w.weekly_km ?? 0)
  if (vols.length > 4 && Math.max(...vols) - Math.min(...vols) < 2)
    f.push({ code: 'FLAT-CURVE', detail: `volume never moves (${Math.min(...vols)}-${Math.max(...vols)}km)` })

  return f
}
