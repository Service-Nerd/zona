import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import type { GeneratorInput, Session } from '@/types/plan'

/**
 * LABEL-VARIETY-01 — the §22 goal-pace override used to rename every second-half
 * peak quality session to one string ("{dist}-pace intervals"). A peak block
 * that drew a ladder, a continuous tempo and a progressive tempo showed the
 * runner that one name up to eight times (McMillan: monotony), and the identical
 * label tripped §53's label cap.
 *
 * The fix takes the trailing word from the ROW's own structure in peak
 * ("…-pace ladder", "…-pace sustained", "…-pace reps") while keeping "{dist}-pace"
 * as the stable lead every §22/§19 check keys on. Build and taper keep their
 * single phase word, so no label merges across phases (which would surface the
 * row repetition §53 counts by label — CAT-ULTRA-THIN-01, still open).
 *
 * These bugs are silent — a plan generates and looks fine — so the guard is a
 * generated plan asserted against, not a symptom to notice next time.
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

// A marathon time-target on five days: enough peak quality to have drawn several
// distinct threshold rows, which is where the eight-identical monotony lived.
const INPUT: GeneratorInput = {
  race_date: '2026-12-28', race_distance_km: 42.2, goal: 'time_target', target_time: '3:30:00',
  days_available: 5, age: 40, current_weekly_km: 55, longest_recent_run_km: 28,
  resting_hr: 50, max_hr: 188, preferred_long_run_day: 'sun',
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

// The goal-pace override labels — the ones this fix diversifies. They all carry
// the "-pace " goal-pace signal (§22) and the race distance.
const isGoalPaceLabel = (label: string) => label.includes('-pace ')

function peakQuality(plan: ReturnType<typeof generateRulePlan>): Session[] {
  return plan.weeks
    .filter(w => w.phase === 'peak' && w.type !== 'race')
    .flatMap(w => Object.values(w.sessions))
    .filter((s): s is Session => !!s && s.type === 'quality')
}

describe('LABEL-VARIETY-01 — peak goal-pace labels are distinguished by row shape', () => {
  it('the plan generates and validates (no §53/§19/§22 error)', () => {
    // generateRulePlan runs validatePlan under NODE_ENV=test and throws on any
    // error-severity violation, so a clean return IS the assertion.
    expect(() => generateRulePlan(INPUT, 'paid', PLAN_START)).not.toThrow()
  })

  it('a peak block does not collapse every goal-pace session to one name', () => {
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const overrideLabels = peakQuality(plan)
      .map(s => s.label ?? '')
      .filter(isGoalPaceLabel)

    // The regression: eight identical "MARATHON-pace intervals". Guard that the
    // peak override labels are not all the same string once there are several.
    expect(overrideLabels.length).toBeGreaterThanOrEqual(3)
    const distinct = new Set(overrideLabels)
    expect(distinct.size).toBeGreaterThan(1)
  })

  it('the shape word comes from the row — a ladder reads as a ladder', () => {
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const labels = peakQuality(plan).map(s => s.label ?? '')
    // threshold_ladder is peak-eligible for the marathon and is the v2 row whose
    // block label ("ladder") the override now surfaces.
    expect(labels.some(l => l.endsWith('-pace ladder'))).toBe(true)
    // And a shape word must never be one §19 reads as a threshold claim — that
    // demands T-pace and would fail on a goal-pace session.
    for (const l of labels.filter(isGoalPaceLabel)) {
      expect(l.toLowerCase()).not.toContain('tempo')
      expect(l.toLowerCase()).not.toContain('cruise')
    }
  })

  it('build and taper keep a single phase word — no cross-phase label merge', () => {
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const wordsIn = (phase: string) =>
      new Set(plan.weeks
        .filter(w => w.phase === phase && w.type !== 'race')
        .flatMap(w => Object.values(w.sessions))
        .filter((s): s is Session => !!s && s.type === 'quality')
        .map(s => s.label ?? '')
        .filter(l => isGoalPaceLabel(l) && !l.startsWith('Goal-pace'))
        .map(l => l.replace(/^.*-pace /, '')))

    // Build overrides all read "…-pace progression"; taper all "…-pace sharpener".
    // Anything else would mean a shape word leaked outside peak and could collide
    // with the other phase's word (the §53 cross-phase merge this fix avoids).
    for (const w of Array.from(wordsIn('build'))) expect(w).toBe('progression')
    for (const w of Array.from(wordsIn('taper'))) expect(w).toBe('sharpener')
  })
})
