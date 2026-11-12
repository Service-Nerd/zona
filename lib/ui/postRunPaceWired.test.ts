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
    expect(SRC).toContain("'avg_hr, start_date, moving_time_s, avg_speed")  // UNMEASURED-DISTANCE-01 appended the distance columns
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
    //
    // ⚠️ BOUNDED BY ITS OWN SYNTAX, NEVER BY A CHARACTER COUNT. This read `SRC.slice(i, i + 600)`
    // and went red on `ACT-FREE-TEASE-01`, which added a `setZoneRow({...})` with its comment
    // between the two things this arm looks for — pushing `if (isHK) {` past 600 characters.
    // Nothing about the property under test had changed. **A fixed lookback is a region bound
    // that drifts whenever anything near it grows**, which is the same class as the 200- and
    // 600-character windows this repo has already recorded, and it reports the right answer for
    // the wrong reason in whichever direction the file happens to move.
    //
    // The region is the handler block that `setAvgSpeedMs(` opens: from that call to the closing
    // of its enclosing `if (!cancelled && act) {`, found by brace balance.
    const i = SRC.indexOf('setAvgSpeedMs(')
    expect(i, 'the speed write is gone entirely').toBeGreaterThan(-1)
    const open = SRC.lastIndexOf('if (!cancelled && act) {', i)
    expect(open, 'the enclosing hydration block moved or was renamed').toBeGreaterThan(-1)
    let depth = 0, end = -1
    for (let k = SRC.indexOf('{', open); k < SRC.length; k++) {
      if (SRC[k] === '{') depth++
      else if (SRC[k] === '}') { depth--; if (depth === 0) { end = k; break } }
    }
    expect(end, 'could not balance the hydration block — unverified is not a pass').toBeGreaterThan(i)
    const block = SRC.slice(i, end)
    expect(block).toContain('if (isHK) {')
    expect(block).toContain('setHrPendingActivity({')
  })

  it('SessionScreen, the twin that was always right, is unchanged', () => {
    expect(SRC).toContain('actualAvgSpeedMs={linkedAct?.average_speed ?? null}')
  })
})
