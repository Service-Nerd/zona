// STRENGTH-ENGINE-REACH-01 (2026-10-21) — does a stored strength plan still match what the engine builds today?
//
// `GET /api/strength/plan` used to rebuild only when the run week changed (`runContextSig`), so every strength-engine
// ship after a plan was stored never reached it. Measured: the one live plan, built 2026-10-18, still held the weeks of
// upper body only that STRENGTH-GENERAL-LEGS-01 fixed on 2026-10-19. A version constant would fix it only while somebody
// remembered to bump it; regenerating from the stored inputs and comparing catches every change, because generation is
// deterministic in (profile, run context, start date).
//
// ⚠️ jsonb does not keep key order, so the comparison is `jsonEquivalent`, never a string compare (see canonicalJson).

import { jsonEquivalent } from '@/lib/ops/canonicalJson'
import { runContextSig } from '@/lib/strength-bridge/runContext'
import { generateStrengthPlan, type RunContext, type StrengthPlan, type StrengthProfile } from '@/packages/strength'

export type ReachReason = 'run_week_changed' | 'engine_changed'

/** The stored plan's start, rebuilt from the same inputs. A standalone plan keeps its own start, never next Monday. */
export function regenerateStored(profile: StrengthProfile, ctx: RunContext | null, startDate: string): StrengthPlan {
  return generateStrengthPlan(profile, ctx, ctx ? { startDate } : { standaloneStart: startDate })
}

/** Why the stored plan must be rebuilt, or null when it is what the engine builds today. */
export function storedPlanReach(stored: { plan: StrengthPlan; sig: string | null }, profile: StrengthProfile, ctx: RunContext | null, startDate: string): ReachReason | null {
  if (runContextSig(ctx) !== stored.sig) return 'run_week_changed'
  return jsonEquivalent(regenerateStored(profile, ctx, startDate), stored.plan) ? null : 'engine_changed'
}
