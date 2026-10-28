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

describe('S14 Am.1 — the view reads the plan\'s reps for each log\'s date', () => {
  // A general plan on a small kit, where a main lift carries from a 6-rep block into a 10-rep one.
  // Twenty build weeks: the cycle is 10 → 8 → 6 over three blocks, so the first rise is the fourth block.
  const roles = ['rest', 'easy', 'rest', 'easy', 'rest', 'easy', 'rest'] as const, dayNames = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
  const run = { version: 1 as const, race_date: null, injury_tags: [], masters: false,
    weeks: Array.from({ length: 20 }, (_, i) => ({ n: i + 1, phase: 'build' as const })),
    days: Array.from({ length: 20 }, (_, w) => roles.map((role, k) => ({ date: new Date(Date.UTC(2026, 10, 2 + w * 7 + k)).toISOString().slice(0, 10), day: dayNames[k], week_n: w + 1, role }))).flat() }
  const g = generateStrengthPlan({ focus: 'general', session_minutes: 45, sessions_per_week: 2, equipment: ['dumbbells'], experience: 'regular' }, run)
  const appearances = g.weeks.flatMap(w => w.sessions).flatMap(s => s.blocks.filter(b => b.role === 'main').flatMap(b => b.items.map(it => ({ s, it }))))
    .filter(x => x.s.date && isLoadedLift(x.it.exercise_id))
  const lastReps = new Map<string, { reps: number; date: string }>()
  let rise: (typeof appearances)[number] | undefined, prior: { reps: number; date: string } | undefined
  for (const x of appearances) {
    const p = lastReps.get(x.it.exercise_id)
    if (!rise && p && p.reps < (x.it.reps ?? 0)) { rise = x; prior = p }
    lastReps.set(x.it.exercise_id, { reps: x.it.reps ?? 0, date: x.s.date! })
  }
  it('a carried lift whose reps rise is offered less than it last lifted', () => {
    expect(rise, 'the plan should hold a 6 → 10 carry on a dumbbell-only kit').toBeDefined()
    const l: LiftLog[] = [{ date: prior!.date, exercise_id: rise!.it.exercise_id, load_kg: 20, feel: 'right', counts: true }]
    const s = liftSuggestionsFor(g, rise!.s, l, {})[rise!.it.exercise_id]
    expect(s.kind).toBe('more_reps')
    expect(s.load_kg!).toBeLessThan(20)
  })
})
