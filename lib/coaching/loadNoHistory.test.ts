// LOAD-SHAPE-NO-HISTORY-01 — no normal, no verdict (Coaching Board 2026-10-30, clause 2).
//
// `acuteChronicRatio` returned 1 when there were no prior weeks, and the weekly report stored
// it, so the Coach tile told a week-1 runner they were "right on your normal" (2 of 5
// production reports in 56 days). The report and the tile now get NULL; the trim trigger
// keeps its 1, which means "no trim".

import { describe, it, expect } from 'vitest'
import { acuteChronicRatio, acuteChronicRatioOrNull } from './loadCalc'
import { computeWeeklyReportData, type WeeklyReportInput } from './weeklyReport'
import { buildWeeklyReportPrompt } from './prompts/weeklyReport'
import { loadRatioContext } from '@/lib/ui/loadRatioContext'
import type { Plan } from '@/types/plan'

const input = (priorWeeksKm: number[], linkedKm = 20): WeeklyReportInput => ({
  weekN: 1, sessionsCompleted: 3, sessionsPlanned: 3, sessionsPlannedToDate: 3,
  linkedKm, offPlanKm: 0, plannedKm: 20, plannedKmToDate: 20, priorWeeksKm,
  sessionFlagCounts: { ok: 3, watch: 0, flag: 0 } as WeeklyReportInput['sessionFlagCounts'],
  hrInZoneData: [], efTrendPct: null,
})

const plan = { meta: {}, weeks: [{ n: 1, sessions: {} }] } as unknown as Plan

describe('LOAD-SHAPE-NO-HISTORY-01', () => {
  it('no prior weeks, or prior weeks of nothing, is no ratio', () => {
    expect(acuteChronicRatioOrNull(20, [])).toBeNull()
    expect(acuteChronicRatioOrNull(20, [0, 0, 0, 0])).toBeNull()
    expect(acuteChronicRatioOrNull(20, [10, 10])).toBeCloseTo(2, 5)
  })

  it('the trim trigger is unchanged: no history is 1, below the watch band', () => {
    expect(acuteChronicRatio(20, [])).toBe(1)
    expect(acuteChronicRatio(20, [0, 0])).toBe(1)
    expect(acuteChronicRatio(20, [10, 10])).toBeCloseTo(2, 5)
  })

  it('a week-1 report stores no ratio, and the tile says nothing about "normal"', () => {
    const data = computeWeeklyReportData(input([]))
    expect(data.acuteChronicRatio).toBeNull()
    expect(loadRatioContext(data.acuteChronicRatio, { plannedEasy: false, lowWeeksRunning: 0 }).label).not.toMatch(/normal/)
  })

  it('the primary insight chooses exactly as before when there is no history', () => {
    expect(computeWeeklyReportData(input([])).primaryInsight)
      .toBe(computeWeeklyReportData(input([20, 20, 20, 20])).primaryInsight)
  })

  it('a report with history still carries its ratio', () => {
    expect(computeWeeklyReportData(input([10, 10, 10, 10], 13)).acuteChronicRatio).toBeCloseTo(1.3, 5)
  })

  it('the prompt never hands the model a defaulted 1.00x', () => {
    const data = computeWeeklyReportData(input([]))
    const prompt = buildWeeklyReportPrompt(data, plan, 1, undefined, 'Sunday', 3, 20, [], [])
    expect(prompt).not.toMatch(/Load ratio \(vs 4-week avg\): \d/)
    expect(prompt).toMatch(/no recent weeks to compare against yet/)
  })
})
