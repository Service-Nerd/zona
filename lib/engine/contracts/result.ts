// FREE — infrastructure. ADR-027 B1 (ADR027-B1-CONTRACTS).
//
// The v2 request and the typed result (ARCH-ENG-006: a refusal is a result, never a
// throw). Contract: `docs/contracts/engine.md` § v2.
//
// Nothing calls these yet. `runEngine` still returns `EngineOutcome` and the route
// still answers 422 for an `InputFieldError`; the v2 HTTP mapping (400) applies to the
// v2 endpoint when B7 builds it, not to today's route.

import { z } from 'zod'
import { DESIGNED_REFUSAL_ERROR_NAMES } from '@/lib/plan/designedRefusal'
import { GeneratorInputV2Schema, type PlanV2, type EngineStamps } from './planV2'
import type { Decision, Finding, Lever } from './decision'

export const ENGINE_OPERATIONS = ['plans.create', 'plans.adapt', 'checkpoint.evaluate', 'strength.create'] as const
export type EngineOperation = typeof ENGINE_OPERATIONS[number]

/** `plans.create`. `as_of` is REQUIRED (ARCH-ENG-005); `engine_version` pins a version
 *  when given. Tier is not here: the engine is tier-blind (ADR-003). */
export const PlansCreateRequestSchema = z.strictObject({
  operation: z.literal('plans.create'),
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  engine_version: z.string().min(1).optional(),
  input: GeneratorInputV2Schema,
  options: z.strictObject({
    plan_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    accept_base_build: z.boolean().optional(),
    acknowledged_days_warning: z.boolean().optional(),
    display_units: z.enum(['km', 'mi']),
  }),
})
export type PlansCreateRequest = z.infer<typeof PlansCreateRequestSchema>

// ── Refusal codes ─────────────────────────────────────────────────────────────

/** Each designed refusal, by today's `error.name`, to its v2 code and principle. */
export const REFUSAL_CODE_BY_ERROR_NAME = {
  PrepTimeError:         { code: 'prep_time',          principle_ref: '§44' },
  DaysAvailableError:    { code: 'days_available',     principle_ref: '§52' },
  BaseVolumeError:       { code: 'base_volume',        principle_ref: '§111' },
  LongRunReadinessError: { code: 'long_run_readiness', principle_ref: '§113' },
} as const

/** `evaluateCheckpoint`'s two refusals, today returned as `{ status, body.reason }`. */
export const CHECKPOINT_REFUSAL_CODES = ['checkpoint_no_base_build', 'checkpoint_no_runs'] as const

export type RefusalCode =
  | typeof REFUSAL_CODE_BY_ERROR_NAME[keyof typeof REFUSAL_CODE_BY_ERROR_NAME]['code']
  | typeof CHECKPOINT_REFUSAL_CODES[number]

/** Re-exported so the contract test can prove the map covers the owner's list. */
export const DESIGNED_REFUSAL_NAMES_OWNED: readonly string[] = DESIGNED_REFUSAL_ERROR_NAMES

// ── Result ────────────────────────────────────────────────────────────────────

export type EngineResult =
  | {
      ok: true
      plan: PlanV2
      decisions: Decision[]
      /** warn-level findings that shipped (errors never leave the service). */
      findings: Finding[]
      stamps: EngineStamps
    }
  | {
      ok: false
      refused: true
      code: RefusalCode
      /** Runner-facing copy. A wire field for display, never for matching. */
      reason: string
      levers: Lever[]
      /** The offer that replaces a dead end (§118: a get-running or staged plan). */
      offer?: { kind: 'get_running' | 'staged_base_build'; plan: PlanV2 }
      /** §44 / §52 warn tier: the runner may proceed by acknowledging. */
      requires_acknowledgment?: boolean
    }
  | {
      ok: false
      invalid_input: true
      /** `InputFieldError.field`, or the Zod path. */
      field: string
      why: string
    }

/** An engine fault is not a result: it is a 500 and a finding (`engine_fault`). */
export function httpStatusFor(r: EngineResult): 200 | 400 | 409 | 422 {
  if (r.ok) return 200
  if ('invalid_input' in r) return 400
  // A checkpoint asked of a plan that is not a base build is a state conflict, not a
  // judgement about the runner; today's route answers 409 and v2 keeps it.
  if (r.code === 'checkpoint_no_base_build') return 409
  return 422
}

/** Today's `error.name` → v2 code. null for anything that is not a designed refusal. */
export function refusalCodeForErrorName(name: string): RefusalCode | null {
  return (REFUSAL_CODE_BY_ERROR_NAME as Record<string, { code: RefusalCode }>)[name]?.code ?? null
}
