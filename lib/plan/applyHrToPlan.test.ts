/**
 * PLAN-ZONE-VS-HRTARGET-01 — when a runner's HR changes, the plan comes with it.
 *
 * 🔴 THE DEFECT, ON A REAL PLAN. `e49ea589` was generated with max_hr 198 and
 * the runner later corrected it to 203. `DashboardClient` updated `plan.meta`
 * and left every session's `hr_target` on the old band, so the session-detail
 * HEADER (which derives bpm from `session.zone` + meta) read
 * **"Zone 3 · 161–175 bpm"** above a coach note reading **"158–171 bpm"**.
 * Measured on **6 of 22 live plans**, every quality session of each.
 *
 * ⚠️ Three copies of one truth — `user_settings`, `plan.meta`,
 * `session.hr_target` — and the two writers updated different pairs. Nothing
 * wrote the third.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { applyHrToPlan, computeZones } from './zones'
import { isShakeout } from './sessionRole'
import type { GeneratorInput } from '@/types/plan'

const PLAN_START = '2026-04-27'

/** The live shape: the runner from e49ea589, at his ORIGINAL HR values. */
const AT_GENERATION = {
  athlete_name: 'Athlete', age: 26, race_name: 'Test', primary_metric: 'distance',
  plan_start: PLAN_START, race_distance_km: 5, race_date: '2026-06-27',
  goal: 'time_target', target_time: '0:25:00',
  resting_hr: 63, max_hr: 198, current_weekly_km: 30, longest_recent_run_km: 12,
  fitness_level: 'beginner', recent_quality_training: 'occasional',
  hard_session_relationship: 'neutral', injury_history: ['plantar fasciitis'],
  days_available: 3, days_cannot_train: ['mon', 'tue', 'thu', 'fri'],
} as unknown as GeneratorInput

const CORRECTED = { rhr: 63, mhr: 203 }
const dz = <T extends { code: string }>(v: T[]) => v.filter(x => x.code === 'INV-PLAN-DISPLAY-ZONE-MATCHES-WORK')

describe('PLAN-ZONE-VS-HRTARGET-01 — an HR correction reaches the sessions', () => {
  it('REPRODUCES THE BUG: a meta-only update leaves the sessions on the old band', () => {
    const plan = generateRulePlan(AT_GENERATION, 'paid', PLAN_START)
    expect(dz(validatePlan(plan, AT_GENERATION))).toEqual([])   // correct at generation

    // Exactly what DashboardClient.tsx:2654 did — meta, and nothing else.
    const metaOnly = {
      ...plan,
      meta: { ...plan.meta, resting_hr: CORRECTED.rhr, max_hr: CORRECTED.mhr,
              zone2_ceiling: Math.round(CORRECTED.rhr + 0.70 * (CORRECTED.mhr - CORRECTED.rhr)) },
    }
    const after = dz(validatePlan(metaOnly as never, { ...AT_GENERATION, ...{ resting_hr: CORRECTED.rhr, max_hr: CORRECTED.mhr } } as never))
    expect(after.length).toBeGreaterThan(0)
    expect(after[0].actual).toMatch(/zone Zone 3 = \d+–\d+ bpm vs hr_target/)
  })

  it('applyHrToPlan closes it — zone and hr_target agree again', () => {
    const plan = generateRulePlan(AT_GENERATION, 'paid', PLAN_START)
    const fixed = applyHrToPlan(plan as never, CORRECTED.rhr, CORRECTED.mhr)
    const input = { ...AT_GENERATION, resting_hr: CORRECTED.rhr, max_hr: CORRECTED.mhr } as never
    expect(dz(validatePlan(fixed as never, input))).toEqual([])
  })

  it('writes the NEW band, not merely a consistent one', () => {
    // A fix that set both fields to the OLD value would also pass the invariant.
    // This pins the actual numbers the runner should now be training at.
    const z = computeZones(CORRECTED.mhr, CORRECTED.rhr)
    const plan = generateRulePlan(AT_GENERATION, 'paid', PLAN_START)
    const fixed = applyHrToPlan(plan as never, CORRECTED.rhr, CORRECTED.mhr) as never as typeof plan
    const quality = fixed.weeks.flatMap(w => Object.values(w.sessions)).filter(s => s?.type === 'quality')
    expect(quality.length).toBeGreaterThan(0)
    for (const s of quality) expect(s!.hr_target).toBe(z.qualityHR)
    expect(fixed.meta.zone2_ceiling).toBe(z.zone2Ceiling)
  })

  it('a SHAKEOUT keeps its Z1 ceiling — decided by role, never by label (D-17)', () => {
    const z = computeZones(CORRECTED.mhr, CORRECTED.rhr)
    const plan = generateRulePlan(AT_GENERATION, 'paid', PLAN_START)
    const fixed = applyHrToPlan(plan as never, CORRECTED.rhr, CORRECTED.mhr) as never as typeof plan
    const shakeouts = fixed.weeks.flatMap(w => Object.values(w.sessions)).filter(s => s && isShakeout(s))
    expect(shakeouts.length, 'fixture must contain a race-week shakeout').toBeGreaterThan(0)
    for (const s of shakeouts) expect(s!.hr_target).toBe(z.shakeoutHR)
    expect(z.shakeoutHR).not.toBe(z.easyHR)   // the two ceilings genuinely differ
  })

  it('touches ONLY the HR fields — distance, duration, day and week survive', () => {
    // week_n/day are cross-table keys (PLAN-WEEK-COLLISION-01). If this pass moved
    // them, completions and run links would silently point at the wrong sessions.
    const plan = generateRulePlan(AT_GENERATION, 'paid', PLAN_START)
    const before = JSON.parse(JSON.stringify(plan))
    const fixed = applyHrToPlan(plan as never, CORRECTED.rhr, CORRECTED.mhr) as never as typeof plan
    expect(fixed.weeks.length).toBe(before.weeks.length)
    fixed.weeks.forEach((w, i) => {
      expect(w.n).toBe(before.weeks[i].n)
      for (const [day, s] of Object.entries(w.sessions)) {
        const b = before.weeks[i].sessions[day]
        if (!s || !b) { expect(!!s).toBe(!!b); continue }
        expect(s.distance_km).toBe(b.distance_km)
        expect(s.duration_mins).toBe(b.duration_mins)
        expect(s.label).toBe(b.label)
        expect(s.coach_notes).toEqual(b.coach_notes)
      }
    })
  })

  it('is a no-op on junk input rather than corrupting a plan', () => {
    const plan = generateRulePlan(AT_GENERATION, 'paid', PLAN_START)
    for (const [rhr, mhr] of [[NaN, 203], [63, NaN], [63, 0], [63, -5]] as const) {
      expect(applyHrToPlan(plan as never, rhr, mhr)).toBe(plan)
    }
  })
})
