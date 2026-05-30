// AI-DEPTH-08 — post-race plan reshape rule engine
// FREE — infrastructure (deterministic structural changes only; no AI calls here)
//
// Consumes: Plan + RaceResult + raceWeekN
// Produces: structurally reshaped plan with recovery weeks applied
//
// Architecture: this is the deterministic step 1 of the hybrid pattern (ADR-006).
// The AI enricher (lib/coaching/prompts/postRaceReshape.ts → Sonnet) adds
// per-session coach notes and the summary paragraph. Enricher failure is silent —
// the rule-engine shape is always the fallback.
//
// Volume reference: plan peak weekly_km (max across all weeks).
// Recovery config: keyed by race distance bucket (CoachingPrinciples §62).
// Taper protection: weeks within TAPER_PROTECTION_WEEKS of a future race are
// never touched — the runner may still have a Race B.

import type { Plan, Session, Week, RaceResult } from '@/types/plan'
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
import { TAPER_PROTECTION_WEEKS } from '@/lib/coaching/constants'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DistanceBucket = keyof typeof GENERATION_CONFIG.POST_RACE_RECOVERY_BY_DISTANCE

export interface ReshapeOutput {
  /** Full reshaped plan — ready to present as preview or save directly. */
  reshapedPlan: Plan
  /** 1-indexed week numbers that were structurally modified. */
  weeksAffected: number[]
  /** Total sessions whose type/volume was changed. */
  sessionsModified: number
  /** Distance bucket used to select the recovery config. */
  distanceBucket: DistanceBucket
  /** Plan peak weekly_km used as volume reference. */
  peakWeeklyKm: number
  /** Number of recovery curve weeks (full window length). */
  recoveryWindowWeeks: number
}

// ── Distance bucketing ────────────────────────────────────────────────────────

export function getDistanceBucket(km: number): DistanceBucket {
  if (km <= 6)   return '5K'
  if (km <= 12)  return '10K'
  if (km <= 23)  return 'HM'
  if (km <= 45)  return 'MARATHON'
  if (km <= 75)  return '50K'
  return '100K'
}

// ── Session classification ────────────────────────────────────────────────────

const QUALITY_TYPES = new Set<Session['type']>(['quality', 'intervals', 'tempo', 'hard', 'long'])

function isQualitySession(type: Session['type']): boolean {
  return QUALITY_TYPES.has(type)
}

// ── Session transformers ──────────────────────────────────────────────────────

/** Convert a quality/long session to a passive recovery run for week+1/+2. */
function toRecoveryRun(session: Session, targetKm: number): Session {
  const km = Math.max(3, Math.round(targetKm * 2) / 2)
  return {
    ...session,
    type: 'recovery',
    label: 'Easy recovery',
    detail: null,
    distance_km:   km,
    duration_mins: session.duration_mins ? Math.round(km / (session.duration_mins / (session.distance_km ?? km)) * 10) / 10 : undefined,
    zone:          'Zone 1–2',
    hr_target:     undefined,
    pace_target:   undefined,
    rpe_target:    3,
    coach_notes:   undefined,   // AI enricher populates
    key_session:   false,
    run_walk_strategy:  undefined,
    fueling_protocol:   undefined,
  }
}

/** Scale a run session's distance proportionally but preserve its type/character. */
function scaleSession(session: Session, scaleFactor: number): Session {
  if (!session.distance_km) return session
  const newKm = Math.max(3, Math.round(session.distance_km * scaleFactor * 2) / 2)
  if (newKm === session.distance_km) return session
  return {
    ...session,
    distance_km: newKm,
    coach_notes:  undefined,  // AI enricher populates
  }
}

// ── Main reshape function ─────────────────────────────────────────────────────

/**
 * Compute a structurally reshaped plan after a race.
 *
 * Returns null if there are no weeks remaining after the race
 * (plan is complete — nothing to reshape).
 */
export function computePostRaceReshape(
  plan: Plan,
  result: RaceResult,
  raceWeekN: number,  // 1-indexed
): ReshapeOutput | null {

  // Must have weeks after the race
  if (raceWeekN >= plan.weeks.length) return null

  // Distance: prefer the logged actual distance, fall back to plan target
  const distKm = result.distance_km ?? plan.meta.race_distance_km
  const bucket = getDistanceBucket(distKm)
  const recoveryConfig = GENERATION_CONFIG.POST_RACE_RECOVERY_BY_DISTANCE[bucket]

  // Peak weekly_km — volume reference for recovery curve
  const peakWeeklyKm = Math.max(1, ...plan.weeks.map(w => w.weekly_km ?? 0))

  // Find next race after raceWeekN to protect its taper
  const nextRaceWeekN = (() => {
    const idx = plan.weeks.findIndex(
      (w, i) => i + 1 > raceWeekN && (w.type === 'race' || w.type === 'race_event' || w.badge === 'race')
    )
    return idx >= 0 ? idx + 1 : null
  })()

  // Reshape window: up to (but not including) any future race taper
  const windowEnd = nextRaceWeekN
    ? nextRaceWeekN - TAPER_PROTECTION_WEEKS - 1
    : plan.weeks.length

  if (windowEnd < raceWeekN + 1) return null  // taper gap eats all remaining weeks

  // Deep-clone only the weeks we might mutate
  const reshapedWeeks: Week[] = plan.weeks.map(w => ({
    ...w,
    sessions: { ...w.sessions },
  }))

  const weeksAffected: number[] = []
  let sessionsModified = 0

  for (let weekN = raceWeekN + 1; weekN <= windowEnd; weekN++) {
    const weekIndex = weekN - 1
    const week = reshapedWeeks[weekIndex]
    if (!week) continue

    const curveIndex = weekN - raceWeekN - 1   // 0 = first week after race
    const curvePct  = recoveryConfig.volume_curve_pct[curveIndex] ?? null
    const isInRecoveryWindow = curvePct !== null
    const isQualityBlackout  = curveIndex < recoveryConfig.quality_blackout_weeks

    if (!isInRecoveryWindow) continue  // past recovery window — leave untouched

    const targetKm    = peakWeeklyKm * (curvePct / 100)
    const scaleFactor = curvePct / 100

    // Count active (non-rest) sessions for per-session km budget
    const activeDays = Object.values(week.sessions).filter(
      s => s && s.type !== 'rest'
    ).length
    const sessionBudgetKm = targetKm / Math.max(1, activeDays)

    const newSessions: Week['sessions'] = {}
    for (const [day, session] of Object.entries(week.sessions) as [string, Session | undefined][]) {
      const d = day as keyof Week['sessions']
      if (!session) { newSessions[d] = session; continue }
      if (session.type === 'rest') { newSessions[d] = session; continue }

      if (isQualityBlackout && isQualitySession(session.type)) {
        newSessions[d] = toRecoveryRun(session, sessionBudgetKm)
        sessionsModified++
      } else {
        const scaled = scaleSession(session, scaleFactor)
        newSessions[d] = scaled
        if (scaled !== session) sessionsModified++
      }
    }

    reshapedWeeks[weekIndex] = {
      ...week,
      sessions:   newSessions,
      weekly_km:  Math.round(targetKm * 10) / 10,
      type:       curveIndex === 0 ? 'deload' : week.type,
      label:      isQualityBlackout
        ? (curveIndex === 0 ? 'Recovery week' : 'Return to running')
        : week.label,
      theme: isQualityBlackout
        ? (curveIndex === 0
            ? 'Rest. Absorb the race. Do nothing until it feels like too much nothing.'
            : 'Easy only. Quality sessions return next week.')
        : week.theme,
    }

    weeksAffected.push(weekN)
  }

  if (weeksAffected.length === 0) return null

  const reshapedPlan: Plan = { ...plan, weeks: reshapedWeeks }

  return {
    reshapedPlan,
    weeksAffected,
    sessionsModified,
    distanceBucket: bucket,
    peakWeeklyKm,
    recoveryWindowWeeks: recoveryConfig.volume_curve_pct.length,
  }
}
