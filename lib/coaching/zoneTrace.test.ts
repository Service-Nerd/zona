import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { readTrace, smoothTrace, thinTrace, traceFromSamples, traceSentence, TRACE_MIN_SAMPLES, type TracePoint } from './zoneTrace'
import { ZONE_DRIFT_ABOVE_CEILING_PCT, ZONE_HELD_MAX_ABOVE_CEILING_PCT, TRACE_SUSTAINED_ABOVE_S } from './constants'

/**
 * 🔴 §12 Amendment 3 (Coaching Board 2026-10-21) — the Zone Trace's sentence. One selector, the board's table, the two
 * ratified thresholds reused rather than copied, and no sentence that names a cause.
 */
const band = { lo: 131, hi: 145 }
/** A run sampled every 5 s: `segments` of [minutes, bpm]. */
function run(...segments: [number, number][]): TracePoint[] {
  const out: TracePoint[] = []
  let t = 0
  for (const [min, bpm] of segments) for (let s = 0; s < min * 60; s += 5) { out.push([t, bpm]); t += 5 }
  return out
}
const say = (pts: TracePoint[], ceilingOnly = true, analysis?: number | null) => traceSentence(readTrace(pts, band, ceilingOnly), ceilingOnly, analysis)

describe('the board\'s table', () => {
  it('praise only at or under the §12 Am.2 ceiling (10%)', () => {
    expect(say(run([50, 138]))).toBe('You held the zone.')
    expect(say(run([46, 138], [4, 150]))).toBe('You held the zone.')
    expect(say(run([50, 138]), true, ZONE_HELD_MAX_ABOVE_CEILING_PCT)).toBe('You held the zone.') // exactly 10
  })
  it('between 10 and 20 states the minutes and judges nothing', () => {
    expect(say(run([44, 138], [6, 150]))).toBe('Over your ceiling for 6 of 50 minutes.')
    expect(say(run([50, 138]), true, ZONE_DRIFT_ABOVE_CEILING_PCT)).toBe('Over your ceiling for 10 of 50 minutes.') // exactly 20
    expect(say(run([50, 138]), true, ZONE_DRIFT_ABOVE_CEILING_PCT + 0.1)).toMatch(/^Above your ceiling/)
  })
  it('🔴 a late, sustained drift after a held start gets the late line, with the minutes it was held', () => {
    expect(say(run([40, 138], [20, 152]))).toBe('You held it for 40 minutes, then it got away from you.')
  })
  it('an early drift gets the plain line; the easy-day clause only on a ceiling-only run', () => {
    expect(say(run([5, 138], [30, 152], [15, 138]))).toBe('Above your ceiling for 30 of 50 minutes. Easy days need to feel easy.')
    expect(say(run([5, 138], [30, 152], [15, 138]), false)).toBe('Above your ceiling for 30 of 50 minutes.')
  })
  it('🔴 a hill is not a drift: excursions shorter than the sustained rule never set the onset', () => {
    const hills = run(...Array.from({ length: 8 }, () => [[4, 138], [2.5, 152]] as [number, number][]).flat())
    const r = readTrace(hills, band, true)
    expect(r.onsetS).toBeNull()
    expect(TRACE_SUSTAINED_ABOVE_S).toBeGreaterThan(150)
  })
})

describe('one owner of the share', () => {
  it('🔴 with an analysis, the analysis decides, and the minutes follow it', () => {
    const held = run([50, 138])
    expect(say(held, true, 25)).toBe('Above your ceiling for 13 of 50 minutes. Easy days need to feel easy.')
    expect(say(held, true, 15)).toBe('Over your ceiling for 8 of 50 minutes.')
  })
  it('agrees with zoneVerdict at its threshold (held at ≤20 is not praise above 10)', () => {
    expect(say(run([50, 138]), true, ZONE_DRIFT_ABOVE_CEILING_PCT)).toMatch(/^Over your ceiling/)
    expect(say(run([50, 138]), true, ZONE_HELD_MAX_ABOVE_CEILING_PCT)).toBe('You held the zone.')
  })
  it('🔴 the thresholds are imported, never retyped in the owner', () => {
    const src = readFileSync('lib/coaching/zoneTrace.ts', 'utf8').replace(/\/\/.*$/gm, '')
    expect(src).not.toMatch(/abovePct <= (10|20)\b/)
    expect(src).toMatch(/\bZONE_HELD_MAX_ABOVE_CEILING_PCT\b/)
    expect(src).toMatch(/\bZONE_DRIFT_ABOVE_CEILING_PCT\b/)
  })
})

describe('§12: an easy run is a ceiling, not a band', () => {
  it('under the floor counts as in zone for a ceiling-only run, not for quality', () => {
    const low = run([50, 120])
    expect(readTrace(low, band, true).inZonePct).toBeCloseTo(100, 0)
    expect(readTrace(low, band, false).inZonePct).toBeCloseTo(0, 0)
  })
})

describe('words', () => {
  it('🔴 no sentence names a cause (P-04)', () => {
    const all = [run([50, 138]), run([44, 138], [6, 150]), run([40, 138], [20, 152]), run([5, 138], [45, 152])]
      .flatMap(r => [say(r, true), say(r, false)])
    for (const s of all) expect(s).not.toMatch(/too hard|pushed|too fast|ran hard|lazy|fail/i)
    for (const s of all) expect(s).not.toContain('—')
  })
})

describe('input', () => {
  it('needs TRACE_MIN_SAMPLES valid samples, sorted', () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ valueBpm: 130, timestamp: new Date(Date.UTC(2026, 9, 21, 7, 0, (n - i) * 5)).toISOString() }))
    expect(traceFromSamples(mk(TRACE_MIN_SAMPLES - 1))).toBeNull()
    const pts = traceFromSamples(mk(TRACE_MIN_SAMPLES))!
    expect(pts[0][0]).toBe(0)
    expect(pts.every((p, i) => i === 0 || p[0] >= pts[i - 1][0])).toBe(true)
    expect(traceFromSamples(null)).toBeNull()
    expect(traceFromSamples([{ valueBpm: 0, timestamp: 'x' }])).toBeNull()
  })
  it('smoothing flattens a single spike; thinning keeps the ends', () => {
    const spike = run([10, 138]); spike[60][1] = 200
    expect(Math.max(...smoothTrace(spike).map(p => p[1]))).toBeLessThan(160)
    const long = run([120, 138]); const thin = thinTrace(long)
    expect(thin.length).toBeLessThanOrEqual(301)
    expect(thin[thin.length - 1]).toEqual(long[long.length - 1])
  })
})
