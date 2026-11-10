// SCALE-SESSION-OWNER-01 — the contract of "make this session a factor smaller".
//
// 🔴 WHY THIS FILE EXISTS. There were THREE hand-written copies of this expression and each
// carried a different subset of the same four defects:
//
// | site | inert on duration | duration left stale | floor |
// |---|---|---|---|
// | `taperRecalibration` | yes, to 2026-11-10 | **yes, on the distance path** | runner-resolved |
// | `postRaceReshape`     | **yes**            | **yes**                      | **hardcoded `3`** |
// | the readiness ease    | yes, to 2026-11-10 | yes, to 2026-11-10           | none, by design |
//
// 📐 MEASURED when the three were unified. Taper, simulating a 40% build under-run over 1,370
// generated plans: the distance path left `duration_mins` stale on **1,934 intermediate and
// 1,953 experienced sessions** — 3,887 across 913 plans, and **exactly the cohort the previous
// commit called "provably unchanged", because its before/after table measured km divergence
// and could not see a duration beside a distance.** Beginner: 0, since the distance path never
// applied to them. Post-race reshape, 8-week plan with a marathon result: a recovery run came
// back **`3 km in 0.5 min`** and an eased session **`4 km in 140 min`**; both now read
// `4 km / 24 min` and `4 km / 28 min`, and a duration-anchored plan reports
// **`sessionsModified` 2 → 6**.
import { describe, it, expect } from 'vitest'
import { scaleSessionAnchors, minPerKmOf } from './scaleSessionAnchors'
import { sessionKmSelfPaced } from './sessionDistance'
import type { Session } from '@/types/plan'

const PACE = '6:00-6:30 /km'   // midpoint 6:15 → 6.25 min/km
const s = (over: Partial<Session>): Session =>
  ({ type: 'easy', label: 'Easy run', detail: null, pace_target: PACE, ...over } as unknown as Session)

describe('SCALE-SESSION-OWNER-01 — whichever anchor the session carries', () => {
  it('🔴 a DURATION-anchored session is scaled — all three copies returned it untouched', () => {
    const out = scaleSessionAnchors(s({ duration_mins: 100 }), 0.85)
    expect(out.duration_mins).toBe(85)
    expect(out.distance_km, 'a distance was invented for a timed session').toBeUndefined()
  })

  it('🔴 BOTH anchors move together when both are present — the stale-duration defect', () => {
    // The engine derives duration FROM distance, so cutting one and leaving the other makes the
    // session describe itself two ways at once.
    const out = scaleSessionAnchors(s({ distance_km: 20, duration_mins: 140 }), 0.5)
    expect(out.distance_km).toBe(10)
    expect(out.duration_mins, 'the duration was left behind').toBe(70)
  })

  it('the duration follows the distance the FLOOR produced, not the raw factor', () => {
    // 20 km × 0.1 = 2 km, floored to 8 → the effective ratio is 0.4, not 0.1, and the duration
    // must use the ratio that actually happened.
    const out = scaleSessionAnchors(s({ distance_km: 20, duration_mins: 140 }), 0.1, { floorKm: 8 })
    expect(out.distance_km).toBe(8)
    expect(out.duration_mins, 'the duration used the raw factor instead of the floored ratio').toBe(56)
  })

  it('🔑 a FLOOR binds a duration-anchored session too, in km, without inverting the pricer', () => {
    // 100 min at 6.25 min/km is 16 km; × 0.1 is 1.6 km, floored to 8 → 50 min.
    const before = s({ duration_mins: 100 })
    expect(sessionKmSelfPaced(before)).toBeCloseTo(16, 1)
    const out = scaleSessionAnchors(before, 0.1, { floorKm: 8 })
    expect(out.duration_mins).toBe(50)
    expect(sessionKmSelfPaced(out)!, 'scaled below the floor').toBeGreaterThanOrEqual(7.95)
  })

  it('🔴 with a FLOOR, an unpriceable session is returned untouched — never scaled on a guess', () => {
    // `?? 0` here would assert the session covered no ground: the SESSION-KM-01/02 trap.
    const noPace = ({ type: 'easy', label: 'Easy', detail: null, duration_mins: 60 } as unknown as Session)
    expect(sessionKmSelfPaced(noPace), 'the fixture is priceable, so this arm proves nothing').toBeNull()
    expect(scaleSessionAnchors(noPace, 0.5, { floorKm: 8 })).toBe(noPace)
  })

  it('🔑 …but with NO floor it is scaled anyway, because proportion needs no price', () => {
    // Wiring the third caller exposed this: the readiness ease has no floor by design, and
    // demanding a pace would refuse to ease a session it could ease perfectly well.
    const noPace = ({ type: 'easy', label: 'Easy', detail: null, duration_mins: 60 } as unknown as Session)
    expect(scaleSessionAnchors(noPace, 0.5).duration_mins).toBe(30)
  })

  it('returns the SAME OBJECT when nothing changes — two callers count moves by identity', () => {
    const unchanged = s({ distance_km: 10, duration_mins: 60 })
    expect(scaleSessionAnchors(unchanged, 1)).toBe(unchanged)
    // Already at the floor: the scale cannot move it, so it must not look modified.
    const atFloor = s({ distance_km: 4, duration_mins: 25 })
    expect(scaleSessionAnchors(atFloor, 0.5, { floorKm: 4 })).toBe(atFloor)
    // And a session with neither anchor is returned as-is rather than throwing.
    const neither = ({ type: 'rest', label: 'Rest', detail: null } as unknown as Session)
    expect(scaleSessionAnchors(neither, 0.5)).toBe(neither)
  })

  it('km precision is the caller’s: 0.5 for the taper and post-race, 0.1 for the ease', () => {
    expect(scaleSessionAnchors(s({ distance_km: 10 }), 0.87, { kmPrecision: 0.5 }).distance_km).toBe(8.5)
    expect(scaleSessionAnchors(s({ distance_km: 10 }), 0.87, { kmPrecision: 0.1 }).distance_km).toBe(8.7)
  })

  it('`clearCoachNotes` only clears on a session that actually changed', () => {
    const withNotes = s({ distance_km: 10, duration_mins: 60, coach_notes: ['keep me'] as unknown as [string] })
    expect(scaleSessionAnchors(withNotes, 0.5, { clearCoachNotes: true }).coach_notes).toBeUndefined()
    expect(scaleSessionAnchors(withNotes, 1, { clearCoachNotes: true }).coach_notes, 'notes cleared on an unchanged session')
      .toEqual(['keep me'])
  })
})

describe('minPerKmOf — the quantity postRaceReshape computed upside down', () => {
  it('🔴 THE DIMENSIONAL DEFECT: minutes per km, not km per minute', () => {
    // `km / (duration_mins / distance_km)` is km²/min. A 20 km / 140 min session priced that
    // way gave a 3 km recovery run 0.4 minutes, shown to the runner as "3 km · 0 min".
    expect(minPerKmOf(s({ distance_km: 20, duration_mins: 140 }))).toBeCloseTo(7, 6)
    // The consequence, stated as the arithmetic the caller performs.
    expect(Math.round(3 * minPerKmOf(s({ distance_km: 20, duration_mins: 140 }))!)).toBe(21)
  })

  it('prices a DURATION-anchored session too — it has no distance to divide by', () => {
    expect(minPerKmOf(s({ duration_mins: 100 }))).toBeCloseTo(6.25, 2)
  })

  it('returns null rather than a number it cannot justify', () => {
    expect(minPerKmOf(({ type: 'easy', label: 'E', detail: null, duration_mins: 60 } as unknown as Session))).toBeNull()
    expect(minPerKmOf(s({ distance_km: 10 }))).toBeNull()          // no duration
    expect(minPerKmOf(s({ distance_km: 0, duration_mins: 60 }))).toBeNull()
  })
})
