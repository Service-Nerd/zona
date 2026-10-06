/**
 * §93 Amendment 1 — a time-targeted MARATHON's peak quality slot takes
 * race-specific work (MARATHON-PEAK-ROTATION-01).
 *
 * 🔴 WHAT WAS WRONG. The peak preference was a chain of per-distance `if`s. HM
 * was in it; MARATHON fell through to `threshold`. So `mp_blocks` — whose own
 * `purpose` reads *"Marathon pace away from the long run. Goal pace on fresh
 * legs, so it survives a week the long run does not."* — was selected **0.14
 * times per time-target marathon plan**, reachable only through a SECOND peak
 * quality slot, which only EXPERIENCED runners get (2 per peak week against
 * intermediate's 1). An intermediate marathoner's only midweek race-pace session
 * in an 18-week block was the taper sharpener.
 *
 * ⚠️ ARM 3 IS THE ONE THAT MATTERS, because the filed item's own blocker was
 * §104 firing 3,408 times — and that dissolved when `VARIETY-ELIGIBILITY-01`
 * taught the variety invariant to filter alternatives by fitness. The marathon
 * has no OTHER eligible midweek race-specific peak row, so §104 is satisfied by
 * its own text (*"while another eligible row exists"*). This arm pins that.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { catalogueRowFor } from './catalogueLink'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { GENERATION_CONFIG as G } from './generationConfig'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

const TODAY = '2026-10-12'
const race = (w: number) =>
  new Date(new Date(TODAY + 'T00:00:00Z').getTime() + w * 7 * 86_400_000).toISOString().slice(0, 10)

const marathon = (fitness: string, weeks = 18): GeneratorInput => ({
  athlete_name: 'A', race_name: 'R', primary_metric: 'distance',
  race_distance_km: 42.195, goal: 'time_target', target_time: '3:15:00',
  current_weekly_km: 60, longest_recent_run_km: 28,
  race_date: race(weeks), plan_start: TODAY,
  days_available: 5, age: 38, resting_hr: 55, max_hr: 184,
  training_age: '5yr+', fitness_level: fitness,
  recent_quality_training: 'regular', hard_session_relationship: 'neutral',
  injury_history: [],
} as unknown as GeneratorInput)

const peakQuality = (p: Plan): Session[] => p.weeks
  .filter(w => w.n >= 1 && w.phase === 'peak' && w.type !== 'deload')
  .flatMap(w => Object.values(w.sessions).filter((s): s is Session => s?.type === 'quality'))

const raceSpecific = (ss: Session[]) =>
  ss.filter(s => catalogueRowFor(s, V1_SESSION_CATALOGUE)?.category === 'race_specific')

describe('§93 Am.1 — the marathon peak takes race-specific quality', () => {
  it('MARATHON is in the config list and 50K/100K deliberately are not', () => {
    const list = G.TIME_TARGET_PEAK_RACE_SPECIFIC_DISTANCES as readonly string[]
    expect(list).toContain('MARATHON')
    expect(list).toContain('HM')
    // Nothing in the measurement spoke to the ultras; extending on symmetry
    // alone is the mistake the filed item made.
    expect(list).not.toContain('50K')
    expect(list).not.toContain('100K')
  })

  it('an INTERMEDIATE time-target marathoner gets race-specific peak quality', () => {
    // The cohort the change exists for: one peak quality slot per week, which
    // used to go to threshold, so mp_blocks was unreachable.
    const p = generateRulePlan(marathon('intermediate'), 'paid', TODAY, undefined, TODAY)
    const q = peakQuality(p)
    expect(q.length).toBeGreaterThan(0)
    expect(raceSpecific(q).length).toBeGreaterThan(0)
  })

  it('an EXPERIENCED one does too, and the plan still validates', () => {
    const input = marathon('experienced')
    const p = generateRulePlan(input, 'paid', TODAY, undefined, TODAY)
    expect(raceSpecific(peakQuality(p)).length).toBeGreaterThan(0)
    expect(validatePlan(p, input).filter(v => v.severity === 'error')).toEqual([])
  })

  it('ARM 3 — §104 does NOT fire: the marathon has no other eligible midweek row', () => {
    for (const fit of ['intermediate', 'experienced']) {
      const input = marathon(fit)
      const p = generateRulePlan(input, 'paid', TODAY, undefined, TODAY)
      const codes = validatePlan(p, input).map(v => v.code)
      expect(codes, fit).not.toContain('INV-PLAN-RACE-SPECIFIC-VARIETY')
    }
  })

  it('a FINISH-goal marathoner is untouched — race-specific is a time-target tool', () => {
    // CD-2 / §80. The gate is `isTimeTarget`, and this is the direction that
    // would be invisible: prescribing goal-pace work to a runner with no goal.
    const input = { ...marathon('intermediate'), goal: 'finish', target_time: undefined } as unknown as GeneratorInput
    const p = generateRulePlan(input, 'paid', TODAY, undefined, TODAY)
    expect(raceSpecific(peakQuality(p)).length).toBe(0)
  })

  it('the invariant fires when the category is absent', () => {
    const input = marathon('intermediate')
    const p = generateRulePlan(input, 'paid', TODAY, undefined, TODAY)
    // Re-point every peak quality session at a THRESHOLD row, which is exactly
    // what the engine produced before this amendment.
    //
    // ⚠️ DELETING `catalogue_id` DOES NOT WORK and that is worth recording:
    // `catalogueRowFor` falls back to a LABEL match (ADR-018's legacy path), so
    // an id-less race-specific session still resolves to its row and the arm
    // stayed green. The first version of this test asserted exactly that and
    // passed for the wrong reason.
    for (const w of p.weeks) {
      if (w.n < 1 || w.phase !== 'peak' || w.type === 'deload') continue
      for (const s of Object.values(w.sessions)) {
        if (s?.type !== 'quality') continue
        ;(s as { catalogue_id?: unknown }).catalogue_id = 'threshold_ladder'
        ;(s as { label?: unknown }).label = 'Threshold ladder'
      }
    }
    expect(validatePlan(p, input).map(v => v.code))
      .toContain('INV-PLAN-PEAK-RACE-SPECIFIC-REACHED')
  })
})
