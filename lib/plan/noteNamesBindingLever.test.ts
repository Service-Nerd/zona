/**
 * M5-EASY-CEILING-01 — a note must name the lever that is ACTUALLY binding.
 *
 * §40c: "a suppressed target is stated, never absorbed silently", and the note
 * must NAME THE LEVER. Naming the wrong one is worse than naming none: a runner
 * told "the long run is at its time cap" learns nothing they can act on when it
 * is at 151 minutes of an available 210.
 *
 * Two notes asserted the long-run TIME CAP as the cause of a shortfall without
 * ever checking it. Found by the Coaching Board's cold re-review of M5, and the
 * second one found while fixing the first.
 *
 * Measured: across 191 firings of the long-run shortfall note on a HM/marathon
 * grid, the time cap was the binding constraint in ZERO of them. All 191 named
 * the wrong lever.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { GENERATION_CONFIG } from './generationConfig'
import { isLongRun } from './sessionRole'
import type { GeneratorInput, Session } from '@/types/plan'

const TODAY = '2026-09-21'
const raceIn = (w: number) =>
  new Date(new Date(`${TODAY}T00:00:00Z`).getTime() + (w * 7 - 1) * 86_400_000).toISOString().slice(0, 10)

const gen = (o: Record<string, unknown>, weeks = 16) => {
  const input = {
    race_distance_km: 42.2, goal: 'finish', age: 41, training_age: '2-5yr',
    recent_quality_training: 'occasional', hard_session_relationship: 'neutral',
    injury_history: [], race_date: raceIn(weeks), plan_start: TODAY,
    acknowledged_prep_warning: true, ...o,
  } as unknown as GeneratorInput
  const r = generateRulePlan(input, 'paid') as unknown as Record<string, unknown>
  const plan = (r.plan ?? r) as { weeks: Array<{ n: number; type?: string; sessions?: Record<string, Session | undefined> }>; meta: Record<string, unknown> }
  const peakLrMins = Math.max(0, ...plan.weeks
    .filter(w => w.n >= 1 && w.type !== 'race')
    .map(w => {
      const lr = Object.values(w.sessions ?? {}).find(s => !!s && isLongRun(s))
      return lr?.duration_mins ?? 0
    }))
  const peakLrKm = Math.max(0, ...plan.weeks
    .filter(w => w.n >= 1 && w.type !== 'race')
    .map(w => {
      const lr = Object.values(w.sessions ?? {}).find(sn => !!sn && isLongRun(sn))
      return lr?.distance_km ?? 0
    }))
  return { plan, peakLrMins, peakLrKm, capMins: GENERATION_CONFIG.LONG_RUN_CAP_MINUTES.MARATHON }
}

/** The M5 persona: second marathon, 40 km/wk over 4 days, knee history. */
const M5 = { current_weekly_km: 40, longest_recent_run_km: 22, days_available: 4, injury_history: ['Knee'], hard_session_relationship: 'overdo' }

describe('the note names the constraint that is actually binding', () => {
  it('M5: the long run is NOT at its time cap — so neither note may blame it', () => {
    const { plan, peakLrMins, capMins } = gen(M5)
    // Guards the guard: if this ever becomes time-capped the test below is
    // asserting nothing, so pin the premise as a number.
    expect(peakLrMins).toBeLessThan(capMins - 1)

    const structural = String(plan.meta.volume_constraint_note ?? '')
    const shortfall = String(plan.meta.long_run_shortfall_note ?? '')
    expect(structural + shortfall).not.toMatch(/already at its time cap/)
    // §80 Am.1 reworded the cap branch: it no longer names a lever, because
    // when the ceiling binds there isn't one (McMillan).
    expect(structural + shortfall).not.toMatch(/ceiling for this distance is deliberate/)
  })

  it('M5: the structural note names the real mechanism — or there is no shortfall left', () => {
    // ⚠️ AMENDED 2026-09-17 (PLAN-FITNESS-01). The §24/§80 specificity ramp lifts
    // this runner's peak long run to §80's floor, so there is no shortfall left
    // to declare and the note is correctly ABSENT. Absence is only acceptable
    // WITH that evidence — otherwise this test would pass on a plan that had
    // silently stopped explaining itself, which is the exact failure it exists
    // to catch. So the floor is asserted as a number.
    const { plan, peakLrKm } = gen(M5)
    const note = String(plan.meta.volume_constraint_note ?? '')
    if (!note) {
      const floorKm = 42.2 * GENERATION_CONFIG.FINISH_GOAL_PEAK_LR_RATIO_VS_RACE_DURATION
        - GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
      expect(peakLrKm, 'no constraint note is only honest if the long run actually reaches its floor')
        .toBeGreaterThanOrEqual(floorKm)
      return
    }
    expect(note).toMatch(/longest run of the week|share of that week/i)
  })

  it('M5: the shortfall note names weekly volume — or there is no shortfall', () => {
    // Same amendment as above: M5 now meets §80's floor, so no shortfall note is
    // produced. When one IS produced it must still name weekly volume rather
    // than blame the time cap (M5-EASY-CEILING-01's finding).
    const { plan, peakLrKm } = gen(M5)
    const note = String(plan.meta.long_run_shortfall_note ?? '')
    if (!note) {
      const floorKm = 42.2 * GENERATION_CONFIG.FINISH_GOAL_PEAK_LR_RATIO_VS_RACE_DURATION
        - GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
      expect(peakLrKm).toBeGreaterThanOrEqual(floorKm)
      return
    }
    expect(note).toMatch(/weekly volume is what limits it/i)
    // ADR-015: durations read "3h 28" / "45 min", never a raw minute count.
    expect(note).toMatch(/tops out at (?:\d+h(?: \d{2})?|\d+ min)\./)
    expect(note, 'raw minutes are an ADR-015 breach').not.toMatch(/\d+ minutes/)
  })

  it('a runner who IS at the time cap still gets told so — the branch is live', () => {
    // Slow enough that §80's floor sits above the 210-minute cap, with enough
    // volume to reach it. Without this the fix would have replaced one
    // unconditional claim with another.
    const { plan, peakLrMins, capMins } = gen({
      current_weekly_km: 80, longest_recent_run_km: 32, days_available: 6, age: 45,
      training_age: '5yr+', fitness_level: 'intermediate',
      benchmark: { type: 'race', distance_km: 10, time: '1:05:00' },
    }, 20)
    // §80 Am.1 — the tolerance is now LONG_RUN_AT_CAP_TOLERANCE_MINS, not 1.
    // ⚠️ THIS TEST IS WHY THE BOARD'S "the branch is dead" FRAMING WAS TOO
    // STRONG. The branch was unreachable across 5,264 firings in the cohort and
    // targeted grids, but THIS constructed persona does reach it, and did so
    // under the old +1 predicate. "Zero in the corpus" is not "cannot fire" —
    // the same lesson the liveness harness records about its own sample.
    expect(peakLrMins).toBeGreaterThanOrEqual(capMins - GENERATION_CONFIG.LONG_RUN_AT_CAP_TOLERANCE_MINS)
    expect(String(plan.meta.long_run_shortfall_note ?? ''))
      .toMatch(/ceiling for this distance is deliberate/)
  })
})
