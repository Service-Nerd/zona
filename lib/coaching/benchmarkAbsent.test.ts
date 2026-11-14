import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup as html } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { benchmarkAbsentWeeks, nextRecalibrationDue } from './recalibrationPrompt'
import { BenchmarkAbsentTile } from '../../app/dashboard/RecalibrationTile'
import type { Plan } from '../../types/plan'

// TT-SKIPPED-VISIBILITY-01 — Design Board 2026-11-14, SHIP WITH AMENDMENT.
//
// 📐 6 of the 14 live plans that declare recalibration weeks hold no benchmark session, so the
// runner finishes the block on the paces they started with and nothing says why.
//
// ⚠️ THE SCOPE IS THE RULING, AND BOTH EDGES MATTER. A plan that declares nothing (29 of 43
// live plans) must say nothing — a sentence about a benchmark it was never going to have. And a
// PARTIAL absence says nothing either: the runner still gets a benchmark, so they have not lost
// the thing the sentence is about.
const week = (n: number, hard: boolean): Plan['weeks'][number] => ({
  n, date: '2026-01-05', theme: 't', label: `W${n}`,
  sessions: hard
    ? { tue: { type: 'hard', label: '5K time trial' } as never, sun: { type: 'easy' } as never }
    : { tue: { type: 'quality' } as never, sun: { type: 'easy' } as never },
}) as never

const planWith = (declared: number[] | undefined, weeksWithHard: number[]): Plan => ({
  meta: { recalibration_weeks: declared } as never,
  weeks: [1, 2, 3, 4, 5, 6].map(n => week(n, weeksWithHard.includes(n))),
} as never)

describe('benchmarkAbsentWeeks — the scope the board set', () => {
  it('names every declared week when the plan holds no benchmark at all', () => {
    expect(benchmarkAbsentWeeks(planWith([3, 6], []))).toEqual([3, 6])
  })

  it('says NOTHING when the plan declares no recalibration weeks', () => {
    // 29 of 43 live plans. A sentence here would be about a benchmark they were never promised.
    expect(benchmarkAbsentWeeks(planWith(undefined, []))).toEqual([])
    expect(benchmarkAbsentWeeks(planWith([], []))).toEqual([])
  })

  it('says NOTHING on a PARTIAL absence — the runner still gets a benchmark', () => {
    expect(benchmarkAbsentWeeks(planWith([3, 6], [3]))).toEqual([])
    expect(benchmarkAbsentWeeks(planWith([3, 6], [6]))).toEqual([])
  })

  it('says nothing when every declared week holds its benchmark', () => {
    expect(benchmarkAbsentWeeks(planWith([3, 6], [3, 6]))).toEqual([])
  })

  it('counts a declared week that is not in the plan as absent — there is no session either way', () => {
    expect(benchmarkAbsentWeeks(planWith([9], []))).toEqual([9])
  })

  it('returns the weeks sorted, because the caller speaks from the EARLIEST one', () => {
    expect(benchmarkAbsentWeeks(planWith([6, 3], []))).toEqual([3, 6])
  })

  it('🔴 and the existing trigger is silent on exactly these plans, which is why it exists', () => {
    // `nextRecalibrationDue` does `if (!ttEntry) continue`: correct for its own question
    // ("is a completed time trial waiting to be applied?") and silent for this one.
    const p = planWith([3, 6], [])
    expect(nextRecalibrationDue(p, [{ week_n: 3, session_day: 'tue' }], [])).toBeNull()
    expect(benchmarkAbsentWeeks(p)).toEqual([3, 6])
  })
})

describe('BenchmarkAbsentTile — one sentence, nothing to tap', () => {
  const out = () => html(React.createElement(BenchmarkAbsentTile, { weekN: 3 }))

  it('states the COST, not that a scheduler failed (Sierra)', () => {
    expect(out()).toContain('Your paces stay as they started.')
    expect(out()).not.toMatch(/schedul|could not|unable|error|failed/i)
  })

  it('offers NO affordance — the action cannot succeed without a due benchmark', () => {
    // BASEBUILD-ADJUST-DOOR-01: an affordance is withheld when the ACTION cannot succeed.
    // Entering a time-trial result needs a due session, and there is none.
    const o = out()
    expect(o).not.toContain('<button')
    expect(o).not.toContain('href')
  })

  it('names the week, so it reads as the tile that did not arrive', () => {
    expect(out()).toContain('Week 3')
  })

  it('carries no hardcoded colour and no second sentence of chrome', () => {
    const file = readFileSync(join(process.cwd(), 'app/dashboard/RecalibrationTile.tsx'), 'utf8')
    const tile = file.slice(file.indexOf('export function BenchmarkAbsentTile'), file.indexOf('interface RecalibrationEntryScreenProps'))
    expect(tile).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
    // No <h2>: a heading plus a sentence would say the same thing twice.
    expect(tile).not.toContain('<h2')
  })
})

describe('it renders in the EXISTING slot, never a second surface', () => {
  it('shares `recalTile` with the ready state and is not passed anywhere else', () => {
    const dash = readFileSync(join(process.cwd(), 'app/dashboard/DashboardClient.tsx'), 'utf8')
    // 🎪 Collins: "say it once, in the one place." One render site, inside the recalTile ternary.
    expect((dash.match(/<BenchmarkAbsentTile /g) ?? []).length).toBe(1)
    const slot = dash.slice(dash.indexOf('recalTile={'), dash.indexOf('dailyCoachNote={', dash.indexOf('recalTile={')))
    expect(slot).toContain('<BenchmarkAbsentTile ')
  })

  it('speaks from the earliest declared week onward, never from week 1', () => {
    const dash = readFileSync(join(process.cwd(), 'app/dashboard/DashboardClient.tsx'), 'utf8')
    expect(dash).toMatch(/if \(currentWeekN == null \|\| currentWeekN < earliest\) return null/)
  })
})
