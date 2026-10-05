// SHEET-DAY-QUESTION-01 (Design Board, SHIP scoped — 2026-10-02 sitting, built 2026-10-05).
//
// 🔴 THE DEFECT. `ModifyPlanSheet` asks `days_available` as a SegmentedControl (2–6)
// and `days_cannot_train` as an uncapped 7-cell grid, as TWO independent questions.
// `GeneratePlanScreen` derives both from ONE `WeekGrid`, so the wizard cannot do
// this. Two taps state a contradiction and the sheet said NOTHING.
//
// Measured in the item, same runner, three inputs:
//   2 days / 5 blocked -> coherent
//   6 days / 5 blocked -> IDENTICAL plan; the declared 6 is silently ignored
//   6 days / 6 blocked -> 1 training day/wk, ZERO quality across 16 weeks
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dayConflict } from './modifyPlan'

describe('SHEET-DAY-QUESTION-01 — dayConflict', () => {
  it('is silent when the declared count is achievable', () => {
    // ⚠️ THE ARM THAT KEEPS THE SHEET QUIET. This screen's whole design is
    // restraint, and a line that renders when there is nothing wrong is the
    // "empty means calm, not broken" rule broken from the other direction.
    expect(dayConflict(4, [])).toBeNull()
    expect(dayConflict(4, ['mon', 'tue', 'wed'])).toBeNull()   // 4 clear, 4 declared
    expect(dayConflict(2, ['mon', 'tue', 'wed', 'thu', 'fri'])).toBeNull() // 2 and 2
  })

  it('🔴 speaks on the item\'s own measured cases', () => {
    expect(dayConflict(6, ['mon', 'tue', 'wed', 'thu', 'fri']))
      .toEqual({ declared: 6, blocked: 5, clear: 2 })
    expect(dayConflict(6, ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']))
      .toEqual({ declared: 6, blocked: 6, clear: 1 })
  })

  it('blocking all seven leaves zero, not a negative', () => {
    expect(dayConflict(3, ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']))
      .toEqual({ declared: 3, blocked: 7, clear: 0 })
  })

  it('a repeated day is ONE blocked day', () => {
    // A duplicate in the stored array would otherwise invent a conflict the
    // runner cannot see on their own grid — the worst kind, because the sheet
    // would contradict what the control shows.
    expect(dayConflict(5, ['mon', 'mon', 'tue'])).toBeNull()   // 2 blocked, 5 clear
    expect(dayConflict(6, ['mon', 'mon', 'tue', 'tue', 'wed'])).toEqual(
      { declared: 6, blocked: 3, clear: 4 })
  })

  it('missing or malformed input says nothing rather than guessing', () => {
    expect(dayConflict(null, ['mon'])).toBeNull()
    expect(dayConflict(undefined, ['mon'])).toBeNull()
    expect(dayConflict(4, null)).toBeNull()
    expect(dayConflict(4, undefined)).toBeNull()
    // Non-strings are dropped, not counted: a stray value must not manufacture
    // a blocked day.
    expect(dayConflict(7, [null as never, 1 as never, 'mon'])).toEqual(
      { declared: 7, blocked: 1, clear: 6 })
  })

  // 🔴 THE REACH ARM. A helper that is correct and unrendered is the
  // decorative-config class — this repo's single most expensive failure family
  // (`INTENSITY_DISTRIBUTION` wrong for four months, `SPECIFICITY_BY_PHASE`
  // delivering 0% against a declared 60%). Every arm above would pass with the
  // sheet still silent.
  //
  // ⚠️ SOURCE-READ, NOT RENDERED, AND THE REASON IS NAMED: `vitest.config.ts` is
  // `environment: 'node'` with no jsdom, so there is nothing to mount. That makes
  // this weaker than a render test and it is the repo's documented substitute.
  it('🔴 the sheet actually renders it, on the days_available row', () => {
    const src = readFileSync('components/shared/ModifyPlanSheet.tsx', 'utf8')
    expect(src, 'the sheet does not call dayConflict — the helper is decorative')
      .toContain('dayConflict(')
    expect(src, 'it must be imported from the owner, not re-derived inline')
      .toMatch(/dayConflict[,\s}].*from '@\/lib\/plan\/modifyPlan'|dayConflict,/)
    // Both inputs reach it. Passing only one is how this kind of call silently
    // compares a value against nothing.
    expect(src).toContain("valueOf('days_available')")
    expect(src).toContain("valueOf('days_cannot_train')")
    // ⚠️ MUTED, NOT AMBER. The sheet's own note rules that amber is
    // coaching-warning voice, and stating two things that do not fit is not a
    // warning. A `--warn` ground here would be a voice regression.
    const at = src.indexOf('dayConflict(')
    const block = src.slice(at, at + 900)
    expect(block, 'the conflict line must not use coaching-warning amber')
      .not.toMatch(/--warn/)
    expect(block, 'it should read as a derived fact, in --mute like row.consequence')
      .toContain('--mute')
  })

  it('⚠️ it does NOT claim what the plan will do, and that is deliberate', () => {
    // DAYS-GATE-CAPACITY-01: `validateDaysAvailable` reads `input.days_available`
    // and NEVER mentions `days_cannot_train`, so the engine acts on the typed
    // number. A line saying "the plan will use 2 days" would be FALSE today.
    // The return shape carries only the runner's own two inputs and the
    // arithmetic between them — no verdict, no prescription.
    const c = dayConflict(6, ['mon', 'tue', 'wed', 'thu', 'fri'])!
    expect(Object.keys(c).sort()).toEqual(['blocked', 'clear', 'declared'])
  })
})
