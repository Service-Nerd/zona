// GRID-EARLY-ONSET-01 fallout (2026-09-20) — the grid's own doc comment claimed
// 31,104 inputs while the grid produced 41,472.
//
// CLAUDE.md already warns that the grid "has been widened five times and the
// count moves, so read it from the file, not from here". The file was wrong
// too. This makes the number a gate rather than a claim: widen an axis and the
// test fails, so the comment must be updated in the same commit.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { cohortGrid } from './cohortGrid'

describe('cohortGrid — the stated size is the real size', () => {
  const grid = cohortGrid()

  it('produces the documented number of inputs', () => {
    expect(grid.length).toBe(41472)
  })

  it('the doc comment states the same number it produces', () => {
    const src = readFileSync('lib/plan/cohortGrid.ts', 'utf8')
    expect(src).toContain(`${grid.length.toLocaleString('en-GB')} inputs`)
  })

  it('is exhaustive and ordered — no duplicates, deterministic', () => {
    const again = cohortGrid()
    expect(again.length).toBe(grid.length)
    expect(JSON.stringify(again[0])).toBe(JSON.stringify(grid[0]))
    expect(JSON.stringify(again[grid.length - 1])).toBe(JSON.stringify(grid[grid.length - 1]))
  })

  it('ADR-021’s early-onset cell is REACHABLE — the thing GRID-EARLY-ONSET-01 said it was not', () => {
    // experienced + recent_quality_training 'regular' + a 12-week runway (5K/10K).
    const cell = grid.filter(i => {
      const g = i as unknown as Record<string, unknown>
      return g.fitness_level === 'experienced'
        && g.recent_quality_training === 'regular'
        && (g.race_distance_km === 5 || g.race_distance_km === 10)
    })
    expect(cell.length).toBeGreaterThan(0)
  })
})
