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

describe('§40c — a target that was never reachable is STATED, not absorbed', () => {
  // The sweep found 3 plans carrying a peak below 75% of `peak_km_target` with
  // NO note of any kind. All three are 5K time goals off a 5-12km week, where
  // the target is 28km and a 10%/week ramp from 5km over 11 weeks tops out near
  // 13. The target was unreachable on day one and nothing said so.
  //
  // Every existing declaration missed it for the same reason: they measure
  // delivered volume against the internal volume CURVE, and the curve is itself
  // ramp-limited, so it reports no shortfall. The gap is between the CURVE and
  // the TARGET, which nothing was comparing.
  const future = (n: number) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10) }
  const unreachable = (): GeneratorInput => ({
    athlete_name: 'A', age: 35, primary_metric: 'distance', injury_history: ['Back'],
    race_distance_km: 5, target_time: '0:22:00', current_weekly_km: 5,
    longest_recent_run_km: 3, days_available: 7, fitness_level: 'beginner',
    hard_session_relationship: 'avoid', recent_quality_training: 'none',
    max_weekday_mins: 30, weeks_at_current_volume: 8, foundation_decision: 'add',
    max_hr: 184, goal: 'time_target', preferred_long_run_day: 'sat',
    benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
    plan_start: future(1), race_date: future(1 + 7 * 11),
  } as unknown as GeneratorInput)

  it('declares the shortfall instead of shipping silently', () => {
    const input = unreachable()
    const r = generateRulePlan(input, 'paid') as unknown as Record<string, unknown>
    const plan = (r.plan ?? r) as { weeks: Array<{ n: number; weekly_km?: number; sessions?: Record<string, Session | undefined> }>; meta: Record<string, unknown> }
    const training = plan.weeks.filter(w => w.n >= 1
      && !Object.values(w.sessions ?? {}).some(s => s?.type === 'race'))
    const peak = Math.max(...training.map(w => w.weekly_km ?? 0))
    const target = Number(plan.meta.peak_km_target ?? 0)

    // The shortfall is real — this asserts the FIXTURE still reproduces it, so
    // the test cannot pass by the plan quietly becoming adequate.
    expect(peak).toBeLessThan(target * 0.75)

    const declared = ['volume_shortfall_note', 'volume_constraint_note', 'long_run_shortfall_note',
      'peak_shortfall_note', 'load_residual_note'].filter(k => plan.meta[k])
    expect(declared.length).toBeGreaterThan(0)
  })

  it('§40c — the note NAMES THE LEVER rather than only reporting the loss', () => {
    // §40c's own words: a note that reports only the loss is a disclaimer.
    // The lever here is runway and starting base, NOT the weekday cap — naming
    // the cap would be naming the wrong one, since the cap is not what stopped
    // this plan.
    const note = String((generateRulePlan(unreachable(), 'paid') as unknown as { meta: Record<string, unknown> }).meta.peak_shortfall_note ?? '')
    expect(note).toMatch(/more weeks before race day|higher base/i)
    expect(note).not.toMatch(/minute weekday ceiling/i)
  })
})

describe('GOAL-COHERENCE-01 — a time goal with no time is not a time goal', () => {
  // `goalPace` is null without `target_time`, yet 14 call sites read
  // `goal === 'time_target'` as though a goal pace exists. §22's checker then
  // demanded a goal-pace rename the engine had no goal pace to produce:
  // 3 error-severity violations, which THROW in dev and test.
  //
  // Not reachable from the wizard (it blocks the step without a time). This
  // pins the boundary normalisation for the next path that creates plans.
  const incoherent = (): GeneratorInput => ({
    race_distance_km: 10, race_date: '2027-03-14', goal: 'time_target',
    current_weekly_km: 30, longest_recent_run_km: 12, days_available: 5,
    age: 42, fitness_level: 'intermediate', training_age: '2-5yr',
    recent_quality_training: 'occasional', hard_session_relationship: 'neutral',
    injury_history: [], plan_start: '2026-11-23',
  } as unknown as GeneratorInput)

  it('generates without throwing, and reports the goal it actually built', () => {
    const plan = generateRulePlan(incoherent(), 'paid') as unknown as { meta: Record<string, unknown> }
    expect(plan.meta.goal).toBe('finish')
    expect(plan.meta.goal_pace_per_km).toBeUndefined()
  })

  it('raises no error violations — the checker normalises the same way', () => {
    // THE HALF THAT WAS MISSED FIRST. Normalising only inside generateRulePlan
    // left every EXTERNAL caller of validatePlan (the sweep, the matrix, the API
    // route) passing the raw input, so the checker went on failing plans the
    // producer had already corrected. This asserts the CHECKER's behaviour by
    // handing it the RAW input, which is what those callers do.
    const input = incoherent()
    const plan = generateRulePlan(input, 'paid')
    const errors = validatePlan(plan, input).filter(v => v.severity === 'error')
    expect(errors).toHaveLength(0)
  })

  it('leaves a real time goal completely alone', () => {
    const input = { ...incoherent(), target_time: '0:45:00' } as GeneratorInput
    const plan = generateRulePlan(input, 'paid') as unknown as { meta: Record<string, unknown> }
    expect(plan.meta.goal).toBe('time_target')
    expect(plan.meta.goal_pace_per_km).toBeTruthy()
  })
})
