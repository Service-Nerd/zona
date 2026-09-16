/**
 * §110 / CB-HSR-AVOID-01 — `avoid` is a FLOOR, not a switch.
 *
 * `suppressQuality` set plannedQuality = 0 for every week of every plan when
 * `hard_session_relationship: 'avoid'` OR the runner had an Achilles history.
 * 2,197 non-beginner plans on the property sweep got zero quality across 8+
 * weeks, and — because §1 is a CEILING with no floor — nothing fired.
 *
 * These tests fail on the pre-§110 engine. That is the point: the defect was
 * silent, so a test that only passes after the fix is the only durable defence.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Session } from '@/types/plan'

const mk = (extra: Record<string, unknown> = {}): GeneratorInput => ({
  race_distance_km: 10, race_date: '2027-03-14', goal: 'time_target',
  target_time: '0:45:00', current_weekly_km: 30, longest_recent_run_km: 12,
  days_available: 5, age: 42, fitness_level: 'intermediate',
  training_age: '2-5yr', recent_quality_training: 'occasional',
  hard_session_relationship: 'neutral', injury_history: [],
  plan_start: '2026-11-23', ...extra,
} as unknown as GeneratorInput)

const gen = (extra: Record<string, unknown> = {}) => {
  const input = mk(extra)
  const r = generateRulePlan(input, 'paid') as unknown as Record<string, unknown>
  const plan = (r.plan ?? r) as ReturnType<typeof generateRulePlan> extends { plan: infer P } ? P : never
  return { input, plan: plan as never as { weeks: Array<{ n: number; phase: string; sessions?: Record<string, Session | undefined> }>; meta: Record<string, unknown> } }
}

const qualityCount = (plan: { weeks: Array<{ sessions?: Record<string, Session | undefined> }> }) =>
  plan.weeks.flatMap(w => Object.values(w.sessions ?? {}).filter(Boolean) as Session[])
    .filter(s => s.type === 'quality').length

describe('§110 — `avoid` gets fewer hard sessions, never none', () => {
  it('an avoid runner still gets quality', () => {
    expect(qualityCount(gen({ hard_session_relationship: 'avoid' }).plan)).toBeGreaterThan(0)
  })

  it('caps at HARD_AVERSE_QUALITY_PER_WEEK_MAX per week, never more', () => {
    const { plan } = gen({ hard_session_relationship: 'avoid', fitness_level: 'experienced' })
    for (const w of plan.weeks) {
      const q = (Object.values(w.sessions ?? {}).filter(Boolean) as Session[])
        .filter(s => s.type === 'quality').length
      expect(q).toBeLessThanOrEqual(GENERATION_CONFIG.HARD_AVERSE_QUALITY_PER_WEEK_MAX)
    }
  })

  it('the cap BINDS for an experienced runner — it is not inert', () => {
    // The per-week cap's only observable effect is the experienced runner's
    // SECOND peak quality session, so that is where it must be asserted. On an
    // intermediate it cannot bind at all, which is what made the first sitting's
    // numeric inert for 100% of them (see §110 Am.1).
    const neutral = gen({ fitness_level: 'experienced' }).plan
    const avoid = gen({ fitness_level: 'experienced', hard_session_relationship: 'avoid' }).plan
    const maxPerWeek = (p: typeof neutral) => Math.max(...p.weeks.map(w =>
      (Object.values(w.sessions ?? {}).filter(Boolean) as Session[]).filter(s => s.type === 'quality').length))
    expect(maxPerWeek(neutral)).toBe(2)
    expect(maxPerWeek(avoid)).toBe(1)
  })

  it('§110 Am.1 — the DOSE is smaller, which is what reaches an intermediate', () => {
    // The lever that actually changes an intermediate's plan. Asserted on
    // prescribed quality DISTANCE, not session count: the count is deliberately
    // unchanged, because the frequency lever was withdrawn for colliding with
    // §5's VO2max deadline, §53's variety cap and §79's re-entry window.
    const qKm = (p: { weeks: Array<{ sessions?: Record<string, Session | undefined> }> }) =>
      p.weeks.flatMap(w => Object.values(w.sessions ?? {}).filter(Boolean) as Session[])
        .filter(s => s.type === 'quality')
        .reduce((t, s) => t + (s.distance_km ?? 0), 0)
    const neutral = qKm(gen().plan)
    const avoid = qKm(gen({ hard_session_relationship: 'avoid' }).plan)
    expect(neutral).toBeGreaterThan(0)
    expect(avoid).toBeLessThan(neutral)
    // And it is a REDUCTION, not an erasure — §110's floor still holds.
    expect(avoid).toBeGreaterThan(0)
  })

  it('§40c — the suppression is DECLARED, not absorbed silently', () => {
    // Before §110 `hard_pref_note` fired for `love` only, so the runner was
    // never told. §40c also requires the note to NAME THE LEVER.
    const note = gen({ hard_session_relationship: 'avoid' }).plan.meta.hard_pref_note as string | undefined
    expect(note).toBeTruthy()
    expect(note).toMatch(/one a week/i)
  })
})

describe('§110 / §21 — Achilles gets SUBSTITUTION, not removal', () => {
  it('an Achilles runner still gets quality', () => {
    // §21: "Substitutes are progression runs or flat tempo at equivalent
    // intensity." `excludeHillSessions` already does that; suppressQuality then
    // deleted the substituted session, for 756 plans.
    expect(qualityCount(gen({ injury_history: ['Achilles'] }).plan)).toBeGreaterThan(0)
  })

  it('and still gets NO hills — §21\'s actual restriction is untouched', () => {
    const { plan } = gen({ injury_history: ['Achilles'] })
    const labels = plan.weeks.flatMap(w => Object.values(w.sessions ?? {}).filter(Boolean) as Session[])
      .map(s => (s.label ?? '').toLowerCase())
    expect(labels.some(l => l.includes('hill'))).toBe(false)
  })
})

describe('INV-PLAN-QUALITY-NOT-ZERO — the floor §1 never had', () => {
  it('is silent on a healthy plan', () => {
    const { input, plan } = gen({ hard_session_relationship: 'avoid' })
    const v = validatePlan(plan as never, input).filter(x => x.code === 'INV-PLAN-QUALITY-NOT-ZERO')
    expect(v).toHaveLength(0)
  })

  it('FIRES when every quality session is stripped — proven wakeable, not merely quiet', () => {
    // An invariant that has never been seen to fire is UNPROVEN, not proven
    // healthy. This mutation reproduces exactly what suppressQuality emitted.
    const { input, plan } = gen({ hard_session_relationship: 'avoid' })
    for (const w of plan.weeks) {
      for (const d of Object.keys(w.sessions ?? {})) {
        if (w.sessions?.[d]?.type === 'quality') delete w.sessions[d]
      }
    }
    const v = validatePlan(plan as never, input).filter(x => x.code === 'INV-PLAN-QUALITY-NOT-ZERO')
    expect(v).toHaveLength(1)
    expect(v[0].severity).toBe('error')
  })

  it('stays silent for a genuine beginner — the ratified case', () => {
    // 2026-08-30 classifier ruling: "A genuine beginner ... still gets no
    // quality sessions, and that remains correct."
    const { input, plan } = gen({ fitness_level: 'beginner', user_declared_level: 'beginner' })
    const v = validatePlan(plan as never, input).filter(x => x.code === 'INV-PLAN-QUALITY-NOT-ZERO')
    expect(v).toHaveLength(0)
  })
})
