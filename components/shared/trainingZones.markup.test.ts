import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup as html } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import {
  TrainingZonesScreen, type ZoneRow,
  ZONES_TAB_HR, ZONES_TAB_PACE, CEILING_LABEL_HR, CEILING_LABEL_PACE, TAB_MIN_HEIGHT_PX,
} from './TrainingZonesScreen'
import { buildPaceFromVDOT, bandCeiling } from '@/lib/plan/paceBands'
import { HR_PROVENANCE_PREFIX, PROVENANCE_MIN_HEIGHT_PX } from './TrainingZonesScreen'

// ZONES-SURFACE-01 (Design Board) + ZONES-BEGINNER-BANDS-01 (Coaching Board), 2026-09-28.
//
// 🔴 THE FOUR RULINGS THIS FILE HOLDS SHUT, each of which is invisible in review:
//   1. The ceiling is the FAST end of the easy band. Backwards, it reads "run harder".
//   2. A null band renders NO ROW AND NO SENTENCE (the beginner case).
//   3. Never an empty tab, and no toggle at all when only one side has data.
//   4. Z3 is the GREY ZONE. The competitor calls it "Tempo".

const ZONES: ZoneRow[] = [
  { zone: 1, name: 'Recovery',  desc: 'a', colour: 'var(--session-recovery)', minHR: 100, maxHR: 124 },
  { zone: 2, name: 'Aerobic',   desc: 'b', colour: 'var(--session-easy)',     minHR: 125, maxHR: 145 },
  { zone: 3, name: 'Grey zone', desc: 'c', colour: 'var(--session-quality)',  minHR: 146, maxHR: 160 },
]

// A real guide from the real producer — never a hand-built fixture, because the thing
// under test is how the SCREEN reads what the ENGINE made.
const PACE = buildPaceFromVDOT(44, 46)
const BEGINNER = { ...PACE, marathonPaceStr: null, hmPaceStr: null, minPerKmMarathon: null, minPerKmHM: null }

const screen = (p: Partial<React.ComponentProps<typeof TrainingZonesScreen>> = {}) =>
  html(React.createElement(TrainingZonesScreen, { zones: ZONES, pace: PACE, units: 'km', ...p }))

describe('ZONES-SURFACE-01 — the ceiling leads, in whichever unit exists', () => {
  it('defaults to heart rate and leads with the Z2 ceiling', () => {
    const m = screen()
    expect(m).toContain(CEILING_LABEL_HR)
    expect(m).toContain('145')          // Z2 max
    expect(m).toContain('bpm')
  })

  // 🔴 THE ARM THAT MATTERS MOST. "Not faster than" is the FAST end, which is the SMALLER
  // number: a band of 6:00–7:15 permits 6:00 to 7:15 and forbids 5:50. Taking the slow end
  // would invert the product's entire proposition into "run harder".
  it('the pace ceiling is the FAST end of the easy band', () => {
    const m = screen({ zones: null })
    expect(m).toContain(CEILING_LABEL_PACE)
    const fast = bandCeiling(PACE.easyPaceStr)
    expect(fast, 'the producer\'s own band could not be read').toBeTruthy()
    expect(m).toContain(fast!)
    // and the slow end must NOT be the headline number
    const slow = PACE.easyPaceStr.split('–')[1]?.trim().split(' ')[0]
    expect(slow).toBeTruthy()
    expect(slow).not.toBe(fast)
  })

  // ⚠️ HR is NOT a fallback. Measured across all 21 stored plans: meta.vdot present on 10,
  // absent on 11. Treating HR as the degraded case would degrade the majority.
  it('HR alone is a complete screen, not a degraded one', () => {
    const m = screen({ pace: null })
    expect(m).toContain(CEILING_LABEL_HR)
    expect(m).not.toContain(ZONES_TAB_PACE)
  })
})

describe('ZONES-SURFACE-01 — the toggle', () => {
  it('offers both tabs only when both have data', () => {
    const m = screen()
    expect(m).toContain(ZONES_TAB_HR)
    expect(m).toContain(ZONES_TAB_PACE)
  })

  it('renders NO toggle when only one side has data', () => {
    // A two-option control with one option is noise, and a tab full of estimates is
    // worse than no tab (Wroblewski, blocking).
    expect(screen({ pace: null })).not.toContain(ZONES_TAB_PACE)
    expect(screen({ zones: null })).not.toContain(ZONES_TAB_HR)
  })

  it('says something calm when neither side has data', () => {
    const m = screen({ zones: null, pace: null })
    expect(m).not.toContain(CEILING_LABEL_HR)
    expect(m).toMatch(/heart rate or a benchmark/i)
  })

  // ⚠️ THE GATE CANNOT SEE THESE CONTROLS. `buttonGeometry.test.ts` measures `Button`
  // COMPONENTS; the tabs are hand-rolled `<button>`s, so they sit outside its population
  // entirely — the blind spot that shipped 18 hand-rolled controls under the floor on
  // 2026-09-25, the smallest at 18px. 9px padding around 14px text is ~35px.
  it('the hand-rolled tabs clear the 44pt floor', () => {
    expect(TAB_MIN_HEIGHT_PX).toBeGreaterThanOrEqual(44)
    expect(screen()).toContain(`min-height:${TAB_MIN_HEIGHT_PX}px`)
  })
})

describe('ZONES-INPUTS-01 — provenance, not a form', () => {
  // 🔴 THE SCREEN CLAIMED "personalised from your HR data" AND NEVER SHOWED THE DATA.
  // The founder asked whether the HR inputs belong on Me. They do — set-once value, and
  // the card carries the Apple Health prefill, which is a CONNECTION action. What was
  // missing was the two numbers, which is what makes the table auditable: Sierra, a runner
  // who sees them learns their zones come from two values and that one wrong value makes
  // the whole table wrong.
  it('shows the source values on the HR tab', () => {
    const m = screen({ sourceHr: { resting: 51, max: 185 }, onEditHr: () => {} })
    expect(m).toContain(HR_PROVENANCE_PREFIX)
    expect(m).toContain('51')
    expect(m).toContain('185')
  })

  // ⚠️ THE ARM THAT KEEPS THE RULING. The board refused to move the FORM: a once-ever
  // input on a weekly-read screen is density, not disclosure (Silvanto), and moving it
  // would relocate taps rather than reduce them (Wroblewski). If someone later "improves"
  // this by making it editable in place, this fails.
  it('renders NO input — the form stays on Me', () => {
    const m = screen({ sourceHr: { resting: 51, max: 185 }, onEditHr: () => {} })
    expect(m).not.toMatch(/<input/)
  })

  it('is a control, and looks like one', () => {
    const m = screen({ sourceHr: { resting: 51, max: 185 }, onEditHr: () => {} })
    expect(m).toMatch(/<svg/)  // CHEVRON-OWNER-01
    expect(m).toContain(`min-height:${PROVENANCE_MIN_HEIGHT_PX}px`)
  })

  it('is absent on the Pace tab and when the values are unknown', () => {
    expect(screen({ zones: null, sourceHr: { resting: 51, max: 185 }, onEditHr: () => {} }))
      .not.toContain(HR_PROVENANCE_PREFIX)
    expect(screen({ sourceHr: null })).not.toContain(HR_PROVENANCE_PREFIX)
  })
})

describe('ZONES-BEGINNER-BANDS-01 — four bands, and no apology', () => {
  it('a beginner sees no marathon or half row AND no sentence about them', () => {
    const m = screen({ zones: null, pace: BEGINNER })
    expect(m).not.toContain('Marathon')
    expect(m).not.toContain('Half')
    // 🔴 The ruling is silence. Every candidate sentence fails: stating the pace is a soft
    // prescription they will act on, "not earned yet" is a judgement, and "not part of
    // your plan" invites the question it answers.
    expect(m).not.toMatch(/earn|not yet|unlock|once you/i)
  })

  it('the bands a beginner DOES have are all present', () => {
    const m = screen({ zones: null, pace: BEGINNER })
    for (const n of ['Easy', 'Threshold', 'Interval']) expect(m).toContain(n)
  })
})

describe('ZONES-SURFACE-01 — the labels are ours', () => {
  // 🔴 The competitor screen that prompted this calls Z3 "Tempo": a zone you aim for.
  // CoachingPrinciples §1 is titled "Polarised training — protection from grey zone".
  it('Z3 is the grey zone, on the screen and in ZONE_DEFS', () => {
    expect(screen()).toContain('Grey zone')
    // 🔴 `ZONE_DEFS` moved to `components/dashboard/dashboardHelpers.ts`
    // (DASHBOARD-SCREEN-EXTRACT-02). Reading only DashboardClient here would have
    // found no ZONE_DEFS at all and asserted nothing, for ever.
    const defs = readFileSync('components/dashboard/dashboardHelpers.ts', 'utf8')
    const line = defs.split('\n').find(l => l.includes('zone: 3,') && l.includes('pctMin: 70'))
    expect(line, 'ZONE_DEFS zone 3 not found — re-anchor this arm').toBeTruthy()
    expect(line!).toContain('Grey zone')
    expect(line!, 'the competitor\'s label must not come back').not.toMatch(/'Tempo'/)
  })

  it('no pace row is labelled with a zone the engine does not prescribe', () => {
    const m = screen({ zones: null })
    expect(m).not.toMatch(/\bTempo\b/)
  })
})
