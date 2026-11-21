import { describe, it, expect, vi, afterEach } from 'vitest'
import { runAdjustmentEngine, buildAdjustmentSignals } from './adjustmentEngine'
import { computeTaperRecalibration } from '@/lib/plan/taperRecalibration'
import { GENERATION_CONFIG, raceDistanceKey } from '@/lib/plan/generationConfig'
import {
  findWeekByN, getCurrentWeekIndex, getCurrentWeekN, getCurrentWeekOrdinal, lastWeekN, weekIndexOfN, weekNAt,
} from '@/lib/plan/weekResolution'
import type { Plan } from '@/types/plan'

/**
 * ADJUST-WEEK-COORD-01 — on a plan with foundation weeks, the week an adjustment READS and the
 * week it WRITES must be the same week, and it must be the runner's.
 *
 * Production, 2026-11-21: 7 of 43 live plans carry `week.n != position`; all 4 adjustments on
 * them were written three weeks after the runner's week. The fixture is that shape: four
 * foundation weeks (n = -3..0) prepended to a twelve-week race block (n = 1..12).
 *
 * ⚠️ SYNTHETIC and breaches many principles (flat curve, no deload); these arms are about WHICH
 * week, never about the prescription. Each week's easy distance encodes its `n`, so a read or
 * write on the wrong week is visible in the numbers.
 */
const MON0 = Date.UTC(2026, 10, 2)               // Mon 2026-11-02, the first foundation week
const easyKm = (n: number) => 5 + (n + 4) / 2    // distinct per week

const week = (n: number, idx: number) => ({
  n,
  date: new Date(MON0 + idx * 6048e5).toISOString().slice(0, 10),
  weekly_km: 20 + n + 4,
  phase: n <= 0 ? 'foundation' : n >= 10 ? 'taper' : 'build',
  type: n === 12 ? 'race' : 'normal',
  sessions: {
    tue: { type: 'easy', label: `Easy run w${n}`, detail: null, distance_km: easyKm(n), hr_target: '<145' },
    thu: { type: 'easy', label: `Easy run w${n}`, detail: null, distance_km: easyKm(n), hr_target: '<145' },
    sat: { type: 'easy', label: `Easy run w${n}`, detail: null, distance_km: easyKm(n), hr_target: '<145' },
    sun: { type: 'long', label: `Long run w${n}`, detail: null, distance_km: 14 + n },
  },
})

const NS = [-3, -2, -1, 0, ...Array.from({ length: 12 }, (_, i) => i + 1)]
const foundationPlan = (): Plan => ({
  meta: {
    race_date: '2027-02-21', race_distance_km: 21.1, goal: 'finish',
    days_available: 4, age: 38, fitness_level: 'intermediate',
  },
  weeks: NS.map((n, idx) => week(n, idx)),
}) as unknown as Plan

/** The same twelve race weeks with no foundation block: n == position + 1 everywhere. */
const unshiftedPlan = (): Plan => ({
  ...foundationPlan(),
  weeks: Array.from({ length: 12 }, (_, i) => week(i + 1, i)),
}) as unknown as Plan

const drift = (weekN: number) => [
  { week_n: weekN, session_day: 'tue', hr_in_zone_pct: 40, hr_above_ceiling_pct: 60, ef_trend_pct: null,
    actual_load_km: 8, planned_load_km: 8, actual_load_mins: 48, planned_load_mins: 48, pace_score: null, distance_score: null },
  { week_n: weekN, session_day: 'thu', hr_in_zone_pct: 40, hr_above_ceiling_pct: 60, ef_trend_pct: null,
    actual_load_km: 8, planned_load_km: 8, actual_load_mins: 48, planned_load_mins: 48, pace_score: null, distance_score: null },
]

const req = (plan: Plan, weekN: number) => ({
  plan, weekN, isManual: false, adjustmentsThisWeek: 0,
  analyses: drift(weekN) as never, completions: [], weeklyLoad: new Map(),
  now: '2026-12-08T00:00:00.000Z',
})

afterEach(() => { vi.useRealTimers() })

describe('ADJUST-WEEK-COORD-01 — the owner', () => {
  it('the current week KEY is week.n, the ordinal is the position', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-12-09T12:00:00'))   // index 5, n = 2
    const p = foundationPlan()
    expect(getCurrentWeekIndex(p.weeks)).toBe(5)
    expect(getCurrentWeekN(p.weeks), 'the key is the position again').toBe(2)
    expect(getCurrentWeekOrdinal(p.weeks)).toBe(6)
    // The missed-session prompt's expression (DashboardClient): weekNAt(weeks, wIdx).
    expect(weekNAt(p.weeks, getCurrentWeekIndex(p.weeks))).toBe(2)
    expect(lastWeekN(p.weeks)).toBe(12)
  })

  it('findWeekByN never resolves a key no week carries to whatever sits at that position', () => {
    const p = foundationPlan()
    expect(findWeekByN(p.weeks, -3)).toBe(p.weeks[0])
    expect(findWeekByN(p.weeks, 2)).toBe(p.weeks[5])
    expect(findWeekByN(p.weeks, 13), 'position 13 exists (n = 9); key 13 does not').toBeUndefined()
    expect(weekIndexOfN(p.weeks, 13)).toBe(-1)
    const legacy = [{ date: 'a' }, { date: 'b' }] as unknown as Plan['weeks']
    expect(findWeekByN(legacy, 2), 'legacy pre-n plans keep the positional fallback').toBe(legacy[1])
  })
})

describe('ADJUST-WEEK-COORD-01 — the adjustment reads and writes the SAME week', () => {
  it('🔴 a zone-drift adjustment on n = 2 reads n = 2 and changes n = 2 only', () => {
    const plan = foundationPlan()
    const out = runAdjustmentEngine(req(plan, 2))
    expect(out.kind).toBe('adjustment')
    if (out.kind !== 'adjustment') return
    expect(out.proposed.trigger?.type).toBe('zone_drift')
    // READ: the sessions the engine proposed to change are week n = 2's.
    const tue = out.proposed.sessionsBefore[1]!
    expect(tue.distance_km, 'the signals read a different week than n = 2').toBe(easyKm(2))
    // WRITE: exactly one week differs, and it is n = 2.
    const changed = out.updatedPlan.weeks
      .filter((w, i) => JSON.stringify(w) !== JSON.stringify(plan.weeks[i]))
      .map(w => w.n)
    expect(changed, 'the write landed on a different week than the read').toEqual([2])
  })

  it('taper protection holds in the last three weeks of a shifted plan', () => {
    // n = 9 is a build week with three weeks after it (10, 11, 12). TAPER_PROTECTION_WEEKS = 3.
    // With `totalWeeks = weeks.length` (16) the engine saw seven weeks left and fired.
    const out = runAdjustmentEngine(req(foundationPlan(), 9))
    expect(out.kind, 'an automatic adjustment fired inside taper protection').toBe('none')
    expect(buildAdjustmentSignals(req(foundationPlan(), 9)).totalWeeks).toBe(12)
  })

  it('the fitness gate still counts weeks TRAINED, so the fix moves no gate timing', () => {
    // n = 2 is the sixth week the runner has trained. `FITNESS_SIGNAL_MIN_PLAN_WEEKS` reads this,
    // and with `currentWeekN` alone it would have opened four weeks later on this plan.
    expect(buildAdjustmentSignals(req(foundationPlan(), 2)).weeksIntoPlan).toBe(6)
    expect(buildAdjustmentSignals(req(unshiftedPlan(), 3)).weeksIntoPlan).toBe(3)
  })

  it('no prescription change on an unshifted plan: n == position gives the same week and output', () => {
    const plan = unshiftedPlan()
    const out = runAdjustmentEngine(req(plan, 3))
    expect(out.kind).toBe('adjustment')
    if (out.kind !== 'adjustment') return
    expect(out.proposed.sessionsBefore[1]!.distance_km).toBe(easyKm(3))
    expect(out.updatedPlan.weeks.findIndex((w, i) => JSON.stringify(w) !== JSON.stringify(plan.weeks[i]))).toBe(2)
    expect(buildAdjustmentSignals(req(plan, 3)).totalWeeks).toBe(plan.weeks.length)
  })
})

describe('ADJUST-WEEK-COORD-01 — taper recalibration fires at, and rewrites, the right weeks', () => {
  const actuals = () => new Map(Array.from({ length: 6 }, (_, i) => [i + 3, 12] as [number, number]))

  it('🔴 on a shifted plan it fires at n = 10 and anchors on n = 9', () => {
    const plan = foundationPlan()
    const r = computeTaperRecalibration({ weeklyActuals: actuals(), plan, currentWeekN: 10 })
    expect(r.applied, r.skipReason).toBe(true)
    expect(r.plannedPreTaperKm, 'the pre-taper anchor was read from a foundation-shifted position')
      .toBe(findWeekByN(plan.weeks, 9)!.weekly_km)
    expect(r.weeksModified, 'reported as positions, or the race week was touched').toEqual([10, 11])
    const distKey = raceDistanceKey(21.1)
    const steps = Math.max(1, GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[distKey].length - 1)
    const pct = GENERATION_CONFIG.TAPER_BY_DISTANCE[distKey].volume_reduction_pct / steps
    expect(findWeekByN(r.plan!.weeks, 10)!.weekly_km, 'first taper week reduced by the wrong step')
      .toBe(Math.round((r.functionalPeakKm as number) * (1 - pct / 100)))
  })

  it('does not fire at the old position coordinate (getCurrentWeekIndex + 1 = 14 at n = 10)', () => {
    const r = computeTaperRecalibration({ weeklyActuals: actuals(), plan: foundationPlan(), currentWeekN: 14 })
    expect(r.applied).toBe(false)
  })

  it('unshifted plan: identical anchor and weeks to the position coordinate', () => {
    const plan = unshiftedPlan()
    const r = computeTaperRecalibration({ weeklyActuals: actuals(), plan, currentWeekN: 10 })
    expect(r.applied, r.skipReason).toBe(true)
    expect(r.plannedPreTaperKm).toBe(plan.weeks[8]!.weekly_km)
    expect(r.weeksModified).toEqual([10, 11])
  })
})
