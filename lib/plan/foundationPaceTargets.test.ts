import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { composePlanWithFoundation } from './foundationCompose'
import { easyTargetsFromPlan } from './easyPace'
import { validatePlan } from './invariants'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

/**
 * FOUNDATION-PACE-STRIPPED-01 — a foundation session must tell the runner how
 * fast to go.
 *
 * 🔴 WHAT THIS GUARDS, MEASURED. `foundationBlock.ts` never set `pace_target` or
 * `hr_target` in its entire history (`git log -S` returns nothing on either
 * name). Across 33 composed plans: **381 of 381 foundation easy sessions carried
 * neither, against 0 of 1,355 main-plan easy sessions.** So the on-ramp — the
 * three weeks before a plan starts, a new runner's first contact with zone
 * discipline — said *"Zone 2. Conversational pace."* and gave them no number.
 *
 * ⚠️ `verify:parity` CANNOT SEE THIS CHANGE AND MUST NOT BE QUOTED FOR IT. The
 * parity grid pins `plan_start`, so it contains no pre-plan-runway cases at all —
 * the documented blind spot that made it return byte-identical on
 * FOUNDATION-LONG-RUNWAY-01. The evidence here is the property sweep, which
 * composes 8,492 foundation blocks: **75,909 violations with the fix reverted,
 * 0 with it in place.**
 */

const TODAY = '2026-10-09'

const marathon = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_date: '2027-05-17', race_distance_km: 42.2, goal: 'finish',
  benchmark: { type: 'race', distance_km: 5, time: '0:24:00' },
  current_weekly_km: 30, longest_recent_run_km: 12, days_available: 4, age: 38,
  preferred_long_run_day: 'sun', training_age: '2-5yr',
  user_declared_level: 'intermediate', recent_quality_training: 'regular',
  terrain: 'road', injury_history: [], hard_session_relationship: 'neutral',
  ...o,
} as GeneratorInput)

const PLAN_START = '2027-01-04'

/** A composed plan with a real runway, which is the only shape that has one. */
function composed(o: Partial<GeneratorInput> = {}): Plan {
  const input = marathon(o)
  const rule = generateRulePlan(input, 'paid', PLAN_START, undefined, TODAY)
  return composePlanWithFoundation(rule, input, TODAY, 'add').plan
}

const foundationSessions = (p: Plan): Session[] =>
  p.weeks.filter(w => w.n <= 0)
    .flatMap(w => Object.values(w.sessions).filter((s): s is Session => !!s && s.type !== 'rest'))

const mainEasy = (p: Plan): Session[] =>
  p.weeks.filter(w => w.n > 0)
    .flatMap(w => Object.values(w.sessions).filter((s): s is Session => !!s && s.type === 'easy'))

describe('easyTargetsFromPlan', () => {
  it('reads the band and HR the engine gave this plan', () => {
    const p = composed()
    const t = easyTargetsFromPlan(p)
    expect(t.paceTarget).toBeTruthy()
    expect(t.hrTarget).toBeTruthy()
    // It must be the plan's OWN value, not a recomputation.
    expect(mainEasy(p).map(s => s.pace_target)).toContain(t.paceTarget)
  })

  it('MAIN-PLAN WEEKS ONLY — a foundation week is never the source', () => {
    // Circular by construction otherwise: the foundation weeks are the ones
    // being built. Proven by handing it a plan whose ONLY weeks are foundation.
    const onlyFoundation = { weeks: [{ n: -1, sessions: {
      mon: { type: 'easy', label: 'Easy run', pace_target: '9:99–9:99 /km', hr_target: '< 99 bpm' },
    } } ] }
    expect(easyTargetsFromPlan(onlyFoundation)).toEqual({ paceTarget: null, hrTarget: null })
  })

  it('returns NULL, never a default — the `?? 0` class in display clothing', () => {
    expect(easyTargetsFromPlan(null)).toEqual({ paceTarget: null, hrTarget: null })
    expect(easyTargetsFromPlan({ weeks: [] })).toEqual({ paceTarget: null, hrTarget: null })
    expect(easyTargetsFromPlan({ weeks: [{ n: 1, sessions: {} }] }))
      .toEqual({ paceTarget: null, hrTarget: null })
    // A session with the fields present but blank is not a source either.
    expect(easyTargetsFromPlan({ weeks: [{ n: 1, sessions: {
      mon: { type: 'easy', label: 'Easy run', pace_target: '  ', hr_target: '' },
    } }] })).toEqual({ paceTarget: null, hrTarget: null })
  })
})

describe('a composed foundation block carries its targets', () => {
  it('every foundation session has a pace band AND an HR ceiling', () => {
    const p = composed()
    const sessions = foundationSessions(p)
    // An empty population would pass the loop below.
    expect(sessions.length).toBeGreaterThanOrEqual(9)
    expect(sessions.filter(s => !s.pace_target).map(s => s.label)).toEqual([])
    expect(sessions.filter(s => !s.hr_target).map(s => s.label)).toEqual([])
  })

  it('they are the SAME strings the main plan uses — one easy zone, §12', () => {
    const p = composed()
    const t = easyTargetsFromPlan(p)
    for (const s of foundationSessions(p)) {
      expect(s.pace_target).toBe(t.paceTarget)
      expect(s.hr_target).toBe(t.hrTarget)
    }
  })

  it('the LONG RUN takes them too — the two constructors must not diverge', () => {
    const p = composed()
    const long = foundationSessions(p).filter(s => s.label === 'Long easy')
    expect(long.length).toBeGreaterThanOrEqual(1)
    for (const s of long) expect(s.pace_target).toBeTruthy()
  })

  it('does not disturb the size fields §122 put there', () => {
    const p = composed()
    for (const s of foundationSessions(p)) {
      expect(s.distance_km).toBeGreaterThan(0)
      expect(s.duration_mins).toBeGreaterThan(0)
    }
  })
})

describe('INV-PLAN-EASY-PACE-PRESENT', () => {
  const input = marathon()

  it('is SILENT on a correct composed plan', () => {
    const v = validatePlan(composed(), input).filter(x => x.code === 'INV-PLAN-EASY-PACE-PRESENT')
    expect(v).toEqual([])
  })

  it('FALSIFICATION — goes RED when a foundation session loses its pace', () => {
    const p = JSON.parse(JSON.stringify(composed())) as Plan
    const w = p.weeks.find(x => x.n <= 0)!
    const day = Object.keys(w.sessions).find(d => {
      const s = w.sessions[d as keyof typeof w.sessions]
      return s && s.type !== 'rest'
    })! as keyof typeof w.sessions
    delete (w.sessions[day] as { pace_target?: string }).pace_target
    const v = validatePlan(p, input).filter(x => x.code === 'INV-PLAN-EASY-PACE-PRESENT')
    expect(v.length).toBe(1)
    expect(v[0].week).toBe(w.n)
  })

  it('FALSIFICATION — goes RED on a MAIN-plan easy run too, not only foundation', () => {
    const p = JSON.parse(JSON.stringify(composed())) as Plan
    const w = p.weeks.find(x => x.n === 1)!
    const day = Object.keys(w.sessions).find(d => w.sessions[d as keyof typeof w.sessions]?.type === 'easy')! as keyof typeof w.sessions
    delete (w.sessions[day] as { pace_target?: string }).pace_target
    expect(validatePlan(p, input).filter(x => x.code === 'INV-PLAN-EASY-PACE-PRESENT').length).toBe(1)
  })

  /**
   * ⚠️ THE POPULATION WAS WIDER THAN THIS AND THE SWEEP SAID SO. The first cut
   * excluded only rest/strength/`cross` and fired **14,279 times** — every one a
   * `race` day, which §121 ratifies as carrying no pace ("the race is the test,
   * not the training"), plus my type name was wrong (`cross-train`). These arms
   * pin the exclusions so a future widening has to argue with them.
   */
  it('is silent on the session types that legitimately carry no pace', () => {
    const p = JSON.parse(JSON.stringify(composed())) as Plan
    const w = p.weeks.find(x => x.n === 1)!
    const day = Object.keys(w.sessions).find(d => w.sessions[d as keyof typeof w.sessions]?.type === 'easy')! as keyof typeof w.sessions
    for (const type of ['race', 'hard', 'rest', 'strength', 'cross-train'] as const) {
      const s = w.sessions[day] as unknown as { type: string; pace_target?: string }
      s.type = type
      delete s.pace_target
      expect(
        validatePlan(p, input).filter(x => x.code === 'INV-PLAN-EASY-PACE-PRESENT'),
        `type ${type} must not fire`,
      ).toEqual([])
    }
  })
})
