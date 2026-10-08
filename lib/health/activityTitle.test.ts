// ACTIVITY-NAME-WRITER-01 — the app that WROTE the workout is not the run's title.
//
// 🔴 THE DEFECT, MEASURED IN PRODUCTION 2026-10-08. `lib/health/adapter.ts` stored
// `name: payload.sourceName ? \`Run (${payload.sourceName})\` : 'Run'`, and `sourceName`
// is whatever pushed the workout into Apple Health. So:
//
//   strava_activities:    229 apple_health rows · 225 carry a fabricated name (98.3%)
//     Run (Connect) x107 · Run (Strava) x51 · Run (Runna) x11 · Run (Nike Run Club) x5
//     Run (Ollie’s Apple Watch) x16 · Run (Kellie’s) x13 · Run (Grace’s) x11 · (Clay’s) x7
//   session_completions:  37 of 200 names fabricated, copied by the two link writers
//
// ⚠️ TWO THINGS THAT ONLY THE MEASUREMENT SHOWS.
//   1. `Run (Strava) x51` — a HealthKit row whose WRITER was the Strava app, rendering
//      "Run (Strava)" directly above a subtitle that reads "Apple Health".
//   2. **47 rows name a PERSON.** Each is that runner's own device, so nothing leaks
//      across users, but a first name occupies the loudest line on the row and nobody
//      chose to put it there.
//
// 🥇 AND `plain 'Run': 0` IS THE FINDING THAT DECIDED THE DESIGN. Not one stored HK row
// carries an unfabricated name, so a predicate that sniffed the STRING would have fixed
// nothing for existing data — the adapter fix only reaches rows ingested after it
// deploys. Reading `source` is correct for the 225 already stored AND for every new one.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runnerAuthoredTitle } from './activityTitle'

/** Verbatim from `strava_activities`, 2026-10-08. */
const FABRICATED = [
  'Run (Connect)', 'Run (Strava)', 'Run (Runna)', 'Run (Nike Run Club)',
  'Run (Ollie’s Apple Watch)', 'Run (Kellie’s Apple Watch)',
]

describe('runnerAuthoredTitle — only the runner writes a title', () => {
  it('🔴 a HealthKit run has NO title, whatever is stored on it', () => {
    for (const name of [...FABRICATED, 'Run', null, undefined, '']) {
      expect(runnerAuthoredTitle('apple_health', name)).toBeNull()
    }
  })

  it('a Strava activity’s name is the runner’s own and survives', () => {
    expect(runnerAuthoredTitle('strava', 'Morning Run')).toBe('Morning Run')
    expect(runnerAuthoredTitle('strava', 'Parkrun PB 🎉')).toBe('Parkrun PB 🎉')
  })

  it('a bare "Run" is Strava’s default, not a decision', () => {
    // It carries nothing the detail line does not already say.
    expect(runnerAuthoredTitle('strava', 'Run')).toBeNull()
    expect(runnerAuthoredTitle('strava', '  Run  ')).toBeNull()
  })

  it('absent, empty and whitespace all read as no title', () => {
    for (const n of [null, undefined, '', '   ']) {
      expect(runnerAuthoredTitle('strava', n)).toBeNull()
    }
  })

  it('trims, so a stray space cannot make a title out of nothing', () => {
    expect(runnerAuthoredTitle('strava', '  Morning Run ')).toBe('Morning Run')
  })

  // ⚠️ An unknown source is treated as runner-authored, which is the SAFE direction:
  // 'manual' rows carry what the runner typed into ManualRunModal.
  it('a manual row’s name is the runner’s, because the runner typed it', () => {
    expect(runnerAuthoredTitle('manual', 'Treadmill, legs dead')).toBe('Treadmill, legs dead')
  })
})

describe('the writers store a title or NOTHING, never a fabrication', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

  it('🔴 the adapter no longer interpolates sourceName into the name', () => {
    const src = read('lib/health/adapter.ts')
    expect(src).not.toMatch(/name:\s*payload\.sourceName/)
    expect(src).not.toContain('`Run (${payload.sourceName})`')
    expect(src).toMatch(/name:\s+'Run',/)
  })

  it('…and sourceName is STILL STORED as provenance, which is its real job', () => {
    // ADR-011: `source` is provenance, not authority. Nothing is lost by not
    // presenting it as a title — `source_name` keeps the column it belongs in.
    expect(read('app/api/health/ingest/route.ts')).toContain('source_name:      payload.sourceName ?? null')
  })

  it('the auto-link writer routes through the predicate', () => {
    const src = read('lib/coaching/autoAnalyse.ts')
    expect(src).toContain('strava_activity_name: runnerAuthoredTitle(')
    expect(src).not.toMatch(/strava_activity_name:\s*activity\.name \?\? null/)
  })

  it('the manual-link writer routes through the predicate', () => {
    const src = read('components/dashboard/SessionPopupInner.tsx')
    expect(src).toContain('strava_activity_name: runnerAuthoredTitle(activity.source, activity.name)')
    expect(src).not.toMatch(/strava_activity_name:\s*activity\.name \?\? null/)
  })

  it('both writers exist — the count is the claim', () => {
    // ⚠️ `THE REMEDY WAS APPLIED TO ONE TWIN` is this repo's most-recorded class
    // (eight incidents). Two writers copy this column; both are fixed, and this
    // arm fails if a third appears carrying the old shape.
    const hits = ['lib/coaching/autoAnalyse.ts', 'components/dashboard/SessionPopupInner.tsx']
      .filter(p => read(p).includes('strava_activity_name: runnerAuthoredTitle('))
    expect(hits).toHaveLength(2)
  })
})

describe('the render sites lead with the fact, not the fabrication', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

  it('the link picker renders a title only when there IS one', () => {
    const src = read('components/dashboard/SessionPopupInner.tsx')
    expect(src).toContain('{runnerAuthoredTitle(run.source, run.name) && (')
    // 🔴 The pre-fix form: the name rendered unconditionally in the prominent slot.
    expect(src).not.toMatch(/fontWeight: 500 \}\}>\{run\.name\}<\/div>/)
  })

  it('…and the detail line takes the primary treatment when it IS the primary line', () => {
    const src = read('components/dashboard/SessionPopupInner.tsx')
    expect(src).toContain("fontSize:   runnerAuthoredTitle(run.source, run.name) ? '10px' : '13px'")
  })

  // 🔴 THE ARM THAT MATTERS MOST, because fixing the writers alone would have caused it.
  it('PlanCalendar’s confirmation line survives a null name, WITH the distance', () => {
    const src = read('components/training/PlanCalendar.tsx')
    expect(src).toContain("{isComplete && (completion?.strava_activity_name || completion?.strava_activity_km) && (")
    // The pre-fix gate required the name, so a null name dropped the distance too.
    expect(src).not.toContain('{isComplete && completion?.strava_activity_name && (')
  })

  it('SessionCard was never affected, and the reason is worth keeping', () => {
    // It gates on `viaStrava` (= `!!strava_activity_id`), so a HealthKit completion
    // never reached it. One consumer of four was already correct by construction;
    // asserting that stops a later "tidy-up" from removing the gate.
    const src = read('components/shared/SessionCard.tsx')
    expect(src).toContain("completion?.viaStrava && completion?.activityName")
  })
})
