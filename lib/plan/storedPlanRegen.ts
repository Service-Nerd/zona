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
  const fresh = composePlanWithFoundation(generateRulePlan(input, tier, planStart, undefined, planStart), input, composeToday, 'add').plan
  return { input, tier, fresh }
}
