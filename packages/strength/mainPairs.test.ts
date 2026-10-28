import { describe, it, expect } from 'vitest'
import { generateStrengthPlan } from './generate'
import { estimateMinutes } from './session'
import { validateStrengthPlan } from './validate'
import { CATALOGUE_BY_ID, PATTERN_REGION } from './catalogue'
import { STRENGTH_CONFIG as C } from './config'
import type { Day, EquipmentTag, RunContext, RunRole, SessionMinutes, StrengthProfile } from './types'

/**
 * STRENGTH-SUPERSET-MAINS-01 (S10 Am.5, Coaching Board 2026-10-28 D) — a lower and an upper main lift go back to back,
 * and the warm-up is rounds of a shorter list. Measured before: 2,372 of 6,606 general 30-minute sessions held both a
 * lower and an upper main lift and paired neither; running-focus sessions hold no upper main, so none pair.
 */

const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const OPEN: RunRole[] = ['rest', 'easy', 'rest', 'easy', 'rest', 'easy', 'rest']
function ctx(weeks: number): RunContext {
  const days = Array.from({ length: weeks }, (_, w) => OPEN.map((role, k) => ({
    date: new Date(Date.UTC(2026, 10, 2 + w * 7 + k)).toISOString().slice(0, 10), day: DAYS[k], week_n: w + 1, role,
  }))).flat()
  return { version: 1, days, weeks: Array.from({ length: weeks }, (_, i) => ({ n: i + 1, phase: 'build' as const })), race_date: null, injury_tags: [], masters: false }
}
const KIT: EquipmentTag[] = ['dumbbells', 'bench', 'bands']
const profile = (focus: StrengthProfile['focus'], session_minutes: SessionMinutes): StrengthProfile =>
  ({ focus, session_minutes, sessions_per_week: 2, equipment: KIT, experience: 'regular' })
const region = (id: string) => PATTERN_REGION[CATALOGUE_BY_ID.get(id)!.pattern]

describe('S10 Am.5 — main pairs', () => {
  for (const minutes of [30, 45, 60] as const) {
    it(`general · ${minutes} min: every full-body session pairs each lower main with an upper main, at one rest`, () => {
      const plan = generateStrengthPlan(profile('general', minutes), ctx(8))
      const sessions = plan.weeks.flatMap(w => w.sessions).filter(s => s.kind === 'full_body')
      expect(sessions.length).toBeGreaterThan(0)
      for (const s of sessions) {
        const mains = s.blocks.find(b => b.role === 'main')!.items
        const tags = Array.from(new Set(mains.map(i => i.superset)))
        expect(tags.every(Boolean)).toBe(true)
        for (const t of tags) {
          const pair = mains.filter(i => i.superset === t)
          expect(pair.map(i => region(i.exercise_id)).sort()).toEqual(['lower', 'upper'])
          expect(pair[0].rest_s).toBe(pair[1].rest_s)
          expect(pair[0].sets).toBe(pair[1].sets)
        }
      }
    })
  }

  it('running focus pairs no main lift: its lower mains are heavy, and there is no upper main to go with them', () => {
    const plan = generateStrengthPlan(profile('running', 45), ctx(8))
    const mains = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.blocks.filter(b => b.role === 'main').flatMap(b => b.items))
    expect(mains.length).toBeGreaterThan(0)
    expect(mains.filter(i => i.superset)).toEqual([])
  })

  it('pairing is what saves the time: the same blocks with the pairs undone run longer', () => {
    const s = generateStrengthPlan(profile('general', 45), ctx(8)).weeks[4].sessions[0]
    const unpaired = s.blocks.map(b => (b.role === 'main' ? { ...b, items: b.items.map(({ superset: _, ...i }) => i) } : b))
    expect(estimateMinutes(unpaired, C.WARMUP_MINUTES[45])).toBeGreaterThan(estimateMinutes(s.blocks, C.WARMUP_MINUTES[45]))
  })
})

describe('S10 Am.5 — the warm-up is rounds', () => {
  for (const minutes of [30, 45, 60] as const) {
    it(`${minutes} min: ${C.WARMUP_ROUNDS[minutes]} round(s) of ${C.WARMUP_ITEMS_PER_ROUND[minutes]}, inside the ${C.WARMUP_MINUTES[minutes]} minutes reserved`, () => {
      for (const focus of ['running', 'general'] as const) {
        const plan = generateStrengthPlan(profile(focus, minutes), ctx(8))
        for (const s of plan.weeks.flatMap(w => w.sessions).filter(x => x.kind !== 'mobility')) {
          const warm = s.blocks[0].items
          // The ramp set before heavy legs is one extra single set; at one round it shares the round's set count.
          const ramp = s.heavy_legs ? 1 : 0
          const rounds = warm.filter(i => i.sets === C.WARMUP_ROUNDS[minutes])
          expect(rounds.length).toBe(C.WARMUP_ITEMS_PER_ROUND[minutes] + (C.WARMUP_ROUNDS[minutes] === 1 ? ramp : 0))
          expect(warm.length).toBe(C.WARMUP_ITEMS_PER_ROUND[minutes] + ramp)
        }
      }
    })
  }
})

describe('S6 Am.2 (STRENGTH-REP-BLOCKS-01) — general mains cycle their reps by block; running lower mains stay heavy', () => {
  for (const experience of ['regular', 'some', 'new'] as const) {
    it(`${experience}: every block of a 16-week plan validates, and the general cycle shows each of its rep targets`, () => {
      const c = ctx(16)
      const general = generateStrengthPlan({ ...profile('general', 45), experience }, c)
      expect(validateStrengthPlan(general, c)).toEqual([])
      const novice = C.NOVICE_BLOCK_WEEKS[experience]
      const seen = new Set(general.weeks.slice(novice).flatMap(w => w.sessions).flatMap(s => s.blocks.filter(b => b.role === 'main').flatMap(b => b.items.map(i => i.reps))))
      for (const r of C.MAIN_REP_CYCLE_GENERAL) if (r !== C.NOVICE_REPS || novice < C.BLOCK_WEEKS) expect(seen.has(r), `${r} reps`).toBe(true)
      const running = generateStrengthPlan({ ...profile('running', 45), experience }, c)
      expect(validateStrengthPlan(running, c)).toEqual([])
    })
  }
})
