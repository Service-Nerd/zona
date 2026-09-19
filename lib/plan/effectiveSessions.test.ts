/**
 * `effectiveSessions` — the single owner of "where does this session actually
 * live after the runner moved it?".
 *
 * Written 2026-09-19 during the regression pass. This module had **six
 * production callers and zero tests** — including the daily coach note and the
 * missed-session prompt, which is the pair it was extracted to keep in step.
 */
import { describe, it, expect } from 'vitest'
import { resolveEffectiveSessions, slotForOriginalDay, type SessionOverride } from './effectiveSessions'
import type { Session, Week } from '@/types/plan'

const s = (id: string): Session => ({ id, type: 'easy', label: id } as unknown as Session)
const week = (sessions: Record<string, Session>) => ({ sessions } as unknown as Pick<Week, 'sessions'>)

describe('resolveEffectiveSessions', () => {
  it('no overrides — every session stays on its own day and is not an override', () => {
    const w = week({ mon: s('easy-mon'), wed: s('quality-wed'), sun: s('long-sun') })
    const out = resolveEffectiveSessions(w, [])
    expect(Object.keys(out).sort()).toEqual(['mon', 'sun', 'wed'])
    expect(out.wed!.originalDay).toBe('wed')
    expect(out.wed!.isOverride).toBe(false)
  })

  it('a move to an EMPTY day relocates the session and remembers its original day', () => {
    // originalDay is the completion key — losing it orphans the runner's log.
    const w = week({ mon: s('easy-mon'), wed: s('quality-wed') })
    const out = resolveEffectiveSessions(w, [{ week_n: 1, original_day: 'wed', new_day: 'thu' }])
    expect(out.wed).toBeUndefined()
    expect(out.thu!.session.id).toBe('quality-wed')
    expect(out.thu!.originalDay).toBe('wed')
    expect(out.thu!.isOverride).toBe(true)
    expect(out.mon!.session.id).toBe('easy-mon')
  })

  it('a true SWAP (two override rows) keeps both sessions', () => {
    const w = week({ mon: s('easy-mon'), wed: s('quality-wed') })
    const out = resolveEffectiveSessions(w, [
      { week_n: 1, original_day: 'mon', new_day: 'wed' },
      { week_n: 1, original_day: 'wed', new_day: 'mon' },
    ])
    expect(out.wed!.session.id).toBe('easy-mon')
    expect(out.mon!.session.id).toBe('quality-wed')
    expect(out.mon!.originalDay).toBe('wed')
  })

  it('an override naming a day with no session is ignored, not crashed', () => {
    const w = week({ mon: s('easy-mon') })
    const out = resolveEffectiveSessions(w, [{ week_n: 1, original_day: 'fri', new_day: 'sat' }])
    expect(out.sat).toBeUndefined()
    expect(Object.keys(out)).toEqual(['mon'])
  })

  it('EFFSESS-COLLISION-01 — a one-sided move onto an OCCUPIED day keeps both sessions', () => {
    // THE DEFECT THIS REPLACES: `out[new_day]` was a bare assignment, so the
    // occupant was overwritten and a two-session week silently became a
    // one-session week — the runner's session gone from the screen and its
    // completion row unreachable, because nothing pointed at its slot.
    //
    // Reachable from the UI: `PlanCalendar` routes to Swap only when the target
    // is swappable (`!!session && not rest && not complete && not skipped`), so
    // moving onto a day whose session is ALREADY COMPLETED took the one-sided
    // Move path with the target occupied.
    const w = week({ mon: s('easy-mon'), wed: s('quality-wed') })
    const out = resolveEffectiveSessions(w, [{ week_n: 1, original_day: 'mon', new_day: 'wed' }])
    expect(out.wed!.session.id).toBe('easy-mon')      // the mover lands
    expect(out.mon!.session.id).toBe('quality-wed')   // the occupant is NOT lost
    expect(out.mon!.originalDay).toBe('wed')          // its completion key survives
    expect(out.mon!.isOverride).toBe(true)            // and it is marked as displaced
    expect(Object.keys(out).sort()).toEqual(['mon', 'wed'])
  })

  it('never drops a session even when the vacated day is also taken — the move is refused instead', () => {
    // Two overrides both landing on 'wed': the second cannot displace the first
    // into 'tue' (taken by the first mover's own origin), so it yields. Losing
    // a session is never the answer to a collision.
    const w = week({ mon: s('a'), tue: s('b'), wed: s('c') })
    const out = resolveEffectiveSessions(w, [
      { week_n: 1, original_day: 'mon', new_day: 'wed' },
      { week_n: 1, original_day: 'tue', new_day: 'wed' },
    ])
    const ids = Object.values(out).map(e => e.session.id).sort()
    expect(ids).toEqual(['a', 'b', 'c'])
  })

})

describe('slotForOriginalDay', () => {
  it('returns the new day when moved, and the original when not', () => {
    const ov: SessionOverride[] = [{ week_n: 1, original_day: 'wed', new_day: 'fri' }]
    expect(slotForOriginalDay('wed', ov)).toBe('fri')
    expect(slotForOriginalDay('mon', ov)).toBe('mon')
    expect(slotForOriginalDay('wed', [])).toBe('wed')
  })
})
