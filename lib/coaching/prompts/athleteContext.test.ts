import { describe, it, expect } from 'vitest'
import { buildAthleteContext } from './athleteContext'
import type { Plan } from '@/types/plan'

/**
 * Build a minimal Plan-shape mock with just the meta fields buildAthleteContext
 * reads. The function uses `Pick<Plan, 'meta'>` so we don't need the full Plan.
 */
function makePlan(metaOverrides: Record<string, unknown>): Pick<Plan, 'meta'> {
  // Cast via unknown — meta has 30+ required fields; tests only need the
  // handful the function reads. This is the documented "partial mock"
  // pattern for type-rich shapes.
  return {
    meta: metaOverrides as unknown as Plan['meta'],
  }
}

describe('buildAthleteContext', () => {
  describe('empty block', () => {
    it('returns empty string when no relevant fields are set', () => {
      const plan = makePlan({})
      expect(buildAthleteContext({ plan })).toBe('')
    })

    it('returns empty string on a legacy plan with no traits captured', () => {
      // Legacy plans (pre-R23) have race_date and basic identity but none of
      // the captured traits the helper surfaces.
      const plan = makePlan({
        race_name:        'London Marathon',
        race_date:        '2026-04-15',
        race_distance_km: 42.2,
        resting_hr:       55,
        max_hr:           185,
      })
      expect(buildAthleteContext({ plan })).toBe('')
    })

    it('omits terrain when it is the default "road"', () => {
      // Terrain=road is the implicit default; only non-road terrains add coaching colour.
      const plan = makePlan({ terrain: 'road' })
      expect(buildAthleteContext({ plan })).toBe('')
    })

    it('omits days_available when constraint is loose (>=5)', () => {
      // The block is meant to flag CONSTRAINED schedules so the model
      // doesn't suggest "add a session" to someone who can't.
      const plan = makePlan({ days_available: 6 })
      expect(buildAthleteContext({ plan })).toBe('')
    })
  })

  describe('goal framing', () => {
    it('surfaces time-target goal with the target time', () => {
      const plan = makePlan({ goal: 'time_target', target_time: '4:30:00' })
      const result = buildAthleteContext({ plan })
      expect(result).toContain('Goal: time target (4:30:00)')
    })

    it('surfaces finish goal with "no time pressure" framing', () => {
      const plan = makePlan({ goal: 'finish' })
      const result = buildAthleteContext({ plan })
      expect(result).toContain('Goal: finish the race — no time pressure')
    })

    it('omits time-target line when goal is time_target but target_time is missing', () => {
      // Defensive: a partial plan shouldn't render a bracketed gap.
      const plan = makePlan({ goal: 'time_target' })
      const result = buildAthleteContext({ plan })
      expect(result).not.toContain('Goal:')
    })
  })

  describe('experience composite', () => {
    it('combines fitness_level and training_age into one line when both present', () => {
      const plan = makePlan({ fitness_level: 'intermediate', training_age: '2-5yr' })
      const result = buildAthleteContext({ plan })
      expect(result).toContain('Experience: intermediate, 2–5 years of running history')
    })

    it('renders fitness_level alone when training_age is missing', () => {
      const plan = makePlan({ fitness_level: 'beginner' })
      const result = buildAthleteContext({ plan })
      expect(result).toContain('Experience: beginner')
    })

    it('renders training_age alone when fitness_level is missing', () => {
      const plan = makePlan({ training_age: '5yr+' })
      const result = buildAthleteContext({ plan })
      expect(result).toContain('Experience: 5+ years of running history')
    })

    it('does not render the line when both are missing', () => {
      const plan = makePlan({ goal: 'finish' })
      const result = buildAthleteContext({ plan })
      expect(result).not.toContain('Experience:')
    })
  })

  describe('hard-session relationship', () => {
    it('renders the "overdo" coaching trait verbatim', () => {
      const plan = makePlan({ hard_session_relationship: 'overdo' })
      const result = buildAthleteContext({ plan })
      expect(result).toContain('Hard sessions: tends to push too hard, blow the band')
    })

    it('renders the "avoid" coaching trait', () => {
      const plan = makePlan({ hard_session_relationship: 'avoid' })
      const result = buildAthleteContext({ plan })
      expect(result).toContain('Hard sessions: tends to back off hard sessions')
    })

    it('ignores an unknown enum value (defensive)', () => {
      const plan = makePlan({ hard_session_relationship: 'wibble' })
      const result = buildAthleteContext({ plan })
      expect(result).toBe('')
    })
  })

  describe('injury history', () => {
    it('lists injuries verbatim from the captured array', () => {
      const plan = makePlan({ injury_history: ['achilles', 'knee'] })
      const result = buildAthleteContext({ plan })
      expect(result).toContain('Injury history: achilles, knee')
    })

    it('omits the line when the array is empty', () => {
      const plan = makePlan({ injury_history: [] })
      const result = buildAthleteContext({ plan })
      expect(result).not.toContain('Injury history:')
    })

    it('omits the line when the array is undefined', () => {
      const plan = makePlan({})
      const result = buildAthleteContext({ plan })
      expect(result).not.toContain('Injury history:')
    })
  })

  describe('terrain', () => {
    it('surfaces non-default terrain', () => {
      const plan = makePlan({ terrain: 'trail' })
      const result = buildAthleteContext({ plan })
      expect(result).toContain('Terrain: trail')
    })

    it('surfaces mixed terrain', () => {
      const plan = makePlan({ terrain: 'mixed' })
      const result = buildAthleteContext({ plan })
      expect(result).toContain('Terrain: mixed')
    })
  })

  describe('days available', () => {
    it('surfaces constrained schedule (<=4 days/week)', () => {
      const plan = makePlan({ days_available: 4 })
      const result = buildAthleteContext({ plan })
      expect(result).toContain('Training availability: 4 days/week')
    })

    it('surfaces very constrained schedule', () => {
      const plan = makePlan({ days_available: 3 })
      const result = buildAthleteContext({ plan })
      expect(result).toContain('Training availability: 3 days/week')
    })

    it('does not surface unconstrained schedule (5+)', () => {
      const plan = makePlan({ days_available: 5 })
      const result = buildAthleteContext({ plan })
      expect(result).not.toContain('Training availability:')
    })
  })

  describe('block header and instructions', () => {
    it('always renders the implicit-use instruction when any field is present', () => {
      const plan = makePlan({ goal: 'finish' })
      const result = buildAthleteContext({ plan })
      expect(result).toContain('Athlete profile (use sparingly')
      expect(result).toContain('integrate naturally into the message')
      expect(result).toContain('never list these traits back')
    })

    it('renders multi-line block when several traits present', () => {
      const plan = makePlan({
        goal:                     'time_target',
        target_time:              '3:30:00',
        fitness_level:            'experienced',
        training_age:             '5yr+',
        hard_session_relationship:'overdo',
        injury_history:           ['plantar fasciitis'],
        terrain:                  'trail',
        days_available:           4,
      })
      const result = buildAthleteContext({ plan })
      // Spot-check each trait surfaces with its label
      expect(result).toContain('Goal: time target (3:30:00)')
      expect(result).toContain('Experience: experienced, 5+ years of running history')
      expect(result).toContain('Hard sessions: tends to push too hard, blow the band')
      expect(result).toContain('Injury history: plantar fasciitis')
      expect(result).toContain('Terrain: trail')
      expect(result).toContain('Training availability: 4 days/week')
    })
  })
})
