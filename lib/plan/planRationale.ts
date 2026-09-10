import type { Plan } from '@/types/plan'

/**
 * PLAN-NOTE-SURFACE-01 — the single owner of "why this plan is shaped this way".
 *
 * The engine stamps a family of honest, rule-engine plan-level notes in `plan.meta`
 * (why maintenance, a volume/long-run shortfall, a returning-runner signal, an
 * off-road effort steer, a conditional hard-session preference). Every one of them
 * rendered NOWHERE — the engine's honest voice lived only in the plan JSON. This is
 * the function that decides which of them a runner sees, in what order, capped, and
 * under what topic label. The Plan screen renders from THIS — one owner, not a
 * per-note grep scattered across the UI.
 *
 * Design (SLT 2026-09-09, Wood's guardrail): surface them ONCE, honest, truthful to
 * what the engine did — never a persistent "personalised!" brag. So honest CONSTRAINTS
 * (which explain a surprising plan shape and are behaviour-relevant) rank first; the
 * brag-risky "shaped for you" line ranks LAST and only appears if there is room.
 *
 * These are ALL rule-engine output — the renderer must show them WITHOUT the AIMark /
 * CoachByline (provenance honesty, CLAUDE.md). No AI is involved here.
 */

export interface PlanRationaleNote {
  /** Short topic eyebrow, rendered uppercase by CoachNoteBlock. */
  label: string
  /** The engine's own note text (or, for the level-fit line, a derived honest note). */
  text: string
}

/** Wood's "not a wall" cap. Most plans have 1–2; this stops a rare 4-note plan piling up. */
export const PLAN_RATIONALE_MAX_NOTES = 3

/**
 * The CAT-DEPTH-01 SLT pivot: name the level decision the engine already made, honestly.
 * DERIVED from existing meta — no new prescription, no engine change, no Coaching Board.
 * Only fires where there is a genuine, non-obvious level decision to explain; early
 * quality onset (§89) is the clearest — a demonstrably-ready runner starts quality
 * sooner than a novice, and saying why is honesty, not a brag.
 */
export function levelFitNote(meta: Plan['meta']): string | null {
  // §98 — the claim below is "earlier than a novice plan", and after CB-ONSET-YIELD-01
  // that is not always true for a gated runner. The §1 yield ladder can trim the onset
  // all the way back to the on-ramp an UNGATED runner would get (`effective === bound`),
  // at which point quality starts exactly when it would for anyone else and the line
  // would be overclaiming. The plan is still compliant, not compromised — but the
  // honest note for that runner is `onsetYieldNote`, not this one.
  if (meta.onset_yield && meta.onset_yield.effective >= meta.onset_yield.bound) return null
  if (meta.early_quality_onset) {
    return 'Quality work starts earlier here than a novice plan — your training history says your legs are ready for it.'
  }
  return null
}

/**
 * §98 (CB-ONSET-YIELD-01) — the runner's half of the §1 yield.
 *
 * The ladder can push a demonstrated runner's first quality session 1-3 weeks later
 * than §89 alone would, or drop the early onset entirely, to keep the plan's
 * plan-wide easy/hard split inside §1's ceiling. Without this the decision is
 * invisible: stamped in `meta.onset_yield` and shown nowhere — the exact gap
 * PLAN-NOTE-SURFACE-01 exists to close.
 *
 * ONE string for both outcomes on purpose. It is true whether the ladder trimmed the
 * onset by a week (still earlier than an ungated runner) or fell through to the
 * ungated plan (not earlier at all), so there is no branch to get wrong and no way
 * for the copy to drift from what the engine did.
 *
 * Stamped only when the ladder ACTED — 84% of gated plans comply at full benefit and
 * are never stamped, so they say nothing here (Wood: once, honest, never a brag).
 */
export function onsetYieldNote(meta: Plan['meta']): string | null {
  if (!meta.onset_yield) return null
  return 'Quality starts later here than your training history alone would allow — across the whole plan, more hard sessions would tip too much of it out of easy.'
}

/**
 * The ordered, capped list of plan-rationale notes for a plan. Empty array when the
 * plan carries none (the renderer shows nothing — no empty card).
 */
export function planRationaleNotes(meta: Plan['meta'] | undefined | null): PlanRationaleNote[] {
  if (!meta) return []
  const notes: PlanRationaleNote[] = []

  // Priority order — honest constraints first (they explain a surprising shape).
  if (meta.volume_constraint_note)  notes.push({ label: 'Maintenance',   text: meta.volume_constraint_note })
  if (meta.volume_shortfall_note)   notes.push({ label: 'Volume',        text: meta.volume_shortfall_note })
  if (meta.long_run_shortfall_note) notes.push({ label: 'Long run',      text: meta.long_run_shortfall_note })
  if (meta.fitness_signal_note)     notes.push({ label: 'Your level',    text: meta.fitness_signal_note })
  if (meta.hard_pref_note)          notes.push({ label: 'Hard sessions', text: meta.hard_pref_note })
  const yielded = onsetYieldNote(meta)
  if (yielded)                      notes.push({ label: 'Quality timing', text: yielded })
  if (meta.terrain_effort_note)     notes.push({ label: 'Off-road',      text: meta.terrain_effort_note })

  // The "shaped for you" line ranks LAST (Wood: never a brag; constraints matter more).
  const fit = levelFitNote(meta)
  if (fit) notes.push({ label: 'Shaped for you', text: fit })

  return notes.slice(0, PLAN_RATIONALE_MAX_NOTES)
}
