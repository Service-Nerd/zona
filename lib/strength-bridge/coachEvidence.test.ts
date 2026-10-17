import { describe, it, expect } from 'vitest'
import { cohortGrid, COHORT_PLAN_START } from '@/lib/plan/cohortGrid'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { isDesignedRefusal } from '@/lib/plan/designedRefusal'
import { planToRunContext } from './runContext'
import { strengthWeekEvidence } from './coachEvidence'
import { STRENGTH_COACH } from './display'
import { STRENGTH_CONFIG, generateStrengthPlan, type StrengthProfile } from '@/packages/strength'

/**
 * STRENGTH-ENTRY-01 — Coach's strength evidence, read from REAL generated plans (a real run
 * plan, the real strength engine), so the progression line is checked against what the engine
 * actually produced rather than against a fixture written to agree with it.
 */
const run = (() => {
  for (const input of cohortGrid().filter(i => i.race_distance_km >= 21)) {
    try {
      const p = generateRulePlan(input, 'paid', COHORT_PLAN_START)
      if (p.weeks.length >= 14) return p
    } catch (e) { if (!isDesignedRefusal(e)) throw e }
  }
  throw new Error('no 14-week plan in the grid')
})()
const ctx = planToRunContext(run)
const gym: StrengthProfile['equipment'] = ['bodyweight', 'bands', 'dumbbells', 'kettlebell', 'bench', 'box', 'barbell', 'rack']
const make = (experience: StrengthProfile['experience'], focus: StrengthProfile['focus'] = 'running') =>
  generateStrengthPlan({ focus, experience, sessions_per_week: 2, session_minutes: 45, equipment: gym, injury_tags: [], bone_health_flag: false, unavailable_days: [] }, ctx)

describe('strengthWeekEvidence — the count', () => {
  const plan = make('some')
  const week = plan.weeks.find(w => w.sessions.length >= 2)!
  it('counts done sessions against planned for the week', () => {
    const done = { [week.sessions[0].date!]: 'done' as const }
    expect(strengthWeekEvidence(plan, done, week.n)).toMatchObject({ done: 1, planned: week.sessions.length })
  })
  it('a skipped session is not done', () => {
    const c = { [week.sessions[0].date!]: 'skipped' as const }
    expect(strengthWeekEvidence(plan, c, week.n)!.done).toBe(0)
  })
  it('says nothing for no plan, an unknown week, or a week with no strength', () => {
    expect(strengthWeekEvidence(null, {}, week.n)).toBeNull()
    expect(strengthWeekEvidence(plan, {}, 9999)).toBeNull()
    expect(strengthWeekEvidence(plan, {}, null)).toBeNull()
    const empty = { ...plan, weeks: plan.weeks.map(w => w.n === week.n ? { ...w, sessions: [] } : w) }
    expect(strengthWeekEvidence(empty, {}, week.n)).toBeNull()
  })
  it('the copy is the count, not a streak', () => {
    expect(STRENGTH_COACH.count(1, 2)).toBe('1 of 2 this week')
  })
})

describe('strengthWeekEvidence — the next step is the ENGINE\'s, read from its output', () => {
  it('a new lifter in the technique block is told when the lifts get heavier', () => {
    const plan = make('new')
    const ev = strengthWeekEvidence(plan, {}, plan.weeks[0].n)!
    expect(ev.next?.kind).toBe('heavier')
    // Agrees with the engine's own technique-block length.
    expect(ev.next?.week).toBe(plan.weeks[STRENGTH_CONFIG.NOVICE_BLOCK_WEEKS.new].n)
  })
  const firstPlyo = (plan: ReturnType<typeof make>) =>
    plan.weeks.findIndex(w => w.sessions.some(s => s.blocks.some(b => b.role === 'plyo' && b.items.length)))
  it('a regular lifter (no technique block, running focus) is told when the jumps join', () => {
    const plan = make('regular')
    const at = firstPlyo(plan)
    // The engine's gate opens at PLYO_MIN_WEEKS; placement decides the first real week (8 here,
    // measured). The line names the week jumps ACTUALLY appear, never the gate.
    expect(at).toBeGreaterThanOrEqual(STRENGTH_CONFIG.PLYO_MIN_WEEKS)
    expect(strengthWeekEvidence(plan, {}, plan.weeks[0].n)!.next).toEqual({ kind: 'jumps', week: plan.weeks[at].n })
  })
  it('🔴 control: general focus has no jumps and no technique block, so there is nothing to name', () => {
    const plan = make('regular', 'general')
    expect(strengthWeekEvidence(plan, {}, plan.weeks[0].n)!.next).toBeNull()
  })
  it('🔴 once the jumps have started, the line goes quiet, even on a week without them', () => {
    const plan = make('regular')
    const at = firstPlyo(plan)
    const after = plan.weeks.slice(at).filter(w => w.sessions.length > 0)
    expect(after.length).toBeGreaterThan(1)
    for (const w of after) expect(strengthWeekEvidence(plan, {}, w.n)!.next, `week ${w.n}`).toBeNull()
  })
  it('🔴 a later week WITHOUT jumps does not announce them again', () => {
    // Built, because the real plan cannot show it: measured 2026-10-17, this profile's jumps
    // land in ONE week (a deload) and no other (STRENGTH-PLYO-BUDGET-01). So the arm makes the
    // case it guards: jumps in week A, none in week B, jumps again in week C. Asked about B, the
    // line must stay quiet; a guard that only looks at B itself would announce C.
    const plan = make('regular')
    const at = firstPlyo(plan)
    const plyoBlock = plan.weeks[at].sessions[0].blocks.find(b => b.role === 'plyo')!
    const [b, c] = plan.weeks.map((w, i) => i).filter(i => i > at && plan.weeks[i].sessions.length > 0)
    const built = { ...plan, weeks: plan.weeks.map((w, i) =>
      i === b ? { ...w, sessions: w.sessions.map(ss => ({ ...ss, blocks: ss.blocks.filter(x => x.role !== 'plyo') })) }
      : i === c ? { ...w, sessions: w.sessions.map(ss => ({ ...ss, blocks: [plyoBlock, ...ss.blocks] })) }
      : w) }
    expect(strengthWeekEvidence(built, {}, built.weeks[b].n)!.next).toBeNull()
  })
})
