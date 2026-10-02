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

/** A session a violation names: `"<week>:<day>"`. */
export type SessionKey = string
export const sessionKey = (week: number, day: string): SessionKey => `${week}:${day}`

/**
 * Sessions a set of violations can be attributed to — ENRICH-PARTIAL-02.
 *
 * 🔴 WHY A SECOND, NARROWER ATTRIBUTION. `ENRICH-PARTIAL-01` reverts an offending
 * WEEK and its own reasoning is *"only containing the blast radius does"*. A week
 * is still too wide: measured on live traffic 2026-10-02, a single mis-named zone
 * in ONE coach note cost a runner week 20's copy entirely, and another lost weeks
 * 10, 12–16 and 18 — five sessions each, four of which were fine.
 *
 * ⚠️ AND THE TWO CAUSES THAT REACH HERE ARE NOT FALSE POSITIVES. The enrich prompt
 * says *"NEVER NAME A ZONE OTHER THAN THE SESSION'S OWN"* (ENRICH-ZONE-01) and
 * *"never add a stride note to a session that has NO strides field"*. The model
 * broke an instructed rule and the invariants are RIGHT to fire, so the only
 * honest lever is how much copy one mistake destroys.
 *
 * A violation is session-attributable only with BOTH a week and a `day` that the
 * plan actually contains. Anything week-level or plan-level is not, and the caller
 * must fall back — never guess.
 */
export function attributableSessions(
  violations: readonly Violation[], plan: Plan,
): { sessions: Set<SessionKey>; allAttributable: boolean } {
  const sessions = new Set<SessionKey>()
  let allAttributable = true
  for (const v of violations) {
    const week = plan.weeks.find(w => w.n === v.week)
    // No day → the violation is about the WEEK (its label/theme) or the plan.
    // A day the week does not contain → not attributable; do not invent one.
    if (typeof v.week !== 'number' || !week || !v.day || !week.sessions?.[v.day as keyof Week['sessions']]) {
      allAttributable = false
      continue
    }
    sessions.add(sessionKey(v.week, v.day))
  }
  return { sessions, allAttributable }
}

/**
 * Return `enriched` with the named SESSIONS' copy restored from `rulePlan`.
 *
 * Copy only — `label` and `coach_notes` — exactly as `revertWeekCopy` does per
 * session, and for the same reason: the enricher cannot write a numeric, so
 * restoring the whole session object would work today and start discarding engine
 * output the moment `EnrichedWeekSchema` widened.
 *
 * 🔴 EACH REVERTED SESSION IS STAMPED `enrichment_reverted`. The week stays
 * enriched, so the week-level flag cannot say this, and `sessionNotesAreAiAuthored`
 * would otherwise put Kit's byline over the engine's words — the AI-PROVENANCE-01
 * defect (12,972 of 31,517 sessions) on a narrower and less visible population.
 */
export function revertSessionsToRuleCopy(
  enriched: Plan, rulePlan: Plan, keys: ReadonlySet<SessionKey>,
): Plan {
  if (keys.size === 0) return enriched
  const ruleByN = new Map(rulePlan.weeks.map(w => [w.n, w]))
  return {
    ...enriched,
    weeks: enriched.weeks.map(w => {
      const rule = ruleByN.get(w.n)
      if (!rule) return w
      const days = (Object.keys(w.sessions ?? {}) as (keyof Week['sessions'])[])
        .filter(d => keys.has(sessionKey(w.n, String(d))))
      if (!days.length) return w
      const sessions = { ...w.sessions }
      for (const day of days) {
        const sn = sessions[day]
        const r = rule.sessions?.[day]
        if (!sn || !r) continue
        sessions[day] = { ...sn, label: r.label, coach_notes: r.coach_notes, enrichment_reverted: true }
      }
      // ⚠️ The WEEK's own label/theme are NOT touched and `enrichment_reverted` is
      // NOT set on it: the week's copy is still the model's, and marking it would
      // under-credit four sessions to fix one.
      return { ...w, sessions }
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
  // AI-PROVENANCE-01 — mark it. This week now carries the ENGINE's words on an
  // otherwise-enriched plan, and nothing recorded that, so the Session Detail
  // card went on crediting Kit for copy this function had just thrown away.
  return { ...week, label: rule.label, theme: rule.theme, sessions, enrichment_reverted: true }
}
