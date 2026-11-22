// ADR027-B3-VERIFIER — the strength rules agree with the old strength validator, finding for finding.
//
// Two populations: (1) the old suite's own one-rule breakages on its 5-week and 12-week calendars (copied from
// packages/strength/validate.test.ts, not imported: the strength package is frozen engine code), so every S- code is
// woken; (2) the strength sweep's real plans, strength placed around generated run plans and standalone. The old side
// is validateStrengthPlan / recoveryEaseViolations / progressionViolations; the key is (code, week, date-or-day).
import { describe, it, expect, beforeAll } from 'vitest'
import { generateStrengthPlan, standaloneContext } from '@/packages/strength/generate'
import { validateStrengthPlan, recoveryEaseViolations, progressionViolations } from '@/packages/strength/validate'
import { easeForRecovery } from '@/packages/strength/recovery'
import { suggestLoad, isNoStepSession } from '@/packages/strength/progression'
import { CATALOGUE_BY_ID, PATTERN_REGION } from '@/packages/strength/catalogue'
import { STRENGTH_CONFIG } from '@/packages/strength/config'
import type { Day, RunContext, RunDay, RunRole, RunWeek, StrengthPlan, StrengthProfile, StrengthSession } from '@/packages/strength/types'
import { cohortGrid, COHORT_PLAN_START } from '@/lib/plan/cohortGrid'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { isDesignedRefusal } from '@/lib/plan/designedRefusal'
import { planToRunContext } from '@/lib/strength-bridge/runContext'
import { strengthProfileGrid } from '@/lib/strength-bridge/profileGrid'
import { RULES } from '@/lib/engine/catalogue/rules'
import { verifyStrengthPlan, verifyRecoveryEase, verifyProgression, type StrengthFinding } from './verifyStrength'

// ── The old suite's fixtures, verbatim ──────────────────────────────────────────────────────────
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
  // S10 Am.4 — under the floor with an accessory set still under its cap. Week 0 is a training week in BASE.
  ['S-TIME-FILL', p => { const s = p.weeks[0].sessions[0]; s.estimated_minutes = 30; const acc = s.blocks.find(b => b.role === 'accessory' || b.role === 'core')!; acc.items[0].sets = 1 }],
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
  // S1 Am.3 — the week's B session made a copy of its A (the pre-STRENGTH-AB-SESSIONS-01 engine, 68% of weeks).
  // S10 Am.5 — a main pair rests less than its heavier half carries alone.
  ['S-MAIN-PAIR-REST', p => { const it = p.weeks[0].sessions.flatMap(s => s.blocks).filter(b => b.role === 'main').flatMap(b => b.items).find(i => i.superset)!; it.rest_s = 30 }, { ...PROFILE, focus: 'general' }],
  // S10 Am.5 — a warm-up twice the length of its rounds.
  ['S-WARMUP-ROUNDS', p => { const w = p.weeks[0].sessions[0].blocks[0]; w.items.push(...JSON.parse(JSON.stringify(w.items))) }],
  // S6 Am.2 — a general main lift at a rep count its block does not hold (the pre-cycle engine's flat 8 in block 1).
  ['S-REP-BLOCK', p => { const it = p.weeks[0].sessions.flatMap(s => s.blocks).filter(b => b.role === 'main').flatMap(b => b.items)[0]; it.reps = 8 }, { ...PROFILE, focus: 'general' }],
  ['S-AB-DISTINCT', p => { const [a, b] = p.weeks[0].sessions; b.blocks = JSON.parse(JSON.stringify(a.blocks)) }],
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

// ── The comparison ──────────────────────────────────────────────────────────────────────────────

type Case = { label: string; plan: StrengthPlan; ctx: RunContext | null }
const cases: Case[] = []
const key = (code: string, week: number, at: string | null | undefined) => `${code}|${week}|${at ?? '-'}`
const oldKeys = (c: Case) => validateStrengthPlan(c.plan, c.ctx).map(v => key(v.code, v.week, v.day)).sort()
const newKeys = (fs: StrengthFinding[]) => fs.map(f => key(f.rule_id, f.week, f.at)).sort()

beforeAll(() => {
  // (1) the old suite's breakages: every CASE on its base calendar, and the long-calendar cases.
  cases.push({ label: 'base', plan: BASE, ctx: C })
  for (const [code, mutate, profile] of CASES) {
    const p = clone(profile && code !== 'S-UNAVAILABLE-DAY' && code !== 'S-TOO-MANY' ? generateStrengthPlan(profile, C) : BASE)
    if (profile && (code === 'S-UNAVAILABLE-DAY' || code === 'S-TOO-MANY')) p.profile = profile
    mutate(p)
    cases.push({ label: `case ${code}`, plan: p, ctx: C })
  }
  const L = longCtx()
  const long = generateStrengthPlan(PROFILE, L)
  cases.push({ label: 'long', plan: long, ctx: L })
  const target = long.weeks[6].sessions[0].date!
  cases.push({ label: 'long / strength on a two-run day', plan: long, ctx: { ...L, days: L.days.map(d => (d.date === target ? { ...d, runs: 2 } : d)) } })
  const stripped = clone(long); for (const s of stripped.weeks[6].sessions) s.blocks = s.blocks.filter(b => b.role !== 'plyo')
  cases.push({ label: 'long / jumps stripped from a due week', plan: stripped, ctx: L })
  const start = L.days.find(d => d.week_n === 7 && d.day === 'mon')!.date
  const legacy = clone(generateStrengthPlan({ ...PROFILE, experience: 'new' }, L)); legacy.start_date = start
  for (let i = 0; i < 6; i++) legacy.weeks[i].sessions = []
  cases.push({ label: 'long / counted from the run plan, not the start', plan: legacy, ctx: L })
  const chosen = generateStrengthPlan({ ...PROFILE, available_days: ['tue', 'thu'], sessions_per_week: 2 }, L)
  const moved = clone(chosen); const s0 = moved.weeks[1].sessions[0]; if (s0) { s0.day = 'wed'; s0.date = L.days.find(d => d.week_n === 2 && d.day === 'wed')!.date }
  cases.push({ label: 'long / chosen days', plan: chosen, ctx: L }, { label: 'long / a session moved off a chosen day', plan: moved, ctx: L })
  const emptied = clone(chosen); emptied.weeks[1].sessions = emptied.weeks[1].sessions.slice(1)
  cases.push({ label: 'long / a chosen day left empty', plan: emptied, ctx: L })
  // At the lines the old suite reaches only through its own `it` cases (each was green under a mutation without them):
  // a per-side jump counted on both legs; an upper accessory one RIR under the general floor (the lower-heavy floor
  // masks it on a leg lift); a chosen day inside the race window of a week NOT labelled taper.
  const ps = clone(BASE); heavy(ps, 1).blocks.push({ role: 'plyo', items: [{ exercise_id: 'single_leg_pogo', sets: 4, contacts: 10, rir: null, rest_s: 60, per_side: true }] })
  cases.push({ label: 'extra per-side jump contacts', plan: ps, ctx: C })
  const rir = clone(BASE)
  const upperAcc = rir.weeks[0].sessions.flatMap(x => x.blocks).filter(b => b.role === 'accessory' || b.role === 'main').flatMap(b => b.items)
    .find(i => { const e = CATALOGUE_BY_ID.get(i.exercise_id); return !!e && e.pattern.startsWith('upper') })
  if (upperAcc) { upperAcc.rir = STRENGTH_CONFIG.RIR_FLOOR - 1; cases.push({ label: 'extra upper lift under the RIR floor', plan: rir, ctx: C }) }
  const noTaper: RunContext = { ...C, weeks: C.weeks.map(w => (w.n === 4 ? { ...w, phase: 'build' as const } : w)) }
  cases.push({ label: 'race window, week not labelled taper, chosen days', plan: generateStrengthPlan({ ...PROFILE, available_days: ['wed', 'sun'], sessions_per_week: 2 }, noTaper), ctx: noTaper })
  // (2) the sweep: strength around real run plans, every 11th profile per plan, and standalone.
  const profiles = strengthProfileGrid()
  const inputs = cohortGrid().filter((_, i) => i % 9001 === 0)
  inputs.forEach((input, k) => {
    let plan
    try { plan = generateRulePlan(input, 'paid', COHORT_PLAN_START) } catch (e) { if (isDesignedRefusal(e)) return; throw e }
    const rc = planToRunContext(plan)
    for (let j = k % 11; j < profiles.length; j += 11) cases.push({ label: `sweep ${k}/${j}`, plan: generateStrengthPlan(profiles[j], rc), ctx: rc })
  })
  for (let j = 0; j < profiles.length; j += 7) { const sc = standaloneContext('2026-11-02'); cases.push({ label: `standalone ${j}`, plan: generateStrengthPlan(profiles[j], sc), ctx: sc }) }
})

const S_CODES = RULES.filter(r => r.id.startsWith('S-')).map(r => r.id)
const PLAN_CODES = S_CODES.filter(c => c !== 'S-RECOVERY-SUBTRACT-ONLY' && c !== 'S-PROGRESSION-BOUNDED')

describe('ADR027-B3-VERIFIER — strength plans', () => {
  it('the corpus holds the breakages and the sweep', () => {
    expect(cases.filter(c => c.label.startsWith('sweep')).length).toBeGreaterThan(30)
    expect(cases.filter(c => c.label.startsWith('case')).length).toBe(CASES.length)
  })

  it('🔴 every strength-plan finding agrees, on every plan', () => {
    const diffs = cases.flatMap(c => {
      const o = oldKeys(c), n = newKeys(verifyStrengthPlan(c.plan, c.ctx))
      return JSON.stringify(o) === JSON.stringify(n) ? [] : [`${c.label}: old [${o}] new [${n}]`]
    })
    expect(diffs.slice(0, 5), `${diffs.length} disagreements`).toEqual([])
  })

  it('🔴 every strength-plan rule fires somewhere (else agreement proves nothing for it)', () => {
    const fired = new Set(cases.flatMap(c => validateStrengthPlan(c.plan, c.ctx).map(v => v.code)))
    expect(PLAN_CODES.filter(c => !fired.has(c))).toEqual([])
  })

  it('🔴 S13: the recovery ease agrees, on every eased session and on broken ones', () => {
    const sessions = cases.slice(0, 200).flatMap(c => c.plan.weeks.flatMap(w => w.sessions)).filter(s => s.kind !== 'mobility').slice(0, 300)
    let fired = 0
    const diffs: string[] = []
    for (const s of sessions) {
      const ok = easeForRecovery(s)
      const broken: StrengthSession[] = [ok]
      const add = JSON.parse(JSON.stringify(ok)) as StrengthSession; add.blocks[add.blocks.length - 1]?.items.push({ exercise_id: 'pogo_hops', sets: 3, contacts: 10, rir: null, rest_s: 60, per_side: false }); broken.push(add)
      const up = JSON.parse(JSON.stringify(ok)) as StrengthSession; const it0 = up.blocks.find(b => b.role === 'main')?.items[0]; if (it0) { it0.sets += 2; it0.reps = (it0.reps ?? 0) + 2 }; broken.push(up)
      const unstamped = { ...ok, eased_for: undefined } as StrengthSession; broken.push(unstamped)
      const noCalf = JSON.parse(JSON.stringify(ok)) as StrengthSession; for (const b of noCalf.blocks) b.items = b.items.filter(i => CATALOGUE_BY_ID.get(i.exercise_id)?.pattern !== 'calf'); broken.push(noCalf)
      for (const e of broken) {
        const o = recoveryEaseViolations(s, e).map(v => key(v.code, v.week, v.day) + v.detail).sort()
        const n = verifyRecoveryEase(s, e).map(f => key(f.rule_id, f.week, f.at) + f.detail).sort()
        fired += o.length
        if (JSON.stringify(o) !== JSON.stringify(n)) diffs.push(`${s.week_n}/${s.day}: old [${o}] new [${n}]`)
      }
    }
    expect(diffs.slice(0, 5)).toEqual([])
    expect(fired).toBeGreaterThan(0)
  })

  it('🔴 S14: load progression agrees, on suggested loads and on jumps', () => {
    const lifts = Array.from(CATALOGUE_BY_ID.values()).filter(e => e.equipment.some(o => o.some(t => t === 'dumbbells' || t === 'barbell'))).slice(0, 12)
    let fired = 0
    const diffs: string[] = []
    for (const ex of lifts) for (const feel of ['easy', 'ok', 'hard'] as const) for (const noStep of [false, true]) for (const gap of [3, 10]) {
      const history = [0, 1, 2].map(k => ({ date: new Date(Date.UTC(2026, 9, 1 + k * gap)).toISOString().slice(0, 10), exercise_id: ex.id, load_kg: 10 + k * 2.5, feel: k === 2 ? feel : 'ok', counts: true, reps: 8 }))
      const today = new Date(Date.UTC(2026, 9, 1 + 3 * gap)).toISOString().slice(0, 10)
      const sug = suggestLoad(history as never, { exerciseId: ex.id, today, noStep: isNoStepSession(noStep ? 'deload' : 'build', false), injuries: [] })
      const region = PATTERN_REGION[ex.pattern], step = region === 'lower' ? STRENGTH_CONFIG.LOAD_STEP_KG_LOWER : STRENGTH_CONFIG.LOAD_STEP_KG_UPPER
      const oneStepOver = 15 + step + STRENGTH_CONFIG.LOAD_ROUND_KG   // just past one step above the last load (15 kg)
      for (const s of [sug, { ...sug, load_kg: (sug.load_kg ?? 15) + 10 }, { ...sug, load_kg: oneStepOver }, { ...sug, extra_reps: 9 }]) for (const reps of [undefined, 8, 10]) {
        const o = progressionViolations(history, ex.id, today, noStep, s, reps).map(v => key(v.code, v.week, v.day) + v.detail).sort()
        const n = verifyProgression(history, ex.id, today, noStep, s, reps).map(f => key(f.rule_id, f.week, f.at) + f.detail).sort()
        fired += o.length
        if (JSON.stringify(o) !== JSON.stringify(n)) diffs.push(`${ex.id}: old [${o}] new [${n}]`)
      }
    }
    expect(diffs.slice(0, 5)).toEqual([])
    expect(fired).toBeGreaterThan(0)
  })

  it('every strength code the catalogue lists has a verifier', () => {
    const src = require('node:fs').readFileSync('lib/engine/verifier/verifyStrength.ts', 'utf8') as string
    const emitted = new Set(Array.from(src.matchAll(/code: '(S-[A-Z0-9-]+)'/g)).map(m => m[1]))
    expect(S_CODES.filter(c => !emitted.has(c))).toEqual([])
  })
})

void (null as unknown as Day | RunDay | RunRole | RunWeek | StrengthProfile)
