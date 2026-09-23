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
import { apportionRoundedDistance } from '@/lib/format'
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

          // ── UNITS-SUBUNIT-01, Design Board 2026-09-23 ─────────────────────
          //
          // 🔴 THIS USED TO ASSERT THE MECHANISM, NOT THE GUARANTEE:
          //
          //     expect(main.kind).toBe(wu.kind)   // "every figure, same unit"
          //     expect(cd.kind).toBe(wu.kind)
          //
          // The guarantee SESSION-RECONCILE-01 exists for is *the visible parts
          // add up*. Same-kind was how that happened to be achieved, not the
          // promise — and asserting it froze the mechanism in place.
          //
          // ⚠️ IT WAS NEVER IN `ui-patterns.md`. The pattern document says the
          // parts sum; it never says the three headers share a kind. § 21b's
          // SHIPPED time-trial variant renders `WARM-UP 10 min` beside a
          // distance main set, and § 21b's metric rule already mixes kinds at
          // row level ("a hill rep at RPE keeps time as its primary"). So the
          // rule lived in a test, the pattern contradicted it, and the one
          // shape that proved it wrong was CARVED OUT rather than examined
          // (`NON_PARTITIONED_SHAPES`). The carve-out was the tell.
          //
          // ⚠️ WHAT REPLACES IT IS STRICTLY STRONGER. A part may fall back to
          // minutes ONLY when it apportioned to exactly zero units — so the
          // fallback cannot hide a real distance, which a kind check could not
          // have told you either way. Distance-kind parts must still sum to the
          // header exactly, and a minutes part contributes the 0 it really is.
          const km = session.distance_km ?? 0
          const distanceTotal = Math.round(units === 'mi' ? km / KM_PER_MI : km)
          const anyDistance = [wu, main, cd].some(x => x.kind !== 'min')

          if (!anyDistance) {
            // Duration-anchored session: minutes even under the distance toggle.
            const partsSum = wu.value + main.value + cd.value
            expect(partsSum, `${label}: duration parts ${wu.value}+${main.value}+${cd.value} ≠ ${structure.total_duration_mins}`)
              .toBe(structure.total_duration_mins)
          } else {
            // Mixed or all-distance: every non-minutes part is in the reader's
            // unit, and the minutes ones are the sub-unit fallback.
            for (const [name, fig] of [['warm-up', wu], ['main-set', main], ['cool-down', cd]] as const) {
              if (fig.kind !== 'min') {
                expect(fig.kind, `${label}: ${name} in ${fig.kind}, reader chose ${units}`).toBe(units)
              }
            }
            const partsSum = [wu, main, cd].reduce((a, x) => a + (x.kind === 'min' ? 0 : x.value), 0)
            expect(partsSum, `${label}: distance parts sum ${partsSum} ≠ total ${distanceTotal}`).toBe(distanceTotal)

            // 🔴 THE FALLBACK MAY NOT HIDE A REAL DISTANCE. A minutes header is
            // only legitimate where the apportioned value was 0; if this ever
            // fires, a part with real ground has been rendered as time.
            const parts = [
              structure.warmup.distance_km ?? 0,
              structure.main.distance_km ?? 0,
              structure.race_pace_segment?.distance_km ?? 0,
              structure.cooldown.distance_km ?? 0,
            ]
            const totalForApportion = session.distance_km ?? parts.reduce((a, b) => a + b, 0)
            const [awu, aeasy, arace, acd] = apportionRoundedDistance(parts, totalForApportion, units)
            const apportioned = { 'warm-up': awu, 'main-set': aeasy + arace, 'cool-down': acd }
            for (const [name, fig] of [['warm-up', wu], ['main-set', main], ['cool-down', cd]] as const) {
              if (fig.kind === 'min') {
                expect(apportioned[name], `${label}: ${name} shows minutes but apportioned to ${apportioned[name]} ${units}`).toBe(0)
              }
            }
          }
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
describe('UNITS-SUBUNIT-01 — no figure on the card may say the runner covers zero', () => {
  const cases = collectCases()

  // 🔴 THE DEFECT: a 0.71 km cool-down is 0.44 of a mile. Rounded to a whole
  // unit it printed `~0mi`, which asserts NO GROUND COVERED. Measured before
  // the fix, across 48,547 sessions: **39.7% of sessions in miles** and **3.7%
  // in km** carried a `~0` part, cool-down in every one of the 19,275 affected
  // mile sessions, real distances 0.25-1.27 km (median 0.71).
  //
  // ⚠️ THE FILING RCA WAS WRONG TWICE and both were corrected by measuring:
  // it said "never happens in km" (it does) and blamed `formatDistance` (which
  // fires ZERO times on session distances). `apportionRoundedDistance` is the
  // only live mechanism.
  //
  // ⚠️ KM IS TESTED, NOT JUST MILES. The obvious version of this test would
  // have run on miles alone — that is where the founder saw it and where 91%
  // of it lives — and would have been green on the 1,805 km sessions that have
  // the same defect. A unit-specific bug is still a bug in the other unit.
  for (const units of ['km', 'mi'] as const) {
    for (const metric of ['distance', 'duration'] as const) {
      it(`no section or row figure reads zero (${metric}, ${units})`, () => {
        const offenders: string[] = []
        for (const { session, structure, label } of cases) {
          const f = resolveDisplayFigures(structure, { metric, units, sessionDistanceKm: session.distance_km ?? null })
          for (const [name, v] of Object.entries(f)) {
            if (v == null) continue
            // `~0km`, `~0mi`, `0 min` — every shape of "nothing happens here".
            if (/(^|\s)~?0\s*(km|mi|min)\b/.test(v)) offenders.push(`${label} ${name}="${v}"`)
          }
        }
        expect(offenders.slice(0, 10), `${offenders.length} zero figures`).toEqual([])
      })
    }
  }

  it('the sub-unit fallback actually FIRES — the sample reaches the case', () => {
    // ⚠️ A guard that never sees its own case is green for the wrong reason.
    // This repo's record: 86 of 93 invariants never fired, and silence could
    // not tell a working rule from a dead one. So assert the case is REACHED.
    let minutesFallbacks = 0
    for (const { session, structure } of cases) {
      const f = resolveDisplayFigures(structure, { metric: 'distance', units: 'mi', sessionDistanceKm: session.distance_km ?? null })
      if (session.distance_km != null && / min$/.test(f.cooldown)) minutesFallbacks++
    }
    expect(minutesFallbacks, 'no distance-anchored session hit the sub-unit fallback — the sample cannot see the defect this guards').toBeGreaterThan(20)
  })
})

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
