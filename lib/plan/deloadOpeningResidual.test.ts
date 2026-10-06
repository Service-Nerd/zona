// §119 Amendment 1 — DELOAD-PLAN-OPENING-01.
//
// The placement SEARCH (lib/plan/deloadCadence.ts) replaced the greedy walk, and
// this file gates the three things the board's sitting 2 required of it:
//   1. the search actually reaches a compliant opening block where one exists
//   2. where none exists, the residual is STAMPED and carries its note
//   3. the stamp and the note cannot come apart in either direction
//
// ⚠️ WHAT THIS DOES NOT PROVE. It does not prove the residual is SMALL — that is
// a corpus measurement, recorded in `shortOpeningBlockWeeks`'s own doc comment
// (masters x HM 99.2%, experienced ~3.2%) and re-derivable with
// /tmp-style grid scripts, not asserted here. A test that pinned those rates
// would re-baseline itself every time the grid widened.
import { describe, it, expect } from 'vitest'
import { computeDeloadWeeks, shortOpeningBlockWeeks } from './deloadCadence'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorPhase, Plan } from '@/types/plan'

const MIN = GENERATION_CONFIG.MIN_LOADING_BLOCK_WEEKS

/** base 1..baseEnd, build ..buildEnd, peak ..peakEnd, then taper. */
const phases = (baseEnd: number, buildEnd: number, peakEnd: number) =>
  (n: number): GeneratorPhase =>
    n <= baseEnd ? 'base' : n <= buildEnd ? 'build' : n <= peakEnd ? 'peak' : 'taper'

describe('§119 Am. 1 — the placement search reaches a compliant opening block', () => {
  it('a 16-week plan at cadence 4 opens with a full loading block', () => {
    const got = shortOpeningBlockWeeks(16, 4, phases(6, 12, 14))
    expect(got, `short-opening weeks in a case the search can solve`).toEqual([])
  })

  it('THE DEFECT, reconstructed: without a search the opening block is one week', () => {
    // The masters cadence in a 16-week plan is where the greedy walk put a
    // recovery week at week 2 — one week of stimulus, then recovered from it.
    // The search cannot fix THIS shape (see the infeasibility case below), which
    // is why the residual exists at all; what it must do is REPORT it.
    const placed = Array.from(computeDeloadWeeks(16, 3, phases(5, 10, 13))).sort((a, b) => a - b)
    expect(placed.length, 'a plan is never left without deloads').toBeGreaterThan(0)
    const openingRun = (placed[0] as number) - 1
    if (openingRun < MIN) {
      expect(shortOpeningBlockWeeks(16, 3, phases(5, 10, 13))).toContain(placed[0])
    }
  })

  it('the reporter shares the PRODUCER — it never derives its own placement', () => {
    // DELOAD-OWNER-01: a checker computing its own copy cannot catch the producer
    // being wrong. Every week the reporter names must be one the owner placed.
    for (const freq of [3, 4]) {
      for (const total of [10, 12, 16, 18, 20]) {
        const pf = phases(Math.round(total * 0.35), Math.round(total * 0.72), total - 2)
        const placed = computeDeloadWeeks(total, freq, pf)
        for (const w of shortOpeningBlockWeeks(total, freq, pf)) {
          expect(placed.has(w), `${total}w freq${freq}: reported week ${w} is not a placed deload`).toBe(true)
        }
      }
    }
  })

  it('a reported week always has a genuinely short preceding run', () => {
    for (const freq of [3, 4]) {
      for (const total of [10, 12, 16, 18, 20]) {
        const pf = phases(Math.round(total * 0.35), Math.round(total * 0.72), total - 2)
        const placed = Array.from(computeDeloadWeeks(total, freq, pf)).sort((a, b) => a - b)
        const eWeeks: number[] = []
        for (let n = 1; n <= total; n++) {
          const p = pf(n)
          if (p !== 'peak' && p !== 'taper') eWeeks.push(n)
        }
        for (const w of shortOpeningBlockWeeks(total, freq, pf)) {
          const i = eWeeks.indexOf(w)
          const prev = placed.filter(x => x < w).pop()
          const run = i - (prev === undefined ? -1 : eWeeks.indexOf(prev)) - 1
          expect(run, `${total}w freq${freq} week ${w}`).toBeLessThan(MIN)
        }
      }
    }
  })
})

describe('INV-PLAN-SHORT-OPENING-BLOCK-DECLARED — both directions', () => {
  const base = {
    meta: { race_distance_km: 10 },
    weeks: [{ n: 1, phase: 'base', type: 'normal', sessions: {} }],
  } as unknown as Plan

  const codes = (p: Plan) =>
    (validatePlan(p, { race_distance_km: 10 } as never) as { code: string }[])
      .filter(v => v.code === 'INV-PLAN-SHORT-OPENING-BLOCK-DECLARED')

  it('silent when neither stamp nor note is present — the ordinary plan', () => {
    expect(codes(base)).toEqual([])
  })

  it('FIRES on a stamp with no note (the residual going quiet)', () => {
    const p = { ...base, meta: { ...base.meta, short_opening_block_weeks: [2] } } as Plan
    expect(codes(p).length, 'a stamped residual with no note must fail').toBe(1)
    expect(codes(p)[0]).toBeTruthy()
  })

  it('FIRES on a note with no stamp (telling a runner something untrue)', () => {
    const p = { ...base, meta: { ...base.meta, short_opening_block_note: 'Week 2 is an early recovery week.' } } as Plan
    expect(codes(p).length, 'a note with nothing behind it must fail').toBe(1)
  })

  it('SILENT when both are present together', () => {
    const p = {
      ...base,
      meta: { ...base.meta, short_opening_block_weeks: [2], short_opening_block_note: 'Week 2 is an early recovery week.' },
    } as Plan
    expect(codes(p)).toEqual([])
  })

  it('an EMPTY stamp array is not a stamp — it must not demand a note', () => {
    const p = { ...base, meta: { ...base.meta, short_opening_block_weeks: [] } } as Plan
    expect(codes(p)).toEqual([])
  })
})
