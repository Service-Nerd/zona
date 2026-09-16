// SESSION-RECONCILE-01 — the figures on a session card must add up.
//
// Founder-reported (2026-09-16): a 22 km MP long run showed "2 km warm-up · 9 km
// main · 2 km cool-down" — 13, against a 22 km header — because the race-pace
// segment (the missing ~9 km) rendered as a bare "40%" with no distance, and each
// part was rounded independently. Two tests already CLAIMED to guard this and both
// were blind: sessionComposer.test.ts summed only three parts (never the segment),
// and racePaceOverlay.test.ts summed the segment but only in MINUTES, computing it
// locally rather than reading a figure off the structure.
//
// This is the guard that was missing: compose EVERY session the engine generates
// across the cohort grid, run the SAME display owner the card uses
// (resolveDisplayFigures), and assert the figures a runner reads sum to the
// session total — by distance when the toggle is on km, by duration when on time,
// and in miles as well as km. It asserts on the rendered figures, not the raw
// composer output, because the rounding is where the second defect lived.
//
// WHEN THIS GOES RED: a session shape reaches the card whose parts do not sum to
// its total. Find the shape in the failure message. Do not loosen the tolerance —
// the whole point is that the visible parts add up exactly.

import { describe, it, expect } from 'vitest'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { composePlanWithFoundation } from './foundationCompose'
import { composeSession, type SessionStructure } from './sessionComposer'
import { resolveDisplayFigures } from './sessionSteps'
import { catalogueRowFor } from './catalogueLink'
import type { Session } from '@/types/plan'

const KM_PER_MI = 1.609344

// The card renders these shapes as a structure; the others (rest/race/strength)
// show a zero structure the SessionSteps block skips.
const SKIP_SHAPES = new Set(['rest', 'race', 'strength'])

// A deterministic sample of the (exhaustive) cohort grid. The reconciliation is
// a pure function of the composed structure, so one representative of each SHAPE
// proves as much as tens of thousands do — the sample keeps the build fast while
// the coverage assertion below fails loudly if a shape stops appearing. A prime
// stride avoids aligning with any axis of the grid.
const SAMPLE_STRIDE = 97

/** Parse a display figure ("~22km" / "~14mi" / "60 min") into value + kind.
 *  `min` is matched before `mi` — otherwise the "mi" inside "min" wins and a
 *  minute figure is misread as miles. */
function parseFigure(s: string): { value: number; kind: 'km' | 'mi' | 'min' } {
  const m = s.match(/~?\s*(\d+)\s*(min|km|mi)/)
  if (!m) throw new Error(`unparseable figure: "${s}"`)
  return { value: parseInt(m[1], 10), kind: m[2] as 'km' | 'mi' | 'min' }
}

interface Case { session: Session; structure: SessionStructure; label: string }

// Generate + compose once; every assertion below reads the cached structures.
function collectCases(): Case[] {
  const grid = cohortGrid()
  const out: Case[] = []
  for (let i = 0; i < grid.length; i += SAMPLE_STRIDE) {
    let plan
    try {
      const raw = generateRulePlan(grid[i], 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
      plan = composePlanWithFoundation(raw, grid[i], COHORT_PLAN_START, 'add').plan
    } catch {
      continue // refusals carry no plan to inspect
    }
    for (const week of plan.weeks) {
      for (const [day, s] of Object.entries(week.sessions ?? {})) {
        const session = s as Session
        const structure = composeSession({ session, catalogueRow: catalogueRowFor(session) })
        if (!structure || SKIP_SHAPES.has(structure.shape)) continue
        out.push({ session, structure, label: `w${week.n}-${day} (${session.label})` })
      }
    }
  }
  return out
}

describe('SESSION-RECONCILE-01 — card figures sum to the session total', () => {
  const cases = collectCases()

  it('the sample covers every prescribable session shape (nothing untested)', () => {
    const shapes = new Set(cases.map(c => c.structure.shape))
    // long_run_with_mp is the shape the two old guards were structurally blind to.
    for (const required of ['easy_run', 'long_run', 'long_run_with_mp', 'shakeout']) {
      expect(shapes.has(required as SessionStructure['shape']), `sample produced no ${required} — coverage gap`).toBe(true)
    }
    // At least one quality shape (repeats / continuous / progression).
    expect(Array.from(shapes).some(s => s.startsWith('quality')), 'no quality session in sample').toBe(true)
    expect(cases.length).toBeGreaterThan(500)
  })

  for (const metric of ['distance', 'duration'] as const) {
    for (const units of ['km', 'mi'] as const) {
      it(`warm-up + main-set + cool-down = session total (${metric}, ${units})`, () => {
        for (const { session, structure, label } of cases) {
          const f = resolveDisplayFigures(structure, { metric, units, sessionDistanceKm: session.distance_km ?? null })
          const wu = parseFigure(f.warmup)
          const main = parseFigure(f.mainSet)
          const cd = parseFigure(f.cooldown)

          // Every section figure is in the same unit.
          expect(main.kind, `${label}: mixed units`).toBe(wu.kind)
          expect(cd.kind, `${label}: mixed units`).toBe(wu.kind)

          const partsSum = wu.value + main.value + cd.value

          // Expected total in the SAME kind the figures came out in — a
          // duration-anchored session shows minutes even under the distance toggle.
          let expected: number
          if (wu.kind === 'min') {
            expected = structure.total_duration_mins
          } else {
            const km = session.distance_km ?? 0
            expected = Math.round(units === 'mi' ? km / KM_PER_MI : km)
          }

          expect(partsSum, `${label}: parts ${wu.value}+${main.value}+${cd.value}=${partsSum} ≠ total ${expected}`).toBe(expected)
        }
      })
    }
  }

  it('on an MP long run the main-set rows (easy + race pace) sum to the main-set total', () => {
    const mp = cases.filter(c => c.structure.shape === 'long_run_with_mp')
    expect(mp.length, 'no MP long runs in the sample — this asserts nothing').toBeGreaterThan(0)
    for (const { session, structure, label } of mp) {
      for (const metric of ['distance', 'duration'] as const) {
        const f = resolveDisplayFigures(structure, { metric, units: 'km', sessionDistanceKm: session.distance_km ?? null })
        expect(f.racePace, `${label}: MP long run has no race-pace figure`).not.toBeNull()
        const easy = parseFigure(f.mainEasy)
        const race = parseFigure(f.racePace!)
        const main = parseFigure(f.mainSet)
        expect(easy.value + race.value, `${label}: easy+race ≠ main-set (${metric})`).toBe(main.value)
      }
    }
  })
})
