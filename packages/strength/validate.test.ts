import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { generateStrengthPlan } from './generate'
import { validateStrengthPlan } from './validate'
import type { Day, RunContext, RunDay, RunRole, StrengthPlan, StrengthProfile, StrengthSession } from './types'

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
  ['S-WARMUP-REPEAT', p => { const s = heavy(p); s.blocks[0].items.push({ exercise_id: 'band_walk_warmup', sets: 1, reps: 8, rir: null, rest_s: 0, per_side: false }); s.blocks.push({ role: 'accessory', items: [{ exercise_id: 'banded_side_step', sets: 2, reps: 10, rir: 2, rest_s: 60, per_side: false }] }) }],
]

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
    expect(CASES.map(c => c[0]).sort()).toEqual(declared)
  })
})
