import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { LOAD_RATIO, LOAD_PICTURE_LOW_WEEKS_TO_NAME } from '@/lib/coaching/constants'
import { loadRatioContext } from './loadRatioContext'

/**
 * LOAD-VERDICT-RED-01 — the Coach load verdict. No red in the training UI (ux-principles.md): a week above the
 * runner's normal is a warning, amber, never `--danger`. And one owner: the dashboard reads it, never re-states it.
 */
const RATIOS = [null, 0, 0.5, LOAD_RATIO.under - 0.01, LOAD_RATIO.under, 1, LOAD_RATIO.watch - 0.01, LOAD_RATIO.watch, LOAD_RATIO.flag, 2, 5]

const PLAIN = { plannedEasy: false, lowWeeksRunning: 0 }

describe('loadRatioContext', () => {
  it('🔴 no ratio is coloured red, in any context', () => {
    for (const r of RATIOS) for (const ctx of [PLAIN, { plannedEasy: true, lowWeeksRunning: 0 }, { plannedEasy: false, lowWeeksRunning: 5 }]) {
      const v = loadRatioContext(r, ctx)
      expect(`${v.color} ${v.markerColor}`, `ratio ${r}`).not.toMatch(/danger|--red|--s-inter/)
    }
  })
  it('above the normal is amber; inside it is moss; no ratio is muted', () => {
    expect(loadRatioContext(LOAD_RATIO.watch, PLAIN)).toEqual({ label: 'above your recent normal', color: 'var(--warn)', markerColor: 'var(--warn)' })
    expect(loadRatioContext(1, PLAIN).label).toBe('right on your normal')
    expect(loadRatioContext(1, PLAIN).color).toBe('var(--moss-strong)')
    expect(loadRatioContext(null, PLAIN).color).toBe('var(--mute)')
  })
  it('LOAD-SOURCE-TOTAL-01: one unplanned week under normal is neutral, NOT amber (Design Board 2026-10-30)', () => {
    const v = loadRatioContext(LOAD_RATIO.under - 0.01, PLAIN)
    expect(v.label).toBe('under your recent normal')
    expect(v.color).toBe('var(--ink-2)')
    expect(v.markerColor).toBe('var(--mute)')
    expect(`${v.color} ${v.markerColor}`).not.toMatch(/--warn/)
  })
  it('under normal in a planned lighter week is the plan working: moss, and the words say planned', () => {
    const v = loadRatioContext(0.5, { plannedEasy: true, lowWeeksRunning: 3 })
    expect(v.label).toMatch(/planned/)
    expect(v.color).toBe('var(--moss-strong)')
  })
  it(`${LOAD_PICTURE_LOW_WEEKS_TO_NAME} unplanned low weeks in a row are named, in amber; one fewer is not`, () => {
    expect(loadRatioContext(0.5, { plannedEasy: false, lowWeeksRunning: LOAD_PICTURE_LOW_WEEKS_TO_NAME }).color).toBe('var(--warn)')
    expect(loadRatioContext(0.5, { plannedEasy: false, lowWeeksRunning: LOAD_PICTURE_LOW_WEEKS_TO_NAME - 1 }).color).toBe('var(--ink-2)')
  })
  it('a planned lighter week above normal is still above normal', () => {
    expect(loadRatioContext(LOAD_RATIO.watch, { plannedEasy: true, lowWeeksRunning: 0 }).color).toBe('var(--warn)')
  })
  it('🔴 one owner: the dashboard imports the verdict and does not define its own', () => {
    const shell = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    expect(shell).toContain("from '@/lib/ui/loadRatioContext'")
    expect(shell).not.toMatch(/function loadRatioContext\s*\(/)
    expect(shell).not.toMatch(/above your recent normal/)
  })
})
