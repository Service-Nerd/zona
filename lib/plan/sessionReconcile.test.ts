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

// ⚠️ NOT A LOOSENED TOLERANCE — a shape whose PREMISE differs, with its own
// stricter contract asserted in the second describe block below.
//
// Every shape above partitions its total: warm-up + main + cool-down IS the
// session. The §78 time trial does not. `ruleEngine` sets `distance_km` to the
// trial alone and puts the warm-up and cool-down outside it on purpose (that is
// what the plan counts — sumWeeklyKm, §1, §52), so there is nothing to
// apportion and no honest distance for the bookends: "cool down easy" carries
// no number. Its parts therefore differ in KIND, which the same-unit assertion
// below correctly refuses. Asserting it here would mean either inventing a
// warm-up distance or hiding the 5 km, and both are worse than the bug.
const NON_PARTITIONED_SHAPES = new Set(['time_trial'])

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
    // `time_trial` is listed so the shape cannot silently stop being generated
    // and take its own contract (below) quietly out of the suite with it.
    for (const required of ['easy_run', 'long_run', 'long_run_with_mp', 'shakeout', 'time_trial']) {
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
          if (NON_PARTITIONED_SHAPES.has(structure.shape)) continue
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

// ── The §78 time trial's own contract (TT-STRUCTURE-01) ─────────────────────
//
// FOUNDER-REPORTED, 2026-09-17. A 5K time trial rendered "warm-up ~3km · main
// set ~2km · cool-down ~0km" while Kit's note beside it said "warm up easy for
// 10 minutes, then 5 km as hard as you can hold". The trial's OWN 5 km was
// being carved up into a warm-up, and the measurement the whole recalibration
// feature depends on showed as 2 km.
//
// This block is stricter than the partition assertion above, not looser: the
// main set must equal the trial EXACTLY, and — the assertion that would have
// caught the original bug — the warm-up the card shows must be the same number
// the coach note promises. A prose/structure disagreement is the defect class;
// nothing checked the two against each other.
describe('TT-STRUCTURE-01 — the time trial shows the trial, and agrees with its own note', () => {
  const trials = collectCases().filter(c => c.structure.shape === 'time_trial')

  it('the sample contains time trials at all', () => {
    expect(trials.length, 'no time trial in the sample — this block asserts nothing').toBeGreaterThan(0)
  })

  it('the main set IS the trial distance, exactly and without a ~ estimate marker', () => {
    for (const { session, structure, label } of trials) {
      for (const units of ['km', 'mi'] as const) {
        const f = resolveDisplayFigures(structure, { metric: 'distance', units, sessionDistanceKm: session.distance_km ?? null })
        const km = session.distance_km ?? 0
        expect(km, `${label}: a time trial with no distance`).toBeGreaterThan(0)
        const expected = Math.round(units === 'mi' ? km / KM_PER_MI : km)
        const main = parseFigure(f.mainSet)
        expect(main.kind, `${label}: main set should be a distance under the km toggle`).toBe(units)
        expect(main.value, `${label}: main set ${f.mainSet} ≠ the ${km}km trial`).toBe(expected)
        // The trial is prescribed, not estimated — every other figure on the
        // card carries "~" and this one must not.
        expect(f.mainSet.includes('~'), `${label}: the trial distance is exact, not an estimate`).toBe(false)
      }
    }
  })

  it('warm-up and cool-down are minutes — never an invented distance', () => {
    for (const { session, structure, label } of trials) {
      const f = resolveDisplayFigures(structure, { metric: 'distance', units: 'km', sessionDistanceKm: session.distance_km ?? null })
      expect(parseFigure(f.warmup).kind, `${label}: warm-up must stay in minutes`).toBe('min')
      expect(parseFigure(f.cooldown).kind, `${label}: cool-down must stay in minutes`).toBe('min')
    }
  })

  it('the card agrees with the coach note — same warm-up minutes, same trial distance', () => {
    for (const { session, structure, label } of trials) {
      const note = (session.coach_notes ?? []).join(' ')
      const wuNote = note.match(/warm up easy for (\d+) minutes/i)
      const distNote = note.match(/then ([\d.]+) km as hard as you can hold/i)
      expect(wuNote, `${label}: the trial's warm-up note has gone missing`).not.toBeNull()
      expect(distNote, `${label}: the trial's distance note has gone missing`).not.toBeNull()
      expect(structure.warmup.duration_mins, `${label}: card says ${structure.warmup.duration_mins} min warm-up, note says ${wuNote![1]}`).toBe(Number(wuNote![1]))
      expect(session.distance_km, `${label}: card trial ${session.distance_km}km, note says ${distNote![1]}km`).toBe(Number(distNote![1]))
    }
  })

  it('the session total is warm-up + trial + cool-down, not the trial alone', () => {
    for (const { structure, label } of trials) {
      const sum = structure.warmup.duration_mins + structure.main.duration_mins + structure.cooldown.duration_mins
      expect(structure.total_duration_mins, `${label}: total ${structure.total_duration_mins} ≠ ${sum}`).toBe(sum)
      expect(structure.total_duration_mins, `${label}: total must exceed the effort alone`).toBeGreaterThan(structure.main.duration_mins)
    }
  })
})
