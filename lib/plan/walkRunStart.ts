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

import type { GeneratorInput, Plan, Session, Week } from '@/types/plan'
import { GENERATION_CONFIG } from './generationConfig'
import { DAY_ORDER, normaliseDays, spreadDays, type Day } from './days'
import { onRampCurve, generateBaseBuildPlan } from './baseBuildOnRamp'
import { applyRunWalk } from './runWalkPlan'

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

/**
 * Is this runner below §116's RUNNING floor? Volume only, and deliberately so.
 *
 * ⚠️ THIS IS THE *WHETHER* QUESTION — whether a running ramp can serve them at all, which decides
 * `stagingApplies` and `longRunRefusalDoor`'s floor seed. It must stay volume-only: §116 Amendment 11's
 * narrowing (code review, 2026-11-06) exists because *"a volume ramp is not a long-run ramp"*, and a
 * high-volume runner with a short long run is refused by §113 ON PURPOSE, with §113's own lever
 * (*"build up to one 5 km run"*) and §118's offer attached.
 */
export function walkRunStartApplies(startKm: number): boolean {
  return startKm < GENERATION_CONFIG.BASE_BUILD_ONRAMP_MIN_START_KM
}

/**
 * §117 Amendment 7 — once a base-build block IS being built, does it START with walk-run?
 *
 * ⚠️ THIS IS THE *WHAT* QUESTION, and splitting it from the *whether* question above is the whole content of
 * the correction below. Readiness to RUN is answered by the longest run (§117 Am. 5), so a runner whose own
 * declared longest run says they cannot yet run continuously gets the walk-run start even when their weekly
 * volume sits on §116's floor.
 *
 * 🔴 AM. 7's FIRST CUT WIDENED `walkRunStartApplies` ITSELF, AND `/code-review` MEASURED WHAT THAT COST.
 * One gate answered both questions, so the longest-run signal also opened STAGING: across two grids,
 * **527 inputs went `refusal -> base_build`, and only 77 of them were at a volume of 6–8 km/week.
 * 450 were at 10–30**, including a 30 km/week runner handed a block that starts at 6. HEAD~1 refused those
 * eight high-volume cases deliberately; the widened gate served them a 9-week walk-run plan off one
 * mis-set longest-run slider (the wizard's ruler starts at 0, step 1, and only `longest <= weekly` is
 * enforced, so nothing else catches the drop — §2's arms bound increases).
 * ⚠️ **I had reported all 527 as "protective" because every one moved in the same DIRECTION. Direction is
 * not appropriateness.** The measured defect was 108 blocks, every one at `effectiveStartKm` 6, already
 * being staged and merely starting with continuous runs. This predicate fixes those and touches nothing else.
 *
 * ⚠️ ABSENCE IS NOT A VALUE. A runner who has not told us their longest run is not asserted to be unable to
 * run; the answer falls back to the volume floor alone.
 */
export function walkRunStartPrescribed(startKm: number, longestRunKm: number | undefined): boolean {
  if (walkRunStartApplies(startKm)) return true
  if (typeof longestRunKm !== 'number') return false
  return longestRunKm < GENERATION_CONFIG.WALK_RUN_START_MIN_LONGEST_RUN_KM
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/** The interval as the runner reads it, in §117's own sentence (`runWalkStrategy`), at this level. The walk-run words in
 *  this file (label, note, week lines) were approved by the founder on 2026-10-25. */
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
  const ideal: Day[] = ['tue', 'thu', input.preferred_long_run_day === 'sun' ? 'sun' : 'sat']
  return spreadDays(open, GENERATION_CONFIG.WALK_RUN_START_SESSIONS, [], ideal)
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
  schedule: { level: number; deload: boolean }[] = walkRunSchedule(),
): Week[] {
  const ladder = walkRunLadder()
  const days = walkRunDays(input)
  const t0 = Date.parse(`${planStart}T00:00:00Z`)
  return schedule.map((wk, i) => {
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

/**
 * THE WALK-RUN START PLUS ITS RAMP, COMPOSED ONCE (`GETRUNNING-WALKRUN-FLOOR-01`, 2026-11-12).
 *
 * 🔴 WHY THIS EXISTS: §118's producer had no walk-run path at all, so a runner below §116's floor was handed
 * CONTINUOUS RUNNING by the one plan kind built for people who cannot yet run — against the floor note's own
 * text. Measured on a 3,264-row production-shape grid: **2,304 of 2,394 blocks prescribed a walk-run start did
 * not get one, and every single one came from `generateGetRunningPlan`** (0 from §116's marathon on-ramp).
 *
 * ⚠️ IT IS AN EXTRACTION, NOT A NEW SHAPE. `generateWalkRunStagedPlan` has composed exactly this since
 * 2026-10-25 and §118 was about to be the second copy — the `DELOAD-OWNER-01` / `SESSION-KM-01` class, where
 * two writings of one rule agree only by accident. The callers keep what differs (how many ramp weeks they
 * get, and their own meta); this owns what does not.
 *
 * ⚠️ `rampStart` IS A PARAMETER, NOT COMPUTED HERE. `addWeeksIso` lives in `stagedRacePlan.ts`, which imports
 * this module — computing the date here would be an import cycle.
 *
 * The three things it holds, each ratified and none of them obvious:
 *  - the ramp is seeded at `BASE_BUILD_ONRAMP_MIN_START_KM`, never at the runner's declared volume: seven weeks
 *    of walk-run is what brings them TO the floor, so the ramp starts where they now are.
 *  - every ramp session goes through `applyRunWalk` (L5, Willy, binding): the continuous bout must not
 *    near-triple in the week the walk-run start ends.
 *  - rampWeeks 0 is legal and is L4 — the walk-run start is never shortened, the ramp is cut first. The base
 *    plan is still built (its meta and HR zones are needed) and none of its weeks are kept.
 */
export function composeWalkRunStart(
  input: GeneratorInput,
  args: {
    planStart: string
    rampStart: string
    rampWeeks: number
    remainingWeeks: number
    schedule?: { level: number; deload: boolean }[]
  },
): { weeks: Week[]; base: Plan; startKm: number; endsAtKm: number } {
  const schedule = args.schedule ?? walkRunSchedule()
  const wrWeeks = schedule.length
  const startKm = GENERATION_CONFIG.BASE_BUILD_ONRAMP_MIN_START_KM
  const rampWeeks = Math.max(0, args.rampWeeks)
  // ⚠️ `max(1, …)` ONLY INSIDE THE BASE PLAN. At rampWeeks 0 the plan is the walk-run start alone, but the
  // generator still has to run: it is where the meta and the HR zones come from. Its weeks are discarded.
  const curve = onRampCurve(startKm, Math.max(1, rampWeeks))
  const endsAtKm = rampWeeks > 0 ? curve[curve.length - 1] : startKm
  const base = generateBaseBuildPlan(input, args.rampStart, {
    outcome: 'offered',
    rampWeeks: Math.max(1, rampWeeks),
    remainingWeeks: args.remainingWeeks,
    targetKm: endsAtKm,
    startKm,
  })
  const ramp: Week[] = rampWeeks === 0 ? [] : base.weeks.map((w, i) => ({
    ...w,
    n: wrWeeks + i + 1,
    sessions: Object.fromEntries(Object.entries(w.sessions ?? {})
      .map(([d, s]) => [d, s ? applyRunWalk(s as Session) : s])),
  })) as Week[]
  const hr = (Object.values(base.weeks[0]?.sessions ?? {})[0] as Session | undefined)?.hr_target ?? null
  const weeks = [
    ...generateWalkRunWeeks(input, args.planStart, typeof hr === 'string' ? hr : null, schedule),
    ...ramp,
  ]
  return { weeks, base, startKm, endsAtKm }
}

/** E3 — the resumed walk-run weeks: `WALK_RUN_RESUME_WEEKS` held at the ladder's last level (§117's 6/1), no deload. */
export function walkRunResumeSchedule(): { level: number; deload: boolean }[] {
  const last = walkRunLadder().length - 1
  return Array.from({ length: GENERATION_CONFIG.WALK_RUN_RESUME_WEEKS }, () => ({ level: last, deload: false }))
}
