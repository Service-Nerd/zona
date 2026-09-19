/**
 * CB-BEGINNER-CATALOGUE-01 / §110 Am.2 / §110b — a beginner who set a TIME
 * TARGET gets one quality session a week, from rows they are eligible for.
 *
 * ⚠️ WHAT THIS DOES NOT PROVE: nothing here shows the resulting plans are GOOD.
 * It asserts the mechanism — the slot opens for the right cohort only, the rows
 * are reachable, the scope field does not leak, and the finish-goal beginner is
 * untouched. Whether the prescription works is `measure:fitness` and
 * `audit:plans`, run separately.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { qualityCeilingFor } from './qualityCeiling'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Session } from '@/types/plan'

const BEGINNER = {
  athlete_name: 'A', age: 35, race_name: 'T', primary_metric: 'distance',
  plan_start: '2026-04-27', race_date: '2026-10-24',
  resting_hr: 55, max_hr: 184,
  current_weekly_km: 30, longest_recent_run_km: 14, fitness_level: 'beginner',
  recent_quality_training: 'occasional', hard_session_relationship: 'neutral',
  injury_history: [], days_available: 5,
} as unknown as GeneratorInput

// A realistic target per distance. A single '4:30:00' across all four makes a
// 4h30 half marathon, whose goal pace is slow enough that the quality session
// lands under §9's minimum session size — an artefact of the fixture, not of
// anything under test.
const TARGET: Record<number, string> = {
  5: '0:32:00', 10: '1:05:00', 21.1: '2:20:00', 42.2: '4:30:00',
}
const timeTarget = (km: number) =>
  ({ ...BEGINNER, race_distance_km: km, goal: 'time_target', target_time: TARGET[km] }) as unknown as GeneratorInput
const finishGoal = (km: number) =>
  ({ ...BEGINNER, race_distance_km: km, goal: 'finish' }) as unknown as GeneratorInput

const qualityOf = (plan: { weeks: { n: number; sessions: Record<string, Session | undefined> }[] }) =>
  plan.weeks.filter(w => w.n >= 1)
    .flatMap(w => Object.values(w.sessions ?? {}).filter(Boolean) as Session[])
    .filter(s => s.type === 'quality')

describe('§110 Am.2 — the quality slot opens for the time-target beginner only', () => {
  it.each([5, 10, 21.1, 42.2])('a beginner time target at %skm gets quality', km => {
    const q = qualityOf(generateRulePlan(timeTarget(km), 'paid', '2026-04-27'))
    expect(q.length).toBeGreaterThan(0)
  })

  it.each([5, 10, 21.1, 42.2])('a beginner FINISH goal at %skm still gets none', km => {
    // Ruled CORRECT AS IS by the board, unanimously, the same day. If this ever
    // goes non-zero, a ruling has been overturned by accident.
    expect(qualityOf(generateRulePlan(finishGoal(km), 'paid', '2026-04-27'))).toHaveLength(0)
  })

  it('the ceiling has ONE owner, conditional on the goal AND the week', () => {
    const ok = GENERATION_CONFIG.BEGINNER_QUALITY_MIN_WEEKLY_KM
    expect(qualityCeilingFor('beginner', 'time_target', ok))
      .toBe(GENERATION_CONFIG.BEGINNER_TIME_TARGET_QUALITY_PER_WEEK_MAX)
    expect(qualityCeilingFor('beginner', 'finish', ok)).toBe(0)
    // Non-beginners are untouched by the amendment, whatever their goal, and
    // the volume floor does not apply to them.
    expect(qualityCeilingFor('intermediate', 'time_target', 5))
      .toBe(GENERATION_CONFIG.QUALITY_SESSIONS_PER_WEEK_MAX.intermediate)
    expect(qualityCeilingFor('experienced', 'finish', 5))
      .toBe(GENERATION_CONFIG.QUALITY_SESSIONS_PER_WEEK_MAX.experienced)
  })

  it('§110b — the week must be able to carry the session, and unknown volume FAILS CLOSED', () => {
    // 640 §52 breaches were measured without this floor, every one a beginner
    // at 5-12 km/week: an absolute work-minute dose is most of a tiny week.
    const floor = GENERATION_CONFIG.BEGINNER_QUALITY_MIN_WEEKLY_KM
    expect(qualityCeilingFor('beginner', 'time_target', floor - 0.1)).toBe(0)
    expect(qualityCeilingFor('beginner', 'time_target', floor)).toBe(1)
    // Never fail open: no volume means no quality, not unchecked quality.
    expect(qualityCeilingFor('beginner', 'time_target', null)).toBe(0)
    expect(qualityCeilingFor('beginner', 'time_target', undefined)).toBe(0)
  })

  it('never more than one quality session in a week', () => {
    const plan = generateRulePlan(timeTarget(42.2), 'paid', '2026-04-27')
    for (const w of plan.weeks) {
      const n = (Object.values(w.sessions ?? {}).filter(Boolean) as Session[])
        .filter(s => s.type === 'quality').length
      expect(n).toBeLessThanOrEqual(GENERATION_CONFIG.BEGINNER_TIME_TARGET_QUALITY_PER_WEEK_MAX)
    }
  })
})

describe('§110b — the rows are real, reachable, and scoped', () => {
  it('every quality session carries a catalogue_id — the ADR-018 failure that reverted attempt one', () => {
    for (const km of [5, 10, 21.1, 42.2]) {
      for (const s of qualityOf(generateRulePlan(timeTarget(km), 'paid', '2026-04-27'))) {
        expect(s.catalogue_id, `${km}km: "${s.label}" has no catalogue_id`).toBeTruthy()
      }
    }
  })

  it('the plan validates with no errors, §22 included', () => {
    for (const km of [5, 10, 21.1, 42.2]) {
      const input = timeTarget(km)
      const errors = validatePlan(generateRulePlan(input, 'paid', '2026-04-27'), input)
        .filter(v => v.severity === 'error')
      expect(errors, `${km}km: ${errors.map(e => e.code).join(', ')}`).toHaveLength(0)
    }
  })

  it('the marathon beginner does NOT get one row on repeat — two threshold rows, not one', () => {
    // With only `progressive_tempo` lowered this plan carried it TEN times.
    // §53 would not have caught it: max(fraction, pigeonhole) permits one row
    // picked k times when the pool holds one row.
    const q = qualityOf(generateRulePlan(timeTarget(42.2), 'paid', '2026-04-27'))
    const distinct = new Set(q.map(s => s.catalogue_id))
    expect(distinct.size).toBeGreaterThan(1)
  })

  it('`beginner_goal_pace_blocks` is scoped beginner-only and cannot leak upward', () => {
    const row = V1_SESSION_CATALOGUE.find(r => r.id === 'beginner_goal_pace_blocks')
    expect(row).toBeDefined()
    expect(row!.fitness_level_max).toBe('beginner')
    // The measured reason the field exists: an unscoped new row changed 59% of
    // intermediate and experienced plans and 0% of beginner ones.
    let checked = 0
    for (const level of ['intermediate', 'experienced'] as const) {
      // HM and marathon only: 5K/10K at a non-beginner's volume trip §9's
      // minimum quality session size, which is unrelated to this field. The
      // row is eligible at both of these, so the leak would show.
      for (const km of [21.1, 42.2]) {
        // Realistic volume for the level — an intermediate fixture at a
        // beginner's 30 km/week trips §9's session floor, which is a property
        // of that contradictory input and nothing to do with this scope field.
        const input = {
          ...timeTarget(km), fitness_level: level,
          current_weekly_km: 55, longest_recent_run_km: 24,
          recent_quality_training: 'regular', training_age: '3y+',
        } as unknown as GeneratorInput
        // Some level x distance x volume combinations trip unrelated floors
        // (§9's minimum quality session size at 5K). Skip those rather than
        // assert on a plan that does not exist — but COUNT the ones that do,
        // so this cannot pass vacuously if generation breaks entirely.
        let ids: (string | undefined)[]
        try { ids = qualityOf(generateRulePlan(input, 'paid', '2026-04-27')).map(s => s.catalogue_id) }
        catch { continue }
        checked++
        expect(ids, `${level} ${km}km saw the beginner-only row`).not.toContain('beginner_goal_pace_blocks')
      }
    }
    expect(checked, 'no non-beginner plan generated — the assertion never ran').toBe(4)
  })

  it('`fitness_level_max` is absent on every pre-existing row, which is why adding it was inert', () => {
    const scoped = V1_SESSION_CATALOGUE.filter(r => r.fitness_level_max != null).map(r => r.id)
    expect(scoped).toEqual(['beginner_goal_pace_blocks'])
  })

  it('every fitness-keyed dose table a beginner can now reach HAS a beginner entry', () => {
    // The latent-crash guard. These are typed Record<string, …>, so a missing
    // key is `undefined` at runtime and silent at compile time — it threw
    // `resolveMainSet: parameter "third_secs" has no value` before the entries
    // existed.
    expect(GENERATION_CONFIG.THRESHOLD_WORK_TARGET_MINS.beginner).toBeDefined()
    expect(GENERATION_CONFIG.PROGRESSIVE_TEMPO_MAIN_MINS.beginner).toBeDefined()
  })
})
