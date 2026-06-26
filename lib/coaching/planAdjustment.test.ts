import { describe, it, expect } from 'vitest'
import { checkAdjustmentTriggers } from './planAdjustment'
import {
  LONG_RUN_SHORTFALL_REDUCE_PCT,
  TAPER_PROTECTION_WEEKS,
} from './constants'
import type { Session } from '@/types/plan'

// ENGINE-02 — long-run shortfall trigger.
// We exercise it through the public checkAdjustmentTriggers() entry point so the
// test also proves trigger priority + guards don't swallow it. The input below is
// deliberately "quiet" on every higher-priority signal (no fatigue, flat load
// ratio, no HR/EF data) so long_run_shortfall is the only thing that can fire.

const longSession = (km: number): Session => ({
  type: 'long',
  label: 'Long run',
  detail: null,
  distance_km: km,
})

const restSession = (): Session => ({
  type: 'rest',
  label: 'Rest',
  detail: null,
})

// 7-session week (mon→sun) with rest days everywhere except sun = long.
// RESHAPE-FIX-WAVE1: checkAdjustmentTriggers enforces a 7-element array of
// valid sessions at entry; tests must match the contract the engine sees in
// production. Rest sentinels here are the same shape the rule engine emits
// for empty days.
const longRunWeek = (longKm: number): Session[] => [
  restSession(), restSession(), restSession(),
  restSession(), restSession(), restSession(),
  longSession(longKm),
]

// A baseline input with all higher-priority triggers neutralised and guards open.
// Override per-test as needed.
const baseInput = () => ({
  currentWeekN: 6,
  totalWeeks: 12, // 6 weeks remaining > TAPER_PROTECTION_WEEKS → guards open
  currentWeekSessions: longRunWeek(20),
  actualKm: 40,
  plannedKm: 40, // shadow load ~0
  priorWeeksKm: [40, 40, 40, 40], // acute:chronic ~1.0
  hrInZoneData: [], // zone discipline → null, zone_drift skipped
  efTrendPct: null, // ef_decline skipped
  adjustmentsThisWeek: 0,
  currentPhase: 'build' as const,
})

describe('ENGINE-02 — long_run_shortfall', () => {
  it('fires when 2 consecutive long runs finish under 82% of plan', () => {
    const result = checkAdjustmentTriggers({
      ...baseInput(),
      recentLongRunAnalyses: [
        { actualKm: 14, plannedKm: 20, weekN: 5 }, // 70%
        { actualKm: 13, plannedKm: 18, weekN: 4 }, // 72%
      ],
    })

    expect(result).not.toBeNull()
    expect(result!.trigger.type).toBe('long_run_shortfall')
    expect(result!.adjustmentType).toBe('reduce_volume')
    expect(result!.requiresConfirmation).toBe(true)

    // The long run is trimmed by the configured reduce pct (20 → 17).
    const longAfter = result!.sessionsAfter.find(s => s.type === 'long')
    expect(longAfter?.distance_km).toBe(
      Math.round(20 * LONG_RUN_SHORTFALL_REDUCE_PCT * 10) / 10,
    )
    // avgCompletionPct is reported in trigger detail (71% here).
    expect(result!.trigger.detail.avgCompletionPct).toBe(71)
  })

  it('does NOT fire on a single short long run', () => {
    const result = checkAdjustmentTriggers({
      ...baseInput(),
      recentLongRunAnalyses: [{ actualKm: 14, plannedKm: 20, weekN: 5 }],
    })
    expect(result).toBeNull()
  })

  it('does NOT fire when long runs are at/above 82% completion', () => {
    const result = checkAdjustmentTriggers({
      ...baseInput(),
      recentLongRunAnalyses: [
        { actualKm: 18, plannedKm: 20, weekN: 5 }, // 90%
        { actualKm: 17, plannedKm: 18, weekN: 4 }, // 94%
      ],
    })
    expect(result).toBeNull()
  })

  it('does NOT fire when the two shortfalls are not in consecutive weeks', () => {
    const result = checkAdjustmentTriggers({
      ...baseInput(),
      recentLongRunAnalyses: [
        { actualKm: 14, plannedKm: 20, weekN: 8 },
        { actualKm: 13, plannedKm: 18, weekN: 2 }, // 6-week gap → not a pattern
      ],
    })
    expect(result).toBeNull()
  })

  it('is suppressed inside the taper-protection window (protects the peak long run)', () => {
    const result = checkAdjustmentTriggers({
      ...baseInput(),
      currentWeekN: 12 - TAPER_PROTECTION_WEEKS + 1, // inside protection window
      recentLongRunAnalyses: [
        { actualKm: 14, plannedKm: 20, weekN: 9 },
        { actualKm: 13, plannedKm: 18, weekN: 8 },
      ],
    })
    expect(result).toBeNull()
  })
})

// RESHAPE-FIX-WAVE1 — defects 1 and 2 regression tests. These prove the
// engine's structural contracts hold: a malformed week is loud (Defect 1),
// and a make-up session is written into the freeDay slot (Defect 2).
describe('RESHAPE-FIX-WAVE1 — structural invariants', () => {
  it('throws when currentWeekSessions has fewer than 7 entries (Defect 1 contract)', () => {
    expect(() =>
      checkAdjustmentTriggers({
        ...baseInput(),
        currentWeekSessions: [longSession(20)], // legacy 1-entry shape
      }),
    ).toThrow(/7 entries/)
  })

  it('throws when a day slot is null (Defect 1 contract)', () => {
    const week = longRunWeek(20)
    ;(week as Array<Session | null>)[3] = null // thu vacant
    expect(() =>
      checkAdjustmentTriggers({
        ...baseInput(),
        currentWeekSessions: week as Session[],
      }),
    ).toThrow(/thu.*not a valid session/)
  })

  it('writes the make-up session INTO the freeDay slot, not appended (Defect 2)', () => {
    // Week: mon easy, tue rest, wed strength (skipped), thu rest (free slot),
    // fri easy, sat easy, sun long. User skipped wed strength with "Life got
    // busy" — engine should propose make-up at thu (the first free remaining
    // slot), landing in array index 3.
    const easy = (km: number): Session => ({
      type: 'easy', label: 'Easy run', detail: null, distance_km: km,
    })
    const strength = (): Session => ({
      type: 'strength', label: 'Mobility only', detail: null,
    })
    const week: Session[] = [
      easy(8),         // 0 mon
      restSession(),   // 1 tue
      strength(),      // 2 wed — this is what was skipped
      restSession(),   // 3 thu — this is the freeDay
      easy(6),         // 4 fri
      easy(5),         // 5 sat
      longSession(18), // 6 sun
    ]

    const result = checkAdjustmentTriggers({
      ...baseInput(),
      currentWeekSessions: week,
      skipSignal: {
        reason: 'Life got busy',
        sessionType: 'strength',
        sessionDay: 'wed',
        weekSessionsByDay: {
          mon: week[0], tue: week[1], wed: week[2], thu: week[3],
          fri: week[4], sat: week[5], sun: week[6],
        },
      },
    })

    expect(result).not.toBeNull()
    expect(result!.trigger.type).toBe('skip_with_reason')
    // Critical: the array stays length-7; the make-up replaces thu's rest.
    expect(result!.sessionsAfter).toHaveLength(7)
    expect(result!.sessionsAfter[3].type).toBe('strength')
    expect(result!.sessionsAfter[3].label).toMatch(/Make-up/)
    // Pre-fix bug would have appended at index 7 and left thu as rest.
    expect((result!.sessionsAfter as any)[7]).toBeUndefined()
    expect(result!.trigger.detail.freeDay).toBe('thu')
  })
})
