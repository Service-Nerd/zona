/**
 * `effectiveSessions` — the single owner of "where does this session actually
 * live after the runner moved it?".
 *
 * Written 2026-09-19 during the regression pass. This module had **six
 * production callers and zero tests** — including the daily coach note and the
 * missed-session prompt, which is the pair it was extracted to keep in step.
 */
import { describe, it, expect } from 'vitest'
import { resolveEffectiveDay, soleSession, type DayKey, type EffectiveSession, slotForOriginalDay, type SessionOverride } from './effectiveSessions'
import type { Session, Week } from '@/types/plan'

/** Phase 1 adapter: a day holds at most one session, so the old single-entry view is exact. */
const resolveOne = (w: Parameters<typeof resolveEffectiveDay>[0], o: Parameters<typeof resolveEffectiveDay>[1]) =>
  Object.fromEntries(Object.entries(resolveEffectiveDay(w, o)).map(([k, l]) => [k, soleSession(l)])) as Partial<Record<DayKey, EffectiveSession>>


const s = (id: string): Session => ({ id, type: 'easy', label: id } as unknown as Session)
const week = (sessions: Record<string, Session>) => ({ sessions } as unknown as Pick<Week, 'sessions'>)

describe('resolveEffectiveSessions', () => {
  it('no overrides — every session stays on its own day and is not an override', () => {
    const w = week({ mon: s('easy-mon'), wed: s('quality-wed'), sun: s('long-sun') })
    const out = resolveOne(w, [])
    expect(Object.keys(out).sort()).toEqual(['mon', 'sun', 'wed'])
    expect(out.wed!.originalDay).toBe('wed')
    expect(out.wed!.isOverride).toBe(false)
  })

  it('a move to an EMPTY day relocates the session and remembers its original day', () => {
    // originalDay is the completion key — losing it orphans the runner's log.
    const w = week({ mon: s('easy-mon'), wed: s('quality-wed') })
    const out = resolveOne(w, [{ week_n: 1, original_day: 'wed', new_day: 'thu' }])
    expect(out.wed).toBeUndefined()
    expect(out.thu!.session.id).toBe('quality-wed')
    expect(out.thu!.originalDay).toBe('wed')
    expect(out.thu!.isOverride).toBe(true)
    expect(out.mon!.session.id).toBe('easy-mon')
  })

  it('a true SWAP (two override rows) keeps both sessions', () => {
    const w = week({ mon: s('easy-mon'), wed: s('quality-wed') })
    const out = resolveOne(w, [
      { week_n: 1, original_day: 'mon', new_day: 'wed' },
      { week_n: 1, original_day: 'wed', new_day: 'mon' },
    ])
    expect(out.wed!.session.id).toBe('easy-mon')
    expect(out.mon!.session.id).toBe('quality-wed')
    expect(out.mon!.originalDay).toBe('wed')
  })

  it('an override naming a day with no session is ignored, not crashed', () => {
    const w = week({ mon: s('easy-mon') })
    const out = resolveOne(w, [{ week_n: 1, original_day: 'fri', new_day: 'sat' }])
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
    const out = resolveOne(w, [{ week_n: 1, original_day: 'mon', new_day: 'wed' }])
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
    const out = resolveOne(w, [
      { week_n: 1, original_day: 'mon', new_day: 'wed' },
      { week_n: 1, original_day: 'tue', new_day: 'wed' },
    ])
    const ids = Object.values(out).map(e => e.session.id).sort()
    expect(ids).toEqual(['a', 'b', 'c'])
  })

})

/**
 * 🔴 PHASE 2 (`new_slot`) HAD NO TEST AT ALL, AND NOTHING SAID SO
 * (`TEST-LIVENESS-COVERAGE-01`, 2026-11-09).
 *
 * `effectiveSessions.ts` was already a declared mutation subject — named by
 * `overrideMoves.test.ts` and `autoLinkOverride.test.ts` — while its OWN co-named
 * test file sat outside `SUBJECTS`, so the liveness harness reported on this module
 * through a neighbour's assertions and never through the test written for it. Adding
 * the entry turned **4 of 4 behaviour-changing mutations into SURVIVORS, all at one
 * site**: the five-conjunct `if` at `effectiveSessions.ts:60` that decides whether a
 * slotted move becomes a §126 double or falls back to an ordinary move.
 *
 * The file above covers Phase 1 thoroughly and the word `new_slot` did not appear in
 * it once. **A thorough test of half a module is a green tick over the other half.**
 * One case per conjunct below, so a flip of any of them goes red.
 */
describe('resolveEffectiveDay — §126 doubles (Phase 2, ADR-025)', () => {
  const easy = (id: string): Session => ({ id, type: 'easy', label: id } as unknown as Session)
  const quality = (id: string): Session => ({ id, type: 'quality', label: id } as unknown as Session)

  it('a slotted move onto an occupied EASY day becomes a double, and the origin empties', () => {
    const w = week({ tue: easy('mover'), thu: easy('occupant') })
    const out = resolveEffectiveDay(w, [{ week_n: 1, original_day: 'tue', new_day: 'thu', new_slot: 'am' }] as SessionOverride[])
    expect(out.tue, 'the mover\'s own day is left empty').toBeUndefined()
    expect(out.thu!.map(e => [e.session.id, e.slot])).toEqual([['mover', 'am'], ['occupant', 'pm']])
    // The completion key survives on both halves — losing it orphans the log.
    expect(out.thu!.map(e => e.originalDay).sort()).toEqual(['thu', 'tue'])
  })

  it('pm lands the mover SECOND — the list is ordered by slot, not by who moved', () => {
    const w = week({ tue: easy('mover'), thu: easy('occupant') })
    const out = resolveEffectiveDay(w, [{ week_n: 1, original_day: 'tue', new_day: 'thu', new_slot: 'pm' }] as SessionOverride[])
    expect(out.thu!.map(e => [e.session.id, e.slot])).toEqual([['occupant', 'am'], ['mover', 'pm']])
  })

  it('🔴 canDouble conjunct — §126 forbids a double with a QUALITY session, so it swaps instead', () => {
    // Kills `flip ... && to ||` on canDouble: admitting it would put a hard run
    // and an easy run on the same day, which is the thing §126 exists to prevent.
    const w = week({ tue: easy('mover'), thu: quality('hard') })
    const out = resolveEffectiveDay(w, [{ week_n: 1, original_day: 'tue', new_day: 'thu', new_slot: 'am' }] as SessionOverride[])
    expect(out.thu!.length, 'not a double').toBe(1)
    expect(out.thu![0].session.id).toBe('mover')
    expect(out.tue![0].session.id, 'the occupant is displaced, never dropped').toBe('hard')
    expect(out.thu![0].slot ?? null, 'an ordinary move carries no slot').toBeNull()
  })

  it('🔴 free conjunct — a SECOND slotted move onto the same day does not double it again', () => {
    // Kills `flip ... && to ||` on `free`: a third session on one day, or a lost one.
    const w = week({ mon: easy('m1'), tue: easy('m2'), thu: easy('occupant') })
    const out = resolveEffectiveDay(w, [
      { week_n: 1, original_day: 'mon', new_day: 'thu', new_slot: 'am' },
      { week_n: 1, original_day: 'tue', new_day: 'thu', new_slot: 'am' },
    ] as SessionOverride[])
    expect(out.thu!.length, 'at most two on a day').toBe(2)
    const ids = Object.values(out).flat().map(e => e.session.id).sort()
    expect(ids, 'nothing is lost — the second move yields').toEqual(['m1', 'm2', 'occupant'])
  })

  it('🔴 originalDay conjunct — a slot row whose target ALREADY holds the mover is not a double', () => {
    // Kills `flip === to !==`: the occupant IS the mover, arriving via the plain
    // row, so doubling it would pair a session with itself.
    const w = week({ wed: easy('only') })
    const out = resolveEffectiveDay(w, [
      { week_n: 1, original_day: 'wed', new_day: 'fri' },
      { week_n: 1, original_day: 'wed', new_day: 'fri', new_slot: 'am' },
    ] as SessionOverride[])
    expect(out.fri!.length).toBe(1)
    expect(out.fri![0].session.id).toBe('only')
    expect(Object.keys(out)).toEqual(['fri'])
  })

  it('a slotted move onto an EMPTY day is an ordinary relocation, not a double', () => {
    const w = week({ tue: easy('mover') })
    const out = resolveEffectiveDay(w, [{ week_n: 1, original_day: 'tue', new_day: 'thu', new_slot: 'am' }] as SessionOverride[])
    expect(out.thu!.length).toBe(1)
    expect(out.thu![0].session.id).toBe('mover')
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
