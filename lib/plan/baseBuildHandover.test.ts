import { describe, it, expect } from 'vitest'
import {
  handoverState, handoverInput, handoverRaceName, handoverSeenPatch, weeksBetween, SEEN_FLAG,
} from './baseBuildHandover'
import { generateRulePlan } from './ruleEngine'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * `BASEBUILD-HANDOVER-01` — the block ends and something has to say so.
 *
 * ⚠️ THE ITEM WAS FILED ON A PREMISE THAT INVERTS, so the first arm pins the
 * correction: `base_build_onramp` is NOT the trigger. It is `undefined` on both live
 * plans because `generateGetRunningPlan` deletes it on purpose, and reading it would
 * resurrect the false premise.
 */

const START = '2026-10-05'
const input = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  athlete_name: 'X', age: 35, race_name: 'Base building', primary_metric: 'distance',
  race_distance_km: 42.2, race_date: '2027-04-24', goal: 'time_target',
  resting_hr: 52, max_hr: 180, current_weekly_km: 10, longest_recent_run_km: 8,
  user_declared_level: 'beginner', recent_quality_training: 'occasional',
  hard_session_relationship: 'neutral', training_age: '6-18mo', days_available: 4,
  days_cannot_train: [], injury_history: [], max_weekday_mins: 45, terrain: 'mixed',
  ...o,
} as unknown as GeneratorInput)

/** A base-build plan shaped like the live ones: 15 weeks from START, no onramp marker. */
const basePlan = (o: Record<string, unknown> = {}, weeks = 15): Plan => ({
  meta: {
    plan_kind: 'base_build', race_name: 'Base building', race_date: '',
    plan_start: START, base_build_target_km: 37.9, base_build_start_km: 10,
    generator_input: input(), ...o,
  },
  weeks: Array.from({ length: weeks }, (_, i) => ({
    n: i + 1, phase: 'base_build',
    date: new Date(Date.parse(START) + i * 7 * 864e5).toISOString().slice(0, 10),
    weekly_km: 10 + i, sessions: {},
  })),
} as unknown as Plan)

/** The day after the 15th week closes. */
const AFTER = new Date('2027-01-26T09:00:00Z')
const DURING = new Date('2026-11-20T09:00:00Z')

describe('BASEBUILD-HANDOVER-01 — when the card appears', () => {
  it('fires when the block is OVER, and the trigger is the KIND plus the calendar', () => {
    const st = handoverState(basePlan(), AFTER)
    expect(st.show).toBe(true)
  })

  it('🔴 does NOT read `base_build_onramp` — the marker the item wrongly claimed', () => {
    // `generateGetRunningPlan` deletes it so "a downstream reader cannot infer a
    // marathon handover that does not exist". Both live plans have it undefined.
    // The card must fire WITHOUT it, or the fix would reach nobody.
    expect(handoverState(basePlan({ base_build_onramp: undefined }), AFTER).show).toBe(true)
    // And its presence must not be required OR forbidden.
    expect(handoverState(basePlan({ base_build_onramp: true }), AFTER).show).toBe(true)
  })

  it('stays silent while the block is still running', () => {
    const st = handoverState(basePlan(), DURING)
    expect(st.show).toBe(false)
    expect(st.show === false && st.reason).toBe('block_running')
  })

  it('stays silent once seen, so it is a one-time announcement', () => {
    const st = handoverState(basePlan({ [SEEN_FLAG]: true }), AFTER)
    expect(st.show === false && st.reason).toBe('already_seen')
  })

  it('stays silent on a RACE plan and on a maintenance plan', () => {
    for (const kind of ['race', 'maintenance', undefined]) {
      const st = handoverState(basePlan({ plan_kind: kind }), AFTER)
      expect(st.show === false && st.reason, `kind=${kind}`).toBe('not_base_build')
    }
  })

  it('🔴 stays silent with NO stored input, rather than inventing the race', () => {
    // Before BASEBUILD-GENINPUT-REMEDIATION-01 there was nothing to regenerate from.
    // A handover without it would have to invent a race date, which is exactly what
    // that item refused to do.
    expect(handoverState(basePlan({ generator_input: undefined }), AFTER).show).toBe(false)
    const noDate = handoverState(basePlan({ generator_input: input({ race_date: '' }) }), AFTER)
    expect(noDate.show === false && noDate.reason).toBe('no_input')
  })

  it('never fires on an empty-week plan', () => {
    expect(handoverState(basePlan({}, 0), AFTER).show).toBe(false)
  })
})

describe('BASEBUILD-HANDOVER-01 — the race name the runner lost', () => {
  it('🔴 refuses to carry "Base building" into a RACE plan', () => {
    // Measured on both live plans: `generator_input.race_name === "Base building"`,
    // because the writer overwrote meta before the backfill read it, and the refusal
    // telemetry records no race_name. A race plan called "Base building" would be the
    // app contradicting itself at the moment it hands over.
    expect(handoverRaceName(input({ race_name: 'Base building' }))).toBe('Marathon')
    expect(handoverRaceName(input({ race_name: undefined }))).toBe('Marathon')
    expect(handoverRaceName(input({ race_name: '' }))).toBe('Marathon')
  })

  it('keeps a REAL stated name, because most runners will have one', () => {
    expect(handoverRaceName(input({ race_name: 'London Marathon' }))).toBe('London Marathon')
  })

  it('names it by distance through the single owner, not a local table', () => {
    expect(handoverRaceName(input({ race_distance_km: 21.1 }))).toBe('Half marathon')
    expect(handoverRaceName(input({ race_distance_km: 10 }))).toBe('10K')
    expect(handoverRaceName(input({ race_distance_km: 50 }))).toBe('50K ultra')
  })
})

describe('BASEBUILD-HANDOVER-01 — the input the race plan is built from', () => {
  it('🔴 carries the volume the BLOCK DELIVERED, not what the runner typed 15 weeks ago', () => {
    // Tom typed 10 and finishes at 37.9. Regenerating from 10 would refuse him under
    // §111 for a base he no longer has: the engine ignoring work it prescribed.
    const out = handoverInput(basePlan(), input())
    expect(input().current_weekly_km).toBe(10)
    expect(out.current_weekly_km).toBe(37.9)
  })

  it('leaves the stated volume alone when the block recorded no target', () => {
    const out = handoverInput(basePlan({ base_build_target_km: 0 }), input())
    expect(out.current_weekly_km).toBe(10)
  })

  it('⚠️ does NOT freshen longest_recent_run_km — compliance is not knowable here', () => {
    // The block's longest SESSION is knowable; whether the runner RAN it is not.
    // Assuming it would hand a §113 pass to someone who skipped the long runs.
    expect(handoverInput(basePlan(), input()).longest_recent_run_km).toBe(8)
  })

  it('🔴 THE COMPOSED PATH: the handover input actually GENERATES a race plan', () => {
    // The question no unit test on either side asks: what does the system DO with it?
    const out = handoverInput(basePlan(), input())
    const today = '2027-01-26'
    const plan = generateRulePlan(
      { ...out, acknowledged_prep_warning: true } as GeneratorInput, 'trial', today, undefined, today)
    expect(plan.weeks.length).toBeGreaterThan(0)
    // And it is named for the race, never for the block it replaced.
    expect((plan.meta as unknown as Record<string, unknown>).race_name).not.toBe('Base building')
  })
})

describe('BASEBUILD-HANDOVER-01 — the seen-flag cannot archive the plan', () => {
  it('🔴 writes ONLY the flag, touching neither race_name nor race_date', () => {
    // The SLT named this risk: `savePlanForUser` archives on a RACE-IDENTITY change
    // (`race_name|race_date`). A variant that touched either would ARCHIVE THE
    // RUNNER'S BLOCK WHILE ANNOUNCING IT.
    const patch = handoverSeenPatch()
    expect(Object.keys(patch)).toEqual([SEEN_FLAG])
    expect(patch).not.toHaveProperty('race_name')
    expect(patch).not.toHaveProperty('race_date')
  })
})

describe('BASEBUILD-HANDOVER-01 — weeksBetween', () => {
  it('counts whole weeks and tolerates a junk date', () => {
    expect(weeksBetween(new Date('2027-01-26T00:00:00Z'), '2027-04-24')).toBe(12)
    expect(weeksBetween(new Date('2027-01-18T00:00:00Z'), '2027-04-24')).toBe(13)
    expect(weeksBetween(new Date('2027-01-26T00:00:00Z'), 'not-a-date')).toBeNull()
  })
})
