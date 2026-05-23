import { describe, it, expect } from 'vitest'
import { computeLedger } from './disciplineLedger'
import type { Plan } from '@/types/plan'

// Build a minimal plan with N weeks, each with 4 planned non-rest sessions
// (mon easy / wed quality / fri easy / sat long). Week dates start `startMon`
// and step forward by 7 days.
function buildPlan(weekCount: number, startMon: Date): Plan {
  const weeks = Array.from({ length: weekCount }, (_, i) => {
    const d = new Date(startMon)
    d.setDate(d.getDate() + i * 7)
    return {
      n: i + 1,
      date: d.toISOString().slice(0, 10),
      label: `Week ${i + 1}`,
      theme: 'base',
      type: 'normal' as const,
      sessions: {
        mon: { type: 'easy' as const,    label: 'Easy', detail: null, distance_km: 5 },
        wed: { type: 'quality' as const, label: 'Tempo', detail: null, distance_km: 7 },
        fri: { type: 'easy' as const,    label: 'Easy', detail: null, distance_km: 5 },
        sat: { type: 'long' as const,    label: 'Long', detail: null, distance_km: 12 },
      },
      long_run_hrs: null,
      weekly_km: 29,
    }
  })
  return {
    meta: {
      athlete: 'Test', handle: 't', race_name: 'X', race_date: '2026-12-01',
      race_distance_km: 21.1, charity: '', plan_start: startMon.toISOString().slice(0, 10),
      quit_date: '', resting_hr: 60, max_hr: 180, zone2_ceiling: 145,
      version: '1', last_updated: '', notes: '',
    } as any,
    weeks: weeks as any,
  }
}

// Helper — produce 4 "complete" rows for a given week, no fatigue.
function fullClean(weekN: number) {
  return ['mon','wed','fri','sat'].map(d => ({
    week_n: weekN, session_day: d, status: 'complete' as const, fatigue_tag: null,
  }))
}

describe('computeLedger — free tier', () => {
  it('counts consecutive clean past weeks', () => {
    const plan = buildPlan(5, new Date('2026-04-06'))  // Mondays Apr 6, 13, 20, 27, May 4
    const completions = [...fullClean(1), ...fullClean(2), ...fullClean(3)]
    const r = computeLedger({
      plan, completions, analyses: [], tier: 'free',
      asOfDate: new Date('2026-04-28'),  // mid-week of week 4
    })
    expect(r.weeksWithinLines).toBe(3)
    expect(r.currentWeekStatus).toBe('pending')
    expect(r.advancedThisWeek).toBe(true)  // week 3 is adjacent to current week 4
  })

  it('resets to 0 on a Heavy fatigue tag', () => {
    const plan = buildPlan(4, new Date('2026-04-06'))
    const completions = [
      ...fullClean(1),
      ...fullClean(2),
      // Week 3 had Heavy on Wednesday — breaks the week.
      ...['mon','wed','fri','sat'].map(d => ({
        week_n: 3, session_day: d, status: 'complete' as const,
        fatigue_tag: d === 'wed' ? 'Heavy' : null,
      })),
    ]
    const r = computeLedger({
      plan, completions, analyses: [], tier: 'free',
      asOfDate: new Date('2026-04-28'),  // mid-week of week 4
    })
    // Walking backwards from week 3 → broken → stop at 0.
    expect(r.weeksWithinLines).toBe(0)
    expect(r.advancedThisWeek).toBe(false)
  })

  it('resets on a skipped quality session', () => {
    const plan = buildPlan(3, new Date('2026-04-06'))
    const completions = [
      ...fullClean(1),
      // Week 2 skipped the Wednesday quality session — breaks the week.
      { week_n: 2, session_day: 'mon', status: 'complete' as const, fatigue_tag: null },
      { week_n: 2, session_day: 'wed', status: 'skipped'  as const, fatigue_tag: null },
      { week_n: 2, session_day: 'fri', status: 'complete' as const, fatigue_tag: null },
      { week_n: 2, session_day: 'sat', status: 'complete' as const, fatigue_tag: null },
    ]
    const r = computeLedger({
      plan, completions, analyses: [], tier: 'free',
      asOfDate: new Date('2026-04-21'),
    })
    expect(r.weeksWithinLines).toBe(0)
  })

  it('resets when completion ratio falls below 75%', () => {
    const plan = buildPlan(3, new Date('2026-04-06'))
    // 4 planned → 2 complete = 50% < 75%.
    const completions = [
      { week_n: 1, session_day: 'mon', status: 'complete' as const, fatigue_tag: null },
      { week_n: 1, session_day: 'wed', status: 'complete' as const, fatigue_tag: null },
    ]
    const r = computeLedger({
      plan, completions, analyses: [], tier: 'free',
      asOfDate: new Date('2026-04-14'),
    })
    expect(r.weeksWithinLines).toBe(0)
  })

  it('returns pending for the in-flight week when nothing has broken yet', () => {
    const plan = buildPlan(2, new Date('2026-04-06'))
    const completions = [
      ...fullClean(1),
      // Current week 2 — only 1 completion logged so far, no breaks.
      { week_n: 2, session_day: 'mon', status: 'complete' as const, fatigue_tag: null },
    ]
    const r = computeLedger({
      plan, completions, analyses: [], tier: 'free',
      asOfDate: new Date('2026-04-14'),  // Tue of week 2
    })
    expect(r.weeksWithinLines).toBe(1)
    expect(r.currentWeekStatus).toBe('pending')
  })

  it('returns broken for the in-flight week when a Heavy tag has already landed', () => {
    const plan = buildPlan(2, new Date('2026-04-06'))
    const completions = [
      ...fullClean(1),
      { week_n: 2, session_day: 'mon', status: 'complete' as const, fatigue_tag: 'Heavy' },
    ]
    const r = computeLedger({
      plan, completions, analyses: [], tier: 'free',
      asOfDate: new Date('2026-04-15'),
    })
    expect(r.currentWeekStatus).toBe('broken')
  })
})

describe('computeLedger — paid tier', () => {
  it('breaks the week when median zone discipline is below 75%', () => {
    const plan = buildPlan(2, new Date('2026-04-06'))
    const completions = fullClean(1)
    // Median of [60, 65, 70] = 65 < 75 → break.
    const analyses = [
      { week_n: 1, hr_in_zone_pct: 60 },
      { week_n: 1, hr_in_zone_pct: 65 },
      { week_n: 1, hr_in_zone_pct: 70 },
    ]
    const r = computeLedger({
      plan, completions, analyses, tier: 'paid',
      asOfDate: new Date('2026-04-14'),
    })
    expect(r.weeksWithinLines).toBe(0)
  })

  it('passes the week when median zone discipline meets the threshold', () => {
    const plan = buildPlan(2, new Date('2026-04-06'))
    const completions = fullClean(1)
    const analyses = [
      { week_n: 1, hr_in_zone_pct: 80 },
      { week_n: 1, hr_in_zone_pct: 85 },
      { week_n: 1, hr_in_zone_pct: 90 },
    ]
    const r = computeLedger({
      plan, completions, analyses, tier: 'paid',
      asOfDate: new Date('2026-04-14'),
    })
    expect(r.weeksWithinLines).toBe(1)
  })

  it('does not break a week when no analyses exist (infra failure tolerance)', () => {
    const plan = buildPlan(2, new Date('2026-04-06'))
    const completions = fullClean(1)
    const r = computeLedger({
      plan, completions, analyses: [], tier: 'paid',
      asOfDate: new Date('2026-04-14'),
    })
    expect(r.weeksWithinLines).toBe(1)
  })
})

describe('computeLedger — advancedThisWeek', () => {
  it('is true when the just-completed week pushed the count up', () => {
    const plan = buildPlan(3, new Date('2026-04-06'))
    const completions = [...fullClean(1), ...fullClean(2)]
    const r = computeLedger({
      plan, completions, analyses: [], tier: 'free',
      asOfDate: new Date('2026-04-21'),  // Mon of week 3
    })
    expect(r.weeksWithinLines).toBe(2)
    expect(r.advancedThisWeek).toBe(true)
  })

  it('is false when the most recent past week was not adjacent to current', () => {
    // Plan starts Apr 6; current = May 25 → current week_n doesn't exist
    // in a 3-week plan. mostRecentPast is week 3 (Apr 20), current week_n
    // is null, so advancedThisWeek is false.
    const plan = buildPlan(3, new Date('2026-04-06'))
    const completions = [...fullClean(1), ...fullClean(2), ...fullClean(3)]
    const r = computeLedger({
      plan, completions, analyses: [], tier: 'free',
      asOfDate: new Date('2026-05-25'),
    })
    expect(r.advancedThisWeek).toBe(false)
  })

  it('is false when count is 0', () => {
    const plan = buildPlan(2, new Date('2026-04-06'))
    const r = computeLedger({
      plan, completions: [], analyses: [], tier: 'free',
      asOfDate: new Date('2026-04-14'),
    })
    expect(r.weeksWithinLines).toBe(0)
    expect(r.advancedThisWeek).toBe(false)
  })
})

describe('computeLedger — empty plan', () => {
  it('returns zeroed outcome', () => {
    const r = computeLedger({
      plan: null, completions: [], analyses: [], tier: 'free',
      asOfDate: new Date(),
    })
    expect(r.weeksWithinLines).toBe(0)
    expect(r.currentWeekStatus).toBe('pending')
    expect(r.advancedThisWeek).toBe(false)
  })
})
