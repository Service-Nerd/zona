import { describe, it, expect } from 'vitest'
import { firstRunOfPlan } from './firstRun'
import type { Week, Session } from '@/types/plan'

// FIRSTRUN-MOMENTS-01b — the first session pulled out of the wall of weeks.

const sess = (o: Partial<Session>): Session => ({ type: 'easy', ...o } as Session)
const week = (sessions: Week['sessions']): Week => ({ n: 1, phase: 'base', sessions, weekly_km: 10 } as unknown as Week)

describe('firstRunOfPlan', () => {
  it('returns the first non-rest session in mon-sun order', () => {
    // Monday rest (absent), Tuesday easy 20 min → Tuesday is first.
    const r = firstRunOfPlan([week({ tue: sess({ duration_mins: 20 }), thu: sess({ duration_mins: 30 }) })])
    expect(r).toEqual({ dayLabel: 'Tuesday', metric: '20 min', effort: 'Easy', reassure: false })
  })

  it('prefers Monday when Monday has a session', () => {
    const r = firstRunOfPlan([week({ mon: sess({ duration_mins: 25 }), wed: sess({ duration_mins: 40 }) })])
    expect(r?.dayLabel).toBe('Monday')
  })

  it('formats a duration-anchored session via ADR-015 (never "20 minutes")', () => {
    expect(firstRunOfPlan([week({ mon: sess({ duration_mins: 20 }) })])?.metric).toBe('20 min')
  })

  it('falls back to a distance via the ADR-015 owner, in the runner’s units', () => {
    // ⚠️ THIS TEST USED TO PIN THE DEFECT. It asserted '5 km', which was the
    // output of a hand-rolled `${Math.round(km)} km` in firstRun.ts — an
    // INV-FMT-001 violation (never re-implement the rule) that also hardcoded
    // the unit, so a miles runner read km on this card. It now routes through
    // `formatDistance`, whose spacing is '5km' across the whole app.
    const r = firstRunOfPlan([week({ mon: sess({ duration_mins: undefined, distance_km: 5.2 }) })])
    expect(r?.metric).toBe('5km')
  })

  it('honours the runner’s units on that fallback', () => {
    const r = firstRunOfPlan([week({ mon: sess({ duration_mins: undefined, distance_km: 5.2 }) })], 'mi')
    expect(r?.metric).toMatch(/mi$/)
  })

  it('maps effort honestly — never calls a hard session easy', () => {
    expect(firstRunOfPlan([week({ mon: sess({ type: 'tempo', duration_mins: 40 }) })])?.effort).toBe('Tempo')
    expect(firstRunOfPlan([week({ mon: sess({ type: 'intervals', duration_mins: 40 }) })])?.effort).toBe('Hard')
    expect(firstRunOfPlan([week({ mon: sess({ type: 'long', duration_mins: 60 }) })])?.effort).toBe('Easy')
  })

  it('uses the FIRST week — a foundation week if one is prepended', () => {
    const foundation = { n: -1, phase: 'foundation', sessions: { mon: sess({ duration_mins: 15 }) }, weekly_km: 6 } as unknown as Week
    const main = week({ mon: sess({ duration_mins: 30 }) })
    expect(firstRunOfPlan([foundation, main])?.metric).toBe('15 min')
  })

  it('returns null when there is nothing concrete to promise', () => {
    expect(firstRunOfPlan([])).toBeNull()
    expect(firstRunOfPlan([week({})])).toBeNull()                       // all-rest first week
    expect(firstRunOfPlan([week({ mon: sess({ duration_mins: undefined, distance_km: undefined }) })])).toBeNull()
  })
})

// FIRSTRUN-GATE-CALL-01 (SLT, 2026-09-18) — `reassure` decides whether the card
// carries its reassurance sentence. Derived here, never stamped on the plan.
describe('firstRunOfPlan — who gets the reassurance sentence', () => {
  const plan = [week({ tue: sess({ duration_mins: 20 }) })]

  it('a new runner does', () => {
    expect(firstRunOfPlan(plan, 'km', '<6mo')?.reassure).toBe(true)
    expect(firstRunOfPlan(plan, 'km', '6-18mo')?.reassure).toBe(true)
  })

  it('🔴 an experienced runner does not', () => {
    // To a 3:15 marathoner regenerating a block, a line reassuring them about
    // 20 easy minutes reads as an assumption they might not manage it.
    expect(firstRunOfPlan(plan, 'km', '2-5yr')?.reassure).toBe(false)
    expect(firstRunOfPlan(plan, 'km', '5yr+')?.reassure).toBe(false)
  })

  it('🔴 an UNKNOWN training age does not, and that direction is deliberate', () => {
    // Defaulting the other way shows a line written for beginners to everyone
    // whose profile is merely incomplete, which is most of the people it would
    // insult. The card itself still renders in full either way.
    expect(firstRunOfPlan(plan, 'km')?.reassure).toBe(false)
    expect(firstRunOfPlan(plan, 'km', null)?.reassure).toBe(false)
    expect(firstRunOfPlan(plan, 'km', '')?.reassure).toBe(false)
    expect(firstRunOfPlan(plan, 'km')?.dayLabel, 'the CARD is never gated').toBe('Tuesday')
  })
})
