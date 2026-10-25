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
 * ⚠️ AMENDED BY THE THIRD SITTING (C1–C3): the race block is generated from `checkpointRaceInput` at the plan's own
 * target with the ramp's longest session, marked observed. The first version used the stated long run and §111's
 * door, and measured 5.7% clean for reasons the board then ruled were the checkpoint asking with signup facts.
 *
 * ⚠️ §44's warning is ACKNOWLEDGED for the race block, as the product does: at the wizard §44 is answered before §111
 * is ever reached, and at the checkpoint the handover card carries the acknowledge step (`MODIFY-WARN-ACK-01`).
 */

import type { GeneratorInput } from '@/types/plan'
import { generateStagedRacePlan, stagedRaceOf, checkpointRaceInput, longestSessionKm, raceBlockVerdict } from './stagedRacePlan'
import { validateBaseBuildBlock, validateStagedRace } from './baseBuildValidate'

export interface StagedScore {
  clean: boolean
  /** Error-severity codes from either half. */
  errorCodes: string[]
  /** Coach objections on the race block. */
  objectionCodes: string[]
  /** Set when the race block itself was refused at the checkpoint (e.g. §113 on a stale long run). */
  refusedAtCheckpoint: string | null
}

const addWeeks = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 7 * 864e5).toISOString().slice(0, 10)

/** `null` when this case is not staged at all (the caller scores it as before). */
export function scoreStagedCase(input: GeneratorInput, planStart: string, doorKm: number): StagedScore | null {
  const staged = generateStagedRacePlan(input, planStart, doorKm)
  if (!staged) return null
  const s = stagedRaceOf(staged)!
  const startKm = Number((staged.meta as unknown as Record<string, unknown>).base_build_start_km ?? 0)
  const baseErrs = [...validateBaseBuildBlock(staged.weeks, startKm,
    { spaced: (staged.meta as unknown as Record<string, unknown>).onramp_spaced === true, blocked: input.days_cannot_train ?? [] }), ...validateStagedRace(staged)]
    .filter(v => v.severity === 'error').map(v => v.code)

  const checkpoint = addWeeks(planStart, s.checkpoint_week)
  // The PASS case, built exactly as `evaluateCheckpoint` builds it: they ran the target (`door_km`, C3) and the
  // ramp's own longest session (C2), marked observed (C1). `checkpointRaceInput` is the one owner of that input.
  const raceInput = checkpointRaceInput(input, s.door_km, longestSessionKm(staged.weeks))
  // The engine's own verdict (`raceBlockVerdict`), so the harness and the engine cannot disagree about "clean".
  const v = raceBlockVerdict(raceInput, checkpoint)
  if (v.refusal) return { clean: false, errorCodes: baseErrs, objectionCodes: [], refusedAtCheckpoint: v.refusal }
  const errorCodes = [...baseErrs, ...v.errorCodes]
  return { clean: errorCodes.length === 0 && v.objectionCodes.length === 0, errorCodes, objectionCodes: v.objectionCodes, refusedAtCheckpoint: null }
}
