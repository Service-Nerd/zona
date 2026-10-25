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
  it('DashboardClient passes the checkpoint-week line, else the passed line, else nothing', () => {
    const dc = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    expect(dc).toContain('checkpointLine={todayCheckpointLine(plan, now, preferredUnits)}')
    const fn = dc.slice(dc.indexOf('function todayCheckpointLine('), dc.indexOf('export default function DashboardClient'))
    expect(fn).toMatch(/if \(isCheckpointWeek\(plan, now\)\) return CHECKPOINT_THIS_WEEK_LINE/)
    expect(fn).toMatch(/return passed \? checkpointPassedLine\(passed\.observedKm, passed\.raceKm, units\) : null/)
    expect(CHECKPOINT_THIS_WEEK_LINE).toBe("Checkpoint on Sunday. Easy miles count; the pace doesn't.")
  })
})

// ── Phase C-2: the checkpoint card and its consent screen ─────────────────────────────────────────────────────────
import { checkpointConsent } from '@/lib/plan/checkpointCopy'
import { stagedHandoverCopy } from '@/lib/ui/handoverCopy'
import { checkpointPassed } from '@/lib/plan/stagedRacePlan'

describe('the checkpoint card for a staged plan says only what is already true', () => {
  const c = stagedHandoverCopy(staged, view)
  it('names the race block, never "That\'s the base done", and carries no planned figure', () => {
    expect(c.title).toBe('Marathon training')
    expect(c.line).toContain('Built after your checkpoint.')
    expect(c.metric).toBeNull()
    expect(JSON.stringify(c)).not.toMatch(/base done|\d\s?km/)
    expect(c.primary).toBe('Build the marathon plan')
    expect(c.secondary).toBe('Not yet')
  })
})

describe('checkpointConsent — the consent screen from the 422 body (amendments 5, 7, 8)', () => {
  it('not reached: what they ran, why, and the options in the engine\'s order with the approved labels', () => {
    const k = checkpointConsent({ reason: 'checkpoint_not_reached', observed_km: 11.3, target_km: 12, race_distance_km: 42.2,
      options: [{ kind: 'extend', weeks: 2 }, { kind: 'run_walk' }, { kind: 'later_race' }] }, 'km')!
    expect(k.heading).toMatch(/^You ran 11(\.3)?\s?km a week\.$/)
    expect(k.why).toMatch(/^Marathon training needs about 12\s?km to start safely\.$/)
    expect(k.options.map(o => o.label)).toEqual(['2 more weeks of base building', 'Run-walk the marathon', 'Pick a later race'])
  })
  it('one week reads as words', () => {
    const k = checkpointConsent({ reason: 'checkpoint_not_reached', observed_km: 11, target_km: 12, race_distance_km: 42.2,
      options: [{ kind: 'extend', weeks: 1 }, { kind: 'later_race' }] }, 'km')!
    expect(k.options[0].label).toBe('One more week of base building')
  })
  it('no runs: its own heading, no figure, Apple Health first', () => {
    const k = checkpointConsent({ reason: 'checkpoint_no_runs', options: [{ kind: 'connect_health' }, { kind: 'later_race' }] }, 'km')!
    expect(k).toEqual({ heading: "We haven't seen any runs yet.", why: null,
      options: [{ kind: 'connect_health', label: 'Connect Apple Health' }, { kind: 'later_race', label: 'Pick a later race' }] })
  })
  it('choose: "Two ways" only with two options; otherwise the figure, plainly', () => {
    const two = checkpointConsent({ reason: 'checkpoint_choose', observed_km: 12, race_distance_km: 42.2,
      options: [{ kind: 'run_walk' }, { kind: 'later_race' }] }, 'km')!
    expect(two.heading).toBe('Two ways to get to the start line from here.')
    const one = checkpointConsent({ reason: 'checkpoint_choose', observed_km: 12, race_distance_km: 42.2,
      options: [{ kind: 'later_race' }] }, 'km')!
    expect(one.heading).toMatch(/^You ran 12\s?km a week\.$/)
  })
  it('never more than three; any other 422 is not a consent screen', () => {
    const k = checkpointConsent({ reason: 'checkpoint_not_reached', observed_km: 9, target_km: 12, race_distance_km: 42.2,
      options: [{ kind: 'extend', weeks: 3 }, { kind: 'run_walk' }, { kind: 'later_race' }, { kind: 'connect_health' }] }, 'km')!
    expect(k.options).toHaveLength(3)
    expect(checkpointConsent({ reason: 'warn_unacknowledged', options: [] }, 'km')).toBeNull()
    expect(checkpointConsent({ error: 'x' }, 'km')).toBeNull()
    expect(checkpointConsent(null, 'km')).toBeNull()
  })
  it('miles runners read miles', () => {
    const k = checkpointConsent({ reason: 'checkpoint_not_reached', observed_km: 16, target_km: 20, race_distance_km: 42.2,
      options: [{ kind: 'later_race' }] }, 'mi')!
    expect(k.heading).toMatch(/mi a week\.$/)
  })
})

describe('checkpointPassed — the one line on Today (amendment 6)', () => {
  const race = { weeks: [{ n: 1, date: '2026-11-23', sessions: {} }], meta: { plan_kind: 'race',
    generator_input: { volume_observed: true, current_weekly_km: 12.4, race_distance_km: 42.2 } } } as never
  it('from accepting until the race plan starts, quoting the measured figure', () => {
    expect(checkpointPassed(race, new Date('2026-11-21T12:00:00'))).toEqual({ observedKm: 12.4, raceKm: 42.2 })
    expect(checkpointPassedLine(12.4, 42.2, 'km')).toMatch(/^12\.4\s?km a week\. Marathon training starts Monday\.$/)
  })
  it('gone once the plan has started, and never for a declared volume', () => {
    expect(checkpointPassed(race, new Date('2026-11-24T12:00:00'))).toBeNull()
    const declared = { ...(race as object), meta: { plan_kind: 'race', generator_input: { current_weekly_km: 12.4, race_distance_km: 42.2 } } } as never
    expect(checkpointPassed(declared, new Date('2026-11-21T12:00:00'))).toBeNull()
  })
})

describe('the consent screen on the card, wired', () => {
  const today = readFileSync('components/dashboard/TodayScreen.tsx', 'utf8')
  const dc = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
  const card = today.slice(today.indexOf('{handover && ('), today.indexOf('{showMaintTransition && ('))
  it('renders the consent heading, why and options in place of the card\'s own, first option primary', () => {
    expect(card).toContain('checkpointConsent ? checkpointConsent.heading : handover.title')
    expect(card).toContain('checkpointConsent ? checkpointConsent.why : handover.line')
    expect(card).toMatch(/checkpointConsent\.options\.map\(\(o, i\) => \(\s*<Button key=\{o\.kind\} variant=\{i === 0 \? 'primary' : 'secondary'\}/)
  })
  it('🔴 no meter, no progress bar, anywhere on the card (Sierra, amendment 5)', () => {
    expect(card).not.toMatch(/<meter|<progress|progressbar|ProgressBar|RpeBar/)
  })
  it('the 422 becomes the consent screen only on a checkpoint request', () => {
    expect(dc).toContain('const consent = checkpoint ? checkpointConsent(data as Record<string, unknown>, preferredUnits) : null')
    expect(dc).toContain("...(checkpoint && choice ? { checkpoint_choice: choice } : {})")
  })
  it('🔴 "Not yet" on a staged plan writes no seen-flag (the race is still waiting)', () => {
    const fn = dc.slice(dc.indexOf('async function handleDismissHandover()'), dc.indexOf('handoverSeenPatch()', dc.indexOf('async function handleDismissHandover()')))
    expect(fn).toMatch(/if \(stagedRaceOf\(plan\)\) \{ setHandoverHidden\(true\); setCheckpointConsentData\(null\); return \}/)
  })
  it('each option acts through a path that already exists', () => {
    const fn = dc.slice(dc.indexOf('function handleCheckpointOption('), dc.indexOf('async function handleDismissHandover()'))
    expect(fn).toContain("void handleBuildRacePlan(kind)")
    expect(fn).toContain("setScreen('generate')")
    expect(fn).toContain("setMeOpenSection('connections'); setScreen('me')")
  })
  it('the route honours only the three engine choices', () => {
    const route = readFileSync('app/api/generate-plan/route.ts', 'utf8')
    expect(route).toContain("const choice = rawChoice === 'extend' || rawChoice === 'run_walk' || rawChoice === 'half' ? rawChoice : undefined")
  })
})
