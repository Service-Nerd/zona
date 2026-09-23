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
export interface Finding {
  code: string
  detail: string
  /**
   * RUBRIC-GAPS-01(a) — a WATCHED quantity, not a coach objection.
   *
   * Some rules are deliberately exempted (§18 Am. silences `DAYS-SHORT` when
   * the plan declares the shortfall). An exemption with no counter is
   * indistinguishable from a goalpost that moved, so the exempted case is
   * still emitted — flagged — and every consumer that scores plans must
   * EXCLUDE it while every consumer that reports must SHOW it.
   */
  watched?: true
}

/** Findings a coach would object to. Excludes watched quantities. */
export const objectionsOnly = (f: readonly Finding[]): Finding[] => f.filter(x => !x.watched)

/** Exempted-but-counted quantities. A rising rate means an exemption is carrying more than it was measured carrying. */
export const watchedOnly = (f: readonly Finding[]): Finding[] => f.filter(x => x.watched)

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
    } else {
      // RUBRIC-GAPS-01(a) (2026-09-20) — COUNT THE SILENCE.
      //
      // The exemption above raises the fit-for-purpose rate by ~18.7pp. The
      // only thing separating that from moving the goalposts is knowing how
      // often it fires — and the metric meant to know, `daysShortSilent`, was
      // **declared in the rubric and never implemented.** It reported 0%
      // because nothing called it, which is the decorative-config defect in a
      // measurement.
      //
      // ⚠️ NOT an objection, on purpose: §18 Am. ruled the declared shortfall
      // coaching-correct. This is a WATCHED quantity — a rate that climbs means
      // the exemption is carrying more than it was measured carrying.
      f.push({ code: 'DAYS-SHORT-SILENCED', detail: `${shortWeeks.length} loading week(s) under ${declared} days, fewest ${worst} — declared by the frequency note`, watched: true })
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
  //
  // ⚠️ AND §117 PLANS ARE **WATCHED**, NOT SCORED (S117-PEAK-VS-TIME-01, 2026-09-20).
  //
  // SAME DEFECT AS THE ULTRA ONE ABOVE, ONE SHAPE LATER. 55% of race distance
  // is the bar for a plan built to RUN 42.2 km. A §117 finish-goal run-walk
  // plan is built to COMPLETE it, peaks at 34 km/wk by board ruling, and tops
  // out at an 18.5 km long run — so it can never clear 23.2 km and would score
  // unfit **on every single plan**, for doing exactly what the board ruled it
  // should do.
  //
  // ⚠️ THE BOARD RULED THE ADEQUACY EXPLICITLY, so this is not me moving a
  // goalpost to flatter a change I built. §9's Recorded structural finding,
  // McMillan, the position the founder took: *"a runner who does a 17 km
  // longest run and run-walks the last stretch finishes."* 18.5 > 17.
  //
  // ⚠️ AND IT IS **WATCHED**, NOT DELETED — deliberately, and unlike the ultra
  // carve-out above which simply stopped firing. The rate is counted and
  // printed beside the fit figure, so the exemption cannot quietly grow. Same
  // mechanism and the same reason as `DAYS-SHORT-SILENCED`: hiding a
  // relaxation is how an exemption becomes a moved goalpost.
  //
  // ⚠️ NO REPLACEMENT NUMBER IS INVENTED. The comment above warns that
  // "inventing a number here to keep a column populated is how a decorative
  // check is born", and 17 km is a quoted illustration in a ruling, not a
  // ratified bound. If §117 plans need their own adequacy bar, that is a board
  // question and it is filed, not answered here.
  if (input.race_distance_km >= 42 && input.race_distance_km <= 43) {
    // 🔴 THE EXEMPTION KEYS ON *IS THE RUNNER RUN-WALKING*, NOT ON *WAS THE PEAK
    // REDUCED* (Coaching Board 2026-09-23, declared CORRECTION).
    //
    // §117 Am.2 states the reason in its own words: **"55% of race distance is
    // the bar for a plan built to RUN the race."** A runner run-walking the
    // race is not running it, and how their PEAK was set has nothing to do with
    // which bar applies.
    //
    // ⚠️ THIS WAS CORRECT UNTIL §117 Am.4 AND I BROKE IT MYSELF, THE SAME DAY.
    // `finish_goal_run_walk` used to mean both things at once. Am.4 split them —
    // a §12 volume-capped runner now keeps their peak AND gets the interval —
    // and this line was left keyed on the peak half, so a runner who IS
    // run-walking was judged by the RUN bar.
    //
    // 🔴 DECLARED AS A CORRECTION, NEVER AN IMPROVEMENT (Hutchinson's binding
    // rule, ZERO-REJECTION-SERVED-01). Measured effect: **+0.73pp** on the
    // marathon — almost exactly the 0.7pp Am.4 had just cost. **No plan
    // changes. Not one runner trains differently.** `fitPctPreCorrection`
    // carries the old figure so the two can never be confused.
    const meta = plan.meta as unknown as { run_walk_prescribed?: boolean }
    const runWalk = !!meta.run_walk_prescribed
    const peakLR = Math.max(0, ...weeks.filter(w => w.type !== 'deload').flatMap(kmsIn))
    // ⚠️ AND IT IS BOUNDED HERE, NOT ONLY BY THE INVARIANT. §117 Am.2's whole
    // finding was *"the exemption was correct; its BOUND was missing — an
    // exemption without a bound is not a relaxation, it is a hole."*
    // `INV-PLAN-RUNWALK-ADEQUATE` guards `finish_goal_run_walk` plans; it does
    // not see a prescribed-but-not-reduced one, so the bound is applied here
    // too. Below 17 km the plan is SCORED, run-walk or not. Willy's condition.
    const adequate = peakLR >= G.FINISH_GOAL_RUNWALK_MIN_PEAK_LR_KM
    if (runWalk && adequate && peakLR < input.race_distance_km * 0.55)
      f.push({ code: 'LONG-RUN-SHORT-RUNWALK', watched: true, detail: `peak long run ${peakLR.toFixed(1)}km = ${(peakLR / input.race_distance_km * 100).toFixed(0)}% of race — run-walk shape, adequacy ruled by the board, NOT scored` })
    else if (peakLR < input.race_distance_km * 0.55)
      f.push({ code: 'LONG-RUN-SHORT', detail: `peak long run ${peakLR.toFixed(1)}km = ${(peakLR / input.race_distance_km * 100).toFixed(0)}% of race` })
  }

  // P8 — a plan whose volume never moves is not a plan, whatever it is called.
  const vols = weeks.filter(w => w.type !== 'deload').map(w => w.weekly_km ?? 0)
  if (vols.length > 4 && Math.max(...vols) - Math.min(...vols) < 2)
    f.push({ code: 'FLAT-CURVE', detail: `volume never moves (${Math.min(...vols)}-${Math.max(...vols)}km)` })

  return f
}
