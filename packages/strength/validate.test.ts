import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { generateStrengthPlan, standaloneContext } from './generate'
import { heavyLegsLegal } from './placement'
import { validateStrengthPlan } from './validate'
import { withChosenDays } from './profile'
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
  // STRENGTH-FULLBODY-NO-UPPER-01 — a 45-min full body with its upper work removed.
  ['S-FULLBODY-UPPER', p => { for (const s of p.weeks[0].sessions.filter(x => x.kind === 'full_body')) for (const b of s.blocks) if (b.role !== 'warmup') b.items = b.items.filter(i => !CATALOGUE_BY_ID.get(i.exercise_id)!.pattern.startsWith('upper')) }],
  // STRENGTH-CHOSEN-NO-LEGS-01 — a heavy lift marked "light", and a week with every leg item removed.
  ['S-LIGHT-LOWER-ONLY', p => { mainItem(heavy(p)).light = true }],
  ['S-LEGS-EVERY-WEEK', p => { for (const s of p.weeks[0].sessions) { s.blocks = s.blocks.filter(b => b.role !== 'plyo').map(b => b.role === 'warmup' ? b : { ...b, items: b.items.filter(i => { const e = CATALOGUE_BY_ID.get(i.exercise_id)!; return !['squat', 'hinge', 'single_leg', 'calf', 'plyometric', 'hip_abduction'].includes(e.pattern) }) }).filter(b => b.items.length); s.heavy_legs = false } }],
  ['S-WARMUP-REPEAT', p => { const s = heavy(p); s.blocks[0].items.push({ exercise_id: 'band_walk_warmup', sets: 1, reps: 8, rir: null, rest_s: 0, per_side: false }); s.blocks.push({ role: 'accessory', items: [{ exercise_id: 'banded_side_step', sets: 2, reps: 10, rir: 2, rest_s: 60, per_side: false }] }) }],
]

/** Codes that need a calendar long enough to open the jumps gate; woken in the describe below. */
const LONG_CASES = ['S-PLYO-MISSING', 'S-NO-STRENGTH-ON-DOUBLE',
  // Checked by `recoveryEaseViolations` (session pair, not plan); each arm woken in recovery.test.ts.
  'S-RECOVERY-SUBTRACT-ONLY',
  // Checked by `progressionViolations` (logs + suggestion, not a plan); woken in progression.test.ts.
  'S-PROGRESSION-BOUNDED',
  // Needs chosen days on the profile; both arms (off a chosen day, a chosen day left empty) woken below.
  'S-PINNED-DAYS']

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

describe('PINNED-DAYS-01 (S1 Am.2) — chosen days are the sessions', () => {
  const chosen = withChosenDays(PROFILE, ['thu', 'mon'])
  const plan = generateStrengthPlan(chosen, C)
  const ordinary = plan.weeks.filter(w => ['base', 'build', 'peak', 'deload'].includes(w.phase))

  it('the profile is normalised: count = sessions, the rest unavailable, week order', () => {
    expect(chosen.available_days).toEqual(['mon', 'thu'])
    expect(chosen.sessions_per_week).toBe(2)
    expect(chosen.unavailable_days).toEqual(['tue', 'wed', 'fri', 'sat', 'sun'])
  })

  it('every ordinary week lifts on exactly the chosen days, and the plan validates clean', () => {
    expect(ordinary.length).toBe(3)
    for (const w of ordinary) expect(w.sessions.map(s => s.day).sort()).toEqual(['mon', 'thu'])
    expect(validateStrengthPlan(plan, C)).toEqual([])
  })

  it('a chosen day on a run day still holds a session (lifting after a run is allowed)', () => {
    // Mon and Thu are both easy-run days in this calendar.
    expect(C.days.filter(d => d.week_n === 1 && ['mon', 'thu'].includes(d.day)).every(d => d.role === 'easy')).toBe(true)
  })

  it('a chosen day the runner made a two-run day is left empty, and that is not a violation', () => {
    const c2 = ctx(); c2.days.find(d => d.week_n === 1 && d.day === 'thu')!.runs = 2
    const p2 = generateStrengthPlan(chosen, c2)
    expect(p2.weeks[0].sessions.map(s => s.day)).toEqual(['mon'])
    expect(validateStrengthPlan(p2, c2).map(v => v.code)).not.toContain('S-PINNED-DAYS')
  })

  it('🔴 fires on a session moved off a chosen day', () => {
    const p = clone(plan); const s = p.weeks[0].sessions.find(x => x.day === 'thu')!
    s.date = dateOf(0, 'sun'); s.day = 'sun'; s.after_quality_run = false
    // The off-day arm names the session's own day; the presence arm (Thursday now empty) names a date.
    expect(validateStrengthPlan(p, C).some(v => v.code === 'S-PINNED-DAYS' && v.day === 'sun')).toBe(true)
  })

  it('🔴 fires on a chosen day left without a session in an ordinary week', () => {
    const p = clone(plan); p.weeks[1].sessions = p.weeks[1].sessions.filter(x => x.day !== 'mon')
    expect(codes(p)).toContain('S-PINNED-DAYS')
  })

  it('a chosen day inside the last week before the race gets no strength, even in a taper week (S5)', () => {
    // Week 4 is taper; its Sunday is six days before Saturday's race. Earliest-day placement used to keep strength
    // out of that window by accident; a runner who chose Sunday reached it.
    const sun = withChosenDays(PROFILE, ['sun'])
    const p = generateStrengthPlan(sun, C)
    expect(p.weeks[3].phase).toBe('taper')
    expect(p.weeks[3].sessions).toEqual([])
    expect(validateStrengthPlan(p, C)).toEqual([])
  })

  it('a chosen day in the race window of a week NOT labelled taper is still exempt, not flagged empty', () => {
    const c3 = ctx(); c3.weeks[3] = { n: 4, phase: 'build' }
    const p = generateStrengthPlan(withChosenDays(PROFILE, ['sun']), c3)
    expect(p.weeks[3].sessions).toEqual([])
    expect(validateStrengthPlan(p, c3)).toEqual([])
  })

  it('🔴 S3 Am.2: days that can never take heavy legs still get LIGHT leg work, every ordinary week', () => {
    // In this calendar Saturday is the long run: Friday is the day before it and Sunday the day after, so S2 bans
    // heavy legs on both. Before the amendment this plan held no leg work at all.
    const p = generateStrengthPlan(withChosenDays(PROFILE, ['fri', 'sun']), C)
    const ord = p.weeks.filter(w => ['base', 'build', 'peak', 'deload'].includes(w.phase))
    for (const w of ord) {
      expect(w.sessions.every(s => !s.heavy_legs)).toBe(true)
      const light = w.sessions.flatMap(s => s.blocks.flatMap(b => b.items)).filter(i => i.light)
      expect(light.length, `week ${w.n} has light leg work`).toBeGreaterThan(0)
      for (const i of light) expect(i.rir).toBeGreaterThanOrEqual(3)
    }
    expect(validateStrengthPlan(p, C)).toEqual([])
  })

  it('🔴 STRENGTH-LEGS-DAY-01: blocked days come with a day that WOULD take heavy legs, and swapping it in delivers them', () => {
    const p = generateStrengthPlan(withChosenDays(PROFILE, ['fri', 'sun']), C)
    const s = p.legs_day_suggestion!
    expect(s, 'a suggestion when the chosen days block heavy legs').toBeTruthy()
    expect(['fri', 'sun']).not.toContain(s.day)
    expect(['fri', 'sun']).toContain(s.replaces)
    const swapped = generateStrengthPlan(withChosenDays(PROFILE, ['fri', 'sun'].map(d => (d === s.replaces ? s.day : d)) as never), C)
    const heavyWeeks = swapped.weeks.filter(w => ['base', 'build', 'peak', 'deload'].includes(w.phase) && w.sessions.some(x => x.heavy_legs)).length
    expect(heavyWeeks).toBeGreaterThanOrEqual(1)
    expect(validateStrengthPlan(p, C)).toEqual([])
  })
  it('no suggestion when nothing blocks heavy legs, or the runner did not choose days', () => {
    // Tuesday is the quality day and Wednesday is easy, so heavy legs stack after the run: nothing is blocked.
    const tue = generateStrengthPlan(withChosenDays(PROFILE, ['tue']), C)
    expect(tue.notes).not.toContain('legs_limited_by_run_week')
    expect(tue.legs_day_suggestion).toBeUndefined()
    expect(BASE.legs_day_suggestion).toBeUndefined()
  })
  it('🔴 no suggestion when the legs are already served, even if one chosen day could never take them', () => {
    // Quality on Tuesday AND Thursday (both stack heavy legs after the run), long run Saturday. Three days chosen:
    // two leg sessions land on Tue/Thu, Saturday is the split's planned upper day. Nothing is short, so naming
    // another day would be noise.
    const c2 = ctx(); for (const d of c2.days) if (d.week_n <= 3 && d.day === 'thu') d.role = 'quality'
    const p = generateStrengthPlan(withChosenDays({ ...PROFILE, sessions_per_week: 3 }, ['tue', 'thu', 'sat']), c2)
    expect(p.notes).not.toContain('legs_limited_by_run_week')
    expect(p.legs_day_suggestion).toBeUndefined()
  })
  it('🔴 STRENGTH-LEGS-DAY-GATE-01: the legs-limited gate is what stops a suggestion when legs are already served', () => {
    // The arm above stays green with the gate removed: no unchosen day there beats the worst chosen one. Here one
    // does. Sunday long run only: Tue and Thu take the two leg sessions, Saturday (the day before the long run) never
    // can and carries the upper day, and Wednesday COULD take heavy legs. Without the gate the plan would say "Lift on
    // Wednesday … and your legs get a proper session" to a runner whose legs already get two. Measured with the gate
    // removed, 2026-10-21: 8 of 350 three-day picks on real run plans.
    const sunLong = standaloneContext('2026-11-02')
    for (const d of sunLong.days) if (d.day === 'sun') d.role = 'long'
    const three = { ...PROFILE, sessions_per_week: 3 as const }
    const p = generateStrengthPlan(withChosenDays(three, ['tue', 'thu', 'sat']), sunLong)
    const ord = p.weeks.filter(w => ['base', 'build', 'peak', 'deload'].includes(w.phase) && w.sessions.length)
    expect(p.notes).not.toContain('legs_limited_by_run_week')
    expect(ord.every(w => w.sessions.find(s => s.day === 'sat')?.kind === 'upper_core'), 'Saturday never takes legs').toBe(true)
    const open = { days: sunLong.days, raceDate: null, unavailable: new Set<Day>() }
    expect(sunLong.days.some((d, i) => d.day === 'wed' && heavyLegsLegal(open, i)), 'Wednesday could (S2, placement\'s own predicate)').toBe(true)
    expect(p.legs_day_suggestion).toBeUndefined()
  })
  it('🔴 STRENGTH-GENERAL-LEGS-01: S-LEGS-EVERY-WEEK covers General focus too', () => {
    const p = clone(generateStrengthPlan(withChosenDays({ ...PROFILE, focus: 'general' }, ['fri', 'sun']), C))
    for (const s of p.weeks[0].sessions) { s.blocks = s.blocks.map(b => b.role === 'warmup' ? b : { ...b, items: b.items.filter(i => !['squat', 'hinge', 'single_leg', 'calf', 'plyometric', 'hip_abduction'].includes(CATALOGUE_BY_ID.get(i.exercise_id)!.pattern)) }).filter(b => b.items.length); s.heavy_legs = false }
    expect(codes(p)).toContain('S-LEGS-EVERY-WEEK')
  })

  it('without chosen days nothing changes: the base plan carries no available_days and stays clean', () => {
    expect(BASE.profile.available_days).toBeUndefined()
    expect(validateStrengthPlan(BASE, C)).toEqual([])
  })
})
