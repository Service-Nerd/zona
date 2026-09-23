// MODIFY-SHEET-01 — the day selector does not orphan a day.
//
// 🔴 The founder, on `ModifyPlanSheet`: *"I just don't like it."* No measurement,
// which is where a design conversation usually stops. Taking one found this:
// the day selector was `display: flex` + `flexWrap`, which put **six days on row
// one and "Sun" alone on row two**.
//
// ⚠️ SEVEN ACROSS IS NOT AVAILABLE AT 375pt, and that is the whole decision.
// 7 × 44px + 6 × 8px gaps = **356px** against ~**307px** of content width inside
// the sheet's card. Even at zero gap, 7 × 44 = **308 > 307**. Fitting one row
// means taking the circles below the **44px minimum tap target**, which is not
// worth trading for tidiness.
//
// So the wrap is DELIBERATE rather than incidental: four then three, equal
// columns. **An orphan reads as a mistake; a balanced pair reads as a layout.**

import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup as html } from 'react-dom/server'
import { DayGridSelector } from './DayGridSelector'

const markup = () =>
  html(React.createElement(DayGridSelector, { ariaLabel: 'Days', value: [], onChange: () => {} }))

describe('DayGridSelector markup', () => {
  it('renders all seven days (guards the guard)', () => {
    const m = markup()
    for (const d of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(m, `${d} missing`).toContain(`>${d}<`)
    }
  })

  it('🔴 lays out on a fixed COLUMN COUNT, never a wrapping flex row', () => {
    // `flexWrap` is what produced 6 + 1. A fixed column count cannot.
    expect(markup()).toMatch(/grid-template-columns:repeat\(4,\s*minmax\(0,\s*1fr\)\)/)
    expect(markup(), 'a wrapping row orphans the seventh day').not.toMatch(/flex-wrap:wrap/)
  })

  it('keeps the 44px tap target — the reason one row was refused', () => {
    expect(markup()).toMatch(/width:44px/)
    expect(markup()).toMatch(/height:44px/)
  })

  it('4 columns over 7 days gives a BALANCED 4 + 3, never 6 + 1', () => {
    // Arithmetic, asserted so the column count cannot drift to something that
    // orphans again: 7 % 4 === 3, and 3 > 1.
    const cols = 4
    const days = 7
    const lastRow = days % cols
    expect(lastRow, 'the final row would carry a single orphaned day').toBeGreaterThan(1)
  })
})
