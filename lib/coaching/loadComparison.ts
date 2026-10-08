// POSTRUN-METRIC-PREF-01 — the single owner of "which axis does the planned-vs-actual
// line speak in, and did the runner fall short on it?"
//
// The decision lives HERE; the card only renders it. Same split as
// `driftContextFor` ("Selection lives here; the DECISION lives in driftContextFor"),
// and for the same reason: `buildScoreExplanations` sits inside a 14k-line
// 'use client' module that cannot be imported under `environment: 'node'`, so a rule
// written inline there can only ever be checked by grepping its source, and a source
// assertion passes on a comment.
//
// 🔴 WHAT WAS WRONG. The line preferred `planned_load_km` whenever it was non-null,
// so a runner who had set the session to MINUTES was still told "Planned 8.5km, ran
// 9.9km". Founder: "we need to consider duration there too, as i may have it set
// based on duration." ADR-015 / INV-PREF-001 require the preference to propagate
// everywhere; this surface was missed.
//
// 📐 MEASURED ON ALL 83 LIVE `run_analysis` ROWS (service-role read, 2026-10-08),
// and the measurement is stronger than the filing:
//   - 81 are km-comparable
//   - 9 are minutes-comparable
//   - ALL NINE of those are km-comparable too
//   - so the duration branch was reachable on ZERO live rows. It had never run.
//
// ⚠️ THE NUMBERS FOLLOW THE PREFERENCE. THE VERDICT DOES NOT. §66 Amendment 1:
// "Distance still wins where the session carried one... A fast runner covering 95%
// of the distance in 60% of the time is not short." The ownership seam settles it:
// design owns the ENCODING (the unit the runner reads), coaching owns the MEANING
// (whether they fell short). So the preference chooses the axis and §66 keeps the
// judgement.
//
// 🔴 AND THE AXES GENUINELY CONTRADICT EACH OTHER, which is why `short` is nullable
// rather than boolean: of the 9 live rows comparable on both, 2 (22%) disagree about
// whether the run was short. Asserting one of them would be a NEW COACHING CLAIM made
// by a display fix, so where they disagree the verdict is WITHHELD and the numbers
// stand alone. Routed to the Coaching Board as the open question: which axis owns
// "Short." when the runner has chosen the other one.

/**
 * 0.3 km, matching the existing distance tolerance.
 * A §66-style forgiveness band, not a coaching threshold: it answers "is this
 * difference worth a word?", never "should the plan change?".
 */
export const DISTANCE_TOLERANCE_KM = 0.3

/**
 * 2 minutes is the time-axis SIBLING of the 0.3 km band, not a second opinion: at
 * the engine's easy pace (~6.3 min/km) 0.3 km IS about two minutes, so the two axes
 * forgive the same amount of session rather than two different amounts.
 */
export const DURATION_TOLERANCE_MINS = 2

export type LoadAxis = 'distance' | 'duration' | 'none'

export interface LoadComparison {
  /** The axis the line should speak in. `none` when neither is comparable. */
  axis: LoadAxis
  /** Within tolerance on `axis` — "hit the planned …". */
  onTarget: boolean
  /**
   * `true` short, `false` not short, **`null` the two axes disagree and no verdict
   * may be asserted**. Null is a deliberate third state, not a missing value.
   */
  short: boolean | null
}

export interface LoadInputs {
  plannedKm:   number | null | undefined
  actualKm:    number | null | undefined
  plannedMins: number | null | undefined
  actualMins:  number | null | undefined
}

export function compareLoad(
  { plannedKm, actualKm, plannedMins, actualMins }: LoadInputs,
  preferredMetric: 'distance' | 'duration' = 'distance',
): LoadComparison {
  // 🔴 `actualKm > 0`, ADDED BY HK-ZERO-DISTANCE-RUN-01 (2026-10-08). Since
  // `/api/health/ingest` now accepts an indoor or treadmill run with no distance, those
  // rows arrive as `actual_load_km = 0` — and without this the line read
  // **"Planned 8.5km, ran 0km. Short."** about a run that covered real ground on a
  // treadmill. A stored zero means UNMEASURED, never "covered no ground": that is the
  // `distance_km ?? 0` lesson (SESSION-KM-01/02) arriving on the actual side.
  //
  // ⚠️ It falls through to the DURATION axis, which is the honest one for such a run and
  // is exactly what §80 says the prescription is for a duration-anchored runner.
  const kmComparable   = plannedKm   != null && actualKm   != null && actualKm > 0
  const minsComparable = plannedMins != null && actualMins != null

  const kmShort   = kmComparable   && (actualKm!   - plannedKm!)   <= -DISTANCE_TOLERANCE_KM
  const minsShort = minsComparable && (actualMins! - plannedMins!) <= -DURATION_TOLERANCE_MINS

  // §66 keeps the verdict. It is withheld only when the axes contradict each other.
  const short: boolean | null =
    kmComparable && minsComparable ? (kmShort === minsShort ? kmShort : null)
    : kmComparable                 ? kmShort
    : minsComparable               ? minsShort
    : null

  // The preference only gets to choose an axis that EXISTS. A runner who asked for
  // minutes on a session carrying no duration is shown the distance rather than
  // "No distance data." — the preference is about encoding, never about withholding.
  const axis: LoadAxis =
    preferredMetric === 'duration' && minsComparable ? 'duration'
    : kmComparable                                   ? 'distance'
    : minsComparable                                 ? 'duration'
    : 'none'

  const onTarget =
    axis === 'distance' ? Math.abs(actualKm!   - plannedKm!)   < DISTANCE_TOLERANCE_KM
    : axis === 'duration' ? Math.abs(actualMins! - plannedMins!) < DURATION_TOLERANCE_MINS
    : false

  return { axis, onTarget, short }
}
