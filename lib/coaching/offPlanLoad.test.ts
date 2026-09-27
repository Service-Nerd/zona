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
import { bucketLoadByPlanWeek } from './weeklyActualLoad'
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

describe('COMPOSED — real activity rows through the owner into the triggers', () => {
  // ⚠️ /ship pre-ship gate box 3. The arms above feed `linkedKm`/`offPlanKm` in
  // by hand, which proves the TRIGGERS branch correctly and proves nothing about
  // whether the OWNER produces those numbers from rows. Each subsystem being
  // right in isolation does not make the composition right — that is how the
  // shakeout invariant silently reverted enriched plans for months.
  const plan = { weeks: [
    { n: 5, date: '2026-09-07' }, { n: 6, date: '2026-09-14' },
  ] } as any

  const act = (date: string, km: number, id: string) => ({
    start_date: `${date}T09:00:00.000Z`, distance_m: km * 1000,
    activity_type: 'Run', sport_type: 'Run',
    strava_activity_id: null, apple_health_uuid: id,
  })

  it('🔴 an unmatched row flows through as off-plan and reaches shadow load ONLY', () => {
    const rows = [
      act('2026-09-15', 40, 'linked-1'),   // prescribed, matched
      act('2026-09-17', 24, 'nobody-saw'), // off-plan
    ]
    const load = bucketLoadByPlanWeek(plan, rows, new Set(['h:linked-1']))
    const w6 = load.get(6)!
    expect(w6).toEqual({ linkedKm: 40, offPlanKm: 24, totalKm: 64 })

    const r = checkAdjustmentTriggers({
      ...base(), linkedKm: w6.linkedKm, offPlanKm: w6.offPlanKm,
    })
    // 64 vs a 40 km chronic average would be 1.60 — above flag — if it counted.
    expect(r?.trigger.type).toBe('shadow_load')
    expect(r?.sessionsAfter).toEqual(r?.sessionsBefore)
  })

  it('🔴 a MANUALLY logged prescribed run is linked, not off-plan', () => {
    // A manual log writes `session_completions` and never reaches `run_analysis`
    // — production carries 207 such rows. If linkedKeys were built from
    // run_analysis alone this run would read as off-plan and inflate shadow load.
    const rows = [act('2026-09-15', 40, 'manual-1')]
    const load = bucketLoadByPlanWeek(plan, rows, new Set(['h:manual-1']))
    expect(load.get(6)).toEqual({ linkedKm: 40, offPlanKm: 0, totalKm: 40 })
    expect(checkAdjustmentTriggers({ ...base(), linkedKm: 40, offPlanKm: 0 })).toBeNull()
  })

  it('🔴 backfill + duplicates together cannot manufacture a phantom adjustment', () => {
    // The two real contaminations at once: a pre-plan run and a double ingest.
    // Naively summed these are 30 + 40 + 40 = 110 km and every trigger fires.
    const rows = [
      act('2026-08-01', 30, 'backfill'),                       // predates the plan
      act('2026-09-15', 40, 'dup-a'),                          // linked
      { ...act('2026-09-15', 40, 'dup-b'), start_date: '2026-09-15T09:05:00.000Z' },
    ]
    const load = bucketLoadByPlanWeek(plan, rows, new Set(['h:dup-a']))
    expect(load.get(6)).toEqual({ linkedKm: 40, offPlanKm: 0, totalKm: 40 })
    expect(load.has(5)).toBe(false)
    expect(checkAdjustmentTriggers({ ...base(), linkedKm: 40, offPlanKm: 0 })).toBeNull()
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
 * F. COMPOSED: `linkedKeys` built from run_analysis only (dropping the
 *    session_completions half) → "a MANUALLY logged prescribed run is linked" RED.
 *    Verified by passing an empty linkedKeys set — 1 failed.
 * G. COMPOSED: the pre-plan guard removed → "backfill + duplicates together" RED
 *    (week 5 gains 30 km). Same mutation as F4 on the owner.
 * E. Control: `offPlanKm` left at 0 everywhere — all arms GREEN, which is what
 *    shows these are keyed to the split and not to "any change here".
 */
