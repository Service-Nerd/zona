import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { generateStrengthPlan } from './generate'
import { validateStrengthPlan } from './validate'
import { CATALOGUE_BY_ID } from './catalogue'
import type { Day, RunContext, RunDay, RunRole, RunWeek, StrengthPlan, StrengthProfile, StrengthSession } from './types'

/**
 * STRENGTH-ENGINE-01 — every validateStrengthPlan() rule, made to FAIL.
 *
 * A green validator proves nothing until each rule has been shown to fire. Each
 * case starts from a plan that validates clean and breaks exactly one thing. The
 * last case reads validate.ts and fails if a code exists that no case wakes, so a
 * new rule cannot ship unproven (the invariant-liveness lesson, 2026-09-11).
 */

const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const WEEK: RunRole[] = ['easy', 'quality', 'easy', 'easy', 'rest', 'long', 'rest']

/** Weeks 1–4 build (Mon 2026-11-02 …), week 5 race week with the race on Saturday. */
function ctx(): RunContext {
  const days: RunDay[] = []
  for (let w = 0; w < 5; w++) for (let k = 0; k < 7; k++) {
    const d = new Date(Date.UTC(2026, 10, 2 + w * 7 + k)).toISOString().slice(0, 10)
    const role: RunRole = w === 4 ? (k === 5 ? 'race' : k === 1 || k === 3 ? 'easy' : 'rest') : WEEK[k]
    days.push({ date: d, day: DAYS[k], week_n: w + 1, role })
  }
  return {
    version: 1, days, race_date: '2026-12-05', injury_tags: [], masters: false,
    weeks: [{ n: 1, phase: 'build' }, { n: 2, phase: 'build' }, { n: 3, phase: 'deload' }, { n: 4, phase: 'taper' }, { n: 5, phase: 'race_week' }],
  }
}
const PROFILE: StrengthProfile = { focus: 'running', session_minutes: 45, sessions_per_week: 2, equipment: ['dumbbells', 'bench', 'bands', 'box'], experience: 'regular' }

const C = ctx()
const BASE = generateStrengthPlan(PROFILE, C)
const clone = (p: StrengthPlan): StrengthPlan => JSON.parse(JSON.stringify(p))
const codes = (p: StrengthPlan, c: RunContext | null = C) => validateStrengthPlan(p, c).map(v => v.code)
const heavy = (p: StrengthPlan, w = 0) => p.weeks[w].sessions.find(s => s.heavy_legs)!
const dateOf = (w: number, day: Day) => C.days.find(d => d.week_n === w + 1 && d.day === day)!.date
const move = (s: StrengthSession, w: number, day: Day) => { s.date = dateOf(w, day); s.day = day; s.after_quality_run = C.days.find(d => d.date === s.date)!.role === 'quality' }
const mainItem = (s: StrengthSession) => s.blocks.find(b => b.role === 'main')!.items[0]

const CASES: Array<[string, (p: StrengthPlan) => void, StrengthProfile?]> = [
  ['S-LEGS-ON-LONG', p => move(heavy(p), 0, 'sat')],
  ['S-LEGS-BEFORE-HARD', p => move(heavy(p), 0, 'fri')],
  ['S-LEGS-AFTER-HARD', p => move(heavy(p), 0, 'wed')],
  ['S-LEGS-48H', p => move(heavy(p), 0, 'thu')],
  ['S-LEGS-MAX', p => { const s = heavy(p); p.weeks[0].sessions.push({ ...clone({ ...p, weeks: [{ ...p.weeks[0], sessions: [s] }] }).weeks[0].sessions[0], date: dateOf(0, 'sun'), day: 'sun' }, { ...JSON.parse(JSON.stringify(s)), date: dateOf(0, 'mon'), day: 'mon' }) }],
  ['S-LEGS-SPACING', p => { const a = heavy(p, 0); const b = heavy(p, 1); move(a, 0, 'tue'); move(b, 0, 'wed'); p.weeks[0].sessions = [a]; p.weeks[1].sessions = [b] }],
  ['S-TAPER-CUTOFF', p => { const s = JSON.parse(JSON.stringify(heavy(p, 0))); s.date = dateOf(3, 'thu'); s.day = 'thu'; s.after_quality_run = false; p.weeks[3].sessions = [s] }],
  ['S-RACE-WEEK', p => { const s = JSON.parse(JSON.stringify(heavy(p, 0))); s.date = dateOf(4, 'mon'); s.day = 'mon'; s.heavy_legs = true; s.after_quality_run = false; p.weeks[4].sessions = [s] }],
  ['S-RACE-EVE', p => { const s = p.weeks[4].sessions[0]; s.date = dateOf(4, 'fri'); s.day = 'fri' }],
  ['S-ONE-PER-DAY', p => { const [a, b] = p.weeks[0].sessions; b.date = a.date; b.day = a.day }],
  ['S-UNAVAILABLE-DAY', () => {}, { ...PROFILE, unavailable_days: [BASE.weeks[0].sessions[0].day] }],
  ['S-HEAVY-FLAG', p => { heavy(p).heavy_legs = false }],
  ['S-STACK-FLAG', p => { p.weeks[0].sessions[0].after_quality_run = !p.weeks[0].sessions[0].after_quality_run }],
  ['S-WARMUP', p => { p.weeks[0].sessions[0].blocks.shift() }],
  ['S-TIME-OVER', p => { p.weeks[0].sessions[0].estimated_minutes = 99 }],
  ['S-TIME-UNDER', p => { p.weeks[0].sessions[0].estimated_minutes = 5 }],
  ['S-NO-MAIN', p => { const s = p.weeks[0].sessions[0]; s.blocks = s.blocks.filter(b => b.role !== 'main') }],
  ['S-UNKNOWN-EXERCISE', p => { mainItem(p.weeks[0].sessions[0]).exercise_id = 'not_an_exercise' }],
  ['S-DUPLICATE', p => { const s = p.weeks[0].sessions[0]; const m = s.blocks.find(b => b.role === 'main')!; m.items.push({ ...m.items[0] }) }],
  ['S-EQUIPMENT', p => { mainItem(heavy(p)).exercise_id = 'back_squat' }],
  ['S-INJURY-AVOID', p => { mainItem(heavy(p)).exercise_id = 'skater_squat' }, { ...PROFILE, injury_tags: ['knee'] }],
  ['S-BONE', p => { mainItem(heavy(p, 1)).exercise_id = 'pogo_hops' }, { ...PROFILE, bone_health_flag: true }],
  ['S-PLYO-TOO-SOON', p => { mainItem(heavy(p, 0)).exercise_id = 'pogo_hops' }],
  ['S-PLYO-INJURY', p => { mainItem(heavy(p, 1)).exercise_id = 'pogo_hops' }, { ...PROFILE, injury_tags: ['achilles'] }],
  ['S-PLYO-TAPER', p => { const s = p.weeks[3].sessions.find(x => x.kind !== 'mobility')!; s.blocks.push({ role: 'plyo', items: [{ exercise_id: 'pogo_hops', sets: 3, contacts: 10, rir: null, rest_s: 60, per_side: false }] }); s.heavy_legs = true }],
  ['S-PLYO-CONTACTS', p => { const s = heavy(p, 1); s.blocks.push({ role: 'plyo', items: [{ exercise_id: 'pogo_hops', sets: 9, contacts: 10, rir: null, rest_s: 60, per_side: false }] }) }],
  ['S-RIR-FLOOR', p => { mainItem(heavy(p)).rir = 1 }],
  ['S-NOVICE-REPS', p => { mainItem(heavy(p)).reps = 5 }, { ...PROFILE, experience: 'new' }],
  ['S-DELOAD-SETS', p => { mainItem(p.weeks[2].sessions.find(s => s.kind !== 'mobility')!).sets = 4 }],
  ['S-CORE-DOSE', p => { for (const s of p.weeks[0].sessions) s.blocks = s.blocks.filter(b => b.role !== 'core') }],
  ['S-TOO-MANY', () => {}, { ...PROFILE, sessions_per_week: 1 }],
  ['S-MAIN-ELIGIBLE', p => { mainItem(heavy(p)).exercise_id = 'kettlebell_swing' }, { ...PROFILE, equipment: [...PROFILE.equipment, 'kettlebell'] }],
  ['S-BEFORE-START', p => { p.start_date = dateOf(1, 'mon') }],
  ['S-PLYO-START-LEVEL', p => { heavy(p, 1).blocks.push({ role: 'plyo', items: [{ exercise_id: 'drop_jump', sets: 3, contacts: 10, rir: null, rest_s: 60, per_side: false }] }) }],
  ['S-PEAK-SETS', p => { p.weeks[0].phase = 'peak'; mainItem(heavy(p)).sets = 4 }],
  ['S-LOWER-BALANCE', p => { const m = heavy(p).blocks.find(b => b.role === 'main')!; m.items = m.items.map(i => (CATALOGUE_BY_ID.get(i.exercise_id)!.pattern === 'single_leg' ? { ...i, exercise_id: 'single_leg_rdl_loaded' } : i)) }],
  ['S-WARMUP-REPEAT', p => { const s = heavy(p); s.blocks[0].items.push({ exercise_id: 'band_walk_warmup', sets: 1, reps: 8, rir: null, rest_s: 0, per_side: false }); s.blocks.push({ role: 'accessory', items: [{ exercise_id: 'banded_side_step', sets: 2, reps: 10, rir: 2, rest_s: 60, per_side: false }] }) }],
]

/** Codes that need a calendar long enough to open the jumps gate; woken in the describe below. */
const LONG_CASES = ['S-PLYO-MISSING', 'S-NO-STRENGTH-ON-DOUBLE',
  // Checked by `recoveryEaseViolations` (session pair, not plan); each arm woken in recovery.test.ts.
  'S-RECOVERY-SUBTRACT-ONLY',
  // Checked by `progressionViolations` (logs + suggestion, not a plan); woken in progression.test.ts.
  'S-PROGRESSION-BOUNDED']

/** Nine build weeks then three PEAK weeks: long enough for the jumps gate (week 5), and peak is
 *  where a 30-minute session's jumps were dropped then never re-offered (measured, 78 cases). */
function longCtx(startWeek = 0): RunContext {
  const days: RunDay[] = []
  for (let w = 0; w < 12; w++) for (let k = 0; k < 7; k++) {
    const d = new Date(Date.UTC(2026, 10, 2 + w * 7 + k)).toISOString().slice(0, 10)
    days.push({ date: d, day: DAYS[k], week_n: w + 1, role: WEEK[k] })
  }
  void startWeek
  return { version: 1, days, race_date: null, injury_tags: [], masters: false, weeks: Array.from({ length: 12 }, (_, i) => ({ n: i + 1, phase: (i >= 9 ? 'peak' : 'build') as RunWeek['phase'] })) }
}

describe('🔴 STRENGTH-PLYO-BUDGET-01 + STRENGTH-START-WEEK-01, on a real 12-week plan', () => {
  const L = longCtx()
  const hasPlyo = (w: StrengthPlan['weeks'][number]) => w.sessions.some(s => s.blocks.some(b => b.role === 'plyo' && b.items.length))
  // Bands-only at 30 minutes is the profile the sweep caught: the jump dose had reached its cap
  // and was dropped, then the fill step spent the freed minutes on a main set instead.
  for (const [minutes, equipment] of [[30, PROFILE.equipment], [30, ['bands']], [45, PROFILE.equipment], [60, PROFILE.equipment]] as const) {
    it(`${minutes} min, ${equipment.join('+')}: jumps arrive EVERY week once the gate opens`, () => {
      const plan = generateStrengthPlan({ ...PROFILE, session_minutes: minutes, equipment: [...equipment] }, L)
      expect(validateStrengthPlan(plan, L)).toEqual([])
      const after = plan.weeks.slice(4)
      expect(after.filter(hasPlyo).length, after.map(w => (hasPlyo(w) ? 'J' : '.')).join('')).toBe(after.length)
    })
  }
  it('the first jump is the easiest one (level 1), whatever the lifting level', () => {
    for (const experience of ['new', 'some', 'regular'] as const) {
      const plan = generateStrengthPlan({ ...PROFILE, experience }, L)
      const first = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.blocks).find(b => b.role === 'plyo')?.items[0]
      expect(first && ['pogo_hops', 'skipping_rope_style'].includes(first.exercise_id), `${experience}: ${first?.exercise_id}`).toBe(true)
    }
  })
  // With dumbbells only, a regular lifter's heavy hinge is the kickstand RDL, which is how you load a hinge
  // heavily without a bar; with a barbell, bilateral work must appear (it used to vanish for running focus).
  it('🔴 S6 Am.1: running focus with a barbell still gets BILATERAL loaded hinges', () => {
    const plan = generateStrengthPlan({ ...PROFILE, equipment: [...PROFILE.equipment, 'barbell', 'rack'] }, L)
    const hinges = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.blocks.filter(b => b.role === 'main').flatMap(b => b.items))
      .map(i => CATALOGUE_BY_ID.get(i.exercise_id)!).filter(e => e.pattern === 'hinge')
    expect(hinges.length).toBeGreaterThan(0)
    expect(hinges.some(e => !e.unilateral && e.equipment.every(o => o.some(t => ['dumbbells', 'kettlebell', 'barbell'].includes(t)))), hinges.map(e => e.id).join(',')).toBe(true)
  })
  it('🔴 S3 Am.1: a day holding two runs gets no strength, and the check catches one placed there', () => {
    const plan = generateStrengthPlan(PROFILE, L)
    const target = plan.weeks[6].sessions[0].date!
    const doubled = { ...L, days: L.days.map(d => (d.date === target ? { ...d, runs: 2 } : d)) }
    expect(validateStrengthPlan(plan, doubled).map(v => v.code)).toContain('S-NO-STRENGTH-ON-DOUBLE')
    const replaced = generateStrengthPlan(PROFILE, doubled)
    expect(replaced.weeks.flatMap(w => w.sessions).some(s => s.date === target)).toBe(false)
    expect(validateStrengthPlan(replaced, doubled)).toEqual([])
  })
  it('S-PLYO-MISSING fires when a due week has its jumps stripped', () => {
    const plan = clone(generateStrengthPlan(PROFILE, L))
    for (const s of plan.weeks[6].sessions) s.blocks = s.blocks.filter(b => b.role !== 'plyo')
    expect(validateStrengthPlan(plan, L).map(v => v.code)).toContain('S-PLYO-MISSING')
  })
  it('🔴 strength set up in week 7 starts its OWN technique block and jumps gate, with nothing placed before it', () => {
    const start = L.days.find(d => d.week_n === 7 && d.day === 'mon')!.date
    const fresh = generateStrengthPlan({ ...PROFILE, experience: 'new' }, L, { startDate: start })
    expect(validateStrengthPlan(fresh, L)).toEqual([])
    expect(fresh.start_date).toBe(start)
    expect(fresh.weeks.slice(0, 6).every(w => w.sessions.length === 0)).toBe(true)
    // Week 7 is strength week 1: technique reps on every main lift, and no jumps.
    const w7 = fresh.weeks[6]
    const mainReps = w7.sessions.flatMap(s => s.blocks.filter(b => b.role === 'main').flatMap(b => b.items.map(i => i.reps)))
    expect(mainReps.length).toBeGreaterThan(0)
    expect(mainReps.every(r => r === 10), String(mainReps)).toBe(true)
    expect(fresh.weeks.slice(6).some(hasPlyo)).toBe(false)  // new lifters wait 8 weeks; 6 remain
  })
  it('🔴 the validator counts from the start too: the old run-week count is caught', () => {
    const start = L.days.find(d => d.week_n === 7 && d.day === 'mon')!.date
    const legacy = clone(generateStrengthPlan({ ...PROFILE, experience: 'new' }, L))  // built from week 1
    legacy.start_date = start
    for (let i = 0; i < 6; i++) legacy.weeks[i].sessions = []
    // Its week 7 still carries week-7 dose (heavy, past the technique block): now a violation.
    expect(validateStrengthPlan(legacy, L).map(v => v.code)).toContain('S-NOVICE-REPS')
  })
})

describe('validateStrengthPlan', () => {
  it('the base plan is clean, so every case below breaks exactly one thing', () => {
    expect(validateStrengthPlan(BASE, C)).toEqual([])
    expect(BASE.weeks[0].sessions.some(s => s.heavy_legs)).toBe(true)
  })

  for (const [code, mutate, profile] of CASES) {
    it(`🔴 ${code} fires when its rule is broken`, () => {
      const p = clone(profile && code !== 'S-UNAVAILABLE-DAY' && code !== 'S-TOO-MANY' ? generateStrengthPlan(profile, C) : BASE)
      // Profile-only cases keep the base sessions and swap in the profile they break.
      if (profile && (code === 'S-UNAVAILABLE-DAY' || code === 'S-TOO-MANY')) p.profile = profile
      mutate(p)
      expect(codes(p)).toContain(code)
    })
  }

  it('🔴 no rule exists without a case that wakes it', () => {
    const src = readFileSync('packages/strength/validate.ts', 'utf8')
    const declared = Array.from(new Set(Array.from(src.matchAll(/code: '(S-[A-Z0-9-]+)'/g)).map(m => m[1]))).sort()
    expect(declared.length).toBeGreaterThan(25)
    expect([...CASES.map(c => c[0]), ...LONG_CASES].sort()).toEqual(declared)
  })
})
