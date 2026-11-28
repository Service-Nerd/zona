// FREE — infrastructure. ADR-027 B4g (ADR027-B4G-PEAK-STEPBACKS): L3's peak step-back passes.
//
// §47's step-back re-clamp and §80's delivered-volume step-back — the second post-pass group.
//
// 🔴 B4f SAID THIS PAIR COULD NOT MOVE, AND THAT WAS WRONG, WRITTEN THE SAME DAY.
// `longRunCaps.ts`'s header claimed `reclampPeakStepBacks` "reads the peak step-back SET that
// `buildRulePlanOnce` computes and threads through several other passes, so moving it means moving
// that state's owner too". 📐 It does not: `steppedBack` is a `ReadonlySet<number>` **parameter**, and
// `applyPeakStepBackVolume` takes only `(weeks, pace, input)`. Both were movable all along.
// ⚠️ **I asserted an obstacle instead of reading the signature** — the same class as the day's three
// miscounts, in the opposite direction: a claim that something is harder than it is costs a brick.
//
// ── ⚠️ THE ORDER MATTERS AND THE TWO ARE NOT ADJACENT ───────────────────────────────────────
// `reclampPeakStepBacks` runs at step 3 of the long-run sequence (between §45's two cap calls, which
// is why §45 is applied twice — see `longRunCaps.ts`). `applyPeakStepBackVolume` runs much later,
// after the volume passes. **Moving them together is a code-ownership change, not a sequencing one:**
// both call sites stay exactly where they were in `buildRulePlanOnce`.
//
// 🔻 `STEPBACK-STALE-PEAK-01` is why the re-clamp exists at all: §47 sets step-backs against the peak
// as it stood when they were chosen, and later passes move the peak — so the step-backs have to be
// re-measured against the FINAL peak or they are stale against the plan the runner receives.

import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
import { isLongRun, isShakeout } from '@/lib/plan/sessionRole'
import { sessionKmSelfPaced, dur } from '@/lib/plan/sessionDistance'
import { sessionFloorsFor } from '@/lib/plan/sessionFloors'
import { longRunSessionOf, computeLongRunHrs } from './longRunAccess'
import { sumWeeklyKm } from './deliveredVolume'
import type { PaceGuide } from '@/lib/plan/paceBands'
import type { GeneratorInput, Session, Week } from '@/types/plan'

/**
 * STEPBACK-STALE-PEAK-01 — re-clamp §47's step-backs against the FINAL peak.
 *
 * Runs after `applyLongRunProgressionCap`, which is the pass that can trim the
 * peak out from under the ratio. Keys strictly on the weeks §47 chose, so a
 * week that is merely below peak is untouched (§35, §24).
 *
 * Interim note retired: `peakLrStepbackMinutes.test.ts` had its tolerance
 * widened 1 -> 2 minutes to absorb this, with "fix the ordering instead"
 * written into it. This is that fix.
 */
export function reclampPeakStepBacks(
  weeks: Week[], pace: PaceGuide, input: GeneratorInput, steppedBack: ReadonlySet<number>,
): void {
  if (steppedBack.size === 0) return
  const peak = weeks.filter(w => w.n > 0 && w.phase === 'peak' && w.type !== 'deload' && w.type !== 'race')
  // ⚠️ ABSENT IS NOT ZERO (SESSION-KM-01). A peak week whose long run is
  // duration-anchored has no `distance_km` at all, and reading that as 0 would
  // drag the max down and under-bound every step-back on the plan. Each axis
  // takes only the weeks that actually speak it.
  const notSteppedBack = peak.filter(w => !steppedBack.has(w.n))
  const kmVals = notSteppedBack.map(w => longRunSessionOf(w)?.distance_km).filter((k): k is number => k != null)
  const minsVals = notSteppedBack.map(w => longRunSessionOf(w)?.duration_mins).filter((m): m is number => m != null)
  const peakKmFinal = kmVals.length ? Math.max(...kmVals) : 0
  const peakMinsFinal = minsVals.length ? Math.max(...minsVals) : 0
  const pct = GENERATION_CONFIG.PEAK_LR_STEPBACK_MAX_PCT / 100
  const precision = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
  const minLong = sessionFloorsFor(input.longest_recent_run_km).long
  const minRatio = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY
  for (const w of weeks) {
    if (!steppedBack.has(w.n)) continue
    const s = longRunSessionOf(w)
    if (!s) continue
    // §9 — the long run must stay the LONGEST run of its week. Lowering it
    // without this floor inverts the long-vs-easy ratio and
    // `INV-PLAN-LONG-IS-LONGEST` throws (measured: long 21 km against easy
    // 17 km, ratio 1.235 against a 1.25 minimum, 16 hard failures in the
    // cohort grid). The easy runs are not touched — they are sized by the
    // volume curve, and re-cutting them here would be a second owner for a
    // decision step 0 already made.
    // ⚠️ NULLS ARE DROPPED, NOT READ AS ZERO. `sessionDistanceReach.test.ts`
    // caught the first cut using `?? 0` here — the SESSION-KM-01 antipattern,
    // which asserts "this session covered no ground" and has produced four
    // measured defects. A session with no resolvable distance is unknown, and
    // an unknown must not lower a ratio floor.
    const easyKms = Object.values(w.sessions ?? {})
      .filter(x => x && x !== s && x.type !== 'rest' && x.type !== 'strength')
      .map(x => sessionKmSelfPaced(x as Session))
      .filter((k): k is number => k != null)
    const ratioFloorKm = easyKms.length ? Math.max(...easyKms) * minRatio : 0
    // Written on the axis the session already uses (§79/§80).
    if (s.distance_km != null) {
      if (peakKmFinal <= 0) continue
      const bound = Math.max(Math.floor((peakKmFinal * pct) / precision) * precision, minLong, ratioFloorKm)
      if (s.distance_km > bound) { s.distance_km = bound; s.duration_mins = dur(bound, pace.minPerKmEasy) }
    } else if (s.duration_mins != null) {
      if (peakMinsFinal <= 0) continue
      // S9-RATIO-MINUTES-01 — the ratio floor read on the axis the easy runs use.
      // Converting them to km (self-paced) and back (plan pace) rounded under the
      // ratio: measured 165 min against a 133-min easy run, 1.24. This only RAISES
      // the bound, so the long run is trimmed less and never grown.
      const easyMins = Object.values(w.sessions ?? {})
        .filter((x): x is Session => !!x && x.type === 'easy' && !isLongRun(x) && !isShakeout(x) && x.distance_km == null)
        .map(x => x.duration_mins)
        .filter((m): m is number => m != null)
      const ratioFloorMins = easyMins.length ? Math.ceil(Math.max(...easyMins) * minRatio) : 0
      const bound = Math.max(Math.round(peakMinsFinal * pct), Math.round(dur(minLong, pace.minPerKmEasy)),
        Math.round(dur(ratioFloorKm, pace.minPerKmEasy)), ratioFloorMins)
      if (s.duration_mins > bound) s.duration_mins = bound
    }
    w.weekly_km = sumWeeklyKm(w.sessions, pace)
    w.long_run_hrs = computeLongRunHrs(w.sessions, pace)
  }
}

// §47 Amendment 2 (Coaching Board 2026-09-16) — a peak step-back is a VOLUME
// step-back, not only an intensity one.
//
// `applyPeakLongRunAlternation` eases the step-back week's long run (pace + a
// distance cap) and stamps "absorb last week's peak", but the WEEK's total kept
// climbing on the volume curve — measured, 6,720 plans (22.5% of the grid)
// delivered a step-back week BIGGER than the week before it. §90's principle
// ("a week the runner is told is easier must DELIVER less") applied in peak.
//
// MUST RUN AFTER the §45 cap / §9 step-backs / taper cap, because those pass
// recompute `weekly_km` (a peak long run capped by §45 drops its whole week) —
// reading the neighbour's volume any earlier reads a number no runner sees.
// The step-back week is identified by the note `applyPeakLongRunAlternation`
// stamps (that IS the semantic marker), not re-derived — no producer/producer
// drift (DELOAD-OWNER-01). The long run is never touched (§52/§90 protect it);
// only easy volume is trimmed, toward PEAK_STEPBACK_WEEK_MAX_PCT of the
// preceding week, never below §52's long-run share or the min-easy floor.
export function applyPeakStepBackVolume(weeks: Week[], pace: PaceGuide, input: GeneratorInput): void {
  // Scoped to non-injury runners. An injury-history runner's delivered volume is
  // owned by §90/§2's injury reconciliation (the injury-yield pass), which runs
  // AFTER this one and reshapes the peak weeks — layering a second volume trim on
  // top would both race with it and double-govern the same weeks. Willy's concern
  // at the sitting was the HEALTHY build's unbroken climb; the injury cohort's
  // peak is already suppressed by the injury caps. (Measured: the only step-back
  // weeks that exceeded their neighbour were injury plans whose peak the yield
  // pass then lowered beneath this trim — the sweep, not cohortGrid, surfaced it.)
  if ((input.injury_history ?? []).length > 0) return
  const STEPBACK_NOTE = 'Step-back week. Easy aerobic'
  const minEasy = sessionFloorsFor(input.longest_recent_run_km).easy
  const precision = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
  const minEasyMins = dur(minEasy, pace.minPerKmEasy)
  const kmOf = (s: Session): number =>
    s.distance_km ?? (s.duration_mins != null ? s.duration_mins / pace.minPerKmEasy : 0)

  for (let idx = 0; idx < weeks.length; idx++) {
    const w = weeks[idx]
    if (w.phase !== 'peak' || w.type === 'deload') continue
    const lr = longRunSessionOf(w)
    if (!lr || !(lr.coach_notes ?? []).some(n => n?.includes(STEPBACK_NOTE))) continue

    const prevWeek = weeks[idx - 1]
    if (!prevWeek || prevWeek.type === 'deload' || prevWeek.weekly_km <= 0) continue

    const weekKm = sumWeeklyKm(w.sessions, pace)
    const target = prevWeek.weekly_km * (GENERATION_CONFIG.PEAK_STEPBACK_WEEK_MAX_PCT / 100)
    if (weekKm <= target) continue

    const lrKm = kmOf(lr)
    // §52: trimming easy raises the long-run share, so the week may not fall below
    // lrKm / LONG_RUN_MAX_PCT_OF_WEEKLY.
    const szFloor = lrKm / (GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY / 100)
    const easies = (Object.values(w.sessions) as (Session | undefined)[])
      .filter((s): s is Session => s != null && s.type === 'easy' && s.role !== 'long_run')
    const easyKm = easies.reduce((a, s) => a + kmOf(s), 0)
    const nonEasyKm = weekKm - easyKm
    const targetEasyKm = Math.max(0, Math.max(target, szFloor) - nonEasyKm)
    if (easyKm <= targetEasyKm || easyKm <= 0) continue

    const f = targetEasyKm / easyKm
    for (const s of easies) {
      if (s.distance_km != null) {
        s.distance_km = Math.max(minEasy, Math.floor((s.distance_km * f) / precision) * precision)
        s.duration_mins = dur(s.distance_km, pace.minPerKmEasy)
      } else if (s.duration_mins != null) {
        s.duration_mins = Math.max(minEasyMins, Math.round(s.duration_mins * f))
      }
    }
    w.weekly_km = sumWeeklyKm(w.sessions, pace)
    w.long_run_hrs = computeLongRunHrs(w.sessions, pace)
  }
}
