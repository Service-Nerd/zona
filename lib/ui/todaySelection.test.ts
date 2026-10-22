// TODAY-DAY-TAP-01 — tapping a day on Today must stick. The reset used to be keyed on an array rebuilt every render,
// so every tap snapped back to today. vitest runs in `node` (no DOM), so the effect cannot run here: the key is tested
// as a pure function, and the WIRING (that the effect is keyed on it and nothing else) is checked on the bounded
// effect region of TodayScreen, never a grep of the file.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { defaultSelectedKey, selectionResetKey } from './todaySelection'

const week = (n: number) => ({ mon: [{ type: 'easy' }], wed: [{ type: 'quality' }], sat: [{ type: 'easy' }, { type: 'easy' }], sun: [{ type: 'rest' }] })

describe('selectionResetKey — content, never identity', () => {
  it('the same week rebuilt as NEW objects gives the same key (the regression: every render rebuilt them)', () => {
    expect(selectionResetKey(3, true, week(1))).toBe(selectionResetKey(3, true, week(1)))
  })
  it('changes on a new week, on readiness, and when an override moves a session', () => {
    const base = selectionResetKey(3, true, week(1))
    expect(selectionResetKey(4, true, week(1))).not.toBe(base)
    expect(selectionResetKey(3, false, week(1))).not.toBe(base)
    const moved = { ...week(1), mon: [], tue: [{ type: 'easy' }] }
    expect(selectionResetKey(3, true, moved)).not.toBe(base)
  })
  it('does not read completions at all: its only inputs are the week, readiness and the overrides-resolved days', () => {
    expect(selectionResetKey.length).toBe(3)
  })
})

describe('defaultSelectedKey', () => {
  const day = (k: string, d: string, today = false) => ({ displayKey: k, rawDate: new Date(d), today })
  const days = [day('mon', '2026-10-19'), day('tue', '2026-10-20'), day('wed', '2026-10-21'), day('thu', '2026-10-22', true)]
  const types: Record<string, string> = { mon: 'easy', wed: 'quality', thu: 'rest' }
  it('opens on today', () => expect(defaultSelectedKey(days, k => types[k], new Date('2026-10-22'))).toBe('thu'))
  it('else the next day with a real session', () => {
    const noToday = days.map(d => ({ ...d, today: false }))
    expect(defaultSelectedKey(noToday, k => types[k], new Date('2026-10-20'))).toBe('wed')
  })
  it('else the last day that has one, else null', () => {
    const noToday = days.map(d => ({ ...d, today: false }))
    expect(defaultSelectedKey(noToday, k => types[k], new Date('2026-11-01'))).toBe('thu')
    expect(defaultSelectedKey(noToday, () => undefined, new Date('2026-11-01'))).toBeNull()
  })
})

describe('TodayScreen wiring — the reset effect is keyed on selectionResetKey only', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../components/dashboard/TodayScreen.tsx'), 'utf8')
  // Bound the region: the useEffect whose body calls defaultSelectedKey, up to its deps array.
  const start = src.indexOf('useEffect(() => {\n    const d = defaultSelectedKey(')
  const region = start >= 0 ? src.slice(start, src.indexOf('])', start) + 2) : ''
  it('found the effect (an empty region passes everything below)', () => expect(region.length).toBeGreaterThan(40))
  it('its dependency array is exactly [selectionKey]', () => {
    const deps = /\}, \[([^\]]*)\]\)$/.exec(region)?.[1]?.trim()
    expect(deps).toBe('selectionKey')
  })
  it('selectionKey is built by the owner from dayLists, not from sessions or completions', () => {
    expect(src).toMatch(/const selectionKey = selectionResetKey\(weekIndex, overridesReady, dayLists\)/)
  })
})
