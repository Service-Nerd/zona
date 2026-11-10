// ENGINE-04 — taper recalibration
// FREE — deterministic coaching infrastructure (no AI calls)
//
// Principle (CoachingPrinciples §68): a taper is a reduction from what the
// body is adapted to, not from what was planned. If the runner completed
// materially less than their intended peak volume, the written taper targets
// are anchored to a fiction. This module re-anchors all taper week volumes
// to the runner's functional peak — the average of their top actual weeks.
//
// Fires once, at the transition into the taper phase. Recalibrates volumes
// only — session types, quality session counts, and race week structure are
// unchanged. Downward adjustment only: overperformance is handled by the
// benchmark recalibration path.
//
// ADR-009 governs config placement. All thresholds live in generationConfig.ts.

import type { Plan, Week, Session, Phase } from '@/types/plan'
import { GENERATION_CONFIG, raceDistanceKey } from '@/lib/plan/generationConfig'
import { isLongRun, isHardEffort } from '@/lib/plan/sessionRole'
import { sessionFloorsFor, type SessionFloors } from '@/lib/plan/sessionFloors'
import { sessionKmSelfPaced } from '@/lib/plan/sessionDistance'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TaperRecalibrationInput {
  /** Actual km logged per plan week_n for build + peak weeks. */
  weeklyActuals: Map<number, number>
  plan: Plan
  /** Current week number (1-indexed). Must be the first taper week to fire. */
  currentWeekN: number
}

export interface TaperRecalibrationResult {
  applied: boolean
  skipReason?: string
  functionalPeakKm?: number
  plannedPreTaperKm?: number
  /** Ratio: functionalPeak / plannedPreTaper (0–1 when below threshold). */
  ratio?: number
  /** Fully recalibrated plan — only set when applied = true. */
  plan?: Plan
  weeksModified?: number[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * TAPER-FLOOR-FLAT-01 (Coaching Board 2026-09-19) — the taper reads the SAME
 * runner-resolved floors as the rest of the engine.
 *
 * These were three reads of the flat `MIN_SESSION_DISTANCE_KM`, the last
 * producer site still on it after §113 Amendment 1 moved everything else to
 * `sessionFloorsFor`. ⚠️ **The item was filed claiming it "cannot bind" and
 * then that it binds only at 5K. Measured across 6,738 taper weeks it pins a
 * session at the flat easy floor on 38.8% of them** — so the filed severity was
 * wrong in both directions and the fix is the ordinary one: one owner for
 * "how short may this runner's sessions be".
 *
 * A plan with no recorded `generator_input` (legacy rows) resolves to the
 * configured floors unchanged, which is exactly what `sessionFloorsFor` returns
 * for a missing longest run — "we do not know" must not read as "this runner
 * can only manage 2 km".
 */
/**
 * 🔴 TAPER-DURATION-ANCHOR-01 (2026-11-10) — THIS SCALED NOTHING FOR A BEGINNER, AND SAID IT HAD.
 *
 * It opened `if (!session.distance_km) return session`. **86.8% of a beginner's long runs and
 * the bulk of their other sessions are duration-anchored** (`SESSION-KM-01`), so the whole
 * recalibration was inert for them. Measured by simulating a 40% build under-run over 1,370
 * generated plans: **457 of 457 beginner plans returned `applied: true` and changed not one
 * session, against 0 of 913 for intermediate and experienced.**
 *
 * 🔴 AND INERT WAS THE KINDER HALF. The caller still sets `weekly_km: newWeeklyKm`, so the
 * taper week's TOTAL fell while every session stayed put: the runner saw a smaller weekly
 * number against the same runs. Measured after recalibration, |session sum − `weekly_km`|:
 * **beginner median 11.71 km (p90 16.17, max 22.76) against 4.00–4.50 for the other two.**
 * Some divergence is inherent to the 0.5 km rounding and the floors; **the beginner excess is
 * this defect.** ADR-022's curve-versus-delivered class, created here.
 *
 * ⚠️ Worse still, `computeTaperRecalibration` stamps `taper_recalibrated_at`, the route SAVES
 * that plan, and every later call short-circuits on the stamp — so **a beginner's one-shot
 * taper recalibration was consumed by a run that did nothing.**
 *
 * 🔑 ONE FLOOR, IN KM, APPLIED AS A UNIT-FREE RATIO. `sessionKmSelfPaced` is the owner of "how
 * far is this session" and prices a duration-anchored session through its own pace (and its
 * structured steps, `SESSION-KM-STRUCTURED-PACE-01`). It is **not inverted here** — that
 * mapping is one-way — so the floor is resolved in km exactly as before and the resulting
 * ratio is applied to whichever anchor the session carries. No new numeric, and
 * `MIN_SESSION_DISTANCE_KM` keeps its single meaning.
 *
 * ⚠️ A SESSION WITH NO PRICE IS LEFT ALONE, never scaled on a guess: `sessionKmSelfPaced`
 * returns null when there is no pace to convert with, and `?? 0` here would assert the session
 * covered no ground — the `SESSION-KM-01/02` trap.
 *
 * ⚠️ THE FLOOR CAN STILL RAISE A SESSION above its original, because `Math.max(minFloor, …)`
 * always could. That is pre-existing behaviour for the distance path and is mirrored rather
 * than quietly changed here; if it is wrong it is wrong for both anchors and is its own ruling.
 */
function scaleSession(session: Session, scaleFactor: number, floors: SessionFloors): Session {
  const minFloor =
    isLongRun(session)          ? floors.long
    : isHardEffort(session)
      ? floors.quality
      : floors.easy

  if (session.distance_km != null) {
    const scaled = Math.round(session.distance_km * scaleFactor * 2) / 2  // 0.5 km precision
    const newKm = Math.max(minFloor, scaled)
    if (newKm === session.distance_km) return session
    return { ...session, distance_km: newKm, coach_notes: undefined }
  }

  if (session.duration_mins != null && session.duration_mins > 0) {
    const km = sessionKmSelfPaced(session)
    if (km == null || !(km > 0)) return session
    const effective = Math.max(minFloor, km * scaleFactor) / km
    const newMins = Math.round(session.duration_mins * effective)
    if (newMins === session.duration_mins) return session
    return { ...session, duration_mins: newMins, coach_notes: undefined }
  }

  return session
}

/** Derive the taper Phase from plan.phases or by scanning plan.weeks. */
/** EXPORTED for `taperRecalLiveness.test.ts` (2026-11-09): that proof derived the taper start a
 *  SECOND way — the array position of the first `phase === 'taper'` week — and the two answers
 *  agreed only by accident of the day of the week, because the plan it builds is anchored to
 *  NEXT MONDAY. A checker that re-derives the producer's answer is guessing alongside it. */
export function resolveTaperPhase(plan: Plan): Phase | null {
  if (plan.phases && plan.phases.length > 0) {
    return plan.phases.find(p => p.name === 'taper') ?? null
  }
  // Fallback: derive from week.phase property
  const firstTaperWeek = plan.weeks.find(w => w.phase === 'taper')
  const lastTaperWeek  = [...plan.weeks].reverse().find(w => w.phase === 'taper')
  if (!firstTaperWeek || !lastTaperWeek) return null
  return {
    name: 'taper',
    start_week: firstTaperWeek.n,
    end_week:   lastTaperWeek.n,
  }
}

// ── Core ─────────────────────────────────────────────────────────────────────

export function computeTaperRecalibration(
  input: TaperRecalibrationInput,
): TaperRecalibrationResult {
  const { weeklyActuals, plan, currentWeekN } = input

  // Idempotency — only runs once per plan
  if (plan.meta.taper_recalibrated_at) {
    return { applied: false, skipReason: 'already recalibrated' }
  }

  // §113 Am.1 — floors are resolved for the runner, never read flat.
  const floors: SessionFloors = sessionFloorsFor(plan.meta.generator_input?.longest_recent_run_km)

  const taperPhase = resolveTaperPhase(plan)
  if (!taperPhase) {
    return { applied: false, skipReason: 'no taper phase defined in plan' }
  }

  // Must be exactly the first taper week
  if (currentWeekN !== taperPhase.start_week) {
    return { applied: false, skipReason: `not taper entry (current=${currentWeekN}, taper starts=${taperPhase.start_week})` }
  }

  // Need enough actual data to make a defensible call
  const minWeeks = GENERATION_CONFIG.TAPER_RECAL_MIN_WEEKS_DATA
  if (weeklyActuals.size < minWeeks) {
    return {
      applied: false,
      skipReason: `insufficient actual data (${weeklyActuals.size} < ${minWeeks} weeks)`,
    }
  }

  // Functional peak: average of top N actual weeks (outlier-protected)
  const topN = GENERATION_CONFIG.TAPER_RECAL_FUNCTIONAL_PEAK_WEEKS
  const sorted = Array.from(weeklyActuals.values()).sort((a, b) => b - a)
  const topValues = sorted.slice(0, topN)
  const functionalPeakKm = topValues.reduce((s, v) => s + v, 0) / topValues.length

  // Planned anchor: the week immediately before the taper phase
  const preTaperWeekIndex = taperPhase.start_week - 2  // 0-indexed
  const plannedPreTaperKm = plan.weeks[preTaperWeekIndex]?.weekly_km ?? 0
  if (plannedPreTaperKm <= 0) {
    return { applied: false, skipReason: 'planned pre-taper volume missing' }
  }

  const ratio = functionalPeakKm / plannedPreTaperKm
  const threshold = GENERATION_CONFIG.TAPER_RECAL_VOLUME_THRESHOLD_PCT / 100

  // Only adjust downward, and only when the gap is material
  if (ratio >= threshold) {
    return {
      applied: false,
      skipReason: `ratio ${(ratio * 100).toFixed(0)}% within tolerance (≥${GENERATION_CONFIG.TAPER_RECAL_VOLUME_THRESHOLD_PCT}%)`,
      functionalPeakKm,
      plannedPreTaperKm,
      ratio,
    }
  }

  // Recalibrate taper week volumes using the same reduction formula as the
  // original plan (same %) but anchored to functionalPeak instead of plannedPreTaper.
  const distKey     = raceDistanceKey(plan.meta.race_distance_km)
  const taperConfig = GENERATION_CONFIG.TAPER_BY_DISTANCE[distKey]
  const taperPhaseWeeks = GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[distKey].length
  const fullTaperWeeks  = Math.max(1, taperPhaseWeeks - 1)  // excludes race week
  const totalWeeks      = plan.weeks.length
  const weeksModified: number[] = []

  const newWeeks: Week[] = plan.weeks.map((week, i) => {
    const weekN = i + 1
    if (week.phase !== 'taper') return week
    // Race week (last week of plan) stays exactly as written — shakeouts are
    // volume-irrelevant and the structure is sacred (CoachingPrinciples §26).
    if (weekN === totalWeeks) return week

    const taperIdx = weekN - taperPhase.start_week
    const stepPct  = taperConfig.volume_reduction_pct / fullTaperWeeks
    const reductionPct = stepPct * (taperIdx + 1)
    const newWeeklyKm = Math.round(functionalPeakKm * (1 - reductionPct / 100))

    const originalWeeklyKm = week.weekly_km
    if (originalWeeklyKm <= 0) return week
    const scaleFactor = newWeeklyKm / originalWeeklyKm

    const newSessions: Week['sessions'] = {}
    for (const [day, session] of Object.entries(week.sessions) as [string, Session | undefined][]) {
      const d = day as keyof Week['sessions']
      if (!session || session.type === 'rest') { newSessions[d] = session; continue }
      newSessions[d] = scaleSession(session, scaleFactor, floors)
    }

    // 🔴 `weeksModified` RECORDED EVERY WEEK VISITED, NOT EVERY WEEK ALTERED, so the route
    // returned `recalibrated: true` with a non-empty list for all 457 beginner plans in which
    // nothing moved. Same claim-versus-computation shape as the readiness summary
    // (READINESS-LONG-DURATION-01), in the sibling function.
    // ⚠️ `weekly_km` is compared too: a week whose total changed IS modified, even if the
    // rounding left every session where it was. The claim must cover everything we wrote.
    const sessionsChanged = (Object.entries(newSessions) as [string, Session | undefined][])
      .some(([day, s]) => s !== week.sessions[day as keyof Week['sessions']])
    if (sessionsChanged || newWeeklyKm !== originalWeeklyKm) weeksModified.push(weekN)
    return { ...week, sessions: newSessions, weekly_km: newWeeklyKm }
  })

  if (weeksModified.length === 0) {
    return { applied: false, skipReason: 'no taper weeks to modify (race week only?)' }
  }

  const recalibratedPlan: Plan = {
    ...plan,
    weeks: newWeeks,
    meta: {
      ...plan.meta,
      taper_recalibrated_at:    new Date().toISOString(),
      functional_peak_km:       Math.round(functionalPeakKm * 10) / 10,
      planned_peak_km_at_recal: plannedPreTaperKm,
    },
  }

  return {
    applied: true,
    functionalPeakKm,
    plannedPreTaperKm,
    ratio,
    plan: recalibratedPlan,
    weeksModified,
  }
}
