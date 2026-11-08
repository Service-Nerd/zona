import { resolveMaxHr } from './maxHrGuard'

export type MaxHrProvenance = 'observed' | 'user_confirmed' | undefined

/**
 * PLAN-META-HR-DIVERGENCE-01 (2026-11-08) — THE ONE OWNER OF "WHAT MAX DOES THE PLAN GET".
 *
 * 🔴 THE DEFECT, NARROWED BY CODE REVIEW. `handleHrSave` passed the RAW typed max to
 * `applyHrToPlan`, which rewrote every session's `hr_target` from it and stamped it as
 * `meta.hr_derived_max`, while `effectiveMaxHR` guarded the same value for display. §50's UPPER
 * bound — `MAX_HR_PLAUSIBILITY_DEVIATION_PCT`, above which a rate is a sensor artefact and not
 * an effort — therefore applied to what the runner SEES and not to what the plan is built from.
 * That is the `PLAN-ZONE-VS-HRTARGET-01` shape: a card reading a band the plan does not hold.
 *
 * 🔴 AND THE BIGGER FINDING IS WHAT THIS IS **NOT**. My first cut also made the provenance
 * conditional — a typed-over max confirms, an untouched one keeps `observed` — reasoning that
 * editing only the RESTING HR should not promote a device floor. **`/code-review` found that this
 * breaks a founder-approved affordance, and `git log -S` settled it: the warning copy and the
 * unconditional `user_confirmed` stamp LANDED IN THE SAME COMMIT** (`c44e0e53`, HR-MAX-01,
 * 2026-08-31). The form says, in as many words: *"Zones use {estimate}. If {typed} really is your
 * max, tap Save to confirm it."* **The display and the save are deliberately different, and the
 * copy explains the difference.** Making the provenance conditional turned that sentence into a
 * lie and left a genuine low-max athlete no way to confirm at all.
 *
 * ⚠️ SO THE LOWER BOUND IS NOT GUARDED HERE, ON PURPOSE. A save IS a confirmation (§50), and
 * `resolveMaxHr` with `'user_confirmed'` trusts a below-estimate max while still rejecting an
 * implausibly high one — exactly the asymmetry §50 ratified. Whether an UNEDITED save should also
 * count as a confirmation is a §50 doctrine question, filed as `HR-SAVE-UNEDITED-CONFIRMS-01`
 * (🏃 COACHING BOARD), not mine to settle inside a defect fix.
 *
 * 📐 LIVE, 2026-11-08 (production read): of 53 `user_settings` rows, 37 carry a max, **24 are
 * `observed`** and **3 sit below their Tanaka estimate**; **0 above the 15% tolerance** — so the
 * defect this fixes is latent rather than realised. Stated plainly, because the opposite claim
 * would have been the easier one to write.
 *
 * ⚠️ `user_settings.max_hr` keeps the RAW typed value, deliberately. It is the record of what the
 * runner said; `resolveMaxHr` decides what to trust at every read (§50's single-owner pattern),
 * and storing the guarded value would destroy the evidence the guard reads.
 */
export function resolveHrSave(a: {
  /** What the form holds — what the runner is saving. */
  typedMax: number
  /** The age §50 may guard against, or `null` when there is none. */
  age: number | null
}): {
  /** The provenance to persist. A save IS a confirmation — see the docblock for why this is
   *  not conditional, and what was broken by making it so. */
  maxSource: 'user_confirmed'
  /** The max the PLAN is built from. For a confirmed max that is §50's UPPER bound only. */
  guardedMax: number
  /** True when the guard rejected the typed value. */
  floored: boolean
} {
  const maxSource = 'user_confirmed' as const
  const guardedMax = a.age != null
    ? resolveMaxHr(a.typedMax, a.age, maxSource).effectiveMax
    : a.typedMax
  return { maxSource, guardedMax, floored: guardedMax !== a.typedMax }
}

/**
 * The age §50's guard may be applied with, or `null` when there is none to guard against.
 *
 * The 10-100 bound is a sanity window on a self-reported birth year, not a coaching value:
 * outside it Tanaka is meaningless and the guard is simply not applied. One owner, because this
 * predicate lived in `HRZonesSection` and in `DashboardClient` and was about to exist in a third
 * place — and two copies of a predicate deciding whether a guard applies is how a screen and a
 * plan come to disagree.
 */
export function hrGuardableAge(birthYear: number | null | undefined, now: Date = new Date()): number | null {
  if (!birthYear) return null
  const age = now.getFullYear() - birthYear
  return age >= 10 && age <= 100 ? age : null
}
