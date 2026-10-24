/**
 * NO-RUNNER-TURNED-AWAY-01 — the staged race plan (Coaching Board 2026-10-24, two sittings; §116 Am. 9).
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────
 * §111 refuses a marathon built more than 4.0× off the runner's base, and it is right to. Until this, the runner it
 * refused was told *"come back in two weeks"* and offered a base-building plan with no race in it. Measured
 * 2026-10-24: **6 of 6** runners refused on base volume were comped charity marathoners, and none of them reached the
 * race they signed up for; one deleted their account 47 seconds after accepting the base build.
 *
 * So the refused runner is given a plan FOR THE RACE: §116's ramp first, a checkpoint named from day one, and the race
 * block generated only after the checkpoint passes on volume they actually ran.
 *
 * ── THE LINE FROM THE VETO, AND IT IS MECHANICAL ────────────────────────────
 * `S111-FOUNDATION-CREDIT-01` was ruled INCORRECT because it divided §111 by volume the runner had not run and handed
 * over the whole plan now. This module does neither: **the staged plan contains no race-block week at all** (enforced by
 * `INV-PLAN-STAGED-NO-RACE-BLOCK`), and the checkpoint feeds the OBSERVED figure to the ordinary engine, so §111 itself,
 * unchanged and in its one place, decides whether the race block can be built.
 *
 * ── WHAT IT DELIBERATELY DOES NOT TOUCH ─────────────────────────────────────
 * A staged plan IS a base-build plan (`plan_kind: 'base_build'`), so its `race_name` stays "Base building" and its
 * `race_date` stays empty, exactly as every base-build plan has them today. Nine files branch on that kind, and the
 * plan save archives on a race-identity change: putting the runner's race into those two fields would move all of them
 * at once. The race lives in `meta.staged_race`, which only this feature reads.
 */

import type { Plan, GeneratorInput, Week } from '@/types/plan'
import { GENERATION_CONFIG } from './generationConfig'
import { generateBaseBuildPlan, onRampWeeksNeeded, onRampCurve, type OnRampAssessment } from './baseBuildOnRamp'
import { effectiveStartKm } from './startVolume'
import { prepBlockWeeks } from './inputs'
import { weeksBetweenLocal } from './length'
import type { WeeklyLoad } from '@/lib/coaching/weeklyActualLoad'

/** What a staged plan remembers about the race it is for. Read by the checkpoint and the UI, nothing else. */
export interface StagedRace {
  race_name: string
  race_date: string
  race_distance_km: number
  /** §111's door for this runner, as the refusal named it. The checkpoint passes at or above it. */
  door_km: number
  /** The plan week whose end is the checkpoint: the base build's last week. */
  checkpoint_week: number
  /** Weeks left for the race block after the checkpoint. */
  race_weeks: number
  /** Does the ramp, run as prescribed, reach the door by the checkpoint? False when Q1 had to move the checkpoint
   *  earlier to keep §44's block; then the checkpoint's outcome is whatever the observed volume says. */
  reaches_door: boolean
}

export interface CheckpointPlacement {
  rampWeeks: number
  raceWeeks: number
  reachesDoor: boolean
}

/**
 * Q1 — where the checkpoint goes. The week the ramp reaches the door, provided at least §44's block threshold is left
 * for the race block; otherwise `runway − block`. `null` when there is no week to stage at all (the runway is inside
 * §44's block already, and §44 refuses that runner on its own grounds).
 *
 * ⚠️ §44's block (`prepBlockWeeks`), NOT §116's 16-week `BASE_BUILD_ONRAMP_MIN_REMAINING_WEEKS`. The second sitting
 * ruled for McMillan: a warn is a warning the runner can accept, not a wall. A staged plan landing between the two
 * carries §44's existing warning at the wizard like any other plan.
 */
export function checkpointPlacement(input: GeneratorInput, doorKm: number, runwayWeeks: number): CheckpointPlacement | null {
  const startKm = effectiveStartKm(input)
  if (!(startKm > 0) || !(doorKm > startKm)) return null
  const block = prepBlockWeeks(input)
  const maxRamp = runwayWeeks - block
  if (maxRamp < 1) return null
  const needed = onRampWeeksNeeded(startKm, doorKm)
  const rampWeeks = needed > 0 && needed <= maxRamp ? needed : maxRamp
  return { rampWeeks, raceWeeks: runwayWeeks - rampWeeks, reachesDoor: needed > 0 && needed <= maxRamp }
}

/**
 * Does this refused runner get a staged race plan? Start at or above §116's running floor (below it is the walk-run
 * start, phase D, not built yet), and a checkpoint that can be placed.
 */
export function stagingApplies(input: GeneratorInput, doorKm: number, runwayWeeks: number): boolean {
  if (effectiveStartKm(input) < GENERATION_CONFIG.BASE_BUILD_ONRAMP_MIN_START_KM) return false
  return checkpointPlacement(input, doorKm, runwayWeeks) !== null
}

/** The staged plan: §116's ramp to the checkpoint, carrying the race in `meta.staged_race`. */
export function generateStagedRacePlan(input: GeneratorInput, planStart: string, doorKm: number): Plan | null {
  const runway = weeksBetweenLocal(planStart, input.race_date)
  if (!stagingApplies(input, doorKm, runway)) return null
  const placed = checkpointPlacement(input, doorKm, runway)!
  const startKm = effectiveStartKm(input)
  const curve = onRampCurve(startKm, placed.rampWeeks)
  const assessment: OnRampAssessment = {
    outcome: 'offered',
    rampWeeks: placed.rampWeeks,
    remainingWeeks: placed.raceWeeks,
    targetKm: curve[curve.length - 1],
    startKm,
  }
  const plan = generateBaseBuildPlan(input, planStart, assessment)
  const meta = plan.meta as unknown as Record<string, unknown>
  // ⚠️ The §116 marker is removed, as `generateGetRunningPlan` removes it: the staged plan's destination is carried
  // explicitly in `staged_race`, and a second, vaguer marker for the same fact is two signals that can disagree.
  delete meta.base_build_onramp
  meta.enrichment = 'skipped_plan_kind'
  const staged: StagedRace = {
    race_name: input.race_name || '',
    race_date: input.race_date,
    race_distance_km: input.race_distance_km,
    door_km: doorKm,
    checkpoint_week: plan.weeks.length,
    race_weeks: placed.raceWeeks,
    reaches_door: placed.reachesDoor,
  }
  meta.staged_race = staged
  return plan
}

export function stagedRaceOf(plan: Plan | null | undefined): StagedRace | null {
  const s = (plan?.meta as unknown as Record<string, unknown> | undefined)?.staged_race as StagedRace | undefined
  return s && typeof s.door_km === 'number' && typeof s.checkpoint_week === 'number' ? s : null
}

const isDeload = (w: Week) => w.type === 'deload' || w.badge === 'deload'

/**
 * Q2 — what the runner actually ran going into the checkpoint: the mean `totalKm` (linked + off-plan, §2 Am. 4) of the
 * final `BASE_BUILD_CHECKPOINT_OBSERVED_WEEKS` non-deload weeks at or before it. `null` when no run is recorded in
 * those weeks at all, which is the "no runs recorded" state and is **never** a pass.
 *
 * ⚠️ NO TOLERANCE, AND NOT ROUNDED UP (Willy: *"a tolerance on the door is a credit by another name"*). Floored to one
 * decimal, the same rule every ramp figure follows, so rounding cannot carry a value over the door.
 */
export function observedCheckpointKm(
  plan: Pick<Plan, 'weeks'>,
  loads: ReadonlyMap<number, WeeklyLoad>,
  checkpointWeek: number,
): number | null {
  const n = GENERATION_CONFIG.BASE_BUILD_CHECKPOINT_OBSERVED_WEEKS
  const window = plan.weeks
    .filter(w => w.n >= 1 && w.n <= checkpointWeek && !isDeload(w))
    .sort((a, b) => b.n - a.n)
    .slice(0, n)
  if (window.length === 0) return null
  const kms = window.map(w => loads.get(w.n)?.totalKm ?? 0)
  if (kms.every(k => k <= 0)) return null
  const mean = kms.reduce((s, k) => s + k, 0) / window.length
  return Math.floor(mean * 10) / 10
}
