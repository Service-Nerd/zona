import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup as html } from 'react-dom/server'
import { SegmentedControl, SEGMENTED_MIN_HEIGHT_PX } from './SegmentedControl'

/**
 * TAP-TARGET-DECISIONS-01 (Design Board, 2026-10-01 — SHIP).
 *
 * 🔴 THIS PRIMITIVE RENDERED AT 30px AGAINST A 🟢 STANDING 44px FLOOR
 * (`design-rulings.md`, iOS HIG): `padding: '8px 10px'` around 12px text, with
 * **no `minHeight` at all**. It is the highest-reach control that was under the
 * floor — login, Preferences, ModifyPlanSheet, Chip and DashboardClient all
 * inherit it.
 *
 * ⚠️ `TAP-TARGET-FLOOR-01`'s arm could not see it. That arm measured
 * `measureAll()`, which filters to controls already on the shared system, and
 * every one of those carries a size class that floors at 44 **by
 * construction** — so the arm was structurally incapable of failing on exactly
 * this. It is visible now via `measureAll({ all: true })`, and this file holds
 * the component's own floor so the value is asserted where it is owned.
 *
 * 🔴 AND THE HAND-ROLLED VERSION GOT IT RIGHT. `TrainingZonesScreen`'s tabs are
 * the same band of buttons with `minHeight: TAB_MIN_HEIGHT_PX = 44` and their
 * own markup test. **The component extracted to be reused was the one missing
 * the floor**, which is the opposite of what anyone would assume.
 */
const markup = () =>
  html(React.createElement(SegmentedControl, {
    options: [{ value: 'a', label: 'Heart rate' }, { value: 'b', label: 'Pace' }],
    value: 'a',
    onChange: () => {},
  }))

describe('SegmentedControl clears the tap-target floor', () => {
  it('🔴 declares a floor of at least 44px', () => {
    expect(SEGMENTED_MIN_HEIGHT_PX,
      'design-rulings.md: 44x44pt minimum tap target, STANDING, iOS HIG')
      .toBeGreaterThanOrEqual(44)
  })

  it('🔴 renders that floor, from the constant and not a literal', () => {
    // Asserting the CONSTANT's value in the output, so a hardcoded 44 drifting
    // away from the named one cannot pass. `ui-patterns.md`: never a literal in
    // a component.
    expect(markup()).toContain(`min-height:${SEGMENTED_MIN_HEIGHT_PX}px`)
  })

  it('every segment gets it, not just the active one', () => {
    // The inactive segment is the one a thumb is reaching for.
    const n = (markup().match(new RegExp(`min-height:${SEGMENTED_MIN_HEIGHT_PX}px`, 'g')) ?? []).length
    expect(n, 'the floor is on some segments and not others').toBe(2)
  })
})
