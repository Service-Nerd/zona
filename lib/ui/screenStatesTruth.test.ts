import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { weeksWithoutStatedDistance } from '@/lib/plan/sessionDistance'

/**
 * Design Board 2026-11-14 — the "a screen states something untrue" cluster.
 *
 * 🧭 Two rulings, one rule: a surface may not state a value it does not govern. That is this
 * morning's `MODIFY-WEEKDAY-INERT-01` pattern applied to DISPLAYS rather than controls.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('HERO-WALKRUN-TOTAL-01 — a total that omits weeks is not a total', () => {
  it('counts the weeks whose distance the plan does not state', () => {
    expect(weeksWithoutStatedDistance({ weeks: [{ weekly_km: 10 }, { weekly_km: 12 }] })).toBe(0)
    // A §116 walk-run week carries NO `weekly_km` by ratified doctrine — it is time on feet.
    expect(weeksWithoutStatedDistance({ weeks: [{ weekly_km: null }, { weekly_km: 12 }] })).toBe(1)
    expect(weeksWithoutStatedDistance({ weeks: [{}, {}, { weekly_km: 5 }] })).toBe(2)
  })

  it('is robust to the shapes a stored plan actually has', () => {
    expect(weeksWithoutStatedDistance({ weeks: [] })).toBe(0)
    expect(weeksWithoutStatedDistance({ weeks: null })).toBe(0)
    expect(weeksWithoutStatedDistance({})).toBe(0)
  })

  it('🔴 the hero WITHHOLDS the total rather than summing past the gap', () => {
    const src = read('components/shared/PlanHeroMetrics.tsx')
    // 🔴 KEYED ON THE ABSENCE OF A DISTANCE, NOT ON A PLAN KIND. The 2026-10-25 ruling keyed on
    // `stagedRaceOf`, so a §118 walk-run plan — which has no `staged_race` — fell through to the
    // generic hero the ruling was written to avoid. Keying on the plan kind is how that happened,
    // so this arm fails if the withholding is reintroduced that way.
    expect(src, 'the hero no longer consults the unstated-week count').toMatch(/weeksWithoutStatedDistance\s*\(/)
    expect(src, "the total must be gated on the count, not on a plan kind")
      .toMatch(/unstatedWeeks\s*===\s*0[\s\S]{0,160}'in total'/)
  })
})

describe('CALENDAR-DONE-DOT-SOURCE-01 — the ● is a done mark', () => {
  const src = read('components/training/PlanCalendar.tsx')

  it('🔴 does not paint the completion dot in the Strava colour', () => {
    // 📐 ~98% of logged runs are Apple Health and this line renders for EVERY logged run, so
    // `--strava` claimed a provenance the run did not have.
    const dot = /<span aria-hidden="true" style=\{\{ color: 'var\(--([a-z-]+)\)' \}\}>●/.exec(src)
    expect(dot, 'the completion dot is gone from the calendar').toBeTruthy()
    expect(dot![1], 'the ● claims a source again').not.toBe('strava')
    // ⚠️ `moss-STRONG`, not `moss`: ACCENT-TEXT-CONTRAST-01 (6t-g) rules a hue is never small
    // text and takes its ratified `-strong` shade, and this line is 10px. My first cut used
    // `--moss` and `accentText.test.ts` — a gate from the board's own earlier ruling — caught it.
    expect(dot![1], 'done takes the completion colour at its ratified small-text shade').toBe('moss-strong')
  })

  it('keeps the confirmation LINE for every source — only the colour made a claim', () => {
    // ⚠️ Gating the line on `viaStrava` here would drop the distance from ~98% of logged runs,
    // which is the confirmation the line exists to give (ACTIVITY-NAME-WRITER-01).
    expect(src).toMatch(/strava_activity_name\s*\|\|\s*completion\?\.strava_activity_km/)
  })

  it('leaves the surface that DOES attribute alone — it was already correct', () => {
    expect(read('components/shared/SessionCard.tsx'))
      .toMatch(/completion\?\.viaStrava\s*&&\s*completion\?\.activityName/)
  })
})
