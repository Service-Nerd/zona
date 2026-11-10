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
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { isDesignedRefusal } from './designedRefusal'
import { auditPlanQuality } from './planQuality'
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

// 🔴 BINGE-WEEK-DELIVERED-01 (closed 2026-11-10, DON'T SHIP) — THE 2026-09-13 CLAIM ABOVE WAS
// RECORDED IN A COMMENT AND ASSERTED NOWHERE, SO IT WAS RE-DISCOVERED AS A DEFECT.
//
// The item was filed 2026-11-03 reporting `BINGE-WEEK` as newly visible at "0.1–1.4% per
// marathon band" with "`BINGE-SEVERE-75` did not appear". All three figures were artefacts of
// reading ONE register:
//   · `cohortReviewBaseline.json` holds WEIGHTED BAND shares; `audit:plans` reports **10.1% of
//     generated** and `BINGE-SEVERE-75` at **0.4%**. The code does appear.
//   · `BINGE-SEVERE-75` has its own committed incident (`BINGE-BUCKET-CROSS-01`, baseline 20),
//     so "did not appear" was falsifiable from a test file in the repo.
//   · Re-measured here: **1,389 flagged plans, every one `volume_profile: 'maintenance'`, the
//     §52 invariant at WARN on all 1,389 and ERROR on none** — precisely the population §52
//     Amendment 1 ruled on, with its worst case (26.0 km in a 34 km week, 76%) already written
//     into the comment at the top of this file and into the invariant's own.
//
// ⚠️ AND THE FIX I ALMOST PROPOSED WAS THE ONE THIS AMENDMENT REVERSED. `planQuality` counts
// these as coach OBJECTIONS, and it has a `watched: true` mechanism for "exempted-but-counted"
// quantities. Marking BINGE watched would have raised the fit-for-purpose rate by re-exempting,
// in the measurement layer, exactly what the board un-exempted in the invariant layer — citing
// the board's ruling as the warrant. **§52 Am. 1 did not exempt; it DOWNGRADED.** A coach would
// object to a 78% week, which is the point, so the objection stands and the rate stays honest.
//
// THIS ARM IS WHAT THE ITEM SHOULD HAVE BEEN ABLE TO READ. It fires if a BUILD plan ever
// carries a binge week, which WOULD be a real defect: the invariant is error-severity there,
// and the "declared debt" reading of every BINGE finding depends entirely on this holding.
describe('§52 Amendment 1 — the declared residual is maintenance-only, on real generated plans', () => {
  // ⚠️ LAZY, NOT DESCRIBE-BODY SCOPE. A corpus built in the describe body runs at IMPORT time,
  // where `check:slow`'s rules cannot see it — measured here as `import 5.66s / tests 171ms`
  // before this was memoised. Code review found the identical defect in
  // `noteLeverInjuryCap.test.ts` the same morning; I then wrote it again, which is why it is
  // called out rather than quietly fixed.
  // ⚠️ And the loop is indexed, not `.entries()`: that spread-iterator form fails `tsc` here
  // (TS2802, the `[...Set]` gotcha in CLAUDE.md).
  interface Flagged { plan: Plan; input: GeneratorInput; severe: boolean }
  let memo: { generated: number; flagged: Flagged[] } | null = null
  const corpus = () => (memo ??= (() => {
    const grid = cohortGrid() as GeneratorInput[]
    const flagged: Flagged[] = []
    let generated = 0
    for (let i = 0; i < grid.length; i += 23) {
      const g = grid[i]!
      let plan: Plan
      try { plan = generateRulePlan(g, 'paid', COHORT_PLAN_START) as Plan }
      catch (e) { if (!isDesignedRefusal(e)) throw e; continue }
      generated++
      const f = auditPlanQuality(plan, g).find(x => x.code === 'BINGE-WEEK' || x.code === 'BINGE-SEVERE-75')
      if (f) flagged.push({ plan, input: g, severe: f.code === 'BINGE-SEVERE-75' })
    }
    return { generated, flagged }
  })())

  it('the population is real — an empty one would pass every arm below vacuously', () => {
    const { generated, flagged } = corpus()
    expect(generated, 'nothing generated — re-point this corpus').toBeGreaterThan(1_000)
    expect(flagged.length, 'no plan carries a binge week; the §52 residual is gone or unreachable')
      .toBeGreaterThan(80)
    // Measured 2026-11-10 at this stride: ~10% of generated plans, a handful of them severe.
    expect(flagged.filter(f => f.severe).length, 'BINGE-SEVERE-75 is unreachable here').toBeGreaterThan(0)
  })

  it('🔴 EVERY flagged plan is maintenance — a BUILD plan binging is a real defect, not debt', () => {
    const build = corpus().flagged.filter(f => f.plan.meta.volume_profile !== 'maintenance')
    expect(build.map(f => `${f.input.race_distance_km}km/${f.input.current_weekly_km}/${f.input.days_available}d`),
      'a non-maintenance plan carries a binge week: §52 Am. 1 is error-severity there, so this is a defect')
      .toEqual([])
  })

  it('…and the invariant agrees with the audit: WARN on all of them, ERROR on none', () => {
    // The two registers must say the same thing about the same plan, or one of them is wrong.
    const { flagged } = corpus()
    let warn = 0
    for (const f of flagged) {
      const v = validatePlan(f.plan, f.input).filter(x => x.code === 'INV-PLAN-LR-MAX-WEEKLY-PCT')
      expect(v.filter(x => x.severity === 'error'), `error-severity §52 breach on a flagged plan`).toEqual([])
      if (v.length) warn++
    }
    expect(warn, 'the audit flags plans the invariant does not see at all').toBe(flagged.length)
  })
})
