import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// POSTRUN-PACE-NULL-01 (2026-10-07) — the post-run card must be handed the pace
// that was actually run.
//
// `PostRunScreen` rendered `<RunFeedbackCard actualAvgSpeedMs={null} />` HARDCODED,
// so `buildScoreExplanations` fell to its `else if (paceTarget)` branch and the Pace
// row read "Target 5:07–5:22 /km." with no actual — forever, on the screen a runner
// lands on straight after finishing. `SessionScreen` passed the real value all along:
// eleventh recorded instance of the one-twin class.
//
// ⚠️ THIS ARM IS SOURCE-SHAPED AND THAT IS A LIMIT, NOT A PREFERENCE.
// `buildScoreExplanations` and `PostRunScreen` both live inside a 14k-line
// `'use client'` module, and `vitest.config.ts` is `environment: 'node'` with no
// jsdom — neither can be mounted or imported here without dragging the whole app in.
// So the check is narrow by construction: it proves the LITERAL is gone and a real
// value is passed. It does NOT prove the rendered sentence is right.
// `/post-run-preview` is where that is looked at, by eye.

const SRC = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')

/** Bound the region: the props of the RunFeedbackCard inside PostRunScreen. */
function postRunFeedbackCardProps(): string {
  const screen = SRC.indexOf('function PostRunScreen(')
  expect(screen, 'PostRunScreen not found — this check has stopped looking').toBeGreaterThan(-1)
  const card = SRC.indexOf('<RunFeedbackCard', screen)
  expect(card, 'PostRunScreen no longer renders RunFeedbackCard').toBeGreaterThan(-1)
  return SRC.slice(card, SRC.indexOf('/>', card))
}

describe('POSTRUN-PACE-NULL-01 — the post-run card gets the real pace', () => {
  it('PostRunScreen passes a value, not a hardcoded null', () => {
    const props = postRunFeedbackCardProps()
    expect(props).toContain('actualAvgSpeedMs={avgSpeedMs}')
    expect(props, 'the hardcoded null is back').not.toContain('actualAvgSpeedMs={null}')
  })

  it('and that value is read from the activity, not invented', () => {
    expect(SRC).toContain("setAvgSpeedMs((act.avg_speed as number | null) ?? null)")
    // The column must actually be selected, or avg_speed is undefined forever.
    expect(SRC).toContain("'avg_hr, start_date, moving_time_s, avg_speed'")
  })

  it('the speed read covers a STRAVA-linked completion too, not only HealthKit', () => {
    // The one-twin trap again: fixing only the HK branch would leave Strava-linked
    // runs with no actual pace, which is the same defect in a narrower population.
    expect(SRC).toContain("q.eq('strava_activity_id', row.strava_activity_id)")
    expect(SRC).toContain('strava_activity_name, strava_activity_km, apple_health_uuid, strava_activity_id')
  })

  it('the HR-pending gate stays HealthKit-only', () => {
    // `classifyHrPending` is about HealthKit's late HR delivery and is meaningless
    // for Strava. Generalising the SPEED read must not generalise that.
    const i = SRC.indexOf('setAvgSpeedMs(')
    const after = SRC.slice(i, i + 600)
    expect(after).toContain('if (isHK) {')
    expect(after).toContain('setHrPendingActivity({')
  })

  it('SessionScreen, the twin that was always right, is unchanged', () => {
    expect(SRC).toContain('actualAvgSpeedMs={linkedAct?.average_speed ?? null}')
  })
})
