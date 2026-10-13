/**
 * MODIFY-DIFF-DAY-MAP-01 (2026-10-13) — the confirm screen named the wrong days.
 *
 * `ModifyPlanConfirm` passed `Object.values(week.sessions)`, a COMPACT array of
 * only the days that have a session, to a function whose contract is a SEVEN
 * element array indexed mon=0…sun=6. A 3-day runner's Wed/Fri/Sun week landed at
 * indices 0,1,2 and rendered as Mon/Tue/Wed — on the screen that asks them to
 * accept a whole-plan rewrite.
 *
 * Reproduced here from the founder's real plan, taken off the live screen.
 */
import { describe, it, expect } from 'vitest'
import { computeSessionDiff, DIFF_DAY_ORDER } from './sessionDiff'

type S = { type: string; distance_km?: number; role?: string } | null
const byDay = (m: Record<string, S>) => DIFF_DAY_ORDER.map(d => m[d] ?? null)

// The founder's archived week 4: Mon/Wed/Fri/Sun. Not Mon/Tue/Wed/Thu.
const OLD = byDay({
  mon: { type: 'easy', distance_km: 6 },
  wed: { type: 'easy', distance_km: 6 },
  fri: { type: 'easy', distance_km: 6 },
  sun: { type: 'easy', distance_km: 8, role: 'long_run' },
})
// What he actually got: Wed/Fri/Sun.
const NEW = byDay({
  wed: { type: 'quality', distance_km: 7.5 },
  fri: { type: 'easy', distance_km: 9.5 },
  sun: { type: 'easy', distance_km: 16.5, role: 'long_run' },
})

describe('MODIFY-DIFF-DAY-MAP-01 — days are real days', () => {
  it('🔴 the changed days are WED, FRI, SUN and MON — never TUE or THU', () => {
    const changed = computeSessionDiff(OLD, NEW).filter(d => d.kind !== 'unchanged').map(d => d.day)
    expect(changed).not.toContain('tue')
    expect(changed).not.toContain('thu')
    expect(changed.sort()).toEqual(['fri', 'mon', 'sun', 'wed'])
  })

  it("Sunday's long run is reported on SUNDAY, not Monday", () => {
    const sun = computeSessionDiff(OLD, NEW).find(d => d.day === 'sun')
    expect(sun?.after?.distance_km).toBe(16.5)
    const mon = computeSessionDiff(OLD, NEW).find(d => d.day === 'mon')
    expect(mon?.after).toBeNull()        // Monday becomes a rest day
  })

  // 🔴 THE REGRESSION CASE. This is exactly what the broken caller produced.
  it('🔴 FALSIFICATION — the OLD compact-array call is now refused, not silently shifted', () => {
    const compactOld = [OLD[0], OLD[2], OLD[4], OLD[6]]      // Object.values(sessions)
    const compactNew = [NEW[2], NEW[4], NEW[6]]
    expect(() => computeSessionDiff(compactOld, compactNew)).toThrow(/7-element day-indexed/)
  })

  it('a correctly-built 7-element pair is accepted', () => {
    expect(() => computeSessionDiff(OLD, NEW)).not.toThrow()
  })

  // 🔴 EMPTY IS NOT SHORT, and the first version of the guard got this wrong.
  // The Plan adjustments door passes `[]` when there is nothing pending; the
  // guard threw on it and failed a markup test that had nothing to do with this
  // defect. Zero means "no data"; 3 or 4 means somebody called Object.values.
  it('allows an EMPTY pair — "no data" is not a malformed array', () => {
    expect(() => computeSessionDiff([], [])).not.toThrow()
    expect(computeSessionDiff([], []).every(d => d.kind === 'unchanged')).toBe(true)
  })
})
