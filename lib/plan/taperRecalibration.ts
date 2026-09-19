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
import { isLongRun } from '@/lib/plan/sessionRole'
import { sessionFloorsFor, type SessionFloors } from '@/lib/plan/sessionFloors'

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
function scaleSession(session: Session, scaleFactor: number, floors: SessionFloors): Session {
  if (!session.distance_km) return session
  const minFloor =
    isLongRun(session)          ? floors.long
    : session.type === 'quality' || session.type === 'tempo' || session.type === 'intervals' || session.type === 'hard'
      ? floors.quality
      : floors.easy
  const scaled = Math.round(session.distance_km * scaleFactor * 2) / 2  // 0.5 km precision
  const newKm = Math.max(minFloor, scaled)
  if (newKm === session.distance_km) return session
  return { ...session, distance_km: newKm, coach_notes: undefined }
}

/** Derive the taper Phase from plan.phases or by scanning plan.weeks. */
function resolveTaperPhase(plan: Plan): Phase | null {
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

    weeksModified.push(weekN)
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
