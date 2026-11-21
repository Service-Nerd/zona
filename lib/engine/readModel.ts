// FREE — infrastructure. ADR-027 B1 (ADR027-B1-CONTRACTS).
//
// The plan read model (ARCH-ENG-010): typed accessors for what screens, prompts and
// push read off a plan today, so a v1 and a v2 plan differ in one place. Every
// accessor takes either shape.
//
// No consumer is migrated here (B4/B5). The gate that bans raw `plan.meta.<key>`
// reads outside these accessors lands with that migration, not before it.
//
// Started from what the inventory names: the rationale-note fields
// `planRationaleNotes` reads, the load-residual pair, the generation stamps, and the
// base-build keys that are today read only through `as unknown as Record<…>` casts.

import type { Plan } from '@/types/plan'
import { toV2, isPlanV2 } from './contracts/planV1V2'
import type { PlanV2, PlanMetaV2, EngineStamps, StagedRaceV2 } from './contracts/planV2'

type AnyPlan = Plan | PlanV2

/** No clone: `toV2` copies the whole plan, and an accessor runs on every render. v1
 *  and v2 meta are the same shape apart from `engine_stamps`, which only
 *  `stampsOf` reads. `readModel.test.ts` proves both paths answer alike. */
function metaOf(plan: AnyPlan): PlanMetaV2 {
  return plan.meta as unknown as PlanMetaV2
}

function stampsOf(plan: AnyPlan): EngineStamps | null {
  if (isPlanV2(plan)) return plan.stamps ?? null
  return (plan.meta as unknown as PlanMetaV2).engine_stamps ?? null
}

/** The full v2 form, when a caller needs the plan and not one fact. */
export function asPlanV2(plan: AnyPlan): PlanV2 {
  return isPlanV2(plan) ? plan : toV2(plan)
}

/** The 16 runner-facing `*_note` fields on meta (engine inventory § 4a). */
export const META_NOTE_FIELDS = [
  'volume_constraint_note', 'difficulty_note', 'returning_runner_note', 'volume_shortfall_note',
  'long_run_shortfall_note', 'uncovered_runway_note', 'short_opening_block_note', 'peak_shortfall_note',
  'load_residual_note', 'fitness_signal_note', 'goal_below_easy_ceiling_note', 'terrain_effort_note',
  'hard_pref_note', 'frequency_constraint_note', 'intensity_reentry_omission_note', 'hr_assumption_note',
] as const satisfies readonly (keyof PlanMetaV2)[]
export type MetaNoteField = typeof META_NOTE_FIELDS[number]

/** The note fields a plan carries, non-empty only. Order is the list's, not rank:
 *  ranking and capping stay `planRationaleNotes`'s job. */
export function metaNotes(plan: AnyPlan): Partial<Record<MetaNoteField, string>> {
  const meta = metaOf(plan)
  const out: Partial<Record<MetaNoteField, string>> = {}
  for (const k of META_NOTE_FIELDS) {
    const v = meta[k]
    if (typeof v === 'string' && v.length > 0) out[k] = v
  }
  return out
}

/** §34's accepted load residual. Only a note written from the ramp checks' verdict
 *  (`load_residual_week` set) counts; an older stored note without a week
 *  over-declared, and `planRationaleNotes` does not show it either. */
export function loadResidual(plan: AnyPlan): { note: string; week: number } | null {
  const meta = metaOf(plan)
  if (!meta.load_residual_note || meta.load_residual_week == null) return null
  return { note: meta.load_residual_note, week: meta.load_residual_week }
}

export interface PlanStamps {
  /** ADR-027 stamps; null on every plan the current engine built. */
  engine: EngineStamps | null
  generated_at: string | null
  generator_version: string | null
  tier: 'free' | 'trial' | 'paid' | null
  enrichment: PlanMetaV2['enrichment'] | null
}

export function planStamps(plan: AnyPlan): PlanStamps {
  const m = metaOf(plan)
  return {
    engine: stampsOf(plan),
    generated_at: m.generated_at ?? null,
    generator_version: m.generator_version ?? null,
    tier: m.tier ?? null,
    enrichment: m.enrichment ?? null,
  }
}

/** The stored input, as Modify and the checkpoint replay it. */
export function generatorInput(plan: AnyPlan): NonNullable<PlanMetaV2['generator_input']> | null {
  return metaOf(plan).generator_input ?? null
}

/** The declared kind. null on legacy plans that predate the stamp; this does not guess. */
export function planKind(plan: AnyPlan): 'race' | 'maintenance' | 'base_build' | null {
  return metaOf(plan).plan_kind ?? null
}

export interface BaseBuildFacts {
  start_km: number | null
  target_km: number | null
  onramp_spaced: boolean
  onramp_profile: 'standard' | 'volume_capped_injury' | null
  walk_run_start_weeks: number | null
  walk_run_resumed: boolean
  walk_run_carried: boolean
  staged_race: StagedRaceV2 | null
}

/** The base-build keys read through casts today. null for a plan that is not a base build. */
export function baseBuildFacts(plan: AnyPlan): BaseBuildFacts | null {
  const m = metaOf(plan)
  if (m.plan_kind !== 'base_build') return null
  return {
    start_km: m.base_build_start_km ?? null,
    target_km: m.base_build_target_km ?? null,
    onramp_spaced: m.onramp_spaced === true,
    onramp_profile: m.onramp_profile ?? null,
    walk_run_start_weeks: m.walk_run_start_weeks ?? null,
    walk_run_resumed: m.walk_run_resumed === true,
    walk_run_carried: m.walk_run_carried === true,
    staged_race: m.staged_race ?? null,
  }
}

/** A zero is not a resting HR (PLAN-RESTING-HR-ZERO-01: 7 archived rows carry one). */
export function restingHr(plan: AnyPlan): number | null {
  const v = metaOf(plan).resting_hr
  return typeof v === 'number' && v > 0 ? v : null
}
