// ENRICH-RESTORE-REPAIR-01 (2026-10-28) — regenerate a stored plan's RULE plan, the way a
// rebuild script does. One owner, because two scripts need the identical construction:
// `rca-1026-regen.ts` (rebuild/patch) and `reenrich-plans.ts --repair-copy`, which needs the
// rule copy a live plan's enriched copy was written over.
//
// Pure: callers fetch the profile row.

import type { GeneratorInput, Plan } from '@/types/plan'
import { generateRulePlan } from './ruleEngine'
import { composePlanWithFoundation } from './foundationCompose'
import { withProfileHr, type ProfileHr } from './rebuildInput'
import { stampRebuilt } from './enrichmentState'

export interface StoredRegen {
  /** The stored answers with the profile's heart rate laid over them (REBUILD-HR-FROM-PROFILE-01). */
  input: GeneratorInput
  tier: 'free' | 'trial' | 'paid'
  /** The rule plan today's engine builds from those answers, with the stored foundation runway. */
  fresh: Plan
}

export function regenerateFromStored(plan: Plan, profile: ProfileHr | null | undefined): StoredRegen {
  const meta = plan.meta as unknown as Record<string, unknown>
  const planStart = meta.plan_start as string
  const gi = meta.generator_input as GeneratorInput
  const input = { ...withProfileHr(gi, profile), plan_start: planStart } as GeneratorInput
  const tier = (meta.tier === 'paid' ? 'paid' : meta.tier === 'free' ? 'free' : 'trial') as StoredRegen['tier']
  // ⚠️ THE FOUNDATION BLOCK IS COMPOSED FROM THE DAY IT STARTS, not from the plan start.
  // `composePlanWithFoundation` sizes the runway from (today -> plan start); passing the plan
  // start as "today" gave a 0-day gap and NO foundation weeks, so every plan with a runway read
  // as "the engine moves the calendar" (2026-10-27: a91d8fde and 3cc7c3a9 were refused for
  // exactly this). The stored block's first week is the "today" it was built for, so composing
  // from it reproduces the same runway.
  const storedFoundation = plan.weeks.filter(w => w.n <= 0)
  const composeToday = storedFoundation.length ? String(storedFoundation[0].date) : planStart
  // REBUILD-STAMP-ENRICHMENT-01 — stamped HERE, at the construction, so every caller that
  // persists `fresh` records the state instead of leaving it absent for an inference to
  // guess. ⚠️ `reenrich-plans.ts --repair-copy` takes `fresh` as a rule-copy REFERENCE and
  // never writes it, so the stamp is harmless there; `rca-1026-regen.ts` rebuild mode writes
  // it, which is the case this exists for. Its PATCH mode clones the stored plan instead and
  // copies three named meta fields, never `enrichment`.
  const fresh = stampRebuilt(composePlanWithFoundation(generateRulePlan(input, tier, planStart, undefined, planStart), input, composeToday, 'add').plan)
  return { input, tier, fresh }
}
