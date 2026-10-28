import { describe, it, expect } from 'vitest'
import { generateStrengthPlan } from './generate'
import { selectExercise, type SelectionContext } from './select'
import { validateStrengthPlan } from './validate'
import { isLoadedExercise } from './catalogue'
import { STRENGTH_CONFIG as C } from './config'
import type { Day, EquipmentTag, InjuryTag, RunContext, RunRole, StrengthPlan, StrengthProfile } from './types'

/**
 * STRENGTH-AB-SESSIONS-01 (S1 Am.3, Coaching Board 2026-10-28) — two sessions of one kind in a week are an A and a B.
 * Before it, 10,178 of 14,870 sampled weeks with two or more training sessions held the same session twice.
 */

const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
function ctx(week: RunRole[], weeks: number): RunContext {
  const days = Array.from({ length: weeks }, (_, w) => week.map((role, k) => ({
    date: new Date(Date.UTC(2026, 10, 2 + w * 7 + k)).toISOString().slice(0, 10), day: DAYS[k], week_n: w + 1, role,
  }))).flat()
  return { version: 1, days, weeks: Array.from({ length: weeks }, (_, i) => ({ n: i + 1, phase: 'build' as const })), race_date: null, injury_tags: [], masters: false }
}
const OPEN: RunRole[] = ['rest', 'easy', 'rest', 'easy', 'rest', 'easy', 'rest']
// Two quality days and a long run: legs convert, so a four-session week holds three upper sessions.
const TIGHT: RunRole[] = ['easy', 'quality', 'easy', 'quality', 'easy', 'long', 'rest']
// One legal heavy-leg day (Tuesday's quality run): a four-session week is one lower and three upper sessions.
const ONE_LEG_DAY: RunRole[] = ['easy', 'quality', 'easy', 'easy', 'quality', 'long', 'rest']
const KITS: EquipmentTag[][] = [['dumbbells', 'bench', 'bands'], ['dumbbells'], ['bodyweight'], ['barbell', 'rack', 'bench', 'dumbbells', 'cable', 'machines']]

const training = (plan: StrengthPlan, w: number) => plan.weeks[w].sessions.filter(s => s.kind !== 'mobility')
const signature = (s: StrengthPlan['weeks'][number]['sessions'][number]) =>
  s.blocks.filter(b => b.role !== 'warmup' && b.role !== 'mobility').flatMap(b => b.items.map(i => i.exercise_id)).sort().join(' ')
const mains = (s: StrengthPlan['weeks'][number]['sessions'][number]) => s.blocks.filter(b => b.role === 'main').flatMap(b => b.items.map(i => i.exercise_id))

describe('S1 Am.3 — no two training sessions in a week are the same', () => {
  for (const focus of ['running', 'general'] as const) for (const kit of KITS) for (const week of [OPEN, TIGHT, ONE_LEG_DAY]) for (const n of [2, 3, 4] as const) for (const minutes of [30, 45, 60] as const) {
    it(`${focus} · ${kit.join('+')} · ${week === OPEN ? 'open' : week === TIGHT ? 'tight' : 'one-leg-day'} week · ${n} × ${minutes} min`, () => {
      const c = ctx(week, 8)
      const plan = generateStrengthPlan({ focus, session_minutes: minutes, sessions_per_week: n, equipment: kit, experience: 'new' }, c)
      // Distinct AND still a valid plan: a B that runs past the clock is refused at the route (code review, 2026-10-28).
      expect(validateStrengthPlan(plan, c)).toEqual([])
      for (let w = 0; w < 8; w++) {
        const sigs = training(plan, w).map(signature)
        expect(sigs.length).toBeGreaterThanOrEqual(2)
        expect(new Set(sigs).size).toBe(sigs.length)
      }
    })
  }

  it('🔴 the smallest pool still separates: bodyweight, knee and back history, new, three upper sessions in a week', () => {
    // The sweep's one wrap-round case, reproduced: a new lifter's technique block on bodyweight with knee and back
    // history has a pool small enough that a third upper session rotated back to its A (15 weeks in the sample).
    const week: RunRole[] = ['rest', 'rest', 'quality', 'rest', 'easy', 'rest', 'long']
    const profile: StrengthProfile = { focus: 'running', session_minutes: 45, sessions_per_week: 4, equipment: ['bodyweight'], experience: 'new', injury_tags: ['knee', 'back'] as InjuryTag[] }
    const plan = generateStrengthPlan(profile, ctx(week, 4))
    let threeUpper = 0
    for (let w = 0; w < 4; w++) {
      const t = training(plan, w)
      if (t.filter(s => s.kind === 'upper_core').length >= 3) threeUpper++
      expect(new Set(t.map(signature)).size).toBe(t.length)
    }
    expect(threeUpper).toBeGreaterThan(0)
  })
})

describe('S1 Am.3 — A and B each hold for the block, so S14 can progress them', () => {
  it('in an unchanged run week, the B session keeps its main lifts for every week of a block', () => {
    const plan = generateStrengthPlan({ focus: 'general', session_minutes: 45, sessions_per_week: 2, equipment: KITS[0], experience: 'regular' }, ctx(OPEN, 12))
    const novice = C.NOVICE_BLOCK_WEEKS.regular
    for (let w = novice; w + 1 < 12; w++) {
      if (Math.floor(w / C.BLOCK_WEEKS) !== Math.floor((w + 1) / C.BLOCK_WEEKS)) continue
      const [a0, b0] = training(plan, w), [a1, b1] = training(plan, w + 1)
      expect(mains(a1)).toEqual(mains(a0))
      expect(mains(b1)).toEqual(mains(b0))
      expect(mains(b0)).not.toEqual(mains(a0))
    }
  })
})

describe('S1 Am.3 — a B never trades load away (S6)', () => {
  const base: SelectionContext = {
    profile: { focus: 'general', session_minutes: 45, sessions_per_week: 2, equipment: KITS[0], experience: 'regular' } as StrengthProfile,
    injuries: [], weekIndex: 4, preferUnilateral: false,
  }
  it('variant 0 is the answer the selector gave before variants existed', () => {
    for (const pattern of ['squat', 'hinge', 'single_leg', 'upper_push', 'upper_pull', 'anti_rotation'] as const) {
      expect(selectExercise(pattern, { ...base, variant: 0 }, new Set(), true)?.id).toBe(selectExercise(pattern, base, new Set(), true)?.id)
    }
  })
  it('a B main lift is loaded whenever the runner owns load and a loaded option exists', () => {
    for (const pattern of ['squat', 'hinge', 'single_leg', 'upper_push', 'upper_pull'] as const) {
      for (const variant of [1, 2, 3]) {
        const ex = selectExercise(pattern, { ...base, variant }, new Set(), true)
        expect(ex && isLoadedExercise(ex), `${pattern} variant ${variant}: ${ex?.id}`).toBe(true)
      }
    }
  })
})
