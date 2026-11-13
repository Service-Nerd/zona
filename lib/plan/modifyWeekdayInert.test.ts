import { describe, it, expect } from 'vitest'
import { applyEdits, consequenceFor, MODIFIABLE_ROWS } from './modifyPlan'
import { perDayBudgetDays, weekdayBudgetFor } from './weekdayOverrunNote'
import type { GeneratorInput } from '@/types/plan'

/**
 * MODIFY-WEEKDAY-INERT-01 — Design Board 2026-11-13, SHIP WITH AMENDMENT.
 *
 * 🔴 WHAT WAS WRONG, MEASURED ON PRODUCTION: 5 of 43 live plans carry `day_budgets`, all 5 also
 * carrying `max_weekday_mins`. `weekdayBudgetFor` reads the day's OWN limit first and `applyEdits`
 * spread the edit over the stored input, so raising "Weekday time limit" returned the same plan.
 * ⚠️ And it was not merely inert: on THREE of the five the row STATED a limit the engine does not
 * use, one showing 45 minutes against a Friday the engine allows 90.
 */
const base = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  max_weekday_mins: 30,
  day_budgets: { mon: 60, wed: 45, fri: 30 },
  ...over,
} as unknown as GeneratorInput)

const WEEKDAY_ROW = MODIFIABLE_ROWS.find(r => r.key === 'max_weekday_mins')!

describe('MODIFY-WEEKDAY-INERT-01 — the weekday limit governs what it claims to', () => {
  it('the row this is about still exists', () => {
    expect(WEEKDAY_ROW, 'max_weekday_mins is no longer an offered row').toBeTruthy()
  })

  it('🔴 a new weekday limit REPLACES the per-day limits', () => {
    const next = applyEdits(base(), { max_weekday_mins: 60 })
    expect(perDayBudgetDays(next), 'day_budgets survived the edit, so the edit is inert').toEqual([])
    // The behavioural proof, not just the field: the engine's own precedence owner must now
    // answer with the new cap on a day that previously carried its own.
    expect(weekdayBudgetFor(next, 'mon')).toEqual({ cap: 60, perDay: false })
  })

  it('leaves a runner WITHOUT per-day limits exactly as they were', () => {
    // ⚠️ `undefined`, not `null`: that is the shape `GeneratorInput` declares, and the first
  // cut used `null` — vitest passed and `tsc` went red, the green-suite/red-build trap.
  const plain = base({ day_budgets: undefined })
    const next = applyEdits(plain, { max_weekday_mins: 90 })
    expect(weekdayBudgetFor(next, 'mon')).toEqual({ cap: 90, perDay: false })
    // 38 of 43 live plans are this case and must not move.
    expect(Object.keys(next)).toEqual(Object.keys(plain))
  })

  it('does not clear per-day limits on an edit to a DIFFERENT key', () => {
    // The clause is scoped to the control that replaces them. An injury edit must not quietly
    // discard a runner's weekday limits.
    const next = applyEdits(base(), { injury_history: ['knee'] } as never)
    expect(perDayBudgetDays(next)).toEqual(['mon', 'wed', 'fri'])
  })

  it('🎓 NAMES WHAT IT REPLACES, with the real values — Sierra and Wroblewski’s condition', () => {
    const copy = consequenceFor(WEEKDAY_ROW, base())
    expect(copy).toContain('Mon 1h')
    expect(copy).toContain('Wed 45 min')
    expect(copy).toContain('Fri 30 min')
    // ⚠️ ADR-015: 60 reads as `1h`, never `60 min`. The control was caught hand-writing the unit
    // once already (PREF-SWEEP-01), and a subtitle that disagreed with the segmented control
    // beside it would be the same defect one line down.
    expect(copy, 'ADR-015: >=60 is hours').not.toContain('60 min')
    expect(copy, 'no em dash in a sentence the runner reads').not.toContain('—')
  })

  it('says the ordinary thing when there is nothing to replace', () => {
    expect(consequenceFor(WEEKDAY_ROW, base({ day_budgets: undefined }))).toBe(WEEKDAY_ROW.consequence)
    expect(consequenceFor(WEEKDAY_ROW, null)).toBe(WEEKDAY_ROW.consequence)
    expect(consequenceFor(WEEKDAY_ROW, base({ day_budgets: {} }))).toBe(WEEKDAY_ROW.consequence)
  })

  it('every OTHER row keeps its static subtitle', () => {
    for (const row of MODIFIABLE_ROWS.filter(r => r.key !== 'max_weekday_mins')) {
      expect(consequenceFor(row, base()), row.key).toBe(row.consequence)
    }
  })
})
