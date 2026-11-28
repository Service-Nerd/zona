// FREE — infrastructure. ADR-027 B4f (ADR027-B4F-LONGRUN-CAPS): L3's long-run cap passes.
//
// The four passes that decide how far the long run may go: §45's progression cap, §52's step-backs,
// §6 Am. 1's taper ceiling, and §47's ramped specificity floor. The first post-pass group to move,
// and the brick B4e existed to unblock.
//
// 🔑 THEY COULD NOT MOVE UNTIL THE ACCESSORS DID. ARCH-ENG-001 forbids L3 importing `ruleEngine.ts`,
// and every one of these called a long-run finder that was private to it — `applyLongRunProgressionCap`
// had its own `findLong`, `applyTaperLongRunCap` an inline `.find`. B4e made them one owner
// (`longRunAccess.ts`, eight implementations folded into one), and `dur` moved to `sessionDistance.ts`
// in the same wave. **This module imports only exported single owners; that is the whole precondition.**
//
// ── ⚠️ THE ORDER IS LOAD-BEARING AND ONE PASS RUNS TWICE ────────────────────────────────────
// `buildRulePlanOnce` calls them, in this order:
//    1. `applyLongRunStepBacks`          (§52 — the step-back weeks)
//    2. `applyLongRunProgressionCap`     (§45 — the week-on-week long-run ceiling)
//    3. `reclampPeakStepBacks`           (still in the old engine; §47's peak re-clamp)
//    4. `applyLongRunProgressionCap`     ← **AGAIN**, because step 3 can raise a long run back up
//    5. `applyTaperLongRunCap`           (§6 Am. 1 — no taper long run above the peak's)
// 🔻 The second call at step 4 is not redundant and is not a mistake: `reclampPeakStepBacks` re-reads
// the peak anchor and can lift a long run that step 2 had capped, so §45 has to be re-applied after
// it. **Moving the functions changes none of this** — the call sites stay where they are, and the
// order stays the old engine's until an orchestrator owns it. Recorded because a reader finding two
// calls to one pass will assume one of them is dead, and `S28-CAP-ORDER-01` is this repo's standing
// evidence that pass ordering is where its silent defects live.
//
// ⚠️ `reclampPeakStepBacks` DELIBERATELY STAYED BEHIND. It reads the peak-phase step-back SET that
// `buildRulePlanOnce` computes and threads through several other passes, so moving it means moving
// that state's owner too. Named here so its absence is a decision rather than an oversight.

import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
import { isLongRun } from '@/lib/plan/sessionRole'
// ⚠️ `sessionKm` is deliberately NOT imported: the comment at the §45 site warns against using
// that converter here, and importing it unused invited exactly that. Found by code review.
import { sessionKmOrZero, sessionKmSelfPaced, roundDistance, dur } from '@/lib/plan/sessionDistance'
import { longRunOf, longRunSessionOf, computeLongRunHrs } from './longRunAccess'
import { sumWeeklyKm } from './deliveredVolume'
import type { Day } from '@/lib/plan/days'
import type { PaceGuide } from '@/lib/plan/paceBands'
import type { Phase, Session, Week } from '@/types/plan'
import type { GeneratorPhase as PhaseType } from '@/types/plan'
import type { SessionFloors } from '@/lib/plan/sessionFloors'

/**
 * §6 Amendment 1 — cap each taper week's long run at the peak phase's long run.
 *
 * Reduces DISTANCE and re-derives duration through the same easy pace the week
 * was sized with, then restates `weekly_km` from the sessions (§90's "the runner
 * sees sumWeeklyKm, not the curve").
 *
 * ⚠️ NEVER reduces below the point where the long run stops being the longest
 * run of the week. §9's ratio (`LONG_RUN_MIN_RATIO_VS_EASY`) still binds, and a
 * cap that satisfied §6 by breaking §9 would be trading one inversion for
 * another. Where both cannot hold, §9 wins and the residual is left — the same
 * honest-residual pattern §34 sets.
 */
export function applyTaperLongRunCap(weeks: Week[], pace: PaceGuide): void {
  const peakLr = Math.max(0, ...weeks
    .filter(w => w.n > 0 && w.phase === 'peak' && w.type !== 'deload' && w.type !== 'race')
    .map(w => {
      const s = longRunSessionOf(w)
      return s ? sessionKmOrZero(s, pace.minPerKmEasy) : 0
    }))
  if (peakLr <= 0) return

  const tol = GENERATION_CONFIG.TAPER_LR_VS_PEAK_TOLERANCE_KM
  const ratio = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY

  for (const w of weeks) {
    if (w.n <= 0 || w.phase !== 'taper' || w.type === 'race') continue
    const entry = longRunOf(w)
    if (!entry) continue
    const { day, session: long } = entry
    // 🔴 THIS USED TO READ `if (long.distance_km == null) continue`, SO THE CAP
    // NEVER RAN ON A DURATION-ANCHORED PLAN — and beginners are 95.8%
    // duration-anchored (SESSION-KM-01). Measured on a real stored plan: its
    // peak long runs carried `distance_km: 14.5` and its TAPER long runs carried
    // `distance_km: null, duration_mins: 126`, so §6 Amendment 1's cap bailed out
    // and the taper shipped 15.5 km against a 14.5 km peak.
    //
    // Third-plus occurrence of the `LR-CAP-BLIND-01` class: a ratified rule made
    // inert for one cohort by a `distance_km`-shaped hole. `sessionKmSelfPaced`
    // is the single owner of "how far is this session" and answers for both
    // anchors (Coaching Board LR-TAPER-BUMP-01, 2026-10-09).
    const longKm = sessionKmOrZero(long, pace.minPerKmEasy)
    if (!(longKm > 0)) continue
    if (longKm <= peakLr + tol) continue

    // §9's floor: the long run must stay at least `ratio` times the longest
    // other run in the week, or capping §6's inversion creates §9's.
    const longestOther = Math.max(0, ...(Object.entries(w.sessions) as [Day, Session | undefined][])
      .filter(([d, sn]) => d !== day && !!sn && sn.type !== 'rest' && sn.type !== 'strength')
      .map(([, sn]) => sessionKmOrZero(sn!, pace.minPerKmEasy)))
    const floorFromRatio = longestOther * ratio
    const capped = Math.max(peakLr, floorFromRatio)
    if (capped >= longKm) continue

    const rounded = roundDistance(capped)
    // ⚠️ WRITE BACK TO THE ANCHOR THE SESSION ACTUALLY USES — the same
    // correction V4 carries, and for the same stated reason: "setting
    // `distance_km` on a duration-anchored session would flip a beginner's card
    // from minutes to kilometres and break §79/§80's metric contract". The old
    // write set `distance_km` unconditionally, which was unreachable for a
    // duration-anchored plan (the guard above bailed first) and would have
    // converted the anchor the moment that guard was fixed.
    w.sessions[day] = {
      ...long,
      ...(long.distance_km != null ? { distance_km: rounded } : {}),
      duration_mins: dur(rounded, pace.minPerKmEasy),
    }
    w.weekly_km = sumWeeklyKm(w.sessions, pace)
  }
}

// CoachingPrinciples §45 — long-run progression cap. Universal (all phases).
// Walks the plan after the per-week build and clamps any LR that jumps more
// than +20% / +5km from the prior week's LR. Step-back from a deload week is
// permitted up to the pre-deload distance (with §45 tolerance).
// CoachingPrinciples §9 (CD-9) — every Nth BUILD long run steps back so a runner
// isn't repeating the same long run for weeks. Build phase only: peak long runs
// are the culmination (and carry the §80 finish-goal floor), deloads already
// step the whole week back. Metric-agnostic (distance or duration).
export function applyLongRunStepBacks(weeks: Week[], pace: PaceGuide, minLongKm: number): void {
  const buildLRs: Array<{ session: Session; wIdx: number }> = []
  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i].phase !== 'build' || weeks[i].type === 'deload') continue
    const lr = longRunSessionOf(weeks[i])
    if (lr) buildLRs.push({ session: lr, wIdx: i })
  }
  const cadence   = GENERATION_CONFIG.LONG_RUN_STEPBACK_CADENCE_N
  const factor    = 1 - GENERATION_CONFIG.LONG_RUN_STEPBACK_PCT / 100
  const precision = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
  // CB-SUBFLOOR-ADMIT-01 — resolved FOR THIS RUNNER. Was the flat
  // GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long, which re-floored the long
  // run straight back up to 5 km after the cap above had just bounded it.
  const minLong   = minLongKm
  const ratio = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY
  for (let k = 0; k < buildLRs.length; k++) {
    if ((k + 1) % cadence !== 0) continue  // every Nth: 3rd, 6th, …
    const s = buildLRs[k].session
    const w = weeks[buildLRs[k].wIdx]
    // §9 — the long run must stay the longest run of the week (≥1.25× easy).
    // Floor the step-back at that ratio; if there's no room to step back without
    // inverting the ratio, skip this week rather than violate.
    const maxEasy = Math.max(0, ...Object.values(w.sessions)
      .filter((x): x is Session => !!x && x.type === 'easy' && !isLongRun(x))
      .map(x => x.distance_km ?? x.duration_mins ?? 0))
    if (s.distance_km != null) {
      const floorKm  = maxEasy * ratio
      const steppedKm = Math.round((s.distance_km * factor) / precision) * precision
      if (steppedKm <= floorKm || steppedKm < minLong) continue
      s.distance_km   = steppedKm
      s.duration_mins = dur(s.distance_km, pace.minPerKmEasy)
    } else if (s.duration_mins != null) {
      const floorMins   = maxEasy * ratio  // easy measured in duration for these plans
      const steppedMins = Math.round(s.duration_mins * factor)
      if (steppedMins <= floorMins) continue
      s.duration_mins = steppedMins
    }
    w.weekly_km    = sumWeeklyKm(w.sessions, pace)
    w.long_run_hrs = computeLongRunHrs(w.sessions, pace)
  }
}

/**
 * §24 / §80 Amendment (PLAN-FITNESS-01, Coaching Board 2026-09-17) — THE
 * SPECIFICITY FLOOR RAMPS THROUGH BUILD INSTEAD OF STEPPING AT PEAK.
 *
 * Both floors were gated on `phase === 'peak'`. The floor itself was right —
 * §80 asks a finish-goal marathoner for 42.2 x 0.70 = 29.5 km — but it was only
 * REQUESTED in peak, and §45's +5 km/week cannot climb from §9's share (~11 km)
 * to 29.5 km in the two or three peak weeks that remain. Measured: M1, a first
 * marathon with a 24-WEEK RUNWAY, no injury and no time cap, peaked at 21 km —
 * 50% of race distance against a 30-32 km norm.
 *
 * ⚠️ THE LONG RUN WAS NEVER HELD DOWN BY §52 OR §9, which is where two earlier
 * diagnoses went wrong. It tracked §9's share for 14 of 19 weeks because nothing
 * asked it to do otherwise; §52's 60% ceiling was never within reach. The defect
 * is a floor arriving too late to be climbed to, not a cap holding it down.
 *
 * §45's progression cap still runs afterwards, so this changes WHEN the climb
 * starts, never how fast it is allowed to go.
 */
export function rampedSpecificityFloor(
  peakFloorKm: number, phase: PhaseType, weekN: number, phases: Phase[],
): number {
  if (phase === 'peak') return peakFloorKm
  if (phase !== 'build') return 0
  const build = phases.find(p => p.name === 'build')
  if (!build) return 0
  const span = Math.max(1, build.end_week - build.start_week + 1)
  const pos  = Math.min(1, Math.max(0, (weekN - build.start_week + 1) / span))
  const start = GENERATION_CONFIG.SPECIFICITY_RAMP_START_PCT / 100
  return peakFloorKm * (start + (1 - start) * pos)
}

/**
 * ⚠️ `minLongKm` is a PARAMETER, not a config read, since CB-SUBFLOOR-ADMIT-01.
 * It used to read `GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long` directly —
 * the THIRD producer site on the flat floor — so it capped the week-on-week
 * progression correctly and then floored the result straight back up to 5 km,
 * re-creating the jump it had just removed. Measured: W2 2.9 km -> W3 4.97 km,
 * a 71% step, which `INV-PLAN-LR-PROGRESSION-CAP` caught the moment the flat
 * floor stopped masking it everywhere else.
 */
export function applyLongRunProgressionCap(weeks: Week[], pace: PaceGuide, floors: SessionFloors): void {
  const capPct = GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_PCT / 100
  const capAbs = GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_ABS_KM
  const stepBackTol = 1 + GENERATION_CONFIG.LONG_RUN_DELOAD_STEP_BACK_TOLERANCE_PCT / 100
  const precision = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
  // CB-SUBFLOOR-ADMIT-01 — resolved FOR THIS RUNNER. Was the flat
  // GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long, which re-floored the long
  // run straight back up to 5 km after the cap above had just bounded it.
  const minLong = floors.long


  for (let i = 1; i < weeks.length; i++) {
    const prev = weeks[i - 1]
    const curr = weeks[i]
    if (curr.type === 'race') continue

    const prevLR = longRunOf(prev)
    const currLR = longRunOf(curr)
    if (!prevLR || !currLR) continue

    // ⚠️ THIS USED TO BAIL OUT ON `distance_km == null`, WHICH MEANT §45 WAS
    // NEVER APPLIED TO A BEGINNER OR AN ULTRA (LR-CAP-BLIND-01, Coaching Board
    // 2026-09-16). A session is anchored EITHER by distance OR by duration, and
    // §79/§80 give duration to beginners AND to every race >= 50km — so the two
    // cohorts with the least margin for a long-run spike were the two the cap
    // silently skipped. `INV-PLAN-LR-PROGRESSION-CAP` carried the identical
    // bail-out, so nothing caught the omission either: one bug, two copies, and
    // the checker could not catch the producer because it shared the defect.
    //
    // Measured: 2,271 breaches across 1,568 plans (9.8% of the sweep). Worst
    // seen is a 14-week first marathon whose long run went 8.5km -> 26.0km,
    // +206%, to 2.9x the runner's lifetime longest — worse than the +185%
    // incident §45 was written to prevent.
    //
    // ⚠️ `sessionKmSelfPaced`, NOT `sessionKm(s, pace.minPerKmEasy)` — AND THE
    // FIRST CUT OF THIS FIX GOT IT WRONG, which parity caught.
    //
    // The two converters disagree for a duration-anchored session:
    // `sessionKmSelfPaced` uses the session's OWN pace band, `sessionKm` a
    // plan-level easy pace. Using one here and the other in
    // `INV-PLAN-LR-PROGRESSION-CAP` made producer and checker disagree about how
    // long the long run IS, so §45's deload-bounceback exemption fired on one
    // side and not the other and the checker failed plans the producer had
    // deliberately allowed. That is the producer/consumer split this file has
    // paid for repeatedly (D-16, TIER-OWNER-01, §47's positions-vs-pairs) —
    // reintroduced while fixing a different instance of it.
    //
    // The checker has no PaceGuide and therefore MUST use the self-paced
    // reading, so the producer uses it too. Agreement by construction.
    const prevKmOf = sessionKmSelfPaced(prevLR.session)
    const currKmOf = sessionKmSelfPaced(currLR.session)
    if (prevKmOf == null || currKmOf == null || prevKmOf <= 0 || currKmOf <= 0) continue

    // BOUNCEBACK EXEMPTION — from a deload OR from a long-run step-back.
    //
    // Returning to a distance the runner covered two weeks ago is not a spike:
    // chronic load has not moved. §45's tolerance already said this for deloads;
    // it did not know about `applyLongRunStepBacks`, which deliberately cuts
    // every Nth BUILD long run in a non-deload week.
    //
    // Without this, capping after the step-backs run would clamp every
    // bounceback and ratchet the long run permanently down — the same fatal
    // arithmetic D-21 records for volume deloads, where "the first organic
    // user's 14-week plan peaked in week 3".
    //
    // Detected STRUCTURALLY (prev long run shorter than the one before it)
    // rather than by re-deriving the step-back cadence, so the two cannot drift.
    const prevPrevLR = i >= 2 ? longRunOf(weeks[i - 2]) : null
    const prevPrevKm = prevPrevLR ? sessionKmSelfPaced(prevPrevLR.session) : null
    const prevWasStepBack = prevPrevKm != null
      && prev.type !== 'race'
      && prevKmOf < prevPrevKm - 0.01
    if (prev.type === 'deload' || prevWasStepBack) {
      if (prevPrevKm != null && currKmOf <= prevPrevKm * stepBackTol + 0.01) continue
    }

    // §45 Amendment 2 — the ABSOLUTE arm tapers on a small week. §9 already
    // sizes the long run as a share of weekly volume; this was the one part of
    // long-run prescription that ignored the week entirely, so +5km was a
    // sensible step on a 30km long run (+17%) and a different training stimulus
    // arriving in one week on a 6km one (+83%). Basis is the PRIOR week's
    // delivered volume — non-circular, since the current week's volume is partly
    // determined by the long run being capped.
    //
    // ⚠️ BASIS IS THE PRIOR LONG RUN, NOT THE PRIOR WEEK, AND THAT IS NOT A
    // WEAKENING — it is arithmetically the same rule on a stable input. §9 sizes
    // the build-phase long run at 30% of the week, so "15% of the week" IS "50%
    // of the long run". The week is NOT stable here: §45 runs mid-pipeline and
    // the long run is re-anchored (duration -> distance) afterwards, so
    // `prev.weekly_km` differs between the producer and the checker and the two
    // disagreed on 140 plans when this shipped on a weekly basis. `prevKmOf` is
    // the exact value the % arm already reads, so producer and checker cannot
    // drift — which is the whole lesson of LR-CAP-BLIND-01 (one bug, two
    // copies, checker blind because it shared the defect).
    const absArmKm = Math.min(
      capAbs,
      prevKmOf * GENERATION_CONFIG.LONG_RUN_ABS_STEP_MAX_PCT_OF_LR / 100,
    )
    const allowedJumpKm = Math.max(prevKmOf * capPct, absArmKm)
    const maxAllowedKm = prevKmOf + allowedJumpKm
    if (currKmOf - 0.01 > maxAllowedKm) {
      const newKm = Math.max(Math.floor(maxAllowedKm / precision) * precision, minLong)
      // WRITE BACK TO THE ANCHOR THE SESSION ACTUALLY USES. Setting
      // `distance_km` on a duration-anchored session would flip a beginner's
      // card from minutes to kilometres and break §79/§80's metric contract —
      // fixing a load bug by silently changing what the runner is shown.
      if (currLR.session.distance_km != null) {
        currLR.session.distance_km = newKm
        currLR.session.duration_mins = dur(newKm, pace.minPerKmEasy)
      } else {
        // SCALE THE DURATION BY THE KM RATIO rather than converting km -> minutes
        // with some pace. Distance and duration are proportional at a fixed
        // pace, so the ratio lands exactly on `newKm` under the SAME converter
        // the checker will use — no second pace is introduced, so none can drift.
        const mins = currLR.session.duration_mins
        if (mins != null && mins > 0) {
          currLR.session.duration_mins = Math.round(mins * (newKm / currKmOf))
        }
      }

      // CoachingPrinciples §9 — clamp easy runs so long-vs-easy ratio survives.
      const minRatio = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY
      const minEasy = floors.easy
      const easyCeiling = newKm / minRatio
      const easyCeilingFloored = Math.floor(easyCeiling / precision) * precision
      // S9-RATIO-MINUTES-01 (§9 Amendment 2) — a duration-anchored easy run is
      // clamped in MINUTES from the capped long run's minutes. This loop used to
      // `continue` past every one of them, so the cap shortened a beginner's long
      // run after a deload and left the easy runs beside it untouched: measured
      // 157 min against two 156-min "easy" runs, 116 of 2,874 cohort plans. The
      // §47 step-back pass already did this (its "fourth gate" note); this is the
      // twin. Floored, so the ratio holds after rounding, and never below the
      // runner's easy floor. The minutes removed are not moved anywhere: the long
      // run may not grow past §45 to absorb them (Willy, binding).
      // The long run's minutes, whatever its anchor: a km long run beside minutes
      // easy runs is common, and both branches above wrote `duration_mins`.
      const lrMins = currLR.session.duration_mins
      const easyCeilingMins = lrMins != null ? Math.floor(lrMins / minRatio) : null
      const minEasyMins = dur(minEasy, pace.minPerKmEasy)
      for (const [d, s] of Object.entries(curr.sessions) as [Day, Session | undefined][]) {
        if (!s) continue
        if (d === currLR.day) continue
        if (s.type !== 'easy') continue
        if (s.distance_km == null) {
          if (easyCeilingMins != null && s.duration_mins != null && s.duration_mins > easyCeilingMins) {
            // A clamp only shortens: the easy floor can hold the run, never lengthen it.
            s.duration_mins = Math.min(s.duration_mins, Math.max(easyCeilingMins, minEasyMins))
          }
          continue
        }
        if (s.distance_km > easyCeilingFloored) {
          // The km twin of the minutes guard above: a clamp only shortens.
          const newEasy = Math.min(s.distance_km, Math.max(easyCeilingFloored, minEasy))
          s.distance_km = newEasy
          s.duration_mins = dur(newEasy, pace.minPerKmEasy)
        }
      }

      curr.weekly_km = sumWeeklyKm(curr.sessions, pace)
      curr.long_run_hrs = computeLongRunHrs(curr.sessions, pace)
    }
  }
}
