// MOVE-PROTOTYPE-01 — the properties that make the comparison honest.
//
// This is a prototype, so the usual "does it look right" gates do not apply.
// What must hold is that the two gestures are COMPARABLE: same safety, same
// end state, and an instrument that does not favour either one.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

const CAL  = strip(read('components/training/PlanCalendar.tsx'))
const PAGE = strip(read('app/move-preview/page.tsx'))

describe('the prototype cannot reach a runner', () => {
  it('defaults to the shipped tap flow — BOTH defaults, bound to their signatures', () => {
    // A prototype that changes the real screen is not a prototype.
    //
    // 🔴 THIS ASSERTION WAS HOLLOW ON ITS FIRST WRITE and the falsification
    // caught it: `moveMode = 'tap'` appears TWICE — once on PlanCalendar, once
    // on WeekCard — so flipping PlanCalendar's default to 'drag' left an
    // unbounded `toMatch` perfectly green. Fifth time this repo has recorded
    // the class: bound the region, never grep the file.
    const outer = CAL.slice(CAL.indexOf('export default function PlanCalendar'), CAL.indexOf('export default function PlanCalendar') + 400)
    expect(outer, "PlanCalendar's default").toContain("moveMode = 'tap'")
    const inner = CAL.slice(CAL.indexOf('function WeekCard({'), CAL.indexOf('function WeekCard({') + 400)
    expect(inner, "WeekCard's default — a second door to the same room").toContain("moveMode = 'tap'")
  })

  it('the Plan screen passes no moveMode, so it gets the default', () => {
    expect(strip(read('app/dashboard/DashboardClient.tsx'))).not.toMatch(/moveMode=/)
  })

  it('the preview page 404s in production', () => {
    expect(PAGE).toMatch(/process\.env\.NODE_ENV === 'production'\) notFound\(\)/)
  })

  it('and it writes nothing', () => {
    expect(PAGE).toContain('onOverrideChange={() => {}}')
  })
})

describe('🔴 drag stages — it does not write on release', () => {
  it('the drop calls the SAME handler the tap flow calls', () => {
    // The 2026-06-26 root cause was a runner who did not realise the thing he
    // did was a move. A drop IS a commit gesture, so drag that wrote on release
    // would re-open it — and the comparison would be a safe flow against an
    // unsafe one, reporting that the unsafe one is faster.
    const i = CAL.indexOf('function onRowPointerUp')
    expect(i).toBeGreaterThan(-1)
    const fn = CAL.slice(i, CAL.indexOf('\n  }', i))
    expect(fn).toContain('handleTargetTap(target)')
    // Never the write path directly.
    expect(fn).not.toMatch(/\bonMove\(|\bonSwap\(/)
  })

  it('there is exactly one confirmation row, shared', () => {
    expect(CAL.match(/setPendingMove\(\{/g) ?? []).toHaveLength(1)
  })
})

describe('🔴 the instrument does not favour either gesture', () => {
  it('the clock starts at FIRST TOUCH, not when the press arms', () => {
    // Measured on the prototype before anyone used it: a 450ms hold plus a move
    // reported 162 ms, because the clock started inside the press timer. Drag
    // was being timed from 350ms in while tap was timed from the finger
    // landing — under-reporting drag by exactly the cost under test.
    const i = CAL.indexOf('function onRowPointerDown')
    const fn = CAL.slice(i, CAL.indexOf('\n  }', i))
    const beginAt = fn.indexOf('beginAttempt()')
    const timerAt = fn.indexOf('setTimeout(')
    expect(beginAt, 'beginAttempt must be in onRowPointerDown').toBeGreaterThan(-1)
    expect(beginAt, 'and BEFORE the press timer, not inside it').toBeLessThan(timerAt)
  })

  it('a scroll is discarded, not logged as an abandoned attempt', () => {
    // Otherwise every flick down the list inflates drag's abandon rate, and the
    // number becomes a count of scrolling.
    const i = CAL.indexOf('function clearPress')
    const fn = CAL.slice(i, CAL.indexOf('\n  }', i))
    expect(fn).toContain('attempt.current = null')
  })

  it('the tap flow is instrumented too', () => {
    // An instrument that only counts one side is not a comparison.
    const i = CAL.indexOf('function handleMoveIconTap')
    expect(CAL.slice(i, i + 200)).toContain('countInteraction()')
  })

  it('misses are counted — the cost Wroblewski named', () => {
    const i = CAL.indexOf('function onRowPointerUp')
    expect(CAL.slice(i, CAL.indexOf('\n  }', i))).toContain('misses += 1')
  })
})

describe('the gesture does not steal the list', () => {
  it('touch-action is suppressed only while a drag is IN FLIGHT', () => {
    // Setting it up front would kill scrolling on the whole list, which is the
    // objection this prototype exists to test, not to dodge.
    expect(CAL).toMatch(/touchAction: dragMode && isMoving \? 'none' : undefined/)
  })

  it('moving before the press arms stands the press down', () => {
    const i = CAL.indexOf('function onRowPointerMove')
    const fn = CAL.slice(i, CAL.indexOf('\n  }', i))
    expect(fn).toContain('PRESS_SLOP_PX')
    expect(fn).toContain('clearPress()')
  })

  it('the drop target is hit-tested against the DOM, not computed', () => {
    // Rest rows are SHORTER than session rows, so arithmetic on row heights
    // would be wrong on exactly the empty slots a move aims at most.
    expect(CAL).toContain('elementFromPoint')
    expect(CAL).toContain('[data-daykey]')
  })
})
