import {
  LOAD_RATIO,
  SHADOW_LOAD_THRESHOLD_PCT,
  EF_DECLINE_THRESHOLD_PCT,
  MAX_ADJUSTMENTS_PER_WEEK,
  MIN_QUALITY_GAP_HOURS,
  TAPER_PROTECTION_WEEKS,
  MAX_VOLUME_INCREASE_PCT,
  ZONE_DISCIPLINE_BANDS,
  FATIGUE_HIGH_TAGS,
  FATIGUE_ACCUMULATION_THRESHOLD,
  FATIGUE_SOFTENING_LONG_RUN_PCT,
} from './constants'
import { acuteChronicRatio, shadowLoadPct, zoneDisciplineScore } from './loadCalc'
import type { Session, Week } from '@/types/plan'

export type AdjustmentType = 'reduce_volume' | 'swap_session' | 'extend_recovery' | 'reorder_sessions' | 'flag_for_review'
export type TriggerType    = 'acute_chronic_high' | 'zone_drift' | 'shadow_load' | 'ef_decline' | 'fatigue_accumulation' | 'manual'

export interface AdjustmentTrigger {
  type:   TriggerType
  detail: Record<string, unknown>
}

export interface ProposedAdjustment {
  weekN:          number
  trigger:        AdjustmentTrigger
  adjustmentType: AdjustmentType
  summary:        string
  sessionsBefore: Session[]
  sessionsAfter:  Session[]
  requiresConfirmation: boolean
}

export interface AdjustmentCheckInput {
  currentWeekN:     number
  totalWeeks:       number
  currentWeekSessions: Session[]
  actualKm:         number
  plannedKm:        number
  priorWeeksKm:     number[]
  hrInZoneData:     { sessionType: string; hrInZonePct: number | null }[]
  efTrendPct:       number | null
  adjustmentsThisWeek: number
  currentPhase?:    'base' | 'build' | 'peak' | 'taper'
  /** Fatigue tags from session_completions, ordered chronologically (oldest first). */
  recentFatigueTags?: string[]
}

/**
 * Checks triggers and returns at most one proposed adjustment.
 * Priority: acute_chronic > zone_drift > shadow_load > ef_decline.
 * Returns null if no adjustment warranted or guards prevent it.
 */
export function checkAdjustmentTriggers(input: AdjustmentCheckInput): ProposedAdjustment | null {
  if (!guardCheck(input)) return null

  // Fatigue accumulation — highest priority (physical stress signal, not Strava-derived)
  if (input.recentFatigueTags && input.recentFatigueTags.length >= FATIGUE_ACCUMULATION_THRESHOLD) {
    const lastN = input.recentFatigueTags.slice(-FATIGUE_ACCUMULATION_THRESHOLD)
    if (lastN.every(t => (FATIGUE_HIGH_TAGS as readonly string[]).includes(t))) {
      return buildFatigueAdjustment(input, lastN.length)
    }
  }

  const ratio  = acuteChronicRatio(input.actualKm, input.priorWeeksKm)
  const zdScore = zoneDisciplineScore(input.hrInZoneData)
  const shadow  = shadowLoadPct(input.actualKm, input.plannedKm)

  if (ratio >= LOAD_RATIO.watch) {
    return buildReduceVolumeAdjustment(input, ratio)
  }

  // zdScore === null when there's no Strava-analysed HR data — skip the
  // zone-drift check entirely. "No signal" is not the same as "freelancing".
  if (zdScore !== null && zdScore < ZONE_DISCIPLINE_BANDS.loose) {
    return buildZoneDriftAdjustment(input, zdScore)
  }

  if (shadow > SHADOW_LOAD_THRESHOLD_PCT) {
    return buildShadowLoadAdjustment(input, shadow)
  }

  if (input.efTrendPct !== null && input.efTrendPct < EF_DECLINE_THRESHOLD_PCT) {
    return buildEFDeclineAdjustment(input, input.efTrendPct)
  }

  return null
}

/** Hard guards — no adjustment if any fails. */
function guardCheck(input: AdjustmentCheckInput): boolean {
  if (input.adjustmentsThisWeek >= MAX_ADJUSTMENTS_PER_WEEK) return false
  // Taper protection — both weeks-remaining guard and explicit phase guard
  const weeksRemaining = input.totalWeeks - input.currentWeekN
  if (weeksRemaining <= TAPER_PROTECTION_WEEKS) return false
  if (input.currentPhase === 'taper') return false
  return true
}

function buildReduceVolumeAdjustment(input: AdjustmentCheckInput, ratio: number): ProposedAdjustment {
  const sessions     = input.currentWeekSessions
  const sessionsBefore = sessions.map(s => ({ ...s }))

  // Reduce distance on longest non-quality session by ~15%
  const sessionsAfter = sessions.map(s => {
    if (s.type === 'easy' || s.type === 'long') {
      const reduced = s.distance_km ? Math.round(s.distance_km * 0.85 * 10) / 10 : undefined
      return { ...s, distance_km: reduced }
    }
    return { ...s }
  })

  return {
    weekN:          input.currentWeekN,
    trigger:        { type: 'acute_chronic_high', detail: { ratio, threshold: LOAD_RATIO.watch } },
    adjustmentType: 'reduce_volume',
    summary:        `Load ratio ${ratio.toFixed(2)}x. Trimmed easy/long sessions ~15% to protect recovery.`,
    sessionsBefore,
    sessionsAfter,
    requiresConfirmation: ratio >= LOAD_RATIO.flag,
  }
}

function buildZoneDriftAdjustment(input: AdjustmentCheckInput, zdScore: number): ProposedAdjustment {
  const sessions       = input.currentWeekSessions
  const sessionsBefore = sessions.map(s => ({ ...s }))

  // Add HR ceiling enforcement note to easy sessions
  const sessionsAfter = sessions.map(s => {
    if (s.type === 'easy' || s.type === 'long') {
      return { ...s, coach_note: `Zone 2 only. HR ceiling enforced — if HR climbs, slow down. No exceptions.` }
    }
    return { ...s }
  })

  return {
    weekN:          input.currentWeekN,
    trigger:        { type: 'zone_drift', detail: { zdScore, threshold: ZONE_DISCIPLINE_BANDS.loose } },
    adjustmentType: 'flag_for_review',
    summary:        `Zone discipline ${zdScore}/100. Easy sessions trending hard. HR ceiling reinforced in session notes.`,
    sessionsBefore,
    sessionsAfter,
    requiresConfirmation: false,
  }
}

function buildShadowLoadAdjustment(input: AdjustmentCheckInput, shadowPct: number): ProposedAdjustment {
  const sessions       = input.currentWeekSessions
  const sessionsBefore = sessions.map(s => ({ ...s }))
  const sessionsAfter  = sessions.map(s => ({ ...s }))

  return {
    weekN:          input.currentWeekN,
    trigger:        { type: 'shadow_load', detail: { shadowPct, threshold: SHADOW_LOAD_THRESHOLD_PCT } },
    adjustmentType: 'flag_for_review',
    summary:        `Actual load ${Math.round(shadowPct)}% above plan. Flagged for coach review — no auto-change applied.`,
    sessionsBefore,
    sessionsAfter,
    requiresConfirmation: true,
  }
}

function buildEFDeclineAdjustment(input: AdjustmentCheckInput, efTrend: number): ProposedAdjustment {
  const sessions       = input.currentWeekSessions
  const sessionsBefore = sessions.map(s => ({ ...s }))

  // Peak phase: don't swap quality sessions — add a coach note only
  if (input.currentPhase === 'peak') {
    const sessionsAfter = sessions.map(s => {
      if (s.type === 'quality' || s.type === 'intervals') {
        return { ...s, coach_note: `EF trending down ${Math.abs(Math.round(efTrend))}%. Stay disciplined on effort ceiling — peak phase, don't add stress.` }
      }
      return { ...s }
    })
    return {
      weekN:          input.currentWeekN,
      trigger:        { type: 'ef_decline', detail: { efTrend, threshold: EF_DECLINE_THRESHOLD_PCT, phase: 'peak' } },
      adjustmentType: 'flag_for_review',
      summary:        `Aerobic efficiency down ${Math.abs(Math.round(efTrend))}%. Peak phase — coach note added, no session swap.`,
      sessionsBefore,
      sessionsAfter,
      requiresConfirmation: true,
    }
  }

  // Base/build phase: swap quality to easy
  const sessionsAfter = sessions.map(s => {
    if (s.type === 'quality' || s.type === 'intervals') {
      return { ...s, type: 'easy' as const, coach_note: `Swapped to easy — aerobic efficiency trending down. Protect the base.` }
    }
    return { ...s }
  })

  return {
    weekN:          input.currentWeekN,
    trigger:        { type: 'ef_decline', detail: { efTrend, threshold: EF_DECLINE_THRESHOLD_PCT } },
    adjustmentType: 'swap_session',
    summary:        `Aerobic efficiency down ${Math.abs(Math.round(efTrend))}% vs baseline. Quality session swapped to easy.`,
    sessionsBefore,
    sessionsAfter,
    requiresConfirmation: true,
  }
}

function buildFatigueAdjustment(input: AdjustmentCheckInput, consecutiveCount: number): ProposedAdjustment {
  const sessions       = input.currentWeekSessions
  const sessionsBefore = sessions.map(s => ({ ...s }))

  const sessionsAfter = sessions.map(s => {
    // Swap quality/interval/tempo → easy (same distance/duration, new coach note)
    if (s.type === 'quality' || s.type === 'intervals' || s.type === 'tempo') {
      return {
        ...s,
        type: 'easy' as const,
        coach_notes: [`Swapped to easy — ${consecutiveCount} consecutive heavy sessions. Let the adaptation catch up.`] as [string],
      }
    }
    // Reduce long run by 20%
    if (s.type === 'long' && s.distance_km) {
      return {
        ...s,
        distance_km: Math.round(s.distance_km * FATIGUE_SOFTENING_LONG_RUN_PCT * 10) / 10,
        coach_notes: [`Shortened — fatigue accumulating. Same aerobic stimulus, less load.`] as [string],
      }
    }
    return { ...s }
  })

  return {
    weekN:          input.currentWeekN,
    trigger:        { type: 'fatigue_accumulation', detail: { consecutiveCount, threshold: FATIGUE_ACCUMULATION_THRESHOLD } },
    adjustmentType: 'swap_session',
    summary:        `${consecutiveCount} consecutive heavy sessions. Quality swapped to easy; long run trimmed 20%.`,
    sessionsBefore,
    sessionsAfter,
    requiresConfirmation: true,
  }
}

/** Validates that a proposed volume increase is within hard cap. */
export function validateVolumeIncrease(beforeKm: number, afterKm: number): boolean {
  if (beforeKm === 0) return true
  const pctIncrease = ((afterKm - beforeKm) / beforeKm) * 100
  return pctIncrease <= MAX_VOLUME_INCREASE_PCT
}

/** Validates quality session spacing (min 48hr gap between quality sessions). */
export function validateQualitySpacing(sessions: { type: string; scheduledDate: Date }[]): boolean {
  const qualitySessions = sessions
    .filter(s => ['quality', 'intervals', 'tempo', 'hard'].includes(s.type))
    .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())

  for (let i = 1; i < qualitySessions.length; i++) {
    const gapMs = qualitySessions[i].scheduledDate.getTime() - qualitySessions[i - 1].scheduledDate.getTime()
    const gapHours = gapMs / (1000 * 60 * 60)
    if (gapHours < MIN_QUALITY_GAP_HOURS) return false
  }
  return true
}
