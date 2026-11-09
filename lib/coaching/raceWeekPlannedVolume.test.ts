// raceWeekPlannedVolume.test.ts — RACE-WEEK-ZERO-KM-01.
//
// 🔴 WHAT THIS CAUGHT. §121 takes the race out of `weekly_km` ("the race is the
// test, not the training"), so the weekly report's full-week planned figure read
// **0** on race week — while `plannedKmToDate` sums session `distance_km` and
// `isCountableSession` does not exclude a race, so THAT figure included it.
// Two planned numbers, two bases, in one sentence. Measured on a real
// Monday-race plan, the prompt handed the model:
//
//   Volume: 42.2km actual vs 42.2km due by end of yesterday (0.0km full-week target)
//
// A full-week target SMALLER than the to-date figure, on the one week that
// matters most, with the model asked to narrate it.
//
// ⚠️ THE ITEM SAID "the 0 is in the data only" AND THAT WAS THE PREMISE THAT HAD
// TO BE RE-MEASURED. It is true of `PlanCalendar` and Today, which sum sessions
// and never read `weekly_km`. It was never true of `app/api/weekly-report`.
//
// ⚠️ AND THE POPULATION SAID NOTHING: 0 of 38 stored race weeks have `weekly_km`
// 0 today, because the one plan that did was rebuilt. The MECHANISM is fully
// live — 9 of 9 generated Monday-race plans produce a race-only final week at
// `weekly_km: 0`. A clean population is not a fixed defect, which is why this
// gate generates rather than reading the table.
//
// ⚠️ §121 AMENDMENT 1 IS BINDING ON THE REMEDY (Sims): race week shows what the
// runner TRAINS and what they RACE **separately, never one folded number** — and
// a prompt is a display surface (ADR-015 Amendment). So the comparison gets ONE
// basis and the race is NAMED inside it.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { raceKm, trainingKm, plannedCoveredKm, plannedCoveredKmOnDays } from '@/lib/plan/weekVolume'
import { buildWeeklyReportPrompt } from './prompts/weeklyReport'
import { computeWeeklyReportData } from './weeklyReport'
import type { GeneratorInput, Plan } from '@/types/plan'

/** A Monday race off a Monday plan start, so the final week holds the race alone. */
function mondayRacePlan(weeksOut = 16, days = 4): Plan {
  const race = new Date(Date.UTC(2027, 0, 4) + weeksOut * 7 * 86_400_000)
  return generateRulePlan({
    race_distance_km: 42.2, race_date: race.toISOString().slice(0, 10), goal: 'finish',
    current_weekly_km: 30, longest_recent_run_km: 16, days_available: days,
    user_declared_level: 'intermediate', plan_start: '2027-01-04', age: 38, resting_hr: 55,
  } as unknown as GeneratorInput, 'paid', '2027-01-04')
}

const plan = mondayRacePlan()
const raceWeek = plan.weeks[plan.weeks.length - 1]!

/** 🔴 THE OWNER, NOT A COPY OF THE ROUTE'S EXPRESSION. The first cut of this file
 *  computed `trainingKm + raceKm` here, exactly as the route did — so reverting the
 *  route to `week.weekly_km ?? 0` left every arm GREEN. A checker that restates the
 *  producer's arithmetic cannot catch the producer changing (`TIER-OWNER-01`,
 *  `deloadCadence.test.ts`). The basis now has one owner and both sides import it. */
const plannedTrainingKm = trainingKm(raceWeek) ?? 0
const plannedRaceKm = raceKm(raceWeek)
const plannedKm = plannedCoveredKm(raceWeek)

/** ⚠️ BUILT THROUGH THE PRODUCER, not a hand-made object literal. A thin stub
 *  threw on a field the prompt reads, and a fixture that is not the shape the
 *  route passes cannot prove anything about what the route produces. */
function reportData(weekN: number, actualKm: number, planned: number) {
  return computeWeeklyReportData({
    weekN, sessionsCompleted: 1, sessionsPlanned: 1, sessionsPlannedToDate: 1,
    linkedKm: actualKm, offPlanKm: 0, plannedKm: planned, plannedKmToDate: actualKm,
    priorWeeksKm: [38, 32, 26], sessionFlagCounts: {} as never,
    hrInZoneData: [], efTrendPct: null,
  } as never)
}

const volumeLine = (prompt: string) =>
  prompt.split('\n').find(l => l.includes('Volume:'))?.trim() ?? ''

/**
 * 🔴 THE THREE CASES CODE REVIEW FOUND, 2026-11-09, EACH MEASURED ON PRODUCTION.
 * The first cut of the owner was `trainingKm + raceKm`, which depends on §121 holding
 * for the stored row — and §121 is only true of ENGINE output.
 */
describe('RACE-WEEK-ZERO-KM-01 — the owner does not trust `weekly_km`', () => {
  /** `e916f15a` wk25 shape: a legacy race-INCLUSIVE `weekly_km`. 2 + 3 + a 100 km race. */
  const legacyRaceInclusive = {
    n: 25, weekly_km: 105,
    sessions: {
      tue: { type: 'easy', distance_km: 2 },
      thu: { type: 'easy', distance_km: 3 },
      sun: { type: 'race', distance_km: 100 },
    },
  } as never

  it('🔴 a LEGACY race-inclusive `weekly_km` is not double-counted (1 of 38 live)', () => {
    // `trainingKm + raceKm` returned 205 here — the mirror of the double-SUBTRACTION
    // `weekVolume.ts`'s own header warns about, in the function added below it.
    expect(trainingKm(legacyRaceInclusive)).toBe(105)   // the row as stored
    expect(raceKm(legacyRaceInclusive)).toBe(100)
    expect(plannedCoveredKm(legacyRaceInclusive), 'the race counted twice').toBe(105)
  })

  it('🔴 a ROUNDED `weekly_km` cannot shift the basis (median 0.39, max 37.0 live)', () => {
    const rounded = {
      n: 5, weekly_km: 28,                      // rounded
      sessions: { tue: { type: 'easy', distance_km: 9.4 }, thu: { type: 'easy', distance_km: 9.5 }, sun: { type: 'easy', distance_km: 9.5 } },
    } as never
    // 28.4, not 28: the same basis the to-date figure sums, so the two agree.
    expect(plannedCoveredKm(rounded)).toBeCloseTo(28.4, 5)
    expect(plannedCoveredKmOnDays(rounded, ['tue', 'thu', 'sun'] as never)).toBeCloseTo(28.4, 5)
  })

  it('🔴 a MISSING `weekly_km` gives a number, never NaN ("vs — planned")', () => {
    const noWeeklyKm = { n: 3, sessions: { wed: { type: 'easy', distance_km: 6 } } } as never
    expect(Number.isNaN(plannedCoveredKm(noWeeklyKm))).toBe(false)
    expect(plannedCoveredKm(noWeeklyKm)).toBe(6)
  })

  it('🔴 a DURATION-ANCHORED session is not 0 km — 229 of 632 live weeks hold one', () => {
    // `distance_km ?? 0` asserts the session covered no ground (SESSION-KM-01/02). On
    // `f3ae3cba` weeks 1-3 the naive sum was 0.0 against a real 13.1.
    const durationAnchored = {
      n: 1,
      // ⚠️ `pace_target` IS PART OF THE FIXTURE, because it is part of a real session.
      // Without it `sessionKmSelfPaced` correctly returns null: a duration with no pace
      // is not a distance. My first fixture omitted it and the arm failed — the code was
      // right and the fixture was not (`fixtures must use the PRODUCT's values`).
      sessions: {
        tue: { type: 'easy', distance_km: null, duration_mins: 30, pace_target: '6:30–7:30 /km' },
        thu: { type: 'easy', distance_km: null, duration_mins: 30, pace_target: '6:30–7:30 /km' },
        sun: { type: 'easy', distance_km: null, duration_mins: 45, pace_target: '6:30–7:30 /km' },
      },
    } as never
    const naive = [30, 30, 45].reduce(() => 0, 0)       // what `?? 0` produced
    expect(naive).toBe(0)
    expect(plannedCoveredKm(durationAnchored), 'the owner must price time on feet')
      .toBeGreaterThan(5)
    expect(plannedCoveredKmOnDays(durationAnchored, ['tue', 'thu'] as never))
      .toBeGreaterThan(3)
  })

  it('⚠️ and the two halves agree by construction — one owner, one predicate', () => {
    const w = plan.weeks.find(x => raceKm(x) === 0)!
    const all = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as never
    expect(plannedCoveredKmOnDays(w, all)).toBeCloseTo(plannedCoveredKm(w), 5)
  })
})

describe('RACE-WEEK-ZERO-KM-01 — the planned figure and the actual share one basis', () => {
  it('the corpus REACHES a race-only week — otherwise every arm below is vacuous', () => {
    const runs = Object.values(raceWeek.sessions ?? {})
      .filter((s): s is NonNullable<typeof s> => !!s && s.type !== 'rest' && s.type !== 'strength')
    expect(runs.length, 'the final week is no longer race-only — re-point this fixture').toBe(1)
    expect(runs[0]!.type).toBe('race')
  })

  it('§121 still holds: `weekly_km` EXCLUDES the race, and this must not change it', () => {
    // The statute. If this flips, the fix below double-counts a marathon, which is
    // the exact error `weekVolume.ts`'s header warns about.
    expect(raceWeek.weekly_km, 'a race-only week trains nothing, by §121').toBe(0)
    expect(plannedRaceKm, 'raceKm must see the race').toBeGreaterThan(40)
  })

  it('🔴 the planned total is race-INCLUSIVE, because the actual is', () => {
    // `linkedKm + offPlanKm` includes the race the runner ran. Comparing it against
    // a race-exclusive planned figure is apples to oranges.
    expect(plannedKm).toBeCloseTo(plannedTrainingKm + plannedRaceKm, 5)
    expect(plannedKm, 'this is what read 0 before the fix').toBeGreaterThan(40)
  })

  it('🔴 END-OF-WEEK: the line names the race and does not claim 0 planned', () => {
    const line = volumeLine(buildWeeklyReportPrompt(
      reportData(raceWeek.n, 42.2, plannedKm) as never,
      plan, raceWeek.n, 'Sam', undefined, undefined, undefined,
      undefined, undefined, null, undefined, null, null, 'km', plannedRaceKm,
    ))
    expect(line).toContain('42.2km planned')
    expect(line).toContain('race')
    expect(line, 'the defect: a 0 planned on race week').not.toMatch(/0\.0km planned/)
  })

  it('🔴 MID-WEEK: the full-week target is never smaller than the to-date figure', () => {
    const line = volumeLine(buildWeeklyReportPrompt(
      reportData(raceWeek.n, 42.2, plannedKm) as never,
      plan, raceWeek.n, 'Sam', 'Tuesday', 1, 42.2,
      undefined, undefined, null, undefined, null, null, 'km', plannedRaceKm,
    ))
    // THE ORIGINAL DEFECT, as a string: "42.2km due by end of yesterday (0.0km full-week target)".
    expect(line).not.toMatch(/0\.0km full-week target/)
    const toDate = Number(/vs ([\d.]+)km due/.exec(line)?.[1])
    const full = Number(/\(([\d.]+)km full-week target/.exec(line)?.[1])
    expect(toDate, 'could not read the to-date figure — re-point this arm').toBeGreaterThan(0)
    expect(full, 'the full-week target is below the to-date figure').toBeGreaterThanOrEqual(toDate)
  })

  // ⚠️ A SOURCE ARM, DECLARED AS ONE, BECAUSE `app/` IS OUTSIDE VITEST'S COLLECTION
  // (`vitest.config.ts` globs lib + components + packages), so no behavioural test in
  // this repo can reach the route. What it prevents is the regression that produced
  // the defect: the route reading `weekly_km` for a planned-vs-actual comparison.
  // Comments are stripped, because a source assertion a comment can satisfy is hollow
  // — and this file's own comments quote the bad expression to explain it.
  it('🔴 the ROUTE calls the owner and does not read `weekly_km` for the comparison', () => {
    const raw = readFileSync(join(process.cwd(), 'app/api/weekly-report/route.ts'), 'utf8')
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code, 'the route no longer imports the basis owner')
      .toContain('plannedCoveredKm')
    expect(code, 'the route computes the planned basis itself again')
      .not.toMatch(/const\s+plannedKm\s*=\s*week\.weekly_km/)
    expect(code, 'the route adds the race by hand instead of calling the owner')
      .not.toMatch(/plannedTrainingKm\s*\+\s*plannedRaceKm/)
    // 🔴 AND THE TO-DATE HALF, because the first cut of this arm guarded only
    // `plannedKm` — so reverting `plannedKmToDate` to its own `distance_km ?? 0`
    // sum left all 12 arms GREEN. Two halves, two guards; one of them is not a
    // check. (Second hollow arm in this item, both found by running the mutation.)
    expect(code, 'the route no longer takes the to-date figure from the owner')
      .toContain('plannedCoveredKmOnDays')
    expect(code, 'the route sums `distance_km ?? 0` again — that is the beginner zero')
      .not.toMatch(/distance_km\s*\?\?\s*0/)
    expect(code, 'no plannedKmToDate in the route — re-point this arm')
      .toMatch(/const\s+plannedKmToDate\s*=/)
    // Precondition: if the route stops having a plannedKm at all, this arm is vacuous.
    expect(code, 'no plannedKm in the route — re-point this arm').toMatch(/const\s+plannedKm\s*=/)
  })

  it('⚠️ and NOTHING changes off race week — the clause is inert there', () => {
    const ordinary = plan.weeks.find(w => raceKm(w) === 0)!
    const withRace = volumeLine(buildWeeklyReportPrompt(
      reportData(ordinary.n, 30, 32) as never, plan, ordinary.n,
      'Sam', undefined, undefined, undefined, undefined, undefined, null,
      undefined, null, null, 'km', raceKm(ordinary),
    ))
    const withoutArg = volumeLine(buildWeeklyReportPrompt(
      reportData(ordinary.n, 30, 32) as never, plan, ordinary.n, 'Sam',
    ))
    expect(withRace, 'a non-race week must be byte-identical to the pre-fix prompt')
      .toBe(withoutArg)
    expect(withRace).not.toContain('race')
  })
})
