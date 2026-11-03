import type { Violation } from '@/lib/plan/invariants'

/**
 * RESHAPE-SCOPE-TO-CHANGE-01 / §134 — THE SINGLE OWNER of "did this reshape introduce
 * this violation, or was it already there?"
 *
 * 🔴 WHY THIS EXISTS. `/api/adjust-plan` refused on EVERY error-severity violation in the
 * plan, so one historical defect anywhere froze adjustment permanently. Measured against
 * production on 2026-11-03: **18 of 39 live plans, 46% of runners, refused on every
 * adjustment** — and after `RESHAPE-VALIDATOR-KIND-01` removed the 3 base-build plans that
 * were being judged by the wrong constitution entirely, **15 of 39, 38%.**
 *
 * The reshape was being blamed for defects it neither caused nor could fix. This file is
 * the generalisation of an argument `validateReshapedPlan` already makes twice, in writing,
 * for `INV-PLAN-COPY-MATCHES-SESSIONS` and `INV-PLAN-LONG-IS-LONGEST-MINS`: *"a
 * pre-existing generation defect, not this reshape's responsibility."* §93 and §94 rule the
 * same way at the level of doctrine — a pre-existing breach is **declared debt, not an
 * exemption**, and is recorded rather than attributed to the change that revealed it.
 *
 * ⚠️ IT IS NOT A WEEK SCOPE, AND THAT WAS THE TEMPTING WRONG ANSWER. Scoping to the touched
 * week would BLESS a reshape on a plan broken elsewhere. This asks the narrower and more
 * honest question — what did the reshape CHANGE — so a breach the reshape creates is
 * refused wherever in the plan it lands.
 */

/**
 * The fields that identify a violation for blocking purposes.
 *
 * 🩹 WILLY'S FIRST BINDING CONDITION (Coaching Board, 2026-11-03), and it is the whole
 * safety argument: **`actual` and `expected` are IN the fingerprint.** A pre-existing
 * long-run breach that goes from 55% of the week to 80% has a different fingerprint and is
 * therefore an introduced breach. His words on the record: *"Do not simplify it later to
 * code-and-week; it would read tidier and it would bless a worsening."*
 *
 * ⚠️ `day` IS DELIBERATELY ABSENT, AND THIS WAS SETTLED BY MEASUREMENT RATHER THAN TASTE.
 * The first cut included it and reported 3 of 18 plans still refused. Two were artefacts of
 * its own key — the SAME breach travelling with its session, byte-identical message, new
 * day: `"Cruise intervals"` wed → sat carrying `INV-PLAN-CATALOGUE-LINK`, and
 * `"Long run - Zone 2"` sun → mon carrying `INV-PLAN-EASY-PACE-PRESENT`. A reorder MOVES
 * sessions; a breach that rides along is not a new breach. The third was real
 * (`INV-PLAN-QUALITY-LONG-SPACING`, absent from that week before the swap) and is still
 * refused.
 *
 * ⚠️ AND DROPPING `day` DOES NOT WEAKEN §18, WHICH IS THE LIVE HAZARD. Measured across
 * every stored plan declaring blocked days: a non-rest session moved onto one is still
 * refused in **29 of 29** plans where `INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS` fires, because
 * that violation carries the day in `actual`. The 3 remaining are base-build plans where
 * the invariant does not fire at all, before or after.
 */
export const RESHAPE_BLOCKING_FINGERPRINT_FIELDS = [
  'code', 'week', 'severity', 'actual', 'expected', 'message',
] as const

/** The identity of a violation for blocking purposes. NUL-joined because a message may
 *  contain any printable character, and a separator that can appear inside a field is a
 *  separator that can make two different violations collide. */
export function violationFingerprint(v: Violation): string {
  return RESHAPE_BLOCKING_FINGERPRINT_FIELDS
    .map(f => String((v as unknown as Record<string, unknown>)[f] ?? ''))
    .join('\u0000')
}

export interface ReshapeViolationSplit {
  /**
   * What the reshape is answerable for: a violation whose exact fingerprint was not in the
   * before-plan, or a violation the plan now carries MORE of than it did. The route refuses
   * on this and nothing else.
   */
  blocking: Violation[]
  /**
   * Breaches the plan already carried, unchanged. The reshape proceeds over these — and
   * they are RECORDED, never silently swallowed.
   *
   * 🩹 WILLY'S SECOND BINDING CONDITION: *"If 17 plans are carrying load breaches we have
   * decided not to refuse on, I want to be able to list them tomorrow morning."* Not a
   * counter — the codes and the weeks. Tracked as `STORED-PLAN-DEBT-REPAIR-01`.
   */
  preexisting: Violation[]
}

/**
 * Split the after-plan's violations into what this reshape introduced and what it inherited.
 *
 * A MULTISET, not a set: if a week carried two instances of a code before and three after,
 * the third is introduced. A set would have called it pre-existing and let a reshape add
 * breaches to a rule the plan was already breaking.
 *
 * Both arguments must come from the SAME validator with the SAME week scope, or the
 * comparison is between two different questions. `runAdjustmentEngine` is the only caller
 * and holds both plans, so this needs no I/O.
 */
export function classifyReshapeViolations(
  before: readonly Violation[],
  after: readonly Violation[],
): ReshapeViolationSplit {
  const budget = new Map<string, number>()
  for (const v of before) {
    const k = violationFingerprint(v)
    budget.set(k, (budget.get(k) ?? 0) + 1)
  }

  const blocking: Violation[] = []
  const preexisting: Violation[] = []
  for (const v of after) {
    const k = violationFingerprint(v)
    const left = budget.get(k) ?? 0
    if (left > 0) {
      budget.set(k, left - 1)
      preexisting.push(v)
    } else {
      blocking.push(v)
    }
  }
  return { blocking, preexisting }
}
