import { describe, it, expect } from 'vitest'
import type { Plan } from '@/types/plan'
import { planToRunContext, runRoleOf, runContextSig } from './runContext'
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
import { STRENGTH_CONFIG } from '@/packages/strength'

/** STRENGTH-ENGINE-01 — the bridge is the only code that knows both engines. */
const S = (type: string, extra: Record<string, unknown> = {}) => ({ type, label: type, ...extra })
function plan(): Plan {
  return {
    meta: { race_date: '2026-11-21', injury_history: ['Achilles', 'knee', 'made-up'], age: 50 },
    weeks: [
      { n: 1, date: '2026-11-09', phase: 'build', sessions: { mon: S('easy'), tue: S('intervals'), thu: S('tempo'), sat: S('easy', { role: 'long_run' }), sun: S('strength') } },
      { n: 2, date: '2026-11-16', phase: 'taper', badge: 'deload', sessions: { tue: S('recovery'), sat: S('race') } },
    ],
  } as unknown as Plan
}

describe('planToRunContext', () => {
  const ctx = planToRunContext(plan())
  it('one entry per calendar day, in order, with the right weekday', () => {
    expect(ctx.days).toHaveLength(14)
    expect(ctx.days[0]).toMatchObject({ date: '2026-11-09', day: 'mon', week_n: 1 })
    expect(ctx.days[13]).toMatchObject({ date: '2026-11-22', day: 'sun', week_n: 2 })
  })
  it('classifies roles from the run engine’s own predicates', () => {
    expect(ctx.days.slice(0, 7).map(d => d.role)).toEqual(['easy', 'quality', 'rest', 'quality', 'rest', 'long', 'cross'])
    expect(ctx.days[12].role).toBe('race')
    expect(runRoleOf(null)).toBe('rest')
  })
  it('a week holding the race is race_week, whatever its phase or badge', () => {
    expect(ctx.weeks.map(w => w.phase)).toEqual(['build', 'race_week'])
  })
  it('injury tags are whitelisted and normalised; nothing free-text crosses', () => {
    expect(ctx.injury_tags.sort()).toEqual(['achilles', 'knee'])
  })
  it('masters uses the run engine’s threshold, by value', () => {
    expect(ctx.masters).toBe(50 >= GENERATION_CONFIG.MASTERS_AGE_THRESHOLD)
    const young = planToRunContext({ ...plan(), meta: { ...plan().meta, age: GENERATION_CONFIG.MASTERS_AGE_THRESHOLD - 1 } } as Plan)
    expect(young.masters).toBe(false)
  })
  it('🔴 follows the runner’s moves: a swapped quality day moves strength’s hard day too', () => {
    const moved = planToRunContext(plan(), [{ week_n: 1, original_day: 'tue', new_day: 'wed' }])
    expect(moved.days[1].role).not.toBe('quality')
    expect(moved.days[2].role).toBe('quality')
    expect(runContextSig(moved)).not.toBe(runContextSig(ctx))
  })
  it('carries no paces, zones or distances', () => {
    expect(JSON.stringify(ctx)).not.toMatch(/pace|zone|_km|hr_|bpm/i)
  })
})

describe('the strength and run engines agree on §21’s impact list', () => {
  it('PLYO_RESTRICTING_INJURIES equals HILL_RESTRICTING_INJURIES', () => {
    expect([...STRENGTH_CONFIG.PLYO_RESTRICTING_INJURIES].sort()).toEqual([...GENERATION_CONFIG.HILL_RESTRICTING_INJURIES].sort())
  })
})
