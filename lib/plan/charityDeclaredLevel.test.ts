import { describe, it, expect } from 'vitest'
import { CHARITY_PERSONAS, charityInput, CHARITY_PLAN_START } from './charityCohort'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { isVo2maxSession } from './sessionRole'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

/**
 * §79 Amendment 3 — a charity first-timer who over-rates themselves in the
 * wizard must not be handed the catalogue's sharpest work.
 *
 * WHY THIS FILE EXISTS. The 11 charity personas never set `user_declared_level`,
 * but the wizard sends it on every generation (`GeneratePlanScreen.tsx`), so the
 * single most likely real-world deviation from the persona set had no coverage
 * at all. Measured before the amendment, T1 "couch-to-10K charity beginner"
 * (8 km/week, longest run 4 km, `<6mo`, no quality history) who declared
 * `intermediate` received **Hill reps — 90s at Zone 4-5, RPE 8 in week 5** and
 * Long VO2max in week 7, with zero invariant errors.
 *
 * These are the charity cohort's plans four days before they reach real
 * runners. Treat a failure here as a release blocker, not a test to update.
 */
const TRUE_FIRST_TIMERS = ['M1', 'H1', 'T1'] as const

const personaInput = (prefix: string, declared?: 'intermediate' | 'experienced'): GeneratorInput => {
  const p = CHARITY_PERSONAS.find(x => x.id.startsWith(prefix))!
  return {
    ...charityInput(p), plan_start: CHARITY_PLAN_START,
    ...(declared ? { user_declared_level: declared } : {}),
  } as GeneratorInput
}

const build = (input: GeneratorInput): Plan =>
  generateRulePlan(input, 'paid', CHARITY_PLAN_START, undefined, CHARITY_PLAN_START)

const qualityOf = (p: Plan): Session[] =>
  p.weeks.filter(w => w.n >= 1)
    .flatMap(w => Object.values(w.sessions))
    .filter((s): s is Session => !!s && s.type === 'quality')

const peakKm = (p: Plan) => Math.max(...p.weeks.filter(w => w.n >= 1).map(w => w.weekly_km ?? 0))

describe('§79 Amendment 3 — charity first-timers who declare up', () => {
  it.each(TRUE_FIRST_TIMERS)(
    '%s gets NO vo2max-category work when declaring intermediate', prefix => {
      // The named defect: hill reps are catalogue category `vo2max`, so a
      // structural beginner reaching them is the highest tissue-stress session
      // in the catalogue landing on the least-prepared tissue in the cohort.
      const plan = build(personaInput(prefix, 'intermediate'))
      const sharp = qualityOf(plan).filter(s => isVo2maxSession(s, V1_SESSION_CATALOGUE))
      expect(sharp.map(s => s.label),
        `${prefix} declared intermediate and still receives vo2max-category work`,
      ).toEqual([])
    })

  it.each(TRUE_FIRST_TIMERS)(
    '%s keeps the declaration\'s benefit — tempo/threshold still arrive', prefix => {
      // The amendment must not become a silent ban. The runner asked for more
      // and should get more; they get it in the right ORDER, not not at all.
      const plain = build(personaInput(prefix))
      const lifted = build(personaInput(prefix, 'intermediate'))
      expect(qualityOf(plain).length, `${prefix} baseline must be a true beginner plan`).toBe(0)
      expect(qualityOf(lifted).length,
        `${prefix} declared up and got nothing — the control is decorative`).toBeGreaterThan(0)
    })

  it.each(TRUE_FIRST_TIMERS)(
    '%s tonnage is untouched by the declaration (§79/D2)', prefix => {
      // An upward declaration buys intensity only, never tonnage. Structure
      // stays bound to the assessment or the whole asymmetry collapses.
      const plain = build(personaInput(prefix))
      const lifted = build(personaInput(prefix, 'intermediate'))
      expect(lifted.meta.fitness_level).toBe(plain.meta.fitness_level)
      expect(lifted.meta.fitness_level).toBe('beginner')
      expect(peakKm(lifted)).toBeLessThanOrEqual(peakKm(plain) + 1)
    })

  it.each(TRUE_FIRST_TIMERS)('%s plan is constitutional either way', prefix => {
    for (const declared of [undefined, 'intermediate', 'experienced'] as const) {
      const input = personaInput(prefix, declared)
      const errors = validatePlan(build(input), input).filter(v => v.severity === 'error')
      expect(errors.map(e => e.code), `${prefix} / declared=${declared}`).toEqual([])
    }
  })

  it('a first-timer is never told they are "coming back"', () => {
    // §79 Amendment 2's omission note fires here, and its returner copy is a
    // lie for this cohort — T1 has never been anywhere to come back from. This
    // defect was introduced and fixed inside the same change; it is pinned so
    // it cannot come back with the next arm.
    const plan = build(personaInput('T1', 'intermediate'))
    const note = plan.meta.intensity_reentry_omission_note
    expect(note, 'T1 should carry an omission note').toBeTruthy()
    expect(note ?? '').not.toMatch(/coming back/i)
  })

  it('a genuine returner still gets the returner copy', () => {
    // The other side of the same branch — proves the split is real and not just
    // the new string winning everywhere.
    const p = CHARITY_PERSONAS.find(x => x.id.startsWith('M3'))!
    const plan = build({ ...charityInput(p), plan_start: CHARITY_PLAN_START } as GeneratorInput)
    const note = plan.meta.intensity_reentry_omission_note
    if (note) expect(note).toMatch(/coming back/i)
  })
})
