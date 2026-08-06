import { describe, it, expect } from 'vitest'
import { easyPaceAsCeiling } from './easyPaceCeiling'

describe('easyPaceAsCeiling (CD-11)', () => {
  it('converts an easy pace band to a ceiling ("or slower")', () => {
    expect(easyPaceAsCeiling('7:11–8:32 /km', 'easy')).toBe('7:11 /km or slower')
  })

  it('uses the FAST end (smaller min/km) as the cap', () => {
    // 7:11 is faster than 8:32 — the cap is the fast end.
    expect(easyPaceAsCeiling('7:11–8:32 /km', 'recovery')).toBe('7:11 /km or slower')
  })

  it('handles a hyphen as well as an en-dash', () => {
    expect(easyPaceAsCeiling('7:11-8:32 /km', 'easy')).toBe('7:11 /km or slower')
  })

  it('leaves quality / long / race bands untouched — the range IS the target there', () => {
    expect(easyPaceAsCeiling('6:16–6:34 /km', 'quality')).toBe('6:16–6:34 /km')
    expect(easyPaceAsCeiling('5:40–5:55 /km', 'long')).toBe('5:40–5:55 /km')
    expect(easyPaceAsCeiling('4:50–5:00 /km', 'race')).toBe('4:50–5:00 /km')
  })

  it('leaves a single value or placeholder untouched', () => {
    expect(easyPaceAsCeiling('—', 'easy')).toBe('—')
    expect(easyPaceAsCeiling('7:30 /km', 'easy')).toBe('7:30 /km')
  })

  it('passes null/undefined through', () => {
    expect(easyPaceAsCeiling(null, 'easy')).toBe(null)
    expect(easyPaceAsCeiling(undefined, 'easy')).toBe(undefined)
  })

  it('preserves the /mi unit', () => {
    expect(easyPaceAsCeiling('11:34–13:44 /mi', 'easy')).toBe('11:34 /mi or slower')
  })
})
