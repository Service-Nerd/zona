// injuryScope.ts — THE SINGLE OWNER of "does §12's injury volume cap govern this
// runner?", and of the injury-keyword match underneath it.
//
// 🔴 WHY THIS MODULE EXISTS (INJURY-GUARD-PREDICATE-01, 2026-09-25).
//
// The predicate was written out FOUR times: once in `ruleEngine.ts` (the
// producer) and three times in `invariants.ts` (the checkers). All three copies
// in the validator carried the same justification —
//
//     "Matches the producer's owner BY VALUE, not by a second copy of the
//      logic ... because the checker cannot import the producer (circular)."
//
// — which is correct about the cycle (`ruleEngine.ts` imports `invariants.ts`)
// and wrong about the conclusion. A leaf module both sides import has no cycle.
// This is `deloadCadence.ts`'s pattern, and it is here for the same reason: one
// fact with four writers agrees only by copy-paste, and **one of them had
// already drifted**:
//
//     site                              predicate                'Shin splints'
//     ruleEngine.ts (producer)          hasInjury(...)            MATCHED
//     invariants.ts §90 delivered arms  includes('shin_splints')  ✗ MISSED
//     invariants.ts RUNWALK-CAP         includes('shin')          matched (luck)
//     invariants.ts LR-SHORTFALL-CAUSE  includes('shin')          matched (luck)
//
// So the engine capped a shin-splints runner's volume and the two invariants
// meant to VERIFY that cap never looked — for nine days, while the comment two
// lines above them claimed the predicates matched exactly.
//
// ⚠️ THE SCOPE IS UNCHANGED AND DELIBERATELY NARROW. §12 names knee and
// shin-splint histories specifically: those are the tissues whose binding
// constraint is ACUTE weekly load. Achilles, hip flexor and back histories are
// real and are NOT governed by this cap. Widening it is a Coaching Board
// question (INJURY-DELIVERED-COVERAGE-01), not a refactor, and this module does
// not pre-empt it.
//
// ⚠️ NOT the same question as HILL_RESTRICTING_INJURIES (knee, itb, achilles,
// shin, calf, plantar), which governs hill exclusion, nor as the hill copy line
// in `DashboardClient`. Three different questions; do not collapse them here.
//
// Takes `readonly string[]` rather than a `GeneratorInput` so both a wizard
// input and a stored `plan.meta.injury_history` can ask it the same way — the
// producer holds the former and the checkers hold the latter, and a shape that
// only one of them can supply is how the duplication started.

import { GENERATION_CONFIG } from './generationConfig'

/**
 * Does this injury history include `keyword`?
 *
 * ⚠️ FIXED IN THE ENGINE 2026-09-16 — THREE OF THE SIX WIZARD VALUES NEVER
 * MATCHED. `GeneratePlanScreen` offers: Achilles · Knee · Back · Hip · Shin
 * splints · Plantar fasciitis. The keywords here are snake_case, and the old
 * body was a raw `i.toLowerCase().includes(keyword)`, so:
 *
 *   wizard value         keyword               matched?
 *   'Knee' / 'Achilles' / 'Back'               yes
 *   'Shin splints'       'shin_splints'        NO  — space vs underscore
 *   'Plantar fasciitis'  'plantar_fasciitis'   NO  — space vs underscore
 *   'Hip'                'hip_flexor'          NO  — different word
 *
 * ── WHAT THAT ACTUALLY COST, corrected 2026-09-25 (RULEENGINE-HIP-COMMENT-01) ─
 *
 * 🔴 THE ORIGINAL VERSION OF THIS NOTE LISTED THREE CASUALTIES AND ONE OF THEM
 * WAS ALREADY WRONG WHEN IT SHIPPED. It read: "what silently did not apply:
 * §12's injury volume cap for shin splints ..., **the no-quality-in-base rule
 * for hip**, and the 120-minute long-run cap for plantar fasciitis."
 *
 *   · shin splints -> TRUE, and the most expensive of the three. §12's volume
 *     cap, §90's delivered levers and §2's bounceback bounding all missed them.
 *     (The VALIDATOR kept missing them for another nine days — that half was
 *     only closed by INJURY-GUARD-PREDICATE-01, which is why this file exists.)
 *   · plantar fasciitis -> TRUE. `ruleEngine.ts` caps their long run at 120
 *     minutes, verified: a plantar/back marathon plan's longest session is 126
 *     minutes against 207 for the same runner with no injury history.
 *   · hip -> **FALSE, and misleading in two directions at once.**
 *
 * The hip rule was `if (hasInjury(input, 'hip_flexor') && phase === 'base')
 * quality = false`, on an `allowQuality` the single call site never
 * destructured. So the matcher was not what stopped it — **it could not have
 * fired even spelled correctly.** `CB-HSR-AVOID-01` (895a668) deleted it hours
 * after this note was written, and this note was not updated.
 *
 * ⚠️ MEASURED BEFORE BELIEVING THE DELETION'S OWN REASONING, because a premise
 * in a commit message is not evidence. Across **45,776 generated plans** a base
 * week carries **ZERO** `type: 'quality'` sessions. The 28,084 `type: 'hard'`
 * sessions that DO appear there are **100% the 5K time trial** — §-sanctioned
 * deload-week recalibration, not prescribed quality. So "no quality in base"
 * genuinely could never subtract anything, and the rule is correctly gone.
 * `baseIsAllEasy.test.ts` holds that premise shut; if it ever goes red, this
 * deletion is worth re-opening as a Coaching Board question.
 *
 * ⚠️ DO NOT "RESTORE" THE SIBLING ACHILLES RULE either. §110 struck it down
 * against §21, which prescribes SUBSTITUTION ("progression runs or flat tempo at
 * equivalent intensity"), not removal. Wiring it back re-imposes exactly what
 * the board removed.
 *
 * Separator-insensitive, and bidirectional so the wizard's shorter label matches
 * the more specific keyword ('Hip' -> 'hip_flexor'). The reverse direction needs
 * >= 3 characters so a stray short value cannot match everything.
 */
export function hasInjuryKeyword(history: readonly string[] | null | undefined, keyword: string): boolean {
  const norm = (t: string) => t.toLowerCase().replace(/[_\s]+/g, ' ').trim()
  const k = norm(keyword)
  return (history ?? []).some(raw => {
    const v = norm(String(raw))
    return v.includes(k) || (v.length >= 3 && k.includes(v))
  })
}

/**
 * The keywords §12's volume cap names. Exported so a test can assert the
 * producer and the checkers are reading THIS list and not a restatement of it.
 */
export const VOLUME_CAPPED_INJURY_KEYWORDS = ['knee', 'shin_splints'] as const

/**
 * Does §2/§12's injury VOLUME cap govern this runner?
 *
 * The one answer. `ruleEngine.ts` gates the volume curve, the §90 delivered
 * levers, the long-run trim and the shortfall note on it; `invariants.ts` gates
 * INV-PLAN-DELOAD-BOUNCEBACK-BOUNDED, INV-PLAN-INJURY-CAP-DELIVERED,
 * INV-PLAN-RUNWALK-CAP-NOT-REDUCED and INV-PLAN-LR-SHORTFALL-CAUSE on it.
 */
export function hasVolumeCappedInjuryHistory(history: readonly string[] | null | undefined): boolean {
  return VOLUME_CAPPED_INJURY_KEYWORDS.some(k => hasInjuryKeyword(history, k))
}

/**
 * Does §90's TIGHTER DELIVERED cap govern this runner? (§90 Amendment 2,
 * Coaching Board 2026-09-25, INJURY-DELIVERED-COVERAGE-01.)
 *
 * 🔴 A DIFFERENT QUESTION FROM `hasVolumeCappedInjuryHistory`, and the difference
 * is the whole ruling. §12's PRODUCER cap is knee/shin — that is what the engine
 * applies to the volume curve, and this ruling does not touch it. This predicate
 * is the CHECKER's cohort for the delivered week, which the board widened to the
 * load-bearing injuries because tendon and bone respond to the RATE of load
 * change.
 *
 * Measured at the sitting, 1,478 plans, share warned by either delivered arm:
 *
 *     healthy   34.6%      achilles  0.0% -> 43.8%
 *     knee      10.2% -> 20.4%   back      0.0% -> 29.4%
 *     shin      10.2% -> 20.4%   hip       0.0% -> 34.6%
 *                                plantar   0.0% -> 39.3%
 *
 * ⚠️ 43.8% IS THE TOP OF THE ACCEPTABLE BAND and is recorded so nobody has to
 * rediscover it: §94's own first draft fired at 44.4% and was scoped down before
 * it shipped. It is accepted here because it decomposes as healthy's 34.6% plus
 * ~9pp from a deliberately tighter cap — a tighter threshold that did not fire
 * more often would not be tighter. **Anyone widening this list again starts from
 * that number.**
 */
export function hasDeliveredCapInjury(history: readonly string[] | null | undefined): boolean {
  return GENERATION_CONFIG.DELIVERED_CAP_INJURIES.some(k => hasInjuryKeyword(history, k))
}
