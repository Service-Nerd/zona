// COACH-KIT-CAUGHT-01 / §133 — what Kit caught, each receipt from the owner that already says the same thing elsewhere.
import { describe, it, expect } from 'vitest'
import { kitReceipts, type KitReceiptInputs } from './kitReceipts'

const NOW = new Date('2026-10-31T19:00:00Z')
const run = (date: string, km: number, z: [number, number, number, number], extra: Record<string, unknown> = {}) => ({
  start_date: date, distance_m: km * 1000, activity_type: 'Run', sport_type: 'Run', strava_activity_id: null,
  apple_health_uuid: `u-${date}`, hr_pct_z1: z[0], hr_pct_z2: z[1], hr_pct_z3: z[2], hr_pct_z4_5: z[3], ...extra,
})
// The founder's last two weeks (production, 2026-10-31): 23 Oct 6 km all easy; 27 Oct 9.5 km 3/10/43/43; 1.65× load.
const FOUNDER = [run('2026-10-23T07:00:00Z', 6, [22.73, 77.27, 0, 0]), run('2026-10-27T07:00:00Z', 9.5, [3.33, 10, 43.33, 43.33])]
const base = (o: Partial<KitReceiptInputs> = {}): KitReceiptInputs => ({
  rows: FOUNDER, now: NOW, units: 'km', ceiling: 145, load: { ratio: 1.65, plannedEasy: false, lowWeeksRunning: 0 }, easiestSpan: null, ...o,
})

describe('kitReceipts', () => {
  it("reproduces the approved mockup from the founder's own runs, misses first", () => {
    expect(kitReceipts(base())).toEqual([
      { tone: 'drifted', lead: '27 Oct, 9.5km:', text: '43% of it in Zone 3 and 43% in Zones 4–5. Your easy ceiling is 145 bpm.' },
      { tone: 'drifted', lead: 'This week:', text: '1.65× your recent normal.' },
      { tone: 'held', lead: '23 Oct, 6km:', text: '100% of it in Zones 1–2.' },
    ])
  })

  it('never pads: no runs and an ordinary week is zero receipts', () => {
    expect(kitReceipts(base({ rows: [], load: { ratio: 1.0, plannedEasy: false, lowWeeksRunning: 0 } }))).toEqual([])
  })

  it('🔴 a linked tempo is never a Zone-3 receipt (the plan asked for Zone 3)', () => {
    const types = new Map([['a:u-2026-10-27T07:00:00Z', 'quality']])
    expect(kitReceipts(base({ plannedTypes: types })).some(r => r.text.includes('Zone 3'))).toBe(false)
  })

  it('🔴 the load receipt fires exactly when the load card is amber', () => {
    const load = (ratio: number, plannedEasy = false, lowWeeksRunning = 0) =>
      kitReceipts(base({ rows: [], load: { ratio, plannedEasy, lowWeeksRunning } })).length
    expect(load(1.3)).toBe(1)             // above normal: amber
    expect(load(1.29)).toBe(0)
    expect(load(0.5, true)).toBe(0)       // lighter, as planned: moss
    expect(load(0.5, false, 1)).toBe(0)   // one week under: neutral
    expect(load(0.5, false, 2)).toBe(1)   // under again: amber
  })

  it('§133: good news needs at least 80% in Zones 1–2 and states the share, never "all"', () => {
    const at = (easy: number) => kitReceipts(base({ rows: [run('2026-10-25T07:00:00Z', 8, [0, easy, 100 - easy, 0])], load: null }))
    expect(at(80)).toEqual([{ tone: 'held', lead: '25 Oct, 8km:', text: '80% of it in Zones 1–2.' }])
    expect(at(79)).toEqual([])
    expect(JSON.stringify(kitReceipts(base()))).not.toMatch(/\ball of it\b|longest/i)
  })

  it('outside the 14-day window is not news', () => {
    expect(kitReceipts(base({ rows: [run('2026-10-10T07:00:00Z', 9, [0, 10, 80, 10])], load: null }))).toEqual([])
  })

  it('the window is inclusive at both edges and not a millisecond wider', () => {
    const edge = NOW.getTime() - 14 * 86_400_000
    const at = (ms: number) => kitReceipts(base({ rows: [run(new Date(ms).toISOString(), 9, [0, 10, 80, 10])], load: null })).length
    expect(at(edge)).toBe(1)
    expect(at(edge - 1)).toBe(0)
    expect(at(NOW.getTime())).toBe(1)
    expect(at(NOW.getTime() + 1)).toBe(0)
  })

  it('names the ceiling only when it is known, and caps the list at three', () => {
    expect(kitReceipts(base({ ceiling: null }))[0].text).toBe('43% of it in Zone 3 and 43% in Zones 4–5.')
    expect(kitReceipts(base({ easiestSpan: 6 }))).toHaveLength(3)
  })

  it('miles runners read miles', () => {
    expect(kitReceipts(base({ units: 'mi' }))[0].lead).toBe('27 Oct, 5.9mi:')
  })
})
