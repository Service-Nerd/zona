import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { MODIFIABLE_ROWS, applyEdits, pendingRows, runDaysOf, runDaysEdits, longRunDayEdits, type PlanEdits } from './modifyPlan'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { isDesignedRefusal } from './designedRefusal'
import type { Day } from './days'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * 🔴 PINNED-DAYS-01 (Design Board 2026-10-18) — "Change your plan" asks ONE positive question,
 * *Days you run*, which writes both `days_available` and `days_cannot_train`, as the wizard's
 * WeekGrid does. The two rows it replaced could state a contradiction ("6 declared / 6 blocked").
 */
const base = {
  race_distance_km: 21.1, race_date: '2027-04-25', plan_start: '2026-11-02', goal: 'finish',
  days_available: 4, days_cannot_train: ['tuesday', 'friday', 'sunday'], preferred_long_run_day: 'sat',
  current_weekly_km: 30, longest_recent_run_km: 12, fitness_level: 'intermediate', age: 38, injury_history: [], terrain: 'road',
} as unknown as GeneratorInput

describe('the row', () => {
  it('is one row, "Days you run", and the two it replaced are gone', () => {
    const labels = MODIFIABLE_ROWS.map(r => r.label)
    expect(labels).toContain('Days you run')
    expect(labels).not.toContain('Days a week')
    expect(labels).not.toContain('Days you cannot run')
    expect(MODIFIABLE_ROWS.some(r => r.key === 'days_cannot_train')).toBe(false)
  })
  it('🔴 the sheet renders it as the shared day grid, writing through runDaysEdits', () => {
    const src = readFileSync('components/shared/ModifyPlanSheet.tsx', 'utf8')
    expect(src).toMatch(/row\.key === 'days_available' \? \(\s*<DayGridSelector/)
    expect(src).toContain('runDaysEdits(current, current.preferred_long_run_day, v)')
    expect(src).toContain('pendingRows(base, edits, rows)')
  })
})

describe('runDaysOf — what the grid shows', () => {
  it('clear days = the count: they are the run days', () => {
    expect(runDaysOf(base, null)).toEqual(['mon', 'wed', 'thu', 'sat'])
  })
  it('an older input whose count is below its clear days shows the days its plan ran most', () => {
    const loose = { ...base, days_available: 3, days_cannot_train: [] } as unknown as GeneratorInput
    const plan = { weeks: [0, 1].map(n => ({ n, sessions: { mon: { type: 'easy' }, wed: { type: 'quality' }, sat: { type: 'easy' }, sun: { type: 'rest' } } })) } as unknown as Plan
    expect(runDaysOf(loose, plan)).toEqual(['mon', 'wed', 'sat'])
  })
})

describe('runDaysEdits — one pick, both keys', () => {
  it('writes the count and the complement in the stored spelling', () => {
    const r = runDaysEdits(base, 'sat', ['mon', 'wed', 'sat'])
    expect(r).toEqual({ ok: true, edits: { days_available: 3, days_cannot_train: ['tuesday', 'thursday', 'friday', 'sunday'] } })
  })
  it('re-picking the same days is no change at all', () => {
    const r = runDaysEdits(base, 'sat', ['sat', 'thu', 'mon', 'wed'])
    expect(r.ok && pendingRows(base, r.edits, MODIFIABLE_ROWS)).toEqual([])
  })
  it('one pick is ONE pending change, though it moves two keys', () => {
    const r = runDaysEdits(base, 'sat', ['mon', 'wed', 'sat'])
    expect(r.ok && pendingRows(base, r.edits, MODIFIABLE_ROWS)).toEqual(['days_available'])
  })
  it('refuses fewer than two or more than six', () => {
    expect(runDaysEdits(base, 'sat', ['sat'])).toEqual({ ok: false, reason: 'range' })
    expect(runDaysEdits(base, 'sat', ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).toEqual({ ok: false, reason: 'range' })
  })
  it('🔴 refuses a week with no weekend day: the long run has nowhere to go', () => {
    expect(runDaysEdits(base, 'sat', ['mon', 'wed', 'thu'])).toEqual({ ok: false, reason: 'weekend' })
  })
  it('🔴 dropping the long-run day moves the long run to the other weekend day, as a visible edit', () => {
    const r = runDaysEdits(base, 'sat', ['mon', 'wed', 'sun'])
    expect(r.ok && r.edits.preferred_long_run_day).toBe('sun')
    expect(r.ok && pendingRows(base, r.edits, MODIFIABLE_ROWS)).toEqual(['days_available', 'preferred_long_run_day'])
  })
})

describe('longRunDayEdits — the long run stays on a run day', () => {
  it('a long-run day that is already a run day changes only the long-run day', () => {
    expect(longRunDayEdits(base, ['mon', 'sat', 'sun'], 'sun')).toEqual({ ok: true, edits: { preferred_long_run_day: 'sun' } })
  })
  it('one that is not adds it to the run days', () => {
    const r = longRunDayEdits(base, ['mon', 'wed', 'thu', 'sat'], 'sun')
    expect(r.ok && r.edits).toMatchObject({ preferred_long_run_day: 'sun', days_available: 5 })
  })
  it('refuses at six days, where adding one would make seven', () => {
    expect(longRunDayEdits(base, ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], 'sun')).toEqual({ ok: false, reason: 'range' })
  })
})

describe('🔴 composition: a pick, through the real engine, puts every training run on the picked days', () => {
  // Measured before this was written: with the long-run day outside the picks, 642 plan-weeks of 512 plans put
  // the long run on a BLOCKED weekend day. runDaysEdits makes that pick unreachable; this walks the result through
  // the producer so the claim on the row ("Your runs move onto these days") is held by the engine, not by a comment.
  const picks: Day[][] = [['tue', 'thu', 'sun'], ['mon', 'wed', 'fri', 'sat'], ['mon', 'sat'], ['wed', 'sat', 'sun'], ['mon', 'tue', 'wed', 'thu', 'sun']]
  const inputs = cohortGrid().filter((_, i) => i % 4999 === 0)
  it('every pick × sampled runner: no training run off the picks, and the long run on one of them', () => {
    let plans = 0
    const off: string[] = []
    for (const input of inputs) for (const pick of picks) for (const lr of ['sat', 'sun'] as const) {
      const r = runDaysEdits(input, lr, pick)
      if (!r.ok) throw new Error(`pick refused: ${pick}`)
      const next = applyEdits({ ...input, preferred_long_run_day: lr }, r.edits as PlanEdits)
      expect(pick).toContain(next.preferred_long_run_day)
      let plan
      try { plan = generateRulePlan(next, 'paid', COHORT_PLAN_START) } catch (e) { if (isDesignedRefusal(e)) continue; throw e }
      plans++
      for (const w of plan.weeks) for (const [d, s] of Object.entries(w.sessions ?? {})) {
        const t = (s as { type?: string } | null)?.type
        if (s && t !== 'rest' && t !== 'race' && t !== 'strength' && !pick.includes(d as Day)) off.push(`${pick} lr=${lr} wk${w.n} ${d}:${t}`)
      }
    }
    expect(plans).toBeGreaterThan(20)
    expect(off.slice(0, 5)).toEqual([])
  })
})
