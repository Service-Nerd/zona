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
