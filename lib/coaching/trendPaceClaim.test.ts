import { describe, it, expect } from 'vitest'
import { paceContext, trendSentence } from './trendSentence'
import { TREND_PACE_CONFOUND_SEC_PER_KM } from './constants'

// TREND-PACE-CLAIM-01. The cohort matches on DISTANCE only, so a runner who
// simply eased off was being told their aerobic base was growing. The failure
// is not random: a runner complying with Zonna is slowing down, so the people
// most likely to be told something false are the ones it is working for.

const T = TREND_PACE_CONFOUND_SEC_PER_KM
const base = { earlierMonth: 'Apr' }

describe('paceContext', () => {
  it('confirms when pace barely moved', () => {
    expect(paceContext({ ...base, earlierHr: 152, nowHr: 144, earlierPace: 390, nowPace: 391 })).toBe('confirms')
  })

  it('CONFOUNDS when HR fell and pace slowed materially', () => {
    expect(paceContext({ ...base, earlierHr: 152, nowHr: 144, earlierPace: 390, nowPace: 390 + T })).toBe('confounds')
  })

  it('CONFOUNDS when HR rose and pace quickened materially', () => {
    expect(paceContext({ ...base, earlierHr: 144, nowHr: 152, earlierPace: 390, nowPace: 390 - T })).toBe('confounds')
  })

  it('a big move in the SUPPORTING direction confirms, it does not confound', () => {
    // Lower HR AND faster: unambiguous. Math.abs on the delta would have
    // wrongly killed this claim — the TREND-DIRECTION-01 defect, again.
    expect(paceContext({ ...base, earlierHr: 152, nowHr: 144, earlierPace: 390, nowPace: 390 - 60 })).toBe('confirms')
    // Higher HR AND slower: also unambiguous, and genuinely bad news.
    expect(paceContext({ ...base, earlierHr: 144, nowHr: 152, earlierPace: 390, nowPace: 390 + 60 })).toBe('confirms')
  })

  it('is exclusive at the threshold — one below confirms, exactly on confounds', () => {
    expect(paceContext({ ...base, earlierHr: 152, nowHr: 144, earlierPace: 390, nowPace: 390 + T - 1 })).toBe('confirms')
    expect(paceContext({ ...base, earlierHr: 152, nowHr: 144, earlierPace: 390, nowPace: 390 + T })).toBe('confounds')
  })

  it.each([
    ['absent', undefined, undefined],
    ['null', null, null],
    ['zero', 0, 390],
    ['NaN', NaN, 390],
  ])('reports unknown for %s pace rather than guessing', (_n, a, b) => {
    expect(paceContext({ ...base, earlierHr: 152, nowHr: 144, earlierPace: a as number, nowPace: b as number })).toBe('unknown')
  })

  it('the threshold is well clear of the measured noise floor', () => {
    // Production, 2026-09-12, aerobic runs in a ±15% distance band: within-month
    // SD 40.2 s/km, mean month-to-month shift 21.9 s/km. TREND_SERIES's 5 s/km
    // is an eighth of the SD and would fire on ordinary variation.
    expect(T).toBeGreaterThan(5)
  })
})

describe('trendSentence — the claim is withheld, not the sentence', () => {
  it('claims improvement when pace held', () => {
    const s = trendSentence({ ...base, earlierHr: 152, nowHr: 144, earlierPace: 390, nowPace: 392 })
    expect(s).toContain('Easy is easier than it was')
  })

  it('DOES NOT claim fitness when the runner just slowed down', () => {
    const s = trendSentence({ ...base, earlierHr: 152, nowHr: 144, earlierPace: 390, nowPace: 430 })
    expect(s).not.toContain('easier than it was')
    expect(s).toContain('easier running rather than fitter running')
    // Both facts still reach the runner. Withheld claim, not withheld data.
    expect(s).toContain('152')
    expect(s).toContain('144')
    expect(s).toContain('Apr')
  })

  it('does not scold when a higher HR bought more speed', () => {
    const s = trendSentence({ ...base, earlierHr: 144, nowHr: 152, earlierPace: 400, nowPace: 360 })
    expect(s).not.toContain('costing you more')
    expect(s).toContain('The cost bought something')
  })

  it('BACK-COMPAT — with no pace, behaviour is exactly what it was', () => {
    expect(trendSentence({ ...base, earlierHr: 152, nowHr: 144 }))
      .toBe('Easy is easier than it was — 152 down to 144 since Apr.')
    expect(trendSentence({ ...base, earlierHr: 144, nowHr: 152 }))
      .toBe('Easy is costing you more than it did — 144 up to 152 since Apr. That is common mid-build, and worth watching if it holds.')
  })

  it('never says "at the same pace" — the cohort does not control for it', () => {
    const cases = [
      { earlierHr: 152, nowHr: 144, earlierPace: 390, nowPace: 430 },
      { earlierHr: 152, nowHr: 144, earlierPace: 390, nowPace: 391 },
      { earlierHr: 144, nowHr: 152 },
    ]
    for (const c of cases) expect(trendSentence({ ...base, ...c })).not.toMatch(/same pace/i)
  })
})
