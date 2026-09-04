import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

/**
 * Coaching Board 2026-09-04 — effort-governed sessions.
 *
 * Two rulings, both surfaced by tracing a live 10K plan and then measured across
 * 5,392 swept plans before the board sat:
 *
 *   §40b VETO (unanimous) — an effort-governed row is excluded from §22's
 *   goal-pace override. A time-targeted 100K was drawing `vert_hike_repeats`
 *   (hike uphill at RPE 6, walk back down) and shipping it as "100K-pace
 *   intervals" at 8:14–8:34 /km. §40b: an effort-governed session "does not
 *   invent a number the runner cannot act on".
 *
 *   §16/§40b SIZING — an effort-governed session's stated duration must hold its
 *   own structure. `hill_reps` was incoherent in 258 of 428 placements (60.3%);
 *   worst case stated 31 min against >= 24 min of reps.
 *
 *   Shipped in two phases the same day, and the sequencing was the point. PHASE 1
 *   added the lower-bound invariant at `warn` — promoting ahead of the sizing fix
 *   would have thrown for 60% of hill placements, the failure that reverted
 *   INV-PLAN-MAIN-SET-ORDERING's first promotion on 2026-09-03. PHASE 2
 *   (§40b Amendment 2) added `effortGovernedPlan`, pricing the open recoveries
 *   (`EFFORT_GOVERNED_RECOVERY_SECS`) and the landmark approach
 *   (`EFFORT_GOVERNED_TRANSITION_MINS`), and promoted the invariant to `error`.
 *   A 10K hill session went 39 min -> 54.
 *
 * WHY THESE TESTS EXIST AS THEY ARE. Both defects were SILENT — the plans
 * validated clean, and the only way either surfaced was a human reading a
 * generated plan. So each block below asserts the mechanism on a REAL generated
 * plan first, then re-asserts on a hand-built session so the check itself is
 * proven able to fire. A test that only ever sees the fixed engine cannot tell
 * you the invariant works.
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

// A time-targeted 100K, which is the shape that reached `vert_hike_repeats`
// through §22's override. The target time is realistic (14 h) — the property
// sweep's own grid used 45 minutes for EVERY distance, which gave a 100K runner
// a 27 sec/km goal pace and is why this never surfaced there.
const ULTRA_100K: GeneratorInput = {
  race_date: '2027-03-07', race_distance_km: 100, goal: 'time_target',
  target_time: '14:00:00', days_available: 5, age: 35,
  current_weekly_km: 60, longest_recent_run_km: 30,
  resting_hr: 55, max_hr: 184, preferred_long_run_day: 'sun',
  fitness_level: 'experienced', training_age: '5yr+',
}

const TENK: GeneratorInput = {
  race_date: '2026-11-30', race_distance_km: 10, goal: 'time_target',
  target_time: '0:44:59', days_available: 4, age: 43,
  current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  fitness_level: 'experienced', training_age: '2-5yr',
}

const EFFORT_ROWS = ['hill_reps', 'vert_hike_repeats'] as const

const sessionsOf = (p: Plan): Session[] =>
  p.weeks.flatMap(w => Object.values(w.sessions).filter((s): s is Session => !!s))
const effortSessions = (p: Plan) =>
  sessionsOf(p).filter(s => s.catalogue_id && (EFFORT_ROWS as readonly string[]).includes(s.catalogue_id))
const codes = (p: Plan, input: GeneratorInput) => validatePlan(p, input).map(v => v.code)

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('§40b veto — an effort-governed row is never prescribed at goal pace', () => {
  it('both effort-governed catalogue rows are still effort-governed (guards the premise)', () => {
    // If a future edit gives one of these rows a paced work step, every
    // assertion below silently stops testing anything. Fail here instead.
    for (const id of EFFORT_ROWS) {
      const row = V1_SESSION_CATALOGUE.find(r => r.id === id)
      expect(row, `${id} missing from the catalogue`).toBeTruthy()
      const ms = row!.main_set_structure as { version?: number; blocks?: { steps?: { role: string; target: { kind: string } }[] }[] }
      expect(ms.version).toBe(2)
      const work = (ms.blocks ?? []).flatMap(b => b.steps ?? []).filter(s => s.role === 'work')
      expect(work.length).toBeGreaterThan(0)
      expect(work.every(s => s.target.kind === 'effort'), `${id} has a paced work step`).toBe(true)
    }
  })

  it('a time-targeted 100K reaches the hike row and does NOT goal-pace it', () => {
    const plan = generateRulePlan(ULTRA_100K, 'paid', PLAN_START)
    const hikes = effortSessions(plan)
    // The plan must actually contain one, or this test proves nothing. This is
    // the coverage failure that made §79-PEAKKM's sweep look safe when it had
    // simply never reached the branch.
    expect(hikes.length, 'no effort-governed session in a 100K plan — test reaches nothing').toBeGreaterThan(0)
    for (const s of hikes) {
      expect(s.pace_target ?? '', `"${s.label}" carries a pace`).toBe('')
      expect(s.label ?? '').not.toMatch(/-pace /)
      // The absence of a pace is only legitimate because an RPE is present
      // (§40b via INV-PLAN-EFFORT-OR-PACE) — assert the pair, not just the gap.
      expect(s.rpe_target, `"${s.label}" has neither pace nor RPE`).toBeGreaterThan(0)
    }
  })

  it('the same runner on a finish goal is unchanged — the veto touches only the goal-pace path', () => {
    const finish = { ...ULTRA_100K, goal: 'finish' as const, target_time: undefined }
    const hikes = effortSessions(generateRulePlan(finish, 'paid', PLAN_START))
    expect(hikes.length).toBeGreaterThan(0)
    for (const s of hikes) expect(s.pace_target ?? '').toBe('')
  })

  it('INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED fires when a pace is injected', () => {
    // FALSIFICATION. Re-create the exact shipped defect on a real plan and prove
    // the invariant catches it. Without this the green result above is equally
    // consistent with an invariant that can never fire.
    const plan = generateRulePlan(ULTRA_100K, 'paid', PLAN_START)
    expect(codes(plan, ULTRA_100K)).not.toContain('INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED')

    const broken: Plan = JSON.parse(JSON.stringify(plan))
    const victim = effortSessions(broken)[0]
    victim.pace_target = '8:14–8:34 /km'
    victim.label = '100K-pace intervals'
    expect(codes(broken, ULTRA_100K)).toContain('INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED')
  })

  it('catches the label alone, and the pace alone — they can regress separately', () => {
    const plan = generateRulePlan(ULTRA_100K, 'paid', PLAN_START)

    const labelOnly: Plan = JSON.parse(JSON.stringify(plan))
    effortSessions(labelOnly)[0].label = '100K-pace intervals'
    expect(codes(labelOnly, ULTRA_100K)).toContain('INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED')

    const paceOnly: Plan = JSON.parse(JSON.stringify(plan))
    effortSessions(paceOnly)[0].pace_target = '8:14–8:34 /km'
    expect(codes(paceOnly, ULTRA_100K)).toContain('INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED')
  })

  it('does not fire on a PACED row that legitimately carries a goal-pace label', () => {
    // The veto must not spill onto §22's real population. A 10K time-target plan
    // is full of goal-paced sessions from paced rows; none may be flagged.
    const plan = generateRulePlan(TENK, 'paid', PLAN_START)
    const paced = sessionsOf(plan).filter(s => /-pace /.test(s.label ?? ''))
    expect(paced.length, 'no goal-paced sessions in a 10K time-target plan').toBeGreaterThan(0)
    expect(codes(plan, TENK)).not.toContain('INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED')
  })
})

describe('§16/§40b — an effort-governed session is sized against its own structure', () => {
  it('INV-PLAN-EFFORT-GOVERNED-DURATION-LOWER-BOUND fires on a session too short to hold its reps', () => {
    // FALSIFICATION. The bound is deliberately weaker than the truth (open and
    // landmark steps price at zero), so it must be shown to fire at all.
    const plan = generateRulePlan(TENK, 'paid', PLAN_START)
    const hills = effortSessions(plan)
    expect(hills.length, 'no hill session in the 10K plan — test reaches nothing').toBeGreaterThan(0)

    const broken: Plan = JSON.parse(JSON.stringify(plan))
    // 8 x (1:30 up + 1:30 down) = 24 min of measurable work; 20 min total cannot
    // hold that even before the 15 min warm-up floor.
    effortSessions(broken)[0].duration_mins = 20
    const v = validatePlan(broken, TENK).filter(x => x.code === 'INV-PLAN-EFFORT-GOVERNED-DURATION-LOWER-BOUND')
    expect(v.length).toBeGreaterThan(0)
    expect(v[0].severity).toBe('error')
  })

  it('goes quiet once the duration genuinely fits — it is a bound, not a constant complaint', () => {
    const plan = generateRulePlan(TENK, 'paid', PLAN_START)
    const generous: Plan = JSON.parse(JSON.stringify(plan))
    for (const s of effortSessions(generous)) s.duration_mins = 120
    const v = validatePlan(generous, TENK).filter(x => x.code === 'INV-PLAN-EFFORT-GOVERNED-DURATION-LOWER-BOUND')
    expect(v).toHaveLength(0)
  })

  it('a real generated hill session now holds its own structure', () => {
    // Phase 2 (§40b Amendment 2). Generation itself would throw now the invariant
    // is `error`, so a clean return is half the assertion; the explicit check is
    // the other half.
    const plan = generateRulePlan(TENK, 'paid', PLAN_START)
    const hills = effortSessions(plan)
    expect(hills.length).toBeGreaterThan(0)
    expect(validatePlan(plan, TENK).map(v => v.code))
      .not.toContain('INV-PLAN-EFFORT-GOVERNED-DURATION-LOWER-BOUND')

    // EXACT structural values, not a loose floor. The first version of this test
    // asserted `> 45` and did NOT discriminate: this profile's volume-derived
    // duration was already 48, so removing the sizing fix left the test green.
    // A falsification that stays green is the whole failure mode this repo keeps
    // re-learning — the threshold has to be tight enough to reach the change.
    //   90s variant: 8 x (1:30 up + 60s stand + 1:30 down) + 2 approach = 34 main -> 54
    //   45s variant: 10 x (0:45 + 60s + 0:45)            + 2 approach = 27 main -> 47
    for (const s of hills) expect([54, 47]).toContain(s.duration_mins)
  })

  it('duration is driven by STRUCTURE, not weekly volume — the discriminating property', () => {
    // The sharpest statement of what phase 2 changed. Before it, an effort-governed
    // session was sized as distance / easy pace, so its duration scaled with the
    // week it sat in — a runner on 60 km/week got a "longer" hill session than one
    // on 25 km/week while doing the IDENTICAL eight reps. The reps are the session;
    // the week it lands in is not.
    const lo = generateRulePlan({ ...TENK, current_weekly_km: 25, longest_recent_run_km: 12 }, 'paid', PLAN_START)
    const hi = generateRulePlan({ ...TENK, current_weekly_km: 60, longest_recent_run_km: 26 }, 'paid', PLAN_START)
    const durOf = (p: Plan) => effortSessions(p).map(s => s.duration_mins)
    expect(durOf(lo).length, 'no hill session at 25 km/week').toBeGreaterThan(0)
    expect(durOf(hi).length, 'no hill session at 60 km/week').toBeGreaterThan(0)
    // Same variant -> same duration, whatever the volume.
    expect(new Set([...durOf(lo), ...durOf(hi)]).size).toBeLessThanOrEqual(2)
    expect(durOf(lo)[0]).toBe(durOf(hi)[0])
  })

  it('DISTANCE is deliberately untouched — the ruling was about duration', () => {
    // Deriving distance from the corrected duration was scope creep with a defect
    // in it: a slow runner's 45s-variant session came out at 4.5 km, under
    // MIN_SESSION_DISTANCE_KM.quality (5 km, §52b). Unlike pacedRepPlan this shape
    // cannot grow out of it — the rep count IS the variant. Pinned so the tempting
    // "make distance and duration agree" change cannot land silently.
    const plan = generateRulePlan(TENK, 'paid', PLAN_START)
    for (const s of effortSessions(plan)) {
      expect(s.distance_km!).toBeGreaterThanOrEqual(GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.quality)
    }
  })

  it('never fires on a paced row — the check is scoped to effort-governed rows only', () => {
    const plan = generateRulePlan(TENK, 'paid', PLAN_START)
    const broken: Plan = JSON.parse(JSON.stringify(plan))
    // Shrink a PACED quality session absurdly. INV-PLAN-STRUCTURED-SESSION-
    // DURATION-COHERENT owns that case; this invariant must stay out of it.
    const pacedQuality = sessionsOf(broken).find(s => s.catalogue_id && s.pace_target && s.derived_set)
    expect(pacedQuality, 'no paced structured session to test against').toBeTruthy()
    pacedQuality!.duration_mins = 10
    const v = validatePlan(broken, TENK).filter(x => x.code === 'INV-PLAN-EFFORT-GOVERNED-DURATION-LOWER-BOUND')
    expect(v).toHaveLength(0)
  })
})
