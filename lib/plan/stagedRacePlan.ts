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
import { generateRulePlan } from './ruleEngine'
import { isDesignedRefusal } from './designedRefusal'
import { auditPlanQuality, objectionsOnly } from './planQuality'
import { validatePlan } from './invariants'

/** What a staged plan remembers about the race it is for. Read by the checkpoint and the UI, nothing else. */
export interface StagedRace {
  race_name: string
  race_date: string
  race_distance_km: number
  /** The CHECKPOINT TARGET (C3): the lowest weekly volume at or above §111's door from which the race block's first
   *  week is a step, not a leap. Fixed on the plan from day one (Sims). The checkpoint passes at or above it. */
  door_km: number
  /** §111's own door, as the refusal named it. `door_km` is never below it. */
  min_base_km: number
  /** C3 found a target from which the race block is clean. False is C4: staged at §111's door, and the checkpoint
   *  offers the runner a choice (run-walk finish or a later race) instead of building a block we know is not clean. */
  target_found: boolean
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

const addWeeks = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 7 * 864e5).toISOString().slice(0, 10)
const dayBefore = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) - 864e5).toISOString().slice(0, 10)

/** The longest single session a set of weeks prescribes, in km. */
export function longestSessionKm(weeks: Week[]): number {
  return Math.max(0, ...weeks.flatMap(w => Object.values(w.sessions ?? {}).map(s => Number((s as { distance_km?: number } | undefined)?.distance_km ?? 0))))
}

/**
 * The input the race block is generated from at the checkpoint, given what the runner ran (C1, C2).
 * One owner, used by the checkpoint and by the staging search, so the plan the search tests is the plan the
 * checkpoint builds.
 */
export function checkpointRaceInput(input: GeneratorInput, weeklyKm: number, longestKm: number): GeneratorInput {
  return {
    ...input,
    current_weekly_km: weeklyKm,
    longest_recent_run_km: longestKm,
    volume_observed: true,
    // §44's warning was answered at the wizard, before §111 was reached; the handover card carries it otherwise.
    acknowledged_prep_warning: true,
  } as GeneratorInput
}

/**
 * Is the race block, built from `checkpointRaceInput` at the checkpoint, a plan we would hand over: it generates,
 * passes `validatePlan` at error severity, and draws no coach objection (the same §23 reconciliation every harness
 * applies to a declared maintenance plan)?
 *
 * ⚠️ CORRECTED 2026-10-25, AND SAID SO. C3's text read "the race block's first week is a step"; the prototype the
 * board ruled on searched for the lowest target from which the race block is CLEAN, and C5 binds the build to that
 * measurement. Built to the text, it measured **64.5%** clean against the prototype's **68.7%**: it stopped at the
 * first target without a leap even where that plan's long run never approached the race. The leap is one of the
 * objections, so this is the measured rule and includes the written one.
 */
function raceBlockClean(input: GeneratorInput, checkpoint: string): boolean {
  let race: Plan
  try { race = generateRulePlan(input, 'paid', checkpoint, undefined, dayBefore(checkpoint)) } catch (e) {
    if (isDesignedRefusal(e)) return false
    throw e
  }
  if (validatePlan(race, input).some(v => v.severity === 'error')) return false
  const m = race.meta as unknown as Record<string, unknown>
  const maintDeclared = m.volume_profile === 'maintenance' && !!m.volume_constraint_note
  return objectionsOnly(auditPlanQuality(race, input).filter(o => !(o.code === 'NEVER-BUILDS' && maintDeclared))).length === 0
}

/** C3's search step, and its ceiling: a target this far above the door is not a door any more. */
const TARGET_STEP_KM = 0.5
const TARGET_MAX_MULTIPLE = 2.5

/**
 * C3 — the checkpoint target: the lowest volume, at or above §111's door, whose ramp still leaves §44's block AND from
 * which the race block (generated as the checkpoint would generate it, on the pass case: they ran the target and the
 * ramp's own longest session) is clean (see `raceBlockClean`). `null` when no target fits (C4: staged at the door).
 *
 * ⚠️ A SEARCH, BECAUSE THE RULE IS THE ENGINE'S OWN. "Clean" is the validator plus the coach objections over a plan
 * the engine builds; a closed form for it would be a second, drifting copy of all of them.
 */
export function checkpointTarget(input: GeneratorInput, planStart: string, minBaseKm: number, runwayWeeks: number): number | null {
  for (let t = minBaseKm; t <= minBaseKm * TARGET_MAX_MULTIPLE; t = Math.round((t + TARGET_STEP_KM) * 10) / 10) {
    const placed = checkpointPlacement(input, t, runwayWeeks)
    if (!placed || !placed.reachesDoor) return null
    const startKm = effectiveStartKm(input)
    const curve = onRampCurve(startKm, placed.rampWeeks)
    const ramp = generateBaseBuildPlan(input, planStart, {
      outcome: 'offered', rampWeeks: placed.rampWeeks, remainingWeeks: placed.raceWeeks, targetKm: curve[curve.length - 1], startKm,
    })
    const cp = addWeeks(planStart, placed.rampWeeks)
    if (raceBlockClean(checkpointRaceInput(input, t, longestSessionKm(ramp.weeks)), cp)) return t
  }
  return null
}

/** The staged plan: §116's ramp to the checkpoint target, carrying the race in `meta.staged_race`. */
export function generateStagedRacePlan(input: GeneratorInput, planStart: string, minBaseKm: number): Plan | null {
  const runway = weeksBetweenLocal(planStart, input.race_date)
  if (!stagingApplies(input, minBaseKm, runway)) return null
  // C3, else C4: no target fits the runway, so the runner is still staged at §111's door with `reaches_door: false`
  // where Q1 had to move the checkpoint, and the checkpoint's consent screen offers run-walk or a later race.
  const target = checkpointTarget(input, planStart, minBaseKm, runway)
  const doorKm = target ?? minBaseKm
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
    min_base_km: minBaseKm,
    target_found: target !== null,
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

/** C2 — the longest single run recorded in the base-build weeks up to the checkpoint (deloads included: a long run
 *  in a deload week was still run). `null` when none is recorded. */
export function observedLongestRunKm(
  plan: Pick<Plan, 'weeks'>,
  loads: ReadonlyMap<number, WeeklyLoad>,
  checkpointWeek: number,
): number | null {
  const best = Math.max(0, ...plan.weeks.filter(w => w.n >= 1 && w.n <= checkpointWeek).map(w => loads.get(w.n)?.longestKm ?? 0))
  return best > 0 ? Math.floor(best * 10) / 10 : null
}

/**
 * An edit to either volume field is a DECLARATION again, so C1's observed flag no longer holds (Modify starts from
 * `meta.generator_input`, which a checkpoint-built plan stores with `volume_observed: true` so it replays faithfully).
 */
export function declaredVolumeEdit(stored: GeneratorInput | undefined, next: GeneratorInput): GeneratorInput {
  if (!next.volume_observed) return next
  const same = stored
    && stored.current_weekly_km === next.current_weekly_km
    && stored.longest_recent_run_km === next.longest_recent_run_km
  if (same) return next
  const { volume_observed: _drop, ...rest } = next
  return rest as GeneratorInput
}

/**
 * What a screen shows for a staged plan, derived once (NO-RUNNER-TURNED-AWAY-01, Phase C). DISPLAY ONLY: the plan's
 * own `race_name` / `race_date` stay "Base building" / "" (see this file's header), so nothing that archives or
 * counts down from them moves. `null` for any plan that is not staged.
 */
export interface StagedDisplay {
  raceName: string
  raceDate: string
  /** Monday of the checkpoint week (the base build's last week). */
  checkpointWeekStart: string
  /** Monday the race block would start, the week after the checkpoint. */
  raceBlockStart: string
  baseWeeks: number
  raceWeeks: number
  /** Base building plus the race block: the race timeline the runner sees. */
  totalWeeks: number
}

export function stagedDisplay(plan: Plan | null | undefined): StagedDisplay | null {
  const s = stagedRaceOf(plan)
  if (!plan || !s) return null
  const last = plan.weeks.find(w => w.n === s.checkpoint_week) ?? plan.weeks[plan.weeks.length - 1]
  const cpStart = String(last?.date ?? '').slice(0, 10)
  if (!cpStart) return null
  return {
    raceName: s.race_name,
    raceDate: s.race_date,
    checkpointWeekStart: cpStart,
    raceBlockStart: addWeeks(cpStart, 1),
    baseWeeks: s.checkpoint_week,
    raceWeeks: s.race_weeks,
    totalWeeks: s.checkpoint_week + s.race_weeks,
  }
}

/** Is `now` inside the checkpoint week (the base build's last week)? Today names the checkpoint only then. */
export function isCheckpointWeek(plan: Plan | null | undefined, now: Date): boolean {
  const d = stagedDisplay(plan)
  if (!d) return false
  const start = Date.parse(`${d.checkpointWeekStart}T00:00:00`)
  const t = now.getTime()
  return t >= start && t < start + 7 * 864e5
}
