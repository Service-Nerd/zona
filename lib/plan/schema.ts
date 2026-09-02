// FREE — infrastructure
// Canonical plan schema (Zod). Single source of runtime validation for plan JSON.
// Shared by the rule engine (R23), enricher (R23), reshaper (R20), and multi-race (R24).
//
// TypeScript types are inferred from these schemas — do not duplicate interfaces here.
// `types/plan.ts` is the TypeScript authority; this file adds runtime validation on top.

import { z } from 'zod'

// ─── Session ──────────────────────────────────────────────────────────────────

export const SessionTypeSchema = z.enum([
  'run', 'easy', 'long', 'quality', 'tempo', 'intervals',
  'hard', 'race', 'recovery', 'strength', 'cross-train', 'rest',
])

export const SessionSchema = z.object({
  // INV-PLAN-009: deterministic IDs on R23+ plans; absent on legacy
  id:             z.string().optional(),
  type:           SessionTypeSchema,
  // Generator-stamped structural classification (label-independent). See
  // types/plan.ts Session.role and lib/plan/sessionRole.ts.
  role:           z.enum(['long_run', 'shakeout']).optional(),
  // SC-08a — identity of the catalogue row that produced this session, so the
  // rep structure survives renaming and enrichment. See types/plan.ts.
  catalogue_id:   z.string().optional(),
  // SC-08b — the resolved set for THIS runner, from a v2 row. Structural, not
  // display: the enricher cannot reach it (EnrichedWeekSchema exposes only
  // label + coach_notes). Loosely typed here on purpose — DerivedSet is owned
  // by lib/plan/resolveMainSet.ts and validated there; duplicating its shape in
  // Zod would create a second owner to drift (D-08).
  derived_set:    z.unknown().optional(),
  label:          z.string(),
  detail:         z.string().nullable(),
  distance_km:    z.number().nonnegative().optional(),
  duration_mins:  z.number().nonnegative().optional(),
  primary_metric: z.enum(['distance', 'duration']).optional(),
  // INV-PLAN-007: zone and hr_target are always strings, never numeric/object
  zone:           z.string().optional(),
  hr_target:      z.string().optional(),
  pace_target:    z.string().optional(),
  rpe_target:     z.number().int().min(1).max(10).optional(),
  coach_notes:    z.tuple([z.string(), z.string().optional(), z.string().optional()]).optional(),
  lr_segment_pace: z.string().optional(),
  // AI-DEPTH-07 — additive depth fields (schema-only; engine doesn't populate yet)
  key_session:        z.boolean().optional(),
  run_walk_strategy:  z.string().optional(),
  fueling_protocol:   z.string().optional(),
})

// ─── Week ─────────────────────────────────────────────────────────────────────

export const WeekTypeSchema = z.enum([
  'completed', 'deload_done', 'current', 'normal', 'deload', 'race_event', 'race',
])

export const DayKeySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])

// AI-DEPTH-07 — race-day result envelope, attached to the race Week.
// All fields optional — partial captures are valid (e.g. user logs finish time
// + a sentence on what went wrong; splits arrive later from Strava webhook).
export const RaceResultSchema = z.object({
  finish_time:      z.string().optional(),
  distance_km:      z.number().nonnegative().optional(),
  date:             z.string().optional(),
  splits:           z.array(z.object({
                      km:   z.number().nonnegative(),
                      pace: z.string(),
                      hr:   z.number().positive().optional(),
                    })).optional(),
  avg_hr:           z.number().positive().optional(),
  max_hr:           z.number().positive().optional(),
  hr_drift_pct:     z.number().optional(),
  rpe:              z.number().int().min(1).max(10).optional(),
  outcome:          z.enum(['on_target', 'off_target', 'dnf', 'pb']).optional(),
  notes:            z.string().optional(),
  fueling_outcome:  z.string().optional(),
  strategy_outcome: z.string().optional(),
  what_worked:      z.string().optional(),
  what_broke:       z.string().optional(),
})

export const WeekSchema = z.object({
  n:                    z.number().int().positive(),
  date:                 z.string(),
  label:                z.string(),
  theme:                z.string(),
  type:                 WeekTypeSchema,
  phase:                z.enum(['base', 'build', 'peak', 'taper', 'foundation', 'maintenance_restoration', 'maintenance_base']).optional(),
  badge:                z.enum(['deload', 'holiday', 'race']).optional(),
  // partialRecord (Zod v4): the plan populates only the days that have sessions.
  // Plain z.record(enum, …) requires ALL seven day keys — see enrichMaintenance.ts.
  sessions:             z.partialRecord(DayKeySchema, SessionSchema).optional(),
  long_run_hrs:         z.number().nullable(),
  weekly_km:            z.number().nonnegative(),
  weekly_duration_mins: z.number().nonnegative().optional(),
  race_notes:           z.string().optional(),
  tune_up_callout:      z.string().optional(),
  // GEN-FIX-10 — set by the reshaper when a fatigue/EF signal removed this
  // week's quality session. Distinguishes an intentional downgrade from a
  // generator defect for INV-PLAN-QUALITY-EXPECTED.
  quality_downgraded: z.object({ trigger: z.string(), at: z.string() }).optional(),
  // AI-DEPTH-07 — populated post-event on the race week. `.nullable()` so an
  // explicit "race not yet run" sentinel is representable; `.optional()` so
  // legacy plans without the field still parse.
  result_embedded:      RaceResultSchema.nullable().optional(),
  // MAINT-07 — §75 Phase 3 (re-engagement) marker. Optional: absent on both
  // non-maintenance weeks and pre-MAINT-07 maintenance plans.
  reengagement:         z.boolean().optional(),
  // MAINT-02 — AI weekly debrief on maintenance weeks (PAID, `maintenance_coaching`).
  // Optional so legacy + non-enriched plans parse; distinct from `theme` (rule-engine).
  coach_debrief:        z.string().optional(),
})

// ─── Phase ────────────────────────────────────────────────────────────────────

export const PhaseSchema = z.object({
  name:       z.enum(['base', 'build', 'peak', 'taper']),
  start_week: z.number().int().positive(),
  end_week:   z.number().int().positive(),
})

// ─── Plan meta ────────────────────────────────────────────────────────────────

export const PlanMetaSchema = z.object({
  athlete:        z.string(),
  handle:         z.string(),
  race_name:      z.string(),
  race_date:      z.string(),
  race_distance_km: z.number().positive(),
  charity:        z.string(),
  plan_start:     z.string(),
  quit_date:      z.string(),

  resting_hr:     z.number().positive(),
  max_hr:         z.number().positive(),
  zone2_ceiling:  z.number().positive(),

  version:        z.string(),
  last_updated:   z.string(),
  notes:          z.string(),
  primary_metric: z.enum(['distance', 'duration']).optional(),

  fitness_level:             z.enum(['beginner', 'intermediate', 'experienced']).optional(),
  // §79 — the level the runner selected in the wizard, distinct from the
  // structural `fitness_level` the engine built volume from.
  fitness_level_declared:    z.enum(['beginner', 'intermediate', 'experienced']).optional(),
  goal:                      z.enum(['finish', 'time_target']).optional(),
  target_time:               z.string().optional(),
  days_available:            z.number().int().optional(),
  training_style:            z.enum(['predictable', 'variety', 'minimalist', 'structured']).optional(),
  hard_session_relationship: z.enum(['avoid', 'neutral', 'love', 'overdo']).optional(),
  motivation_type:           z.enum(['identity', 'achievement', 'health', 'social']).optional(),
  injury_history:            z.array(z.string()).optional(),
  terrain:                   z.enum(['road', 'trail', 'mixed']).optional(),

  generated_at:      z.string().optional(),
  generator_version: z.string().optional(),

  // INV-PLAN-008: confidence fields are PAID-only — free plans must never emit these
  confidence_score:  z.number().int().min(1).max(10).optional(),
  confidence_risks:  z.array(z.string()).optional(),

  // R23 hybrid generation fields
  tier:         z.enum(['free', 'trial', 'paid']).optional(),
  compressed:   z.boolean().optional(),
  coach_intro:  z.string().optional(),
  // CA-01: FREE first-plan-only "why this plan" intro. Set in the route (not the
  // enricher) so a re-parse through PlanSchema doesn't strip it on plan load.
  plan_intro:   z.string().optional(),

  // GEN-FIX-02: did the AI enrichment layer actually land on this plan?
  //   'applied'  — enricher ran and its output was merged
  //   'failed'   — enricher fell back silently; this is rule-engine output (ADR-006)
  //   'skipped'  — free tier, never enriched by design
  //   'pending'  — stamped on the streamed rule_plan before enrichment resolves.
  //                A *saved* plan reading 'pending' means the client persisted
  //                before final_plan arrived (the N8 save race) — a real defect
  //                signal, not a normal terminal state.
  // Absent = generated before this shipped. Set in the route, like plan_intro.
  enrichment:   z.enum(['applied', 'failed', 'skipped', 'pending']).optional(),

  // R24 — VDOT / zone model fields (these were missing from the schema; added here for completeness)
  age:                z.number().int().positive().optional(),
  vdot:               z.number().positive().optional(),
  goal_pace_per_km:   z.string().optional(),
  recalibration_weeks: z.array(z.number().int().positive()).optional(),
  benchmark:          z.object({
                        type: z.enum(['race', 'tt_30min']),
                        distance_km: z.number().positive(),
                        time: z.string(),
                        benchmark_date: z.string().optional(),
                      }).optional(),

  // R23 rebuild — VDOT conservatism + returning runner
  vdot_discount_applied_pct:         z.number().min(0).max(20).optional(),
  training_age:                      z.enum(['<6mo', '6-18mo', '2-5yr', '5yr+']).optional(),
  returning_runner_allowance_active: z.boolean().optional(),

  // Audit trail of post-pass rule firings (V1, V2, V4, V5, V7 etc.)
  rule_adjustments: z.array(z.object({
    rule:           z.string(),
    violation:      z.string(),
    resolution:     z.string(),
    weeks_affected: z.array(z.number().int().positive()),
  })).optional(),

  // ADR-013 — post-race maintenance plan lifecycle. `plan_kind` marks a plan as
  // a standalone maintenance block; the `source_*` fields carry the finished
  // race forward. These MUST be registered here so a re-parse through the schema
  // doesn't strip them (same reason as `plan_intro` above). `source_race_date`
  // drives "N weeks post-race" coaching recency in sessionFeedback.
  plan_kind:                   z.enum(['race', 'maintenance']).optional(),
  source_race_name:            z.string().optional(),
  source_race_distance_km:     z.number().positive().optional(),
  source_race_date:            z.string().optional(),
  source_race_outcome:         z.string().optional(),
  source_finish_time:          z.string().optional(),
  maintenance_transition_seen: z.boolean().optional(),
  // VOL-SHORTFALL-01 / §40c — states the cost when a life-first constraint
  // suppresses the peak week. Same family as volume_constraint_note (§52) and
  // long_run_shortfall_note (§80).
  volume_shortfall_note:       z.string().optional(),
  volume_shortfall_pct:        z.number().optional(),
})

export const PrePlanGuidanceSchema = z.object({
  buffer_weeks:  z.number().int().nonnegative(),
  guidance:      z.string(),
  week_estimate: z.string(),
})

// ─── Plan ─────────────────────────────────────────────────────────────────────

export const PlanSchema = z.object({
  meta:     PlanMetaSchema,
  phases:   z.array(PhaseSchema).optional(),
  weeks:    z.array(WeekSchema),
  pre_plan: PrePlanGuidanceSchema.optional(),
})

// ─── Enricher output schema ───────────────────────────────────────────────────
// Validates the subset of fields Claude is allowed to modify.
// Used in lib/plan/enrich.ts to check the enriched plan before accepting it.
// Numeric fields (distance, duration, hr, zone) must not change — enforced by
// comparing the enriched plan against the original after validation passes.

export const EnrichedWeekSchema = WeekSchema.pick({
  label: true, theme: true, n: true,
}).extend({
  // partialRecord (Zod v4): the enricher returns only the days it wrote voice
  // for. Plain z.record(enum, …) requires ALL seven day keys present, which
  // silently failed EnrichedPlanSchema for ~every plan post the zod v4 upgrade
  // (2026-04-21) — enrichment fell back to rule copy invisibly. See
  // enrichMaintenance.ts, which already used partialRecord for the same reason.
  sessions: z.partialRecord(DayKeySchema, SessionSchema.pick({
    label: true, coach_notes: true,
  }).partial()).optional(),
})

export const EnrichedMetaSchema = PlanMetaSchema.pick({
  confidence_score: true,
  confidence_risks: true,
  coach_intro:      true,
  notes:            true,
}).partial()

export const EnrichedPlanSchema = z.object({
  meta:  EnrichedMetaSchema,
  weeks: z.array(EnrichedWeekSchema),
})

// ─── Inferred types (use these in lib/plan/* — do not import from types/plan.ts here) ──

export type PlanSchemaType       = z.infer<typeof PlanSchema>
export type PhaseSchemaType      = z.infer<typeof PhaseSchema>
export type WeekSchemaType       = z.infer<typeof WeekSchema>
export type SessionSchemaType    = z.infer<typeof SessionSchema>
export type RaceResultSchemaType = z.infer<typeof RaceResultSchema>
