// §12 Amendment 5 — the CALL SITE arms, which the owner's own tests cannot reach.
//
// ⚠️ WHY THESE ARE SOURCE ASSERTIONS AND NOT BEHAVIOURAL. `vitest.config.ts` is
// `environment: 'node'` with no jsdom, and the call site is inside a 14k-line
// `'use client'` module that cannot be rendered here. `driftRowsFromActivities` is
// unit-tested properly in `zoneDrift.test.ts`; what CANNOT be tested there is whether
// the one caller hands it the right array. Same trade `SHEET-RAF-FALLBACK-01` recorded,
// and the same declared limit: **a source arm proves the call is written, never that it
// runs.** The three findings below were all real and all invisible to a green suite.
//
// 🔴 COMMENTS ARE STRIPPED FIRST, and must be: every helper name these arms look for is
// also NAMED IN THE COMMENT EXPLAINING WHY IT IS THERE, so an unstripped grep would pass
// on my own prose. That is `HOOK-RGBA-COMMENTS-01`, and `lib/ui/postRunOrder.test.ts`
// records it happening three times in one day.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length))
}

const DC = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')

/**
 * The `driftRowsFromActivities(...)` call, comments stripped and BOUNDED ON BOTH ENDS.
 * An unbounded search of a 14k-line file compares two positions in unrelated screens and
 * calls the result a finding.
 */
function driftCall(): string {
  // Anchored on the DECLARATION, not the function name: the readiness guard sits BEFORE
  // the call (`!overridesReady ? [] : driftRowsFromActivities(...)`), so a region starting
  // at the name silently excluded the very arm written for it.
  const i = DC.indexOf('const prescribedDriftRows')
  expect(DC.indexOf('driftRowsFromActivities(', i)).toBeGreaterThan(i)
  expect(i, '§12 Am. 5 call site not found — this check has stopped looking').toBeGreaterThan(-1)
  const end = DC.indexOf('computeZoneDriftPattern(', i)
  expect(end, 'the call site no longer feeds computeZoneDriftPattern').toBeGreaterThan(i)
  return stripComments(DC.slice(i, end))
}

describe('§12 Am. 5 call site — the three helpers every sibling consumer of recentActivity uses', () => {
  it('filters to RUNS, so a legacy Ride with an HR summary is not read as a failed easy run', () => {
    // Both live ingest paths filter, so this is reachable through legacy rows only — but
    // `ringsSource.test.ts` treats non-run rows on this array as reachable, and the
    // sibling consumers (`weekZoneSplitRows`, `weeklyEasyShares`, `computeLoadPicture`)
    // all apply it to the same array.
    expect(driftCall()).toMatch(/\.filter\(isRun\)/)
  })

  it('dedupes, because the two copies of one run carry DIFFERENT ids', () => {
    // `DUPLICATE_ACTIVITY` measured 4.2% of the production log as duplicate rows for one
    // physical run. Different ids means `alreadyAnalysed` suppresses at most one of them,
    // so two hard runs logged twice reach the 4-of-8 floor by themselves.
    expect(driftCall()).toMatch(/dedupeRuns\(/)
  })

  it('waits for the overrides read, or a MOVED session is judged on the day it left', () => {
    // Until that async read lands `allOverrides` is `[]`, so `getSessionsForDate` resolves
    // the original day. `TodayScreen` gates on this for the same reason.
    expect(driftCall()).toMatch(/overridesReady/)
  })

  it('passes the canonical resolver, never a hand-rolled date test', () => {
    // ADR-016: `getSessionsForDate` is the one owner of "real session on calendar date D?".
    // A second answer here is `MATCH-LIST-WINDOW-01`, which this repo has already paid for.
    expect(driftCall()).toMatch(/getSessionsForDate\(/)
  })

  it('reads the ACTIVITY table’s own share, which is what the amendment turns on', () => {
    expect(driftCall()).toMatch(/hr_above_ceiling_pct/)
    // And the widened select must actually ask for it, or the field is always null.
    const sel = DC.slice(DC.indexOf("from('strava_activities')"))
    expect(stripComments(sel.slice(0, 1200))).toMatch(/select\([^)]*hr_above_ceiling_pct/)
  })
})
