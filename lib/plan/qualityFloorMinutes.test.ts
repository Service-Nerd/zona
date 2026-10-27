// S9-QUALITY-MINUTES-01 (§9 Amendment, Coaching Board 2026-10-27). A quality session meets §9's floor at 5 km OR 35
// minutes. Before it, a slow runner's sessions failed the km floor both ways: 204 under 5 km on the slow-goal grid
// (every one 39–50 minutes long), and reps grown to reach 5 km pushed VO2max work to 26 minutes against an 18-minute cap.
import { describe, it, expect } from 'vitest'
import { runEngine } from './engine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import { meetsQualityFloor } from './sessionFormat'
import { slowGoalDates, slowGoalGrid } from './slowGoalGrid'
import type { GeneratorInput, Plan } from '@/types/plan'

const { planStart, benchmarkDate } = slowGoalDates()
// The runway is 1–7 days by weekday; pin it (see weekdayOverrunNote.test.ts).
const today = new Date(Date.parse(`${planStart}T00:00:00Z`) - 7 * 864e5).toISOString().slice(0, 10)
const build = (input: GeneratorInput): Plan | null => {
  const o = runEngine({ input, tier: 'paid', displayUnits: 'km', planStart, today })
  return o.kind === 'refusal' ? null : o.plan
}
const CODES = ['INV-PLAN-MIN-SESSION-SIZE', 'INV-PLAN-VO2MAX-MAIN-SET-CAP', 'INV-PLAN-GOAL-PACE-SHAPE', 'INV-PLAN-MAIN-SET-ORDERING']

// Every 6th case reaches all five benchmarks, four distances and four gaps (960 / 6 = 160). Built ONCE.
const sample = slowGoalGrid(planStart, benchmarkDate).filter((_, i) => i % 6 === 0)
  .map(({ gap, ...c }) => ({ input: c as unknown as GeneratorInput, plan: build(c as unknown as GeneratorInput) }))
const built = sample.filter((x): x is { input: GeneratorInput; plan: Plan } => x.plan != null)

describe('the slow-goal grid meets §9 without breaking the dose', () => {
  it('the sample reaches every benchmark, and most of it is built (refusals cannot hide a breach)', () => {
    expect(new Set(built.map(x => (x.input as any).benchmark.time)).size).toBe(5)
    // A drop here means fewer runners are being checked, not that fewer breach.
    expect(built.length).toBeGreaterThanOrEqual(110)
  })
  it('🔴 no floor, VO2 cap, goal-pace shape or ordering breach (were 204 / 24 on the grid)', () => {
    const found = built.flatMap(({ input, plan }) => validatePlan(plan, input)
      .filter(v => CODES.includes(v.code)).map(v => `${(input as any).benchmark.time} ${input.race_distance_km}k: ${v.code}`))
    expect(found).toEqual([])
  })
  it('🔴 the minutes form is what carries them: a quality session under 4 km exists, and every one is at least 35 minutes', () => {
    let under = 0
    for (const { plan } of built) for (const w of plan.weeks) for (const s of Object.values(w.sessions)) {
      if (!s || s.type !== 'quality' || s.distance_km == null || s.distance_km >= GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.secondary_quality) continue
      under++
      expect(s.duration_mins ?? 0).toBeGreaterThanOrEqual(GENERATION_CONFIG.QUALITY_FLOOR_MINS)
    }
    expect(under, 'the grid must still reach a session the km floor alone would fail').toBeGreaterThan(0)
  })
  it('🔴 and a week\'s ONLY quality session under 5 km is at least 35 minutes (the 4–5 km band above skips)', () => {
    let checked = 0
    for (const { plan } of built) for (const w of plan.weeks) {
      const q = Object.values(w.sessions).filter(s => s?.type === 'quality')
      if (q.length !== 1) continue   // one quality session = the primary, held to 5 km
      const s = q[0]!
      if (s.distance_km == null || s.distance_km >= GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.quality) continue
      checked++
      expect(s.duration_mins ?? 0).toBeGreaterThanOrEqual(GENERATION_CONFIG.QUALITY_FLOOR_MINS)
    }
    expect(checked).toBeGreaterThan(0)
  })
})

describe('the check accepts either form, and only those', () => {
  const c = built.find(x => (x.input as any).benchmark.time === '0:40:00' && x.input.race_distance_km === 10
    && x.input.fitness_level === 'intermediate')!
  // A week with exactly ONE quality session, so the edited session is the primary and held to 5 km (with two, the
  // edited one could become "secondary" and pass at 4 km without the minutes rule).
  const withQuality = (km: number, mins: number): Plan => {
    const p: Plan = JSON.parse(JSON.stringify(c.plan))
    const w = p.weeks.find(x => Object.values(x.sessions).filter(s => s?.type === 'quality').length === 1)!
    const q = Object.values(w.sessions).find(s => s?.type === 'quality')!
    q.distance_km = km; q.duration_mins = mins
    return p
  }
  const floorHits = (p: Plan) => validatePlan(p, c.input).filter(v => v.code === 'INV-PLAN-MIN-SESSION-SIZE')
  it('the fixture is clean as built', () => expect(floorHits(c.plan)).toEqual([]))
  it('4.5 km in 40 minutes meets the floor', () => expect(floorHits(withQuality(4.5, 40))).toEqual([]))
  it('🔴 4.5 km in 30 minutes does not', () => expect(floorHits(withQuality(4.5, 30)).length).toBeGreaterThan(0))
})

describe('the owner', () => {
  // A 20-min main set is ~39 min in total; at 9:00/km work and 10:00/km easy it covers well under 5 km.
  it('met by minutes when the distance is short', () => expect(meetsQualityFloor(20, 9, 10, 5)).toBe(true))
  it('met by distance when the session is short but quick', () => expect(meetsQualityFloor(10, 3.5, 4.5, 5)).toBe(true))
  it('🔴 neither: short and slow', () => expect(meetsQualityFloor(5, 9, 10, 5)).toBe(false))
})
