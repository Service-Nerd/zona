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
 * One-word label. Deliberately not a sentence: the compliance COPY is
 * pattern-setting (§4A) and belongs to P-04, which is a separate item and needs
 * sign-off. This is the glanceable atom only.
 */
export function zoneVerdictLabel(v: ZoneVerdict): string | null {
  switch (v) {
    case 'held':    return 'Held the zone'
    case 'drifted': return 'Drifted above'
    default:        return null   // say nothing rather than guess
  }
}
