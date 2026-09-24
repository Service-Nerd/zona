/**
 * STRIDES-CHECKER-OWNER-01 — `INV-PLAN-STRIDES-PRESENT`'s exemption must be the
 * PRODUCER's predicate, not a hand-rolled copy of it.
 *
 * THE DEFECT. `strideCarrierDay()` offers strides only on a MIDWEEK easy run
 * (§28: "appends ... to one midweek easy run ... placed midweek, Wed
 * preferred" — Wed is the preference, midweek is the rule). The invariant's
 * exemption re-derived eligibility inline and omitted the midweek constraint,
 * so a Sunday easy run counted as an eligible carrier that §28 never offers:
 * the producer declined correctly and the checker faulted it for declining.
 *
 * THE TRIGGER IS AN INPUT AXIS NO CORPUS PAIRS CORRECTLY —
 * `preferred_long_run_day: 'sat'`. With the long run on Saturday, Sunday is the
 * only easy day left once the single available weekday becomes quality. With it
 * on Sunday, Saturday is the day before the long run and blocked for BOTH
 * sides, so the invariant is silent. Measured: 14,140 violation week-instances
 * across 2,040 plans (24.6%) on a targeted grid, at ERROR severity — while the
 * 14,253-plan property sweep stayed green, because every weekday-scarce day-set
 * it carries blocks Saturday and every Saturday-free set is weekday-rich.
 *
 * Case A reproduces the live plan `e49ea589` and is the fails-before test.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { strideCarrierDay } from './neuromuscular'
import { isLongRun } from './sessionRole'
import { normaliseDays } from './days'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

const PLAN_START = '2026-04-27'

/** The live shape: 3 days (Wed/Sat/Sun), long run SAT, 9-week 5K time target. */
const SAT_LONG_RUN = {
  athlete_name: 'Athlete', age: 35, race_name: 'Test', primary_metric: 'distance',
  plan_start: PLAN_START, race_distance_km: 5, race_date: '2026-06-27',
  goal: 'time_target', target_time: '0:25:00',
  resting_hr: 55, max_hr: 184, current_weekly_km: 30, longest_recent_run_km: 12,
  fitness_level: 'beginner', recent_quality_training: 'occasional',
  hard_session_relationship: 'neutral', injury_history: [],
  preferred_long_run_day: 'sat',
  days_available: 3, days_cannot_train: ['mon', 'tue', 'thu', 'fri'],
} as unknown as GeneratorInput

/** Identical but long run on SUNDAY — the shape every corpus already covers. */
const SUN_LONG_RUN = {
  ...SAT_LONG_RUN, preferred_long_run_day: 'sun',
} as unknown as GeneratorInput

describe('STRIDES-CHECKER-OWNER-01 — the checker shares the producer predicate', () => {
  it('does NOT raise INV-PLAN-STRIDES-PRESENT on a Saturday-long-run week the engine cannot serve', () => {
    const plan = generateRulePlan(SAT_LONG_RUN, 'paid', PLAN_START)
    const errs = validatePlan(plan, SAT_LONG_RUN)
      .filter(v => v.code === 'INV-PLAN-STRIDES-PRESENT')
    // Pre-fix this was 5 (weeks 4-8), severity error.
    expect(errs).toEqual([])
  })

  it('records a genuine gap as a warn instead of silencing it (§34)', () => {
    // ⚠️ THIS CASE USED `SAT_LONG_RUN` AND ASSERTED WEEKS [4..8] UNTIL 2026-09-24.
    // §28 Amendment 3 (S28-WEEKEND-CARRIER-01) then gave that shape a Sunday
    // carrier, so the warn correctly stopped firing on it and this assertion
    // went red. That is the gate working: it was pinning the DEFECT's shape, and
    // the board closed the defect. Re-anchored on a week that genuinely has no
    // carrier under Am.3 — a WEEKEND-ONLY runner whose long run is Sunday, so
    // Saturday is the day before it and Sunday IS it. Both of §28's absolute
    // placement rules bind; no fallback can reach a day that does not exist.
    // This is the 2-day case `neuromuscular.ts`'s header was written about.
    const weekendOnly = {
      ...SAT_LONG_RUN,
      goal: 'finish', target_time: undefined,
      current_weekly_km: 20, longest_recent_run_km: 8,
      preferred_long_run_day: 'sun',
      days_available: 2, days_cannot_train: ['mon', 'tue', 'wed', 'thu', 'fri'],
    } as unknown as GeneratorInput
    const plan = generateRulePlan(weekendOnly, 'paid', PLAN_START)
    const warns = validatePlan(plan, weekendOnly)
      .filter(v => v.code === 'INV-PLAN-STRIDES-NO-CARRIER')
    expect(warns.length).toBeGreaterThan(0)
    expect(warns.every(v => v.severity === 'warn')).toBe(true)
    // ...and it is a WARN, never an error: the engine is right to decline.
    expect(validatePlan(plan, weekendOnly)
      .filter(v => v.code === 'INV-PLAN-STRIDES-PRESENT')).toEqual([])
  })

  it('§28 Am.3 CLOSED the Saturday-long-run gap this file was written for', () => {
    const plan = generateRulePlan(SAT_LONG_RUN, 'paid', PLAN_START)
    expect(validatePlan(plan, SAT_LONG_RUN)
      .filter(v => v.code === 'INV-PLAN-STRIDES-NO-CARRIER')).toEqual([])
  })

  it('the exemption tracks strideCarrierDay exactly — no week is exempted that has a carrier', () => {
    for (const input of [SAT_LONG_RUN, SUN_LONG_RUN]) {
      const plan = generateRulePlan(input, 'paid', PLAN_START)
      const raceWeekN = Math.max(0, ...plan.weeks.map(w => w.n))
      const blocked = normaliseDays((input as never as { days_cannot_train: string[] }).days_cannot_train)
      const codes = validatePlan(plan, input)
      for (const w of plan.weeks) {
        if (w.n < GENERATION_CONFIG.STRIDES_FIRST_WEEK) continue
        if (w.type === 'deload' || w.n === raceWeekN) continue
        const entries = Object.entries(w.sessions).filter(([, s]) => !!s)
        const longDay = entries.find(([, s]) => isLongRun(s as never))?.[0]
        if (!longDay) continue
        const carrier = strideCarrierDay(w.sessions as never, longDay as never, blocked)
        const warned = codes.some(v => v.code === 'INV-PLAN-STRIDES-NO-CARRIER' && v.week === w.n)
        // A week is warned if and only if the PRODUCER says it has no carrier.
        if (warned) expect(carrier).toBeNull()
        if (carrier !== null) expect(warned).toBe(false)
      }
    }
  })

  it('FALSIFICATION — the error arm still fires when a carrier exists and is unused', () => {
    // ⚠️ A WEEKDAY-RICH RUNNER, DELIBERATELY. The first cut of this case reused
    // SUN_LONG_RUN and silently selected the RACE week — the only week in that
    // 3-day shape whose Wed is easy, and race week is exempt, so the assertion
    // failed for a fixture reason rather than a code one. The whole point of
    // this shape is that a genuine, non-exempt carrier exists to be stripped.
    const rich = {
      ...SUN_LONG_RUN, days_available: 5, days_cannot_train: ['tue', 'thu'],
    } as unknown as GeneratorInput
    const plan = generateRulePlan(rich, 'paid', PLAN_START)
    const raceWeekN = Math.max(0, ...plan.weeks.map(w => w.n))
    const target = plan.weeks.find(w =>
      w.n >= GENERATION_CONFIG.STRIDES_FIRST_WEEK && w.type !== 'deload'
      && w.n !== raceWeekN
      && Object.values(w.sessions).some(s => s && /strides/i.test(String(s.coach_notes ?? ''))))
    expect(target, 'fixture must contain a non-exempt week carrying strides').toBeTruthy()
    const before = validatePlan(plan, rich)
      .filter(v => v.code === 'INV-PLAN-STRIDES-PRESENT')
    expect(before).toEqual([])

    // Strip the note the engine placed — the enricher-drop shape (ENRICH-STRIDES-01).
    for (const s of Object.values(target!.sessions)) {
      if (!s) continue
      s.coach_notes = (s.coach_notes ?? []).filter(n => !/strides/i.test(String(n))) as never
    }
    const after = validatePlan(plan, rich)
      .filter(v => v.code === 'INV-PLAN-STRIDES-PRESENT')
    expect(after.length).toBe(1)
    expect(after[0].severity).toBe('error')
    expect(after[0].week).toBe(target!.n)
  })
})
