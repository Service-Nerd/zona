// GOAL-PACE-REACHABLE-01 (§120 Amendment 2, Coaching Board 2026-10-27). On a benchmarked time-target plan, goal-paced
// work is prescribed only while the goal is within GOAL_PACE_MAX_STRETCH_PCT (5) of current race fitness; past it the
// plan trains the fitness the runner has and says so. Measured before: at 15% past fitness, 100% of goal-paced sessions
// at every distance were faster than the runner's own threshold.
import { describe, it, expect } from 'vitest'
import { goalPaceReach, goalGapSentence, hasGoalGapSentence } from './goalPaceReach'
import { runEngine } from './engine'
import { validatePlan } from './invariants'
import { mergePlan, quotesGoalPace, type WeekCopyRejection } from './enrich'
import { GENERATION_CONFIG } from './generationConfig'
import { V1_SESSION_CATALOGUE, requiredPaceAnchors } from './sessionCatalogueData'
import { slowGoalDates, slowGoalGrid } from './slowGoalGrid'
import { parsePaceMidpoint } from './paceParse'
import type { GeneratorInput, Plan } from '@/types/plan'

const { planStart, benchmarkDate } = slowGoalDates()
// The runway is 1–7 days by weekday; pin it (see weekdayOverrunNote.test.ts).
const today = new Date(Date.parse(`${planStart}T00:00:00Z`) - 7 * 864e5).toISOString().slice(0, 10)
const build = (input: GeneratorInput): Plan | null => {
  const o = runEngine({ input, tier: 'paid', displayUnits: 'km', planStart, today })
  return o.kind === 'refusal' ? null : o.plan
}
const GOAL_ROWS = new Set(V1_SESSION_CATALOGUE.filter(r => requiredPaceAnchors(r).some(a => a === 'goal' || a === 'HM')).map(r => r.id))
const sessions = (p: Plan) => p.weeks.flatMap(w => Object.values(w.sessions)).filter(Boolean) as NonNullable<Plan['weeks'][0]['sessions']['mon']>[]

// Every 4th slow-goal case (240): all benchmarks, distances and the four gaps. Built ONCE.
const sample = slowGoalGrid(planStart, benchmarkDate).filter((_, i) => i % 4 === 0)
  .map(c => { const { gap, ...input } = c; return { gap, input: input as unknown as GeneratorInput, plan: build(input as unknown as GeneratorInput) } })
  .filter((x): x is { gap: number; input: GeneratorInput; plan: Plan } => x.plan != null)

describe('the owner', () => {
  it('no benchmark, no claim', () => expect(goalPaceReach({ vdot: undefined, raceDistanceKm: 10, goalPaceMinPerKm: 5 })).toBeNull())
  it('no goal, no claim', () => expect(goalPaceReach({ vdot: 40, raceDistanceKm: 10, goalPaceMinPerKm: null })).toBeNull())
  it('🔴 withheld exactly past the line', () => {
    // VDOT 40 → ~49:18 10K, 4:56/km. 4% faster: inside. 6% faster: past.
    const fit = goalPaceReach({ vdot: 40, raceDistanceKm: 10, goalPaceMinPerKm: 4.93 })!
    const at = (pct: number) => goalPaceReach({ vdot: 40, raceDistanceKm: 10, goalPaceMinPerKm: 4.93 * (1 - fit.gapPct / 100) * (1 - pct / 100) })!
    expect(at(4).withheld).toBe(false)
    expect(at(6).withheld).toBe(true)
  })
  it('the sentence is the founder\'s, with the gap rounded', () => {
    expect(goalGapSentence(12.4)).toBe('Your target is about 12% quicker than your recent run suggests, so sessions are set to what you can run now.')
    expect(goalGapSentence(12.4)).not.toMatch(/—/)
  })
})

describe('past the line the plan trains the fitness the runner has', () => {
  const past = sample.filter(x => x.gap >= 0.15)
  const inside = sample.filter(x => x.gap === 0)
  it('the sample reaches both sides of the line at every distance', () => {
    for (const d of [5, 10, 21.1, 42.2]) {
      expect(past.some(x => x.input.race_distance_km === d), `past @ ${d}`).toBe(true)
      expect(inside.some(x => x.input.race_distance_km === d), `inside @ ${d}`).toBe(true)
    }
  })
  it('🔴 every plan past the line is stamped, carries no goal-pace work and no goal or HM row', () => {
    for (const { plan } of past) {
      expect(plan.meta.goal_pace_withheld).toBeDefined()
      for (const s of sessions(plan)) {
        expect(s.stimulus, s.label).not.toBe('race_pace')
        expect(GOAL_ROWS.has(s.catalogue_id ?? ''), `${s.label} (${s.catalogue_id})`).toBe(false)
      }
    }
  })
  it('🔴 and names the gap, and records the decision with the VDOT it was made at', () => {
    for (const { plan } of past) {
      expect(hasGoalGapSentence(plan.meta.difficulty_note), plan.meta.difficulty_note).toBe(true)
      expect(plan.meta.goal_pace_reach?.vdot).toBeGreaterThan(0)
    }
  })
  it('🔴 a LOUDER note keeps its own sentence and lever, and the gap follows it', () => {
    const louder = past.filter(({ plan }) => !plan.meta.difficulty_note!.startsWith('Your target is about'))
    expect(louder.length, 'the sample must reach a withheld plan whose inputs or timeline speak first').toBeGreaterThan(0)
    for (const { plan } of louder) expect(plan.meta.difficulty_note).toMatch(/\. Your target is about \d+% quicker/)
  })
  it('🔴 inside the line nothing is withheld, and goal-pace work is still prescribed where §22 asks for it', () => {
    for (const { plan } of inside) {
      expect(plan.meta.goal_pace_withheld).toBeUndefined()
      expect(plan.meta.goal_pace_reach, 'the decision is recorded either way').toBeDefined()
    }
    const withGoalWork = inside.filter(({ plan }) => sessions(plan).some(s => s.stimulus === 'race_pace'))
    expect(withGoalWork.length).toBeGreaterThan(inside.length / 2)
  })
  it('the check is clean on every plan the engine built', () => {
    const v = sample.flatMap(({ input, plan }) => validatePlan(plan, input).filter(x => x.code === 'INV-PLAN-GOAL-PACE-REACHABLE'))
    expect(v).toEqual([])
  })
})

describe('GOAL-PACE-LR-CURRENT-01 — past the line §25\'s finish is run at CURRENT race pace, in the founder\'s words', () => {
  const VOICE = { 42.2: 'Easy first. Finish at the marathon pace you could run today, on tired legs.', 21.1: 'Easy first. Final third at the half pace you could run today.' } as const
  const lrsOf = (p: Plan) => sessions(p).filter(s => s.catalogue_id === 'mp_long_run' || s.catalogue_id === 'hm_pace_long_run')
  const pastLong = sample.filter(x => x.gap >= 0.15 && (x.input.race_distance_km === 42.2 || x.input.race_distance_km === 21.1))
  it('🔴 a non-beginner past the line still gets the race-pace long run, priced at their current pace, never the goal', () => {
    const withLr = pastLong.filter(({ plan }) => lrsOf(plan).length > 0)
    expect(withLr.length, 'the sample must reach past-the-line HM/MAR plans with the finish').toBeGreaterThan(0)
    for (const { input, plan } of withLr) for (const s of lrsOf(plan)) {
      expect(s.lr_segment_pace, s.label).toBeTruthy()
      // Compared as PACES, not strings: the segment is a band and the goal a single pace. Past the line the finish
      // must sit well slower than the goal (more than the rehearsal tolerance).
      const seg = parsePaceMidpoint(s.lr_segment_pace!)!, goal = parsePaceMidpoint(plan.meta.goal_pace_per_km!)!
      expect(seg, `${s.lr_segment_pace} vs goal ${plan.meta.goal_pace_per_km}`).toBeGreaterThan(goal * (1 + GENERATION_CONFIG.GOAL_PACE_REHEARSAL_TOLERANCE_PCT / 100))
      expect(s.coach_notes?.[0]).toBe(VOICE[input.race_distance_km as 42.2 | 21.1])
      expect((s.coach_notes ?? []).join(' ')).not.toMatch(/goal/i)
    }
  })
  it('inside the line the finish is still at goal pace, in each row\'s own voice', () => {
    for (const [d, voice] of [[42.2, 'Easy first. Hit goal pace on tired legs.'], [21.1, 'Easy first. Final third at HM goal pace.']] as const) {
      const inLong = sample.filter(x => x.gap === 0 && x.input.race_distance_km === d).flatMap(({ plan }) => lrsOf(plan))
      expect(inLong.length, `${d} km`).toBeGreaterThan(0)
      for (const s of inLong) expect(s.coach_notes?.[0]).toBe(voice)
    }
  })
  it('🔴 the check: a withheld plan\'s finish priced at anything but current race pace is caught', () => {
    const c = pastLong.find(({ plan }) => lrsOf(plan).length > 0)!
    const p: Plan = JSON.parse(JSON.stringify(c.plan))
    const lr = lrsOf(p)[0]!; lr.lr_segment_pace = p.meta.goal_pace_per_km   // priced at the goal again
    const codes = validatePlan(p, c.input).filter(v => v.code === 'INV-PLAN-GOAL-PACE-REACHABLE').map(v => v.expected)
    expect(codes).toContain('the finish at current race pace')
  })
})

describe('a runner with NO benchmark is unchanged', () => {
  it('🔴 never stamped, whatever the goal', () => {
    const c = sample.find(x => x.gap >= 0.3 && x.input.race_distance_km === 21.1)!
    const { benchmark, ...noBench } = c.input as GeneratorInput & { benchmark?: unknown }
    const plan = build(noBench as GeneratorInput)!
    expect(plan.meta.goal_pace_withheld).toBeUndefined()
    expect(plan.meta.goal_pace_reach).toBeUndefined()
  })
})

describe('INV-PLAN-GOAL-PACE-REACHABLE fires in every direction', () => {
  const pastCase = sample.find(x => x.gap >= 0.15 && x.input.race_distance_km === 10 && sessions(x.plan).some(s => s.type === 'quality'))!
  const insideCase = sample.find(x => x.gap === 0 && x.input.race_distance_km === 10 && sessions(x.plan).some(s => s.type === 'quality'))!
  const hits = (p: Plan, input: GeneratorInput) => validatePlan(p, input).filter(v => v.code === 'INV-PLAN-GOAL-PACE-REACHABLE').map(v => v.expected)
  const copy = (p: Plan): Plan => JSON.parse(JSON.stringify(p))
  it('🔴 past the line with no stamp', () => {
    const p = copy(pastCase.plan); delete p.meta.goal_pace_withheld
    expect(hits(p, pastCase.input)).toContain(`withheld past ${GENERATION_CONFIG.GOAL_PACE_MAX_STRETCH_PCT}%`)
  })
  it('🔴 a stamp inside the line', () => {
    const p = copy(insideCase.plan); p.meta.goal_pace_withheld = { gap_pct: 0 }
    expect(hits(p, insideCase.input)).toContain(`no withholding inside ${GENERATION_CONFIG.GOAL_PACE_MAX_STRETCH_PCT}%`)
  })
  it('🔴 goal-pace work on a withheld plan', () => {
    const p = copy(pastCase.plan)
    const q = sessions(p).find(s => s.type === 'quality')!; q.stimulus = 'race_pace'
    expect(hits(p, pastCase.input)).toContain('no goal-pace work past the line')
  })
  it('🔴 a withheld plan that does not name the gap', () => {
    const p = copy(pastCase.plan); p.meta.difficulty_note = 'Demanding.'
    expect(hits(p, pastCase.input)).toContain('the gap named')
  })
  it('🔴 a withholding with no decision record', () => {
    const p = copy(pastCase.plan); delete p.meta.goal_pace_reach
    expect(hits(p, pastCase.input)).toContain('a withholding carries its decision record')
  })
  it('🔴 a decision recorded for a runner with no benchmark', () => {
    const { benchmark, ...noBench } = pastCase.input as GeneratorInput & { benchmark?: unknown }
    expect(hits(copy(pastCase.plan), noBench as GeneratorInput)).toContain('no decision without a benchmark')
  })
  it('🔴 a patched plan keeps its history: goal-pace work before `from_week` is not a violation, at or after it is', () => {
    const p = copy(pastCase.plan)
    const qw = p.weeks.filter(w => Object.values(w.sessions).some(s => s?.type === 'quality'))
    const early = qw[0]!, late = qw[qw.length - 1]!
    Object.values(early.sessions).find(s => s?.type === 'quality')!.stimulus = 'race_pace'
    p.meta.goal_pace_reach = { ...p.meta.goal_pace_reach!, from_week: early.n + 1 }
    expect(hits(p, pastCase.input)).not.toContain('no goal-pace work past the line')
    Object.values(late.sessions).find(s => s?.type === 'quality')!.stimulus = 'race_pace'
    expect(hits(p, pastCase.input)).toContain('no goal-pace work past the line')
  })
  it('🔴 a week the runner KEPT (kept_weeks) keeps its goal-pace work; the same week not kept is caught', () => {
    const p = copy(pastCase.plan)
    const qw = p.weeks.filter(w => Object.values(w.sessions).some(s => s?.type === 'quality'))
    const mid = qw[Math.floor(qw.length / 2)]!
    Object.values(mid.sessions).find(s => s?.type === 'quality')!.stimulus = 'race_pace'
    expect(hits(p, pastCase.input)).toContain('no goal-pace work past the line')
    p.meta.goal_pace_reach = { ...p.meta.goal_pace_reach!, kept_weeks: [mid.n] }
    expect(hits(p, pastCase.input)).not.toContain('no goal-pace work past the line')
  })
  it('a plan built BEFORE the rule (no record, no stamp, past the line) is not called a defect', () => {
    const p = copy(pastCase.plan); delete p.meta.goal_pace_reach; delete p.meta.goal_pace_withheld
    expect(hits(p, pastCase.input)).toEqual([])
  })
  it('a recalibration that moves the plan\'s VDOT does not make the recorded decision read as wrong', () => {
    const p = copy(pastCase.plan); (p.meta as { vdot_training_anchor?: number }).vdot_training_anchor = 80
    expect(hits(p, pastCase.input)).toEqual([])
  })
})

describe('the AI layer cannot put the withheld goal pace back', () => {
  // A plan that has quality to enrich (a staged beginner's base-building weeks carry none).
  const plan = sample.find(x => x.gap >= 0.15 && x.input.race_distance_km === 10 && sessions(x.plan).some(s => s.type === 'quality'))!.plan
  const w = plan.weeks.find(x => Object.values(x.sessions).some(s => s?.type === 'quality'))!
  const [day, s] = Object.entries(w.sessions).find(([, s]) => s?.type === 'quality')!
  const enriched = (notes: string[]) => ({ meta: {}, weeks: [{ n: w.n, label: w.label, theme: w.theme, sessions: { [day]: { coach_notes: notes } } }] }) as never
  const notesOf = (p: Plan) => (p.weeks.find(x => x.n === w.n)!.sessions as Record<string, { coach_notes?: string[] }>)[day]!.coach_notes
  it('🔴 a note quoting {{goal_pace}} is refused and recorded; the engine notes stay', () => {
    const rejected: WeekCopyRejection[] = []
    const out = mergePlan(plan, enriched(['Hold {{goal_pace}} for each rep.']), 'paid', r => rejected.push(r))
    expect(notesOf(out)).toEqual(s!.coach_notes)
    expect(rejected).toEqual([{ weekN: w.n, field: 'coach_notes', token: '{{goal_pace}}' }])
  })
  it('🔴 the token in other spacing, and the literal pace, are refused too', () => {
    const lit = plan.meta.goal_pace_per_km!.match(/\d+:\d{2}/)![0]
    for (const note of ['Hold {{ goal_pace }}.', `Hold ${lit} per km for each rep.`, 'Hit goal pace over the last stretch.']) {
      const out = mergePlan(plan, enriched([note]), 'paid')
      expect(notesOf(out), note).toEqual(s!.coach_notes)
    }
    expect(quotesGoalPace(`Hold 1${lit}`, plan.meta.goal_pace_per_km), 'a longer number that merely contains it').toBe(false)
  })
  it('a note that does not quote it is merged as usual', () => {
    const out = mergePlan(plan, enriched(['Settle in. Hold {{session_pace}}.']), 'paid')
    expect(notesOf(out)?.[0]).toBe('Settle in. Hold {{session_pace}}.')
  })
  it('on a plan that is NOT withheld, {{goal_pace}} is merged as before', () => {
    const p: Plan = JSON.parse(JSON.stringify(plan)); delete p.meta.goal_pace_withheld
    const out = mergePlan(p, enriched(['Hold {{goal_pace}} for each rep.']), 'paid')
    expect(notesOf(out)?.[0]).toBe('Hold {{goal_pace}} for each rep.')
  })
})
