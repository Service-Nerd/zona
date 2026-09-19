/**
 * PLAN-SCHEMA-CONFORMANCE-01 — engine output satisfies the canonical plan schema.
 *
 * `lib/plan/schema.ts` opens with: "Canonical plan schema (Zod). Single source
 * of runtime validation for plan JSON. Shared by the rule engine (R23),
 * enricher (R23), reshaper (R20), and multi-race (R24)."
 *
 * ⚠️ IT HAD ONE CALLER — the enricher. The schema was applied to AI output and
 * NEVER to engine output, so nothing checked the claim in its own header. This
 * file is that check.
 *
 * Found by an end-to-end regression pass, 2026-09-19. The first six hand-built
 * realistic runners produced a plan the canonical schema REJECTED:
 * `phases.0.end_week: Too small: expected number to be >0` — ADR-021's
 * early-onset gate shortens the base phase, and on a 12-week plan it shortens
 * to nothing, emitting `{ name: 'base', start_week: 1, end_week: 0 }`.
 *
 * ⚠️ AND NEITHER PRODUCTION GRID COULD REACH IT: 0 of 45,776 corpus plans,
 * because `cohortGrid` and `targetedGrid` never combine an experienced runner
 * with `recent_quality_training: 'regular'` on a short runway. The corpus said
 * the engine was clean. A realistic hand-built runner hit it first try. Filed
 * as `GRID-EARLY-ONSET-01`.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { PlanSchema } from './schema'
import { isDesignedRefusal } from './designedRefusal'
import type { GeneratorInput } from '@/types/plan'

const B = {
  athlete_name: 'Test', race_name: 'Race', primary_metric: 'distance',
  plan_start: '2026-10-12', resting_hr: 55, max_hr: 184,
  hard_session_relationship: 'neutral', injury_history: [],
} as const

const mk = (o: Record<string, unknown>) => ({ ...B, ...o } as unknown as GeneratorInput)

describe('PLAN-SCHEMA-CONFORMANCE-01', () => {
  it('the traced case: an experienced runner on a short plan satisfies the schema', () => {
    // The exact shape that failed: early-onset collapses the base to zero weeks.
    const plan = generateRulePlan(mk({
      race_distance_km: 10, race_date: '2027-01-04', goal: 'time_target',
      target_time: '0:45:00', current_weekly_km: 55, longest_recent_run_km: 22,
      fitness_level: 'experienced', training_age: '5yr+',
      recent_quality_training: 'regular', days_available: 5, age: 35,
    }), 'paid', '2026-10-12')
    const parsed = PlanSchema.safeParse(plan)
    expect(parsed.success ? [] : parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`))
      .toEqual([])
  })

  it('NO phase is ever empty or inverted — a phase with no weeks is not a phase', () => {
    // Asserted directly as well as through the schema, because the schema only
    // catches `end_week <= 0`; a phase like 5..4 would slip past it.
    let checked = 0
    const bad: string[] = []
    for (const dist of [5, 10, 21.1, 42.2]) {
      for (const weeks of [12, 14, 16, 20]) {
        for (const rq of ['none', 'occasional', 'regular'] as const) {
          for (const level of ['intermediate', 'experienced'] as const) {
            const d = new Date('2026-10-12')
            d.setDate(d.getDate() + weeks * 7)
            const input = mk({
              race_distance_km: dist, race_date: d.toISOString().slice(0, 10), goal: 'finish',
              current_weekly_km: 55, longest_recent_run_km: 22, fitness_level: level,
              training_age: '5yr+', recent_quality_training: rq, days_available: 5, age: 35,
            })
            let plan
            try { plan = generateRulePlan(input, 'paid', '2026-10-12') }
            catch (e) { if (isDesignedRefusal(e)) continue; throw e }
            checked++
            for (const p of plan.phases ?? []) {
              if (p.end_week < p.start_week) bad.push(`${dist}km/${weeks}wk/${level}/${rq}: ${p.name} ${p.start_week}..${p.end_week}`)
            }
          }
        }
      }
    }
    expect(checked, 'no plans generated — the assertion never ran').toBeGreaterThan(50)
    expect(bad.slice(0, 5)).toEqual([])
  })

  it('a representative spread of real runners all satisfy the canonical schema', () => {
    const cases: Record<string, unknown>[] = [
      { race_distance_km: 42.2, race_date: '2027-04-25', goal: 'finish', current_weekly_km: 15, longest_recent_run_km: 5, fitness_level: 'beginner', training_age: '<6mo', recent_quality_training: 'none', days_available: 4, age: 35 },
      { race_distance_km: 42.2, race_date: '2027-04-25', goal: 'time_target', target_time: '4:30:00', current_weekly_km: 30, longest_recent_run_km: 14, fitness_level: 'beginner', training_age: '6-18mo', recent_quality_training: 'occasional', days_available: 5, age: 35 },
      { race_distance_km: 21.1, race_date: '2027-02-14', goal: 'finish', current_weekly_km: 20, longest_recent_run_km: 10, fitness_level: 'beginner', training_age: '2-5yr', recent_quality_training: 'none', days_available: 4, age: 58, injury_history: ['knee'] },
      { race_distance_km: 10, race_date: '2027-01-17', goal: 'time_target', target_time: '0:45:00', current_weekly_km: 55, longest_recent_run_km: 22, fitness_level: 'experienced', training_age: '5yr+', recent_quality_training: 'regular', days_available: 5, age: 35 },
      { race_distance_km: 42.2, race_date: '2027-04-25', goal: 'finish', current_weekly_km: 30, longest_recent_run_km: 16, fitness_level: 'intermediate', training_age: '2-5yr', recent_quality_training: 'occasional', days_available: 3, max_weekday_mins: 30, age: 40 },
      { race_distance_km: 50, race_date: '2027-05-16', goal: 'finish', current_weekly_km: 55, longest_recent_run_km: 30, fitness_level: 'experienced', training_age: '5yr+', recent_quality_training: 'regular', days_available: 5, age: 42 },
    ]
    for (const c of cases) {
      const plan = generateRulePlan(mk(c), 'paid', '2026-10-12')
      const parsed = PlanSchema.safeParse(plan)
      expect(
        parsed.success ? [] : parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
        `${c.race_distance_km}km ${c.fitness_level} ${c.goal}`,
      ).toEqual([])
    }
  })

  it('the plan survives the JSON round trip it takes through the database', () => {
    // plan_json is stored and read back as JSON. A NaN or Infinity survives in
    // memory and becomes null on the way out, so it must never be emitted.
    const plan = generateRulePlan(mk({
      race_distance_km: 42.2, race_date: '2027-04-25', goal: 'finish',
      current_weekly_km: 30, longest_recent_run_km: 16, fitness_level: 'intermediate',
      training_age: '2-5yr', recent_quality_training: 'occasional', days_available: 4, age: 40,
    }), 'paid', '2026-10-12')
    expect(JSON.parse(JSON.stringify(plan))).toEqual(JSON.parse(JSON.stringify(plan)))
    const nonFinite: string[] = []
    const walk = (o: unknown, path: string): void => {
      if (o == null) return
      if (typeof o === 'number') { if (!Number.isFinite(o)) nonFinite.push(`${path}=${o}`); return }
      if (typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`)
    }
    walk(plan, 'plan')
    expect(nonFinite).toEqual([])
  })
})
