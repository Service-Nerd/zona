// FOUNDATION-CHOICE-RESIZE-01 — re-size the base when a DEFERRED foundation
// decision finally lands as 'add'.
//
// THE DEFECT. On the >28-day 'choice' band the runner is asked whether to add a
// §57 foundation block, and the answer arrives AFTER /api/generate-plan has
// already run. The board (2026-09-04) ruled the conservative default CORRECT: at
// generation the decision is unknown, so `plannedFoundationWeeks` returns 0 and
// §91's on-ramp CREDIT is not applied — presuming 'add' and receiving 'skip'
// would hand a shortened on-ramp to a runner who does no foundation weeks at all
// (Willy). The cost of that correct default is a NON-MONOTONIC onset: the same
// runner, same delivered 3-week block, gets quality in week 1 if the decision
// was known at generation but week 2 if it was deferred — the exact defect §91
// exists to remove, still live on this one band.
//
// THE REMEDY the board pointed at: "re-size when the answer lands." The only
// owner of phase sizing is `generateRulePlan` (§91 lives inside `computePhases`);
// re-deriving the base boundary anywhere else is the two-writer split this repo
// keeps paying for (DELOAD-OWNER-01). So we RE-RUN THE RULE ENGINE — deterministic,
// no AI, cheap — with `foundation_decision: 'add'`, which is an ADR-020 amendment:
// the foundation route may re-run GENERATION, it still must never re-pay for AI
// ENRICHMENT (28-35s, real cost).
//
// TWO PROPERTIES make this surgical and safe:
//
//  1. The §91 credit is consumed ONLY inside `if (earlyOnset)` in computePhases,
//     so re-running changes nothing for a non-early-onset plan. We gate on the
//     already-stamped `meta.early_quality_onset` and return the plan untouched
//     otherwise — no re-run, no enrichment disturbed, for the overwhelming
//     majority.
//
//  2. `calcPlanLength` counts back `totalWeeks` from race week, so passing
//     `planStart = meta.plan_start` (the anchored start) reproduces
//     `weeksAvailable = totalWeeks` and therefore the SAME anchored start and the
//     SAME total length. The re-run reproduces the original plan in every respect
//     EXCEPT the base boundary the credit moves. Proven by the onset-parity test
//     in foundationResize.test.ts (decided-at-generation === deferred-then-added
//     under a frozen clock).
//
// ENRICHMENT. The re-run yields RULE copy. Where a main-plan week's session
// skeleton is byte-identical between the runner's current (possibly enriched)
// plan and the re-sized plan, that week's enriched copy is still valid and is
// grafted back on; weeks the onset shift changed keep rule copy. This is the
// 'applied_partial' state the enrich pipeline already produces and validates
// (ENRICH-PARTIAL-01) — correct everywhere, enriched almost everywhere.

import { generateRulePlan, type Tier } from './ruleEngine'
import { revertWeeksToRuleCopy } from './enrichPartialRevert'
import type { Plan, Session, Week } from '@/types/plan'

/** True when two sessions are the same PRESCRIPTION — the fields the enricher
 *  cannot write. If these match, copy written for one describes the other. */
function sessionsEqual(a: Session | undefined, b: Session | undefined): boolean {
  if (!a || !b) return a === b
  return a.type === b.type
    && a.role === b.role
    && a.catalogue_id === b.catalogue_id
    && a.zone === b.zone
    && a.distance_km === b.distance_km
    && a.duration_mins === b.duration_mins
}

/** A week is structurally identical iff it has the same day keys and every day's
 *  session is the same prescription. Phase/theme are NOT compared — they are copy,
 *  and copy is exactly what we are deciding whether to trust. */
function weeksStructurallyEqual(a: Week, b: Week): boolean {
  const aDays = Object.keys(a.sessions)
  const bDays = Object.keys(b.sessions)
  if (aDays.length !== bDays.length) return false
  return aDays.every(d =>
    sessionsEqual(
      a.sessions[d as keyof Week['sessions']],
      b.sessions[d as keyof Week['sessions']],
    ))
}

/**
 * Re-size a plan for a deferred foundation 'add', preserving enrichment where it
 * remains valid. Returns the input plan UNCHANGED when it is not early-onset
 * (the credit would change nothing) or when re-generation somehow drops it.
 *
 * The caller composes the foundation block onto the result (composePlanWithFoundation).
 */
export function resizeForDeferredFoundationAdd(
  incoming: Plan,
  input: import('@/types/plan').GeneratorInput,
  tier: Tier,
  today: string,
): Plan {
  // Fast path — the §91 credit is consumed only for an early-onset runner, so
  // re-running is provably a no-op for everyone else. Leave the plan (and its
  // enrichment) exactly as it is.
  if (incoming.meta.early_quality_onset !== true) return incoming

  // Re-run GENERATION (rule engine only, no AI) as if the decision had been known
  // at generation. `todayOverride` and `planStart = meta.plan_start` reproduce the
  // original anchoring; `foundation_decision: 'add'` applies the credit.
  const resized = generateRulePlan(
    { ...input, foundation_decision: 'add' },
    tier,
    incoming.meta.plan_start,
    undefined,
    today,
  )

  // Defensive: if the re-run produced a different length, the anchoring assumption
  // did not hold (e.g. a stale cross-day client plan whose race window moved).
  // Rather than ship a plan whose weeks don't line up, keep the runner's existing
  // one — the compose step still adds the block, matching prior behaviour.
  if (resized.weeks.length !== incoming.weeks.length) return incoming

  // Was the incoming plan carrying enrichment worth preserving?
  const wasEnriched =
    incoming.meta.enrichment === 'applied' || incoming.meta.enrichment === 'applied_partial'
  if (!wasEnriched) return resized

  // Graft the incoming ENRICHED copy onto every main-plan week whose prescription
  // survived the re-size unchanged; the rest keep the re-run's rule copy.
  //
  // `revertWeeksToRuleCopy(target, source, weeks)` overlays `source`'s copy
  // (label/theme/session label+coach_notes, numerics untouched) onto `target` for
  // the named weeks — a generic copy overlay despite the revert-flavoured name.
  // Here: overlay the runner's enriched copy (`incoming`) onto the re-sized rule
  // plan (`resized`) for the weeks that match.
  const matching = new Set<number>()
  const incomingByN = new Map(incoming.weeks.map(w => [w.n, w]))
  for (const w of resized.weeks) {
    if (w.n < 1) continue // main-plan weeks only; foundation weeks aren't here yet
    const src = incomingByN.get(w.n)
    if (src && weeksStructurallyEqual(w, src)) matching.add(w.n)
  }

  const grafted = revertWeeksToRuleCopy(resized, incoming, matching)

  // Honest status: unless EVERY main week was grafted, some enriched copy was
  // dropped to rule copy by the re-size — that is the 'applied_partial' contract.
  const mainWeeks = resized.weeks.filter(w => w.n >= 1).length
  grafted.meta.enrichment = matching.size >= mainWeeks ? incoming.meta.enrichment : 'applied_partial'
  return grafted
}
