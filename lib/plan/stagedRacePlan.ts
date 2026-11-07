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

import type { Plan, GeneratorInput, Week, Session } from '@/types/plan'
import { GENERATION_CONFIG, raceDistanceKey } from './generationConfig'
import { raceLabelFor } from './raceLabel'
import { generateBaseBuildPlan, onRampWeeksNeeded, onRampCurve, type OnRampAssessment } from './baseBuildOnRamp'
import { effectiveStartKm } from './startVolume'
import { prepBlockWeeks } from './inputs'
import { weeksBetweenLocal } from './length'
import type { WeeklyLoad } from '@/lib/coaching/weeklyActualLoad'
import { generateRulePlan } from './ruleEngine'
import { isDesignedRefusal } from './designedRefusal'
import { auditPlanQuality, objectionsOnly } from './planQuality'
import { validatePlan } from './invariants'
import { isBaseBuildPlan } from './validateStoredPlan'
import { isDateBeforePlan } from './weekResolution'
import { walkRunStartApplies, walkRunStartWeeks, generateWalkRunWeeks, walkRunSchedule, walkRunResumeSchedule } from './walkRunStart'
import { BaseVolumeError, baseBuildRatioApplies, baseBuildRatioOf } from './baseVolume'
import { LongRunReadinessError } from './longRunReadiness'
import { applyRunWalk } from './runWalkPlan'

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
export function checkpointPlacement(input: GeneratorInput, doorKm: number, runwayWeeks: number,
  startKm: number = effectiveStartKm(input)): CheckpointPlacement | null {
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
/**
 * The lowest volume a ramp can target: the door, or one search step above where the runner already is.
 * 🔴 Found walking real plans (2026-10-25): §117 Am.2's refusal reuses `BaseVolumeError` with a door AT the runner's own
 * volume (their run-walk long run cannot reach adequacy in time, not their weekly volume), so `door > start` failed and a
 * runner the board ruled staged was refused. C3's rule is "the lowest volume at or above the door from which the race
 * block is clean", and a volume the runner already has cannot be that, so the search starts above it.
 */
function rampDoorFloor(doorKm: number, startKm: number): number {
  return doorKm > startKm ? doorKm : Math.round((startKm + TARGET_STEP_KM) * 10) / 10
}

export function stagingApplies(input: GeneratorInput, doorKm: number, runwayWeeks: number): boolean {
  // Phase D (L4): below the running floor the walk-run start comes first, is never shortened, and is given whenever it
  // ends before the race. Where the runway cannot also hold the ramp and §44's block, the checkpoint offers what builds.
  if (walkRunStartApplies(effectiveStartKm(input))) return runwayWeeks > walkRunStartWeeks()
  return checkpointPlacement(input, rampDoorFloor(doorKm, effectiveStartKm(input)), runwayWeeks) !== null
}

/** ⚠️ EXPORTED AS `addWeeksIso` rather than copied. `engine.ts` needs the same arithmetic for §118's probe
 *  checkpoint, and `length.ts` owns `addDays(Date)` only — a third hand-rolled ISO walk is how two date helpers come
 *  to disagree. UTC-anchored deliberately: plan dates are plain ISO days, not instants. */
export const addWeeksIso = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 7 * 864e5).toISOString().slice(0, 10)
const addWeeks = addWeeksIso
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
/** THE ONE "is this race block one we would hand over" test, shared by the engine's option producers and target search
 *  and by `stagedScore` (code review 2026-10-25: the harness had its own copy). `refusal` is the designed refusal's name. */
export interface RaceBlockVerdict { race: Plan | null; refusal: string | null; errorCodes: string[]; objectionCodes: string[] }
export function raceBlockVerdict(input: GeneratorInput, checkpoint: string): RaceBlockVerdict {
  let race: Plan
  try { race = generateRulePlan(input, 'paid', checkpoint, undefined, dayBefore(checkpoint)) } catch (e) {
    if (isDesignedRefusal(e)) return { race: null, refusal: (e as Error).name, errorCodes: [], objectionCodes: [] }
    throw e
  }
  const errorCodes = validatePlan(race, input).filter(v => v.severity === 'error').map(v => v.code)
  const m = race.meta as unknown as Record<string, unknown>
  const maintDeclared = m.volume_profile === 'maintenance' && !!m.volume_constraint_note
  // The same §23 reconciliation every harness applies: a declared maintenance plan may not build.
  const objectionCodes = objectionsOnly(auditPlanQuality(race, input).filter(o => !(o.code === 'NEVER-BUILDS' && maintDeclared))).map(o => o.code)
  return { race, refusal: null, errorCodes, objectionCodes: [...objectionCodes, ...ratioObjection(race, input)] }
}

/**
 * §116 Amendment 11 — **the door must land the block inside §111's ratio, at a distance §111 does not govern.**
 *
 * 🩹 Willy, binding (Coaching Board 2026-11-06, `STAGED-HM-DOOR-01`): C3 picks *the lowest CLEAN volume*, and "clean"
 * is the validator plus the coach objections — **neither of which contains §111 below 42 km.** So at the half the
 * search stopped at 6.5 km/week and the block it built peaked at 34: a **5.67×** build off a runner who has never run,
 * where the already-ratified marathon twin is **3.55×**. §111 Am. 2 ratified the 4.0 cap citing a median true build of
 * **5.57×** in this exact cohort with *zero* genuine plan defects, so a green validator was never going to see it.
 *
 * ⚠️ IT IS AN OBJECTION, NOT A REFUSAL, AND THE REGISTER IS THE POINT. §111 refuses; this disqualifies a DOOR.
 * Nobody is newly refused, so `WIZARD-ZERO-VOLUME-REFUSAL-01` Am. 1 ("§111's scope ratified, NOT extended") holds.
 *
 * ⚠️ A NO-OP WHERE §111 GOVERNS, **BY CONSTRUCTION AND NOT BY LUCK** — guarded on `!applies` rather than left to the
 * fact that `generateRulePlan` would have thrown first. "It cannot happen" is the claim this repo has paid for; the
 * predicate says it.
 *
 * 🔴 AND IT LIVES IN `raceBlockVerdict`, WHICH IS WHY BOTH TWINS ARE FIXED. The door search reaches it through
 * `raceBlockClean`; **E1's half-same-day offer reaches it through `cleanRaceBlock`** — measured before the board ruled:
 * 8 of 68 E1 offers were over the cap, every one at 6–8 km/week observed, up to 5.67×. Fixing the search and leaving E1
 * is the one-twin failure this repo catalogues. The cost was measured too: **all 8 of those runners have `extend`
 * available**, which is the right answer at 6 km/week. ⚠️ `stagedScore` reads `objectionCodes` from here, so the
 * harness cannot disagree with the producer about this — the flaw that put a second copy of "clean" in the harness.
 */
function ratioObjection(race: Plan, input: GeneratorInput): string[] {
  if (baseBuildRatioApplies(input.race_distance_km)) return []
  const { ratio, cap } = baseBuildRatioOf(race, input)
  return ratio > cap ? ['BASE-BUILD-RATIO-OVER-CAP'] : []
}
function cleanRaceBlock(input: GeneratorInput, checkpoint: string): Plan | null {
  const v = raceBlockVerdict(input, checkpoint)
  return v.race && v.errorCodes.length === 0 && v.objectionCodes.length === 0 ? v.race : null
}
const raceBlockClean = (input: GeneratorInput, checkpoint: string): boolean => cleanRaceBlock(input, checkpoint) !== null

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
export function checkpointTarget(input: GeneratorInput, planStart: string, minBaseKm: number, runwayWeeks: number,
  startKm: number = effectiveStartKm(input)): number | null {
  const from = rampDoorFloor(minBaseKm, startKm)
  for (let t = from; t <= from * TARGET_MAX_MULTIPLE; t = Math.round((t + TARGET_STEP_KM) * 10) / 10) {
    const placed = checkpointPlacement(input, t, runwayWeeks, startKm)
    if (!placed || !placed.reachesDoor) return null
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
  if (walkRunStartApplies(effectiveStartKm(input))) return generateWalkRunStagedPlan(input, planStart, minBaseKm, runway)
  // C3, else C4: no target fits the runway, so the runner is still staged at §111's door with `reaches_door: false`
  // where Q1 had to move the checkpoint, and the checkpoint's consent screen offers run-walk or a later race.
  const target = checkpointTarget(input, planStart, minBaseKm, runway)
  const doorKm = target ?? rampDoorFloor(minBaseKm, effectiveStartKm(input))
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

/**
 * NO-RUNNER-TURNED-AWAY-01, C4 + Design Board amendment 7 — WHAT THE CHECKPOINT MAY OFFER A RUNNER WHO DID NOT PASS.
 *
 * ⚠️ AN OPTION IS OFFERED ONLY WHERE ITS ACTION WILL SUCCEED (`BASEBUILD-ADJUST-DOOR-01`, settled ground). Each is
 * decided by running the producer that would serve it, never by a predicate that could drift from it.
 */
/** The runner's choice on the consent screen, re-sent with `checkpoint: true`. `later_race` and `connect_health` are
 *  the client's to act on (the wizard, Me → Connections); only these two need the engine. */
export type CheckpointChoice = 'extend' | 'run_walk' | 'half'

export type CheckpointOption =
  | { kind: 'extend'; weeks: number }
  | { kind: 'run_walk' }
  | { kind: 'half' }
  | { kind: 'later_race' }
  | { kind: 'connect_health' }
  | { kind: 'log_run' }

/** More base building, from what they RAN, toward the race block's measured floor (the plan's own C3 target). Null
 *  when that ramp cannot reach it before §44's block, or no clean race block exists from it: then the runner would
 *  be back at the same screen in a few weeks, which is not an option, it is a delay. */
export function extendedStagedPlan(input: GeneratorInput, observedKm: number, longestKm: number, staged: StagedRace,
  planStart: string, afterWalkRun = false): Plan | null {
  // ⚠️ Below the running floor this would restart a runner at 1/2. E3 (Coaching Board 2026-10-25): after a walk-run
  // start they RESUME at 6/1 then the ramp; without one, nothing is ruled, so the option is withheld.
  let p: Plan | null
  if (walkRunStartApplies(observedKm)) {
    if (!afterWalkRun) return null
    const ci = checkpointRaceInput(input, observedKm, longestKm)
    p = generateWalkRunStagedPlan(ci, planStart, staged.door_km, weeksBetweenLocal(planStart, ci.race_date), true)
  } else {
    p = generateStagedRacePlan(checkpointRaceInput(input, observedKm, longestKm), planStart, staged.door_km)
    // L5 (code review 2026-10-25): after a walk-run start the ramp keeps the 6/1 pattern until the checkpoint, so more
    // base building at 6 km+ keeps it too; the continuous bout must not near-triple because the plan was extended.
    if (p && afterWalkRun) {
      p = { ...p, weeks: p.weeks.map(w => ({ ...w,
        sessions: Object.fromEntries(Object.entries(w.sessions ?? {}).map(([d, s]) => [d, s ? applyRunWalk(s as Session) : s])) })) as Week[] }
      ;(p.meta as unknown as Record<string, unknown>).walk_run_carried = true
    }
  }
  const s = stagedRaceOf(p)
  return p && s && s.target_found && s.reaches_door ? p : null
}

/** §117's run-walk finish from what they ran, skipping the C3 target. Null unless the race block is clean AND is in
 *  fact a run-walk plan: §117 applies only to a beginner's finish goal, and "run-walk the marathon" on a plan that is
 *  not one would be the copy promising what the engine will not produce. */
export function runWalkFinishInput(input: GeneratorInput, observedKm: number, longestKm: number,
  planStart: string): GeneratorInput | null {
  const rw = { ...checkpointRaceInput(input, observedKm, longestKm), goal: 'finish' } as GeneratorInput
  const race = cleanRaceBlock(rw, planStart)
  return race && (race.meta as unknown as Record<string, unknown>).finish_goal_run_walk === true ? rw : null
}

/**
 * Design Board amendment 6 — PASSING: one line on Today, no ceremony. True from accepting the race plan the checkpoint
 * built until it starts. `volume_observed` is set only by the server at the checkpoint (the route strips a client's), and
 * the plan keeps it in `generator_input`, so the line quotes the figure the checkpoint measured, not a planned one.
 */
export function checkpointPassed(plan: Plan | null | undefined, now: Date): { observedKm: number; raceKm: number } | null {
  if (!plan || isBaseBuildPlan(plan) || !isDateBeforePlan(plan.weeks, now)) return null
  const gi = (plan.meta as unknown as { generator_input?: GeneratorInput }).generator_input
  if (!gi?.volume_observed || typeof gi.current_weekly_km !== 'number' || !gi.race_distance_km) return null
  return { observedKm: gi.current_weekly_km, raceKm: gi.race_distance_km }
}

/**
 * Phase D — a staged plan that starts with the walk-run start (§116 floor note; Coaching Board 2026-10-25, L1–L5).
 *
 * The walk-run weeks, then §116's ramp from `BASE_BUILD_ONRAMP_MIN_START_KM`, each session carrying §117's 6/1 pattern
 * (L5), to the checkpoint, which is placed for the ramp by Q1 and C3 exactly as for any staged plan. L4: the walk-run
 * start is never shortened; where the runway cannot also hold a ramp week and §44's block, the plan is the walk-run
 * start alone, `reaches_door: false`, and the checkpoint offers what builds.
 */
function generateWalkRunStagedPlan(input: GeneratorInput, planStart: string, minBaseKm: number, runway: number,
  resume = false): Plan {
  const schedule = resume ? walkRunResumeSchedule() : walkRunSchedule()
  const wrWeeks = schedule.length
  const rampStart = addWeeks(planStart, wrWeeks)
  const rampRunway = runway - wrWeeks
  const startKm = GENERATION_CONFIG.BASE_BUILD_ONRAMP_MIN_START_KM
  const target = checkpointTarget(input, rampStart, minBaseKm, rampRunway, startKm)
  // 🔴 `rampDoorFloor`, WHICH THIS LINE WAS MISSING WHILE ITS SIBLING AT `generateStagedRacePlan` HAD IT
  // (code review, 2026-11-06). `checkpointPlacement` requires `doorKm > startKm`, and the new floor seed of 6 EQUALS
  // the ramp's own `BASE_BUILD_ONRAMP_MIN_START_KM` of 6 — so the fallback door failed its own placement and the
  // ramp was dropped entirely. Measured: a never-run half runner at a 20-week runway got **7 walk-run weeks and
  // ZERO ramp weeks**, though `checkpointPlacement` yields 2 reachable ramp weeks with 5 available.
  const doorKm = target ?? rampDoorFloor(minBaseKm, startKm)
  const placed = checkpointPlacement(input, doorKm, rampRunway, startKm)

  let rampWeeks: Week[] = []
  let base: Plan
  if (placed) {
    const curve = onRampCurve(startKm, placed.rampWeeks)
    base = generateBaseBuildPlan(input, rampStart, {
      outcome: 'offered', rampWeeks: placed.rampWeeks, remainingWeeks: placed.raceWeeks, targetKm: curve[curve.length - 1], startKm,
    })
    // L5 (Willy): the ramp keeps the 6/1 pattern, so the continuous bout does not near-triple in one week.
    rampWeeks = base.weeks.map((w, i) => ({
      ...w, n: wrWeeks + i + 1,
      sessions: Object.fromEntries(Object.entries(w.sessions ?? {}).map(([d, s]) => [d, s ? applyRunWalk(s as Session) : s])),
    })) as Week[]
  } else {
    // No ramp fits: build the meta from a one-week ramp and keep none of its weeks.
    base = generateBaseBuildPlan(input, rampStart, { outcome: 'offered', rampWeeks: 1, remainingWeeks: rampRunway - 1, targetKm: startKm, startKm })
  }
  const hr = (Object.values(base.weeks[0]?.sessions ?? {})[0] as Session | undefined)?.hr_target ?? null
  const weeks = [...generateWalkRunWeeks(input, planStart, typeof hr === 'string' ? hr : null, schedule), ...rampWeeks]
  const meta = base.meta as unknown as Record<string, unknown>
  delete meta.base_build_onramp
  meta.enrichment = 'skipped_plan_kind'
  meta.plan_start = planStart
  meta.walk_run_start_weeks = wrWeeks
  if (resume) meta.walk_run_resumed = true
  meta.base_build_start_km = startKm
  if (!placed) meta.base_build_target_km = startKm
  const staged: StagedRace = {
    race_name: input.race_name || '',
    race_date: input.race_date,
    race_distance_km: input.race_distance_km,
    door_km: doorKm,
    min_base_km: minBaseKm,
    target_found: target !== null,
    checkpoint_week: weeks.length,
    race_weeks: runway - weeks.length,
    reaches_door: !!placed?.reachesDoor,
  }
  meta.staged_race = staged
  return { ...base, weeks }
}

/**
 * §116 Amendment 11 — **the door for a runner §113 refuses**, asked with §113's own floor
 * (`MIN_SESSION_DISTANCE_KM.long`) substituted as the long run: the door is a property of the race block's weekly
 * volume, not of the long run, so the probe removes the long run from the question.
 *
 * Three answers, and the middle one is the fix:
 *
 *   - **§111 refuses** → its door. (What this function did, and only this.)
 *   - **nothing refuses** → `BASE_BUILD_ONRAMP_MIN_START_KM`, the volume §116 says a runner must reach to be running
 *     at all. The long run was the ONLY blocker, so the runner is stageable and there is no §111 door to seed with.
 *   - **something else refuses** (§44 on the runway, §52 on the days) → `null`, and that refusal stands.
 *
 * 🔴 THE MIDDLE ANSWER WAS `null`, AND THAT IS THE WHOLE DEFECT (`STAGED-HM-DOOR-01`). ⚠️ **AND THE PREMISE BELOW
 * EXPIRED ONE DAY LATER: §111 Amendment 4 (2026-11-07) moved `BASE_BUILD_RATIO_MIN_DISTANCE_KM` to 21, so the half
 * DOES have a §111 door now and this function's middle answer is reached less often.** The reasoning is kept because
 * it is why the function exists; the parenthetical scope is corrected. As written on 2026-11-06: §111 governed
 * `race_distance_km >= BASE_BUILD_RATIO_MIN_DISTANCE_KM` (**then 42**), so **a half marathon had no §111 door**
 * — and the old `return null` read "nothing to stage" where the truth was "nothing left to object to". Measured
 * through `runEngine` for 0 km/week, 0 km longest, declared beginner, 3 days: the **marathon stages at every runway
 * from 12**, and the **half is refused at 12, 16, 20, 24 AND 30**. A runner who typed the harder race got the plan.
 *
 * ⚠️ §111's TEXT ALREADY SAID THIS RUNNER WAS SERVED, and had been wrong since the day it was written:
 * *"Short distances (5K/10K/HM) are outside §111 entirely, so a never-run beginner still generates there."* §113 was
 * ratified in the same sitting block and governs >= 21 km, so it made that sentence false immediately. §111's own
 * *"Out of scope, flagged not fixed — a separate sitting"* is this sitting.
 *
 * ⚠️ THE SEED IS NOT A NEW NUMERIC, DELIBERATELY. The board's artifact list named a `STAGED_DOOR_FLOOR_KM`; a
 * constant equal to `BASE_BUILD_ONRAMP_MIN_START_KM` is the second copy the Configuration Singularity forbids, and
 * `configPrincipleSync` would then want a principle for a number that already has one. Recorded as a departure from
 * the ruling's artifact list, with the reason, rather than taken silently.
 */
export type LongRunRefusalDoor =
  /** §111 refuses once the long run is out of the question: its door, and §116 Am. 9's ratified path. */
  | { kind: 'base_volume'; km: number }
  /** Nothing refuses: the long run was the ONLY blocker, so there is no §111 door to seed with. */
  | { kind: 'no_objection' }
  /** Something else refuses (§44 on the runway, §52 on the days). That refusal stands. */
  | null

/**
 * 🔴 A KIND, NOT A NUMBER, AND THE FIRST CUT RETURNED A NUMBER FOR ALL THREE (code review, same day).
 * `no_objection` was encoded as `BASE_BUILD_ONRAMP_MIN_START_KM`, so the caller could only tell the two apart by
 * comparing against that constant — and §111's own door can equal 6. **Absence written as a value**, in the commit
 * whose own invariant note warns about it.
 */
export function longRunRefusalDoor(input: GeneratorInput, planStart: string): LongRunRefusalDoor {
  const floor = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long
  // ⚠️ THE WEEKLY VOLUME RISES WITH THE LONG RUN, BECAUSE §18 SAYS IT MUST. A hypothetical runner with a 5 km long
  // run cannot be on a 2 km week — `INV-INPUT-LONGEST-LE-WEEKLY` is exactly that rule — and the first cut substituted
  // the long run alone, so the probe asked §111 about a runner the constitution forbids and `validatePlan` logged an
  // error from inside the probe on every sub-floor case. An incoherent hypothetical cannot give a trustworthy door.
  const probe = {
    ...input,
    longest_recent_run_km: floor,
    current_weekly_km: Math.max(Number(input.current_weekly_km ?? 0), floor),
  } as GeneratorInput
  try {
    generateRulePlan(probe, 'paid', planStart)
    return { kind: 'no_objection' }
  } catch (e) {
    return e instanceof BaseVolumeError ? { kind: 'base_volume', km: e.base.min_base_km } : null
  }
}

/**
 * THE ONE ANSWER to "is this designed refusal one we stage, and at what door?". `runEngine` and `measure:envelope` both
 * ask it, because the measurement drifted from the engine the day Phase D shipped: the envelope staged only §111's
 * refusals and could not see a walk-run runner, whom §113 refuses first. Null: the refusal stands.
 */
export function stagingDoorKm(err: unknown, input: GeneratorInput, planStart: string): number | null {
  if (err instanceof BaseVolumeError) return err.base.min_base_km
  // 🔴 THE `walkRunStartApplies` GATE WAS HERE AND IT WAS A SECOND, NARROWER DEFECT (§116 Am. 11).
  //
  // Phase D added this branch for the walk-run runner and gated it on being one, so a runner ALREADY RUNNING whom
  // §113 refuses was not staged **even where §111 has a door and `stagingApplies` returns true** — measured, marathon
  // at 6-10 km/week, doors 9 and 11. `longRunRefusalDoor`'s own docstring said it was written for "a walk-run
  // runner, whom §113 refuses first", and the class is "§113 refuses first", of which walk-run is one case.
  // **The remedy was applied to one twin**, which this repo catalogues. The door function answers for both.
  if (err instanceof LongRunReadinessError) {
    const door = longRunRefusalDoor(input, planStart)
    if (door === null) return null
    // §111's door is the ratified §116 Am. 9 path and includes the second twin (a runner already running whom
    // §113 refuses first). Staged at whatever volume.
    if (door.kind === 'base_volume') return door.km
    // 🔴 BUT THE FLOOR SEED IS ONLY MEANINGFUL WHERE THE WALK-RUN START APPLIES, AND CODE REVIEW CAUGHT THE
    // FIRST CUT SHIPPING THE EXACT HAZARD §113 EXISTS TO PREVENT.
    //
    // §113's blocker is a LONG RUN; the staged door is a WEEKLY VOLUME. For a runner starting from nothing the two
    // coincide — §117's walk-run start builds the long run from zero, in minutes, over seven weeks, and §113's
    // premise is answered. **For a runner who already has volume they diverge completely**, because §116's ramp sizes
    // its long run from VOLUME and never from their long run. Measured, with the gate removed:
    //
    //     marathon, 55 km/wk, longest 2 km, 12 wks -> staged, WEEK-1 LONG RUN 18.3 km (+815%)
    //                                                 and `INV-PLAN-ONRAMP-PER-RUN-STEP` fires (§116 Am. 2, Willy)
    //     half,     10 km/wk, longest 1 km         -> 3.3 km (+230%)
    //     half,      6 km/wk, longest 1 km         -> 2.0 km (+100%)
    //
    // ⚠️ THIS NARROWS THE BOARD'S RULING, WHICH SAID *"at every volume, including a runner already above
    // `BASE_BUILD_ONRAMP_MIN_START_KM`"*. That sentence assumed §111 would supply the door; where it does not, a
    // volume ramp does nothing for a long-run blocker. The ruling's REASON is fully served — the never-run half
    // runner is staged — and for the already-running runner §113's own lever is the right coaching
    // (*"build up to one 5 km run"*), now carrying §118's offer (Am. 4). Recorded as a correction, not absorbed.
    return walkRunStartApplies(effectiveStartKm(input)) ? GENERATION_CONFIG.BASE_BUILD_ONRAMP_MIN_START_KM : null
  }
  return null
}

/** E1 (Coaching Board 2026-10-25) — the half marathon on the same date, from what they ran. Only for a marathon, and
 *  only where the half's block is clean (the same producer test as every option). Offered, never substituted. */
export function halfSameDayInput(input: GeneratorInput, observedKm: number, longestKm: number,
  planStart: string): GeneratorInput | null {
  if (raceDistanceKey(input.race_distance_km) !== 'MARATHON') return null
  // 21.1 is the distance, a fact (CLAUDE.md: facts stay inline). The race is named by its noun's owner.
  const label = raceLabelFor('HM')
  const half = { ...checkpointRaceInput(input, observedKm, longestKm),
    race_distance_km: 21.1, race_name: label.charAt(0).toUpperCase() + label.slice(1) } as GeneratorInput
  return cleanRaceBlock(half, planStart) ? half : null
}
