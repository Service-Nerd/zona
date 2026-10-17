import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { canDouble, doubleAdvice, effectiveDoubleViolations, isRaceWeek } from './doubles'
import { resolveEffectiveDay, DAY_KEYS, type SessionOverride } from './effectiveSessions'
import { GENERATION_CONFIG } from './generationConfig'
import { formatDuration } from '@/lib/format'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { isDesignedRefusal } from './designedRefusal'

/**
 * §126 / SESSION-SLOTS-01 Phase 2 — a double is two easy runs the runner chose.
 * Coaching Board, 2026-10-17 (docs/decisions/same-day-doubles-coaching-2026-10-17.md).
 */
const easy = (label: string) => ({ type: 'easy', label })
const week = (sessions: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ sessions, ...extra }) as never
const mv = (from: string, to: string, slot: 'am' | 'pm' | null = 'pm'): SessionOverride => ({ week_n: 1, original_day: from, new_day: to, new_slot: slot })
const labels = (list: { session: { label?: string }; slot: string | null }[] | undefined) => (list ?? []).map(e => `${e.slot}:${e.session.label}`)

describe('§126 — which doubles the owner makes', () => {
  it('two easy runs: the mover takes its slot, the occupant the other half, its own day empties', () => {
    const eff = resolveEffectiveDay(week({ tue: easy('Tue'), wed: easy('Wed') }), [mv('tue', 'wed', 'pm')])
    expect(labels(eff.wed)).toEqual(['am:Wed', 'pm:Tue'])
    expect(eff.tue).toBeUndefined()
    const am = resolveEffectiveDay(week({ tue: easy('Tue'), wed: easy('Wed') }), [mv('tue', 'wed', 'am')])
    expect(labels(am.wed)).toEqual(['am:Tue', 'pm:Wed'])
  })
  it('easy + recovery is allowed', () => {
    const eff = resolveEffectiveDay(week({ tue: { type: 'recovery', label: 'Rec' }, wed: easy('Wed') }), [mv('tue', 'wed')])
    expect(eff.wed).toHaveLength(2)
  })
  for (const [what, s] of [
    ['the long run', { type: 'easy', role: 'long_run', label: 'Long' }],
    ['a quality session', { type: 'quality', label: 'Q' }],
    ['a tempo', { type: 'tempo', label: 'T' }],
    ['intervals', { type: 'intervals', label: 'I' }],
    ['the 5K time trial', { type: 'hard', label: 'TT' }],
    ['a race', { type: 'race', label: 'Race' }],
  ] as const) {
    it(`🔴 never with ${what}: the slotted move swaps exactly as an unslotted one`, () => {
      const w = week({ tue: s, wed: easy('Wed') })
      const slotted = resolveEffectiveDay(w, [mv('tue', 'wed')])
      const plain = resolveEffectiveDay(w, [mv('tue', 'wed', null)])
      expect(Object.values(slotted).every(l => l!.length === 1)).toBe(true)
      expect(JSON.stringify(slotted)).toBe(JSON.stringify(plain))
      expect(Object.values(slotted).flat()).toHaveLength(2)          // nothing dropped
    })
  }
  it('🔴 never in race week', () => {
    const eff = resolveEffectiveDay(week({ tue: easy('Tue'), wed: easy('Wed') }, { type: 'race' }), [mv('tue', 'wed')])
    expect(Object.values(eff).every(l => l!.length === 1)).toBe(true)
    expect(isRaceWeek({ sessions: {}, badge: 'race' })).toBe(true)
  })
  it('a slotted move onto an EMPTY day is just a move (no slot, no double)', () => {
    const eff = resolveEffectiveDay(week({ tue: easy('Tue') }), [mv('tue', 'thu')])
    expect(labels(eff.thu)).toEqual(['null:Tue'])
  })
  it('never three: a second slotted move onto a doubled day falls back', () => {
    const eff = resolveEffectiveDay(week({ mon: easy('Mon'), tue: easy('Tue'), wed: easy('Wed') }), [mv('tue', 'wed', 'pm'), mv('mon', 'wed', 'am')])
    expect(eff.wed).toHaveLength(2)
    expect(Object.values(eff).flat()).toHaveLength(3)
  })
  it('canDouble needs two sessions', () => {
    expect(canDouble(undefined, easy('x') as never, { sessions: {} })).toBe(false)
  })
})

describe('CHECK-EFFECTIVE-NO-HARD-DOUBLE — the independent check', () => {
  it('🔴 fires on a hand-built forbidden double, a triple and a race-week double', () => {
    const q = { session: { type: 'quality' } as never }, e = { session: { type: 'easy' } as never }
    expect(effectiveDoubleViolations({ sessions: {} }, { wed: [e, q] }).length).toBeGreaterThan(0)
    expect(effectiveDoubleViolations({ sessions: {} }, { wed: [e, e, e] }).map(v => v.detail)).toContain('3 sessions on one day')
    expect(effectiveDoubleViolations({ sessions: {}, type: 'race' }, { wed: [e, e] }).map(v => v.detail)).toContain('a double in race week')
    const lr = { session: { type: 'easy', role: 'long_run' } as never }
    expect(effectiveDoubleViolations({ sessions: {} }, { sat: [e, lr] }).length).toBeGreaterThan(0)
    expect(effectiveDoubleViolations({ sessions: {} }, { wed: [e, e] })).toEqual([])
  })
  it('🔴 every slotted move between every pair of days, on REAL generated weeks: the owner never breaks it, never drops a session', () => {
    let weeks = 0, doubles = 0
    for (const input of cohortGrid().filter((_, i) => i % 3001 === 0)) {
      let plan
      try { plan = generateRulePlan(input, 'paid', COHORT_PLAN_START) } catch (e) { if (isDesignedRefusal(e)) continue; throw e }
      for (const w of plan.weeks) {
        weeks++
        const have = DAY_KEYS.filter(d => w.sessions[d])
        for (const from of have) for (const to of DAY_KEYS) for (const slot of ['am', 'pm'] as const) {
          if (from === to) continue
          const eff = resolveEffectiveDay(w, [{ week_n: w.n, original_day: from, new_day: to, new_slot: slot }])
          expect(effectiveDoubleViolations(w, eff), `${w.n} ${from}->${to}`).toEqual([])
          expect(Object.values(eff).flat().length).toBe(have.length)
          if (Object.values(eff).some(l => l!.length === 2)) doubles++
        }
      }
    }
    expect(weeks).toBeGreaterThan(50)
    expect(doubles, 'the sweep must actually reach a double').toBeGreaterThan(0)
  })
})

describe('the advice and the writer', () => {
  it('advice names the gap from config and eating between, never "training"', () => {
    const a = doubleAdvice()
    expect(a).toContain(formatDuration(GENERATION_CONFIG.DOUBLE_RUN_MIN_GAP_HOURS * 60))
    expect(a).toContain('6h')
    expect(a.toLowerCase()).toContain('eat')
    expect(a).not.toMatch(/train|fitter|extra|—/i)
  })
  it('🔴 nothing WRITES new_slot yet (Phase 3), so no runner can reach a double before Phase 4 teaches every reader', () => {
    const files = execSync('git ls-files app components lib', { encoding: 'utf8' }).split('\n')
      .filter(f => /\.(ts|tsx)$/.test(f) && !f.includes('.test.') && f !== 'lib/plan/effectiveSessions.ts')
    const writers = files.filter(f => /new_slot\s*:/.test(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')))
    expect(writers).toEqual([])
  })
})
