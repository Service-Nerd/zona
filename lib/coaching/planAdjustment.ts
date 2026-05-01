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
  READINESS,
} from './constants'
import { acuteChronicRatio, shadowLoadPct, zoneDisciplineScore } from './loadCalc'
import { BRAND } from '@/lib/brand'
import type { Session } from '@/types/plan'

export type AdjustmentType = 'reduce_volume' | 'swap_session' | 'extend_recovery' | 'reorder_sessions' | 'flag_for_review'
export type TriggerType    =
  | 'acute_chronic_high'
  | 'zone_drift'
  | 'shadow_load'
  | 'ef_decline'
  | 'fatigue_accumulation'
  | 'skip_with_reason'
  | 'session_reorder'
  | 'readiness_signal'
  | 'manual'

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
  /**
   * RPE signal from most-recently logged session.
   * Triggers RPE-disconnect coach note when rpe >= 8 on easy/long.
   */
  rpeSignal?: { rpe: number; sessionType: string }
  /**
   * Skip signal from a user-initiated skip.
   * reason maps to: 'Life got busy' | 'Bad weather' | 'Too tired' | 'Injury / illness'
   * weekSessionsByDay: current week's sessions keyed by day ('mon'…'sun'), used to find free slots.
   */
  skipSignal?: {
    reason: string
    sessionType: string
    sessionDay: string
    weekSessionsByDay: Record<string, Session | undefined | null>
  }
  /**
   * Reorder signal: user wants to move a session from one day to another.
   * The reorder check bypasses taper protection — it's always user-initiated.
   */
  reorderSignal?: { fromDay: string; toDay: string }
  /**
   * Pre-session readiness signal — composite of RHR / HRV / sleep deviations
   * from the user's 14-day baseline. Fires only on quality/long days, only
   * when `hasBaseline` is true. The only signal that fires *before* the run.
   * See CoachingPrinciples §59.
   */
  readinessSignal?: {
    sessionType:    string
    sessionDay:     string
    isElevatedRHR:  boolean
    isLowHRV:       boolean
    isShortSleep:   boolean
    hasBaseline:    boolean
  }
}

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const HARD_TYPES = new Set(['quality', 'intervals', 'tempo', 'long'])
const RPE_DISCONNECT_THRESHOLD = 8
const SKIP_INJURY_VOLUME_REDUCTION = 0.85  // 15% cut per session
const HILL_TYPES = new Set(['hills', 'hill_repeats'])

/**
 * Checks automatic triggers and returns at most one proposed adjustment.
 * Priority: skip > reorder > fatigue > load ratio > readiness > zone_drift >
 * shadow_load > ef_decline > RPE disconnect.
 * Readiness sits above zone_drift because it fires pre-session — earliest in
 * the user's day (CoachingPrinciples §59).
 * Returns null if no adjustment warranted or guards prevent it.
 */
export function checkAdjustmentTriggers(input: AdjustmentCheckInput): ProposedAdjustment | null {
  // Skip with reason — user-initiated, bypasses taper guard
  if (input.skipSignal) {
    if (input.adjustmentsThisWeek >= MAX_ADJUSTMENTS_PER_WEEK) return null
    return buildSkipAdjustment(input, input.skipSignal)
  }

  // Reorder — user-initiated, bypasses taper guard
  if (input.reorderSignal) {
    if (input.adjustmentsThisWeek >= MAX_ADJUSTMENTS_PER_WEEK) return null
    return buildReorderAdjustment(input, input.reorderSignal.fromDay, input.reorderSignal.toDay)
  }

  if (!guardCheck(input)) return null

  // Fatigue accumulation — highest priority automatic signal
  if (input.recentFatigueTags && input.recentFatigueTags.length >= FATIGUE_ACCUMULATION_THRESHOLD) {
    const lastN = input.recentFatigueTags.slice(-FATIGUE_ACCUMULATION_THRESHOLD)
    if (lastN.every(t => (FATIGUE_HIGH_TAGS as readonly string[]).includes(t))) {
      return buildFatigueAdjustment(input, lastN.length)
    }
  }

  const ratio   = acuteChronicRatio(input.actualKm, input.priorWeeksKm)
  const zdScore = zoneDisciplineScore(input.hrInZoneData)
  const shadow  = shadowLoadPct(input.actualKm, input.plannedKm)

  if (ratio >= LOAD_RATIO.watch) {
    return buildReduceVolumeAdjustment(input, ratio)
  }

  // Readiness signal — fires above zone_drift because it pre-empts the day.
  // Only triggers on quality/long; soften (not skip).
  if (
    input.readinessSignal
    && input.readinessSignal.hasBaseline
    && (input.readinessSignal.isElevatedRHR || input.readinessSignal.isLowHRV || input.readinessSignal.isShortSleep)
    && HARD_TYPES.has(input.readinessSignal.sessionType)
  ) {
    return buildReadinessAdjustment(input, input.readinessSignal)
  }

  if (zdScore !== null && zdScore < ZONE_DISCIPLINE_BANDS.loose) {
    return buildZoneDriftAdjustment(input, zdScore)
  }

  if (shadow > SHADOW_LOAD_THRESHOLD_PCT) {
    return buildShadowLoadAdjustment(input, shadow)
  }

  if (input.efTrendPct !== null && input.efTrendPct < EF_DECLINE_THRESHOLD_PCT) {
    return buildEFDeclineAdjustment(input, input.efTrendPct)
  }

  // RPE disconnect — lowest priority automatic signal, fires only when no Strava HR data
  if (
    input.rpeSignal &&
    input.rpeSignal.rpe >= RPE_DISCONNECT_THRESHOLD &&
    (input.rpeSignal.sessionType === 'easy' || input.rpeSignal.sessionType === 'long') &&
    zdScore === null  // only fire when we have no HR data to tell the same story
  ) {
    return buildRpeDisconnectAdjustment(input, input.rpeSignal.rpe, input.rpeSignal.sessionType)
  }

  return null
}

/** Hard guards — no adjustment if any fails. */
function guardCheck(input: AdjustmentCheckInput): boolean {
  if (input.adjustmentsThisWeek >= MAX_ADJUSTMENTS_PER_WEEK) return false
  const weeksRemaining = input.totalWeeks - input.currentWeekN
  if (weeksRemaining <= TAPER_PROTECTION_WEEKS) return false
  if (input.currentPhase === 'taper') return false
  return true
}

// ─── Builders ────────────────────────────────────────────────────────────────

function buildReduceVolumeAdjustment(input: AdjustmentCheckInput, ratio: number): ProposedAdjustment {
  const sessions       = input.currentWeekSessions
  const sessionsBefore = sessions.map(s => ({ ...s }))
  const sessionsAfter  = sessions.map(s => {
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
  const sessionsAfter  = sessions.map(s => {
    if (s.type === 'easy' || s.type === 'long') {
      return { ...s, coach_notes: ['Zone 2 only. HR ceiling enforced — if HR climbs, slow down.'] as [string] }
    }
    return { ...s }
  })
  return {
    weekN:          input.currentWeekN,
    trigger:        { type: 'zone_drift', detail: { zdScore, threshold: ZONE_DISCIPLINE_BANDS.loose } },
    adjustmentType: 'flag_for_review',
    summary:        `Zone discipline ${zdScore}/100. Easy sessions trending hard. HR ceiling reinforced.`,
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
    summary:        `Actual load ${Math.round(shadowPct)}% above plan. Flagged — no auto-change applied.`,
    sessionsBefore,
    sessionsAfter,
    requiresConfirmation: true,
  }
}

function buildEFDeclineAdjustment(input: AdjustmentCheckInput, efTrend: number): ProposedAdjustment {
  const sessions       = input.currentWeekSessions
  const sessionsBefore = sessions.map(s => ({ ...s }))

  if (input.currentPhase === 'peak') {
    const sessionsAfter = sessions.map(s => {
      if (s.type === 'quality' || s.type === 'intervals') {
        return { ...s, coach_notes: [`EF trending down ${Math.abs(Math.round(efTrend))}%. Stay disciplined — peak phase.`] as [string] }
      }
      return { ...s }
    })
    return {
      weekN:          input.currentWeekN,
      trigger:        { type: 'ef_decline', detail: { efTrend, threshold: EF_DECLINE_THRESHOLD_PCT, phase: 'peak' } },
      adjustmentType: 'flag_for_review',
      summary:        `Aerobic efficiency down ${Math.abs(Math.round(efTrend))}%. Peak phase — coach note only.`,
      sessionsBefore,
      sessionsAfter,
      requiresConfirmation: true,
    }
  }

  const sessionsAfter = sessions.map(s => {
    if (s.type === 'quality' || s.type === 'intervals') {
      return { ...s, type: 'easy' as const, coach_notes: ['Swapped to easy — aerobic efficiency trending down.'] as [string] }
    }
    return { ...s }
  })
  return {
    weekN:          input.currentWeekN,
    trigger:        { type: 'ef_decline', detail: { efTrend, threshold: EF_DECLINE_THRESHOLD_PCT } },
    adjustmentType: 'swap_session',
    summary:        `Aerobic efficiency down ${Math.abs(Math.round(efTrend))}%. Quality swapped to easy.`,
    sessionsBefore,
    sessionsAfter,
    requiresConfirmation: true,
  }
}

function buildFatigueAdjustment(input: AdjustmentCheckInput, consecutiveCount: number): ProposedAdjustment {
  const sessions       = input.currentWeekSessions
  const sessionsBefore = sessions.map(s => ({ ...s }))
  const sessionsAfter  = sessions.map(s => {
    if (s.type === 'quality' || s.type === 'intervals' || s.type === 'tempo') {
      return {
        ...s,
        type: 'easy' as const,
        coach_notes: [`Swapped to easy — ${consecutiveCount} consecutive heavy sessions. Let the adaptation catch up.`] as [string],
      }
    }
    if (s.type === 'long' && s.distance_km) {
      return {
        ...s,
        distance_km: Math.round(s.distance_km * FATIGUE_SOFTENING_LONG_RUN_PCT * 10) / 10,
        coach_notes: ['Shortened — fatigue accumulating. Same aerobic stimulus, less load.'] as [string],
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

/**
 * Trigger 5: RPE disconnect.
 * RPE ≥ 8 on an easy/long session when no Strava HR data is available.
 * Adds Zone 2 ceiling reminder to upcoming easy sessions — no structural change.
 */
function buildRpeDisconnectAdjustment(input: AdjustmentCheckInput, rpe: number, sessionType: string): ProposedAdjustment {
  const sessions       = input.currentWeekSessions
  const sessionsBefore = sessions.map(s => ({ ...s }))
  const sessionsAfter  = sessions.map(s => {
    if (s.type === 'easy' || s.type === 'long') {
      return {
        ...s,
        coach_notes: [`RPE ${rpe} on ${sessionType} run. Keep HR in Zone 2 — if it felt hard, it was too hard.`] as [string],
      }
    }
    return { ...s }
  })
  return {
    weekN:          input.currentWeekN,
    trigger:        { type: 'zone_drift', detail: { rpe, sessionType, source: 'rpe_disconnect' } },
    adjustmentType: 'flag_for_review',
    summary:        `RPE ${rpe} on ${sessionType} run. Zone 2 reminder added to remaining easy sessions.`,
    sessionsBefore,
    sessionsAfter,
    requiresConfirmation: false,
  }
}

/**
 * Pre-session readiness adjustment.
 * Composite of RHR / HRV / sleep deviations from 14-day baseline. Soften only —
 * never auto-skip. Coach copy uses BRAND.voiceAnchor ("Hold the zone.") because
 * this is the moment that tests the user's commitment to zone discipline.
 */
function buildReadinessAdjustment(
  input: AdjustmentCheckInput,
  signal: NonNullable<AdjustmentCheckInput['readinessSignal']>,
): ProposedAdjustment {
  const sessions       = input.currentWeekSessions
  const sessionsBefore = sessions.map(s => ({ ...s }))

  const reasons: string[] = []
  if (signal.isElevatedRHR) reasons.push('resting HR up')
  if (signal.isLowHRV)      reasons.push('HRV down')
  if (signal.isShortSleep)  reasons.push('short sleep')
  const reasonStr = reasons.join(' + ')

  // Caller (/api/pre-session-readiness) passes only today's session in
  // currentWeekSessions, so this map only modifies the target session by
  // construction. Type-based filter belt-and-braces.
  const sessionsAfter = sessions.map(s => {
    if (s.type === 'quality' || s.type === 'intervals' || s.type === 'tempo') {
      return {
        ...s,
        type: 'easy' as const,
        coach_notes: [`${BRAND.voiceAnchor} Recovery signals are off (${reasonStr}). Easy day instead — the quality is on the bench.`] as [string],
      }
    }
    if (s.type === 'long' && s.distance_km) {
      return {
        ...s,
        distance_km: Math.round(s.distance_km * READINESS.LONG_RUN_SOFTEN_PCT * 10) / 10,
        coach_notes: [`${BRAND.voiceAnchor} Trimmed today (${reasonStr}). Body's not ready for the full distance.`] as [string],
      }
    }
    return { ...s }
  })

  const adjustmentType: AdjustmentType = signal.sessionType === 'long' ? 'reduce_volume' : 'swap_session'
  const summary = signal.sessionType === 'long'
    ? `Recovery signals off (${reasonStr}). Long run trimmed ${Math.round((1 - READINESS.LONG_RUN_SOFTEN_PCT) * 100)}%.`
    : `Recovery signals off (${reasonStr}). Quality swapped to easy.`

  return {
    weekN:          input.currentWeekN,
    trigger:        { type: 'readiness_signal', detail: {
      sessionType:   signal.sessionType,
      sessionDay:    signal.sessionDay,
      isElevatedRHR: signal.isElevatedRHR,
      isLowHRV:      signal.isLowHRV,
      isShortSleep:  signal.isShortSleep,
    } },
    adjustmentType,
    summary,
    sessionsBefore,
    sessionsAfter,
    requiresConfirmation: true,
  }
}

/**
 * Trigger 2: Skip with reason.
 * Life got busy / Bad weather → propose make-up slot in remaining week.
 * Too tired → absorb (return null — no plan change).
 * Injury / illness → §21 content filter + volume reduction note.
 */
function buildSkipAdjustment(
  input: AdjustmentCheckInput,
  signal: NonNullable<AdjustmentCheckInput['skipSignal']>,
): ProposedAdjustment | null {
  const { reason, sessionType, sessionDay, weekSessionsByDay } = signal
  const sessions       = input.currentWeekSessions
  const sessionsBefore = sessions.map(s => ({ ...s }))

  // "Too tired" — absorb the skip, no plan change
  if (reason === 'Too tired') return null

  // "Life got busy" / "Bad weather" — find first free slot after the skipped day
  if (reason === 'Life got busy' || reason === 'Bad weather') {
    const skippedIdx  = DAY_ORDER.indexOf(sessionDay as typeof DAY_ORDER[number])
    const remainingDays = DAY_ORDER.slice(skippedIdx + 1)
    const freeDay = remainingDays.find(day => {
      const s = weekSessionsByDay[day]
      return !s || s.type === 'rest'
    })

    if (!freeDay) {
      // No free slot — absorb the skip, no plan change
      return null
    }

    // Add make-up session to the free slot — same type as skipped session
    const makeUpSession: Session = {
      type: sessionType as Session['type'],
      label: `Make-up ${sessionType} run`,
      detail: 'Rescheduled from earlier this week. Keep the effort easy — this is a catch-up, not extra load.',
      coach_notes: ['Make-up session. Same effort as the original — no extra load.'] as [string],
    }
    const sessionsAfter = sessions.map(s => ({ ...s }))
    // Insert as a note on the plan — the actual session structure is returned for display
    return {
      weekN:          input.currentWeekN,
      trigger:        { type: 'skip_with_reason', detail: { reason, sessionType, sessionDay, freeDay } },
      adjustmentType: 'reorder_sessions',
      summary:        `Skipped ${sessionType} (${reason.toLowerCase()}). Make-up slot found: ${freeDay}.`,
      sessionsBefore,
      sessionsAfter:  [...sessionsAfter, makeUpSession],
      requiresConfirmation: true,
    }
  }

  // "Injury / illness" — §21 content filter + volume reduction
  if (reason === 'Injury / illness') {
    const sessionsAfter = sessions.map(s => {
      // Quality/interval sessions: add injury caution note (§21 content filter)
      if (s.type === 'quality' || s.type === 'intervals') {
        return {
          ...s,
          coach_notes: ['Injury concern flagged. Keep effort controlled — no pushing through discomfort.'] as [string],
        }
      }
      // Easy/long sessions: 15% volume reduction
      if ((s.type === 'easy' || s.type === 'long') && s.distance_km) {
        return {
          ...s,
          distance_km: Math.round(s.distance_km * SKIP_INJURY_VOLUME_REDUCTION * 10) / 10,
          coach_notes: ['Reduced — injury concern. If pain persists, skip and rest.'] as [string],
        }
      }
      return { ...s }
    })
    return {
      weekN:          input.currentWeekN,
      trigger:        { type: 'skip_with_reason', detail: { reason, sessionType, sessionDay } },
      adjustmentType: 'reduce_volume',
      summary:        `Skipped due to injury concern. Remaining sessions trimmed 15%; quality sessions flagged.`,
      sessionsBefore,
      sessionsAfter,
      requiresConfirmation: true,
    }
  }

  return null
}

/**
 * Trigger 1: Session reorder (move).
 * Checks §7 (hard/easy alternation) after the proposed move.
 * If the move creates back-to-back hard sessions, proposes a swap of the target day.
 * If the move is clean, proposes it directly.
 */
function buildReorderAdjustment(
  input: AdjustmentCheckInput,
  fromDay: string,
  toDay: string,
): ProposedAdjustment | null {
  const sessions       = input.currentWeekSessions
  const sessionsBefore = sessions.map(s => ({ ...s }))

  const fromIdx = DAY_ORDER.indexOf(fromDay as typeof DAY_ORDER[number])
  const toIdx   = DAY_ORDER.indexOf(toDay as typeof DAY_ORDER[number])
  if (fromIdx === -1 || toIdx === -1) return null

  // Simulate the move: swap sessions at fromDay and toDay positions
  // We work by index into DAY_ORDER against currentWeekSessions (which is ordered by plan day)
  const sessionsAfter = sessions.map(s => ({ ...s }))
  const fromSession   = sessionsAfter[fromIdx]
  const toSession     = sessionsAfter[toIdx]
  if (!fromSession) return null  // nothing to move

  sessionsAfter[fromIdx] = toSession ?? { type: 'rest', label: 'Rest', detail: null }
  sessionsAfter[toIdx]   = fromSession

  // §7 check: detect back-to-back hard sessions after the move
  let hardAdjacentViolation = false
  for (let i = 1; i < sessionsAfter.length; i++) {
    const prev = sessionsAfter[i - 1]
    const curr = sessionsAfter[i]
    if (prev && curr && HARD_TYPES.has(prev.type) && HARD_TYPES.has(curr.type)) {
      hardAdjacentViolation = true
      break
    }
  }

  const requiresConfirmation = hardAdjacentViolation
  const summary = hardAdjacentViolation
    ? `Moved ${fromSession.label ?? fromDay} to ${toDay}. Back-to-back hard sessions detected — review carefully.`
    : `Moved ${fromSession.label ?? fromDay} to ${toDay}. Hard/easy alternation preserved.`

  return {
    weekN:          input.currentWeekN,
    trigger:        { type: 'session_reorder', detail: { fromDay, toDay, hardAdjacentViolation } },
    adjustmentType: 'reorder_sessions',
    summary,
    sessionsBefore,
    sessionsAfter,
    requiresConfirmation,
  }
}

// ─── Validation helpers ───────────────────────────────────────────────────────

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
    const gapMs    = qualitySessions[i].scheduledDate.getTime() - qualitySessions[i - 1].scheduledDate.getTime()
    const gapHours = gapMs / (1000 * 60 * 60)
    if (gapHours < MIN_QUALITY_GAP_HOURS) return false
  }
  return true
}
