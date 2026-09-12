// INV-PLAN-LR-MAX-WEEKLY-PCT must be able to SEE a duration-anchored week.
//
// SESSION-KM-02, 2026-09-12. §52's own checker opened its per-session loop with
// `if (s.distance_km == null) continue`, so it skipped every DURATION-anchored
// session — 95.8% of a beginner's plan. The producer's floor in `ruleEngine.ts`
// (`lrKm = lr?.session.distance_km ?? 0` → `weeklyFloorFromLR = 0`) is inert for
// exactly the same cohort for exactly the same reason. The rule and the check
// that guards it were blind together, which is why §52 has never once surfaced
// a violation on a beginner plan: not because beginners' weeks are balanced,
// but because nothing was looking.
//
// Measured when the fix landed: 0 breaches across 2,337 duration-anchored
// sessions in the 621-plan cohort, and 0 new violations across the 16,038-plan
// sweep. So this opened nothing today. The point is that it can open something
// tomorrow — and a checker that has never been watched go red is not evidence
// of anything (§94/§95 shipped on the same reasoning).
//
// If the first test fails, the check has gone blind again and every clean §52
// run since is worth nothing.
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import { sessionKmSelfPaced } from './sessionDistance'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

const CODE = 'INV-PLAN-LR-MAX-WEEKLY-PCT'

/**
 * A beginner — the cohort whose sessions are duration-anchored (95.8%) — who is
 * ALSO in §52's scope.
 *
 * ⚠️ Both halves of that are load-bearing, and the first fixture tried here got
 * the second half wrong. §52's whole block is wrapped in
 * `volume_profile !== 'maintenance'`, and **51% of the cohort classifies
 * maintenance** (71.1% at marathon, 40.7% at HM) — so a beginner HM plan is
 * exempt from §52 for a reason that has nothing to do with this defect, and a
 * test built on one proves nothing while looking green. Only 58 of the 621
 * cohort plans are non-maintenance AND hold a convertible duration-anchored
 * week. This input is taken verbatim from one of them.
 */
const beginner = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  athlete_name: 'Athlete', race_name: 'Test', primary_metric: 'distance',
  plan_start: '2026-04-27', race_date: '2026-07-20', race_distance_km: 5,
  goal: 'time_target', target_time: '0:25:00',
  age: 35, resting_hr: 55, max_hr: 184,
  current_weekly_km: 20, longest_recent_run_km: 8,
  fitness_level: 'beginner', recent_quality_training: 'occasional',
  hard_session_relationship: 'neutral', injury_history: [],
  max_weekday_mins: 30, days_available: 3, days_cannot_train: ['tue', 'thu'], ...o,
} as unknown as GeneratorInput)

const codes = (p: Plan, i: GeneratorInput) => validatePlan(p, i).filter(v => v.code === CODE)

describe('INV-PLAN-LR-MAX-WEEKLY-PCT reaches duration-anchored sessions', () => {
  const input = beginner()
  const plan = generateRulePlan(input, 'paid', '2026-04-27', undefined, '2026-04-27')

  it('the fixture is in §52 scope at all — a maintenance plan would prove nothing', () => {
    expect(plan.meta.volume_profile).not.toBe('maintenance')
  })

  it('the fixture is genuinely duration-anchored — otherwise this proves nothing', () => {
    const all = plan.weeks.flatMap(w => Object.values(w.sessions ?? {}) as (Session | undefined)[])
    const runs = all.filter(s => s && s.type !== 'rest' && s.type !== 'strength') as Session[]
    const durationAnchored = runs.filter(s => s.distance_km == null && s.duration_mins != null)
    expect(runs.length).toBeGreaterThan(0)
    expect(durationAnchored.length).toBeGreaterThan(0)
  })

  it('is clean on the plan as generated', () => {
    expect(codes(plan, input)).toEqual([])
  })

  it('FALSIFICATION — goes RED when a duration-anchored long run passes the cap', () => {
    // Find an in-scope week (the invariant exempts race + deload) holding a
    // duration-anchored session we can convert.
    const idx = plan.weeks.findIndex(w =>
      w.type !== 'race' && w.type !== 'deload' && w.phase !== 'foundation' && w.weekly_km > 0 &&
      Object.values(w.sessions ?? {}).some((s: any) => s && s.distance_km == null && sessionKmSelfPaced(s) != null))
    expect(idx, 'fixture must contain a convertible duration-anchored week').toBeGreaterThanOrEqual(0)

    const w = plan.weeks[idx]
    const [day, s] = (Object.entries(w.sessions) as [string, Session][])
      .find(([, x]) => x && x.distance_km == null && sessionKmSelfPaced(x) != null)!

    // Push this one session over the cap by shrinking the week around it. The
    // session stays DISTANCE-NULL — that is the entire point of the test.
    const km = sessionKmSelfPaced(s)!
    const tooSmallWeekly = Math.max(1, Math.floor(km / (GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY / 100) - 1))

    const sabotaged: Plan = {
      ...plan,
      weeks: plan.weeks.map((x, i) => i === idx ? { ...x, weekly_km: tooSmallWeekly } : x),
    }
    // still distance-null (the engine writes undefined or null; both are 'no distance')
    expect(sabotaged.weeks[idx].sessions[day as keyof typeof w.sessions]?.distance_km ?? null).toBeNull()

    const vs = codes(sabotaged, input)
    expect(vs.length).toBeGreaterThan(0)
    expect(vs.some(v => v.message.includes('% of weekly volume'))).toBe(true)
  })

  it('does NOT fire on a session it cannot convert — unknown is never read as zero', () => {
    const idx = plan.weeks.findIndex(w => w.type !== 'race' && w.type !== 'deload' && w.weekly_km > 0)
    const w = plan.weeks[idx]
    const entry = (Object.entries(w.sessions) as [string, Session][]).find(([, x]) => x && x.type !== 'rest')!
    const stripped: Plan = {
      ...plan,
      weeks: plan.weeks.map((x, i) => i === idx ? {
        ...x,
        weekly_km: 1,
        sessions: { ...x.sessions, [entry[0]]: { ...entry[1], distance_km: null, pace_target: null } },
      } : x),
    }
    // No distance and no pace band to convert with → null, not 0, and no claim made.
    const offending = codes(stripped, input).filter(v => v.day === entry[0])
    expect(offending).toEqual([])
  })
})
