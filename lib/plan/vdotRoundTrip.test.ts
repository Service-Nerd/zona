import { describe, it, expect } from 'vitest'
import { vdotFor, generateRulePlan } from './ruleEngine'
import { buildPaceFromVDOT } from './paceBands'
import { COHORT_PLAN_START, cohortGrid, targetedGrid } from './cohortGrid'
import { slowGoalGrid, slowGoalDates } from './slowGoalGrid'
import { fullEnvelope } from './useCaseEnvelope'
import { formatVdot } from '@/lib/format'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * PLAN-VDOT-ROUNDTRIP-01 — a plan's own bands are reproducible from its own metadata.
 *
 * `applyRecalibration` (ruleEngine), the Zones screen (`DashboardClient` →
 * `buildPaceFromVDOT(meta.vdot_training_anchor, meta.vdot)`) and
 * `INV-PLAN-STEP-PACE-FROM-GUIDE` all rebuild the PaceGuide from those two stamped numbers.
 * Generation prices from the UNROUNDED pair, so a 1dp stamp made the rebuild one second per
 * km out — on **241 of 313 (77.0%)** wizard-reachable 5K benchmark times.
 *
 * ⚠️ The invariant had already paid for it: band-STRING comparison false-fired **25,811 times
 * across 14,268 plans**, every one by that same second, and was weakened to a numeric 3%
 * comparison. A gate that had to be loosened is the symptom; this is the cause.
 */

/** The benchmark date, derived from today by the owner the gate names — never a literal. */
const BENCH_DATE = slowGoalDates().benchmarkDate

const r1 = (x: number) => Math.round(x * 10) / 10
const BANDS = ['easyPaceStr', 'qualityPaceStr', 'cvPaceStr', 'intervalPaceStr',
               'marathonPaceStr', 'hmPaceStr'] as const

/** Every 5-second 5K time the wizard can take, as a benchmark. */
function wizard5kSpace(): { time: string; input: GeneratorInput }[] {
  const out: { time: string; input: GeneratorInput }[] = []
  for (let sec = 14 * 60; sec <= 40 * 60; sec += 5) {
    const time = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
    out.push({ time, input: { benchmark: { type: 'race', distance_km: 5, time, benchmark_date: BENCH_DATE } } as unknown as GeneratorInput })
  }
  return out
}

describe('PLAN-VDOT-ROUNDTRIP-01 — the stamp reproduces the bands it was priced from', () => {
  /** A full, buildable input at a given 5K benchmark — the wizard's own shape. */
  function planAt(time: string): GeneratorInput {
    return {
      athlete_name: 'Athlete', age: 38, race_name: 'Test',
      primary_metric: 'distance', plan_start: COHORT_PLAN_START,
      race_distance_km: 10, race_date: '2026-08-02',
      goal: 'finish', resting_hr: 52, max_hr: 186,
      current_weekly_km: 35, longest_recent_run_km: 14,
      recent_quality_training: 'occasional', hard_session_relationship: 'neutral',
      training_age: '2-5yr', days_available: 4, days_cannot_train: [], injury_history: [],
      // ⚠️ DERIVED, NEVER PINNED. `PINNED-CLOCK-01` caught this file on its first broad run with
      // a literal `benchmark_date`, and it was right: §10's staleness ramp measures how long ago
      // the runner actually RAN, so `vdotFor` is handed `new Date()` deliberately and a pinned
      // date crosses a discount step as the calendar moves (GOALPACE-5K-CLOCK-01, where a
      // fixture went red by one commit after eleven days of being read as 257).
      benchmark: { type: 'race', distance_km: 5, time, benchmark_date: BENCH_DATE },
    } as unknown as GeneratorInput
  }

  it('a plan generated at any 5K benchmark rebuilds its OWN bands from its OWN stamp', () => {
    // ⚠️ THE FIRST VERSION OF THIS ARM WAS VACUOUS: it compared `buildPaceFromVDOT(vdot,
    // vdotRaw)` against `buildPaceFromVDOT(vdot, vdotRaw)` — the same call with the same
    // arguments, which cannot differ however the stamp behaves. It had to go through the
    // real `generateRulePlan` stamp, which is the only thing that can regress.
    //
    // Every 30 seconds across the wizard's 5K range: 53 generated plans, enough to cross the
    // rounding boundaries that `cohortGrid`'s single benchmark never reaches.
    const bad: string[] = []
    let checked = 0
    for (let sec = 14 * 60; sec <= 40 * 60; sec += 30) {
      const time = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
      let plan: Plan
      try { plan = generateRulePlan(planAt(time), 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START) }
      catch { continue }
      const m = plan.meta as { vdot?: number; vdot_training_anchor?: number }
      if (m.vdot == null || m.vdot_training_anchor == null) continue
      // What any consumer of the stored plan rebuilds.
      const rebuilt = buildPaceFromVDOT(m.vdot_training_anchor, m.vdot) as unknown as Record<string, unknown>
      // What the plan actually carries on its own sessions.
      let planEasy: string | null = null
      for (const w of plan.weeks ?? []) {
        for (const sn of Object.values(w.sessions ?? {}) as { type?: string; pace_target?: string }[])
          if (sn?.type === 'easy' && sn.pace_target) { planEasy = sn.pace_target; break }
        if (planEasy) break
      }
      if (!planEasy) continue
      checked++
      if (String(rebuilt.easyPaceStr) !== planEasy)
        bad.push(`5K ${time}: session "${planEasy}" vs rebuild "${rebuilt.easyPaceStr}" `
          + `(stamp ${m.vdot} / ${m.vdot_training_anchor})`)
    }
    // A FLOOR on what it reached. 53 benchmark times is the population; anything much lower
    // means generation started refusing this input and the arm is measuring nothing.
    expect(checked, 'no plan was checked, so the round-trip was never exercised').toBeGreaterThan(40)
    expect(bad.length,
      `${bad.length} of ${checked} plans cannot reproduce their own pace bands from their own `
      + `metadata:\n${bad.slice(0, 5).join('\n')}`).toBe(0)
  })

  it('the 1dp stamp it replaced really did lose bands: measured 241 of 313', () => {
    // ⚠️ THE ARM ABOVE WOULD PASS ON A `buildPaceFromVDOT` THAT IGNORED ITS ARGUMENTS.
    // This one asserts the sensitivity is real, so the round-trip arm cannot be vacuous.
    let priced = 0, lossy = 0
    for (const { input } of wizard5kSpace()) {
      const { vdot, vdotRaw } = vdotFor(input)
      if (vdot == null || vdotRaw == null) continue
      priced++
      const exact = buildPaceFromVDOT(vdot, vdotRaw) as unknown as Record<string, unknown>
      const old = buildPaceFromVDOT(r1(vdot), r1(vdotRaw)) as unknown as Record<string, unknown>
      if (BANDS.some(b => exact[b] != null && String(exact[b]) !== String(old[b]))) lossy++
    }
    expect(priced).toBe(313)
    // ⚠️ A FLOOR, NOT AN EQUALITY. Measured 241 of 313 (77.0%) on 2026-11-08. The exact count
    // depends on §10's discount, which depends on the benchmark's AGE — constant here because
    // `BENCH_DATE` is derived from today, but a §10 amendment would move it for a reason that
    // has nothing to do with this defect, and the arm's job is only to prove the old stamp was
    // measurably lossy so the round-trip arm above cannot pass on an insensitive producer.
    expect(lossy, 'the 1dp stamp is no longer lossy at all, so the arm above proves nothing')
      .toBeGreaterThan(150)
  })

  it('a generated plan\'s stamp rebuilds that plan\'s own session pace strings', () => {
    const rows = cohortGrid().filter(i => i.benchmark != null)
    expect(rows.length).toBeGreaterThan(0)
    const bad: string[] = []
    let checked = 0
    for (let k = 0; k < 120; k++) {
      const input = rows[(k * 1013) % rows.length]
      let plan: Plan
      try { plan = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
      const m = plan.meta as { vdot?: number; vdot_training_anchor?: number }
      if (m.vdot == null || m.vdot_training_anchor == null) continue
      const rebuilt = buildPaceFromVDOT(m.vdot_training_anchor, m.vdot)
      // The easy band the runner reads on a session card, against the one the screen rebuilds.
      let planEasy: string | null = null
      for (const w of plan.weeks ?? []) {
        for (const s of Object.values(w.sessions ?? {}) as { type?: string; pace_target?: string }[])
          if (s?.type === 'easy' && s.pace_target) { planEasy = s.pace_target; break }
        if (planEasy) break
      }
      if (!planEasy) continue
      checked++
      if (rebuilt.easyPaceStr !== planEasy) bad.push(`session "${planEasy}" vs rebuild "${rebuilt.easyPaceStr}"`)
    }
    // ⚠️ A FLOOR ON WHAT IT CHECKED, not just on what it found. `cohortGrid` carries ONE
    // distinct benchmark, so this arm is the weakest of the three by construction — the
    // whole-space arm above is the real one. Recorded because the temptation is to read a
    // clean corpus run as proof (CORPUS-BENCHMARK-VARIETY-01).
    expect(checked).toBeGreaterThan(20)
    expect(bad.length, `Zones-screen rebuild disagrees with the plan's own sessions:\n${bad.slice(0, 3).join('\n')}`).toBe(0)
  })

  it('no corpus can measure this: benchmark variety, counted', () => {
    const { planStart, benchmarkDate } = slowGoalDates()
    const counts: Record<string, number> = {}
    const corpora: [string, GeneratorInput[]][] = [
      ['cohortGrid', cohortGrid()],
      ['targetedGrid', targetedGrid()],
      ['slowGoalGrid', slowGoalGrid(planStart, benchmarkDate) as unknown as GeneratorInput[]],
      ['useCaseEnvelope', fullEnvelope().map(c => c.input as GeneratorInput)],
    ]
    for (const [name, rows] of corpora)
      counts[name] = new Set(rows.filter(i => i.benchmark).map(i => JSON.stringify(i.benchmark))).size
    // ▲ WAS A CEILING, NOW A FLOOR (CORPUS-BENCHMARK-VARIETY-01, 2026-11-13). The arm used to
    // assert `<= 2` on purpose, documenting that the benchmark axis was pinned at one value
    // everywhere, and it said the moment someone widened a corpus was the moment to raise a
    // floor instead. `targetedGridExtra` carries FOUR benchmark rows — three 5K times spanning
    // the VDOT bands and one 10K — so targetedGrid reads 5 and the direction flips.
    // ⚠️ A fifth row claiming to exercise §10's staleness ramp was removed: measured, a
    // clock-pinned corpus cannot hold both "benchmark precedes the race" and "controlled age
    // against today", so every row sits on the 7% cap. The floor is therefore AT the value
    // with no margin, deliberately — one row removed should fail it.
    //
    // ⚠️ `cohortGrid` IS STILL PINNED AT ONE and that is not an oversight: crossing a
    // benchmark axis into 41,472 rows is what the focused-block pattern exists to avoid. The
    // variety lives in a block taken IN FULL, which is where reach belongs.
    expect(counts.targetedGrid,
      'the benchmark axis went back to being pinned — CORPUS-BENCHMARK-VARIETY-01')
      .toBeGreaterThanOrEqual(5)
    expect(counts.cohortGrid).toBeLessThanOrEqual(2)
    expect(counts.slowGoalGrid).toBeLessThanOrEqual(6)
  })

  it('formatVdot is the one display owner, and it rounds where the stamp no longer does', () => {
    expect(formatVdot(42.2731)).toBe('42.3')
    expect(formatVdot(42)).toBe('42.0')
    expect(formatVdot(null)).toBeNull()
    expect(formatVdot(Number.NaN)).toBeNull()
  })
})
