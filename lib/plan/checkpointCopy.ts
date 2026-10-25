/**
 * NO-RUNNER-TURNED-AWAY-01 — every runner-facing string of the staged race plan, from ONE owner (the shape of
 * `baseBuildCopy.ts`). The words are the founder's, approved 2026-10-24; this file only fills them in.
 *
 * ⚠️ The approved table used example figures ("12 km", "16 Nov", "Two more weeks"). They are interpolated here, never
 * hard-typed, so the copy says this runner's numbers. Distances go through ADR-015's `formatDistance`, dates through
 * `formatDate`, and the race's noun through `raceLabelFor`, so no string here assembles a unit or a race by hand.
 */

import { formatDistance, formatDate, type DistanceUnits } from '@/lib/format'
import { raceLabelFor } from './raceLabel'
import { raceDistanceKey } from './generationConfig'
import type { StagedRace, CheckpointOption } from './stagedRacePlan'

const raceNoun = (raceKm: number) => {
  const l = raceLabelFor(raceDistanceKey(raceKm))
  return l.charAt(0).toUpperCase() + l.slice(1)
}
const km = (v: number, units: DistanceUnits) => formatDistance(v, units, { exact: true }) ?? ''
const day = (iso: string) => formatDate(iso, 'short') ?? ''

/** The base-building phase card's title. */
export const BASE_BUILDING_TITLE = 'Base building'
/** The walk-run start's title (a 0 km/week start, phase D). */
export const WALK_RUN_START_TITLE = 'Walk-run start'

/** "Base building · 3 weeks" card body: "Easy running up to about 12 km a week. Checkpoint w/c 16 Nov." */
export function basePhaseLine(staged: StagedRace, checkpointWeekStart: string, units: DistanceUnits,
  /** Where the ramp actually reaches. The card beside it states the peak week, and "up to about 8 km" over "peak 9 km"
   *  contradicted it (seen rendering, 2026-10-25), so the line quotes the ramp's own end, never below the target. */
  rampEndKm: number = staged.door_km): string {
  return `Easy running up to about ${km(Math.max(rampEndKm, staged.door_km), units)} a week. Checkpoint w/c ${day(checkpointWeekStart)}.`
}

/** Design Board 2026-10-25 (S3): the walk-run start's phase card line (founder-approved 2026-10-25). */
export const WALK_RUN_START_LINE = 'Run 1 minute, walk 2. A minute more running each week.'

/** Design Board 2026-10-25 (S2): the hero's labels on a staged plan (founder-approved 2026-10-25). */
export const STAGED_HERO_TARGET_LABEL = 'a week by the checkpoint'
export const STAGED_HERO_CHECKPOINT_LABEL = 'checkpoint'

/** The race block before it exists: title "Marathon training", line "from 23 Nov. Built after your checkpoint." */
export function raceBlockTitle(staged: StagedRace): string {
  return `${raceNoun(staged.race_distance_km)} training`
}
export function raceBlockLine(raceBlockStart: string): string {
  return `from ${day(raceBlockStart)}. Built after your checkpoint.`
}
/** E0a (Coaching Board 2026-10-25; founder-approved words 2026-10-25): a staged plan whose target was not found at
 *  signup never presents the race block as a certainty. */
export function raceBlockLineIfAllowed(raceBlockStart: string): string {
  return `from ${day(raceBlockStart)}, if your checkpoint allows.`
}
/** The ONE choice between the two lines, so no screen can promise a block the engine already knows does not fit. */
export function raceBlockLineFor(staged: Pick<StagedRace, 'target_found'>, raceBlockStart: string): string {
  return staged.target_found ? raceBlockLine(raceBlockStart) : raceBlockLineIfAllowed(raceBlockStart)
}

/** Today, in the last week of base building only (Design Board amendment 4). */
export const CHECKPOINT_THIS_WEEK_LINE = "Checkpoint on Sunday. Easy miles count; the pace doesn't."

/** Today, once the checkpoint has passed: "12.4 km a week. Marathon training starts Monday." */
export function checkpointPassedLine(observedKm: number, raceKm: number, units: DistanceUnits): string {
  return `${km(observedKm, units)} a week. ${raceNoun(raceKm)} training starts Monday.`
}

/** Not passed: heading and why. */
export function notPassedHeading(observedKm: number, units: DistanceUnits): string {
  return `You ran ${km(observedKm, units)} a week.`
}
export function notPassedWhy(targetKm: number, raceKm: number, units: DistanceUnits): string {
  return `${raceNoun(raceKm)} training needs about ${km(targetKm, units)} to start safely.`
}

/** Not passed: the options, recommended first (Design Board amendment 7). The approved "Two more weeks" is the
 *  engine's own number of weeks (founder-approved 2026-10-25). */
export function extendOptionLabel(weeks: number): string {
  return `${weeks === 1 ? 'One more week' : `${weeks} more weeks`} of base building`
}
export function runWalkOptionLabel(raceKm: number): string {
  return `Run-walk the ${raceLabelFor(raceDistanceKey(raceKm))}`
}
export const LATER_RACE_OPTION_LABEL = 'Pick a later race'
/** E1 (Coaching Board 2026-10-25; founder-approved 2026-10-25): the half marathon on the same date. */
export const HALF_SAME_DAY_OPTION_LABEL = 'Run the half marathon on the same day'

/** C4, no target fits the runway (founder-approved 2026-10-25). Only where both of its two ways are on offer. */
export const CHOOSE_HEADING = 'Two ways to get to the start line from here.'

/** No runs recorded (Design Board amendment 8). */
export const NO_RUNS_HEADING = "We haven't seen any runs yet."
export const CONNECT_HEALTH_OPTION_LABEL = 'Connect Apple Health'
export const LOG_RUN_OPTION_LABEL = 'Log a run'

/** The consent screen (Design Board amendments 5, 7, 8), from the checkpoint's 422 body. Null for any other body. */
export interface CheckpointConsent {
  heading: string
  /** One factual sentence of why, with the observed figure. Never a training-effect claim. */
  why: string | null
  /** Recommended first; at most three (the engine offers only what will build). */
  options: { kind: CheckpointOption['kind']; label: string }[]
}

export function checkpointConsent(body: Record<string, unknown> | null | undefined, units: DistanceUnits): CheckpointConsent | null {
  const reason = body?.reason
  const options = Array.isArray(body?.options) ? (body!.options as CheckpointOption[]) : null
  if (!options || (reason !== 'checkpoint_no_runs' && reason !== 'checkpoint_not_reached' && reason !== 'checkpoint_choose')) return null
  const observed = typeof body!.observed_km === 'number' ? body!.observed_km : null
  const raceKm = typeof body!.race_distance_km === 'number' ? body!.race_distance_km : null
  const target = typeof body!.target_km === 'number' ? body!.target_km : null
  const label = (o: CheckpointOption): string | null => {
    switch (o.kind) {
      case 'extend':         return o.weeks > 0 ? extendOptionLabel(o.weeks) : null
      case 'run_walk':       return raceKm ? runWalkOptionLabel(raceKm) : null
      case 'half':           return HALF_SAME_DAY_OPTION_LABEL
      case 'later_race':     return LATER_RACE_OPTION_LABEL
      case 'connect_health': return CONNECT_HEALTH_OPTION_LABEL
      case 'log_run':        return LOG_RUN_OPTION_LABEL
      default:               return null
    }
  }
  const shown = options.slice(0, 3).map(o => ({ kind: o.kind, label: label(o) }))
    .filter((o): o is { kind: CheckpointOption['kind']; label: string } => !!o.label)
  if (reason === 'checkpoint_no_runs') return { heading: NO_RUNS_HEADING, why: null, options: shown }
  if (observed === null) return null
  if (reason === 'checkpoint_not_reached') {
    return { heading: notPassedHeading(observed, units), why: target && raceKm ? notPassedWhy(target, raceKm, units) : null, options: shown }
  }
  return { heading: shown.length === 2 ? CHOOSE_HEADING : notPassedHeading(observed, units), why: null, options: shown }
}
