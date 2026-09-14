// §52 Amendment 1 — a safety cap is never exempted, only downgraded.
//
// THE DEFECT. `INV-PLAN-LR-MAX-WEEKLY-PCT` opened
// `if (plan.meta.volume_profile !== 'maintenance')`, justified as "the
// constraint is already surfaced in volume_constraint_note". That note explains
// why TOTAL volume is low; it says nothing about LOPSIDEDNESS. A safety check
// was switched off because something else was believed to report it, and that
// something else does not report it.
//
// 51% of the cohort classifies maintenance, so the cap went unchecked on half of
// all plans. Measured 2026-09-13 with the exemption removed: 268 of 6,588 weeks
// breach — EVERY ONE in a maintenance plan, NONE in a build plan. 60 of 314
// maintenance plans carry at least one. Worst: a BEGINNER marathon plan with a
// 26.0 km long run in a 34 km week, 76% of the week's running in one session.
//
// Willy: the tissue does not care that the plan is labelled maintenance, and one
// session carrying three-quarters of the load is MORE dangerous at low volume.
import { describe, it, expect } from 'vitest'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

const CAP = GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY

/** A week whose long run is `lrKm` of `weeklyKm` — the lopsidedness under test. */
function planWith(lrKm: number, weeklyKm: number, profile: 'build' | 'maintenance'): Plan {
  return {
    meta: {
      race_distance_km: 42.2, volume_profile: profile,
      max_hr: 180, resting_hr: 55, plan_start: '2026-09-14',
      ...(profile === 'maintenance' ? { volume_constraint_note: 'Peak weekly volume is below the floor.' } : {}),
    },
    weeks: [{
      n: 5, phase: 'build', weekly_km: weeklyKm, type: 'normal',
      sessions: {
        sun: {
          id: 'w5-sun', type: 'easy', label: 'Long run — Zone 2', detail: null,
          distance_km: lrKm, duration_mins: Math.round(lrKm * 7), primary_metric: 'distance',
          zone: 'Zone 2', hr_target: '< 148 bpm', rpe_target: 4, role: 'long_run',
        },
        wed: {
          id: 'w5-wed', type: 'easy', label: 'Easy run — Zone 2', detail: null,
          distance_km: Math.max(1, weeklyKm - lrKm), duration_mins: 40, primary_metric: 'distance',
          zone: 'Zone 2', hr_target: '< 148 bpm', rpe_target: 4,
        },
      },
    }],
  } as unknown as Plan
}

const input = { race_distance_km: 42.2, goal: 'finish', days_available: 4 } as unknown as GeneratorInput
const lopsided = (p: Plan) => validatePlan(p, input).filter(v => v.code === 'INV-PLAN-LR-MAX-WEEKLY-PCT')

describe('§52 Amendment 1 — the cap is evaluated on EVERY plan', () => {
  it('a maintenance plan is no longer SILENT about a lopsided week', () => {
    // The defect, stated as the founder's own case: a beginner marathon plan
    // with 26 km of a 34 km week in one session. Previously: nothing at all.
    const v = lopsided(planWith(26, 34, 'maintenance'))
    expect(v.length, '76% of the week in one run must be reported').toBeGreaterThan(0)
  })

  it('…but as a WARN, so the plan still generates', () => {
    // Hard-erroring would stop 60 plans generating, and the runner's volume
    // constraint is real — they cannot simply be told to run more. §34's
    // honest-residual pattern: visible, counted, declared.
    const v = lopsided(planWith(26, 34, 'maintenance'))
    expect(v.every(x => x.severity === 'warn')).toBe(true)
  })

  it('a BUILD plan still errors — the standard did not weaken', () => {
    const v = lopsided(planWith(26, 34, 'build'))
    expect(v.length).toBeGreaterThan(0)
    expect(v.every(x => x.severity === 'error')).toBe(true)
  })

  it('a balanced week is clean in both profiles', () => {
    // 17 of 40 is 42%, comfortably inside the cap. Guards against the amendment
    // turning into a blanket warn that fires on healthy plans too.
    for (const profile of ['build', 'maintenance'] as const) {
      expect(lopsided(planWith(17, 40, profile)), profile).toEqual([])
    }
  })

  it('the reported figure is the real fraction, not a rounded band', () => {
    const v = lopsided(planWith(26, 34, 'maintenance'))
    expect(String(v[0].actual)).toMatch(/7[0-9]%/)
    expect(String(v[0].expected)).toContain(String(CAP))
  })

  it('sits exactly on the cap without firing', () => {
    // 60% of 40 is 24.0. The check allows a small epsilon, so the boundary case
    // must not produce a warn on every plan that lands precisely on the rule.
    expect(lopsided(planWith(24, 40, 'maintenance'))).toEqual([])
  })
})
