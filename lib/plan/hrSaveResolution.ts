import { resolveMaxHr } from './maxHrGuard'

export type MaxHrProvenance = 'observed' | 'user_confirmed' | undefined

/**
 * PLAN-META-HR-DIVERGENCE-01 (2026-11-08) — THE ONE OWNER OF "WHAT DOES THE HR FORM'S SAVE MEAN".
 *
 * 🔴 WHY IT EXISTS. `HRZonesSection` resolved §50's guard to decide which zone table to SHOW
 * — including a "floored" note telling the runner their max had been rejected — and then
 * `handleSave` handed the caller the RAW typed number. `handleHrSave` passed that raw number to
 * `applyHrToPlan`, which rewrote every session's `hr_target` from it, and stamped it as
 * `meta.hr_derived_max`. Meanwhile `effectiveMaxHR` guarded the same value again for display.
 * **The form showed guarded zones and saved the unguarded number**, and the header and the
 * session band diverged — which is exactly the defect `PLAN-ZONE-VS-HRTARGET-01` was fixed to
 * close, reached by a different route.
 *
 * 🔴 AND THE PROVENANCE WAS WORSE THAN THE NUMBER. `handleHrSave` stamped
 * `max_hr_source: 'user_confirmed'` UNCONDITIONALLY, on the true-but-insufficient reasoning that
 * a max the runner types is a confirmation. It could not tell a typed max from an untouched one.
 * So a runner opening the sheet to change only their RESTING HR promoted a device-observed FLOOR
 * to a confirmed max — the single thing §50's asymmetry exists to prevent, because an observed
 * value below the age estimate says nothing about the ceiling and trusting it drags every zone
 * DOWN. The form already knew (`editedMax`); the handler had no way to.
 *
 * 📐 LIVE, 2026-11-08 (production read): of 53 `user_settings` rows, 37 carry a max, **24 are
 * `observed`** and **3 sit below their Tanaka estimate** — the live floor case. 0 above the 15%
 * plausibility tolerance. 5 have no `birth_year` and so cannot be guarded at all.
 *
 * ⚠️ WHY AN OWNER RATHER THAN A THREADED VALUE. Passing the form's answer to the handler would
 * fix today's instance; it would not stop the two sides computing different answers tomorrow.
 * Both call this, so "the zones the runner just looked at" and "the zones the plan gets" are the
 * same computation by construction. ⚠️ `tsc` could not have caught the original: a 2-argument
 * callback is assignable to a 3-argument prop, so widening the signature compiles clean.
 *
 * ⚠️ `user_settings.max_hr` keeps the RAW typed value, deliberately. It is the record of what the
 * runner said; `resolveMaxHr` decides what to trust at every read (§50's single-owner pattern),
 * and storing the guarded value would destroy the evidence the guard reads.
 */
export function resolveHrSave(a: {
  /** What the form currently holds — what the runner would be saving. */
  typedMax: number
  /** What `user_settings` held before this save. `null` when they have never set one. */
  storedMax: number | null
  /** The provenance that stored value arrived with. */
  storedSource: MaxHrProvenance
  /** The age §50 may guard against, or `null` when there is none (no or implausible birth year). */
  age: number | null
}): {
  /** The provenance to persist: a typed-over max is a confirmation, an untouched one is not. */
  maxSource: 'observed' | 'user_confirmed'
  /** The max the PLAN and the zone table are built from — §50-guarded where an age allows it. */
  guardedMax: number
  /** True when the guard rejected the typed value, so a surface can say so. */
  floored: boolean
} {
  const edited = a.storedMax == null || a.typedMax !== a.storedMax
  // §50 (HR-MAX-01): a value the runner typed over the stored one IS a confirmation, and is
  // trusted even below the age estimate (genuine low-max athletes). An untouched value keeps
  // the provenance it arrived with, and `observed` defaults in for a stored max with none —
  // an unattributed max is a floor, not a confirmation, which is the safe direction.
  const maxSource: 'observed' | 'user_confirmed' = edited ? 'user_confirmed' : (a.storedSource ?? 'observed')
  const guardedMax = a.age != null
    ? resolveMaxHr(a.typedMax, a.age, maxSource).effectiveMax
    : a.typedMax
  return { maxSource, guardedMax, floored: guardedMax !== a.typedMax }
}

/** The age §50's guard may be applied with, or `null` when there is none to guard against.
 *  The 10-100 bound is a sanity window on a self-reported birth year, not a coaching value:
 *  outside it Tanaka is meaningless and the guard is simply not applied. One owner, because
 *  this predicate existed in `HRZonesSection` and `DashboardClient` and was about to exist in
 *  a third place. */
export function hrGuardableAge(birthYear: number | null | undefined, now: Date = new Date()): number | null {
  if (!birthYear) return null
  const age = now.getFullYear() - birthYear
  return age >= 10 && age <= 100 ? age : null
}
