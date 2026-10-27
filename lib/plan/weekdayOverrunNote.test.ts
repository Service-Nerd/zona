// OVERRUN-NOTE-ALL-01 (2026-10-26). §81's "the plan says when they don't fit" was stamped only in the structured
// branch: floor-protected easy runs, in the main plan AND in foundation weeks, overran with nothing said (7,627 on the
// slow-goal grid; a live Friday 52 min against 30). And the note said "weekdays" when the limit was the day's own.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { weekdayOverrunNote, weekdayBudgetFor } from './weekdayOverrunNote'
import { runEngine } from './engine'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { mergePlan } from './enrich'
import { slowGoalDates, slowGoalGrid } from './slowGoalGrid'
import type { GeneratorInput, Plan } from '@/types/plan'

describe('the owner', () => {
  it('names the day when the limit is the day\'s own, "weekdays" when it is the single limit', () => {
    expect(weekdayBudgetFor({ day_budgets: { fri: 30 }, max_weekday_mins: 30 }, 'fri')).toEqual({ cap: 30, perDay: true })
    expect(weekdayBudgetFor({ max_weekday_mins: 30 }, 'fri')).toEqual({ cap: 30, perDay: false })
    expect(weekdayBudgetFor({}, 'fri')).toBeNull()
    expect(weekdayOverrunNote({ minutes: 52, cap: 30, day: 'fri', perDay: false, kind: 'easy' }))
      .toBe('About 52 min against the 30 min you set for weekdays. Any shorter and it stops being a training run, so take it on a day with more room, or raise your weekday time limit in Adjust your plan.')
    expect(weekdayOverrunNote({ minutes: 59, cap: 45, day: 'wed', perDay: false, kind: 'quality' }))
      .toBe('About 59 min against the 45 min you set for weekdays. Quality work is not shrunk to fit the clock, so take this one on a day with more room, or raise your weekday time limit in Adjust your plan.')
    expect(weekdayOverrunNote({ minutes: 90, cap: 45, day: 'thu', perDay: false, kind: 'long' }))
      .toBe('About 1h 30 against the 45 min you set for weekdays. The long run is not cut to fit, so take it on a day with more room, or raise your weekday time limit in Adjust your plan.')
  })
  it('🔴 a PER-DAY limit names the day and offers no "raise" lever (the control does not reach it: MODIFY-WEEKDAY-INERT-01)', () => {
    expect(weekdayOverrunNote({ minutes: 52, cap: 30, day: 'fri', perDay: true, kind: 'easy' }))
      .toBe('About 52 min against the 30 min you set for Fridays. Any shorter and it stops being a training run, so take it on a day with more room.')
    for (const kind of ['easy', 'quality', 'long'] as const) expect(weekdayOverrunNote({ minutes: 52, cap: 30, day: 'mon', perDay: true, kind })).not.toMatch(/raise|Profile/)
  })
  it('no note when a duration cannot be formatted', () => {
    expect(weekdayOverrunNote({ minutes: NaN, cap: 30, day: 'mon', perDay: false, kind: 'easy' })).toBeNull()
  })
  it('no em dash in a runner-facing sentence', () => {
    for (const kind of ['easy', 'quality', 'long'] as const) expect(weekdayOverrunNote({ minutes: 50, cap: 30, day: 'mon', perDay: true, kind })!).not.toContain('—')
  })
})

// The live case's shape (a 7:40 marathoner aiming at 6:00 on 10 km/week, Mon 60 / Wed 45 / Fri 30). ⚠️ A FINISH goal here
// stages to base building, whose sessions carry no duration at all: BASEBUILD-DURATION-01, filed, not this item.
const { planStart, benchmarkDate } = slowGoalDates()
// The engine measures the runway from `today` to `planStart`, and `slowGoalDates` puts the start on NEXT Monday, so the
// runway is 1–7 days depending on the weekday the suite runs. On a Tuesday the foundation week this file asserts on did
// not exist and two tests went red with no code change (PINNED-CLOCK-01's class). Pin the runway, not the date: today is
// always a week before the start. The benchmark stays 14 days before the real clock, which `applyVdotDiscount` reads.
const today = new Date(Date.parse(`${planStart}T00:00:00Z`) - 7 * 864e5).toISOString().slice(0, 10)
const SLOW: GeneratorInput = {
  race_distance_km: 42.2, race_date: new Date(Date.parse(`${planStart}T00:00:00Z`) + (20 * 7 - 1) * 864e5).toISOString().slice(0, 10),
  goal: 'time_target', target_time: '6:00:00', age: 30, injury_history: [], fitness_level: 'beginner', training_age: '1-2yr', recent_quality_training: 'occasional',
  current_weekly_km: 10, longest_recent_run_km: 6, days_available: 4, days_cannot_train: ['tuesday', 'thursday', 'saturday'],
  day_budgets: { mon: 60, wed: 45, fri: 30 }, max_weekday_mins: 30,
  benchmark: { type: 'race', distance_km: 42.2, time: '7:40:47', benchmark_date: benchmarkDate }, acknowledged_prep_warning: true,
} as unknown as GeneratorInput
const plan = (() => { const o = runEngine({ input: SLOW, tier: 'paid', displayUnits: 'km', planStart, today }); if (o.kind === 'refusal') throw new Error('refused'); return o.plan })()
const weekdaySessions = plan.weeks.flatMap(w => (['mon', 'wed', 'fri'] as const).map(d => ({ w, d, s: (w.sessions as any)[d] }))).filter(x => x.s && x.s.duration_mins)

describe('the engine says so on every session that does not fit', () => {
  it('🔴 every weekday session over its day carries the note, and it names that day', () => {
    const over = weekdaySessions.filter(x => x.s.duration_mins > weekdayBudgetFor(SLOW as any, x.d)!.cap && !/long/i.test(x.s.label))
    expect(over.length, 'the fixture must reach the case').toBeGreaterThan(0)
    for (const x of over) {
      expect(x.s.weekday_overrun_note, `${x.w.n} ${x.d} ${x.s.label}`).toBeTruthy()
      expect(x.s.weekday_overrun_note).toContain({ mon: 'Mondays', wed: 'Wednesdays', fri: 'Fridays' }[x.d])
    }
  })
  it('🔴 foundation weeks too (the third place the note was owed)', () => {
    const f = weekdaySessions.filter(x => x.w.n <= 0 && x.s.floor_protected)
    expect(f.length, 'the fixture must carry a foundation floor-protected run').toBeGreaterThan(0)
    for (const x of f) expect(x.s.weekday_overrun_note).toBeTruthy()
  })
  it('🔴 a MAIN-plan floor-protected easy run says so (the branch §82 owns; found by falsification)', () => {
    // The live fixture's overruns are foundation weeks and quality; this reaches applyWeekdayMinsCap's floor branch.
    const hits: any[] = []
    for (const c of slowGoalGrid(planStart, benchmarkDate)) {
      if (!c.max_weekday_mins) continue
      const { gap, ...input } = c
      const o = runEngine({ input: input as unknown as GeneratorInput, tier: 'paid', displayUnits: 'km', planStart, today })
      if (o.kind === 'refusal') continue
      for (const w of o.plan.weeks) if (w.n >= 1) for (const d of ['mon', 'tue', 'wed', 'thu', 'fri'] as const) {
        const s: any = (w.sessions as any)[d]
        if (s?.floor_protected && s.duration_mins > c.max_weekday_mins) hits.push(s)
      }
      if (hits.length >= 5) break
    }
    expect(hits.length, 'the grid must reach a main-plan floor-protected overrun').toBeGreaterThan(0)
    for (const s of hits) expect(s.weekday_overrun_note).toContain('Any shorter and it stops being a training run')
  })
  it('never on a session that fits', () => {
    for (const x of weekdaySessions) if (x.s.duration_mins <= weekdayBudgetFor(SLOW as any, x.d)!.cap) expect(x.s.weekday_overrun_note).toBeUndefined()
  })
  it('🔴 the check is clean on the engine\'s plan, and fires both ways when broken', () => {
    expect(validatePlan(plan, SLOW).filter(v => v.code === 'INV-PLAN-WEEKDAY-OVERRUN-DECLARED')).toEqual([])
    const broken: Plan = JSON.parse(JSON.stringify(plan))
    const over = broken.weeks.flatMap(w => Object.values(w.sessions)).find((s: any) => s?.weekday_overrun_note) as any
    delete over.weekday_overrun_note
    const fits = broken.weeks.flatMap(w => (['mon'] as const).map(d => (w.sessions as any)[d])).find((s: any) => s && s.duration_mins && s.duration_mins <= 60 && !s.weekday_overrun_note) as any
    fits.weekday_overrun_note = 'About 99 min against the 60 min you set for Mondays.'
    const v = validatePlan(broken, SLOW).filter(x => x.code === 'INV-PLAN-WEEKDAY-OVERRUN-DECLARED')
    expect(v.map(x => x.actual).sort()).toEqual(['over the day, no weekday_overrun_note', 'weekday_overrun_note on a session that fits'])
  })
})

describe('the STRUCTURED check reads the day\'s own limit (OVERRUN-NOTE-ALL-01 changed it; this proves the change)', () => {
  // SLOW has Mon 60 / Wed 45 / Fri 30 and max_weekday_mins 30 (the wizard writes the MIN). Tolerance is §81 Am. 2's 50%:
  // Monday's limit is 90, Friday's 45. The old check read max_weekday_mins, so a 70-minute Monday fired against 45.
  const withStructured = (day: 'mon' | 'fri', mins: number): Plan => {
    const p: Plan = JSON.parse(JSON.stringify(plan))
    const q = p.weeks.flatMap(w => Object.values(w.sessions)).find((s: any) => s?.type === 'quality' && s.catalogue_id) as any
    if (!q) throw new Error('fixture has no structured session')
    const w = p.weeks.find(x => x.type !== 'race')!
    ;(w.sessions as any)[day] = { ...q, duration_mins: mins, weekday_overrun_note: undefined }
    return p
  }
  const fires = (p: Plan) => validatePlan(p, SLOW).filter(v => v.code === 'INV-PLAN-STRUCTURED-OVERRUN-DECLARED')
  it('a 70-minute Monday is inside Monday\'s own limit: silent', () => {
    expect(fires(withStructured('mon', 70))).toEqual([])
  })
  it('🔴 the same 70 minutes on Friday fires, and the message names Friday\'s 30', () => {
    const v = fires(withStructured('fri', 70))
    expect(v).toHaveLength(1)
    expect(v[0].message).toContain('stated 30-min limit')
  })
})

describe('a note is written from the FINAL minutes', () => {
  it('🔴 the sweep case: a floor-protected run stamped at 32 min and later brought to 30 carries no note', () => {
    // Found by the sweep (46 plans). The weekday-cap pass is NOT last: the adequacy block resizes after it.
    const input = { athlete_name: 'Athlete', age: 35, race_name: 'Test', primary_metric: 'distance', injury_history: ['Back'], plan_start: '2026-04-27',
      race_distance_km: 42.2, race_date: '2026-08-24', target_time: '3:45:00', current_weekly_km: 40, longest_recent_run_km: 8, days_available: 5,
      days_cannot_train: ['tue'], fitness_level: 'beginner', user_declared_level: 'experienced', hard_session_relationship: 'love',
      recent_quality_training: 'regular', max_weekday_mins: 30, weeks_at_current_volume: 7, foundation_decision: 'start_now', preferred_long_run_day: 'sat' } as unknown as GeneratorInput
    const p = generateRulePlan(input, 'paid', '2026-04-27')
    let checked = 0
    for (const w of p.weeks) for (const d of ['mon', 'tue', 'wed', 'thu', 'fri'] as const) {
      const s: any = (w.sessions as any)[d]; if (!s?.duration_mins) continue
      checked++
      if (s.duration_mins <= 30) expect(s.weekday_overrun_note, `${w.n} ${d} ${s.duration_mins} min`).toBeUndefined()
      if (s.weekday_overrun_note) expect(s.weekday_overrun_note).toContain(`About ${s.duration_mins} min`)
    }
    expect(checked).toBeGreaterThan(0)
  })
  it('🔴 generateRulePlan\'s own output carries them (callers that never compose: staged race plans, the sweep\'s first pass)', () => {
    // Found by falsification: with the tail call removed, every runEngine-based arm stayed green because compose reconciles.
    let over = 0
    for (const c of slowGoalGrid(planStart, benchmarkDate)) {
      if (!c.max_weekday_mins || c.race_distance_km !== 21.1) continue
      const { gap, ...input } = c
      let p: Plan; try { p = generateRulePlan(input as unknown as GeneratorInput, 'paid', planStart) } catch { continue }
      for (const w of p.weeks) for (const d of ['mon', 'tue', 'wed', 'thu', 'fri'] as const) {
        const s: any = (w.sessions as any)[d]
        if (s?.duration_mins > c.max_weekday_mins && !/long/i.test(s.label) && w.type !== 'race') { over++; expect(s.weekday_overrun_note, `${w.n} ${d}`).toBeTruthy() }
      }
      if (over >= 5) break
    }
    expect(over, 'the grid must reach an overrun in generateRulePlan output').toBeGreaterThan(0)
  })
  it('🔴 a WEEKDAY long run over its day keeps its note (it always had one; the first cut of the owner dropped it)', () => {
    const input = { ...SLOW, goal: 'finish', target_time: undefined, current_weekly_km: 25, longest_recent_run_km: 12,
      days_cannot_train: ['saturday', 'sunday'], day_budgets: undefined, max_weekday_mins: 30, benchmark: undefined } as unknown as GeneratorInput
    const o = runEngine({ input, tier: 'paid', displayUnits: 'km', planStart, today })
    if (o.kind === 'refusal') throw new Error('refused')
    const lrs = o.plan.weeks.filter(w => w.n >= 1 && w.type !== 'race').flatMap(w => (['mon', 'tue', 'wed', 'thu', 'fri'] as const).map(d => (w.sessions as any)[d]))
      .filter((s: any) => s && /long/i.test(s.label) && s.duration_mins > 30)
    expect(lrs.length, 'the case must put a long run on a weekday over 30 min').toBeGreaterThan(0)
    for (const s of lrs) expect(s.weekday_overrun_note).toContain('The long run is not cut to fit')
  })
  it('🔴 foundation weeks get theirs when composed', () => {
    const src = readFileSync('lib/plan/foundationCompose.ts', 'utf8')
    const at = src.indexOf('reconcileWeekdayOverrunNotes(assembled.weeks.filter(w => w.n <= 0), input)')
    expect(at).toBeGreaterThan(-1)
    expect(at).toBeLessThan(src.indexOf('const violations = validatePlan(assembled, input)'))
  })
})

describe('downstream', () => {
  it('🔴 AI enrichment keeps the note (it is engine prescription, not voice)', () => {
    const one = { meta: {} as never, weeks: [{ n: 1, phase: 'base', type: 'normal', label: 'W1', theme: 't',
      sessions: { fri: { id: 'w1-fri', type: 'easy', label: 'Easy run', detail: null, coach_notes: ['Easy.'], floor_protected: true, weekday_overrun_note: 'About 52 min against the 30 min you set for Fridays.' } } }] } as unknown as Plan
    const out = mergePlan(one, { meta: {}, weeks: [{ n: 1, label: 'W1', theme: 't', sessions: { fri: { coach_notes: ['Slow and easy.'] } } }] } as never, 'paid')
    expect((out.weeks[0].sessions as any).fri.weekday_overrun_note).toBe('About 52 min against the 30 min you set for Fridays.')
  })
  it('the session screen renders it (no AIMark: rule-engine copy)', () => {
    const src = readFileSync('components/dashboard/SessionPopupInner.tsx', 'utf8')
    const at = src.indexOf('{session.weekday_overrun_note && shownOnPlannedDay && (')
    expect(at).toBeGreaterThan(-1)
    expect(src.slice(at, at + 300)).toContain('{session.weekday_overrun_note}')
    expect(src.slice(at, at + 300)).not.toContain('aiGenerated')
  })
})

// ── Code review round 2 (2026-10-26) ──────────────────────────────────────────────────────────────────────────────
import { overrunNoteApplies, reconcileWeekdayOverrunNotes } from './weekdayOverrunNote'
import { savePlanForUser } from '@/lib/plan'

describe('review round 2', () => {
  it('🔴 a moved session does not show its planned day\'s note', () => {
    const fri = new Date(2026, 9, 30, 0, 0).toISOString()   // a local Friday, as the screens carry it
    const sat = new Date(2026, 9, 31, 0, 0).toISOString()
    expect(overrunNoteApplies('fri', fri)).toBe(true)
    expect(overrunNoteApplies('fri', sat)).toBe(false)
    expect(overrunNoteApplies('fri', null)).toBe(true)
    // A date-only string is a LOCAL date (2026-10-30 is a Friday), never UTC midnight.
    expect(overrunNoteApplies('fri', '2026-10-30')).toBe(true)
    expect(overrunNoteApplies('thu', '2026-10-30')).toBe(false)
    const src = readFileSync('components/dashboard/SessionPopupInner.tsx', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(src).toContain('const shownOnPlannedDay = overrunNoteApplies(session.key, session.rawDate)')
    expect(src).toContain('{session.weekday_overrun_note && shownOnPlannedDay && (')
  })

  const week = (sessions: Record<string, any>) => [{ n: 1, phase: 'base', type: 'normal', sessions }] as any
  it('🔴 no reason fits, no sentence: a floor-protected run BELOW the floor gets no note; at or above it, the easy line', () => {
    const below = week({ fri: { type: 'easy', label: 'Easy run', distance_km: 3, duration_mins: 50, floor_protected: true } })
    reconcileWeekdayOverrunNotes(below, { max_weekday_mins: 30, longest_recent_run_km: 8 })
    expect(below[0].sessions.fri.weekday_overrun_note).toBeUndefined()
    const above = week({ fri: { type: 'easy', label: 'Easy run', distance_km: 4.5, duration_mins: 50, floor_protected: true } })
    reconcileWeekdayOverrunNotes(above, { max_weekday_mins: 30, longest_recent_run_km: 8 })
    expect(above[0].sessions.fri.weekday_overrun_note).toContain('Any shorter and it stops being a training run')
  })
  it('🔴 with no limit at all, an old note is still cleared', () => {
    const w = week({ fri: { type: 'easy', label: 'Easy run', distance_km: 4, duration_mins: 50, weekday_overrun_note: 'About 50 min against the 30 min…' } })
    reconcileWeekdayOverrunNotes(w, {})
    expect(w[0].sessions.fri.weekday_overrun_note).toBeUndefined()
  })
  it('🔴 the save boundary reconciles: a stale note is cleared and a missing one written before the plan is stored', async () => {
    const p: Plan = JSON.parse(JSON.stringify(plan))
    expect((p.meta as any).generator_input, 'the stored plan carries its input').toBeTruthy()
    const all = p.weeks.flatMap(w => (['mon', 'wed', 'fri'] as const).map(d => ({ n: w.n, d, s: (w.sessions as any)[d] }))).filter(x => x.s?.duration_mins)
    const noted = all.find(x => x.s.weekday_overrun_note)!
    const fits = all.find(x => !x.s.weekday_overrun_note)!
    delete noted.s.weekday_overrun_note
    fits.s.weekday_overrun_note = 'stale'
    let saved: Plan | null = null
    const b: any = { select: () => b, eq: () => b, gte: () => b, in: () => b, is: () => b, delete: () => b, update: () => b,
      maybeSingle: () => Promise.resolve({ data: null }), insert: () => Promise.resolve({ error: null }),
      upsert: (row: { plan_json: Plan }) => { saved = row.plan_json; return Promise.resolve({ error: null }) },
      then: (r: (v: unknown) => unknown) => r({ data: [], error: null }) }
    await savePlanForUser('u1', p, { from: () => b } as any)
    const stored = (x: { n: number; d: string }) => ((saved as unknown as Plan).weeks.find(w => w.n === x.n)!.sessions as any)[x.d]
    expect(stored(noted).weekday_overrun_note, 'the missing note is written in what is stored').toBeTruthy()
    expect(stored(fits).weekday_overrun_note, 'the stale note is cleared in what is stored').toBeUndefined()
    // 🔴 code review 3: the CALLER's objects are not touched (they are React state on the client).
    expect(noted.s.weekday_overrun_note).toBeUndefined()
    expect(fits.s.weekday_overrun_note).toBe('stale')
  })
})
