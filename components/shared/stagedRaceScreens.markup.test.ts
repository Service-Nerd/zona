// NO-RUNNER-TURNED-AWAY-01, Phase C-1 — the staged race plan on screen (Design Board 2026-10-24 SHIP WITH AMENDMENT;
// founder-approved words 2026-10-24). Every arm here was made to go red before it was trusted green.
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { readFileSync } from 'node:fs'
import PlanArc from './PlanArc'
import StagedRaceBlockCard from './StagedRaceBlockCard'
import { generateStagedRacePlan, stagedDisplay, isCheckpointWeek, stagedRaceOf } from '@/lib/plan/stagedRacePlan'
import { basePhaseLine, raceBlockTitle, raceBlockLine, checkpointPassedLine, CHECKPOINT_THIS_WEEK_LINE } from '@/lib/plan/checkpointCopy'
import { phaseDisplayLabel } from '@/lib/coaching/weekVoice'
import type { GeneratorInput } from '@/types/plan'

const START = '2026-10-26'
const input = {
  race_distance_km: 42.2, race_date: '2027-04-25', race_name: 'London Marathon', days_available: 4,
  goal: 'finish', current_weekly_km: 10, longest_recent_run_km: 6, age: 30, injuries: [],
  training_age: '<6mo', user_declared_level: 'beginner', recent_quality_training: 'none',
} as unknown as GeneratorInput
const plan = generateStagedRacePlan(input, START, 12)!
const staged = stagedRaceOf(plan)!
const view = stagedDisplay(plan)!

const arc = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(React.createElement(PlanArc, {
  totalWeeks: 4, currentWeek: 1, doneWeeks: 0, weekKm: [8, 9, 10, 11], weekPhase: ['base', 'base', 'build', 'build'], ...extra,
} as never))

describe('PlanArc — the unbuilt race block is an outline, never bars', () => {
  it('absent outline: byte-identical to before (every marketing and existing caller)', () => {
    expect(arc()).toBe(arc({ outline: undefined }))
    expect(arc()).not.toContain('data-arc-outline')
  })
  it('one dashed block, no fill, full plot height, labelled on the rail', () => {
    const html = arc({ outline: { weeks: 23, label: 'Marathon training' } })
    expect(html.match(/data-arc-outline/g)).toHaveLength(1)
    const block = html.slice(html.indexOf('data-arc-outline'), html.indexOf('>', html.indexOf('data-arc-outline')))
    expect(block).toContain('dashed var(--line-strong)')
    expect(block).toContain('height:100%')
    expect(block).not.toMatch(/background/)
    expect(html).toContain('Marathon training')
  })
  it('a zero-week outline draws nothing', () => {
    expect(arc({ outline: { weeks: 0, label: 'x' } })).not.toContain('data-arc-outline')
  })
})

describe('StagedRaceBlockCard — dashed rail, the founder\'s two lines, no metrics', () => {
  const html = renderToStaticMarkup(React.createElement(StagedRaceBlockCard, {
    title: raceBlockTitle(staged), line: raceBlockLine(view.raceBlockStart),
  }))
  it('carries the title and line', () => {
    expect(html).toContain('Marathon training')
    expect(html).toContain('Built after your checkpoint.')
  })
  it('dashed left rail, never a session colour; no meter, no progress, no number of km', () => {
    expect(html).toContain('border-left:3px dashed var(--line-strong)')
    expect(html).not.toMatch(/--s-|<meter|<progress|role="progressbar"/)
    expect(html).not.toMatch(/\d\s?km/)
  })
})

describe('the words — interpolated, never hard-typed figures', () => {
  it('base phase line names this runner\'s door and checkpoint week', () => {
    const line = basePhaseLine(staged, view.checkpointWeekStart, 'km')
    expect(line).toMatch(/^Easy running up to about \d+(\.\d)?\s?km a week\. Checkpoint w\/c \d{1,2} \w{3}\.$/)
    expect(line).not.toContain('12 km a week. Checkpoint w/c 16 Nov')   // the approved table's example, not this runner
  })
  it('miles runners read miles', () => {
    expect(basePhaseLine(staged, view.checkpointWeekStart, 'mi')).toMatch(/mi a week/)
  })
  it('pass line names the race', () => {
    expect(checkpointPassedLine(12.4, 42.2, 'km')).toMatch(/a week\. Marathon training starts Monday\.$/)
  })
  it('the phase rail reads "Base building", never the raw key', () => {
    expect(phaseDisplayLabel('base_build')).toBe('Base building')
  })
})

describe('stagedDisplay / isCheckpointWeek', () => {
  it('names the race the runner asked for, and the whole plan\'s length', () => {
    expect(view.raceName).toBe('London Marathon')
    expect(view.raceDate).toBe('2027-04-25')
    expect(view.totalWeeks).toBe(staged.checkpoint_week + staged.race_weeks)
  })
  it('a non-staged plan has no staged view', () => {
    expect(stagedDisplay({ ...plan, meta: { ...plan.meta, staged_race: undefined } } as never)).toBeNull()
    expect(stagedDisplay(null)).toBeNull()
  })
  it('the checkpoint week is exactly the last base week: not the day before, not the day after', () => {
    const at = (iso: string) => new Date(`${iso}T12:00:00`)
    const day = (n: number) => new Date(Date.parse(`${view.checkpointWeekStart}T12:00:00`) + n * 864e5).toISOString().slice(0, 10)
    expect(isCheckpointWeek(plan, at(day(-1)))).toBe(false)
    expect(isCheckpointWeek(plan, at(day(0)))).toBe(true)
    expect(isCheckpointWeek(plan, at(day(6)))).toBe(true)
    expect(isCheckpointWeek(plan, at(day(7)))).toBe(false)
  })
})

describe('Today — the checkpoint line reaches every tier', () => {
  const src = readFileSync('components/dashboard/TodayScreen.tsx', 'utf8')
  const at = src.indexOf('{checkpointLine && (')
  it('rendered from the prop, ahead of the paid coach note', () => {
    expect(at, 're-anchor: the checkpoint slot moved').toBeGreaterThan(-1)
    expect(src.indexOf('{!checkpointLine && hasPaidAccess && (')).toBeGreaterThan(at)
  })
  it('🔴 not inside a hasPaidAccess gate (the plan is never gated: CLAUDE.md, free users are never abandoned)', () => {
    const before = src.slice(Math.max(0, at - 200), at)
    expect(before).not.toMatch(/hasPaidAccess\s*&&\s*\(?\s*$/)
    expect(src.slice(at, at + 40)).not.toContain('hasPaidAccess')
  })
  it('no AIMark on it: rule-engine copy', () => {
    const block = src.slice(at, src.indexOf(')}', at)).replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    expect(block).toContain('<CoachNoteBlock label="CHECKPOINT">')
    expect(block).not.toMatch(/AIMark|aiGenerated/)
  })
  it('DashboardClient passes the line only in the checkpoint week', () => {
    const dc = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    expect(dc).toContain('checkpointLine={isCheckpointWeek(plan, now) ? CHECKPOINT_THIS_WEEK_LINE : null}')
    expect(CHECKPOINT_THIS_WEEK_LINE).toBe("Checkpoint on Sunday. Easy miles count; the pace doesn't.")
  })
})
