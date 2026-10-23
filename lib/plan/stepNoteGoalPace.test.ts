// CRUISE-STEP-NOTE-GOALPACE-01 (Coaching Board 2026-10-23, §33 Am.). When §22 goal-paces a row, a work step whose
// note names the row's intensity reads its goal_pace_note instead: the runner saw "Threshold effort — comfortably hard,
// not a race pace" under "5K-pace reps" on 3,466 of 13,139 goal-paced sessions (5,664 plans). Runs under NODE_ENV=test,
// so generateRulePlan THROWS on the new step-note arm of INV-PLAN-COACH-NOTES-MATCH-INTENT.
import { describe, it, expect, beforeAll } from 'vitest'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { isV2Structure, StructureV2Schema } from './sessionStructureV2'
import { resolveMainSet } from './resolveMainSet'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { classifyStimulus } from './sessionRole'
import { validatePlan } from './invariants'

const CLAIMS_INTENSITY = /threshold|not a race pace/i
const FIXED_ROWS = ['tempo_cruise', 'tempo_cruise_short', 'progressive_tempo', 'threshold_mile_repeats']

const tSteps = () => V1_SESSION_CATALOGUE.flatMap(row => {
  if (!isV2Structure(row.main_set_structure)) return []
  const parsed = StructureV2Schema.safeParse(row.main_set_structure)
  if (!parsed.success) return []
  return parsed.data.blocks.flatMap(b => b.steps)
    .filter(st => st.role === 'work' && st.target.kind === 'pace' && st.target.anchor === 'T')
    .map(st => ({ row: row.id, step: st }))
})

describe('the catalogue — derived from the rows, never a list', () => {
  it('every T-anchored work step whose note names an intensity carries a goal_pace_note', () => {
    const claiming = tSteps().filter(x => x.step.note && CLAIMS_INTENSITY.test(x.step.note))
    expect(claiming.length).toBeGreaterThan(0)
    for (const { row, step } of claiming) expect(step.goal_pace_note, `${row}: "${step.note}"`).toBeTruthy()
  })
  it('no goal_pace_note itself names threshold', () => {
    for (const { row, step } of tSteps()) if (step.goal_pace_note) expect(step.goal_pace_note, row).not.toMatch(CLAIMS_INTENSITY)
  })
})

describe('the resolver — swaps the note only on a goal-paced T step', () => {
  const row = V1_SESSION_CATALOGUE.find(r => r.id === 'progressive_tempo')!
  const structure = StructureV2Schema.parse(row.main_set_structure)
  const ctx = { anchors: { E: '6:00 /km', T: '4:30 /km' }, easyPaceStr: '6:00 /km', params: { third_secs: 600 } }
  const notes = (goalPaced: boolean) => resolveMainSet(structure, { ...ctx, goalPaced }).blocks.flatMap(b => b.steps).map(s => s.note)
  it('threshold use keeps the row note; goal use changes only the T step', () => {
    const plain = notes(false), goal = notes(true)
    expect(plain.some(n => /^Threshold now/.test(n ?? ''))).toBe(true)
    expect(goal.some(n => /^Goal pace now/.test(n ?? ''))).toBe(true)
    expect(goal.filter((n, i) => n !== plain[i])).toHaveLength(1)
  })
})

describe('generated plans — a cohort sample reaching all four rows', () => {
  const seen: Record<string, { goal: number; threshold: number }> = {}
  let contradicting = 0
  beforeAll(() => { const grid = cohortGrid(); for (let i = 0; i < grid.length; i += 29) {
    let plan: any
    try { plan = generateRulePlan(grid[i], 'paid', COHORT_PLAN_START) } catch (e) { if (/INV-PLAN-COACH-NOTES/.test(String(e))) throw e; continue }
    for (const w of plan.weeks) for (const s of Object.values(w.sessions).flat() as any[]) {
      if (!s?.derived_set || !FIXED_ROWS.includes(s.catalogue_id)) continue
      const goal = classifyStimulus(s) === 'race_pace'
      const r = (seen[s.catalogue_id] ??= { goal: 0, threshold: 0 })
      if (goal) r.goal++; else r.threshold++
      const work = s.derived_set.blocks.flatMap((b: any) => b.steps).filter((st: any) => st.role === 'work' && st.note)
      if (goal && work.some((st: any) => CLAIMS_INTENSITY.test(st.note))) contradicting++
    }
  } })
  it('every affected row is reached as goal pace (an unreached row passes vacuously)', () => {
    for (const id of FIXED_ROWS) expect(seen[id]?.goal ?? 0, id).toBeGreaterThan(0)
  })
  it('no goal-paced session tells the runner it is threshold work', () => expect(contradicting).toBe(0))
  it('the same rows at threshold still read their threshold notes', () => {
    for (const id of ['tempo_cruise', 'progressive_tempo']) expect(seen[id]?.threshold ?? 0, id).toBeGreaterThan(0)
  })
})

describe('INV-PLAN-COACH-NOTES-MATCH-INTENT step-note arm fires on the shape that shipped', () => {
  // The first plan in the grid that carries a goal-paced cruise session.
  let found: { input: any; plan: any; s: any } | null = null
  beforeAll(() => {
    const grid = cohortGrid()
    for (let i = 0; i < grid.length && !found; i += 29) {
      let plan: any
      try { plan = generateRulePlan(grid[i], 'paid', COHORT_PLAN_START) } catch { continue }
      for (const w of plan.weeks) for (const s of Object.values(w.sessions).flat() as any[])
        if (!found && s?.catalogue_id === 'tempo_cruise' && classifyStimulus(s) === 'race_pace') found = { input: grid[i], plan, s }
    }
  })
  it('a goal-paced cruise session exists in the sample', () => expect(found).not.toBeNull())
  it('putting the old note back makes it fire; the shipped plan does not', () => {
    const codes = (p: any) => validatePlan(p, found!.input).filter(v => v.code === 'INV-PLAN-COACH-NOTES-MATCH-INTENT').length
    expect(codes(found!.plan)).toBe(0)
    found!.s.derived_set.blocks[0].steps[0].note = 'Threshold effort — comfortably hard, not a race pace.'
    expect(codes(found!.plan)).toBeGreaterThan(0)
  })
})
