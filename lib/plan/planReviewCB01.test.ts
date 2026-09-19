/**
 * CB-PLAN-REVIEW-01 — the two defects the Coaching Board's fit-for-purpose
 * review of the plan sample turned up (2026-09-19, Phase 2).
 *
 * Neither changes what a runner DOES. Both change whether the plan tells them
 * the truth about itself, which §40c and §34 already require.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import type { GeneratorInput, Session } from '@/types/plan'

const B = {
  athlete_name: 'A', race_name: 'T', primary_metric: 'distance',
  plan_start: '2026-04-27', resting_hr: 55, max_hr: 184,
  hard_session_relationship: 'neutral', injury_history: [],
} as unknown as GeneratorInput

const gen = (o: Record<string, unknown>) =>
  generateRulePlan({ ...B, ...o } as unknown as GeneratorInput, 'paid', '2026-04-27')

const qualityCount = (p: { weeks: { n: number; sessions: Record<string, Session | undefined> }[] }) =>
  p.weeks.filter(w => w.n >= 1)
    .flatMap(w => Object.values(w.sessions ?? {}).filter(Boolean) as Session[])
    .filter(s => s.type === 'quality').length

describe('§40c — a plan with no hard sessions says so, to EVERY runner', () => {
  // The branch used to open on `hard_session_relationship === 'avoid'`, so only
  // the runner who asked for it got an explanation. Measured: 1,752 plans
  // (17.5% of the 9,984 with zero quality) shipped with no note at all.
  const cases: [string, Record<string, unknown>][] = [
    ['beginner marathon, finish', { race_distance_km: 42.2, race_date: '2026-11-14', goal: 'finish', current_weekly_km: 25, longest_recent_run_km: 14, fitness_level: 'beginner', training_age: '1-2yr', recent_quality_training: 'none', days_available: 4, age: 35 }],
    ['knee-history beginner, HM, finish', { race_distance_km: 21.1, race_date: '2026-09-19', goal: 'finish', current_weekly_km: 20, longest_recent_run_km: 10, fitness_level: 'beginner', training_age: '6-12mo', recent_quality_training: 'none', days_available: 4, age: 44, injury_history: ['knee'] }],
    ['masters beginner, marathon, finish', { race_distance_km: 42.2, race_date: '2026-11-14', goal: 'finish', current_weekly_km: 25, longest_recent_run_km: 14, fitness_level: 'beginner', training_age: '1-2yr', recent_quality_training: 'none', days_available: 4, age: 58 }],
  ]

  it.each(cases)('%s — zero quality, and the plan explains it', (_name, input) => {
    const p = gen(input)
    expect(qualityCount(p)).toBe(0)          // the ruled-correct prescription
    const note = String(p.meta.hard_pref_note ?? '')
    expect(note).not.toBe('')                 // ...and it is not silent about it
    expect(note).toMatch(/no hard sessions/i)
  })

  it('the `avoid` runner still gets THEIR wording, not the generic one', () => {
    const p = gen({ ...cases[0][1], hard_session_relationship: 'avoid' })
    expect(String(p.meta.hard_pref_note ?? '')).toMatch(/you said you avoid hard sessions/i)
  })

  it('a plan that DOES carry quality is not told it has none', () => {
    const p = gen({ race_distance_km: 10, race_date: '2026-08-15', goal: 'time_target', target_time: '0:45:00', current_weekly_km: 55, longest_recent_run_km: 22, fitness_level: 'experienced', training_age: '5yr+', recent_quality_training: 'regular', days_available: 5, age: 35 })
    expect(qualityCount(p)).toBeGreaterThan(0)
    expect(String(p.meta.hard_pref_note ?? '')).not.toMatch(/no hard sessions/i)
  })
})

describe('§23 vs §114 — a runner at their ceiling is not told we are getting them round', () => {
  it('an experienced runner with a time goal, already at volume, is told the plan SHARPENS', () => {
    // The board would not hand this one over: 55 km/week, chasing 45:00, and
    // the plan said "built to get you round, not to chase a time". The
    // classification (maintenance) is right — §23's "nowhere to ramp to" — but
    // the sentence described the wrong cause. Measured: it was wrong on 78.7%
    // of the time-goal maintenance plans it fired on.
    const p = gen({ race_distance_km: 10, race_date: '2026-08-15', goal: 'time_target', target_time: '0:45:00', current_weekly_km: 55, longest_recent_run_km: 22, fitness_level: 'experienced', training_age: '5yr+', recent_quality_training: 'regular', days_available: 5, age: 35 })
    const note = String(p.meta.volume_constraint_note ?? '')
    expect(p.meta.volume_profile).toBe('maintenance')   // unchanged, and correct
    expect(note).toMatch(/sharpens rather than builds/i)
    expect(note).not.toMatch(/get you round/i)
  })

  it('a runner we genuinely cannot build far enough STILL gets the honest "get you round"', () => {
    // The sentence is not being retired — it is being aimed. A low-base
    // beginner chasing a marathon time is exactly who it was written for.
    const p = gen({ race_distance_km: 42.2, race_date: '2026-11-14', goal: 'time_target', target_time: '4:30:00', current_weekly_km: 30, longest_recent_run_km: 14, fitness_level: 'beginner', training_age: '6-12mo', recent_quality_training: 'occasional', days_available: 5, age: 35 })
    expect(String(p.meta.volume_constraint_note ?? '')).toMatch(/get you round/i)
  })
})
