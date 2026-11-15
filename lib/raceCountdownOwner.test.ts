// PLAN-COUNTDOWN-SOURCE-01 — ONE owner for "how long until the race", swept
// over the TREE rather than two hand-named files.
//
// 🔴 WHY A SWEEP. S5 (Design Board, 2026-09-22) consolidated the countdown into
// `lib/format.ts` and shipped a gate — `appReviewWave3.test.ts` — whose
// population is **two string constants**: `DashboardClient.tsx` and
// `PhoneFrame.tsx`. Everything else was outside what it could see, and on
// 2026-11-15 the tree held **eight** hand-rolled copies, four of them
// character-for-character identical and four spellings of the same constant:
//
//   app/api/race-readiness/route.ts         days,  round   the 14-day gate
//   lib/widget/widgetState.ts               days,  round   the iOS home-screen widget
//   app/api/plan-weekly-note/route.ts       weeks, round   AI prompt
//   app/api/daily-coach-note/route.ts       weeks, round   AI prompt
//   lib/coaching/prompts/sessionReframe.ts  weeks, round   AI prompt (sentence 4 states it)
//   lib/coaching/prompts/weeklyReport.ts    weeks, round   AI prompt
//   lib/coaching/weekVoice.ts               weeks, round   rule-engine copy, APP AND WEBSITE
//   components/strava/StravaPanel.tsx       weeks, round   AI race context
//
// ⚠️ SIX WERE FOUND BY READING AND **TWO BY THIS SWEEP ON ITS FIRST RUN** —
// `weekVoice.ts` (which the runner reads verbatim: *"3 weeks out. Stay
// disciplined."*) and `StravaPanel.tsx`. "Three places checked is not nowhere."
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/** Tracked source under app, components, lib and packages. Never the whole repo. */
function sources(): string[] {
  return execFileSync('git', ['ls-files', 'app', 'components', 'lib', 'packages'], { encoding: 'utf8' })
    .split('\n')
    .filter(f => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f))
}

/** The one file allowed to hold the arithmetic. */
const OWNER_FILE = 'lib/format.ts'

// ⚠️ TWO PATTERNS, AND THE SECOND EXISTS BECAUSE THE FIRST MISSED TWO OF THE
// EIGHT. Arm A keys on the race date as a SOURCE — which fails when the local
// is called `race` (the widget) and when the date and the quotient sit on
// separate statements (`plan-weekly-note`). Arm B keys on the DESTINATION name,
// which is the stable thing: all eight assign `daysToRace` or `weeksToRace`.
const ARM_A = /(?:race_date|raceDate|raceDay)[^\n]*getTime\(\)[^\n]*(?:86_?400_?000|24 \* 60 \* 60 \* 1000|60 \* 60 \* 24)/
const ARM_B = /\b(?:days|weeks)ToRace\b[^\n]*(?:Math\.(?:round|ceil|floor)|getTime\(\))/

const offenders = (src: string) =>
  src.split('\n').some(l => !/UntilRace\(/.test(l) && (ARM_A.test(l) || ARM_B.test(l)))

describe('one owner for time-to-race, over the whole tree', () => {
  const files = sources()

  it('🔑 the population is not empty, and it is the tree', () => {
    // `CLEAN — 0 files` was a real first-cut answer to selecting nothing
    // (`sweep-colours.test.sh`). Refuse it here too.
    expect(files.length).toBeGreaterThan(300)
    for (const f of ['app/dashboard/DashboardClient.tsx', 'lib/widget/widgetState.ts',
                     'lib/coaching/weekVoice.ts', 'components/strava/StravaPanel.tsx']) {
      expect(files, `${f} must be inside the population`).toContain(f)
    }
  })

  it('no file outside lib/format.ts differences a race date by hand', () => {
    const hits = files.filter(f => f !== OWNER_FILE && offenders(readFileSync(f, 'utf8')))
    expect(hits, 'route these through daysUntilRace / weeksUntilRace in @/lib/format').toEqual([])
  })

  it('🔴 and the sweep REACHES all eight — each on the real line it replaced', () => {
    // The mutations are the sites' actual previous source, not inventions.
    const previously: [string, string][] = [
      ['app/api/race-readiness/route.ts',
       'const daysToRace = Math.round((raceDay.getTime() - today.getTime()) / 86_400_000)'],
      ['lib/widget/widgetState.ts',
       'daysToRace = Math.max(0, Math.round((race.getTime() - today.getTime()) / 86_400_000))'],
      ['app/api/plan-weekly-note/route.ts',
       'weeksToRace = Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24 * 7)))'],
      ['app/api/daily-coach-note/route.ts',
       'const weeksToRace = plan.meta.race_date ? Math.max(0, Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))) : null'],
      ['lib/coaching/prompts/sessionReframe.ts',
       'const weeksToRace = plan.meta.race_date ? Math.max(0, Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))) : null'],
      ['lib/coaching/prompts/weeklyReport.ts',
       'const weeksToRace = plan.meta.race_date ? Math.max(0, Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))) : null'],
      ['lib/coaching/weekVoice.ts',
       'weeksToRace: Math.max(0, Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))),'],
      ['components/strava/StravaPanel.tsx',
       'const weeksToRace = raceDate ? Math.max(0, Math.round((new Date(raceDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7))) : null'],
    ]
    const missed = previously.filter(([, line]) => !offenders(line)).map(([f]) => f)
    expect(missed, 'the sweep cannot see these, so it would not have caught them').toEqual([])
    // And arm B alone catches the two arm A misses — stated, so a future
    // simplification back to one pattern fails rather than silently narrows.
    const armAOnly = previously.filter(([, l]) => !ARM_A.test(l)).map(([f]) => f).sort()
    expect(armAOnly).toEqual(['app/api/plan-weekly-note/route.ts', 'lib/widget/widgetState.ts'])
  })

  it('each of the eight now names the owner', () => {
    const expected: Record<string, string> = {
      'app/api/race-readiness/route.ts': 'daysUntilRace(',
      'lib/widget/widgetState.ts': 'daysUntilRace(',
      'app/api/plan-weekly-note/route.ts': 'weeksUntilRace(',
      'app/api/daily-coach-note/route.ts': 'weeksUntilRace(',
      'lib/coaching/prompts/sessionReframe.ts': 'weeksUntilRace(',
      'lib/coaching/prompts/weeklyReport.ts': 'weeksUntilRace(',
      'lib/coaching/weekVoice.ts': 'weeksUntilRace(',
      'components/strava/StravaPanel.tsx': 'weeksUntilRace(',
    }
    for (const [f, call] of Object.entries(expected)) {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} must call the owner`).toContain(call)
      expect(src, `${f} must import it`).toMatch(/from '@\/lib\/format'/)
    }
  })
})
