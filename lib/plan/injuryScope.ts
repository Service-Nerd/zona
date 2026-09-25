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

/**
 * Does this injury history include `keyword`?
 *
 * ⚠️ FIXED IN THE ENGINE 2026-09-16 — THREE OF THE SIX WIZARD VALUES NEVER
 * MATCHED, and the coaching rules behind them had therefore never fired for a
 * real runner. `GeneratePlanScreen` offers: Achilles · Knee · Back · Hip · Shin
 * splints · Plantar fasciitis. The keywords here are snake_case, and the old
 * body was a raw `i.toLowerCase().includes(keyword)`, so:
 *
 *   wizard value         keyword               matched?
 *   'Knee' / 'Achilles' / 'Back'               yes
 *   'Shin splints'       'shin_splints'        NO  — space vs underscore
 *   'Plantar fasciitis'  'plantar_fasciitis'   NO  — space vs underscore
 *   'Hip'                'hip_flexor'          NO  — different word
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
