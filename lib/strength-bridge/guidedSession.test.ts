import { describe, it, expect } from 'vitest'
import { generateStrengthPlan, type Day, type RunContext, type RunRole, type StrengthSession } from '@/packages/strength'
import { sessionParts } from './sessionParts'
import { STRENGTH_GUIDED, guidedReduce, guidedSteps, guidedTally, resumeGuided, secondsLeft, sessionSignature, staleGuidedKeys, startGuided, type GuidedState } from './guidedSession'

/** STRENGTH-GUIDED-SESSION-01 (Design Board 2026-10-28 F) — the guided session's steps, rest, timers, end and resume. */
const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const ctx = (weeks: number): RunContext => ({
  version: 1, race_date: null, injury_tags: [], masters: false,
  days: Array.from({ length: weeks }, (_, w) => (['rest', 'easy', 'rest', 'easy', 'rest', 'easy', 'rest'] as RunRole[]).map((role, k) => ({
    date: new Date(Date.UTC(2026, 10, 2 + w * 7 + k)).toISOString().slice(0, 10), day: DAYS[k], week_n: w + 1, role }))).flat(),
  weeks: Array.from({ length: weeks }, (_, i) => ({ n: i + 1, phase: 'build' as const })),
})
const session: StrengthSession = generateStrengthPlan(
  { focus: 'general', session_minutes: 45, sessions_per_week: 2, equipment: ['dumbbells', 'bench', 'bands'], experience: 'regular' }, ctx(8),
).weeks[2].sessions.find(s => s.kind === 'full_body')!
const parts = sessionParts(session)
const steps = guidedSteps(parts)
const T0 = 1_800_000_000_000
const run = (s: GuidedState | null, ...actions: Parameters<typeof guidedReduce>[2][]) => actions.reduce<GuidedState | null>((x, a) => (x ? guidedReduce(x, steps, a, T0) : x), s)

describe('guidedSteps', () => {
  it('one work page per round of every part, in order; rest after each round from the part\'s own rest_s', () => {
    expect(steps.filter(s => s.kind === 'work').length).toBe(parts.reduce((n, p) => n + p.rounds, 0))
    // STRENGTH-GUIDED-DEVICE-01 — the rest a round carries is now ON the work step.
    steps.forEach((st, i) => {
      if (st.restAfter_s === 0) return
      expect(st.restAfter_s).toBe(parts[st.part].rest_s)
      expect(steps[i + 1]).toBeDefined()   // something follows, or there would be no rest
    })
    const order = steps.filter(s => s.kind === 'work').map(s => `${s.part}.${s.round}`)
    expect(order).toEqual(parts.flatMap((p, i) => Array.from({ length: p.rounds }, (_, r) => `${i}.${r + 1}`)))
  })
  // STRENGTH-GUIDED-DEVICE-01 — rest is no longer a STEP, so this is now asserted on
  // `restAfter_s`. The two substantive claims are unchanged: the warm-up runs straight
  // through, and nothing rests after the last round.
  it('🔴 no rest inside the warm-up ("straight through"), and none after the session\'s last round', () => {
    expect(parts[0].kind).toBe('warmup')
    expect(steps.filter(s => s.part === 0).every(s => s.restAfter_s === 0)).toBe(true)
    expect(steps[steps.length - 1].restAfter_s).toBe(0)
    expect(steps.filter(s => s.restAfter_s > 0).length).toBeGreaterThan(0)
    // And there is no rest step left to find.
    expect(steps.every(s => s.kind === 'work')).toBe(true)
  })
})

describe('guidedReduce', () => {
  const s0 = startGuided(session, T0, {})
  // The first round that HAS a rest after it — the page the runner rests on.
  const firstRest = steps.findIndex(s => s.restAfter_s > 0)
  it('🔴 "done" on a round starts the countdown at that part\'s rest, ON THE SAME PAGE', () => {
    const r = guidedReduce({ ...s0, step: firstRest }, steps, { type: 'next' }, T0)!
    // 🔴 THE RULING, PINNED: the step does NOT move. The runner stays on the lift they
    // are doing and the rest runs inside it.
    expect(r.step).toBe(firstRest)
    expect(r.restEndsAt).toBe(T0 + steps[firstRest].restAfter_s * 1000)
    expect(secondsLeft(r.restEndsAt, T0 + 10_000)).toBe(steps[firstRest].restAfter_s - 10)
    expect(secondsLeft(r.restEndsAt, T0 + 10 * 60_000)).toBe(0)
    // A second `next`, once resting, is what advances.
    expect(guidedReduce(r, steps, { type: 'next' }, T0)!.step).toBe(firstRest + 1)
  })
  it('+30 s extends the rest; skip rest ENDS the countdown and does not advance', () => {
    const r = guidedReduce({ ...s0, step: firstRest }, steps, { type: 'next' }, T0)!
    expect(guidedReduce(r, steps, { type: 'extendRest' }, T0)!.restEndsAt).toBe(r.restEndsAt! + STRENGTH_GUIDED.REST_EXTEND_S * 1000)
    // ⚠️ BEHAVIOUR CHANGE, ruled 2026-11-04. Skip used to jump to the next round. With rest
    // in place, Skip rest and Start round N are two controls on one page: skip stops the
    // clock, the runner is back on the work page, and `next` moves them on.
    const skipped = guidedReduce(r, steps, { type: 'skipRest' }, T0)!
    expect(skipped.step).toBe(firstRest)
    expect(skipped.restEndsAt).toBeNull()
    expect(guidedReduce(skipped, steps, { type: 'next' }, T0)!.step).toBe(firstRest + 1)
  })
  it('🔴 +30 s after the rest has run out counts from now, not from the old end', () => {
    const r = guidedReduce({ ...s0, step: firstRest }, steps, { type: 'next' }, T0)!
    const late = T0 + 600_000
    expect(guidedReduce(r, steps, { type: 'extendRest' }, late)!.restEndsAt).toBe(late + STRENGTH_GUIDED.REST_EXTEND_S * 1000)
  })
  it('back goes to the previous round and clears any rest; back on the first page leaves (null)', () => {
    const after = guidedReduce({ ...s0, step: firstRest + 1 }, steps, { type: 'back' }, T0)!
    expect(after.step).toBe(firstRest)
    expect(after.restEndsAt).toBeNull()
    // Going back while resting abandons the rest: back is to redo or check a round.
    const resting = { ...s0, step: firstRest, restEndsAt: T0 + 1 }
    expect(guidedReduce(resting, steps, { type: 'back' }, T0)!.step).toBe(firstRest - 1)
    expect(guidedReduce(s0, steps, { type: 'back' }, T0)).toBeNull()
  })
  it('🔴 done on the last round ends the session and counts it; End session ends it anywhere, without the round in hand', () => {
    const last = guidedReduce({ ...s0, step: steps.length - 1 }, steps, { type: 'next' }, T0 + 51 * 60_000)!
    expect(last.endedAt).toBe(T0 + 51 * 60_000)
    const ended = guidedReduce({ ...s0, step: steps.length - 1 }, steps, { type: 'end' }, T0 + 51 * 60_000)!
    expect(guidedTally(last, steps, parts).rounds).toBe(guidedTally(ended, steps, parts).rounds + 1)
    expect(run(s0, { type: 'next' }, { type: 'end' })!.endedAt).toBe(T0)
  })
  it('a timed move\'s timer starts on tap and a second tap stops it; weights must be positive', () => {
    const t = run(s0, { type: 'toggleTimer', exerciseId: 'x', seconds: 40 })!
    expect(t.timers['0:x']).toBe(T0 + 40_000)
    expect(run(t, { type: 'toggleTimer', exerciseId: 'x', seconds: 40 })!.timers['0:x']).toBeUndefined()
    expect(run(s0, { type: 'setWeight', exerciseId: 'y', kg: 42.5 })!.weights.y).toBe(42.5)
    expect(run(s0, { type: 'setWeight', exerciseId: 'y', kg: 0 })!.weights.y).toBeUndefined()
  })
})

describe('the tally and resume', () => {
  it('🔴 ending mid-way counts only the training rounds finished, not the warm-up, not the round in progress', () => {
    const firstTraining = steps.findIndex(s => s.kind === 'work' && parts[s.part].kind !== 'warmup')
    const s = { ...startGuided(session, T0, {}), step: firstTraining + 1, endedAt: T0 + 20 * 60_000 }
    const t = guidedTally(s, steps, parts)
    expect(t.minutes).toBe(20)
    expect(t.rounds).toBe(steps.slice(0, firstTraining + 1).filter(x => x.kind === 'work' && parts[x.part].kind !== 'warmup').length)
    expect(t.parts).toBe(1)
  })
  it('the whole session: every training round and part', () => {
    const s = guidedReduce({ ...startGuided(session, T0, {}), step: steps.length - 1 }, steps, { type: 'next' }, T0 + 50 * 60_000)!
    const training = parts.filter(p => p.kind !== 'warmup' && p.kind !== 'cooldown')
    expect(guidedTally(s, steps, parts)).toEqual({ minutes: 50, parts: training.length, rounds: training.reduce((n, p) => n + p.rounds, 0) })
  })
  it('🔴 resumes the same day\'s progress for the same session (an ended one to its end page); another day or session starts fresh', () => {
    const s = { ...startGuided(session, T0, { a: 20 }), step: 4 }
    expect(resumeGuided(JSON.stringify(s), session, steps.length)).toMatchObject({ step: 4, weights: { a: 20 } })
    expect(resumeGuided(JSON.stringify({ ...s, date: '2020-01-01' }), session, steps.length)).toBeNull()
    expect(resumeGuided(JSON.stringify({ ...s, signature: 'other' }), session, steps.length)).toBeNull()
    expect(resumeGuided(JSON.stringify({ ...s, endedAt: T0 }), session, steps.length)).toMatchObject({ endedAt: T0 })
    expect(resumeGuided('not json', session, steps.length)).toBeNull()
    expect(resumeGuided(null, session, steps.length)).toBeNull()
    expect(sessionSignature({ blocks: [] })).toBe('')
  })
  it('🔴 a saved step the session no longer has is not resumed (a rebuild moved its rests): no crash on open', () => {
    const s = startGuided(session, T0, {})
    expect(resumeGuided(JSON.stringify({ ...s, step: steps.length + 3 }), session, steps.length)).toBeNull()
    expect(resumeGuided(JSON.stringify({ ...s, step: steps.length }), session, steps.length)).toBeNull()
    expect(resumeGuided(JSON.stringify({ ...s, step: steps.length, endedAt: T0 }), session, steps.length)).toMatchObject({ step: steps.length })
    const otherRest = { ...session, blocks: session.blocks.map(b => ({ ...b, items: b.items.map(i => ({ ...i, rest_s: i.rest_s + 30 })) })) }
    expect(sessionSignature(otherRest)).not.toBe(sessionSignature(session))
  })
  it('🔴 other days\' progress is found for removal; today\'s and unrelated keys are left', () => {
    expect(staleGuidedKeys([STRENGTH_GUIDED.storageKey('2026-11-01'), STRENGTH_GUIDED.storageKey('2026-11-03'), 'zona_wizard_draft'], '2026-11-03'))
      .toEqual([STRENGTH_GUIDED.storageKey('2026-11-01')])
  })
  it('the stepper moves by the engine\'s own load step: lower 2.5 kg, upper 1 kg', () => {
    const mains = session.blocks.find(b => b.role === 'main')!.items.map(i => STRENGTH_GUIDED.stepKg(i.exercise_id))
    expect(new Set(mains)).toEqual(new Set([2.5, 1]))
  })
})

/**
 * STRENGTH-GUIDED-DEVICE-01 (Design Board 2026-11-04) — the gym does not hand you the
 * machines in our order. Founder, from a real session: "I can't always get access to
 * machines in the order you prescribe, so you can't move forward and back or see what
 * they are without quitting."
 */
describe('STRENGTH-GUIDED-DEVICE-01 — jump, and the rest that is not a step', () => {
  const s0 = startGuided(session, T0, {})
  const firstRest = steps.findIndex(s => s.restAfter_s > 0)

  it('jumps forward and back to any round, clearing the rest', () => {
    const far = steps.length - 1
    expect(guidedReduce(s0, steps, { type: 'jump', step: far }, T0)!.step).toBe(far)
    const back = guidedReduce({ ...s0, step: far }, steps, { type: 'jump', step: 1 }, T0)!
    expect(back.step).toBe(1)
    expect(back.restEndsAt).toBeNull()
    expect(back.restedStep).toBeNull()
  })

  it('an out-of-range jump is IGNORED, never clamped', () => {
    // A stale index from a rebuilt session must not land somewhere plausible — the same
    // reasoning as `resumeGuided` refusing a step the session no longer has.
    for (const step of [-1, steps.length, steps.length + 50]) {
      expect(guidedReduce(s0, steps, { type: 'jump', step }, T0)!.step).toBe(s0.step)
    }
  })

  it('🔴 skip rest then done ADVANCES — it does not restart the rest', () => {
    // The loop this pins: both "not rested yet" and "rest skipped" have restEndsAt null,
    // so without `restedStep` the runner is handed the same rest for ever.
    const resting = guidedReduce({ ...s0, step: firstRest }, steps, { type: 'next' }, T0)!
    const skipped = guidedReduce(resting, steps, { type: 'skipRest' }, T0)!
    expect(guidedReduce(skipped, steps, { type: 'next' }, T0)!.step).toBe(firstRest + 1)
  })

  it('🔴 letting the rest run out then done also advances', () => {
    const resting = guidedReduce({ ...s0, step: firstRest }, steps, { type: 'next' }, T0)!
    const late = T0 + 600_000
    expect(secondsLeft(resting.restEndsAt, late)).toBe(0)
    expect(guidedReduce(resting, steps, { type: 'next' }, late)!.step).toBe(firstRest + 1)
  })

  it('every round is reachable by next alone, and the count did not change', () => {
    // The step list lost its rest entries, so this is the arm that would catch a round
    // going missing with them.
    let s = s0, seen = 0
    for (let i = 0; i < steps.length * 3 && s.step < steps.length; i++) {
      const r = guidedReduce(s, steps, { type: 'next' }, T0)
      if (!r) break
      if (r.step !== s.step) seen++
      s = r
    }
    expect(seen).toBe(steps.length)
    expect(steps.length).toBe(parts.reduce((a, p) => a + p.rounds, 0))
  })
})
