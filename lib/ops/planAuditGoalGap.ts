import type { Plan } from '@/types/plan'

/**
 * RCA-1026 monitoring (docs/investigations/2026-10-26-coach-engine-digest-rca.md § Monitoring) — how many stored plans
 * tell the runner their goal is past their current fitness (§120 Am. 2), so a cohort of aspirational first-timers
 * (Make-A-Wish) is visible in the daily digest as it arrives.
 *
 * Read from the decision the engine RECORDED (`meta.goal_pace_reach`, `meta.goal_pace_withheld`), never re-derived:
 * this counts what runners were given. `decided` is every plan the rule was asked about (benchmarked, time goal, built or
 * patched since 2026-10-27); a plan built before that carries neither field and is counted in neither.
 *
 * ⚠️ PRESENT EVERY RUN, zeros included, unlike `repairable`: a count that is 0 today and 40 tomorrow is the signal, and a
 * field that appears only when non-zero cannot show the day it started.
 */
export interface GoalGapSummary {
  goal_gap: { decided: number; withheld: number; median_gap_pct: number | null }
}

export function summariseGoalGap(plans: readonly Pick<Plan, 'meta'>[]): GoalGapSummary {
  let decided = 0
  const gaps: number[] = []
  for (const p of plans) {
    if (p.meta?.goal_pace_reach) decided++
    const g = p.meta?.goal_pace_withheld?.gap_pct
    if (typeof g === 'number') gaps.push(g)
  }
  gaps.sort((a, b) => a - b)
  const mid = gaps.length ? (gaps.length % 2 ? gaps[(gaps.length - 1) / 2] : (gaps[gaps.length / 2 - 1] + gaps[gaps.length / 2]) / 2) : null
  return { goal_gap: { decided, withheld: gaps.length, median_gap_pct: mid == null ? null : Math.round(mid * 10) / 10 } }
}
