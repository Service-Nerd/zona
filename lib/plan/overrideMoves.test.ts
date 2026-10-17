import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { planMove } from './overrideMoves'
import { resolveEffectiveSessions } from './effectiveSessions'

/** PLAN-MOVE-DELETE-01 — a move replaces only its own row and any row landing on the target day. */
const week = { sessions: { tue: { type: 'easy', label: 'Tue easy' }, wed: { type: 'easy', label: 'Wed easy' } } } as never

describe('planMove', () => {
  it('🔴 moving onto a day whose own session was moved away keeps THAT move', () => {
    // Wednesday's run was moved to Friday; now Tuesday's run moves onto the empty Wednesday.
    const all = [{ week_n: 3, original_day: 'wed', new_day: 'fri' }]
    const { next, removedOriginalDays } = planMove(all, 3, 'tue', 'wed')
    expect(next).toEqual([{ week_n: 3, original_day: 'wed', new_day: 'fri' }, { week_n: 3, original_day: 'tue', new_day: 'wed' }])
    expect(removedOriginalDays).toEqual(['tue'])   // the old code also deleted 'wed' in the database
    // And the week the runner sees: Tuesday's run on Wednesday, Wednesday's on Friday. No snap-back.
    const eff = resolveEffectiveSessions(week, next as never)
    expect((eff.wed?.session as { label: string }).label).toBe('Tue easy')
    expect((eff.fri?.session as { label: string }).label).toBe('Wed easy')
  })
  it('re-moving a session replaces its own earlier move', () => {
    const r = planMove([{ week_n: 3, original_day: 'tue', new_day: 'thu' }], 3, 'tue', 'sat')
    expect(r.next).toEqual([{ week_n: 3, original_day: 'tue', new_day: 'sat' }])
    expect(r.removedOriginalDays).toEqual(['tue'])
  })
  it('moving back to its own day removes the override', () => {
    const r = planMove([{ week_n: 3, original_day: 'tue', new_day: 'thu' }], 3, 'tue', 'tue')
    expect(r.next).toEqual([])
  })
  it('other weeks are untouched', () => {
    const r = planMove([{ week_n: 4, original_day: 'wed', new_day: 'fri' }], 3, 'tue', 'wed')
    expect(r.next).toContainEqual({ week_n: 4, original_day: 'wed', new_day: 'fri' })
  })
  it('🔴 PlanCalendar uses it for BOTH the screen and the database delete', () => {
    const src = readFileSync('components/training/PlanCalendar.tsx', 'utf8')
    const body = src.slice(src.indexOf('async function handleMove('), src.indexOf('async function handleSwap('))
    expect(body).toMatch(/planMove\(allOverrides, weekN, originalDay, newDay\)/)
    expect(body).toMatch(/\.in\('original_day', removedOriginalDays\)/)
    expect(body).not.toMatch(/original_day\.eq\.\$\{newDay\}/)
  })
})
