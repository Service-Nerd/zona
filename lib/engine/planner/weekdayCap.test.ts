// ADR-027 B4d (ADR027-B4D-WEEKDAY-CAP) — L3's capacity rule.
//
// 🔴 `verify:parity` IS NOT THE GATE AND CANNOT BE. Its grid sets neither `max_weekday_mins` nor
// `day_budgets` — 📐 0 occurrences of either in `scripts/verify-parity.ts` — and this function's
// first line returns when both are absent. So across all 6,210 parity cases it **does nothing**,
// and IDENTICAL reports exactly that. The move's gate is the exhaustive equivalence diff against
// the pre-move function: **15,360 cases, 0 differences**, falsified three ways (a trim off by one →
// 9,664 differences, the race exemption dropped → 1,280, `continue` → `break` → 384).
//
// What this file gates is the behaviour that diff cannot pin down for a future reader: WHICH
// sessions are exempt and why, §82's floor, and the boundary.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyWeekdayMinsCap } from './weekdayCap'
import type { GeneratorInput, Session } from '@/types/plan'
import type { Day } from '@/lib/plan/days'

const input = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 10, race_date: '2027-03-28', goal: 'finish',
  current_weekly_km: 30, longest_recent_run_km: 12, days_available: 5,
  training_age: '2-5yr', recent_quality_training: 'occasional', injury_history: [],
  ...over,
} as GeneratorInput)

const sess = (over: Partial<Session> = {}): Session =>
  ({ type: 'easy', duration_mins: 75, distance_km: 12, ...over }) as Session

const cap30 = input({ max_weekday_mins: 30 })

describe('ADR-027 B4d — §81/§82: what the cap trims and what it may not touch', () => {
  it('trims an easy weekday run to its budget, and leaves the weekend alone', () => {
    const w: Partial<Record<Day, Session>> = { tue: sess(), sat: sess({ duration_mins: 120 }) }
    applyWeekdayMinsCap(w, cap30)
    expect(w.tue!.duration_mins, 'a weekday easy run is trimmed').toBe(30)
    // §81 scopes the cap to Mon–Fri: the weekend carries the long run and has no cap concept.
    expect(w.sat!.duration_mins, 'the weekend is not a weekday').toBe(120)
  })

  it('🔴 MWM-02 — the LONG RUN is exempt, and the measurement is why', () => {
    // Coaching Board 2026-09-03. Squeezing it does not honour §18, it deforms the week: a long run
    // cut to 30 minutes beside two 30-minute easy runs is not a long run, and the label then lies.
    // 📐 Measured at the sitting: capping it traded 1,615 §18 breaches for 979 §9 breaches.
    const w: Partial<Record<Day, Session>> = { wed: sess({ type: 'long', duration_mins: 100 }) }
    applyWeekdayMinsCap(w, cap30)
    expect(w.wed!.duration_mins).toBe(100)
  })

  it('§81 — a STRUCTURED session is exempt; the plan declares the overrun instead', () => {
    const w: Partial<Record<Day, Session>> = {
      thu: sess({ type: 'quality', duration_mins: 70, main_set: [{ role: 'work', steps: [{ reps: 4, work: '400m' }] }] } as Partial<Session>),
    }
    applyWeekdayMinsCap(w, cap30)
    expect(w.thu!.duration_mins, '§81: intervals are not shrunk to fit a weekday').toBe(70)
  })

  it('§121\'s look-alike — strength, rest and the RACE are skipped, each for its own reason', () => {
    // ⚠️ These three types list together in several places and the questions differ. Here it is
    // "may this be shrunk to a weekday budget?" — a race is a fixed external event, strength has no
    // duration to trim against a RUNNING budget, and a rest day has nothing to trim.
    for (const type of ['strength', 'rest', 'race'] as const) {
      const w: Partial<Record<Day, Session>> = { tue: sess({ type, duration_mins: 90 }) }
      applyWeekdayMinsCap(w, cap30)
      expect(w.tue!.duration_mins, `${type} must not be trimmed`).toBe(90)
    }
  })

  it('🔴 §82 — an easy run is FLOOR-PROTECTED, and over-budget is then DECLARED not hidden', () => {
    // A sub-30-minute budget cannot hold the runner's easy floor. §82 holds the floor and stamps
    // `floor_protected`, which is the one licensed overrun — a silent 12-minute run would be worse.
    const w: Partial<Record<Day, Session>> = { tue: sess({ duration_mins: 60 }) }
    applyWeekdayMinsCap(w, input({ max_weekday_mins: 12, longest_recent_run_km: 12 }))
    expect(w.tue!.duration_mins, 'the floor held above the budget').toBeGreaterThan(12)
    expect((w.tue as { floor_protected?: boolean }).floor_protected, '§82 must declare it').toBe(true)
  })

  it('per-day budgets beat the single cap, and a day with neither is untouched', () => {
    const w: Partial<Record<Day, Session>> = { mon: sess(), tue: sess(), wed: sess() }
    applyWeekdayMinsCap(w, input({ max_weekday_mins: 60, day_budgets: { mon: 35 } }))
    expect(w.mon!.duration_mins, 'the per-day budget wins').toBe(35)
    expect(w.tue!.duration_mins, 'no per-day budget falls back to the single cap').toBe(60)
    expect(w.wed!.duration_mins).toBe(60)
  })

  it('🔴 with NO budget stated it does nothing at all — which is why parity is blind to it', () => {
    // This early return is the whole reason `verify:parity` cannot test this function: its grid
    // states no budget, so all 6,210 cases take this path.
    const w: Partial<Record<Day, Session>> = { tue: sess({ duration_mins: 95 }) }
    applyWeekdayMinsCap(w, input())
    expect(w.tue!.duration_mins).toBe(95)
  })
})

// ⚠️ The ARCH-ENG-001 import boundary and the "no probe is committed" arm live in ONE place now,
// `boundary.test.ts` — there were four hand-typed copies with four inconsistent allow-lists and a
// probe importing `ruleEngine` passed all four. The `.git/index` reader that used to sit here was
// wrong twice over: it throws ENOTDIR in a linked worktree (where `.git` is a file), and the index
// cannot see an untracked file, which is what its own comment said it was looking for.
describe('ADR-027 B4d — the strangler boundary', () => {
  const root = process.cwd()
  const src = (f: string) => readFileSync(join(root, f), 'utf8')
  const strip = (s: string) => s
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length))

  it('🔴 `applyWeekdayMinsCap` is GONE from the old engine, and still called from it 4 times', () => {
    const code = strip(src('lib/plan/ruleEngine.ts'))
    expect(code).not.toMatch(/function\s+applyWeekdayMinsCap/)
    // The call-site count is pinned because the ORDERING is a known defect (`S28-CAP-ORDER-01`):
    // this runs after §28's stride note and can convert a quality session to easy. A fifth site is
    // a deliberate act, and the move must not quietly change how many times it runs.
    expect((code.match(/applyWeekdayMinsCap\(/g) ?? []).length, 'the call-site count moved').toBe(4)
  })


})
