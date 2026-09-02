import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { getDistanceConfig } from './length'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * CoachingPrinciples §79 — user-selectable level binds ASYMMETRICALLY
 * (Coaching Board 2026-09-02).
 *
 *   UPWARD   declaration → intensity allowance only. Peak km, week-1 volume,
 *                          ramp and long-run caps stay on the assessment.
 *   DOWNWARD declaration → binds both.
 *
 * Regression origin: the shipped engine let a declaration set `fitness`, which
 * sets `peakKm`, which sets the week-1 volume floor via
 * BUILD_VOL_INIT_FLOOR_VS_PEAK. So a dropdown raised STARTING tonnage above the
 * runner's actual current volume. Measured before the fix, and used as the
 * fixtures below:
 *
 *   10K, 15 km/wk     accept → wk1 13, peak 18   declare experienced → wk1 20, peak 35
 *   M,   8 km/wk <6mo  accept → peak 42          declare experienced → peak 55
 *
 * The second case is the one that mattered: a true novice took a marathon peak
 * from 42 to 55 km straight through BEGINNER_WEEK1_VOLUME_CAP_KM, which caps the
 * declared START but not the peak-derived floor.
 *
 * (Those figures were measured on the pre-fix engine via `fitness_level`, the
 * field the wizard used to write to. The fixtures below assert the post-fix
 * behaviour of `user_declared_level` and so carry their own numbers.)
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

// 10K runner on 15 km/week. assessFitness reads `beginner` on volume
// (beginner_max_weekly_km = 20), so any declaration above that is UPWARD.
const TEN_K_LOW_VOLUME: GeneratorInput = {
  race_date: '2026-12-14', race_distance_km: 10, goal: 'finish',
  days_available: 4, age: 40,
  current_weekly_km: 15, longest_recent_run_km: 6,
  training_age: '6-18mo', preferred_long_run_day: 'sun',
}

/**
 * The novice-marathon case (8 km/wk, `<6mo`, peak 42 → 55 pre-fix) is covered by
 * the forged-plan invariant test below rather than by generating one here.
 *
 * Why: that input cannot produce a clean plan in `NODE_ENV=test` at any
 * days_available — it trips a KNOWN-OPEN baselined violation before this fix is
 * even reached (`INV-PLAN-LR-MAX-WEEKLY-PCT` at 4–5 days, `INV-PLAN-CATALOGUE-LINK`
 * at 6), and `generateRulePlan` throws on error-severity violations in test. Those
 * are the SWEEP-BASELINE-01 known-opens, unrelated to §79. Building the regression
 * guard on a fixture that throws for an unrelated reason would make it worthless.
 */

const peakOf   = (p: Plan) => Math.max(...p.weeks.map(w => w.weekly_km ?? 0))
const weekOneOf = (p: Plan) => p.weeks[0].weekly_km ?? 0

describe('§79 — an UPWARD declaration must not buy tonnage', () => {
  it('10K: week-1 volume is untouched by an upward declaration', () => {
    const accepted = generateRulePlan(TEN_K_LOW_VOLUME, 'paid', PLAN_START)
    const declared = generateRulePlan({ ...TEN_K_LOW_VOLUME, user_declared_level: 'experienced' }, 'paid', PLAN_START)

    // The sharpest edge of the defect: the peak-derived floor
    // (`Math.max(startKm, peakKm × BUILD_VOL_INIT_FLOOR_VS_PEAK)`) used to raise
    // STARTING tonnage above the runner's actual current volume. It must not move.
    expect(weekOneOf(declared)).toBe(weekOneOf(accepted))
  })

  it('10K: peak stays in the structural band, not the declared one', () => {
    const accepted = generateRulePlan(TEN_K_LOW_VOLUME, 'paid', PLAN_START)
    const declared = generateRulePlan({ ...TEN_K_LOW_VOLUME, user_declared_level: 'experienced' }, 'paid', PLAN_START)
    const band = getDistanceConfig(10).peakKmByLevel

    // NOT asserted as exact equality: a raised intensity allowance legitimately
    // changes quality-session COMPOSITION, which moves weekly totals by a km or
    // so. That is intensity, not tonnage. What must not happen is the peak being
    // rebuilt to the declared band.
    expect(peakOf(declared) - peakOf(accepted)).toBeLessThanOrEqual(2)
    expect(peakOf(declared)).toBeLessThan(band.intermediate)
    expect(peakOf(declared)).toBeLessThan(band.experienced)
  })

  it('the declaration IS recorded, and the intensity level rises with it', () => {
    const declared = generateRulePlan({ ...TEN_K_LOW_VOLUME, user_declared_level: 'experienced' }, 'paid', PLAN_START)
    expect(declared.meta.fitness_level_declared).toBe('experienced')
    // Structure stayed conservative...
    expect(declared.meta.fitness_level).toBe('beginner')
    // ...while intensity followed the runner's choice. This is the whole point:
    // agency raises intensity, never tonnage.
    expect(declared.meta.fitness_intensity_level).toBe('experienced')
  })

  it('an upward declaration passes INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE', () => {
    const input = { ...TEN_K_LOW_VOLUME, user_declared_level: 'experienced' as const }
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    const codes = validatePlan(plan, input).filter(v => v.severity === 'error').map(v => v.code)
    expect(codes).not.toContain('INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE')
  })

  it('the plan records the STRUCTURAL peak target, not the declared one', () => {
    const plan = generateRulePlan({ ...TEN_K_LOW_VOLUME, user_declared_level: 'experienced' }, 'paid', PLAN_START)
    const band = getDistanceConfig(10).peakKmByLevel
    expect(plan.meta.peak_km_target).toBe(band.beginner)
    expect(plan.meta.peak_km_target).not.toBe(band.experienced)
  })

  it('the invariant FIRES on a plan whose curve was built to the declared band', () => {
    // Hand-forge the pre-fix state: structural `beginner`, declared `experienced`,
    // volume curve built from the experienced peak target. The invariant must
    // catch it — this is the regression guard, so it has to fail on the old
    // behaviour.
    //
    // Forges `peak_km_target`, NOT delivered weekly_km. An earlier version of
    // this test forged weekly_km, which is why it passed while the invariant was
    // simultaneously raising 115 false violations elsewhere: delivered volume
    // legitimately exceeds the band, so a weekly_km-based check tests nothing
    // reliable in either direction.
    const input = { ...TEN_K_LOW_VOLUME, user_declared_level: 'experienced' as const }
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    const band = getDistanceConfig(10).peakKmByLevel
    const forged: Plan = {
      ...plan,
      meta: {
        ...plan.meta,
        fitness_level: 'beginner',
        fitness_level_declared: 'experienced',
        peak_km_target: band.experienced,
      },
    }
    const codes = validatePlan(forged, input).map(v => v.code)
    expect(codes).toContain('INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE')
  })

  it('does NOT fire merely because delivered volume exceeds the band', () => {
    // The false-positive class: ultra plans deliver a peak well above their band
    // (100km plan, 72km structural band, 108km delivered) with zero contribution
    // from any declaration. The invariant must be silent here.
    const ultra: GeneratorInput = {
      race_date: '2027-06-13', race_distance_km: 100, goal: 'finish',
      days_available: 4, age: 35,
      current_weekly_km: 40, longest_recent_run_km: 20,
      preferred_long_run_day: 'sun', fitness_level: 'beginner',
      user_declared_level: 'experienced',
    }
    const plan = generateRulePlan(ultra, 'paid', PLAN_START)
    const deliveredPeak = Math.max(...plan.weeks.map(w => w.weekly_km ?? 0))
    const band = getDistanceConfig(100).peakKmByLevel
    expect(deliveredPeak).toBeGreaterThan(band.beginner)   // the trap
    const codes = validatePlan(plan, ultra).map(v => v.code)
    expect(codes).not.toContain('INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE')
  })
})

describe('§79 — a DOWNWARD declaration is heard, on both axes', () => {
  // 10K runner comfortably `intermediate` on volume, declaring `beginner`.
  const SOLID: GeneratorInput = {
    race_date: '2026-12-14', race_distance_km: 10, goal: 'finish',
    days_available: 4, age: 40,
    current_weekly_km: 34, longest_recent_run_km: 14,
    training_age: '2-5yr', preferred_long_run_day: 'sun',
  }

  it('declaring `beginner` lowers the peak — caution binds structure', () => {
    const accepted = generateRulePlan(SOLID, 'paid', PLAN_START)
    const declared = generateRulePlan({ ...SOLID, user_declared_level: 'beginner' }, 'paid', PLAN_START)

    expect(declared.meta.fitness_level).toBe('beginner')
    expect(peakOf(declared)).toBeLessThan(peakOf(accepted))
  })

  it('a downward declaration is exempt from the upward-tonnage invariant', () => {
    const input = { ...SOLID, user_declared_level: 'beginner' as const }
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    const codes = validatePlan(plan, input).filter(v => v.severity === 'error').map(v => v.code)
    expect(codes).not.toContain('INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE')
  })
})

describe('§79-INTENSITY-ROUTING — quality selection + sizing follow the intensity level', () => {
  // A runner whose INTENSITY exceeds their STRUCTURAL level — the state the
  // asymmetric declaration above creates. The secondary quality slot used to
  // select at the structural level, where 0 of 14 quality rows are eligible
  // (`FITNESS_RANK[row.fitness_level_min] <= userRank`, and every quality row is
  // `fitness_level_min: 'intermediate'` or above). It therefore fell through to an
  // UNCATALOGUED session — ADR-018's no-rep-structure defect, where the runner is
  // shown a name and no reps.
  //
  // NOTE this does not add a session. `QUALITY_SESSIONS_PER_WEEK_MAX` is a
  // ceiling; the count comes from `plannedQuality`, which is 1 for every
  // non-`experienced` runner by design. Only the linkage and dose change.
  const LIFTED: GeneratorInput = {
    race_date: '2026-12-14', race_distance_km: 10, goal: 'time_target',
    target_time: '0:48:00', days_available: 5, age: 40,
    current_weekly_km: 15, longest_recent_run_km: 6,
    training_age: '6-18mo', preferred_long_run_day: 'sun',
    user_declared_level: 'experienced',
  }

  it('every placed quality session carries a catalogue_id (ADR-018)', () => {
    const plan = generateRulePlan(LIFTED, 'paid', PLAN_START)
    const uncatalogued: string[] = []
    for (const w of plan.weeks) {
      for (const s of Object.values(w.sessions)) {
        if (!s) continue
        if (!['quality', 'hard', 'intervals', 'tempo'].includes(s.type)) continue
        if (!s.catalogue_id) uncatalogued.push(`wk${w.n} ${s.label}`)
      }
    }
    expect(uncatalogued).toEqual([])
  })

  it('the structural level is beginner, so this is genuinely the lifted case', () => {
    const plan = generateRulePlan(LIFTED, 'paid', PLAN_START)
    expect(plan.meta.fitness_level).toBe('beginner')
    expect(plan.meta.fitness_intensity_level).toBe('experienced')
  })
})

describe('§79 — fitness_level (the API contract) is unchanged', () => {
  it('an explicit fitness_level still drives structure, as the matrix relies on', () => {
    const asBeginner = generateRulePlan({ ...TEN_K_LOW_VOLUME, fitness_level: 'beginner' }, 'paid', PLAN_START)
    const asExperienced = generateRulePlan({ ...TEN_K_LOW_VOLUME, fitness_level: 'experienced' }, 'paid', PLAN_START)
    // This is the API-level structural declaration — it MUST still move peak km,
    // or the archetype matrix and property sweep silently change meaning.
    expect(peakOf(asExperienced)).toBeGreaterThan(peakOf(asBeginner))
  })
})
