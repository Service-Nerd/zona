import { describe, it, expect } from 'vitest'
import { zoneWeekStatement, classifyRun, type RunZoneOutcome } from './zoneWeekStatement'
import { ZONE_BLOCK_VERDICT_MIN_RUNS, ZONE_DRIFT_ABOVE_CEILING_PCT } from './constants'

/**
 * P-04 — the weekly zone-compliance statement.
 *
 * "This week — 3 of 4 runs held the zone. One drifted." The brand thesis as a
 * sentence, and it will be reused everywhere the zone is scored, which is why
 * the derivation is a module and not markup.
 *
 * SLT 2026-09-20 fixed the pattern: count not percentage, plain verb, name the
 * exception. Coaching Board 2026-09-20 ruled the two questions routed down.
 */
const runs = (held: number, drifted: number, unknown: number): RunZoneOutcome[] => [
  ...Array<RunZoneOutcome>(held).fill('held'),
  ...Array<RunZoneOutcome>(drifted).fill('drifted'),
  ...Array<RunZoneOutcome>(unknown).fill('unknown'),
]

describe('P-04 — classifying one run', () => {
  it('a missing measurement is UNKNOWN, never a failure', () => {
    // The whole of question 2 rests on this. Reading "no heart rate" as
    // "did not hold" is how "None of 4 held the zone" becomes a false
    // statement, and it is the one a free-tier runner would see most.
    expect(classifyRun(null)).toBe('unknown')
    expect(classifyRun(undefined)).toBe('unknown')
    expect(classifyRun(NaN)).toBe('unknown')
  })

  it('drift is measured ABOVE THE CEILING, directionally', () => {
    expect(classifyRun(ZONE_DRIFT_ABOVE_CEILING_PCT + 1)).toBe('drifted')
    expect(classifyRun(ZONE_DRIFT_ABOVE_CEILING_PCT)).toBe('held')
    expect(classifyRun(0)).toBe('held')
  })
})

describe('P-04 — the statement never hides', () => {
  it('an all-unknown week says so rather than rendering nothing', () => {
    // Board ruling: not silent. A blank space where the thesis should be
    // teaches the runner the app has nothing to say, and this is the most
    // common week for anyone without a chest strap.
    const s = zoneWeekStatement(runs(0, 0, 3))
    expect(s.line).toBeTruthy()
    expect(s.line).toContain('No heart rate')
    expect(s.tone).toBeNull()
  })

  it('a week with no runs at all still says something', () => {
    expect(zoneWeekStatement(runs(0, 0, 0)).line).toBe('No runs logged this week yet.')
  })

  it('below the threshold it reports the COUNT and passes no verdict', () => {
    // The board separated the two claims: stating what happened on two runs
    // is not a pattern claim, and a minimum of three would have hidden the
    // block on 57.1% of measured runner-weeks.
    const s = zoneWeekStatement(runs(2, 0, 0))
    expect(s.verdict).toBe(false)
    expect(s.line).toBe('Both runs held the zone.')
  })

  it('at the threshold it names the exception', () => {
    const s = zoneWeekStatement(runs(3, 1, 0))
    expect(s.verdict).toBe(true)
    expect(s.line).toBe('3 of 4 runs held the zone. One drifted.')
  })
})

describe('P-04 — unknown runs leave the denominator and the gap is named', () => {
  it('the denominator is runs we MEASURED, not runs completed', () => {
    // "2 of 4" when two had no HR is false. The board ruled the denominator
    // is what we measured, and the gap is stated separately.
    const s = zoneWeekStatement(runs(2, 0, 2))
    expect(s.measured).toBe(2)
    expect(s.line).not.toContain('of 4')
    expect(s.gapLine).toBe('Two runs had no heart rate.')
  })

  it('names one missing run in the singular', () => {
    expect(zoneWeekStatement(runs(2, 1, 1)).gapLine).toBe('One run had no heart rate.')
  })

  it('says nothing about a gap when there is none', () => {
    expect(zoneWeekStatement(runs(3, 1, 0)).gapLine).toBeNull()
  })
})

describe('P-04 — the zero case, which is the sentence a struggling runner reads', () => {
  it('⚠️ NEVER claims runs held when none did', () => {
    // THE BUG THIS PINS, caught before it shipped: the leading slot
    // interpolated `word(measured)`, so four drifted runs read "Four of this
    // week's runs stayed in the zone" — the exact opposite of the truth, in
    // the one sentence that most needs to be true.
    const s = zoneWeekStatement(runs(0, 4, 0))
    expect(s.line.startsWith('None of')).toBe(true)
    expect(s.line).not.toMatch(/^(One|Two|Three|Four|Five|Six|Seven|\d)/)
    expect(s.line).toContain('4 runs')
  })

  it('narrows the window to the runs and points at the next one', () => {
    // Wood: the failure of "none held the zone this week" is not that it is
    // harsh, it is that it is GLOBAL and reads as a verdict on the runner.
    const s = zoneWeekStatement(runs(0, 4, 0))
    expect(s.line).toContain('next easy one')
  })

  it('carries NO cause and NO action, because we hold neither', () => {
    // Hard rule 8. We have `hr_above_ceiling_pct` and nothing else, so a
    // limiter sentence is a diagnosis this data cannot support; and the plan
    // does not change for one week's drift, so an action manufactures work.
    for (const n of [1, 2, 3, 4, 5]) {
      const line = zoneWeekStatement(runs(0, n, 0)).line
      expect(line).not.toMatch(/because|aerobic base|so your|means you/i)
      expect(line).not.toMatch(/slow down|ease off|take a|you should/i)
    }
  })
})

describe('P-04 — the pattern the SLT fixed', () => {
  it('is a COUNT, never a percentage', () => {
    for (const [h, d, u] of [[3, 1, 0], [4, 0, 0], [0, 4, 0], [2, 0, 2], [1, 3, 0], [5, 2, 0]]) {
      const s = zoneWeekStatement(runs(h, d, u))
      expect(s.line, `${h}/${d}/${u}`).not.toMatch(/%|percent|compliance/i)
      if (s.gapLine) expect(s.gapLine).not.toMatch(/%|percent/i)
    }
  })

  it('every sentence is capitalised and no word is left lowercase mid-copy', () => {
    // ⚠️ PINS A SECOND SHIPPED-IN-DRAFT BUG. The capitaliser was
    // `.replace(/^n/, 'N')`, which only ever uppercased "none" — so real
    // output read "two runs had no heart rate." and "2 of 4 runs held the
    // zone. two drifted."
    for (const [h, d, u] of [[2, 2, 0], [2, 0, 2], [1, 3, 0], [0, 0, 2], [5, 2, 0]]) {
      const s = zoneWeekStatement(runs(h, d, u))
      for (const part of [s.line, s.gapLine].filter(Boolean) as string[]) {
        for (const sentence of part.split('. ').filter(Boolean)) {
          expect(sentence[0], `"${part}"`).toBe(sentence[0].toUpperCase())
        }
      }
    }
  })

  it('uses no em dash anywhere (BRAND-EMDASH-01)', () => {
    for (const [h, d, u] of [[3, 1, 0], [0, 4, 0], [4, 0, 0], [2, 0, 2], [0, 0, 3], [0, 0, 0]]) {
      const s = zoneWeekStatement(runs(h, d, u))
      expect(`${s.line} ${s.gapLine ?? ''}`).not.toContain('—')
    }
  })

  it('tone drives P-01s pair and is null when there is nothing to colour', () => {
    expect(zoneWeekStatement(runs(4, 0, 0)).tone).toBe('held')
    expect(zoneWeekStatement(runs(3, 1, 0)).tone).toBe('drifted')
    expect(zoneWeekStatement(runs(0, 0, 3)).tone).toBeNull()
  })

  it('the threshold comes from config, not a literal', () => {
    const below = zoneWeekStatement(runs(ZONE_BLOCK_VERDICT_MIN_RUNS - 1, 0, 0))
    const at    = zoneWeekStatement(runs(ZONE_BLOCK_VERDICT_MIN_RUNS, 0, 0))
    expect(below.verdict).toBe(false)
    expect(at.verdict).toBe(true)
  })
})
