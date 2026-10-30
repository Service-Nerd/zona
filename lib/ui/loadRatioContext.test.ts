import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { LOAD_RATIO } from '@/lib/coaching/constants'
import { loadRatioContext } from './loadRatioContext'

/**
 * LOAD-VERDICT-RED-01 — the Coach load verdict. No red in the training UI (ux-principles.md): a week above the
 * runner's normal is a warning, amber, never `--danger`. And one owner: the dashboard reads it, never re-states it.
 */
const RATIOS = [null, 0, 0.5, LOAD_RATIO.under - 0.01, LOAD_RATIO.under, 1, LOAD_RATIO.watch - 0.01, LOAD_RATIO.watch, LOAD_RATIO.flag, 2, 5]

describe('loadRatioContext', () => {
  it('🔴 no ratio is coloured red', () => {
    for (const r of RATIOS) expect(loadRatioContext(r).color, `ratio ${r}`).not.toMatch(/danger|--red|--s-inter/)
  })
  it('above the normal is the warning amber; inside it is moss; no ratio is muted', () => {
    expect(loadRatioContext(LOAD_RATIO.watch)).toEqual({ label: 'above your recent normal', color: 'var(--warn)' })
    expect(loadRatioContext(1)).toEqual({ label: 'right on your normal', color: 'var(--moss-strong)' })
    expect(loadRatioContext(LOAD_RATIO.under - 0.01).label).toBe('under your recent normal')
    expect(loadRatioContext(null).color).toBe('var(--mute)')
  })
  it('🔴 one owner: the dashboard imports the verdict and does not define its own', () => {
    const shell = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    expect(shell).toContain("from '@/lib/ui/loadRatioContext'")
    expect(shell).not.toMatch(/function loadRatioContext\s*\(/)
    expect(shell).not.toMatch(/above your recent normal/)
  })
})
