// FIRSTRUN-MISSED-01 — the single owner of what a `session_completions` row is
// allowed to SAY.
//
// WHY THIS EXISTS. Two unrelated vocabularies were sharing one column. The
// post-run flow writes a FATIGUE LEVEL (`Fresh | Fine | Heavy | Wrecked`); the
// missed-session sheet writes a SKIP REASON (`Injury / illness | Too tired |
// Life got busy | Bad weather`). Both went into `fatigue_tag`, and every fatigue
// consumer matches only the first set, so the sets are disjoint by construction.
//
// ⚠️ THE HARM WAS NOT THAT THE REASON WENT UNREAD — that claim was retracted.
// `DashboardClient` fires `POST /api/adjust-plan` with `skipReason` on the way
// past, so §21's content filter and the injury volume reduction DO run
// (`planAdjustment.ts:586`). The harm is that the stored copy landed in the
// fatigue column, where `DashboardClient`'s fatigue trend pushes ANY truthy
// `fatigue_tag` into a five-entry window and `heavyFatigue` reads the last
// three: a `'Life got busy'` takes a slot and DILUTES the trigger. A dead value
// in a fixed-size window is not inert, it is displacement.
//
// The type already had an owner (`reframeRiskGate.ts`) while the VALUES were
// written out by hand in seven places. A type without its values is exactly the
// split that lets two lists drift — this module owns both.

/** The post-run fatigue scale, as the UI offers it. */
export const FATIGUE_TAGS = ['Fresh', 'Fine', 'Heavy', 'Wrecked'] as const
export type FatigueTag = typeof FATIGUE_TAGS[number]

/**
 * The missed-session reasons, as the sheet offers them.
 *
 * ⚠️ THESE STRINGS ARE A WIRE FORMAT, not labels. `planAdjustment.ts` matches
 * `'Injury / illness'` exactly, and both skip handlers special-case
 * `'Too tired'` to suppress the adjustment call. Changing a string here changes
 * behaviour in another module — rename only with those three sites in hand.
 */
export const SKIP_REASONS = [
  'Injury / illness', 'Too tired', 'Life got busy', 'Bad weather',
] as const
export type SkipReason = typeof SKIP_REASONS[number]

/**
 * `'Cooked'` is a LEGACY fatigue value: `FATIGUE_HIGH_TAGS` in
 * `lib/coaching/constants.ts` still matches it, but no UI has offered it for
 * some time. Listed here so a historical row is recognised as fatigue rather
 * than mistaken for a stray skip reason during the backfill.
 */
const LEGACY_FATIGUE_TAGS = ['Cooked'] as const

export function isFatigueTag(v: unknown): v is FatigueTag {
  return typeof v === 'string'
    && ((FATIGUE_TAGS as readonly string[]).includes(v)
      || (LEGACY_FATIGUE_TAGS as readonly string[]).includes(v))
}

export function isSkipReason(v: unknown): v is SkipReason {
  return typeof v === 'string' && (SKIP_REASONS as readonly string[]).includes(v)
}
