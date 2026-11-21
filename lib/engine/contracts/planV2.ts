// FREE — infrastructure. ADR-027 B1 (ADR027-B1-CONTRACTS).
//
// Plan v2: the STRICT schema of a plan. It extends `lib/plan/schema.ts` rather than
// being a third schema (ADR-027 v1.1 § Reuse): every v1 Zod object is reused and only
// what it does not declare is added here.
//
// Why strict: `PlanSchema` is not `.strict()`, so an undeclared key passes unchecked
// and nothing can say which keys a plan actually carries. The engine inventory
// (2026-11-20) counted 118 `PlanMeta` fields against 61 in `PlanMetaSchema`, plus
// keys written only through `as unknown as Record<…>` casts. Here every key is named.
//
// The KEY SETS are gated (`planV2.test.ts`): every field of `PlanMeta`, `Session`,
// `Week`, `RaceResult` and `GeneratorInput` in `types/plan.ts` must be declared here.
//
// Declared limit: `derived_set.blocks` (ADR-019's step structure) is checked as an
// array, not field by field; `resolveMainSet` owns that shape.

import { z } from 'zod'
import {
  PlanMetaSchema, SessionSchema, WeekSchema, WeekSchemaChecked, RaceResultSchema,
  PhaseSchema, PrePlanGuidanceSchema, DayKeySchema,
} from '@/lib/plan/schema'

const Level = z.enum(['beginner', 'intermediate', 'experienced'])
const TrainingAge = z.enum(['<6mo', '6-18mo', '2-5yr', '5yr+'])
const WeekdayKey = z.enum(['mon', 'tue', 'wed', 'thu', 'fri'])

export const BenchmarkV2Schema = z.strictObject({
  type: z.enum(['race', 'tt_30min']),
  distance_km: z.number().positive(),
  time: z.string(),
  benchmark_date: z.string().optional(),
})

/** The 33 fields of `GeneratorInput` (6 required, 27 optional), strictly. */
export const GeneratorInputV2Schema = z.strictObject({
  race_date: z.string(),
  race_distance_km: z.number(),
  goal: z.enum(['finish', 'time_target']),
  current_weekly_km: z.number(),
  longest_recent_run_km: z.number(),
  days_available: z.number(),
  age: z.number().optional(),
  fitness_level: Level.optional(),
  user_declared_level: Level.optional(),
  fitness_intensity_level: Level.optional(),
  resting_hr: z.number().optional(),
  max_hr: z.number().optional(),
  max_hr_source: z.enum(['observed', 'user_confirmed']).optional(),
  training_age: TrainingAge.optional(),
  recent_quality_training: z.enum(['none', 'occasional', 'regular']).optional(),
  weeks_at_current_volume: z.number().optional(),
  volume_observed: z.boolean().optional(),
  after_walk_run_start: z.boolean().optional(),
  acknowledged_prep_warning: z.boolean().optional(),
  preferred_long_run_day: z.enum(['sat', 'sun']).optional(),
  benchmark: BenchmarkV2Schema.optional(),
  race_name: z.string().optional(),
  target_time: z.string().optional(),
  days_cannot_train: z.array(z.string()).optional(),
  max_weekday_mins: z.number().optional(),
  day_budgets: z.partialRecord(WeekdayKey, z.number()).optional(),
  training_style: z.enum(['predictable', 'variety', 'minimalist', 'structured']).optional(),
  hard_session_relationship: z.enum(['avoid', 'neutral', 'love', 'overdo']).optional(),
  motivation_type: z.enum(['identity', 'achievement', 'health', 'social']).optional(),
  injury_history: z.array(z.string()).optional(),
  terrain: z.enum(['road', 'trail', 'mixed']).optional(),
  athlete_name: z.string().optional(),
  foundation_decision: z.enum(['add', 'skip', 'start_now']).optional(),
})

/**
 * `meta.generator_input` as STORED. Production carries `plan_start` inside it on 29 of
 * 123 stored rows (plans + archive, measured 2026-11-21): the stored input, not the
 * request input, so it is declared here and not on `GeneratorInputV2Schema`.
 */
export const StoredGeneratorInputV2Schema = GeneratorInputV2Schema.extend({
  plan_start: z.string().optional(),
  acknowledged_days_warning: z.boolean().optional(),
}).strict()

/** `StagedRace` (`stagedRacePlan.ts`), written to meta through a cast. */
export const StagedRaceV2Schema = z.strictObject({
  race_name: z.string(),
  race_date: z.string(),
  race_distance_km: z.number(),
  door_km: z.number(),
  min_base_km: z.number(),
  target_found: z.boolean(),
  checkpoint_week: z.number(),
  race_weeks: z.number(),
  reaches_door: z.boolean(),
})

/** ADR-027 stamps. Required on a plan the v2 engine builds; absent on an adapted v1 plan. */
export const EngineStampsSchema = z.strictObject({
  engine_version: z.string().min(1),
  /** A hash of the rule catalogue (L2) the plan was built under. */
  rules_version: z.string().min(1),
  /** The date the request was evaluated at (ARCH-ENG-005). ISO date. */
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  input_hash: z.string().min(1),
})
export type EngineStamps = z.infer<typeof EngineStampsSchema>

/**
 * The meta fields `PlanMetaSchema` does not declare, in four groups.
 * A: declared on `PlanMeta` in `types/plan.ts` and missing from the v1 Zod schema (57).
 * B: written only through a cast, on no type (9 — the inventory counted 8 and missed
 *    `onramp_profile`, added by ONRAMP-INJURY-CLIMB-01 on 2026-11-21).
 * C: `GeneratorInput` keys that reach meta because `generateBaseBuildPlan` spreads the
 *    input into it (`...input`); measured on stored base-build plans.
 * D: v1 fields whose v1 Zod type is narrower than what production stores.
 */
const META_V2_ADDITIONS = {
  // ── A. on PlanMeta, missing from PlanMetaSchema ──────────────────────────────
  generator_input: StoredGeneratorInputV2Schema.optional(),
  vdot_training_anchor: z.number().optional(),
  recalibrations_applied: z.array(z.number()).optional(),
  volume_profile: z.enum(['build', 'maintenance']).optional(),
  volume_constraint_note: z.string().optional(),
  compression_classification: z.enum(['optimal', 'appropriate_for_persona', 'constrained_by_inputs']).optional(),
  difficulty_band: z.enum(['comfortable', 'demanding', 'very_demanding']).optional(),
  difficulty_note: z.string().optional(),
  goal_beyond_measured_fitness: z.boolean().optional(),
  fresh_return_active: z.boolean().optional(),
  returning_runner_note: z.string().optional(),
  time_compressed: z.boolean().optional(),
  volume_constrained: z.boolean().optional(),
  long_run_shortfall_note: z.string().optional(),
  uncovered_runway_weeks: z.number().optional(),
  uncovered_runway_note: z.string().optional(),
  short_opening_block_weeks: z.array(z.number()).optional(),
  short_opening_block_note: z.string().optional(),
  peak_shortfall_note: z.string().optional(),
  load_residual_note: z.string().optional(),
  load_residual_week: z.number().optional(),
  fitness_intensity_level: Level.optional(),
  peak_km_target: z.number().optional(),
  quality_pool_sizes: z.array(z.number()).optional(),
  fitness_signal_note: z.string().optional(),
  goal_below_easy_ceiling: z.boolean().optional(),
  goal_below_easy_ceiling_note: z.string().optional(),
  intensity_reentry_active: z.boolean().optional(),
  intensity_reentry_weeks: z.number().optional(),
  early_quality_onset: z.boolean().optional(),
  base_build_onramp: z.boolean().optional(),
  finish_goal_run_walk: z.boolean().optional(),
  run_walk_prescribed: z.boolean().optional(),
  intensity_reentry_cause: z.enum(['returning', 'user_raised', 'early_onset']).optional(),
  frequency_constraint_note: z.string().optional(),
  foundation_weeks_planned: z.number().optional(),
  onset_yield: z.strictObject({ rungs: z.number(), bound: z.number(), effective: z.number() }).optional(),
  intensity_reentry_omission_note: z.string().optional(),
  deload_position2_yielded: z.boolean().optional(),
  hr_zone_method: z.enum([
    'karvonen', 'karvonen_estimated_max', 'percent_of_max', 'percent_of_estimated_max',
    'observed_max', 'age_estimate_implausible_input', 'age_estimate_max_floor',
    'max_unguarded_no_age', 'no_hr_no_age',
  ]).optional(),
  hr_assumption_note: z.string().optional(),
  hr_estimated_max: z.number().optional(),
  hr_derived_max: z.number().optional(),
  hr_max_source: z.enum(['observed', 'user_confirmed']).optional(),
  hr_band_source: z.literal('anchor').optional(),
  prep_time_status: z.enum(['ok', 'warned']).optional(),
  prep_time_warning: z.string().optional(),
  prep_time_alternatives: z.array(z.string()).optional(),
  prep_time_weeks_available: z.number().optional(),
  prep_time_weeks_required_ok: z.number().optional(),
  days_available_status: z.enum(['ok', 'warned']).optional(),
  days_required_ok: z.number().optional(),
  days_available_warning: z.string().optional(),
  days_available_alternatives: z.array(z.string()).optional(),
  taper_recalibrated_at: z.string().optional(),
  functional_peak_km: z.number().optional(),
  planned_peak_km_at_recal: z.number().optional(),

  // ── B. cast-only: written through `meta as unknown as Record<…>` ─────────────
  base_build_start_km: z.number().optional(),
  base_build_target_km: z.number().optional(),
  onramp_spaced: z.boolean().optional(),
  onramp_profile: z.enum(['standard', 'volume_capped_injury']).optional(),
  staged_race: StagedRaceV2Schema.optional(),
  walk_run_carried: z.boolean().optional(),
  walk_run_resumed: z.boolean().optional(),
  walk_run_start_weeks: z.number().optional(),
  /** `current_weekly_km` arrives by group C on base-build plans; listed in the
   *  inventory's cast-only set as well, so it is declared once, here. */
  current_weekly_km: z.number().optional(),

  // ── C. GeneratorInput keys spread into a base-build plan's meta ──────────────
  // `age`, `fitness_level`, `goal`, `target_time`, `days_available`, `training_style`,
  // `hard_session_relationship`, `motivation_type`, `injury_history`, `terrain`,
  // `resting_hr`, `max_hr`, `race_*`, `benchmark`, `training_age` are already meta fields.
  longest_recent_run_km: z.number().optional(),
  user_declared_level: Level.optional(),
  max_hr_source: z.enum(['observed', 'user_confirmed']).optional(),
  recent_quality_training: z.enum(['none', 'occasional', 'regular']).optional(),
  weeks_at_current_volume: z.number().optional(),
  volume_observed: z.boolean().optional(),
  after_walk_run_start: z.boolean().optional(),
  acknowledged_prep_warning: z.boolean().optional(),
  acknowledged_days_warning: z.boolean().optional(),
  preferred_long_run_day: z.enum(['sat', 'sun']).optional(),
  days_cannot_train: z.array(z.string()).optional(),
  max_weekday_mins: z.number().optional(),
  day_budgets: z.partialRecord(WeekdayKey, z.number()).optional(),
  athlete_name: z.string().optional(),
  foundation_decision: z.enum(['add', 'skip', 'start_now']).optional(),
  /** A request-body field (`accept_base_build`), not a `GeneratorInput` field, that
   *  reached two stored base-build plans' meta through the same spread. */
  accept_base_build: z.boolean().optional(),

  // ── D. v1 Zod type narrower than what is stored (measured 2026-11-21, 123 rows) ──
  // These rows fail v1 `PlanSchema` today as well. v2 declares what is stored; the
  // read model, not the schema, decides what a consumer is told.
  /** `null` on 3 rows (1 plan, 2 archive), all from 2026-04-07. Nothing reads it. */
  handle: z.string().nullable().optional(),
  charity: z.string().nullable().optional(),
  /** Absent on 2 live base-build plans written before BASEBUILD-SCHEMA-CEREMONY-01
   *  (2026-10-10) fixed the producer. Required in v1, so both fail `PlanSchema`. */
  athlete: z.string().optional(),
  /** `0` on 7 archive rows (PLAN-RESTING-HR-ZERO-01). A zero is not a resting HR:
   *  `restingHr()` in the read model returns null for it. */
  resting_hr: z.number().nonnegative().optional(),

  /** ADR-027 stamps, as carried inside a v1-shaped `plan_json`. `toV2` lifts them to
   *  the top level; v1 code never writes this key. */
  engine_stamps: EngineStampsSchema.optional(),
} as const

export const PlanMetaV2Schema = PlanMetaSchema.extend(META_V2_ADDITIONS).strict()

export const RaceResultV2Schema = RaceResultSchema.extend({
  maintenance_intent: z.enum(['rest', 'tick_over', 'stay_sharp']).optional(),
}).strict()

export const DerivedSetV2Schema = z.strictObject({
  version: z.literal(2),
  blocks: z.array(z.unknown()),
  kind: z.literal('run_walk').optional(),
})

export const SessionV2Schema = SessionSchema.extend({
  derived_set: DerivedSetV2Schema.optional(),
  stimulus: z.enum(['strides', 'easy', 'steady_aerobic', 'hills', 'tempo', 'race_pace', 'vo2max']).optional(),
  displaced_by_adaptation_window: z.literal(true).optional(),
  duration_anchored: z.boolean().optional(),
  floor_protected: z.boolean().optional(),
}).strict()

export const WeekV2ObjectSchema = WeekSchema.extend({
  sessions: z.partialRecord(DayKeySchema, SessionV2Schema).optional(),
  result_embedded: RaceResultV2Schema.nullable().optional(),
  /** v1 enum plus `key_session`, found on 2 weeks of 1 archive row from 2026-05-12. */
  badge: z.enum(['deload', 'holiday', 'race', 'key_session']).optional(),
}).strict()

/** v1's per-phase volume requirement (`WeekSchemaChecked`), reused rather than copied. */
export const WeekV2Schema = WeekV2ObjectSchema.superRefine((w, ctx) => {
  const r = WeekSchemaChecked.safeParse(w)
  if (!r.success) for (const issue of r.error.issues) {
    if (issue.code === 'custom') ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message })
  }
})

export const PlanV2Schema = z.strictObject({
  schema_version: z.literal(2),
  meta: PlanMetaV2Schema,
  phases: z.array(PhaseSchema.strict()).optional(),
  weeks: z.array(WeekV2Schema),
  pre_plan: PrePlanGuidanceSchema.strict().optional(),
  stamps: EngineStampsSchema.optional(),
  /**
   * Week keys a stored v1 plan carries that v2 does not declare, kept opaque so the adapter
   * stays lossless. Indexed by week position. v2 code never reads it.
   *
   * It exists for ONE retired field (RACE-NOTES-INERT-01, Design Board 2026-11-16): on one
   * week of 118 of 123 stored rows, and `raceNotesRetired.test.ts` forbids any file from
   * declaring it, so v2 does not. A producer must never put anything here:
   * `planV1V2.test.ts` asserts the corpus carries nothing.
   */
  v1_carry: z.strictObject({
    weeks: z.record(z.string().regex(/^\d+$/), z.record(z.string(), z.unknown())),
  }).optional(),
})

export type PlanV2 = z.infer<typeof PlanV2Schema>
export type PlanMetaV2 = z.infer<typeof PlanMetaV2Schema>
export type WeekV2 = z.infer<typeof WeekV2Schema>
export type SessionV2 = z.infer<typeof SessionV2Schema>
export type GeneratorInputV2 = z.infer<typeof GeneratorInputV2Schema>
export type StagedRaceV2 = z.infer<typeof StagedRaceV2Schema>

/** The added meta keys, by name, for the key-set gate and the contract. */
export const META_V2_ADDED_KEYS: readonly string[] = Object.keys(META_V2_ADDITIONS)
