import { describe, it, expect } from 'vitest'
import { generateStrengthPlan, isLoadedLift, type LiftLog, type StrengthPlan } from '@/packages/strength'
import { liftSuggestionsFor, logsOn } from './progressionView'

/** STRENGTH-PROGRESSION-01 — the view hands each main lift the rule's answer, holding back in a no-step session. */
const plan: StrengthPlan = generateStrengthPlan({ focus: 'running', session_minutes: 60, sessions_per_week: 2, equipment: ['dumbbells', 'bench'], experience: 'regular' }, null, { standaloneStart: '2026-11-02' })
const session = plan.weeks.flatMap(w => w.sessions).filter(s => s.date && s.blocks.some(b => b.role === 'main' && b.items.some(i => isLoadedLift(i.exercise_id))))[3]
const lift = session.blocks.find(b => b.role === 'main')!.items.find(i => isLoadedLift(i.exercise_id))!.exercise_id
const before = new Date(Date.parse(session.date! + 'T00:00:00Z') - 7 * 86_400_000).toISOString().slice(0, 10)
const logs: LiftLog[] = [{ date: before, exercise_id: lift, load_kg: 40, feel: 'easy', counts: true }]
const asPhase = (phase: string): StrengthPlan => ({ ...plan, weeks: plan.weeks.map(w => (w.sessions.includes(session) ? { ...w, phase: phase as never } : w)) })

describe('liftSuggestionsFor', () => {
  it('a build week steps; only main lifts are in the map', () => {
    const s = liftSuggestionsFor(plan, session, logs, {})
    expect(s[lift].kind).toBe('step')
    const mains = new Set(session.blocks.filter(b => b.role === 'main').flatMap(b => b.items.map(i => i.exercise_id)))
    expect(Object.keys(s).every(k => mains.has(k))).toBe(true)
  })
  it('🔴 a deload week, a taper, or an eased day holds the load', () => {
    expect(liftSuggestionsFor(asPhase('deload'), session, logs, {})[lift].kind).toBe('hold_week')
    expect(liftSuggestionsFor(asPhase('taper'), session, logs, {})[lift].kind).toBe('hold_week')
    expect(liftSuggestionsFor(plan, session, logs, { [session.date!]: 'eased' })[lift].kind).toBe('hold_week')
    expect(liftSuggestionsFor(plan, { ...session, eased_for: 'recovery' }, logs, {})[lift].kind).toBe('hold_week')
  })
  it('logsOn returns that day\'s own logs only', () => {
    expect(logsOn([...logs, { ...logs[0], date: session.date! }], session.date)).toEqual({ [lift]: { ...logs[0], date: session.date! } })
  })
})
