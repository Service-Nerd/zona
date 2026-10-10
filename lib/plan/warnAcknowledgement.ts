/**
 * §44 / §52 — THE SECOND STEP OF A TWO-STEP PATTERN THAT ONLY EVER HAD ONE.
 *
 * ── THE DEFECT (`PREP-ACK-NO-WRITER-01`) ────────────────────────────────────
 * §44 does not describe a refusal. It describes a **two-step pattern**, in as many
 * words: *"warn: refuse generation unless input includes `acknowledged_prep_warning:
 * true`. Return the warning with alternatives. This is a two-step pattern: first call
 * surfaces the warning, second call (with explicit acknowledgment) generates."*
 *
 * **Step two was never built.** `/api/generate-plan` returns
 * `requires_acknowledgment: true`; `GeneratePlanScreen` read it **zero times**; and
 * `acknowledged_prep_warning` was written only by `charityCohort.ts` (fixtures) and
 * `useCaseEnvelope.ts` (a harness). `git log -S` found no UI writer, ever. A runner in
 * the warn band was **refused with no way to proceed**, while the engine was explicitly
 * built to admit them.
 *
 * 🔴 **BOTH TWINS WERE DEAD.** §52's `acknowledged_days_warning` is the same documented
 * pattern with the same missing step, and the route's own comment says so. Fixing one
 * and leaving the other is this repo's most-recorded failure class, so this owns BOTH.
 *
 * ⚠️ MEASURED ON A REAL RUNNER, and the band is GOAL-DEPENDENT — which is why two
 * synthetic grids reported "no defect": every row used `goal: 'finish'`, and §44 says
 * *"for `goal: 'finish'`, only `block` thresholds apply."* A live time-goal marathoner
 * at 12 weeks refused; the same input with the flag generated a 13-week plan.
 *
 * ── WHAT THIS MODULE IS, AND DELIBERATELY IS NOT ────────────────────────────
 * 🔴 **IT AUTHORS NO COPY, AND MY FIRST CUT DID.** The warn result already carries its
 * own `message` and `alternatives` (`validatePrepTime` / `validateDaysAvailable`), so a
 * title/line/why here would have been **a second copy of a sentence that already has an
 * owner** — the duplication doctrine this repo keeps paying for. The Coaching Board's
 * copy conditions are therefore implemented **in `inputs.ts`, where the message lives**,
 * not here.
 *
 * What was genuinely missing and lives here: **the name of the field the second call
 * must carry**, so the client cannot guess it, and the consent label, which is the one
 * string no existing owner has because no existing surface asked for consent.
 *
 * 🏃 **Hutchinson, binding (Coaching Board 2026-10-10, `PREP-ACK-WARN-OFFER-01`): the
 * acknowledgment is a DISTINCT PRIOR STEP**, never a checkbox and never a post-hoc
 * notice. The refusal screen is step one; this label is step two. A warn-band runner
 * must not reach a plan in one tap — which is why the label is a consent
 * (*"I know it is tight"*) and not a build (*"Build my plan"*).
 *
 * 🩹 **Willy's condition was checked and HOLDS:** nothing scales the ramp to fit the
 * runway. `LONG_RUN_PROGRESSION_CAP_PCT` is a constant, and `runwayWeeks` reaches only
 * the base-build sizing and §113's readiness arithmetic. **A compressed block is as safe
 * per week as a long one; it arrives at a lower peak.** So the copy may talk about the
 * goal and the recovery margin, and may NOT imply added injury risk we cannot evidence.
 *
 * ⚠️ No em dashes in anything the runner reads (founder, 2026-09-11).
 */

/** Which documented two-step pattern this is. The flag differs; the shape does not. */
export type WarnKind = 'prep' | 'days'

export type AckField = 'acknowledged_prep_warning' | 'acknowledged_days_warning'

/**
 * THE SINGLE OWNER of "which field does the second call set".
 *
 * ⚠️ The client must not hardcode either name. Both are consumed by
 * `lib/plan/inputs.ts` and stripped before the input is stored, so a typo would read
 * as a runner who never acknowledged anything, which is silent by construction.
 */
export const ACK_FIELD: Record<WarnKind, AckField> = {
  prep: 'acknowledged_prep_warning',
  days: 'acknowledged_days_warning',
}

/**
 * The step-two action label.
 *
 * ⚠️ IT IS A CONSENT, NOT A BUILD, and that is Hutchinson's condition rendered as a
 * verb. *"Build my plan"* would make step two indistinguishable from step one and turn
 * a documented two-step pattern into a button that happens to appear twice.
 */
export const ACK_LABEL: Record<WarnKind, string> = {
  prep: 'I know it is tight. Build it anyway.',
  days: 'I know it is few days. Build it anyway.',
}

/** Which warn kind a 422 payload describes, or `null` when it is not an acknowledgeable
 *  warning at all. One predicate, so the route and the client cannot disagree. */
export function warnKindOf(
  payload: { reason?: unknown; prep?: unknown; days?: unknown } | null | undefined,
): WarnKind | null {
  if (!payload || payload.reason !== 'warn_unacknowledged') return null
  if (payload.prep) return 'prep'
  if (payload.days) return 'days'
  return null
}
