import { describe, it, expect } from 'vitest'
import { generateStrengthPlan, type Day, type EquipmentTag, type RunContext, type RunRole, type StrengthProfile } from '@/packages/strength'
import { partEffort, sessionEffort, sessionParts, trainingParts } from './sessionParts'

/**
 * STRENGTH-SESSION-PARTS-01 (Design Board 2026-10-28 E) — the parts a session is read in. Measured before the build over
 * 53,330 sessions: 14,593 superset pairs cross a block, 1,580 of 55,968 pairs carry unequal sets, 37% of training sessions
 * mix RIRs. Each arm below guards one of those.
 */

const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const WEEKS: RunRole[][] = [
  ['rest', 'easy', 'rest', 'easy', 'rest', 'easy', 'rest'],
  ['easy', 'quality', 'easy', 'quality', 'easy', 'long', 'rest'],
]
function ctx(week: RunRole[], weeks: number): RunContext {
  const days = Array.from({ length: weeks }, (_, w) => week.map((role, k) => ({
    date: new Date(Date.UTC(2026, 10, 2 + w * 7 + k)).toISOString().slice(0, 10), day: DAYS[k], week_n: w + 1, role,
  }))).flat()
  return { version: 1, days, weeks: Array.from({ length: weeks }, (_, i) => ({ n: i + 1, phase: (i % 4 === 3 ? 'deload' : 'build') as never })), race_date: null, injury_tags: [], masters: false }
}
const KITS: EquipmentTag[][] = [['dumbbells', 'bench', 'bands'], ['bodyweight'], ['barbell', 'rack', 'bench', 'dumbbells', 'cable', 'machines']]

const sessions = WEEKS.flatMap(week => (['running', 'general'] as const).flatMap(focus => KITS.flatMap(equipment =>
  ([2, 3, 4] as const).flatMap(n => ([30, 45, 60] as const).flatMap(minutes => (['new', 'regular'] as const).flatMap(experience =>
    generateStrengthPlan({ focus, session_minutes: minutes, sessions_per_week: n, equipment, experience } as StrengthProfile, ctx(week, 12))
      .weeks.flatMap(w => w.sessions)))))))

describe('sessionParts', () => {
  it('reaches the shapes it was built for: cross-block pairs, unequal sets in a pair, mixed effort', () => {
    let crossBlock = 0, unequal = 0, mixed = 0
    for (const s of sessions) for (const p of sessionParts(s)) {
      if (p.kind === 'superset' && new Set(p.items.map(i => i.role)).size > 1) crossBlock++
      if (p.kind === 'superset' && new Set(p.items.map(i => i.sets)).size > 1) unequal++
      if (partEffort(p, sessionEffort(sessionParts(s)))) mixed++
    }
    expect(sessions.length).toBeGreaterThan(1000)
    expect(crossBlock).toBeGreaterThan(0)
    expect(unequal).toBeGreaterThan(0)
    expect(mixed).toBeGreaterThan(0)
  })

  it('every item lands in exactly one part, in the session order once each superset is gathered', () => {
    for (const s of sessions) {
      const parts = sessionParts(s)
      const flat = parts.flatMap(p => p.items.map(i => `${i.role}:${i.exercise_id}`))
      expect(flat.slice().sort()).toEqual(s.blocks.flatMap(b => b.items.map(i => `${b.role}:${i.exercise_id}`)).sort())
      // A part's FIRST item keeps its place: the parts read in the order the session was built.
      const order = s.blocks.flatMap(b => b.items.map(i => `${b.role}:${i.exercise_id}`))
      const firsts = parts.map(p => order.indexOf(`${p.items[0].role}:${p.items[0].exercise_id}`))
      expect(firsts).toEqual(firsts.slice().sort((a, b) => a - b))
    }
  })

  it('a superset is one part holding every item of its tag, and nothing else', () => {
    for (const s of sessions) {
      const tags = new Map<string, number>()
      for (const b of s.blocks) for (const i of b.items) if (i.superset) tags.set(i.superset, (tags.get(i.superset) ?? 0) + 1)
      for (const p of sessionParts(s)) {
        const own = Array.from(new Set(p.items.map(i => i.superset)))
        expect(own.length).toBe(1)
        if (own[0]) expect(p.items.length).toBe(tags.get(own[0]))
        expect(p.kind === 'superset').toBe(p.items.length > 1 && !['warmup', 'cooldown'].includes(p.kind))
      }
    }
  })

  it('a part counts the most sets any item carries and rests the longest rest (as estimateMinutes does)', () => {
    for (const s of sessions) for (const p of sessionParts(s)) {
      expect(p.rounds).toBe(Math.max(...p.items.map(i => i.sets)))
      expect(p.rest_s).toBe(Math.max(...p.items.map(i => i.rest_s)))
    }
  })

  it('the warm-up and cool-down are parts but not numbered training parts', () => {
    for (const s of sessions) {
      const parts = sessionParts(s)
      expect(trainingParts(parts).every(p => p.kind !== 'warmup' && p.kind !== 'cooldown')).toBe(true)
      if (s.kind !== 'mobility') expect(parts[0].kind).toBe('warmup')
    }
  })

  it('the session effort is the commonest reps-based RIR, ties to the harder; a timed-only session has none', () => {
    const mk = (rirs: (number | null)[]) => ({ blocks: [{ role: 'main' as const, items: rirs.map((rir, k) => ({ exercise_id: `x${k}`, sets: 3, reps: rir == null ? undefined : 8, seconds: rir == null ? 30 : undefined, rir, rest_s: 90, per_side: false })) }] })
    expect(sessionEffort(sessionParts(mk([2, 2, 3])))).toBe(2)
    expect(sessionEffort(sessionParts(mk([3, 2])))).toBe(2)
    expect(sessionEffort(sessionParts(mk([null, null])))).toBeNull()
  })
})
