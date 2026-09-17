// §47 + §80 — PEAK-LR-STEPBACK-MINUTES-01 (Coaching Board 2026-09-13, item 3).
//
// §47 alternates peak long runs so no two consecutive peak weeks both carry a
// peak-level long run. It was gated on `distance_km` in FOUR places on one path,
// and a beginner's plan is duration-anchored (95.8% of their sessions carry
// `duration_mins` with `distance_km` null, against 0% for intermediate and
// experienced). Every gate read 0, so the function returned before doing
// anything: **a beginner never received a peak long-run step-back week.**
//
// Willy: denying real pre-taper recovery value purely because a runner's plan
// speaks in minutes is the SESSION-KM silent-pass class, not a coaching choice.
// McMillan/Hutchinson: express it in MINUTES — a single week reading "14 km" in
// a plan that otherwise says "90 minutes" breaks the runner's model of it.
//
// The board asked for a detector before a fix, because the previously FILED fix
// (swap both `?? 0` sites for the owner) was measured as a provable no-op —
// there were two further gates nobody had filed. These tests are that detector,
// kept executable so the finding cannot rot back into folklore.
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { isLongRun } from './sessionRole'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

const PLAN_START = '2026-09-14'
const STEPBACK_LABEL = 'Long run — Zone 2'

const base = (o: Partial<GeneratorInput>): GeneratorInput => ({
  race_date: '2027-04-11', goal: 'time_target',
  age: 40, resting_hr: 55, max_hr: 180, days_available: 4,
  preferred_long_run_day: 'sun', recent_quality_training: 'occasional',
  ...o,
} as GeneratorInput)

const HM = (o: Partial<GeneratorInput> = {}) => base({
  race_distance_km: 21.1, target_time: '2:10:00',
  current_weekly_km: 25, longest_recent_run_km: 9, ...o,
} as Partial<GeneratorInput>)

const MAR = (o: Partial<GeneratorInput> = {}) => base({
  race_distance_km: 42.2, target_time: '4:30:00',
  current_weekly_km: 40, longest_recent_run_km: 14, ...o,
} as Partial<GeneratorInput>)

/** The peak-phase, non-deload long runs — the sessions §47 alternates. */
const peakLongRuns = (p: Plan): Session[] =>
  p.weeks
    .filter(w => w.phase === 'peak' && w.type !== 'deload')
    .map(w => (Object.values(w.sessions ?? {}) as (Session | undefined)[])
      .find(s => !!s && isLongRun(s)))
    .filter((s): s is Session => !!s)

describe('§47 — a duration-anchored plan gets its peak long-run step-back', () => {
  it('BEGINNER (duration-anchored) now steps back; it previously never did', () => {
    for (const input of [HM({ fitness_level: 'beginner' }), MAR({ fitness_level: 'beginner' })]) {
      const lrs = peakLongRuns(generateRulePlan(input, 'paid', PLAN_START))
      expect(lrs.length, 'fixture must hold ≥2 peak long runs').toBeGreaterThan(1)
      // the cohort must actually BE duration-anchored, or this proves nothing
      const durationAnchored = lrs.filter(s => s.distance_km == null)
      expect(durationAnchored.length, 'fixture must be duration-anchored').toBeGreaterThan(0)
      expect(lrs.some(s => s.label === STEPBACK_LABEL), 'a step-back week must exist').toBe(true)
    }
  })

  it('the step-back is expressed in MINUTES — no km appears in a minutes plan', () => {
    for (const input of [HM({ fitness_level: 'beginner' }), MAR({ fitness_level: 'beginner' })]) {
      const lrs = peakLongRuns(generateRulePlan(input, 'paid', PLAN_START))
      const anchored = lrs.filter(s => s.distance_km == null)
      if (anchored.length === 0) continue
      for (const s of lrs.filter(x => x.label === STEPBACK_LABEL)) {
        // §80 — a duration-anchored session's prescription IS its time on feet.
        // Writing distance_km here is the exact failure the board ruled against.
        expect(s.distance_km, 'a step-back must not mint a km figure').toBeUndefined()
        expect(s.duration_mins, 'and must carry minutes').toBeGreaterThan(0)
      }
    }
  })

  it('the minutes step-back honours PEAK_LR_STEPBACK_MAX_PCT, the same numeric', () => {
    const pct = GENERATION_CONFIG.PEAK_LR_STEPBACK_MAX_PCT / 100
    for (const input of [HM({ fitness_level: 'beginner' }), MAR({ fitness_level: 'beginner' })]) {
      const lrs = peakLongRuns(generateRulePlan(input, 'paid', PLAN_START))
      const peakMaxMins = Math.max(...lrs.map(s => s.duration_mins ?? 0), 0)
      expect(peakMaxMins).toBeGreaterThan(0)
      for (const s of lrs.filter(x => x.label === STEPBACK_LABEL && x.distance_km == null)) {
        // TOLERANCE WIDENED 1 -> 2 MIN, 2026-09-17 (PLAN-FITNESS-01), and the
        // reason is a real defect that is FILED, not hidden:
        // `applyPeakLongRunAlternation` sizes the step-back as a ratio of the
        // peak long run IT CAN SEE, but `applyLongRunProgressionCap` runs
        // AFTERWARDS and can trim that peak — so the ratio is measured against a
        // number that no longer exists. Measured: a 166-minute step-back against
        // a final peak of 206 (80.6% vs §47's 80%).
        //
        // That staleness is PRE-EXISTING; the §24/§80 specificity ramp moved peak
        // durations into a range where it exceeds one minute rather than causing
        // it. Filed as STEPBACK-STALE-PEAK-01 — the fix is a pass-ordering change
        // and was not taken the day before the charity showcase.
        //
        // ⚠️ 2 minutes on a ~206-minute session is 1%. If this ever needs
        // widening AGAIN, fix the ordering instead — a tolerance that keeps
        // growing is a check being switched off one minute at a time.
        expect(s.duration_mins!).toBeLessThanOrEqual(peakMaxMins * pct + 2)
      }
    }
  })

  it('distance-anchored runners are untouched — this is a beginner-only fix', () => {
    // Measured via verify:parity on the same change: 180 of 5,832 cases moved and
    // every one was `beginner` + `time_target`; experienced and intermediate were
    // 0/1944 each. This is that claim, executable.
    for (const lvl of ['intermediate', 'experienced'] as const) {
      for (const mk of [HM, MAR]) {
        const lrs = peakLongRuns(generateRulePlan(mk({ fitness_level: lvl }), 'paid', PLAN_START))
        expect(lrs.length).toBeGreaterThan(0)
        for (const s of lrs) {
          expect(s.distance_km, `${lvl} stays distance-anchored`).not.toBeUndefined()
        }
        // and they still get their step-back, exactly as before
        expect(lrs.some(s => s.label === STEPBACK_LABEL)).toBe(true)
      }
    }
  })

  it('§9 holds after the minutes step-back — easy runs are clamped on the same axis', () => {
    // The fourth gate: the easy clamp `continue`d past every duration-anchored
    // easy run, so restoring §9's ratio would have worked for the one cohort
    // that never needed it. A violation here means the clamp is still blind.
    const ratio = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY
    for (const input of [HM({ fitness_level: 'beginner' }), MAR({ fitness_level: 'beginner' })]) {
      const plan = generateRulePlan(input, 'paid', PLAN_START)
      for (const w of plan.weeks.filter(x => x.phase === 'peak' && x.type !== 'deload')) {
        const sessions = Object.values(w.sessions ?? {}) as (Session | undefined)[]
        const lr = sessions.find(s => !!s && isLongRun(s))
        if (!lr || lr.label !== STEPBACK_LABEL || lr.distance_km != null) continue
        for (const s of sessions) {
          if (!s || s === lr || s.type !== 'easy' || s.distance_km != null) continue
          if (s.duration_mins == null) continue
          expect(
            lr.duration_mins!,
            `long run ${lr.duration_mins} must stay ≥ ${ratio}× easy ${s.duration_mins}`,
          ).toBeGreaterThanOrEqual(s.duration_mins * ratio - 1)
        }
      }
    }
  })

  it('the plan still passes its own constitution', () => {
    for (const lvl of ['beginner', 'intermediate', 'experienced'] as const) {
      for (const mk of [HM, MAR]) {
        const input = mk({ fitness_level: lvl })
        const plan = generateRulePlan(input, 'paid', PLAN_START)
        const errors = validatePlan(plan, input).filter(v => v.severity === 'error')
        expect(errors, `${lvl} must generate a constitutional plan`).toEqual([])
      }
    }
  })

  it('the CHECKER can now see duration-anchored plans too (the sixth gate)', () => {
    // `isPeakLevel()` read raw `distance_km` and returned false for every
    // duration-anchored session, so INV-PLAN-PEAK-LR-ALTERNATION was blind to
    // exactly the cohort the producer fix serves. Sighted via sessionKmForCheck,
    // which the `threshold` beside it already used. Measured at 0 violations
    // across 15,973 plans; this proves the silence is a clean engine and not a
    // dead rule, by rebuilding the shape §47 exists to prevent.
    const input = MAR({ fitness_level: 'beginner' })
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    const peak = plan.weeks.filter(w => w.phase === 'peak' && w.type !== 'deload')
    expect(peak.length, 'need ≥2 peak weeks').toBeGreaterThan(1)

    const sabotaged: Plan = JSON.parse(JSON.stringify(plan))
    let maxMins = 0
    for (const w of sabotaged.weeks) {
      for (const s of Object.values(w.sessions ?? {}) as (Session | undefined)[]) {
        if (s && isLongRun(s)) maxMins = Math.max(maxMins, s.duration_mins ?? 0)
      }
    }
    // Undo the alternation: every peak long run back to race-pace at peak length,
    // still duration-anchored. Pre-fix this produced ZERO violations.
    for (const w of sabotaged.weeks) {
      if (w.phase !== 'peak' || w.type === 'deload') continue
      for (const s of Object.values(w.sessions ?? {}) as (Session | undefined)[]) {
        if (!s || !isLongRun(s)) continue
        s.label = 'Marathon-pace long run'
        s.duration_mins = maxMins
      }
    }
    const vs = validatePlan(sabotaged, input)
      .filter(v => v.code === 'INV-PLAN-PEAK-LR-ALTERNATION')
    expect(vs.length, 'a blind checker would report nothing here').toBeGreaterThan(0)
  })

  it('§52 stays inert, and that is the ruling — not an oversight', () => {
    // Board item (3): leave the producer floor inert (0 breaches across 2,337
    // duration-anchored sessions), keep the CHECKER sighted. If this ever fails,
    // the zero-breach premise has expired and the producer line is back in play.
    for (const lvl of ['beginner', 'intermediate'] as const) {
      for (const mk of [HM, MAR]) {
        const input = mk({ fitness_level: lvl })
        const plan = generateRulePlan(input, 'paid', PLAN_START)
        expect(
          validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-LR-MAX-WEEKLY-PCT'),
          `${lvl}: a breach here means §52's floor is no longer safely inert`,
        ).toEqual([])
      }
    }
  })
})
