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
//   lib/coaching/prompts/sessionFeedback.ts weeks, SIGNED  AI prompt
//   lib/plan/weekResolution.ts              weeks, round   dead: 0 consumers, deleted
//   lib/plan/baseBuildHandover.ts           weeks, floor   handover copy, mixed frames
//   lib/plan/engine.ts                      weeks, round   refusal telemetry
//   app/dashboard/DashboardClient.tsx x2    --             pre-parsed the date to a Date
//   components/dashboard/OrientationScreen.tsx --          same
//
// ⚠️ **THIRTEEN, AND I CLAIMED EIGHT TWICE.** Six by reading, two more by this
// sweep on its first run (`weekVoice.ts`, which the runner reads verbatim:
// *"3 weeks out. Stay disciplined."*), and **five more by `/code-review`** —
// including the headline defect still being LIVE on Today and the Plan screen,
// because three callers did `new Date(plan.meta.race_date)` and handed the owner
// a Date whose local calendar day was already the previous one. `MS_PER_WEEK`,
// `6048e5` and `Date.parse(...Z)` are three more spellings this sweep could not
// see. "Three places checked is not nowhere" — three times, on one item.
//
// 🔴 AND `DATE-DST-01` CONSOLIDATED SIX COPIES OF THIS EXPRESSION IN 2026-09 AND
// MISSED `baseBuildHandover` AND `weekResolution`. Same sweep, second time.
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
//
// ⚠️ THE DIVISOR IS SPELT FOUR WAYS and two of them are opaque: `6048e5` is a
// week and `MS_PER_WEEK` is a named local. A pattern that lists only the
// arithmetic misses both, which is how four sites passed arm A and arm B.
const DAY_OR_WEEK = String.raw`86_?400_?000|6048e5|24 \* 60 \* 60 \* 1000|60 \* 60 \* 24|MS_PER_WEEK|MS_PER_DAY|DAY_MS|WEEK_MS`
const ARM_A = new RegExp(String.raw`(?:race_date|raceDate|raceDay)[^\n]*(?:getTime\(\)|Date\.parse)[^\n]*(?:${DAY_OR_WEEK})`)
// ⚠️ NOT `\b…ToRace\b`: `signedWeeksToRace` has no word boundary before "weeks",
// and that is exactly the site arm B could not see.
const ARM_B = new RegExp(String.raw`(?:days|Days|weeks|Weeks)ToRace[^\n]*(?:Math\.(?:round|ceil|floor)|getTime\(\)|Date\.parse)`)
// Arm C: a race date read straight into `new Date(...)`, which loses the
// calendar day before any owner sees it. This is the one that found the
// headline defect still live.
const ARM_C = /new Date\((?:[A-Za-z_$][\w$.?]*\.)?(?:race_date|raceDate)\b/
// Arm D: `Date.parse` on a race date. Its divisor often sits on the NEXT line,
// so arm A's same-line divisor requirement cannot see it — which is exactly how
// `baseBuildHandover` passed a sweep written to catch it.
const ARM_D = /Date\.parse\([^\n]*(?:race_date|raceDate)/

// ⚠️ TWO EXEMPTIONS, EACH NAMED WITH ITS REASON rather than remembered — the
// pattern the colour guards and the em-dash guards already use here.
const EXEMPT: Record<string, string> = {
  // An instant plus a DURATION, not a difference between two calendar dates:
  // the grant expiry is `race + grace`, clamped by `grantedAt + ceiling`. Its
  // caller (`reanchor.ts`) is what had to be fixed, and was.
  'lib/charity/grantWindow.ts': 'instant + duration, not a calendar difference',
  // Correct AND frame-consistent: BOTH endpoints are parsed as UTC, so the
  // quotient is exact. It cannot read the owner — `packages/strength` imports
  // nothing from `@/lib` by design, and `boundary.test.ts` enforces that.
  'packages/strength/validate.ts': 'package isolation; both endpoints UTC-parsed, so exact',
}

const offenders = (src: string) =>
  src.split('\n').some(l =>
    !/UntilRace\(|calendar(?:Days|Weeks)Between\(|parseCalendarDate\(/.test(l)
    && (ARM_A.test(l) || ARM_B.test(l) || ARM_C.test(l) || ARM_D.test(l)))

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
    const hits = files.filter(f => f !== OWNER_FILE && !EXEMPT[f] && offenders(readFileSync(f, 'utf8')))
    expect(hits, 'route these through daysUntilRace / weeksUntilRace in @/lib/format').toEqual([])
  })

  it('🔑 every exemption still MATCHES, so a stale one cannot sit there unnoticed', () => {
    for (const f of Object.keys(EXEMPT)) {
      expect(files, `${f} is exempted but is not in the population`).toContain(f)
      expect(offenders(readFileSync(f, 'utf8')), `${f} no longer matches — drop the exemption`).toBe(true)
    }
  })

  it('🔴 and the sweep REACHES all FOURTEEN replaced lines, each the real one', () => {
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
      // The five /code-review found after I had twice claimed the set was complete.
      ['lib/coaching/prompts/sessionFeedback.ts',
       'const signedWeeksToRace = plan.meta.race_date ? Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / MS_PER_WEEK) : null'],
      ['lib/plan/weekResolution.ts',
       'const ms = new Date(raceDate).getTime() - Date.now()'],
      ['lib/plan/baseBuildHandover.ts',
       'const t = Date.parse(`${raceDate}T00:00:00Z`)'],
      ['lib/plan/engine.ts',
       'weeks_to_race: input.race_date ? Math.round((new Date(input.race_date).getTime() - Date.now()) / 6048e5) : null,'],
      ['app/dashboard/DashboardClient.tsx',
       'const raceDate = (stagedView?.raceDate || plan?.meta?.race_date) ? new Date(stagedView?.raceDate || plan!.meta.race_date) : null'],
      ['components/dashboard/MeScreen.tsx',
       'const raceInPast = p.race_date ? new Date(p.race_date).getTime() < Date.now() : false'],
    ]
    const missed = previously.filter(([, line]) => !offenders(line)).map(([f]) => f)
    expect(missed, 'the sweep cannot see these, so it would not have caught them').toEqual([])
    // And arm B alone catches the two arm A misses — stated, so a future
    // simplification back to one pattern fails rather than silently narrows.
    // Which arm each line needs, stated — so a future "simplification" back to
    // one pattern fails loudly instead of silently narrowing the population.
    const needsBeyondA = previously.filter(([, l]) => !ARM_A.test(l)).map(([f]) => f).sort()
    expect(needsBeyondA).toEqual([
      'app/api/plan-weekly-note/route.ts',
      'app/dashboard/DashboardClient.tsx',
      'components/dashboard/MeScreen.tsx',
      'lib/plan/baseBuildHandover.ts',
      'lib/plan/weekResolution.ts',
      'lib/widget/widgetState.ts',
    ])
    const needsCorD = previously.filter(([, l]) => !ARM_A.test(l) && !ARM_B.test(l)).map(([f]) => f).sort()
    expect(needsCorD).toEqual([
      'app/dashboard/DashboardClient.tsx', 'components/dashboard/MeScreen.tsx',
      'lib/plan/baseBuildHandover.ts', 'lib/plan/weekResolution.ts',
    ])
    const onlyD = previously.filter(([, l]) => ARM_D.test(l) && !ARM_A.test(l) && !ARM_B.test(l) && !ARM_C.test(l)).map(([f]) => f)
    expect(onlyD).toEqual(['lib/plan/baseBuildHandover.ts'])
  })

  it('every site names an owner, and only ever an owner', () => {
    // ⚠️ FOUR owners, not one, and the right one per site: `daysUntilRace` and
    // `weeksUntilRace` clamp at 0; `weeksUntilRaceSigned` and `lib/dates.ts`'s
    // `calendar*Between` do not. A site that needs to know the race is BEHIND
    // the runner must not read a clamped owner — that is how the race-readiness
    // route's own `< 0` guard went unreachable.
    const expected: Record<string, string> = {
      'app/api/race-readiness/route.ts': 'calendarDaysBetween(',   // signed: the < 0 guard
      'components/dashboard/MeScreen.tsx': 'calendarDaysBetween(',  // signed: "race in the past"
      'lib/plan/baseBuildHandover.ts': 'calendarWeeksBetween(',
      'lib/charity/reanchor.ts': 'parseCalendarDate(',
      'lib/coaching/prompts/sessionFeedback.ts': 'weeksUntilRaceSigned(',
      'lib/plan/engine.ts': 'weeksUntilRaceSigned(',
      'lib/widget/widgetState.ts': 'daysUntilRace(',
      'app/dashboard/DashboardClient.tsx': 'daysUntilRace(',
      'components/dashboard/OrientationScreen.tsx': 'daysUntilRace(',
      'app/api/plan-weekly-note/route.ts': 'weeksUntilRace(',
      'app/api/daily-coach-note/route.ts': 'weeksUntilRace(',
      'lib/coaching/prompts/sessionReframe.ts': 'weeksUntilRace(',
      'lib/coaching/prompts/weeklyReport.ts': 'weeksUntilRace(',
      'lib/coaching/weekVoice.ts': 'weeksUntilRace(',
      'components/strava/StravaPanel.tsx': 'weeksUntilRace(',
    }
    expect(Object.keys(expected).length, 'thirteen sites plus the two callers that pre-parsed').toBe(15)
    for (const [f, call] of Object.entries(expected)) {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} must call ${call}`).toContain(call)
      expect(src, `${f} must import an owner`).toMatch(/from '@\/lib\/(?:format|dates)'/)
    }
  })
})
