/**
 * QUALITY-AERO-FALLBACK-01 — a quality slot never falls back to an aerobic row.
 *
 * `selectCatalogueSession` fell back to every eligible row when no row of the
 * preferred category existed, so a quality slot could be filled by
 * `aerobic_steady` (a Z2 continuous run) and then relabelled by distance. The
 * runner saw "5K-pace sustained" over an easy run.
 *
 * Measured before the fix: 144 quality sessions were `aerobic_steady`, and
 * 144 of 144 carried a tempo/threshold/pace label — all beginner time-target
 * at 5K and 10K, the cohort §110 Am.2 opened the same morning.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import type { GeneratorInput, Session } from '@/types/plan'

describe('QUALITY-AERO-FALLBACK-01', () => {
  it('the traced case gets a real tempo, not a Z2 run wearing its name', () => {
    const input = {
      athlete_name: 'A', race_name: 'T', primary_metric: 'distance', plan_start: '2026-04-27',
      race_distance_km: 5, race_date: '2026-08-29', goal: 'time_target', target_time: '0:32:00',
      resting_hr: 55, max_hr: 184, current_weekly_km: 40, longest_recent_run_km: 8,
      fitness_level: 'beginner', age: 35, recent_quality_training: 'occasional',
      hard_session_relationship: 'neutral', injury_history: [], days_available: 3,
    } as unknown as GeneratorInput
    const plan = generateRulePlan(input, 'paid', '2026-04-27')
    const quality = plan.weeks.flatMap(w => Object.values(w.sessions ?? {}).filter(Boolean) as Session[])
      .filter(s => s.type === 'quality')
    expect(quality.length).toBeGreaterThan(0)
    expect(quality.map(s => s.catalogue_id)).not.toContain('aerobic_steady')
  })

  it('NO quality session anywhere in the corpus is an aerobic row', () => {
    // The corpus assertion, because the traced case is one plan and the
    // fallback is reachable from any thin pool.
    // SAMPLED with a coprime stride, not a prefix: the full grid takes 67s
    // against a 30s limit, and `check:slow` would flag it regardless. A prefix
    // would over-sample whichever axis the grid varies slowest, which is the
    // sampling bias the liveness work has hit three times.
    let checked = 0
    const offenders: string[] = []
    const grid = cohortGrid()
    const STRIDE = 31  // coprime with the grid's axis lengths; keeps this ~3s
    for (let k = 0; k < grid.length; k += STRIDE) {
      const input = grid[(k * STRIDE) % grid.length]
      let plan
      try { plan = generateRulePlan(input as GeneratorInput, 'paid', COHORT_PLAN_START) } catch { continue }
      for (const w of plan.weeks) {
        for (const s of Object.values(w.sessions ?? {}).filter(Boolean) as Session[]) {
          if (s.type !== 'quality') continue
          checked++
          if (s.catalogue_id === 'aerobic_steady') offenders.push(`w${w.n} "${s.label}"`)
        }
      }
    }
    expect(checked, 'no quality sessions examined — the assertion never ran').toBeGreaterThan(500)
    expect(offenders.slice(0, 5)).toEqual([])
  })
})
