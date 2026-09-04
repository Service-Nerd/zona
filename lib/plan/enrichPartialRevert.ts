// Per-week enrichment revert — ENRICH-PARTIAL-01 (2026-09-04).
//
// WHY THIS EXISTS. `INV-PLAN-COPY-MATCHES-SESSIONS` (§27) rejects week copy that
// promises what the week does not contain — "this will feel hard" on an all-easy
// base week. The check is right and stays. What was wrong is the CONSEQUENCE: one
// offending word, on one week, discarded the enrichment for EVERY week, so the
// athlete received no coaching voice at all across the whole plan.
//
// Observed on a real trial plan (2026-09-04): two violations, on two of the five
// weeks that carry no intensity, cost the runner enriched copy on all fourteen.
//
// The odds make it structural rather than unlucky. The model writes a label and a
// theme for every week; a plan's all-easy weeks are each an independent chance to
// trip, and base phase is all-easy BY DESIGN (§4/§5) — so the runners most exposed
// are beginners and finish-goal plans, who have the most such weeks. A prompt fix
// lowers the per-week odds; it cannot make an LLM's word choice a guarantee. Only
// containing the blast radius does.
//
// So: revert the offending WEEKS to rule copy and keep the rest. The plan the
// athlete receives is then correct everywhere and enriched almost everywhere,
// which is strictly better than correct everywhere and enriched nowhere.

import type { Plan, Week } from '@/types/plan'
import type { Violation } from './invariants'

/** Week numbers a set of violations can be attributed to. A violation with no
 *  `week`, or one naming a week absent from the plan, is NOT attributable — the
 *  caller must then fall back to a full revert rather than guess. */
export function attributableWeeks(
  violations: readonly Violation[], plan: Plan,
): { weeks: Set<number>; allAttributable: boolean } {
  const weeks = new Set<number>()
  let allAttributable = true
  for (const v of violations) {
    // Plan-level violations carry week 0 or no week (meta checks, plan-wide
    // ratios). Those cannot be fixed by reverting one week's copy.
    if (typeof v.week !== 'number' || !plan.weeks.some(w => w.n === v.week)) {
      allAttributable = false
      continue
    }
    weeks.add(v.week)
  }
  return { weeks, allAttributable }
}

/**
 * Return `enriched` with the named weeks' COPY restored from `rulePlan`.
 *
 * Copy only — label, theme, and each session's label and coach_notes. Every
 * numeric is left exactly as it is, which costs nothing here because the
 * enricher cannot write numerics in the first place (`EnrichedWeekSchema` exposes
 * label, theme and coach_notes and nothing else). Restoring the whole week object
 * would work today and would silently start discarding engine output the moment
 * that schema widened, so the narrow copy is deliberate.
 *
 * Weeks missing from `rulePlan` are left alone rather than dropped — a week the
 * rule plan does not contain has no rule copy to restore.
 */
export function revertWeeksToRuleCopy(
  enriched: Plan, rulePlan: Plan, weekNumbers: ReadonlySet<number>,
): Plan {
  if (weekNumbers.size === 0) return enriched
  const ruleByN = new Map(rulePlan.weeks.map(w => [w.n, w]))
  return {
    ...enriched,
    weeks: enriched.weeks.map(w => {
      if (!weekNumbers.has(w.n)) return w
      const rule = ruleByN.get(w.n)
      if (!rule) return w
      return revertWeekCopy(w, rule)
    }),
  }
}

function revertWeekCopy(week: Week, rule: Week): Week {
  const sessions = { ...week.sessions }
  for (const day of Object.keys(sessions) as (keyof Week['sessions'])[]) {
    const s = sessions[day]
    const r = rule.sessions?.[day]
    if (!s || !r) continue
    sessions[day] = { ...s, label: r.label, coach_notes: r.coach_notes }
  }
  return { ...week, label: rule.label, theme: rule.theme, sessions }
}
