import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { matchEmptyCause, matchEmptyCopy, type MatchEmptyCause } from './matchEmptyCause'

const ALL: MatchEmptyCause[] = ['no_runs', 'none_near_date', 'all_claimed']

describe('MATCH-EMPTY-CAUSE-01 — the picker names the cause it actually has', () => {
  it('an empty pipe is NOT a date problem — the founder case', () => {
    // 17 days, nothing in strava_activities, Workouts permission off.
    expect(matchEmptyCause({ pooled: 0, inWindow: 0 })).toBe('no_runs')
    expect(matchEmptyCopy('no_runs')).not.toMatch(/date/i)
  })

  it('runs exist but none in the window keeps the original, correct message', () => {
    expect(matchEmptyCause({ pooled: 12, inWindow: 0 })).toBe('none_near_date')
    expect(matchEmptyCopy('none_near_date')).toBe('No activities found near this session date')
  })

  it('in-window runs that are all claimed say so', () => {
    expect(matchEmptyCause({ pooled: 12, inWindow: 3 })).toBe('all_claimed')
    expect(matchEmptyCopy('all_claimed')).toMatch(/already linked/)
  })

  it('every cause has its own distinct sentence', () => {
    const copies = ALL.map(matchEmptyCopy)
    expect(new Set(copies).size).toBe(ALL.length)
    for (const c of copies) expect(c.length).toBeGreaterThan(10)
  })

  it('no em dash in any sentence the runner reads', () => {
    // The 2026-09-22 scope: sentences, not session descriptions.
    for (const c of ALL) expect(matchEmptyCopy(c)).not.toContain('—')
  })

  // ⚠️ THE ARM THAT MATTERS, and the one a unit test of a pure function cannot
  // give you: the PICKER has to call it. `matchEmptyCause` could be correct,
  // tested, documented and never reach a screen — the inert-config class this
  // repo has paid for repeatedly. `vitest.config.ts` is `environment: 'node'`
  // with no jsdom, so the call site is asserted at the source. Narrow and
  // honest: it proves the hardcoded string is GONE, which is the regression.
  it('the picker renders the resolved copy and no longer hardcodes one cause', () => {
    const src = readFileSync('components/dashboard/SessionPopupInner.tsx', 'utf8')
    expect(src).toContain('{matchEmptyCopy(emptyCause)}')
    // The old string may only survive inside matchEmptyCopy, never in the JSX.
    expect(src).not.toContain('>No activities found near this session date<')
  })
})
