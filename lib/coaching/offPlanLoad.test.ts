// LOG-OFFPLAN-01 — the board's gate (Coaching Board 2026-09-27).
//
// This is the check that makes CLAUSE 2 true rather than promised. The ruling:
//
//   1. an off-plan run contributes to ACTUAL LOAD — always
//   2. it does NOT auto-trigger a reshape; it raises the observation, not the
//      adjustment
//
// Those two live in one function and are distinguished only by WHICH figure
// each trigger reads. Nothing about that is visible at a call site, so without
// this file a future edit that "tidies" `input.linkedKm` into a total would
// satisfy the type checker, pass every other suite, and silently make a
// runner's own easy run shrink their next week.
//
// ⚠️ NOT CLAUSE 3. Including off-plan volume in §2's injury cap was ruled
// CORRECT and is BLOCKED ON SAMPLE SIZE (n=21, 12 of them one runner). The cap
// still reads linked km. If you are here to wire clause 3, the board needs a
// re-measure first.

import { describe, it, expect } from 'vitest'
import { checkAdjustmentTriggers } from './planAdjustment'
import { computeWeeklyReportData } from './weeklyReport'
import { LOAD_RATIO, SHADOW_LOAD_THRESHOLD_PCT } from './constants'
import type { Session } from '@/types/plan'

const rest = (): Session => ({ type: 'rest', label: 'Rest', detail: null } as unknown as Session)
const long = (km: number): Session =>
  ({ type: 'long', label: 'Long run', detail: null, distance_km: km } as unknown as Session)
const week = (km: number): Session[] => [rest(), rest(), rest(), rest(), rest(), rest(), long(km)]

/** Steady 40 km weeks: ratio ~1.0, shadow ~0, every other trigger neutralised. */
const base = () => ({
  currentWeekN: 6,
  totalWeeks: 12,
  currentWeekSessions: week(20),
  linkedKm: 40,
  offPlanKm: 0,
  plannedKm: 40,
  priorWeeksKm: [40, 40, 40, 40],
  hrInZoneData: [],
  efTrendPct: null,
  adjustmentsThisWeek: 0,
  currentPhase: 'build' as const,
})

const report = () => ({
  weekN: 6,
  sessionsCompleted: 4,
  sessionsPlanned: 4,
  sessionsPlannedToDate: 4,
  linkedKm: 40,
  offPlanKm: 0,
  plannedKm: 40,
  plannedKmToDate: 40,
  priorWeeksKm: [40, 40, 40, 40],
  sessionFlagCounts: { green: 4, amber: 0, flag: 0 } as any,
  hrInZoneData: [],
  efTrendPct: null,
})

describe('CLAUSE 2 — an off-plan run raises the observation, not the adjustment', () => {
  it('🔴 off-plan volume does NOT move the acute:chronic ratio', () => {
    // 40 linked + 24 off-plan = 64 km. Against a 40 km chronic average that is
    // a ratio of 1.60 — far above LOAD_RATIO.flag (1.4) — if off-plan counted.
    const withOffPlan = computeWeeklyReportData({ ...report(), offPlanKm: 24 })
    expect(withOffPlan.acuteChronicRatio).toBeCloseTo(1.0, 5)
    expect(withOffPlan.acuteChronicRatio).toBeLessThan(LOAD_RATIO.watch)
  })

  it('🔴 an off-plan run cannot fire acute_chronic_high, which AUTO-TRIMS', () => {
    // buildReduceVolumeAdjustment only requiresConfirmation at LOAD_RATIO.flag,
    // so below that it applies silently. This is the specific harm clause 2 names.
    const r = checkAdjustmentTriggers({ ...base(), offPlanKm: 24 })
    expect(r?.trigger.type).not.toBe('acute_chronic_high')
  })

  it('🔴 and when it DOES surface, it changes no session', () => {
    const r = checkAdjustmentTriggers({ ...base(), offPlanKm: 24 })
    expect(r?.trigger.type).toBe('shadow_load')
    expect(r?.adjustmentType).toBe('flag_for_review')
    // The observation, not the adjustment: before and after must be identical.
    expect(r?.sessionsAfter).toEqual(r?.sessionsBefore)
  })

  it('LINKED volume still fires the ratio exactly as before — no behaviour lost', () => {
    const r = checkAdjustmentTriggers({ ...base(), linkedKm: 64 })
    expect(r?.trigger.type).toBe('acute_chronic_high')
  })
})

describe('CLAUSE 1 — actual load is what the runner ran', () => {
  it('🔴 the weekly report totals linked + off-plan', () => {
    expect(computeWeeklyReportData({ ...report(), offPlanKm: 12 }).totalKmActual).toBe(52)
  })

  it('🔴 off-plan volume DOES reach shadow load', () => {
    // 40 planned, 40 linked, 12 off-plan = 30% over. Above the 15% threshold.
    const r = checkAdjustmentTriggers({ ...base(), offPlanKm: 12 })
    expect(r?.trigger.type).toBe('shadow_load')
    expect((r?.trigger.detail as any).shadowPct).toBeGreaterThan(SHADOW_LOAD_THRESHOLD_PCT)
  })

  it('a week with no off-plan running is byte-identical to before the change', () => {
    // The migration must be a no-op for every runner who logs only what was
    // prescribed — which is how we know nothing else moved.
    const before = computeWeeklyReportData(report())
    expect(before.totalKmActual).toBe(40)
    expect(before.acuteChronicRatio).toBeCloseTo(1.0, 5)
    expect(checkAdjustmentTriggers(base())).toBeNull()
  })
})

/**
 * 🥇 FALSIFICATION — broken for real, not asserted.
 *
 * A. `acuteChronicRatio(input.linkedKm, …)` -> `(totalKm, …)` in planAdjustment
 *    → "cannot fire acute_chronic_high" RED, "changes no session" RED.
 * B. the same swap in weeklyReport
 *    → "does NOT move the acute:chronic ratio" RED (1.0 -> 1.6).
 * C. `shadowLoadPct(totalKm, …)` -> `(input.linkedKm, …)`
 *    → "off-plan volume DOES reach shadow load" RED, "changes no session" RED.
 * D. `totalKmActual: totalKm` -> `input.linkedKm`
 *    → "the weekly report totals linked + off-plan" RED.
 * E. Control: `offPlanKm` left at 0 everywhere — all arms GREEN, which is what
 *    shows these are keyed to the split and not to "any change here".
 */
