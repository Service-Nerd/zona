/**
 * NO-RUNNER-TURNED-AWAY-01, Q4 (Coaching Board 2026-10-24) — HOW A STAGED PLAN IS SCORED, defined once.
 *
 * Both fit-for-purpose harnesses (`envelopeMeasure.ts` and `scripts/cohort-review.ts`) call this, because the
 * definition was fixed BEFORE the build (acceptance criterion 6) so the after-number cannot move by definition, and a
 * definition written out twice is two definitions.
 *
 * ── THE DEFINITION ──────────────────────────────────────────────────────────
 * A staged case is scored as the COMPOSED plan: the generated base-building weeks, plus the race plan generated from
 * the checkpoint with `current_weekly_km` = the door. **That is the pass case, exactly at the line, and it is the best
 * case** (chair: printed beside the number wherever it is reported). It is clean only if the base-building weeks pass
 * their validators AND the race plan generates, passes `validatePlan` at error severity, and draws no coach objection.
 *
 * ⚠️ `longest_recent_run_km` is left as the runner stated it, exactly as the handover leaves it: what they actually
 * ran as a long run is not knowable from a plan. If that makes §113 refuse the race block, the staged case is NOT
 * clean, and that is a finding about the product, not about the measure.
 *
 * ⚠️ §44's warning is ACKNOWLEDGED for the race block, as the product does: at the wizard §44 is answered before §111
 * is ever reached, and at the checkpoint the handover card carries the acknowledge step (`MODIFY-WARN-ACK-01`).
 */

import type { GeneratorInput } from '@/types/plan'
import { generateStagedRacePlan, stagedRaceOf } from './stagedRacePlan'
import { validateBaseBuildBlock, validateStagedRace } from './baseBuildValidate'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { isDesignedRefusal } from './designedRefusal'
import { auditPlanQuality, objectionsOnly } from './planQuality'

export interface StagedScore {
  clean: boolean
  /** Error-severity codes from either half. */
  errorCodes: string[]
  /** Coach objections on the race block. */
  objectionCodes: string[]
  /** Set when the race block itself was refused at the checkpoint (e.g. §113 on a stale long run). */
  refusedAtCheckpoint: string | null
}

const dayBefore = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) - 864e5).toISOString().slice(0, 10)
const addWeeks = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 7 * 864e5).toISOString().slice(0, 10)

/** `null` when this case is not staged at all (the caller scores it as before). */
export function scoreStagedCase(input: GeneratorInput, planStart: string, doorKm: number): StagedScore | null {
  const staged = generateStagedRacePlan(input, planStart, doorKm)
  if (!staged) return null
  const s = stagedRaceOf(staged)!
  const startKm = Number((staged.meta as unknown as Record<string, unknown>).base_build_start_km ?? 0)
  const baseErrs = [...validateBaseBuildBlock(staged.weeks, startKm), ...validateStagedRace(staged)]
    .filter(v => v.severity === 'error').map(v => v.code)

  const checkpoint = addWeeks(planStart, s.checkpoint_week)
  const raceInput = { ...input, current_weekly_km: doorKm, acknowledged_prep_warning: true } as GeneratorInput
  let race
  try {
    race = generateRulePlan(raceInput, 'paid', checkpoint, undefined, dayBefore(checkpoint))
  } catch (e) {
    if (!isDesignedRefusal(e)) throw e
    return { clean: false, errorCodes: baseErrs, objectionCodes: [], refusedAtCheckpoint: (e as Error).name }
  }
  const errs = validatePlan(race, raceInput).filter(v => v.severity === 'error').map(v => v.code)
  const m = race.meta as unknown as Record<string, unknown>
  const maintDeclared = m.volume_profile === 'maintenance' && !!m.volume_constraint_note
  // The SAME §23 reconciliation the envelope applies to every other plan: a declared maintenance plan may not build.
  const objs = objectionsOnly(auditPlanQuality(race, raceInput).filter(o => !(o.code === 'NEVER-BUILDS' && maintDeclared)))
    .map(o => o.code)
  const errorCodes = [...baseErrs, ...errs]
  return { clean: errorCodes.length === 0 && objs.length === 0, errorCodes, objectionCodes: objs, refusedAtCheckpoint: null }
}
