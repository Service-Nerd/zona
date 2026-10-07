import { ZONE_DRIFT_ABOVE_CEILING_PCT, ZONE_DRIFT_MIN_ROWS, ZONE_DRIFT_WINDOW } from './constants'

// ANALYSIS-SUPERSEDE-PATTERN-01 (Coaching Board, 2026-10-07) — the zone drift
// detector, and the single owner of "has this runner been drifting?".
//
// 🔴 WHY IT LEFT `DashboardClient`. It was ~30 lines inline inside a 14k-line
// `'use client'` module, so nothing could run it, and the board has now put TWO
// BINDING CONDITIONS on it (McMillan's naming, Willy's no-retrospective-verdict).
// A binding condition that cannot be tested is a binding condition nobody is
// holding. Same reasoning as `fetchRunAnalysis.ts` earlier today.
//
// ── WHAT §71 AMENDMENT 1 AUTHORISES, AND WHAT IT DOES NOT ───────────────────
// 📊 Seiler's split: the restriction belongs to the FIELD, not the window. This
// reads `hr_above_ceiling_pct`, a DISCIPLINE field, which asks "did you hold the
// zone you were told to hold" — and the zone was recomputed for whoever the runner
// was at the time, so the question is the same one in both blocks.
//
// ⚠️ IT DOES NOT AUTHORISE THE TREND CARDS. `ef_trend_pct` is fitness-denominated:
// a new block changed the denominator, so crossing it compares two different
// athletes. Those stay plan-scoped and this module must never grow to serve them.
//
// ⚠️ NOR ZoneRings, which is explicitly THIS WEEK and was ruled correct as-is.
//
// ── §12 — THE DIRECTION, WHICH IS WHY THE TYPE MATTERS ──────────────────────
// Drift is being ABOVE the ceiling on a run that was meant to be easy. Running
// below Z2 breaks no principle, and an earlier version counting `in_zone < 60`
// flagged 6 of 22 runs (27%) that were merely too EASY — McMillan's "worst possible
// false positive", telling the runner who had finally understood the product that
// they were failing. On a tempo, above Z2 is CORRECT and must never count.

// ⚠️ The two numerics live in `lib/coaching/constants.ts`, not here: they are
// coaching choices (how many runs make a PATTERN) and the Configuration Singularity
// puts those in named config, never in the module that happens to read them.
// Re-exported so this module stays the one import a caller needs.
export { ZONE_DRIFT_MIN_ROWS, ZONE_DRIFT_WINDOW }

export interface ZoneDriftRow {
  weekN: number
  /** Raw `session.type`. Stamped on the row (ADR-018 shape) or resolved from the
   *  current plan for pre-2026-10-07 rows. `null` = unknowable, and excluded. */
  sessionType: string | null
  hrAboveCeilingPct: number
  /** True when the row belongs to a plan the runner has since left. */
  fromPreviousBlock: boolean
  source?: string | null
}

export interface ZoneDriftPattern {
  count: number
  total: number
  /** 🎯 McMillan, BINDING: a comparison that crosses a boundary NAMES it. */
  crossesBlockBoundary: boolean
}

/** Only an easy or recovery run can drift, per §12. */
export function countsForDrift(row: ZoneDriftRow): boolean {
  if (row.source === 'manual') return false          // no HR stream to judge
  return row.sessionType === 'easy' || row.sessionType === 'recovery'
}

/**
 * @param rows every candidate analysis, in any order. Cross-block rows included:
 *             that is the whole point of the ruling.
 *
 * ⚠️ RETURNS null RATHER THAN A ZERO PATTERN. Below the floor the honest output is
 * silence, not "0 of 2" — `ux-principles.md`: empty means calm, not broken.
 */
export function computeZoneDriftPattern(rows: ZoneDriftRow[]): ZoneDriftPattern | null {
  const eligible = rows
    .filter(countsForDrift)
    .sort((a, b) => b.weekN - a.weekN)
    .slice(0, ZONE_DRIFT_WINDOW)

  if (eligible.length < ZONE_DRIFT_MIN_ROWS) return null

  const count = eligible.filter(r => r.hrAboveCeilingPct > ZONE_DRIFT_ABOVE_CEILING_PCT).length
  if (count < ZONE_DRIFT_MIN_ROWS) return null

  return {
    count,
    total: eligible.length,
    // Only the rows actually COUNTED can make the claim cross a boundary. A
    // previous-block row that was filtered out must not add the clause.
    crossesBlockBoundary: eligible.some(r => r.fromPreviousBlock),
  }
}

/**
 * The runner-facing line.
 *
 * 🎯 McMillan, BINDING: *"a runner can argue with that sentence; they cannot argue
 * with silence."* When the window reaches back into a finished block, say so — a
 * silent comparison to eight months ago is not something anyone can discount.
 *
 * 🩹 Willy, BINDING: no retrospective VERDICT. This states what the window
 * contains and names its reach. It does not re-score old runs, does not say the
 * runner has been failing for months, and does not change what any past run was
 * told at the time.
 *
 * ⚠️ No em dash: a sentence the runner reads (founder, 2026-09-22).
 */
export function zoneDriftLine(p: ZoneDriftPattern): string {
  // ⚠️ "crept above Zone 2" is the EXISTING shipped wording, kept deliberately. It
  // was written out inline TWICE in `DashboardClient` with two different endings;
  // this module takes ownership of the sentence, not of the voice. Rewriting
  // founder copy to suit a refactor is not this module's job (`brand.md`).
  const scope = p.crossesBlockBoundary ? ', including your last block' : ''
  return `${p.count} of your last ${p.total} easy sessions crept above Zone 2${scope}.`
}
