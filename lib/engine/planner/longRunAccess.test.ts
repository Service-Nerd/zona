// ADR-027 B4e (ADR027-B4E-LONGRUN-ACCESS) — one owner for "the long run of this week".
//
// ✅ AND `verify:parity` IS GENUINE EVIDENCE HERE, which it was not for the previous four bricks.
// These are pure readers invoked on every week of every plan: 📐 measured, `long_run_hrs` is set on
// 15 of 16 weeks of a sample HM plan, so `computeLongRunHrs` runs across essentially the whole
// 6,210-case grid. IDENTICAL therefore means something. Said explicitly because B4a–B4d each came
// back IDENTICAL on a change the grid could not reach, and the difference matters.
//
// What this file gates is the thing parity cannot: that there is still only ONE implementation.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { longRunOf, longRunSessionOf, computeLongRunHrs } from './longRunAccess'
import type { Session, Week } from '@/types/plan'
import type { Day } from '@/lib/plan/days'

const week = (sessions: Partial<Record<Day, Session>>): Week =>
  ({ n: 1, date: '2027-01-04', label: 'W1', theme: '', type: 'normal', phase: 'build',
     weekly_km: 40, long_run_hrs: null, sessions }) as unknown as Week
const long = (over: Partial<Session> = {}) => ({ type: 'long', distance_km: 18, ...over }) as Session
const easy = (over: Partial<Session> = {}) => ({ type: 'easy', distance_km: 8, ...over }) as Session

describe('ADR-027 B4e — the accessor', () => {
  it('finds the long run and the day it sits on', () => {
    const r = longRunOf(week({ tue: easy(), sat: long() }))
    expect(r?.day).toBe('sat')
    expect(r?.session.distance_km).toBe(18)
    expect(longRunSessionOf(week({ tue: easy(), sat: long() }))?.distance_km).toBe(18)
  })

  it('a week with no long run is null, not an invented session', () => {
    expect(longRunOf(week({ tue: easy(), wed: easy() }))).toBeNull()
    expect(longRunSessionOf(week({}))).toBeNull()
    expect(computeLongRunHrs({ tue: easy() }, { minPerKmEasy: 6 } as never)).toBeNull()
  })

  it('🔴 INSERTION ORDER, not day order — preserved deliberately, and it is a fragility', () => {
    // All four replaced copies iterated the object's own key order. Iterating DAY_ORDER would be
    // deterministic by construction and would answer differently for a week carrying two long-run
    // sessions out of calendar order — a prescription change, not a move, so it is NOT done.
    // ⚠️ `lib/scorecard/metrics.ts`'s own `longRunOf` DOES iterate day order over runs only. That is
    // a different question for the measurement layer and must not be merged in.
    const outOfOrder = week({ sat: long({ distance_km: 18 }), wed: long({ distance_km: 14 }) })
    expect(longRunOf(outOfOrder)?.day, 'the first key wins, not the earliest weekday').toBe('sat')
  })

  it('hours come from duration, else distance at the EASY pace, and absence is not zero', () => {
    const pace = { minPerKmEasy: 6 } as never
    expect(computeLongRunHrs({ sat: long({ duration_mins: 90, distance_km: undefined }) }, pace)).toBe(1.5)
    expect(computeLongRunHrs({ sat: long({ distance_km: 18 }) }, pace)).toBe(1.8)  // 18 x 6 = 108 min
    // Neither anchor: null. SESSION-KM-01 — "covered no ground" is not the same as "unknown".
    expect(computeLongRunHrs({ sat: long({ distance_km: undefined }) }, pace)).toBeNull()
  })
})

describe('ADR-027 B4e — one owner, and it is counted', () => {
  const root = process.cwd()

  it('🔴 the old engine holds no implementation of the question any more', () => {
    const code = readFileSync(join(root, 'lib/plan/ruleEngine.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length))
    // 📐 It had FOUR: two local `const longRunOf` of one shape, one of the other, and a module-level
    // `longRunOfWeek`. All behaviourally identical — they agreed by accident of being written the
    // same way four times, which is `DELOAD-OWNER-01`'s setup before it bit.
    expect(code).not.toMatch(/const\s+longRunOf\s*=/)
    expect(code).not.toMatch(/function\s+longRunOfWeek/)
    expect(code).not.toMatch(/function\s+computeLongRunHrs/)
    expect(code, 'the engine must still USE the owner or the move lost its callers')
      .toMatch(/longRunOf\(|longRunSessionOf\(|computeLongRunHrs\(/)
  })

  it('🔴 exactly one implementation across the tracked engine', () => {
    const files = execSync("git ls-files 'lib/plan/*.ts' 'lib/engine/**/*.ts' 'lib/coaching/*.ts'",
      { cwd: root, encoding: 'utf8' }).trim().split('\n')
      .filter(f => f && !f.includes('.test.'))
    expect(files.length, 'the population is empty').toBeGreaterThan(50)
    const impls = files.filter(f => {
      const src = readFileSync(join(root, f), 'utf8')
      return /(const\s+longRunOf\s*=|function\s+longRunOf(Week)?\s*\()/.test(src)
    })
    expect(impls, 'more than one NAMED implementation').toEqual(['lib/engine/planner/longRunAccess.ts'])
  })

  it('🔴 and the count is pinned by SHAPE, because five of the eight had no name', () => {
    // 🔴 THE NAME-BASED ARM ABOVE IS NOT ENOUGH, AND THAT IS NOT A GUESS. I published "FOUR
    // implementations"; code review found four more, five of which were anonymous — a `findLong`, an
    // `lrOf`, and three inline `.find(sn => sn && isLongRun(sn))` expressions. **Third count I got
    // wrong in the same direction in one day** (`sumWeeklyKm`: three → twelve; `weekdayCap`: "the
    // only capacity reader" → one of four). A single-ownership claim has to be counted by shape.
    //
    // ⚠️ THIS COUNTS THE INGREDIENT, NOT THE SHAPE, AND SAYS SO. Parsing "first `isLongRun` match
    // over a week's sessions" needs a parser, not a regex — the repo's own `strip-comments` suite
    // records what happens when a heuristic is asked to lex. So it pins every `isLongRun(` use in
    // the old engine instead. A new one is not automatically a duplicate; it is a prompt to say
    // which question it asks. 📐 As of 2026-11-28 the **17** survivors are — ⚠️ and the first
    // number I wrote here was 18, from a raw `grep` that counted an `isLongRun` inside a COMMENT.
    // `HOOK-RGBA-COMMENTS-01` again, in the same breath as pinning a count by shape:
    //   · 11 PREDICATES — "is this session a long run / not one" (the weekday-cap exemptions, the
    //     easy-run filters, the overrun classifiers). Not finders.
    //   · 2 "EVERY long run in the week" loops (`:4251` takes a max, `applyRacePaceSegmentDuration`
    //     processes each). A different question, and their existence is why a week CAN hold two.
    //   · 2 `.filter(isLongRun)` collections. Different question.
    //   · 1 PLAN-level first-day finder (`:10171`) — across all weeks, not within one. Different.
    //   · 1 unclassified nested loop (`:7924`) — accumulates under a SESSION-KM-01 note; left alone
    //     rather than folded on a guess. **Named here so it is a known gap, not an oversight.**
    const code = readFileSync(join(root, 'lib/plan/ruleEngine.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length))
    const uses = (code.match(/isLongRun\(/g) ?? []).length
    expect(
      uses,
      'the `isLongRun` use count in the old engine moved. If you added a WEEK-LEVEL first-match ' +
      'finder, route it through `longRunOf` / `longRunSessionOf`. If it asks a different question ' +
      '(every long run, a predicate, a filter, plan-level), add it to the category list in this ' +
      'arm with the question it asks. Do not just update the number.',
    ).toBe(17)
  })
})
