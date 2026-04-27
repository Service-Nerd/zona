// FREE — infrastructure
// Input-side validation that runs BEFORE generation. The engine is not
// obligated to produce a plan when the inputs cannot support a coachable
// outcome. See CoachingPrinciples §44 (prep-time validation).
//
// Two-step UX: a `warn` result refuses generation unless the caller passes
// `acknowledged_prep_warning: true`. A `block` result refuses unconditionally.

import type { GeneratorInput } from '@/types/plan'
import { GENERATION_CONFIG, raceDistanceKey } from './generationConfig'
import { weeksBetweenLocal } from './length'

export type PrepTimeStatus = 'ok' | 'warn' | 'block'

export interface PrepTimeResult {
  status: PrepTimeStatus
  message?: string
  alternatives?: string[]
  weeks_available: number
  weeks_required_ok: number
  weeks_required_block: number
  shifted_for_returning_runner: boolean
}

/** GeneratorInput extension — `acknowledged_prep_warning` is a transient input
 *  field consumed by validatePrepTime. Lives in this module rather than the
 *  shared types/plan.ts to keep the validator's UX-flow concept colocated.
 */
export interface PrepTimeAwareInput extends GeneratorInput {
  acknowledged_prep_warning?: boolean
}

/** Throw when the engine should not produce a plan due to prep-time. The API
 *  route catches this and returns 422 with the structured `prep` payload. */
export class PrepTimeError extends Error {
  reason: 'block' | 'warn_unacknowledged'
  prep: PrepTimeResult
  constructor(reason: 'block' | 'warn_unacknowledged', prep: PrepTimeResult) {
    super(prep.message ?? 'Prep-time validation refused generation')
    this.name = 'PrepTimeError'
    this.reason = reason
    this.prep = prep
  }
}

function thresholdsKey(km: number): keyof typeof GENERATION_CONFIG.PREP_TIME_THRESHOLDS {
  // raceDistanceKey already covers 5K/10K/HM/MARATHON/50K/100K; mirror it.
  return raceDistanceKey(km)
}

/** Returning runner per §44 — three independent signals. Any one shifts
 *  thresholds up by PREP_TIME_RETURNING_RUNNER_SHIFT_WEEKS. */
function isReturningForPrepTime(input: GeneratorInput): boolean {
  if ((input as { returning_runner_allowance_active?: boolean }).returning_runner_allowance_active) return true
  if ((input as { fresh_return_active?: boolean }).fresh_return_active) return true
  if (input.weeks_at_current_volume !== undefined
      && input.weeks_at_current_volume < GENERATION_CONFIG.FRESH_RETURN_WEEKS_THRESHOLD) {
    return true
  }
  return false
}

function alternativesFor(
  distKey: keyof typeof GENERATION_CONFIG.PREP_TIME_THRESHOLDS,
  weeks: number,
  okThreshold: number,
  input: GeneratorInput,
): string[] {
  const alts: string[] = []
  if (distKey === 'MARATHON' && weeks >= 8) {
    alts.push(`Race the half marathon at this event instead — ${weeks} weeks is adequate for an HM build.`)
  }
  if (distKey === 'HM' && weeks >= 6) {
    alts.push(`Race the 10K at this event instead.`)
  }
  if ((distKey === '50K' || distKey === '100K') && weeks >= 10) {
    alts.push(`Race the marathon distance at this event instead — ${weeks} weeks is closer to a marathon timeline.`)
  }
  if (input.goal === 'time_target') {
    alts.push(`Switch goal to "finish" — finish goals are achievable on shorter timelines.`)
  }
  alts.push(`Defer the race to one with at least ${okThreshold} weeks of prep.`)
  return alts
}

/** Pre-generation check. See CoachingPrinciples §44.
 *  `planStart` is the ISO date the plan would start (Monday after today by
 *  default). It must be passed in so the result is deterministic in tests. */
export function validatePrepTime(input: GeneratorInput, planStart: string): PrepTimeResult {
  const weeks = weeksBetweenLocal(planStart, input.race_date)
  const distKey = thresholdsKey(input.race_distance_km)
  const thresholds = GENERATION_CONFIG.PREP_TIME_THRESHOLDS[distKey]
  const isReturning = isReturningForPrepTime(input)
  const shift = isReturning ? GENERATION_CONFIG.PREP_TIME_RETURNING_RUNNER_SHIFT_WEEKS : 0
  const blockAt = thresholds.block + shift
  const warnAt  = thresholds.warn  + shift

  if (weeks < blockAt) {
    return {
      status: 'block',
      message: `${weeks} weeks is not enough preparation for a ${distKey}. Minimum is ${blockAt} weeks${shift ? ' for a returning runner' : ''}.`,
      alternatives: alternativesFor(distKey, weeks, warnAt, input),
      weeks_available: weeks,
      weeks_required_ok: warnAt,
      weeks_required_block: blockAt,
      shifted_for_returning_runner: isReturning,
    }
  }

  // For finish goals, the warn zone is treated as ok.
  if (weeks < warnAt && input.goal === 'time_target') {
    return {
      status: 'warn',
      message: `${weeks} weeks is below the recommended ${warnAt}-week minimum for a time-targeted ${distKey}. The plan can be generated but the time goal may not be achievable safely. Expect maintenance-grade volume rather than a true build.`,
      alternatives: alternativesFor(distKey, weeks, warnAt, input),
      weeks_available: weeks,
      weeks_required_ok: warnAt,
      weeks_required_block: blockAt,
      shifted_for_returning_runner: isReturning,
    }
  }

  return {
    status: 'ok',
    weeks_available: weeks,
    weeks_required_ok: warnAt,
    weeks_required_block: blockAt,
    shifted_for_returning_runner: isReturning,
  }
}

/** Convenience: applies the validator and either returns the result for `ok`
 *  or `warn`-acknowledged, or throws PrepTimeError. Used at the top of
 *  generateRulePlan(). */
export function enforcePrepTime(input: PrepTimeAwareInput, planStart: string): PrepTimeResult {
  const prep = validatePrepTime(input, planStart)
  if (prep.status === 'block') {
    throw new PrepTimeError('block', prep)
  }
  if (prep.status === 'warn' && !input.acknowledged_prep_warning) {
    throw new PrepTimeError('warn_unacknowledged', prep)
  }
  return prep
}

// ─── L-01: critical input field validation (CoachingPrinciples §55) ──────────
//
// Reject empty / out-of-physiological-range values for fields the engine
// cannot fall back on. Distinct from L-03 (HR data fallbacks): L-01 rejects
// nonsense values (resting_hr: 0, max_hr: 50, age: 0); L-03 fills gaps for
// MISSING values. A resting_hr: 0 is treated as invalid (rejected here),
// not as missing (which L-03 would handle).

export interface InputFieldRange {
  min: number
  max: number
}

export class InputFieldError extends Error {
  field: string
  value: number
  range: InputFieldRange
  constructor(field: string, value: number, range: InputFieldRange) {
    super(`Invalid input: ${field}=${value} (acceptable range: ${range.min}–${range.max}). Empty or out-of-range physiological inputs are rejected.`)
    this.name = 'InputFieldError'
    this.field = field
    this.value = value
    this.range = range
  }
}

/** Validates the small set of inputs the engine cannot fall back on if they
 *  are nonsense values. Throws InputFieldError on the first violation. */
export function validateInputFields(input: GeneratorInput): void {
  const ranges: Record<string, InputFieldRange> = {
    age:        { min: 13,  max: 90  },
    resting_hr: { min: 30,  max: 100 },
    max_hr:     { min: 120, max: 220 },
  }

  // age is always required
  const age = input.age
  if (typeof age !== 'number' || !Number.isFinite(age)) {
    throw new InputFieldError('age', Number(age), ranges.age)
  }
  if (age < ranges.age.min || age > ranges.age.max) {
    throw new InputFieldError('age', age, ranges.age)
  }

  // resting_hr and max_hr are optional. Only validate if provided. A value of
  // exactly 0 is treated as "not provided" by the existing engine
  // (`input.resting_hr && input.resting_hr > 0`) — L-01 rejects 0 as invalid
  // explicitly so the user knows their data was rejected, not silently dropped.
  if (input.resting_hr !== undefined && input.resting_hr !== null) {
    if (!Number.isFinite(input.resting_hr) || input.resting_hr === 0) {
      throw new InputFieldError('resting_hr', input.resting_hr, ranges.resting_hr)
    }
    if (input.resting_hr < ranges.resting_hr.min || input.resting_hr > ranges.resting_hr.max) {
      throw new InputFieldError('resting_hr', input.resting_hr, ranges.resting_hr)
    }
  }
  if (input.max_hr !== undefined && input.max_hr !== null) {
    if (!Number.isFinite(input.max_hr) || input.max_hr === 0) {
      throw new InputFieldError('max_hr', input.max_hr, ranges.max_hr)
    }
    if (input.max_hr < ranges.max_hr.min || input.max_hr > ranges.max_hr.max) {
      throw new InputFieldError('max_hr', input.max_hr, ranges.max_hr)
    }
  }
}
