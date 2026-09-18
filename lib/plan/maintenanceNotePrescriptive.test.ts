import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import type { GeneratorInput } from '@/types/plan'

/**
 * §38 — a volume-constraint note carries the DIAGNOSIS and the PRESCRIPTION.
 *
 * Round-2 review flagged the note as descriptive but not actionable: "Plan
 * maintains current fitness rather than building it" tells a runner something
 * is wrong and not what to do. They either accept it (under-trained) or guess
 * at the cause, usually wrong. The engine has perfect information about which
 * input is the bottleneck, because it just ran the maths.
 *
 * `maintenanceLabel.test.ts` covers the COPY half (MAINT-LABEL-01: never open
 * by calling a first-time charity marathoner's plan "maintenance"). It asserts
 * a lever is mentioned; it does not test §38's mechanism. This does.
 *
 * THE TEST THAT MATTERS IS THE LAST ONE. Anything can name a lever. §38's claim
 * is that the named lever WORKS — change that input and the plan builds. A
 * prescription that does not move the profile is the passive notice §38 exists
 * to replace, wearing an imperative.
 *
 * Why a test and not an invariant: there are two maintenance producers, and the
 * injury+beginner+ultra one correctly offers NO remedy — nothing the runner can
 * change fixes it. An invariant demanding a prescription would fire on the case
 * where withholding one is right, and a check that cries wolf gets disabled.
 */
const START = '2026-04-27'

const gen = (over: Record<string, unknown>) => {
  const input = {
    age: 38, plan_start: START, goal: 'finish', injury_history: [],
    recent_quality_training: 'none', ...over,
  } as unknown as GeneratorInput
  const p = generateRulePlan(input, 'paid', START, undefined, START)
  return { note: p.meta.volume_constraint_note ?? null, profile: p.meta.volume_profile }
}

// §111 (2026-09-18) — current_weekly_km 5 -> 15. A 5km base is now refused for a
// marathon (the 18km week-1 floor is a 3.6x jump off it); 15km is the flagship
// first-time charity marathoner (M1), which at 3 days lands in genuine
// maintenance via §52's low-day rule — the §38 days-bottleneck note this tests.
const BEGINNER_MARATHON = {
  race_distance_km: 42.2, race_date: '2026-10-05',
  current_weekly_km: 15, longest_recent_run_km: 8, fitness_level: 'beginner',
  days_available: 3,
}

const TIME_CAPPED_HM = {
  race_distance_km: 21.1, race_date: '2026-09-06',
  current_weekly_km: 30, longest_recent_run_km: 14,
  training_age: '2-5yr', recent_quality_training: 'occasional',
  days_available: 4, max_weekday_mins: 30,
}

describe('§38 — the days bottleneck', () => {
  it('names the day increase, with the runner\'s own numbers', () => {
    const { note, profile } = gen(BEGINNER_MARATHON)
    expect(profile, 'this profile no longer constrains — the test reaches nothing').toBe('maintenance')
    expect(note).toBeTruthy()
    expect(note!.toLowerCase(), 'no prescription — this is the passive notice §38 replaced')
      .toMatch(/days a week/)
  })

  it('states the diagnosis before the remedy, not instead of it', () => {
    const { note } = gen(BEGINNER_MARATHON)
    // Both halves, in §38's order. A remedy with no diagnosis is an instruction
    // the runner has no reason to trust.
    expect(note!.toLowerCase()).toMatch(/below the recommended|long run|volume/)
    expect(note!.toLowerCase()).toMatch(/if you want it to build|the lever is/)
  })
})

describe('§38 — the weekday time bottleneck', () => {
  it('names the time lever when the cap is what binds', () => {
    const { note } = gen(TIME_CAPPED_HM)
    expect(note, 'a 30-minute weekday cap no longer constrains this runner').toBeTruthy()
    expect(note!.toLowerCase()).toMatch(/minutes|longer session/)
  })
})

describe('§38 — no false guidance', () => {
  it('an unconstrained runner gets no note at all', () => {
    const { note, profile } = gen({ ...TIME_CAPPED_HM, max_weekday_mins: 90 })
    expect(profile).toBe('build')
    expect(note).toBeNull()
  })

  it('never tells a runner to change a database column (UX-BEGINNER-01)', () => {
    // The first cut of this copy read "increase days_available from 4 to 5".
    // Same defect class as the wizard's, one file over.
    for (const over of [BEGINNER_MARATHON, TIME_CAPPED_HM, { ...BEGINNER_MARATHON, days_available: 4 }]) {
      const { note } = gen(over)
      if (!note) continue
      expect(note, 'schema leaked into runner-facing copy').not.toMatch(/days_available|max_weekday_mins|current_weekly_km|peak_km/)
    }
  })
})

describe('§38 — the prescription is not decoration: following it changes the plan', () => {
  it('raising the named day count flips the profile to build', () => {
    expect(gen(BEGINNER_MARATHON).profile).toBe('maintenance')
    expect(gen({ ...BEGINNER_MARATHON, days_available: 6 }).profile).toBe('build')
  })

  it('raising the named weekday cap clears the constraint note', () => {
    expect(gen(TIME_CAPPED_HM).note).toBeTruthy()
    expect(gen({ ...TIME_CAPPED_HM, max_weekday_mins: 90 }).note).toBeNull()
  })
})
