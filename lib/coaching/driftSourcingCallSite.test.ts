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
  // Anchored on the FIRST declaration of the block, not the function name, and widened
  // twice for the same reason both times: the readiness guard sits BEFORE the call
  // (`!overridesReady ? [] : driftRowsFromActivities(...)`), and the code-review round
  // hoisted `isAnalysedRow` / `runRows` above it too. A region that starts at the call
  // silently drops the very arms written for the code around it — which is how the
  // `isRun` arm went red on a change that kept `isRun`.
  const i = DC.indexOf('const isAnalysedRow')
  expect(i, '§12 Am. 5 call site not found — this check has stopped looking').toBeGreaterThan(-1)
  expect(DC.indexOf('const prescribedDriftRows', i)).toBeGreaterThan(i)
  expect(DC.indexOf('driftRowsFromActivities(', i)).toBeGreaterThan(i)
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

  // ── The code-review round's three call-site findings ──────────────────────
  it('passes the LONG-RUN fact from isLongRun, because the type cannot answer it', () => {
    // 537 of 2,054 stored `easy` sessions (26.1%) are long runs, and the amendment's own
    // text claimed they were excluded while nothing excluded them.
    expect(driftCall()).toMatch(/isLongRun: r\.session \? isLongRun\(/)
  })

  it('judges ALREADY-ANALYSED on the duplicate GROUP, not on the dedupe survivor', () => {
    // `dedupeRuns` keeps the LONGER copy and the copies carry different ids, so checking
    // only the survivor double-counts the run whose kept copy was never scored. The owner
    // is used as the grouping predicate rather than re-implemented.
    expect(driftCall()).toMatch(/dedupeRuns\(\[\.\.\.analysedDeduped, a\] as any\)\.length === analysedDeduped\.length/)
  })

  it('orders the analysis query LIVE-FIRST, not on week_n alone', () => {
    // Fixing the owner's sort while the query still truncated on `week_n` left the same
    // defect one layer out: superseded rows numbered weeks 15-35 can fill the 60-row
    // window before the live block is ever read.
    // ⚠️ Anchored on the DRIFT query's own select, not on the first `from('run_analysis')`
    // in the file — there are several, and the first one is a different read entirely.
    const at = DC.indexOf("'week_n, session_day, source, session_type, hr_above_ceiling_pct")
    expect(at, 'the drift query select no longer matches — this check has stopped looking').toBeGreaterThan(-1)
    const region = stripComments(DC.slice(at, at + 1200))
    expect(region).toMatch(/\.order\('superseded_at', \{ ascending: true, nullsFirst: true \}\)/)
    expect(region.indexOf("superseded_at', { ascending")).toBeLessThan(region.indexOf("'week_n', { ascending"))
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
