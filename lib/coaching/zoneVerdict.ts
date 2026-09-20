// P-01 — THE SINGLE OWNER of "did this session hold the zone?"
//
// SLT 2026-09-20 approved the semantic colour pair (moss = held the zone, amber
// = cooked it) with three conditions. This file is condition 1: **one predicate,
// not a copy per component.** This repo has paid for parallel classifiers
// repeatedly (D-16, TIER-OWNER-01, DELOAD-OWNER-01, §47's positions-vs-pairs).
//
// ⚠️ THE THRESHOLD IS RATIFIED AND IS NOT A CHOICE MADE HERE.
// `ZONE_DRIFT_ABOVE_CEILING_PCT = 20` carries a principle and a measured
// derivation: the production distribution separates with NO overlap — too-easy
// runs at 0, 0, 1, 2, 3, 19% above ceiling, too-hard at 23, 40, 47 … 94% — and
// the cut sits inside that gap. Hutchinson's condition on P-01 was that the
// threshold be board-ratified before the design system encodes it. It already is.
//
// 🔴 DO NOT REACH FOR `ZONE_DISCIPLINE_BANDS` (85/70/50). It is the obvious
// thing to grab and it is DEAD: its only reader, `classifyZoneDiscipline`, has
// no call sites (documented at loadCalc.ts:182). Binding the design system to a
// dead constant would be the decorative-config defect wearing a colour.
//
// ⚠️ SCOPE IS RESOLUTION A (SLT): this pair means zone discipline on COMPLETION
// states only. Prescriptive surfaces — the race-session accent `--s-race`, the
// coaching amber on `--warn-bg` — keep today's meaning. Amber on a race week
// must never read as a reprimand for racing.

import { ZONE_DRIFT_ABOVE_CEILING_PCT } from './constants'

/**
 * - `held`    — completed, and intensity stayed where it was meant to.
 * - `drifted` — completed, but more than the ratified share of it sat above the
 *               Zone 2 ceiling. NOT a failure; a fact, and the one the product exists to show.
 * - `unknown` — we cannot say. No HR, no analysis, or a free-tier runner with no
 *               `activity_intelligence`. **This is the honest majority case and it
 *               must never render as `held`.**
 */
export type ZoneVerdict = 'held' | 'drifted' | 'unknown'

/**
 * The only place this question is answered.
 *
 * ⚠️ `unknown` is returned for null/undefined/NaN, never `held`. A missing
 * measurement is not a good one — `?? 0` here would silently award "held the
 * zone" to every runner with no HR strap, which is this repo's recorded
 * `distance_km ?? 0` defect in a new costume.
 */
export function zoneVerdict(aboveCeilingPct: number | null | undefined): ZoneVerdict {
  if (aboveCeilingPct == null || !Number.isFinite(aboveCeilingPct)) return 'unknown'
  return aboveCeilingPct > ZONE_DRIFT_ABOVE_CEILING_PCT ? 'drifted' : 'held'
}

/**
 * The token a verdict resolves to. Returns a `var(--…)` string — never a literal,
 * so the pre-commit colour rules stay satisfied and the meaning stays in
 * `globals.css` where it is documented.
 */
export function zoneVerdictColour(v: ZoneVerdict): string {
  switch (v) {
    case 'held':    return 'var(--zone-held)'
    case 'drifted': return 'var(--zone-drifted)'
    default:        return 'var(--zone-unknown)'
  }
}

/**
 * ⚠️ RETURNS NULL IN EVERY STATE, DELIBERATELY. SLT 2026-09-20.
 *
 * The pill briefly read "Held the zone" / "Drifted above". The SLT cut the
 * words and kept the colour, and the reasoning is worth keeping because the
 * obvious instinct is to put the word back:
 *
 * **Sutherland:** *"You've built a language and then written a subtitle
 * explaining it. A glossary entry is what you write when you don't trust the
 * thing you made."* The colour either teaches itself in three sessions or it
 * does not, and the word removes the one thing that makes a learned code feel
 * like insider knowledge.
 *
 * **Wood:** the colour is the code; the word is instruction, and instruction is
 * the thing you stop needing. She explicitly did NOT kill the verdict itself —
 * an after-the-fact signal is feedback, not the illusion-of-progress class, and
 * feedback is how the ceiling (P-03, shown BEFORE the run) becomes automatic.
 *
 * **Fried:** three states, one of which is the majority and says "Done" anyway,
 * means most runners see no change and a minority see jargon. Surface area.
 *
 * ⚠️ **Traynor dissented and lost on mechanism, not taste** — he argued the word
 * makes the paid tier legible. It cannot: the verdict word only ever renders for
 * someone who already HAS run analysis, so it sells nothing to the runner who
 * does not. That argument belongs to P-04's free-tier state, which is open.
 *
 * The function is kept rather than deleted: the caller's `?? 'Done'` fallback is
 * the single place the pill's word is decided, and a future decision to label
 * one state lands here rather than in a component.
 */
export function zoneVerdictLabel(_v: ZoneVerdict): string | null {
  return null
}
