import { describe, it, expect } from 'vitest'
import { generateStrengthPlan, standaloneContext } from './generate'
import { splitFor } from './placement'
import { plyoLevel } from './select'
import { STRENGTH_CONFIG as C } from './config'
import type { Day, RunContext, RunRole, StrengthProfile } from './types'

const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
function ctx(week: RunRole[], phases: RunContext['weeks'][number]['phase'][], race: string | null = null, masters = false): RunContext {
  const days = phases.flatMap((_, w) => week.map((role, k) => ({
    date: new Date(Date.UTC(2026, 10, 2 + w * 7 + k)).toISOString().slice(0, 10), day: DAYS[k], week_n: w + 1, role,
  })))
  return { version: 1, days, weeks: phases.map((phase, i) => ({ n: i + 1, phase })), race_date: race, injury_tags: [], masters }
}
const P: StrengthProfile = { focus: 'running', session_minutes: 45, sessions_per_week: 2, equipment: ['dumbbells', 'bench', 'bands'], experience: 'some' }
const OPEN: RunRole[] = ['rest', 'easy', 'rest', 'easy', 'rest', 'easy', 'rest']
const TIGHT: RunRole[] = ['easy', 'quality', 'easy', 'quality', 'easy', 'long', 'rest']

describe('S1 — the split follows the day count', () => {
  it('1 FB · 2 FB×2 · 3 FB×2 + upper · 4 upper/lower×2', () => {
    expect(splitFor(1).kinds).toEqual(['full_body'])
    expect(splitFor(2).kinds).toEqual(['full_body', 'full_body'])
    expect(splitFor(3).kinds.sort()).toEqual(['full_body', 'full_body', 'upper_core'])
    expect(splitFor(4).kinds.sort()).toEqual(['lower_core', 'lower_core', 'upper_core', 'upper_core'])
  })
  it('a free week gets exactly what the runner asked for', () => {
    for (const n of [1, 2, 3, 4] as const) {
      const plan = generateStrengthPlan({ ...P, sessions_per_week: n }, ctx(OPEN, ['build']))
      expect(plan.weeks[0].sessions).toHaveLength(n)
      expect(plan.weeks[0].sessions.filter(s => s.heavy_legs).length).toBeLessThanOrEqual(C.MAX_HEAVY_LEG_SESSIONS_PER_WEEK)
    }
  })
})

describe('S2/S3 — a tight run week converts leg sessions, never drops them', () => {
  it('two quality days and a long run: legs stack on quality, the rest becomes upper + core', () => {
    const plan = generateStrengthPlan({ ...P, sessions_per_week: 3 }, ctx(TIGHT, ['build']))
    const w = plan.weeks[0].sessions
    expect(w).toHaveLength(3)
    const legs = w.filter(x => x.heavy_legs)
    expect(legs.map(x => x.day)).toEqual(['tue', 'thu'])
    for (const s of legs) expect(s.after_quality_run).toBe(true)
  })
  it('one quality day and a long run leave one legal leg day: the second session becomes upper + core', () => {
    const plan = generateStrengthPlan(P, ctx(['easy', 'quality', 'easy', 'easy', 'easy', 'long', 'rest'], ['build']))
    expect(plan.weeks[0].sessions.map(s => s.kind).sort()).toEqual(['full_body', 'upper_core'])
    expect(plan.notes).toContain('legs_limited_by_run_week')
  })
})

describe('S5 — taper, race week, masters', () => {
  const race = ctx(OPEN, ['taper', 'race_week'], '2026-11-14')
  it('taper drops to one session; masters keep two', () => {
    expect(generateStrengthPlan({ ...P, sessions_per_week: 3 }, race).weeks[0].sessions).toHaveLength(1)
    expect(generateStrengthPlan({ ...P, sessions_per_week: 3 }, { ...race, masters: true }).weeks[0].sessions).toHaveLength(2)
  })
  it('race week is one mobility session, nowhere near race day', () => {
    const s = generateStrengthPlan(P, race).weeks[1].sessions
    expect(s.map(x => x.kind)).toEqual(['mobility'])
    expect(s[0].date! < '2026-11-13').toBe(true)
  })
})

describe('S8 — plyometrics after strength, not with it', () => {
  const plyo = (p: StrengthProfile, weeks: number) => generateStrengthPlan(p, ctx(OPEN, Array(weeks).fill('build')))
    .weeks.map(w => w.sessions.some(s => s.blocks.some(b => b.role === 'plyo')))
  it('none before week 4 (week 8 for new lifters), none in general focus, none with the bone flag', () => {
    const p = { ...P, session_minutes: 60 as const }
    expect(plyo(p, 10).slice(0, C.PLYO_MIN_WEEKS).some(Boolean)).toBe(false)
    expect(plyo(p, 10).slice(C.PLYO_MIN_WEEKS).some(Boolean)).toBe(true)
    expect(plyo({ ...p, experience: 'new' }, 10).slice(0, C.PLYO_MIN_WEEKS_NEW).some(Boolean)).toBe(false)
    expect(plyo({ ...p, focus: 'general' }, 10).some(Boolean)).toBe(false)
    expect(plyo({ ...p, bone_health_flag: true }, 10).some(Boolean)).toBe(false)
  })
})

describe('S10 — every session fits its length, with a warm-up first', () => {
  it('30 / 45 / 60 across experience and kit', () => {
    for (const session_minutes of [30, 45, 60] as const) for (const experience of ['new', 'some', 'regular'] as const) for (const equipment of [['bodyweight'], ['dumbbells', 'bench', 'bands']] as const) {
      const plan = generateStrengthPlan({ ...P, session_minutes, experience, equipment: [...equipment] }, ctx(OPEN, ['build', 'build', 'build', 'build', 'build']))
      for (const s of plan.weeks.flatMap(w => w.sessions)) {
        expect(s.blocks[0].role).toBe('warmup')
        expect(s.estimated_minutes).toBeLessThanOrEqual(session_minutes)
        expect(s.estimated_minutes).toBeGreaterThanOrEqual(session_minutes * C.MIN_BUDGET_USE)
      }
    }
  })
})

describe('honesty and the standalone path', () => {
  it('bodyweight-only plans say so', () => {
    expect(generateStrengthPlan({ ...P, equipment: ['bodyweight'] }, ctx(OPEN, ['build'])).notes).toContain('bodyweight_ceiling')
  })
  it('standalone needs a start date and produces the standalone weeks', () => {
    expect(() => generateStrengthPlan(P, null)).toThrow()
    const plan = generateStrengthPlan(P, null, { standaloneStart: '2026-11-02' })
    expect(plan.standalone).toBe(true)
    expect(plan.weeks).toHaveLength(C.STANDALONE_WEEKS)
    expect(standaloneContext('2026-11-02').days[0]).toMatchObject({ date: '2026-11-02', day: 'mon' })
  })
  it('is deterministic: the same inputs give the same plan', () => {
    expect(JSON.stringify(generateStrengthPlan(P, ctx(TIGHT, ['build', 'build'])))).toBe(JSON.stringify(generateStrengthPlan(P, ctx(TIGHT, ['build', 'build']))))
  })
  it('unavailable days are never used', () => {
    const plan = generateStrengthPlan({ ...P, sessions_per_week: 4, unavailable_days: ['mon', 'wed'] }, ctx(OPEN, ['build']))
    expect(plan.weeks[0].sessions.map(s => s.day)).not.toContain('mon')
    expect(plan.weeks[0].sessions.map(s => s.day)).not.toContain('wed')
  })
})

describe('S8 — the first jump a runner meets is level 1, however late it arrives', () => {
  const base = { profile: { focus: 'running', session_minutes: 45, sessions_per_week: 2, equipment: ['bodyweight'], experience: 'regular' } as StrengthProfile, injuries: [], preferUnilateral: true }
  it('no jump placed yet: level 1 even many weeks after the gate opened', () => {
    expect(plyoLevel({ ...base, weekIndex: 12 })).toBe(1)
  })
  it('climbs one rung per two blocks from the first PLACED jump', () => {
    expect(plyoLevel({ ...base, weekIndex: 12, plyoFirstWeek: 12 })).toBe(1)
    expect(plyoLevel({ ...base, weekIndex: 12 + C.BLOCK_WEEKS * 2, plyoFirstWeek: 12 })).toBe(2)
  })
})
