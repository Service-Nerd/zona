import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { generateRulePlan } from './ruleEngine'
import { isLongRun } from './sessionRole'
import { slowGoalDates } from './slowGoalGrid'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

/**
 * STEPBACK-TRIGGER-STRUCTURAL-01 (Coaching Board 2026-11-16, part 1) — §47's plan-level gate reads
 * the producer's `lr_segment_pace` stamp, never the session LABEL.
 *
 * 🔴 **WHY, AND IT IS A LOAD RULE.** `anyPeakIsRacePace` grepped `label.includes('pace')`, so any
 * change to a long run's label switched §47's step-back off in silence. Found by withholding goal
 * pace (`GOALPACE-UNBENCHMARKED-MARATHON-01`), which changes the label on **10,704 peak long runs**,
 * **2,304 of them belonging to unbenchmarked beginners** — the exact cohort §47 Amendment 1 was built
 * for (Willy, 2026-09-13: *"a beginner never received a peak long-run step-back week"*).
 *
 * 📐 **ZERO-DELTA, measured before shipping:** across all **39,744** generated cohort-grid plans the
 * stamp and the label decide this gate identically (0 disagreements either way), and across all
 * **92,384** peak long runs the two agree session by session.
 *
 * 🔻 **NOT CLOSED BY THIS:** the stamp also goes null under a withholding, so §120 Am. 4 stays
 * blocked on `STEPBACK-SPECIFICITY-SCOPE-01` — whether §47 should require specificity at all.
 */

const { planStart, benchmarkDate } = slowGoalDates()
const raceIn = (weeks: number) => {
  const d = new Date(planStart)
  d.setDate(d.getDate() + weeks * 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// A benchmarked time-target marathoner: the ordinary case that gets a race-paced peak long run,
// so §47's gate opens. ⚠️ The benchmark DATE is derived from today, never pinned — a literal ages
// into §10's staleness ramp and reprices the plan (`GOALPACE-5K-CLOCK-01`).
const MARATHON = {
  race_date: raceIn(18), race_distance_km: 42.2, goal: 'time_target', target_time: '4:00:00',
  benchmark: { type: 'race', distance_km: 10, time: '0:52:00', benchmark_date: benchmarkDate },
  age: 40, resting_hr: 55, max_hr: 180, days_available: 5,
  current_weekly_km: 45, longest_recent_run_km: 20,
  preferred_long_run_day: 'sun', recent_quality_training: 'occasional',
} as unknown as GeneratorInput

const build = (i: GeneratorInput): Plan => generateRulePlan(i, 'trial', planStart, undefined, planStart)
const peakLongRuns = (p: Plan): Session[] =>
  p.weeks.filter(w => w.phase === 'peak' && w.type !== 'deload')
    .flatMap(w => Object.values(w.sessions ?? {}).flat() as (Session | undefined)[])
    .filter((s): s is Session => !!s && isLongRun(s as never))

describe('§47\'s gate is structural', () => {
  const plan = build(MARATHON)

  it('the fixture actually opens the gate — a race-paced peak long run exists', () => {
    // 🔑 THE POPULATION ARM. Without it every assertion below passes on a plan §47 never touches,
    // which is how a gate ends up proving nothing (`AN EMPTY POPULATION MUST NOT RENDER`).
    const lrs = peakLongRuns(plan)
    expect(lrs.length, 'no peak long runs: the fixture is not testing §47').toBeGreaterThan(1)
    expect(lrs.some(s => s.lr_segment_pace != null), 'no race-paced peak long run: the gate is shut').toBe(true)
  })

  it('§47 alternates — no two consecutive peak weeks both carry a peak-level long run', () => {
    const peaks = plan.weeks.filter(w => w.phase === 'peak' && w.type !== 'deload')
    expect(peaks.length).toBeGreaterThan(1)
    expect(peaks.some(w => w.peak_stepback === true), 'no step-back week was produced').toBe(true)
  })

  it('🔴 the gate reads the STAMP, not the label (ADR-018 / D-17)', () => {
    // A source arm, and it is the one that catches a revert: the behavioural arms above stay green
    // if the gate goes back to the label, because label and stamp agree on every plan today. That
    // agreement is exactly why only a source assertion can see the difference.
    const src = readFileSync('lib/plan/ruleEngine.ts', 'utf8')
    const i = src.indexOf('const anyPeakIsRacePace')
    expect(i, 'the gate was renamed or removed').toBeGreaterThan(-1)
    const gate = src.slice(i, src.indexOf('if (!anyPeakIsRacePace)', i))
    expect(gate, 'the gate reads lr_segment_pace').toContain('lr_segment_pace')
    expect(gate, 'the gate is back on the session label').not.toMatch(/label/)
  })

  it('🔴 and no OTHER copy of the label predicate survives in the engine', () => {
    // `labelHasRacePace` was local to this gate and is now gone. A second copy left behind is how
    // the `deloadCadence` family starts, and this one decides a load.
    const src = readFileSync('lib/plan/ruleEngine.ts', 'utf8')
    expect(src, 'the label predicate is still declared somewhere').not.toContain('labelHasRacePace')
  })
})
