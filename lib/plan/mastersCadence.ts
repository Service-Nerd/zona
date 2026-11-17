// mastersCadence.ts — the single owner of "does §3's masters recovery cadence apply?".
//
// 🔴 IT EXISTS BECAUSE THE QUESTION WAS ASKED IN THREE PLACES AND AN ABSENT AGE ANSWERED
// DIFFERENTLY IN EACH (MAXHR-AGE-ABSENT-01, Coaching Board 2026-11-17).
//
//   · `ruleEngine.ts`         — `input.age >= 45`         → absent is FALSE (standard cadence)
//   · `invariants.ts`         — `input.age >= 45`         → absent is FALSE (standard cadence)
//   · `planShapeInvariants.ts`— `(plan.meta.age ?? 0) >= 45` → absent becomes ZERO, also standard
//
// All three agreed, and all three were wrong in the same direction — not by reasoning, but
// because `undefined >= 45` is false in JavaScript. **The less protective of two ratified
// cadences was being chosen by an operator's coercion rule.** The old wizard hid it by
// fabricating age 30, so the absent branch had no live instance until that literal was deleted.
//
// 🩹 Willy, binding: *"I am not asserting these sixteen are masters. I am asserting that we have
// no basis for asserting they are not, and §3 currently resolves that ignorance to the less
// protective of two ratified cadences. Resolve ignorance to the cautious side or decline to
// resolve it. Do not resolve it to thirty."*
//
// 📐 Live population 2026-11-17: 16 of 56 runners carry neither `birth_year` nor
// `date_of_birth`, 3 of them with a generated plan. Every one was on the 4-week cadence.
import { GENERATION_CONFIG } from './generationConfig'

/**
 * §3 — masters runners (age >= `MASTERS_AGE_THRESHOLD`) recover every 3 weeks instead of 4.
 *
 * ⚠️ AN ABSENT AGE RETURNS `true`, DELIBERATELY. It is not a guess that the runner is older; it
 * is a refusal to spend their recovery on an assumption we never asked them to confirm. The
 * cost of being wrong in this direction is one extra deload week in a block; the cost of being
 * wrong the other way is a masters runner loading for four weeks at a time, indefinitely.
 */
export function mastersCadenceApplies(age: number | null | undefined): boolean {
  if (typeof age !== 'number' || !Number.isFinite(age)) return true
  return age >= GENERATION_CONFIG.MASTERS_AGE_THRESHOLD
}
