import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { assessLongRunReadiness, minLongestRunKm, LongRunReadinessError } from './longRunReadiness'
import { generateRulePlan } from './ruleEngine'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

// CoachingPrinciples §113 — the enforcement artifact.
//
// A named test, not an invariant, for the same structural reason as §112: this
// refuses BEFORE a plan exists, so there is no Plan for validatePlan() to
// inspect. Unlike the route gate it replaces, the sweep now sees it.

const base = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 42.2, race_date: '2027-04-25', goal: 'finish',
  current_weekly_km: 25, longest_recent_run_km: 10, days_available: 3,
  fitness_level: 'beginner', training_age: '<6mo', age: 38, injury_history: [],
  recent_quality_training: 'none', hard_session_relationship: 'neutral',
  plan_start: '2026-10-05', ...o,
} as unknown as GeneratorInput)

describe('§113 — long-run readiness', () => {
  it('the floor is NOT a second copy of the number', () => {
    // The route used to hardcode `5`. Change the engine's floor and the gate
    // must follow it — which is exactly what did not happen before.
    expect(minLongestRunKm()).toBe(GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long)
  })

  it('refuses below the floor, on a governed distance', () => {
    const r = assessLongRunReadiness(base({ longest_recent_run_km: 3 }))
    expect(r.ok).toBe(false)
    expect(r.message).toContain('3 km')
    expect(r.message).toContain(String(minLongestRunKm()))
  })

  it('permits AT the floor — the boundary is inclusive', () => {
    expect(assessLongRunReadiness(base({ longest_recent_run_km: minLongestRunKm() })).ok).toBe(true)
  })

  it('🔴 names the lever — §44 requires alternatives, not a full stop', () => {
    // The old gate returned a bare string. §44's own text: "Return error
    // explaining why and listing alternatives."
    const r = assessLongRunReadiness(base({ longest_recent_run_km: 2 }))
    expect(r.alternatives.length).toBeGreaterThan(0)
    expect(r.alternatives.join(' ')).toMatch(/build up to/i)
  })

  it('offers the half only when the runner asked for a marathon', () => {
    const m = assessLongRunReadiness(base({ longest_recent_run_km: 2, race_distance_km: 42.2 }))
    const h = assessLongRunReadiness(base({ longest_recent_run_km: 2, race_distance_km: 21.1 }))
    expect(m.alternatives.join(' ')).toMatch(/half marathon/i)
    expect(h.alternatives.join(' '), 'do not offer a half to someone already running one')
      .not.toMatch(/half marathon/i)
  })

  it('does not govern shorter races', () => {
    for (const km of [5, 10]) {
      expect(assessLongRunReadiness(base({ race_distance_km: km, longest_recent_run_km: 1 })).ok).toBe(true)
    }
  })

  it('🔴 a MISSING longest run passes — absence is not shortness', () => {
    // Turning an unanswered question into a rejection is a different defect.
    for (const v of [undefined, null, 0]) {
      expect(assessLongRunReadiness(base({ longest_recent_run_km: v as never })).ok).toBe(true)
    }
  })

  it('the ENGINE throws it, so the sweep and the route both see it', () => {
    // The whole governance point: in the route it was invisible to every check
    // that starts inside the engine.
    expect(() => generateRulePlan(base({ longest_recent_run_km: 2 }), 'paid', '2026-10-05'))
      .toThrow(LongRunReadinessError)
  })

  it('and still builds for a runner at the floor', () => {
    expect(() => generateRulePlan(base({ longest_recent_run_km: 5 }), 'paid', '2026-10-05')).not.toThrow()
  })
})

describe('§113 — the route holds no coaching number any more', () => {
  const route = readFileSync(join(process.cwd(), 'app/api/generate-plan/route.ts'), 'utf8')
  const code = route.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

  it('the hardcoded longest-run gate is gone', () => {
    expect(code, 'a second copy of the floor cannot live in the boundary')
      .not.toMatch(/longest_recent_run_km\s*<\s*\d/)
  })

  it('the hardcoded volume gate stayed gone (§111)', () => {
    expect(code).not.toMatch(/current_weekly_km\s*<\s*\d/)
  })

  it('the refusal renders with the same 422 shape as its siblings', () => {
    expect(route).toMatch(/LongRunReadinessError/)
    expect(route).toMatch(/reason: 'long_run_readiness'/)
  })
})
