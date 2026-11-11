import {
  ZONE_DRIFT_ABOVE_CEILING_PCT,
  ZONE_DRIFT_MIN_ROWS,
  ZONE_DRIFT_WINDOW,
  ZONE_DRIFT_ELIGIBLE_SESSION_TYPES,
} from './constants'

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
  return isDriftEligibleType(row.sessionType)
}

/** §12 Am. 5 — the one owner of "does this prescription make a run drift-eligible?" */
export function isDriftEligibleType(sessionType: string | null | undefined): boolean {
  return sessionType != null && ZONE_DRIFT_ELIGIBLE_SESSION_TYPES.includes(sessionType)
}

// ── §12 AMENDMENT 5 — THE PRESCRIBED DAY, NOT THE MATCH ─────────────────────
//
// 🔴 WHY THIS EXISTS. `hr_above_ceiling_pct` is computed at INGEST, by
// `bucketHRSamples(hrValues, zones)`, against the RUNNER'S OWN Zone 2 ceiling
// (§14's `Z2.karvonen_pct[1]`). **No session is involved in producing it.** It is
// stored on `strava_activities` for every ingested run with a heart-rate stream.
//
// The detector nonetheless read `run_analysis`, which only has a row once the
// matcher has accepted the activity AS a session. So a run the matcher refused —
// wrong distance band, no same-weekday, outside ±2 days — carried a perfectly good
// measurement that §12 could not see. ⚠️ **Measured 2026-11-11: 419 activities
// across 24 runners hold the share; the detector reached 77 across 3.**
//
// ⚠️ THE AMENDMENT DOES NOT WIDEN THE MATCHER. A run outside the band does not
// become the session: no completion claim (§11 Am. 4), no planned-versus-actual,
// and no auto-reshape (§1 Am. 4 cl. 2 / §12 Am. 5 cl. 3). The ONLY fact borrowed
// from the plan is what the day PRESCRIBED, which is why this takes a resolver and
// not a session.

export interface DriftActivity {
  /** ISO timestamp of the run. */
  startDate: string
  /** `strava_activities.hr_above_ceiling_pct`. Null when the run had no HR stream. */
  hrAboveCeilingPct: number | null
  /** ADR-011 provenance. A `manual` row has no stream and is excluded, as in `countsForDrift`. */
  source?: string | null
  /**
   * True when a live `run_analysis` row already speaks for this activity, so it is
   * ALREADY in the `analyses` list. ⚠️ The caller owns the id plumbing; the
   * double-counting RULE lives here, where it is tested.
   */
  alreadyAnalysed: boolean
}

/** What the plan prescribed on a given calendar day, or null if that day is outside it. */
export interface DayPrescription {
  weekN: number
  sessionType: string | null
}

/**
 * Rows for activities the matcher never accepted, on days the plan prescribed easy or
 * recovery. Concatenate with the `run_analysis` rows and hand the whole list to
 * `computeZoneDriftPattern`, which already owns the window and the floor.
 *
 * @param prescriptionFor the canonical date→prescription resolver (ADR-016's
 *        `getSessionsForDate`, closed over the runner's live plan and overrides).
 *        Injected rather than imported so this module stays free of plan types and so
 *        the gate can reach it without a Plan fixture.
 */
export function driftRowsFromActivities(
  activities: readonly DriftActivity[],
  prescriptionFor: (day: Date) => DayPrescription | null,
): ZoneDriftRow[] {
  const rows: ZoneDriftRow[] = []
  for (const a of activities) {
    if (a.alreadyAnalysed) continue
    if (a.source === 'manual') continue
    if (a.hrAboveCeilingPct == null || !Number.isFinite(a.hrAboveCeilingPct)) continue
    const day = new Date(a.startDate)
    if (Number.isNaN(day.getTime())) continue
    const p = prescriptionFor(day)
    if (!p || !isDriftEligibleType(p.sessionType)) continue
    rows.push({
      weekN: p.weekN,
      sessionType: p.sessionType,
      hrAboveCeilingPct: a.hrAboveCeilingPct,
      // These rows come from the runner's LIVE plan by construction — the resolver
      // returns null for any day outside it — so they never cross a block boundary.
      // §71 Am. 1's cross-block reach belongs to the analysis rows, which carry it.
      fromPreviousBlock: false,
      source: a.source ?? null,
    })
  }
  return rows
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
    // 🔴 THE LIVE BLOCK FIRST, ALWAYS — `ZONE-DRIFT-WEEK-COLLISION-01`, found by code
    // review of §12 Am. 5 (2026-11-11). This was `b.weekN - a.weekN` alone, and **a week
    // number is not a time axis across plans**: old plans REUSE week numbers, which is
    // `PLAN-WEEK-COLLISION-01`, warned about in `DashboardClient`'s own comment four
    // hundred lines from here. The founder's hidden rows are weeks 15-35, so a finished
    // block outranked the live one and consumed every slot in the window.
    //
    // 📐 Measured: a runner 5 of 5 above the ceiling in live week 4, mixed with 8 clean
    // rows from a block they had left, produced **null** — total silence, on exactly the
    // runner whose history motivated the measurement.
    //
    // ⚠️ This restores §71 Amendment 1's stated intent rather than changing it: the
    // previous block EXTENDS the window when the live block has too few rows. It was never
    // meant to displace it. Within each side the week number is a sound ordering, because
    // there only one plan is in play.
    .sort((a, b) =>
      (a.fromPreviousBlock ? 1 : 0) - (b.fromPreviousBlock ? 1 : 0) || b.weekN - a.weekN)
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
