import { ZONE_BLOCK_VERDICT_MIN_RUNS, ZONE_DRIFT_ABOVE_CEILING_PCT } from './constants'

/**
 * P-04 — the weekly zone-compliance statement. The brand thesis as a sentence.
 *
 * "This week — 3 of 4 runs held the zone. One drifted."
 *
 * SLT 2026-09-20 fixed the pattern: **count, not percentage. Plain verb. Name
 * the exception.** "3 of 4 held", never "75% compliance"; "one drifted", never
 * "1 session non-compliant". It will be reused everywhere the zone is scored,
 * which is why the derivation lives here and not in a component.
 *
 * Coaching Board 2026-09-20 ruled the two questions the SLT routed down:
 *
 *   1. **The verdict needs `ZONE_BLOCK_VERDICT_MIN_RUNS` runs; the BLOCK never
 *      hides.** A minimum of three would have hidden it on 57.1% of measured
 *      runner-weeks. Below the threshold the statement reports the count and
 *      passes no judgement, which infers nothing and so survives Hutchinson's
 *      actual objection (a pattern claim on n=3 with no control for terrain,
 *      heat or a badly-seated strap).
 *
 *   2. **`unknown` runs LEAVE THE DENOMINATOR, and the gap is named.**
 *      "None of 4 held the zone" when two had no heart rate is a **false
 *      statement**, and it is the one a free-tier runner would see most often.
 *      So the denominator is runs we measured, and the unmeasured ones are
 *      stated separately rather than silently folded in either direction.
 *
 * ⚠️ NO CAUSE AND NO ACTION, ever. Hard rule 8: we hold `hr_above_ceiling_pct`
 * and nothing else, so a limiter sentence ("your easy runs are averaging Zone
 * 3, so aerobic base isn't building") is a DIAGNOSIS this data cannot support.
 * And the plan does not change for one week's drift, so inventing an action
 * manufactures work. Wood: narrow the window, do not widen the verdict.
 *
 * ⚠️ NOT AI OUTPUT. Rule-engine derivation, so the surface carries no AIMark.
 */

/** One run's zone outcome. `unknown` means no heart rate, not "failed". */
export type RunZoneOutcome = 'held' | 'drifted' | 'unknown'

export interface ZoneWeekStatement {
  /** Runs we could actually measure. The denominator. */
  measured: number
  held: number
  drifted: number
  /** Runs with no heart rate. Named, never folded into the denominator. */
  unknown: number
  /** True once `measured >= ZONE_BLOCK_VERDICT_MIN_RUNS`. */
  verdict: boolean
  /** The sentence. Never null: the block does not hide. */
  line: string
  /** The gap, when there is one. Rendered as a second, quieter line. */
  gapLine: string | null
  /** Drives the moss/amber pair (P-01). `null` when there is nothing to colour. */
  tone: 'held' | 'drifted' | null
}

/**
 * Classify one run. A run is `unknown` unless we have a zone percentage for it;
 * a missing measurement is never read as a failure.
 *
 * ⚠️ `hr_above_ceiling_pct` is the DIRECTIONAL metric and the reason this does
 * not use `hr_in_zone_pct` symmetrically: drift has a direction, it is what
 * athletes do INSTEAD of easy, and a symmetric metric for an asymmetric
 * phenomenon mislabels about a quarter of cases (measured, see
 * `ZONE_DRIFT_ABOVE_CEILING_PCT`).
 */
export function classifyRun(aboveCeilingPct: number | null | undefined): RunZoneOutcome {
  if (aboveCeilingPct == null || !Number.isFinite(aboveCeilingPct)) return 'unknown'
  return aboveCeilingPct > ZONE_DRIFT_ABOVE_CEILING_PCT ? 'drifted' : 'held'
}

const COUNT_WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'] as const
/** Spelled out to the count the pattern actually reaches; a 7-day week caps it. */
function word(n: number): string { return COUNT_WORDS[n] ?? String(n) }
/** ⚠️ A general capitalise, not `.replace(/^n/, 'N')`. The first cut used that,
 *  which only ever uppercased "none" and shipped "two runs had no heart rate."
 *  with a lowercase t at the start of a sentence. */
function cap(sr: string): string { return sr.charAt(0).toUpperCase() + sr.slice(1) }

/**
 * Build the week's statement from this week's runs.
 *
 * @param outcomes one entry per run the runner completed this week
 */
export function zoneWeekStatement(outcomes: RunZoneOutcome[]): ZoneWeekStatement {
  const held     = outcomes.filter(o => o === 'held').length
  const drifted  = outcomes.filter(o => o === 'drifted').length
  const unknown  = outcomes.filter(o => o === 'unknown').length
  const measured = held + drifted
  const verdict  = measured >= ZONE_BLOCK_VERDICT_MIN_RUNS

  // The gap, stated plainly. Never a percentage and never an apology.
  const gapLine =
    unknown === 0 ? null
    : measured === 0 ? null                       // the whole line is about it below
    : unknown === 1 ? 'One run had no heart rate.'
    : `${cap(word(unknown))} runs had no heart rate.`

  // ── Nothing measured ────────────────────────────────────────────────────
  // Not silent. The board ruled an all-unknown week reports the missing data:
  // a free-tier runner, or anyone without a strap, sees this MOST, and a blank
  // space where the thesis should be teaches them the app has nothing to say.
  if (measured === 0) {
    return {
      measured, held, drifted, unknown, verdict: false, tone: null,
      line: unknown === 0
        ? 'No runs logged this week yet.'
        : unknown === 1
          ? 'No heart rate on this week’s run yet.'
          : 'No heart rate on this week’s runs yet.',
      gapLine: null,
    }
  }

  // ── Measured, but below the verdict threshold ───────────────────────────
  // The count, and nothing inferred from it. This is the case the board
  // separated out: stating what happened on two runs is not a pattern claim.
  if (!verdict) {
    const line = held === measured
      ? (measured === 1 ? 'Your run held the zone.' : `Both runs held the zone.`)
      : drifted === measured
        ? (measured === 1 ? 'Your run drifted above the zone.' : 'Both runs drifted above the zone.')
        : `${held} of ${measured} runs held the zone.`
    return { measured, held, drifted, unknown, verdict, gapLine, tone: drifted > 0 ? 'drifted' : 'held', line }
  }

  // ── The full statement ──────────────────────────────────────────────────
  if (drifted === 0) {
    return {
      measured, held, drifted, unknown, verdict, gapLine, tone: 'held',
      line: `All ${word(measured)} held the zone.`,
    }
  }
  if (held === 0) {
    // ⚠️ THE ZERO CASE. Wood: the failure of "none held the zone this week" is
    // not that it is harsh, it is that it is GLOBAL — it reads as a verdict on
    // the runner rather than on four runs. So the window is narrowed to the
    // runs themselves and the next one is named. No cause, no action.
    return {
      measured, held, drifted, unknown, verdict, gapLine, tone: 'drifted',
      // ⚠️ `None of this week's N runs`, NOT the measured count in the leading
      // slot. The first cut interpolated `word(measured)` there, so a week in
      // which FOUR runs drifted read "four of this week's runs stayed in the
      // zone" — the exact opposite of the truth, in the one sentence a
      // struggling runner reads. Pinned by a test below.
      line: `None of this week’s ${measured} runs stayed in the zone. The next easy one is the one to hold.`,
    }
  }
  return {
    measured, held, drifted, unknown, verdict, gapLine, tone: 'drifted',
    line: `${held} of ${measured} runs held the zone. ${
      drifted === 1 ? 'One drifted.' : `${cap(word(drifted))} drifted.`
    }`,
  }
}
