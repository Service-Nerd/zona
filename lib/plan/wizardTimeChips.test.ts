import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { formatDuration } from '@/lib/format'

// WIZARD-TIME-CHIPS-01 — the wizard's own time chips.
//
// TWO defects in one place. (1) They read '60 min' / '90 min' / '2 hrs' where
// ADR-015 locks '1h' / '1h 30' / '2h' — a third duration convention, on the
// FIRST screen a runner meets, surviving because every sweep looked at output
// surfaces and not at the input one. (2) The selected chip was stored as its
// LABEL, in React state and in the saved `zona_wizard_draft`, and matched back
// by label — so fixing (1) would make an in-flight draft match nothing, yield
// `undefined`, and silently turn a runner's weekday cap into "No limit".
//
// The fix for the first defect was the trigger for the second. This file is the
// gate on both.

const SRC = readFileSync(join(process.cwd(), 'app/dashboard/GeneratePlanScreen.tsx'), 'utf8')
const code = SRC.split('\n')
  .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
  .join('\n')

describe('WIZARD-TIME-CHIPS-01 — identity is stable, display is derived', () => {
  it('the chips carry a KEY, not a label', () => {
    // A label is display. An identity that changes when the display changes is
    // not an identity.
    expect(code, 'MAX_WEEKDAY_CHIPS must be keyed').toMatch(/MAX_WEEKDAY_CHIPS[\s\S]{0,400}?key:\s*'30'/)
  })

  it('🔴 nothing matches the selected chip by LABEL any more', () => {
    // The exact line that made this dangerous:
    //   MAX_WEEKDAY_CHIPS.find(c => c.label === maxWeekdayChip)
    expect(code, 'matching a chip by label re-introduces the silent draft loss')
      .not.toMatch(/MAX_WEEKDAY_CHIPS[\s\S]{0,80}?c\.label\s*===/)
  })

  it('labels are derived through the ADR-015 owner, not written out', () => {
    expect(code).toMatch(/weekdayChipLabel[\s\S]{0,200}?formatDuration/)
    // The old hand-written set must be gone from code.
    for (const legacy of ["'60 min'", "'90 min'", "'2 hrs'", "'3 hrs'"]) {
      expect(code, `${legacy} is a hand-written duration; formatDuration owns this`)
        .not.toContain(`label: ${legacy}`)
    }
  })

  it('derives exactly the ADR-015 strings a runner should see', () => {
    // Pinned as VALUES, so this also documents what changed on screen.
    expect(formatDuration(30)).toBe('30 min')
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(60)).toBe('1h')      // was '60 min'
    expect(formatDuration(90)).toBe('1h 30')   // was '90 min'
    expect(formatDuration(120)).toBe('2h')     // was '2 hrs'
    expect(formatDuration(180)).toBe('3h')     // was '3 hrs'
  })

  it('🔴 a draft saved under the OLD labels still restores', () => {
    // Without the shim, anyone mid-wizard when this deploys loses their weekday
    // cap silently — the fix causing the very defect it exists to prevent.
    expect(code, 'LEGACY_CHIP_LABEL_TO_KEY must survive until no old drafts remain')
      .toMatch(/LEGACY_CHIP_LABEL_TO_KEY[\s\S]{0,300}?'90 min':\s*'90'/)
    expect(code).toMatch(/normaliseWeekdayChip\(s\.maxWeekdayChip\)/)
  })

  it('"No limit" stays a word, never a duration', () => {
    // It is the absence of a cap, so formatDuration has nothing to say about it.
    expect(code).toMatch(/mins == null \? 'No limit'/)
  })

  it('the per-day budget fallback uses the owner too', () => {
    const rows = readFileSync(join(process.cwd(), 'components/shared/DayBudgetRows.tsx'), 'utf8')
    const rowsCode = rows.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
    expect(rowsCode, 'the `${v} min` fallback re-implemented the ADR-015 rule')
      .not.toMatch(/\?\?\s*`\$\{v\} min`/)
    expect(rowsCode).toMatch(/formatDuration\(v\)/)
  })
})
