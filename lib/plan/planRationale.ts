import type { Plan } from '@/types/plan'
import { convertDistanceString, type DistanceUnits } from '@/lib/format'

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
 * The total words the rationale tiles may spend, across all of them.
 *
 * Set to **70** by the SLT on 2026-09-17, when the mean was 130 words and the
 * worst case 254 — a page of shortfall read before the runner had seen a
 * session. That ruling was right and its number has since become the defect.
 *
 * 🔴 **70 WAS ALSO THE MEAN NOTE LENGTH, SO THE BUDGET ADMITTED EXACTLY ONE
 * NOTE BY ARITHMETIC.** `planRationale.test.ts`'s ratchet records `MEAN_WORDS =
 * 70`. A cumulative budget equal to the mean of the things it budgets can hold
 * one of them, and `PLAN_RATIONALE_MAX_NOTES = 3` became decoration. Nobody
 * decided that; it is what two separately-correct numbers do when they meet.
 *
 * ⚠️ **AND THE OLD HEADER'S OWN JUSTIFICATION HAD EXPIRED.** It read: *"because
 * the first note is always kept and the one-cause-one-tile rule left 510 of 513
 * plans carrying a single note, this budget now decides almost nothing at
 * runtime."* True in September. **Measured 2026-10-07: 171 of 709 plans carry
 * one note; 538 (75.9%) carry two or more** — more honesty notes have shipped
 * since. The budget had gone from deciding nothing to deciding everything, and
 * the sentence explaining why it was harmless was still sitting here.
 *
 * 📐 Measured at each candidate, 709 plans with at least one note:
 *
 * | budget | rendered/plan | plans seeing ALL their notes |
 * |--------|---------------|------------------------------|
 * | 70     | 1.00          | 37%                          |
 * | 140    | 1.51          | 78%                          |
 * | **180**| **1.72**      | **90%**                      |
 * | 220    | 1.80          | 97%                          |
 * | ∞      | 1.81          | 97%                          |
 *
 * 📱 **180 over 220 (Wroblewski):** 90% completeness for a worst case that can
 * be defended. 220 buys 7pp for a 40-word looser ceiling. ✋ **Silvanto's
 * framing carried the ruling:** length is held by the per-note RATCHET, which
 * reaches the copy; a runtime budget cannot reach copy, it can only hide it.
 * Two guards for one job, and the runtime one was the only one able to delete
 * coaching silently.
 *
 * 🎓 **What the runner was losing, measured:** 63% of plans dropped at least one
 * honest note, and the survivor was almost always `Maintenance` — what the plan
 * WILL do. The dropped ones (`Your level`, `Volume`, `Coming back`) are what it
 * could NOT do. **The runner was systematically receiving the reassurance and
 * not the constraint**, which is the inversion this family exists to prevent.
 *
 * Whole notes are still dropped, never truncated, and the first is always kept.
 */
export const PLAN_RATIONALE_MAX_WORDS = 180

const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length

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
    return 'Quality work starts earlier here than a novice plan: your training history says your legs are ready for it.'
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
export function planRationaleNotes(
  meta: Plan['meta'] | undefined | null,
  units: DistanceUnits = 'km',
): PlanRationaleNote[] {
  if (!meta) return []
  const notes: PlanRationaleNote[] = []

  // Priority order — honest constraints first (they explain a surprising shape).
  if (meta.volume_constraint_note)  notes.push({ label: 'Maintenance',   text: meta.volume_constraint_note })

  // ONE CAUSE, ONE TILE (SLT 2026-09-17). The volume-shortfall note is not shown
  // beside the maintenance note, because measured across 563 plans the two
  // appeared together on 200 and **157 of those (78.5%) blamed the same cause —
  // the runner's weekday time cap — while 68 prescribed the identical lever**
  // ("run 5 days instead of 4"). The runner read the same advice twice with
  // different numbers, which undermines both tellings.
  //
  // The maintenance note wins because it is the larger statement: it says what
  // the plan WILL do, why, and names the levers. What is lost is the shortfall's
  // arithmetic ("peak week reaches 54km where it would have gone to 65km, about
  // 17% less") — which is exactly the precision the board judged unusable:
  // nobody has ever acted on 17%.
  else if (meta.volume_shortfall_note) notes.push({ label: 'Volume', text: meta.volume_shortfall_note })
  if (meta.long_run_shortfall_note) notes.push({ label: 'Long run',      text: meta.long_run_shortfall_note })
  // §44 Am. 3 (PROGRESSION-GOAL-INVERTED-01) — ranked ABOVE `Your level`, which
  // is the same family of signal and fires on a different trigger (VDOT vs
  // volume); these 10 plans trip neither. ⚠️ Placed here because the measurement
  // that mattered was not "does it get stamped" but "does it survive the cap":
  // `PLAN_RATIONALE_MAX_NOTES` is 3, and these plans already carry a maintenance
  // or volume note.
  // §119 Am. 1 (DELOAD-OPENING-SURFACE-01) — 🔴 STAMPED SINCE 2026-10-06 AND
  // WIRED TO NOTHING. The backlog recorded this as "blocked behind the note
  // budget by the same cap"; measured 2026-10-07, `short_opening_block_note`
  // appeared in **no renderer at all** — not here, not in `app/`, not in
  // `components/`. It was not competing for a tile, it had never been given one.
  // 🎯 McMillan's condition on that ruling is binding and in his words: the
  // early recovery week is "recorded TO THE RUNNER", not to the plan JSON.
  if (meta.short_opening_block_note) notes.push({ label: 'Recovery week', text: meta.short_opening_block_note })
  if (meta.goal_below_easy_ceiling_note) notes.push({ label: 'Your target', text: meta.goal_below_easy_ceiling_note })
  if (meta.fitness_signal_note)     notes.push({ label: 'Your level',    text: meta.fitness_signal_note })
  if (meta.hard_pref_note)          notes.push({ label: 'Hard sessions', text: meta.hard_pref_note })
  const yielded = onsetYieldNote(meta)
  if (yielded)                      notes.push({ label: 'Quality timing', text: yielded })
  if (meta.terrain_effort_note)     notes.push({ label: 'Off-road',      text: meta.terrain_effort_note })
  // §79 Amendment 2 — "no intervals this block" is a DECISION, so it is stated.
  // Ranked with the honest-constraint group, not the brag group: the runner is
  // being told what the plan does NOT contain and why (PLAN-NOTE-SURFACE-01 —
  // one renderer for the whole note family, never a second path).
  if (meta.intensity_reentry_omission_note) {
    notes.push({ label: 'Coming back', text: meta.intensity_reentry_omission_note })
  }

  // The "shaped for you" line ranks LAST (Wood: never a brag; constraints matter more).
  const fit = levelFitNote(meta)
  if (fit) notes.push({ label: 'Shaped for you', text: fit })

  // Both caps, in order: count first (Wood's original), then the word budget.
  const capped = notes.slice(0, PLAN_RATIONALE_MAX_NOTES)
  const out: PlanRationaleNote[] = []
  let words = 0
  for (const n of capped) {
    const w = wordCount(n.text)
    // Always keep the first: a budget that can return nothing would silently
    // drop a constraint, and honesty outranks brevity when they collide.
    if (out.length > 0 && words + w > PLAN_RATIONALE_MAX_WORDS) break
    out.push(n)
    words += w
  }
  // UNITS-PROSE-01 — the engine welds `km` into these sentences at GENERATION
  // time, so the reader's preference can only be honoured here, at the read.
  //
  // ⚠️ CONVERTED AFTER THE CAP, DELIBERATELY. `wordCount` runs above, and
  // conversion changes word counts ("38km" is one word, "23.6 mi" is two). Had
  // this run before the budget, a miles reader would silently receive FEWER
  // notes than a km reader for the same plan — a units-dependent difference in
  // what the runner is told, which is worse than the defect being fixed.
  //
  // ⚠️ MAPPED ON THE WAY OUT rather than at each `push`, so a note added later
  // is converted by construction and cannot be the one that was forgotten.
  return out.map(n => ({ ...n, text: convertDistanceString(n.text, units) ?? n.text }))
}
