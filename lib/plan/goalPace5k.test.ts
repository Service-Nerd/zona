// GOALPACE-5K-01 (Coaching Board 2026-10-23, founder signed off). A 5K beginner's free plan (stored input below,
// supplied in the brief as safe to use as a fixture) prescribed 21 min CONTINUOUS at goal pace 5:36/km for a runner
// whose measured 5K pace is 6:32, with a threshold HR band, a marathon-pace long run, a load note measured from a
// deload and race-week copy saying "Start at Zone 2". Every check passed. Runs under NODE_ENV=test, so
// generateRulePlan THROWS on any error-severity invariant, including the three this item added.
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { GENERATION_CONFIG } from './generationConfig'
import { V1_SESSION_CATALOGUE, isRepStructured } from './sessionCatalogueData'
import { classifyStimulus } from './sessionRole'
import { validatePlan } from './invariants'
import { hasGoalGapSentence } from './goalPaceReach'

const FIXTURE: any = {"age":24,"goal":"time_target","max_hr":191,"benchmark":{"time":"0:32:42","type":"race","distance_km":5,"benchmark_date":"2026-10-10"},"race_date":"2026-12-25","race_name":"Christmas parkrun","resting_hr":47,"target_time":"0:28:00","training_age":"6-18mo","max_hr_source":"observed","days_available":4,"race_distance_km":5,"current_weekly_km":20,"days_cannot_train":["monday","wednesday","friday"],"user_declared_level":"beginner","longest_recent_run_km":6,"preferred_long_run_day":"sun","recent_quality_training":"occasional"}

// ⚠️ §120 Amendment 2 (2026-10-27) SUPERSEDES THIS RUNNER'S GOAL-PACE WORK. 28:00 off a 32:42 is 13.9% past current
// fitness, so goal pace is now WITHHELD for her (asserted below): that is the 26 Oct RCA's own first example. The S1 shape
// rule still governs every runner INSIDE the line, so its tests use her inputs at 31:00 (inside the 5% line, still faster
// than her interval pace, goal reps in week 6), keeping each check pointed at the shape it was written for.
const INSIDE: any = { ...FIXTURE, target_time: '0:31:00' }

describe('§120 Am. 2 — the stored runner, as she is now prescribed', () => {
  const plan: any = generateRulePlan(FIXTURE, 'free', '2026-10-26')
  it('🔴 no goal-pace work for a goal 14% past her fitness, and the gap is named', () => {
    expect(plan.meta.goal_pace_withheld?.gap_pct).toBeGreaterThan(13)
    expect(plan.weeks.flatMap((w: any) => Object.values(w.sessions)).filter((s: any) => s?.stimulus === 'race_pace')).toEqual([])
    // The figure moves with §10's benchmark-age discount (the wall clock), so the sentence is matched by its shape.
    expect(hasGoalGapSentence(plan.meta.difficulty_note), plan.meta.difficulty_note).toBe(true)
  })
})

const sessionsOf = (p: any) => p.weeks.flatMap((w: any) => Object.entries(w.sessions).flatMap(([d, v]: any) =>
  (Array.isArray(v) ? v : [v]).filter(Boolean).map((s: any) => ({ w, d, s }))))
const mins = (len: string) => { const m = /^(\d+(?:\.\d+)?)\s*min/.exec(len ?? ''); return m ? Number(m[1]) : 0 }
const longestContinuousGoalStep = (s: any) => Math.max(0, ...(s.derived_set?.blocks ?? [])
  .filter((b: any) => (typeof b.repeat === 'number' ? b.repeat : 1) <= 1)
  .flatMap((b: any) => b.steps).filter((st: any) => st.role === 'work' && st.pace_mode === 'target').map((st: any) => mins(st.length)))

describe('GOALPACE-5K-01 — the stored 5K beginner, inside the line', () => {
  const plan: any = generateRulePlan(INSIDE, 'free', '2026-10-26')
  const quality = sessionsOf(plan).filter((x: any) => x.s.type === 'quality')

  it('goal-pace weeks come as the beginner reps row, never a continuous block (S1 as amended)', () => {
    const goal = quality.filter((x: any) => classifyStimulus(x.s) === 'race_pace')
    expect(goal.length).toBeGreaterThanOrEqual(3)
    for (const { w, s } of goal) {
      expect(s.catalogue_id, `W${w.n}`).toBe('beginner_goal_pace_reps')
      expect(longestContinuousGoalStep(s), `W${w.n}`).toBe(0)
    }
  })

  it("Willy's cap: at most 12 goal-pace minutes in a session, recovery an easy jog", () => {
    for (const { w, s } of quality.filter((x: any) => x.s.catalogue_id === 'beginner_goal_pace_reps')) {
      const block = s.derived_set.blocks[0]
      const work = block.steps.find((st: any) => st.role === 'work')
      const rec = block.steps.find((st: any) => st.role === 'recovery')
      expect(mins(work.length) * block.repeat, `W${w.n}`).toBeLessThanOrEqual(GENERATION_CONFIG.BEGINNER_GOAL_PACE_MAX_SESSION_MINS)
      expect(rec.modality, `W${w.n}`).toBe('jog')
    }
  })

  it('goal-paced work carries the interval zone and HR its pace sits in (§83 Am.), not the threshold band', () => {
    for (const { w, s } of quality.filter((x: any) => classifyStimulus(x.s) === 'race_pace')) {
      expect(s.zone, `W${w.n}`).toBe('Zone 4–5')
    }
  })

  it('no marathon-pace long run for a beginner (S3); the peak long runs are the negative-split finish', () => {
    const lrs = sessionsOf(plan).filter((x: any) => x.s.role === 'long_run')
    expect(lrs.some((x: any) => /marathon pace|HM-pace/i.test(x.s.label))).toBe(false)
    expect(lrs.some((x: any) => /negative-split/.test(x.s.label))).toBe(true)
  })

  it('the taper uses a row that fits a beginner, not the intermediate-only sharpener', () => {
    const taper = quality.filter((x: any) => x.w.phase === 'taper')
    expect(taper.length).toBeGreaterThan(0)
    for (const { s } of taper) expect(s.catalogue_id).not.toBe('goal_pace_sharpener')
  })

  it('the copy tells the truth: load from the last normal week, no race-distance reason, no claimed hold, no Zone 2 start', () => {
    const note = plan.meta.load_residual_note ?? ''
    expect(note).not.toMatch(/41%/)
    expect(note).not.toMatch(/race distance/)
    for (const a of plan.meta.rule_adjustments ?? []) if (a.rule === 'V1-volume-quality-split') {
      const held = /Held weekly volume at (\d+) km \(target (\d+)\)/.exec(a.resolution)
      if (held) expect(Number(held[1])).toBeLessThanOrEqual(Number(held[2]))
    }
    const raceWeek = plan.weeks.find((w: any) => w.race_notes)
    expect(raceWeek.race_notes).not.toMatch(/Zone 2/)
  })
})

describe('GOALPACE-5K-01 — controls', () => {
  const fmt = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const base = { ...FIXTURE, days_cannot_train: [], days_available: 4, current_weekly_km: 35, longest_recent_run_km: 12, race_date: '2027-01-24' }

  it('a declared-intermediate 5K (the d933dc40 shape) keeps its VO2max work and never gets the beginner row', () => {
    const p: any = generateRulePlan({ ...base, user_declared_level: 'intermediate', training_age: '2-5yr', target_time: '0:26:00',
      benchmark: { time: '1:00:00', type: 'race', distance_km: 10, benchmark_date: '2026-10-10' } }, 'free', '2026-10-26')
    const q = sessionsOf(p).filter((x: any) => x.s.type === 'quality')
    expect(q.some((x: any) => V1_SESSION_CATALOGUE.find(r => r.id === x.s.catalogue_id)?.category === 'vo2max')).toBe(true)
    expect(q.some((x: any) => x.s.catalogue_id === 'beginner_goal_pace_reps')).toBe(false)
  })

  it('an intermediate 5K within reach still gets goal-pace work, in rep form', () => {
    const p: any = generateRulePlan({ ...base, user_declared_level: 'intermediate', training_age: '2-5yr', target_time: fmt(24 * 60 + 30),
      benchmark: { time: '0:25:00', type: 'race', distance_km: 5, benchmark_date: '2026-10-10' } }, 'free', '2026-10-26')
    const goal = sessionsOf(p).filter((x: any) => x.s.type === 'quality' && classifyStimulus(x.s) === 'race_pace'
      && (x.w.phase === 'build' || x.w.phase === 'peak'))
    expect(goal.length).toBeGreaterThan(0)
    for (const { w, s } of goal) {
      expect(isRepStructured(V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id)), `W${w.n} ${s.catalogue_id}`).toBe(true)
      expect(longestContinuousGoalStep(s)).toBeLessThanOrEqual(GENERATION_CONFIG.GOAL_PACE_CONTINUOUS_MAX_MINS)
    }
  })
})

// The original defect, rebuilt on the plan the engine now produces, so each new check is shown to catch the exact
// shape that shipped (not an invented one). Pure validator calls: the engine cannot be talked into the old output
// any more, which is the point.
describe('GOALPACE-5K-01 — the three new checks fire on the shapes that shipped', () => {
  const fresh = () => JSON.parse(JSON.stringify(generateRulePlan(INSIDE, 'free', '2026-10-26')))
  const goalSession = (p: any, n: number) => Object.values(p.weeks.find((w: any) => w.n === n).sessions)
    .flat().find((s: any) => s && s.type === 'quality') as any
  const codes = (p: any) => validatePlan(p, INSIDE).map(v => v.code)

  it('INV-PLAN-GOAL-PACE-SHAPE: W6 as shipped, 21 min continuous at goal pace', () => {
    const p = fresh(); const s = goalSession(p, 6)
    s.derived_set = { version: 2, blocks: [{ repeat: 1, label: 'sustained', steps: [{ role: 'work', modality: 'run', length: '21 min', pace: '5:29–5:43 /km', pace_mode: 'target', advance: 'auto' }] }] }
    expect(codes(p)).toContain('INV-PLAN-GOAL-PACE-SHAPE')
    expect(codes(fresh())).not.toContain('INV-PLAN-GOAL-PACE-SHAPE')
  })

  it('INV-PLAN-PACE-ZONE-COHERENT: goal pace faster than interval pace, carrying the threshold zone', () => {
    const p = fresh(); goalSession(p, 6).zone = 'Zone 3'
    expect(codes(p)).toContain('INV-PLAN-PACE-ZONE-COHERENT')
    expect(codes(fresh())).not.toContain('INV-PLAN-PACE-ZONE-COHERENT')
  })

  it('INV-PLAN-CATALOGUE-ELIGIBLE: an HM-only row on a 5K, and the sharpener on a 5K beginner who has a fitting row', () => {
    const p = fresh(); goalSession(p, 5).catalogue_id = 'hm_pace_long_run'
    expect(codes(p)).toContain('INV-PLAN-CATALOGUE-ELIGIBLE')
    const q = fresh(); goalSession(q, 8).catalogue_id = 'goal_pace_sharpener'
    expect(codes(q)).toContain('INV-PLAN-CATALOGUE-ELIGIBLE')
    expect(codes(fresh())).not.toContain('INV-PLAN-CATALOGUE-ELIGIBLE')
  })
})

