// The vocabulary for "does this plan carry model-written copy?" (REBUILD-VOICE-LOSS-01).
// Lives in lib/plan because plan modules read it; lib/ops imports it from here.

import type { Plan } from '@/types/plan'

/** Enrichment states in which the model's copy actually reached the plan. */
export const ENRICHED_STATES = ['applied', 'applied_partial'] as const

/** True when the plan carries model-written copy, fully or in part. A rebuild that
 *  regenerates the rule plan deletes that copy, so every rebuild guard asks THIS,
 *  never `=== 'applied'`: three paid plans were rebuilt on 2026-10-28 because the
 *  guard named one of the two states. */
export function hasAiCopy(meta: Pick<Plan['meta'], 'enrichment'> | null | undefined): boolean {
  return (ENRICHED_STATES as readonly string[]).includes(meta?.enrichment ?? '')
}

/**
 * REBUILD-STAMP-ENRICHMENT-01 (2026-11-08) — the state a REGENERATED plan is in.
 *
 * 🔑 A WRITER THAT STATES ITS OWN RESULT RETIRES AN INFERENCE. A rebuild writes the rule
 * engine's plan, whose meta has no `enrichment` field, so the state went absent and
 * `lib/ops/enrichHealth.ts → enrichmentStateOf` had to derive `not_recorded` from
 * `generator_input` + tier + `plan_kind` — once in TypeScript and again in a hand-mirrored
 * SQL copy in the digest runbook. Two derivations of one fact with a human in between is the
 * `DELOAD-OWNER-01` / `TIER-OWNER-01` class.
 *
 * ⚠️ THE INFERENCE STAYS, and must: 13 of 41 stored plans carry no stamp (measured
 * 2026-11-08) and nothing backfills them — live-plan policy. This retires the inference for
 * plans rebuilt FROM NOW ON, which is what the item asked for and is not the same as
 * removing it.
 */
export const REBUILT = 'skipped_rebuild'

/**
 * Stamp a freshly regenerated plan with the state it is actually in. Mutates and returns.
 *
 * ⚠️ CALL IT ON THE PLAN BEING WRITTEN, not on the one being read. Every rebuild script
 * refuses to run on a plan that still has AI copy (`hasAiCopy`), so this never overwrites a
 * working voice — but a PATCH path, which keeps the stored plan's meta and replaces only
 * future sessions, must NOT call this: its stored state is still the truth about the copy
 * it kept. `rca-1026-regen.ts` and `goalpace-5k-01-regen.ts` have both modes.
 */
export function stampRebuilt<T extends { meta: Record<string, unknown> }>(plan: T): T {
  plan.meta.enrichment = REBUILT
  return plan
}
