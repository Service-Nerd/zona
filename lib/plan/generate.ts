// TIER-DIVERGENT — infrastructure
// Plan generation entry point. Orchestrates rule engine + enricher.
// Free: rule engine only. Trial/paid: rule engine + AI enricher (silent fallback).
// See ADR-006 for the hybrid generation architecture.

import type { GeneratorInput, Plan } from '@/types/plan'
import { generateRulePlan } from './ruleEngine'
import { enrich } from './enrich'
import { nextMonday, formatDate } from './length'

export type { Tier } from './ruleEngine'

export async function generate(
  input: GeneratorInput,
  tier: 'free' | 'trial' | 'paid',
  planStart?: string,
): Promise<Plan> {
  const start = planStart ?? formatDate(nextMonday())
  const plan = generateRulePlan(input, tier, start)

  if (tier === 'free') return plan

  // enrich() handles its own errors and falls back to the rule-engine plan
  return enrich(plan, input, tier)
}
