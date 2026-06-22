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

// A baseline input with all higher-priority triggers neutralised and guards open.
// Override per-test as needed.
const baseInput = () => ({
  currentWeekN: 6,
  totalWeeks: 12, // 6 weeks remaining > TAPER_PROTECTION_WEEKS → guards open
  currentWeekSessions: [longSession(20)],
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
