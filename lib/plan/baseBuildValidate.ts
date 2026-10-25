import { isHardEffort } from './sessionRole'
import type { Week, Session } from '@/types/plan'
import { GENERATION_CONFIG } from './generationConfig'
import { sessionKmSelfPaced } from './sessionDistance'
import type { Violation } from './invariants'
import type { Plan, GeneratorInput } from '@/types/plan'
import { stagedRaceOf } from './stagedRacePlan'
import { prepBlockWeeks } from './inputs'

/**
 * §116 — the base-build on-ramp's own validator.
 *
 * ⚠️ A SEPARATE VALIDATOR, NOT AN EXEMPTION, and the precedent is
 * `validateMaintenanceBlock`. A base-build plan has no race week, no taper, no
 * quality and no peak, so running it through `validatePlan` would fire a long
 * tail of rules describing a race block it is not. `invariants.ts:820-825`
 * records that the foundation block has broken server-side invariants THREE
 * times by sharing a surface it did not fit; this is the fourth block class and
 * it deliberately does not repeat that.
 *
 * Four checks, one per binding board amendment that is mechanically checkable.
 */
export function validateBaseBuildBlock(weeks: Week[], startKm: number): Violation[] {
  const v: Violation[] = []
  const ramp = weeks.filter(w => w.phase === 'base_build')
  if (ramp.length === 0) return v

  const isDeload = (w: Week) => w.type === 'deload' || w.badge === 'deload'
  const runsOf = (w: Week) =>
    (Object.values(w.sessions ?? {}) as (Session | undefined)[])
      .filter((s): s is Session => !!s && s.type !== 'rest' && s.type !== 'cross-train')

  // ── Amendment 6 (Seiler) — all easy, no quality ────────────────────────────
    for (const w of ramp) {
    for (const s of runsOf(w)) {
      if (isHardEffort(s) || s.type === 'race') {
        v.push({
          code: 'INV-PLAN-ONRAMP-ALL-EASY',
          principle_ref: 'CoachingPrinciples §116',
          severity: 'error',
          week: w.n,
          message: `Base-build week W${w.n} prescribes a ${s.type} session. The on-ramp is all easy (§116 amendment 6, Seiler) — this runner is building tissue tolerance, not fitness they can already express.`,
          actual: s.type,
          expected: 'easy / recovery / rest only',
        })
      }
    }
  }

  // ── Amendment 1 (Willy) — the curve climbs ─────────────────────────────────
  //
  // ⚠️ §57's invariant checks a CEILING and a flat block never breaches a
  // ceiling, which is exactly how §111's named remedy stayed impossible for a
  // year. The failure mode of a ramp is the inverse, so this is the inverse bound.
  const build = ramp.filter(w => !isDeload(w))
  for (let i = 1; i < build.length; i++) {
    const prev = build[i - 1], curr = build[i]
    if ((curr.weekly_km ?? 0) <= (prev.weekly_km ?? 0)) {
      v.push({
        code: 'INV-PLAN-ONRAMP-CURVE-CLIMBS',
        principle_ref: 'CoachingPrinciples §116',
        severity: 'error',
        week: curr.n,
        message: `Base-build W${curr.n} (${curr.weekly_km}km) does not build on W${prev.n} (${prev.weekly_km}km). A ramp that does not climb is §57's flat block wearing §116's label.`,
        actual: `${curr.weekly_km}km`,
        expected: `> ${prev.weekly_km}km`,
      })
    }
  }

  // ── Amendment 7 — the handover must not be a dip ───────────────────────────
  const last = ramp[ramp.length - 1]
  if (isDeload(last)) {
    v.push({
      code: 'INV-PLAN-ONRAMP-CURVE-CLIMBS',
      principle_ref: 'CoachingPrinciples §116',
      severity: 'error',
      week: last.n,
      message: `Base-build ends on a DELOAD week (W${last.n}). §111 re-gates on the volume the runner hands over at, so the last week must sit on the build line.`,
      actual: 'deload',
      expected: 'a build week',
    })
  }

  // ── Amendment 2 (Willy) — THE PER-RUN STEP IS THE LOAD EVENT ───────────────
  //
  // His words at the sitting: *"at 8 km/wk over 4 days that is 2 km a run, at
  // 18 it is 4.5; the per-run doubling is the load event"* — not the weekly
  // total. A week can climb 10% and still double a single run if the run count
  // falls, and the weekly cap cannot see that.
  //
  // ⚠️ THIS WAS A BOARD AMENDMENT WITH NO IMPLEMENTATION until the first ramp
  // plan was generated end to end and someone looked at the weeks. Ratified,
  // documented, and unchecked is the decorative-config failure wearing a
  // board ruling.
  //
  // Measured against the LONGEST run in each week, because that is the session
  // whose per-run step actually binds. Deload weeks are exempt on the same
  // basis every other ramp check exempts them.
  const cap = GENERATION_CONFIG.WEEK1_PER_RUN_STEP_MAX_KM
  const longestOf = (w: Week) =>
    Math.max(0, ...runsOf(w).map(s => sessionKmSelfPaced(s) ?? 0))
  let prevLongest: number | null = null
  for (let i = 0; i < ramp.length; i++) {
    const w = ramp[i]
    const longest = longestOf(w)
    if (i > 0 && !isDeload(w) && !isDeload(ramp[i - 1]) && prevLongest != null && prevLongest > 0) {
      const step = longest - prevLongest
      if (step > cap + 0.05) {
        v.push({
          code: 'INV-PLAN-ONRAMP-PER-RUN-STEP',
          principle_ref: 'CoachingPrinciples §116',
          severity: 'error',
          week: w.n,
          message: `Base-build W${w.n}'s longest run steps ${prevLongest.toFixed(1)}km → ${longest.toFixed(1)}km (+${step.toFixed(1)}km). §116 amendment 2 (Willy): the per-run step is the load event, not the weekly total.`,
          actual: `+${step.toFixed(1)}km`,
          expected: `≤ +${cap}km`,
        })
      }
    }
    prevLongest = longest
  }

  // ── §118 amendment 2 — THE TOTAL BUILD IS BOUNDED ────────────────────────
  //
  // 🔴 §2 CHECKS WEEK-ON-WEEK AND CANNOT SEE THE ENDPOINT. Sixteen weeks of a
  // lawful 10% under §3's deloads compounds to a **4.17x total build**, above
  // §111's `MAX_BASE_BUILD_RATIO` of 4.0 — every week legal, the sum not.
  //
  // ⚠️ THE RATIO IS A PROPERTY OF THE CURVE, NOT THE RUNNER: 2→8.3, 3→12.5,
  // 5→20.8 and 7→29.2 are all ~4.17x. Reported as "a 7 km/week runner ends at
  // 4.2x", it would have sent someone hunting for a per-runner cap.
  //
  // ⚠️ §111's 4.0 is REUSED, not re-chosen. Willy: *"I will not have two
  // total-build ceilings in one constitution differing by 0.17 because one of
  // them was measured off a 16-week curve."*
  //
  // ⚠️ This is the CHECKER, and `GET_RUNNING_MAX_WEEKS = 15` is the producer's
  // side. They are deliberately independent: the week count is one way to stay
  // inside the ratio, and a future change to the ramp rate or deload cadence
  // would breach it at 15 weeks without anyone touching this file.
  if (startKm > 0 && ramp.length > 0) {
    const endKm = ramp[ramp.length - 1].weekly_km ?? 0
    const ratio = endKm / startKm
    const cap = GENERATION_CONFIG.MAX_BASE_BUILD_RATIO
    if (ratio > cap + 0.01) {
      v.push({
        code: 'INV-PLAN-GET-RUNNING-BUILD-RATIO',
        principle_ref: 'CoachingPrinciples §118, §111',
        severity: 'error',
        week: ramp[ramp.length - 1].n,
        message: `Base-build block ends at ${endKm.toFixed(1)}km from a ${startKm.toFixed(1)}km start — a ${ratio.toFixed(2)}x total build, above §111's ${cap}x ceiling. Every week is §2-compliant; the SUM is not, and §2 cannot see the endpoint.`,
        actual: `${ratio.toFixed(2)}x`,
        expected: `<= ${cap}x`,
      })
    }
  }

  return v
}

/**
 * `INV-PLAN-STAGED-NO-RACE-BLOCK` — NO-RUNNER-TURNED-AWAY-01 (§116 Am. 9). The mechanical line from the vetoed
 * `S111-FOUNDATION-CREDIT-01`: a staged race plan carries the race it is for and **no week of it**. Every week is base
 * building, the plan ends at its checkpoint, and the race block it leaves has at least §44's block weeks (Q1).
 *
 * ⚠️ Reads the plan, not the producer's placement function, so a producer that skipped the rule is still caught.
 */
export function validateStagedRace(plan: Plan): Violation[] {
  const staged = stagedRaceOf(plan)
  if (!staged) return []
  const v: Violation[] = []
  const push = (week: number, message: string, actual: string, expected: string) => v.push({
    code: 'INV-PLAN-STAGED-NO-RACE-BLOCK', principle_ref: 'CoachingPrinciples §116 Am. 9', severity: 'error',
    week, message, actual, expected,
  })
  for (const w of plan.weeks ?? []) {
    if (w.phase !== 'base_build' && w.phase !== 'walk_run_start') {
      push(w.n, `Staged plan week W${w.n} is phase "${w.phase}". A staged plan holds base building only; the race block is built after the checkpoint passes on observed volume.`, String(w.phase), 'base_build')
    }
  }
  const len = plan.weeks?.length ?? 0
  if (len !== staged.checkpoint_week) {
    push(staged.checkpoint_week, `Staged plan has ${len} weeks but its checkpoint is week ${staged.checkpoint_week}. The plan must end at the checkpoint.`, `${len} weeks`, `${staged.checkpoint_week} weeks`)
  }
  const input = (plan.meta as unknown as { generator_input?: GeneratorInput }).generator_input
  // L4 (2026-10-25): a walk-run start is never shortened, so a plan that is ONLY the walk-run start may leave less than
  // the block; its checkpoint then offers what builds. Any plan with a running ramp keeps the block.
  const hasRamp = (plan.weeks ?? []).some(w => w.phase === 'base_build')
  if (input && hasRamp && staged.race_weeks < prepBlockWeeks(input)) {
    push(staged.checkpoint_week, `Staged plan leaves ${staged.race_weeks} weeks for the race block, under §44's block of ${prepBlockWeeks(input)}.`, `${staged.race_weeks}`, `>= ${prepBlockWeeks(input)}`)
  }
  return [...v, ...validateWalkRunStart(plan)]
}


/**
 * `INV-PLAN-WALKRUN-START-PROGRESSION` — the walk-run start (§116 floor note; Coaching Board 2026-10-25, L1–L5).
 *
 * The level steps at most one a week up the ladder and never down; §3's deload holds the previous level; every week has
 * `WALK_RUN_START_SESSIONS` sessions (fewer only where the runner has fewer open days) of `WALK_RUN_START_MINS`; it ends
 * on §117's 6/1 before any running week; and every running week after it carries the run-walk pattern (L5).
 *
 * ⚠️ READS THE PLAN, never `walkRunSchedule`: a checker that shares the producer's schedule cannot catch it being wrong.
 * Only the ladder's ENDPOINTS come from config, which is what the board ruled.
 */
export function validateWalkRunStart(plan: Plan): Violation[] {
  const weeks = plan.weeks ?? []
  const wr = weeks.filter(w => w.phase === 'walk_run_start')
  if (wr.length === 0) return []
  const v: Violation[] = []
  const C = GENERATION_CONFIG
  const push = (week: number, message: string, actual: string, expected: string) => v.push({
    code: 'INV-PLAN-WALKRUN-START-PROGRESSION', principle_ref: 'CoachingPrinciples §116 (floor note), §118 Am. 4',
    severity: 'error', week, message, actual, expected,
  })
  const isDeload = (w: Week) => w.type === 'deload' || w.badge === 'deload'
  const runs = (w: Week) => (Object.values(w.sessions ?? {}) as (Session | undefined)[])
    .filter((s): s is Session => !!s && s.type !== 'rest' && s.type !== 'cross-train' && s.type !== 'strength')
  // A level's position: run minutes, then a shorter walk ranks higher (5/2 below 6/1).
  const rank = (l: { run_mins: number; walk_mins: number }) => l.run_mins * 10 - l.walk_mins
  const input = (plan.meta as unknown as { generator_input?: GeneratorInput }).generator_input
  const openDays = 7 - new Set((input?.days_cannot_train ?? []).map(d => String(d).slice(0, 3).toLowerCase())).size
  const wantSessions = Math.min(C.WALK_RUN_START_SESSIONS, openDays)

  const firstRun = weeks.findIndex(w => w.phase === 'base_build')
  const lastWr = weeks.reduce((at, w, i) => (w.phase === 'walk_run_start' ? i : at), -1)
  if (firstRun >= 0 && firstRun < lastWr) push(weeks[firstRun].n, `A running week (W${weeks[firstRun].n}) comes before the walk-run start ends.`, `W${weeks[firstRun].n}`, 'after the walk-run start')

  let prev: number | null = null
  let prevRun = 0
  for (const w of wr) {
    const ss = runs(w)
    if (ss.length !== wantSessions) push(w.n, `Walk-run week W${w.n} has ${ss.length} sessions; the walk-run start is ${wantSessions} a week.`, `${ss.length}`, `${wantSessions}`)
    const levels = ss.map(s => s.walk_run_level)
    if (levels.some(l => !l) || ss.some(s => s.duration_mins !== C.WALK_RUN_START_MINS)) {
      push(w.n, `Walk-run week W${w.n} has a session without its level or not ${C.WALK_RUN_START_MINS} minutes.`, 'missing level / duration', `${C.WALK_RUN_START_MINS} min with a level`)
      continue
    }
    const r = Math.max(...levels.map(l => rank(l!)))
    if (Math.min(...levels.map(l => rank(l!))) !== r) push(w.n, `Walk-run week W${w.n} mixes levels.`, 'mixed', 'one level a week')
    if (prev === null) {
      // E3: a RESUMED walk-run start begins (and holds) at §117's 6/1, never at 1/2.
      const resumed = (plan.meta as unknown as Record<string, unknown>).walk_run_resumed === true
      const first = resumed
        ? { run_mins: C.FINISH_GOAL_RUNWALK_RUN_MINS, walk_mins: C.FINISH_GOAL_RUNWALK_WALK_MINS }
        : { run_mins: C.WALK_RUN_START_RUN_MINS, walk_mins: C.WALK_RUN_START_WALK_MINS }
      if (r !== rank(first)) push(w.n, `The walk-run start begins at ${levels[0]!.run_mins}/${levels[0]!.walk_mins}, not ${first.run_mins}/${first.walk_mins} (${resumed ? 'E3, resumed' : 'L2'}).`, `${levels[0]!.run_mins}/${levels[0]!.walk_mins}`, `${first.run_mins}/${first.walk_mins}`)
    } else if (isDeload(w)) {
      if (r !== prev) push(w.n, `Deload week W${w.n} does not hold the previous level (§3, Q3).`, 'changed', 'held')
    } else if (r < prev) {
      push(w.n, `Walk-run week W${w.n} steps DOWN the ladder.`, 'down', 'up one level or held')
    } else if (r > prev) {
      // Up exactly one level: one more run minute at the same walk, or the last step onto §117's 6/1.
      const l = levels[0]!
      const last = l.run_mins === C.FINISH_GOAL_RUNWALK_RUN_MINS && l.walk_mins === C.FINISH_GOAL_RUNWALK_WALK_MINS
      if (l.run_mins - prevRun !== 1 || (!last && l.walk_mins !== C.WALK_RUN_START_WALK_MINS)) {
        push(w.n, `Walk-run week W${w.n} steps more than one level (to ${l.run_mins}/${l.walk_mins}).`, `${l.run_mins}/${l.walk_mins}`, 'one level up')
      }
    }
    prev = r
    prevRun = levels[0]!.run_mins
  }
  const end = { run_mins: C.FINISH_GOAL_RUNWALK_RUN_MINS, walk_mins: C.FINISH_GOAL_RUNWALK_WALK_MINS }
  if (prev !== null && prev !== rank(end)) push(wr[wr.length - 1].n, `The walk-run start ends below §117's ${end.run_mins}/${end.walk_mins}.`, 'below', `${end.run_mins}/${end.walk_mins}`)
  for (const w of weeks.filter(x => x.phase === 'base_build')) {
    if (runs(w).some(s => !s.run_walk_strategy)) push(w.n, `Running week W${w.n} after a walk-run start drops the run-walk pattern (L5, Willy).`, 'continuous', 'run-walk')
  }
  return v
}
