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
})

// ─── Week ─────────────────────────────────────────────────────────────────────

export const WeekTypeSchema = z.enum([
  'completed', 'deload_done', 'current', 'normal', 'deload', 'race_event', 'race',
])

export const DayKeySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])

export const WeekSchema = z.object({
  n:                    z.number().int().positive(),
  date:                 z.string(),
  label:                z.string(),
  theme:                z.string(),
  type:                 WeekTypeSchema,
  phase:                z.enum(['base', 'build', 'peak', 'taper']).optional(),
  badge:                z.enum(['deload', 'holiday', 'race']).optional(),
  sessions:             z.record(DayKeySchema, SessionSchema).optional(),
  long_run_hrs:         z.number().nullable(),
  weekly_km:            z.number().nonnegative(),
  weekly_duration_mins: z.number().nonnegative().optional(),
  race_notes:           z.string().optional(),
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
})

// ─── Plan ─────────────────────────────────────────────────────────────────────

export const PlanSchema = z.object({
  meta:   PlanMetaSchema,
  phases: z.array(PhaseSchema).optional(),
  weeks:  z.array(WeekSchema),
})

// ─── Enricher output schema ───────────────────────────────────────────────────
// Validates the subset of fields Claude is allowed to modify.
// Used in lib/plan/enrich.ts to check the enriched plan before accepting it.
// Numeric fields (distance, duration, hr, zone) must not change — enforced by
// comparing the enriched plan against the original after validation passes.

export const EnrichedWeekSchema = WeekSchema.pick({
  label: true, theme: true, n: true,
}).extend({
  sessions: z.record(DayKeySchema, SessionSchema.pick({
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

export type PlanSchemaType    = z.infer<typeof PlanSchema>
export type PhaseSchemaType   = z.infer<typeof PhaseSchema>
export type WeekSchemaType    = z.infer<typeof WeekSchema>
export type SessionSchemaType = z.infer<typeof SessionSchema>
