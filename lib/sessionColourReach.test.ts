// PLAN-LONGRUN-COLOUR-01 — `--s-long` must be REACHABLE.
//
// It was declared in `globals.css`, documented in CLAUDE.md's session colour map
// and in `ui-patterns.md`, and could not be produced by any engine-generated
// plan: the engine models a long run as `type: 'easy'` (so §52/§9 ratio rules
// treat it as aerobic volume) and every surface coloured by
// `SESSION_COLORS[session.type]`. A declared, ratified token consumed by
// nothing — the same class as `--section-gap`, D9's `flexShrink` and §97's two
// inert gates, which is a pattern this repo has now shipped four times.
//
// So the test that matters is not "does getSessionColor return purple for a
// long run" — it is "does a REAL PLAN contain a session that resolves to it".
// The first is a tautology over a lookup table; the second is the claim.
import { describe, it, expect } from 'vitest'
import { getSessionColor, SESSION_COLORS } from './session-types'
import { generateRulePlan } from './plan/ruleEngine'
import { isLongRun } from './plan/sessionRole'
import type { GeneratorInput, Session } from '@/types/plan'

const input = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_date: '2026-12-12', race_distance_km: 42.2, goal: 'finish',
  current_weekly_km: 40, longest_recent_run_km: 18, days_available: 5, age: 38,
  resting_hr: 52, max_hr: 185, preferred_long_run_day: 'sun',
  training_age: '2-5yr', user_declared_level: 'intermediate',
  recent_quality_training: 'occasional', ...o,
} as GeneratorInput)

describe('PLAN-LONGRUN-COLOUR-01 — --s-long is reachable', () => {
  it('THE CLAIM — a real generated plan contains a session that resolves to the long colour', () => {
    const plan = generateRulePlan(input(), 'paid')
    const all = plan.weeks.flatMap(w => Object.values(w.sessions ?? {}) as (Session | undefined)[])
    const longs = all.filter(s => s && isLongRun(s)) as Session[]
    expect(longs.length, 'fixture must contain long runs at all').toBeGreaterThan(0)

    // The defect: every one of these carries type 'easy', so the OLD lookup
    // returned easy blue for all of them.
    expect(longs.some(s => s.type === 'easy')).toBe(true)
    expect(longs.every(s => getSessionColor(s) === SESSION_COLORS.long)).toBe(true)
  })

  it('an ordinary easy run is still easy blue — the long colour has not eaten the type', () => {
    const plan = generateRulePlan(input(), 'paid')
    const all = plan.weeks.flatMap(w => Object.values(w.sessions ?? {}) as (Session | undefined)[])
    const plainEasy = all.filter(s => s && s.type === 'easy' && !isLongRun(s)) as Session[]
    expect(plainEasy.length).toBeGreaterThan(0)
    expect(plainEasy.every(s => getSessionColor(s) === SESSION_COLORS.easy)).toBe(true)
  })

  it('reads the stamped role, not the display label — the enricher rewrites labels (D-17)', () => {
    const renamed = { type: 'easy', role: 'long_run', label: 'Sunday effort' } as any
    expect(getSessionColor(renamed)).toBe(SESSION_COLORS.long)
  })

  it('falls back to the label for legacy plans carrying no role stamp', () => {
    expect(getSessionColor({ type: 'easy', label: 'Long run — Zone 2' })).toBe(SESSION_COLORS.long)
    expect(getSessionColor({ type: 'easy', label: 'Easy run — Zone 2' })).toBe(SESSION_COLORS.easy)
  })

  it('still accepts a bare type string, which by construction cannot detect a long run', () => {
    expect(getSessionColor('easy')).toBe(SESSION_COLORS.easy)
    expect(getSessionColor('quality')).toBe(SESSION_COLORS.quality)
    expect(getSessionColor('nonsense')).toBe('var(--session-easy)')
  })
})
