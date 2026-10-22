import { describe, it, expect } from 'vitest'
import { buildStepGroups } from './sessionSteps'
import { formatDistance } from '@/lib/format'
import { V1_SESSION_CATALOGUE as SESSION_CATALOGUE } from './sessionCatalogueData'

/**
 * 🔴 REP-UNITS-01 (Design Board 2026-10-22, ui-patterns §21b Am.4b). A step prescribed as a distance reads in the unit
 * it was prescribed in, for every runner. Converted, 300 m and 400 m both printed "0.2mi" and a track 400 read "0.4km".
 */
const metresIn = (): number[] => {
  const out = new Set<number>()
  const walk = (x: unknown) => {
    if (!x || typeof x !== 'object') return
    const o = x as Record<string, unknown>
    if (o.kind === 'distance' && typeof o.m === 'number') out.add(o.m)
    for (const v of Object.values(o)) walk(v)
  }
  walk(SESSION_CATALOGUE)
  return Array.from(out).sort((a, b) => a - b)
}
const expected = (m: number) => (m % 1000 === 0 ? `${m / 1000}km` : `${m}m`)
const rowFor = (m: number, units: 'km' | 'mi', metric: 'distance' | 'duration') =>
  buildStepGroups({ version: 2, blocks: [{ repeat: 1, steps: [
    { role: 'work', modality: 'run', length: m % 1000 === 0 ? `${m / 1000} km` : `${m} m`, pace: '4:30/km', zone: 'Z4' },
  ] }] } as never, { metric, units, formatDist: (km: number) => formatDistance(km, units, { exact: true }) ?? '—' } as never)[0].rows[0]

describe('a prescribed rep distance reads as prescribed, in either unit', () => {
  const ms = metresIn()
  it('the catalogue has distance reps to test (the population is not empty)', () => {
    expect(ms.length).toBeGreaterThanOrEqual(5)
  })
  for (const units of ['km', 'mi'] as const) {
    it(`🔴 ${units} runner, distance mode: every catalogue rep leads with its prescription`, () => {
      for (const m of ms) expect(rowFor(m, units, 'distance').amount, `${m} m`).toBe(expected(m))
    })
    it(`${units} runner, duration mode: the prescription is the secondary, unconverted`, () => {
      for (const m of ms) expect(rowFor(m, units, 'duration').secondary, `${m} m`).toBe(expected(m))
    })
  }
  it('🔴 no two different reps print the same', () => {
    for (const units of ['km', 'mi'] as const) {
      const shown = ms.map(m => rowFor(m, units, 'distance').amount)
      expect(new Set(shown).size, units).toBe(ms.length)
    }
  })
  it('a derived estimate on a duration step still converts to the runner unit', () => {
    const r = buildStepGroups({ version: 2, blocks: [{ repeat: 1, steps: [
      { role: 'work', modality: 'run', length: '5 min', pace: '5:00/km', zone: 'Z3' }] }] } as never,
      { metric: 'distance', units: 'mi', formatDist: (km: number) => formatDistance(km, 'mi', { exact: true }) ?? '—' } as never)[0].rows[0]
    expect(r.amount).toMatch(/mi$/)
  })
})
