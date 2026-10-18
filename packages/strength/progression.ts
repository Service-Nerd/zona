// STRENGTH-PROGRESSION-01 (S14) — what to lift next, from what the runner logged. Coaching Board 2026-10-18:
// docs/decisions/strength-progression-coaching-2026-10-18.md.
//
// A SUGGESTION, never a requirement: no log, no change. Load only: reps, sets, RIR and the variant cadence stay the
// engine's (S6, S7). The rule, replayed over the runner's logs for one lift, oldest first:
//   easy → step · right twice at one load → step · hard → hold · hard twice at one load → down a tenth.
//   A step bigger than LOAD_STEP_MAX_PCT of the load adds a rep instead, up to REP_PROGRESSION_MAX, then the load.
//   At most one step per LOAD_STEP_MIN_DAYS. An injury the lift loads makes "easy" count as "right".
//   No step in a no-step session (deload, taper, race week, recovery-eased); those logs do not count.

import { STRENGTH_CONFIG as C } from './config'
import { CATALOGUE_BY_ID, PATTERN_REGION } from './catalogue'
import type { EquipmentTag, InjuryTag, RunPhase } from './types'

export type LiftFeel = 'easy' | 'right' | 'hard'

export interface LiftLog {
  date: string
  exercise_id: string
  /** What the runner lifted; null on a bodyweight lift. */
  load_kg: number | null
  feel: LiftFeel
  /** False when logged in a no-step session (decided when it was logged). */
  counts: boolean
}

export interface LiftSuggestion {
  kind: 'start' | 'hold' | 'step' | 'reps' | 'reduce' | 'hold_week' | 'bodyweight'
  load_kg: number | null
  /** Reps above the prescription, while the step is too big for the load. */
  extra_reps: number
  /** The most recent log this suggestion reads. */
  last: LiftLog | null
}

const LOAD_KIT = new Set<EquipmentTag>(['dumbbells', 'kettlebell', 'barbell', 'machines', 'cable'])
/** Every way of doing this lift needs load kit, so a weight is meaningful. */
export function isLoadedLift(exerciseId: string): boolean {
  const ex = CATALOGUE_BY_ID.get(exerciseId)
  return !!ex && ex.measure === 'reps' && ex.equipment.length > 0 && ex.equipment.every(opt => opt.some(t => LOAD_KIT.has(t)))
}

/** A session that holds back by design (S5, S6, S13): no step, and its log does not count. */
export function isNoStepSession(phase: RunPhase | undefined, eased: boolean): boolean {
  return eased || phase === 'deload' || phase === 'taper' || phase === 'race_week'
}

export function loadsInjury(exerciseId: string, injuries: readonly InjuryTag[]): boolean {
  const ex = CATALOGUE_BY_ID.get(exerciseId)
  if (!ex) return false
  return injuries.some(t => (C.INJURY_LOADED_MUSCLES[t] as readonly string[]).some(m => ex.muscles.includes(m as never)))
}

const round = (kg: number) => Math.round(kg / C.LOAD_ROUND_KG) * C.LOAD_ROUND_KG
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000)

export function suggestLoad(
  history: readonly LiftLog[],
  ctx: { exerciseId: string; today: string; noStep: boolean; injuries: readonly InjuryTag[] },
): LiftSuggestion {
  if (!isLoadedLift(ctx.exerciseId)) return { kind: 'bodyweight', load_kg: null, extra_reps: 0, last: null }
  const logs = history
    .filter(l => l.exercise_id === ctx.exerciseId && l.counts && l.date < ctx.today && l.load_kg != null && l.load_kg > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (!logs.length) return { kind: 'start', load_kg: null, extra_reps: 0, last: null }

  const lower = PATTERN_REGION[CATALOGUE_BY_ID.get(ctx.exerciseId)!.pattern] === 'lower'
  const step = lower ? C.LOAD_STEP_KG_LOWER : C.LOAD_STEP_KG_UPPER
  const slow = loadsInjury(ctx.exerciseId, ctx.injuries)

  let s: LiftSuggestion = { kind: 'hold', load_kg: logs[0].load_kg, extra_reps: 0, last: null }
  let goodAtLoad = 0, hardAtLoad = 0, prevLoad: number | null = null, lastStepDate: string | null = null
  for (const log of logs) {
    const load = log.load_kg!
    if (load !== prevLoad) { goodAtLoad = 0; hardAtLoad = 0; s = { ...s, extra_reps: 0 } }
    // A rise counts from the first log at the new weight, whether the app suggested it or the runner chose it.
    if (prevLoad != null && load > prevLoad) lastStepDate = log.date
    prevLoad = load
    if (log.feel === 'hard') {
      goodAtLoad = 0; hardAtLoad++
      s = hardAtLoad >= 2
        ? { kind: 'reduce', load_kg: round(load * (1 - C.LOAD_REDUCE_PCT)), extra_reps: 0, last: log }
        : { kind: 'hold', load_kg: load, extra_reps: s.extra_reps, last: log }
      continue
    }
    hardAtLoad = 0
    goodAtLoad += log.feel === 'easy' && !slow ? 2 : 1
    const due = goodAtLoad >= 2 && (lastStepDate == null || daysBetween(lastStepDate, log.date) >= C.LOAD_STEP_MIN_DAYS)
    if (!due) { s = { kind: 'hold', load_kg: load, extra_reps: s.extra_reps, last: log }; continue }
    lastStepDate = log.date; goodAtLoad = 0
    s = step > load * C.LOAD_STEP_MAX_PCT && s.extra_reps < C.REP_PROGRESSION_MAX
      ? { kind: 'reps', load_kg: load, extra_reps: s.extra_reps + 1, last: log }
      : { kind: 'step', load_kg: round(load + step), extra_reps: 0, last: log }
  }
  // Today holds back by design: keep the load, no extra reps (S14).
  if (ctx.noStep) return { kind: 'hold_week', load_kg: s.last!.load_kg, extra_reps: 0, last: s.last }
  return s
}
