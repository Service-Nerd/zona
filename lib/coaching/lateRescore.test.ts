// HR-LATE-RESCORE-01 — HR that lands after the fresh window re-scores the run
// without regenerating the narrative.
//
// THE REAL-WORLD PATH, and why it is not an edge case: Garmin feeds Apple
// Health, and Garmin also feeds Strava which feeds Apple Health. HR can be DAYS
// behind the workout shell.
//
// WHAT WAS BROKEN. `decideLateArrival` splits on PENDING_HR_WINDOW_HOURS. Inside
// the window, analyse-run re-fires and the run is re-scored. Outside it, the
// gate's own comment promises the patch still serves "the zone ledger, weekly
// report, fitness signals" — but the patch writes `strava_activities` and every
// one of those consumers reads `run_analysis`. So a >24h arrival left the
// analysis row permanently HR-null. Measured 2026-09-13: 1 of 12 no-HR analyses
// stranded, with the HR sitting in the activity row beside it.
//
// §108 Amendment 1 then made it visible: the score is WITHHELD when HR is
// unmeasured, so that run shows no score forever despite having HR.
//
// THE SPLIT. Hutchinson's rule is that two-day-stale COACHING is dishonest. A
// score is deterministic arithmetic over stored columns and does not go stale.
// `scores_only` recomputes the numbers and skips the AI call.
//
// ⚠️ The property that matters most is tested first: the upsert must OMIT
// `feedback_text`, not send null. Sending null would DELETE the runner's
// existing coach note — the exact opposite of what the gate protects.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { decideLateArrival } from './lateArrivalGate'
import { PENDING_HR_WINDOW_HOURS } from './hrPending'

const HOUR = 60 * 60 * 1000

/**
 * The upsert-row shape analyse-run builds, reduced to the branch under test.
 * Mirrors the spread in `app/api/analyse-run/route.ts` exactly: under
 * `scores_only` the key is absent, otherwise it carries the value.
 */
function buildAnalysisRow(scoresOnly: boolean, feedbackText: string | null) {
  return {
    hr_discipline_score: 92,
    total_score: 88,
    verdict: 'nailed',
    ...(scoresOnly ? {} : { feedback_text: feedbackText }),
  } as Record<string, unknown>
}

describe('HR-LATE-RESCORE-01 — numbers are recomputed, the narrative is not', () => {
  it('scores_only OMITS feedback_text so an upsert cannot delete the coach note', () => {
    const row = buildAnalysisRow(true, null)
    // `in` rather than a null check: on an upsert, present-and-null WIPES the
    // column. Absent leaves it alone. That distinction is the whole fix.
    expect('feedback_text' in row, 'the key must be absent, not null').toBe(false)
    expect(row.total_score, 'but the numbers are written').toBe(88)
    expect(row.verdict).toBe('nailed')
  })

  it('a normal analysis still writes feedback_text', () => {
    const row = buildAnalysisRow(false, 'No heart rate, so this one goes unscored.')
    expect('feedback_text' in row).toBe(true)
    expect(row.feedback_text).toBe('No heart rate, so this one goes unscored.')
  })

  it('a normal analysis writes null when the AI failed — silent fallback preserved', () => {
    // ADR-006: enricher failure is silent and the scoring row lands regardless.
    // scores_only must not change that behaviour for the fresh path.
    const row = buildAnalysisRow(false, null)
    expect('feedback_text' in row).toBe(true)
    expect(row.feedback_text).toBeNull()
  })
})

describe('the guard is against the REAL route, not a mirror of it', () => {
  // `buildAnalysisRow` above is a mirror, and a mirror proves the mirror. These
  // read the shipped source, because the regression that matters is someone
  // changing the spread back to `feedback_text: feedbackText` — which would
  // delete a runner's coach note on every late re-score, silently.
  const routeSrc = readFileSync(
    join(process.cwd(), 'app/api/analyse-run/route.ts'), 'utf8')
  const ingestSrc = readFileSync(
    join(process.cwd(), 'app/api/health/ingest/route.ts'), 'utf8')

  it('analyse-run spreads feedback_text conditionally, never assigns it flat', () => {
    expect(
      routeSrc,
      'feedback_text must be spread under scores_only, or a late re-score wipes the note',
    ).toContain("...(scores_only ? {} : { feedback_text: feedbackText })")
    expect(
      /^\s*feedback_text:\s*feedbackText,\s*$/m.test(routeSrc),
      'a flat `feedback_text: feedbackText,` assignment has come back',
    ).toBe(false)
  })

  it('analyse-run skips the AI block under scores_only', () => {
    expect(routeSrc).toContain('if (!scores_only) try {')
  })

  it('the ingest path no longer gates the re-score on the fresh window', () => {
    // The defect was `if (wasHrAbsent && lateArrival?.withinFreshWindow)` — the
    // stale branch did nothing at all to run_analysis.
    expect(
      /if \(wasHrAbsent && lateArrival\?\.withinFreshWindow\)/.test(ingestSrc),
      'the stale branch is being skipped again',
    ).toBe(false)
    expect(ingestSrc).toContain('!lateArrival.withinFreshWindow))')
  })

  it('the consolidate path passes scoresOnly too', () => {
    expect(ingestSrc).toContain('dedup.withinFreshWindow === false')
  })
})

describe('the gate still decides WHICH mode, and that has not moved', () => {
  const start = '2026-09-10T08:00:00.000Z'
  const durationSeconds = 3600

  it('HR inside the window is a fresh coaching moment', () => {
    const now = new Date(new Date(start).getTime() + durationSeconds * 1000 + 2 * HOUR)
    expect(decideLateArrival({ workoutStartIso: start, durationSeconds }, now).withinFreshWindow).toBe(true)
  })

  it('HR days later is not', () => {
    const now = new Date(new Date(start).getTime() + (PENDING_HR_WINDOW_HOURS + 24) * HOUR)
    const d = decideLateArrival({ workoutStartIso: start, durationSeconds }, now)
    expect(d.withinFreshWindow).toBe(false)
    // The Garmin -> Strava -> Health case, stated as a number.
    expect(d.secondsSinceEnd / 3600).toBeGreaterThan(PENDING_HR_WINDOW_HOURS)
  })

  it('an unparseable start date is treated as fresh, not dropped', () => {
    // Pre-existing behaviour, asserted here because the late path now DOES
    // something on the stale branch: a parse glitch must not silently route a
    // run into scores-only and lose its narrative forever.
    const d = decideLateArrival({ workoutStartIso: 'not-a-date', durationSeconds }, new Date())
    expect(d.withinFreshWindow).toBe(true)
  })

  it('both branches now trigger a re-score — only the narrative differs', () => {
    // The behavioural change: the stale branch used to do NOTHING to
    // run_analysis. Encoded as the decision the caller makes from the gate.
    const fresh = decideLateArrival(
      { workoutStartIso: start, durationSeconds },
      new Date(new Date(start).getTime() + durationSeconds * 1000 + HOUR),
    )
    const stale = decideLateArrival(
      { workoutStartIso: start, durationSeconds },
      new Date(new Date(start).getTime() + (PENDING_HR_WINDOW_HOURS + 48) * HOUR),
    )
    const scoresOnlyFor = (d: { withinFreshWindow: boolean }) => !d.withinFreshWindow
    expect(scoresOnlyFor(fresh), 'fresh HR gets the full analysis').toBe(false)
    expect(scoresOnlyFor(stale), 'stale HR gets numbers only').toBe(true)
  })
})
