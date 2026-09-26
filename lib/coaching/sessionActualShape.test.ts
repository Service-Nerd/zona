import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { formatDistance } from '../format'

/**
 * SESSION-ACTUAL-SHAPE-01 — the session detail's ACTUAL column read the DB's
 * column names off an object already marshalled into Strava's API names.
 *
 * 🔴 WHAT THE RUNNER SAW: **"NaNmi"**. `linkedRun.distance_m` is `undefined` on
 * the marshalled shape (it is `distance`), `undefined / 1000` is NaN,
 * **`NaN != null` is TRUE** so the render guard passed, and `"NaN" + "mi"`
 * reached the screen. The duration row was silently absent for the same reason
 * (`moving_time_s` vs `moving_time`), and HR only looked fine because
 * `completion.avg_hr` is tried before `linkedRun.avg_hr`.
 *
 * 🔴 AND THE SECOND DEFECT WAS THE WORSE ONE: `${actualDistKm}${preferredUnits}`
 * put a KILOMETRE number next to the user's UNIT LABEL, bypassing
 * `formatDistance` — while the Planned column two blocks above called it
 * correctly. A miles user saw **8.1mi for an 8.05 km run** when the truth is
 * 5.0 mi. The NaN was visible; the wrong number was not.
 *
 * ⚠️ LATENT SINCE 2026-06-08, ACTIVATED 2026-09-22. The consumer was written two
 * days after the marshaller. `HK-ELEV-COLUMN-01` had the query asking for
 * `total_elevation_gain` against a column named `elevation_gain`, so it loaded
 * ZERO HealthKit runs for three and a half months — `linkedRun` was always
 * undefined and the correct fallback ran. **Fixing that column woke a dead
 * consumer.** Inverse of "a reserved field gains a producer".
 */
const ROOT = path.resolve(__dirname, '../..')
const RAW = fs.readFileSync(path.join(ROOT, 'app/dashboard/DashboardClient.tsx'), 'utf8')

/**
 * ⚠️ COMMENTS ARE BLANKED BEFORE MATCHING, PRESERVING NEWLINES.
 *
 * 🔴 The first cut of this file failed on its OWN documentation: the comment
 * explaining the defect quotes the broken expression verbatim, and the negative
 * assertion matched the quote. The pre-commit colour guard did the identical
 * thing an hour earlier, blocking a comment that recorded a measured value.
 * **A guard that fires on prose describing the bug it guards gets switched off**,
 * which this repo records as equivalent to having no guard.
 *
 * Newlines are preserved so reported line numbers stay true. A line-comment
 * pattern that also swallows the newline is a defect this repo has already had.
 *
 * 🔴 And this very comment broke the file on its first write: the pattern it
 * quoted contained a comment TERMINATOR, so the JSDoc closed itself mid-sentence
 * and the prose became code. Written out, not worked around silently.
 */
const blank = (m: string) => m.replace(/[^\n]/g, '')
const SRC = RAW
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
  .replace(/^[ \t]*\/\/.*$/gm, '')

/** The shape the four marshalling sites actually emit. */
const marshalledHkRun = {
  id: 'hk-uuid-1',
  source: 'apple_health' as const,
  distance: 8047,          // metres — `distance`, NOT `distance_m`
  moving_time: 2680,       // seconds — `moving_time`, NOT `moving_time_s`
  average_heartrate: 132,  // NOT `avg_hr`
}

describe('SESSION-ACTUAL-SHAPE-01', () => {
  it('🔴 the fixture proves the bug: the DB names are ABSENT from the marshalled shape', () => {
    // If this ever passes trivially the fixture has drifted from the producers
    // and every arm below becomes theatre.
    expect((marshalledHkRun as Record<string, unknown>).distance_m).toBeUndefined()
    expect((marshalledHkRun as Record<string, unknown>).moving_time_s).toBeUndefined()
    expect((marshalledHkRun as Record<string, unknown>).avg_hr).toBeUndefined()
  })

  it('🔴 the old expression produced NaN, and `!= null` could not catch it', () => {
    // The exact arithmetic that shipped. This is the fails-before half.
    // ⚠️ `as unknown as` — `vitest` DOES NOT TYPECHECK, so the first cut passed
    // the suite and failed `tsc` (TS2352). A documented trap in this repo, hit
    // twice today. The suite being green is not the build being green.
    const old = +((( marshalledHkRun as unknown as Record<string, number>).distance_m) / 1000).toFixed(1)
    expect(Number.isNaN(old)).toBe(true)
    expect(old != null).toBe(true)            // ← the guard that let it render
    expect(`${old}mi`).toBe('NaNmi')          // ← what the founder photographed
    // …and `Number.isFinite`, which the fix uses, does catch it.
    expect(Number.isFinite(old)).toBe(false)
  })

  it('🔴 the new path yields a real distance IN THE USER\'S UNITS', () => {
    const km = marshalledHkRun.distance / 1000
    expect(Number.isFinite(km)).toBe(true)
    // 8.047 km is 5 miles. The OLD code printed the km number with "mi" after
    // it — 8.0mi — a 61% overstatement of what the runner actually ran.
    expect(formatDistance(km, 'mi')).toBe('5mi')
    expect(formatDistance(km, 'km')).toBe('8km')
    expect(formatDistance(km, 'mi')).not.toContain('NaN')
  })

  it('🔴 the duration row comes back', () => {
    expect(Number.isFinite(marshalledHkRun.moving_time)).toBe(true)
    expect(Math.round(marshalledHkRun.moving_time / 60)).toBe(45)
    // the old read
    expect((marshalledHkRun as Record<string, unknown>).moving_time_s).toBeUndefined()
  })

  it('🔴 THE CLASS GATE: no DB column name is read off a marshalled run', () => {
    // Four producers rename; one consumer read the pre-rename names. That is
    // mechanically checkable, so it is checked — otherwise the next consumer
    // written against the DB schema makes the same mistake and it is invisible
    // again until a runner photographs it.
    //
    // ⚠️ Bound the region: only reads off `linkedRun`, never a bare grep for the
    // column names, which appear legitimately at the producer sites and in
    // direct `strava_activities` queries.
    const offenders = Array.from(
      SRC.matchAll(/linkedRun[?]?\.(distance_m|moving_time_s|avg_hr|elevation_gain|start_date_local)\b/g)
    ).map(m => `${m[0]} — the marshalled shape calls it something else`)
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('🔴 the ACTUAL distance goes through the OWNER (ADR-015)', () => {
    // `lib/format.ts` is the sole owner of every distance string. The Planned
    // column always called it; the Actual column concatenated a raw number with
    // a unit label.
    const i = SRC.indexOf('const actualDistKm')
    expect(i, 'the ACTUAL block has moved — re-anchor this test').toBeGreaterThan(-1)
    const block = SRC.slice(i, i + 7000)  // measured: declaration -> render is 5688 chars
    expect(block, 'the actual distance must be formatted by the owner')
      .toMatch(/formatDistance\(actualDistKm as number, preferredUnits\)/)
    expect(block, 'a raw value next to a unit label is the ADR-015 violation')
      .not.toMatch(/\$\{actualDistKm\}\$\{preferredUnits\}/)
  })
})
