import { describe, it, expect } from 'vitest'
import { formatClockTime, formatClockTimeCoarse } from './format'

// RACE-PROJ-PRECISION-01 — the precision of a race projection follows its
// evidence (SLT 2026-09-17).
//
// FOUNDER-REPORTED. The Coach screen showed "Marathon 3:54:16" to a runner with
// no benchmark and no run history. Traced: with neither, the route falls to a
// 3x4 lookup table (`bracketVdot`) indexed on two wizard answers, one of which
// is OPTIONAL and defaults to the middle bracket when declined. All four of the
// founder's figures reproduced exactly from `intermediate x 6-18mo`.
//
// MEASURED ON THE LIVE DATABASE: 11 of 19 plans (58%) carry no benchmark, so
// this was the MAJORITY path. `confidence` drove only the colour of a chip.
//
// ⚠️ SIXTEEN SECONDS OF PRECISION IS A CLAIM. A runner reads it as a
// measurement whatever the grey "LOW" pill beside it says, and two runners --
// one who answered the training-age question and one who declined it -- were
// shown identical figures to the second.
describe('RACE-PROJ-PRECISION-01 — a lookup table cannot support seconds', () => {
  // The founder's own numbers: VDOT 39.9 via intermediate x 6-18mo.
  const FOUNDER = { fiveK: 1426, tenK: 2949, hm: 6692, marathon: 14056 }

  it('renders the founder\'s four figures without seconds', () => {
    expect(formatClockTimeCoarse(FOUNDER.fiveK)).toBe('24 min')
    expect(formatClockTimeCoarse(FOUNDER.tenK)).toBe('49 min')
    expect(formatClockTimeCoarse(FOUNDER.hm)).toBe('1:52')
    expect(formatClockTimeCoarse(FOUNDER.marathon)).toBe('3:54')
  })

  it('is exactly what shipped before, minus the false precision', () => {
    // The precise forms are what the runner actually saw. Kept here so the
    // regression is legible rather than described.
    expect(formatClockTime(FOUNDER.marathon)).toBe('3:54:16')
    expect(formatClockTimeCoarse(FOUNDER.marathon)).toBe('3:54')
  })

  it('never emits a seconds field, at any duration', () => {
    for (let secs = 60; secs < 6 * 3600; secs += 37) {
      const out = formatClockTimeCoarse(secs)!
      // "1:52" is h:mm. "3:54:16" would be h:mm:ss -- two colons, never valid.
      expect(out.split(':').length, `${secs}s -> ${out}`).toBeLessThanOrEqual(2)
    }
  })

  it('under an hour it says "min" rather than mm:00, which re-implies precision', () => {
    expect(formatClockTimeCoarse(1426)).toBe('24 min')
    expect(formatClockTimeCoarse(1426)).not.toContain(':')
  })

  it('a BENCHMARK-derived projection keeps its seconds -- it earned them', () => {
    // States 1-3 are untouched. Only the wizard bracket goes coarse.
    expect(formatClockTime(FOUNDER.marathon)).toContain(':')
    expect(formatClockTime(FOUNDER.marathon)!.split(':').length).toBe(3)
  })

  it('handles the nulls the same way its precise sibling does', () => {
    for (const bad of [null, undefined, NaN, -1]) {
      expect(formatClockTimeCoarse(bad as number)).toBeNull()
    }
  })
})
