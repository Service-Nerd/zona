/**
 * NO-RUNNER-TURNED-AWAY-01, Phase D — THE WALK-RUN START (§116 floor note amended by name; Coaching Board 2026-10-24 Q3
 * and 2026-10-25 L1–L5, `docs/decisions/coaching-2026-10-25-walk-run-start.md`).
 *
 * Below `BASE_BUILD_ONRAMP_MIN_START_KM`, including 0, a runner is not someone a RUNNING ramp serves (Willy's floor, which
 * stands). They start here: three 30-minute walk-run sessions a week, the run share stepping up one minute a week from 1/2
 * to §117's 6/1, a deload every fourth week holding the previous level. Then §116's ramp takes over at 6 km, still
 * carrying the 6/1 pattern (L5, Willy), and the checkpoint follows as for any staged plan.
 *
 * ⚠️ IT PROGRESSES THE RUN SHARE, NOT THE DISTANCE. The sessions are time on feet and carry no distance: there is no
 * pace for these runners, and a distance computed from an assumed one would be a number we invented.
 */

import type { GeneratorInput, Session, Week } from '@/types/plan'
import { GENERATION_CONFIG } from './generationConfig'
import { DAY_ORDER, normaliseDays, type Day } from './days'

export interface WalkRunLevel { run_mins: number; walk_mins: number }

/** L1, ladder A: 1/2, 2/2, … 5/2, then §117's 6/1. Derived from the ruled constants, so no step is a number of its own. */
export function walkRunLadder(): WalkRunLevel[] {
  const C = GENERATION_CONFIG
  const out: WalkRunLevel[] = []
  for (let r = C.WALK_RUN_START_RUN_MINS; r < C.FINISH_GOAL_RUNWALK_RUN_MINS; r++) {
    out.push({ run_mins: r, walk_mins: C.WALK_RUN_START_WALK_MINS })
  }
  out.push({ run_mins: C.FINISH_GOAL_RUNWALK_RUN_MINS, walk_mins: C.FINISH_GOAL_RUNWALK_WALK_MINS })
  return out
}

/** Week by week: which level, and whether it is §3's deload (holding the previous level). Ends on the last level. */
export function walkRunSchedule(): { level: number; deload: boolean }[] {
  const ladder = walkRunLadder()
  const freq = GENERATION_CONFIG.BASE_BUILD_ONRAMP_DELOAD_FREQUENCY
  const out: { level: number; deload: boolean }[] = []
  let next = 0
  for (let week = 1; next < ladder.length; week++) {
    if (week % freq === 0 && next > 0) out.push({ level: next - 1, deload: true })
    else out.push({ level: next++, deload: false })
  }
  return out
}

/** How many weeks the walk-run start takes. Never shortened to fit a runway (L4). */
export function walkRunStartWeeks(): number {
  return walkRunSchedule().length
}

/** Does this runner start with walk-run? Below §116's running floor, including 0. */
export function walkRunStartApplies(startKm: number): boolean {
  return startKm < GENERATION_CONFIG.BASE_BUILD_ONRAMP_MIN_START_KM
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/** The interval as the runner reads it, in §117's own sentence (`runWalkStrategy`), at this level. */
export function walkRunStrategy(level: WalkRunLevel): string {
  return `Run ${plural(level.run_mins, 'minute')}, walk ${level.walk_mins}. Repeat. Take the walk break before you need it, from the first rep.`
}

/**
 * L3 — three days, never two in a row where the runner's days allow. The least-adjacent set of the days they can
 * train; ties go to the one closest to Tuesday, Thursday, Saturday (or Sunday, if that is their long-run day).
 */
export function walkRunDays(input: Pick<GeneratorInput, 'days_cannot_train' | 'preferred_long_run_day'>): Day[] {
  const blocked = normaliseDays(input.days_cannot_train ?? [])
  const open = DAY_ORDER.filter(d => !blocked.has(d))
  const want = Math.min(GENERATION_CONFIG.WALK_RUN_START_SESSIONS, open.length)
  const ideal: Day[] = ['tue', 'thu', input.preferred_long_run_day === 'sun' ? 'sun' : 'sat']
  const idx = (d: Day) => DAY_ORDER.indexOf(d)
  const adjacent = (a: Day, b: Day) => { const g = Math.abs(idx(a) - idx(b)); return g === 1 || g === 6 }
  let best: Day[] = open.slice(0, want)
  let bestScore = Infinity
  const pick = (from: number, chosen: Day[]) => {
    if (chosen.length === want) {
      let pairs = 0
      for (let i = 0; i < chosen.length; i++) for (let j = i + 1; j < chosen.length; j++) if (adjacent(chosen[i], chosen[j])) pairs++
      const miss = chosen.filter(d => !ideal.includes(d)).length
      const score = pairs * 10 + miss
      if (score < bestScore) { bestScore = score; best = [...chosen] }
      return
    }
    for (let i = from; i < open.length; i++) pick(i + 1, [...chosen, open[i]])
  }
  pick(0, [])
  return best
}

/** One walk-run session at a level. `hrTarget` is §12's easy ceiling where derivable (BASEBUILD-ZONE-CEILING-01). */
export function walkRunSession(level: WalkRunLevel, hrTarget: string | null): Session {
  return {
    type: 'easy',
    label: 'Walk-run',
    detail: walkRunStrategy(level),
    duration_mins: GENERATION_CONFIG.WALK_RUN_START_MINS,
    zone: 'Zone 2',
    ...(hrTarget ? { hr_target: hrTarget } : {}),
    run_walk_strategy: walkRunStrategy(level),
    walk_run_level: level,
    coach_notes: ['Easy enough to talk on the runs. The walks are part of the session, not a rest from it.'],
  } as Session
}

/** The walk-run weeks, dated from `planStart`, numbered from 1, phase `walk_run_start`. */
export function generateWalkRunWeeks(
  input: Pick<GeneratorInput, 'days_cannot_train' | 'preferred_long_run_day'>,
  planStart: string,
  hrTarget: string | null,
): Week[] {
  const ladder = walkRunLadder()
  const days = walkRunDays(input)
  const t0 = Date.parse(`${planStart}T00:00:00Z`)
  return walkRunSchedule().map((wk, i) => {
    const level = ladder[wk.level]
    const sessions: Record<string, Session> = {}
    for (const d of days) sessions[d] = walkRunSession(level, hrTarget)
    return {
      n: i + 1,
      date: new Date(t0 + i * 7 * 864e5).toISOString().slice(0, 10),
      label: `Walk-run ${i + 1}`,
      theme: wk.deload ? 'An easier week, on purpose.' : `Run ${plural(level.run_mins, 'minute')}, walk ${level.walk_mins}.`,
      type: wk.deload ? 'deload' : 'normal',
      phase: 'walk_run_start',
      sessions,
    } as unknown as Week
  })
}
