// TRIGGER-BACKTEST-02 — the falsification gate for `triggerInputs.ts`.
//
// 🔴 WHY THIS FILE IS THE WHOLE JUSTIFICATION FOR THE MODULE IT TESTS.
// `TRIGGER_INPUTS` is a declared reflection of what `checkAdjustmentTriggers` reads, so it
// is a SECOND COPY of knowledge the engine already holds. This repo has a register of second
// copies that drifted and agreed only by accident — `deloadCadence`, `tierResolution`,
// `SESSION-KM-01`, `OPS-AI-OWNER-01` — and the recorded flaw in `deloadCadence.test.ts` was
// precisely that the test asserted its own copy rather than the producer.
//
// So every arm here runs the REAL `checkAdjustmentTriggers`, in both directions:
//
//   1. **make it fire**      — the input reaches that trigger, so the arm is not vacuous
//   2. **`present` is true** on that input — a firing input the map calls starved is a bug
//   3. **neutralise it**     — the SAME input, neutralised, no longer yields that trigger
//   4. **`present` is false** after neutralising — the two halves must agree
//   5. **non-interference**  — neutralising trigger A must not change whether B is present
//
// ⚠️ ARM 1 IS NOT DECORATION. A `neutralise` that blanks the wrong field passes arm 3 on an
// input that never fired in the first place — *"a mutation aimed at the wrong population"*,
// filed in this repo twice. Asserting the fire FIRST is what makes arm 3 mean something.
//
// ⚠️ AND ARM 5 EXISTS BECAUSE TWO TRIGGERS SHARE A FIELD. `acute_chronic_high` and
// `shadow_load` both read `linkedKm`. The harness peels the priority order by neutralising
// the winner and re-running, so a neutralise that collaterally silences a junior trigger
// would report it as unreachable — manufacturing exactly the false "silent" this module was
// written to remove.
import { describe, it, expect } from 'vitest'
import { checkAdjustmentTriggers, DETECTED_TRIGGER_TYPES, type AdjustmentCheckInput, type TriggerType } from './planAdjustment'
import { TRIGGER_INPUTS, unspecified, specFor } from './triggerInputs'
import { FATIGUE_ACCUMULATION_THRESHOLD, FITNESS_SIGNAL_SESSION_THRESHOLD } from './constants'
import type { Session } from '@/types/plan'

const rest = (): Session => ({ type: 'rest', label: 'Rest', detail: null })
const long = (km: number): Session => ({ type: 'long', label: 'Long run', detail: null, distance_km: km })
const easy = (km: number): Session => ({ type: 'easy', label: 'Easy run', detail: null, distance_km: km })

/** A week the entry guard accepts: 7 slots, mon→sun, every one a real session object. */
const week = (): Session[] => [easy(8), rest(), easy(8), rest(), rest(), rest(), long(20)]

/**
 * Quiet on every signal: no fatigue, ratio 1.0, shadow 0, no HR, no EF, no windows.
 * Guards open (6 of 12 weeks remaining, phase build). Modelled on `planAdjustment.test.ts`'s
 * own `baseInput`, deliberately — if the engine's entry contract changes, both move together.
 */
const quiet = (): AdjustmentCheckInput => ({
  currentWeekN: 6,
  totalWeeks: 12,
  currentWeekSessions: week(),
  linkedKm: 40,
  offPlanKm: 0,
  plannedKm: 40,
  priorWeeksKm: [40, 40, 40, 40],
  hrInZoneData: [],
  efTrendPct: null,
  adjustmentsThisWeek: 0,
  currentPhase: 'build',
})

/**
 * One input per detected trigger that actually REACHES it. Each is quiet on everything
 * senior, so the fire is attributable.
 *
 * ⚠️ The map is keyed by the engine's own `TriggerType`, and the completeness arm below
 * fails if a detected trigger has no entry — so a new detector cannot be added to the
 * engine and left unfalsified here.
 */
const FIRING: Record<string, () => AdjustmentCheckInput> = {
  fatigue_accumulation: () => ({
    ...quiet(),
    recentFatigueRows: Array.from({ length: FATIGUE_ACCUMULATION_THRESHOLD }, () => ({ fatigue_tag: 'Wrecked' })),
  }),

  // ratio = 60 / 20 = 3.0, well above LOAD_RATIO.watch (1.3).
  // ⚠️ `plannedKm` is raised with it so SHADOW stays 0 — otherwise this input fires
  // shadow_load too and the arm would not isolate the trigger it names.
  acute_chronic_high: () => ({ ...quiet(), linkedKm: 60, plannedKm: 60, priorWeeksKm: [20, 20, 20, 20] }),

  readiness_signal: () => ({
    ...quiet(),
    readinessSignal: {
      sessionType: 'long', sessionDay: 'sun',
      isElevatedRHR: true, isLowHRV: true, isShortSleep: false, isPoorSleepQuality: false,
      softeningWarranted: true, hasBaseline: true,
    },
  }),

  // 87% of the week's easy running above the Z2 cap — the shape of the real 2026-10-28 firing.
  zone_drift: () => ({
    ...quiet(),
    hrInZoneData: [{ hrInZonePct: 13, aboveCeilingPct: 87, actualLoadKm: 8 }],
  }),

  // 40 planned, 60 run → +50%, above SHADOW_LOAD_THRESHOLD_PCT (15).
  // ⚠️ `priorWeeksKm` is raised so the RATIO stays at 1.0 and acute_chronic — which is
  // SENIOR to shadow_load — does not win instead.
  shadow_load: () => ({ ...quiet(), linkedKm: 60, plannedKm: 40, priorWeeksKm: [60, 60, 60, 60] }),

  ef_decline: () => ({ ...quiet(), efTrendPct: -12 }),

  long_run_shortfall: () => ({
    ...quiet(),
    recentLongRunAnalyses: [
      { actualKm: 14, plannedKm: 20, weekN: 5 },
      { actualKm: 13, plannedKm: 18, weekN: 4 },
    ],
  }),

  fitness_signal: () => ({
    ...quiet(),
    recentQualityAnalyses: Array.from({ length: FITNESS_SIGNAL_SESSION_THRESHOLD }, (_, i) => ({
      paceScore: 40, hrAboveCeilingPct: 5, weekN: 6 - i,
    })),
  }),
}

describe('TRIGGER_INPUTS — completeness, read from the engine', () => {
  it('every DETECTED trigger has a spec', () => {
    expect(unspecified()).toEqual([])
  })

  it('every DETECTED trigger has a firing input in this file', () => {
    const missing = DETECTED_TRIGGER_TYPES.filter(t => !FIRING[t])
    expect(missing).toEqual([])
  })

  it('the spec map names no trigger the engine does not have', () => {
    const stray = Object.keys(TRIGGER_INPUTS).filter(k => !(DETECTED_TRIGGER_TYPES as readonly string[]).includes(k))
    expect(stray).toEqual([])
  })
})

describe.each(DETECTED_TRIGGER_TYPES)('TRIGGER_INPUTS — %s', (t: TriggerType) => {
  const spec = specFor(t)!
  const build = () => FIRING[t]()

  it('the firing input really reaches this trigger', () => {
    const out = checkAdjustmentTriggers(build())
    expect(out, `${t}: the fixture did not fire — arm 3 would be vacuous`).not.toBeNull()
    expect(out!.trigger.type).toBe(t)
  })

  it('`present` is true on an input that fires it', () => {
    expect(spec.present(build())).toBe(true)
  })

  it('`neutralise` stops it firing on that same input', () => {
    const out = checkAdjustmentTriggers(spec.neutralise(build()))
    // It may now fall through to a JUNIOR trigger, which is the peel working. What it must
    // never be is this trigger again — that would mean the neutralise missed its field, and
    // the harness's peel loop would never terminate.
    expect(out?.trigger.type ?? null, `${t}: neutralise did not neutralise`).not.toBe(t)
  })

  // 🔴 THIS ARM USED TO ASSERT `present === false` FOR EVERY TRIGGER AND `shadow_load`
  // FAILED IT — correctly, which is how `NeutraliseKind` came to exist. `plannedKm` is
  // populated on every week a plan exists, so that detector can never be STARVED and its
  // neutralisation makes the VALUE benign instead of removing the input. `present` asks
  // "could it see anything?"; `neutralise` asks "can it still fire?" **The first version of
  // this arm collapsed two questions into one and would have been satisfied by a `present`
  // that lied.** Now the kind is declared and both directions are checked, so neither a
  // removable input hiding behind the weaker claim nor the reverse can pass.
  it('`present` agrees with the declared neutralise kind', () => {
    const after = spec.present(spec.neutralise(build()))
    if (spec.neutraliseKind === 'removes-input') {
      expect(after, `${t}: declares removes-input but its input survives`).toBe(false)
    } else {
      expect(after, `${t}: declares benign-value but its input was removed`).toBe(true)
    }
  })
})

describe('TRIGGER_INPUTS — non-interference', () => {
  // 🔴 `acute_chronic_high` and `shadow_load` both read `linkedKm`, so a careless
  // neutralise of either blanks the other's input and the harness reports a FALSE
  // "unreachable". This arm walks every ordered pair rather than naming that one.
  it.each(
    DETECTED_TRIGGER_TYPES.flatMap(a => DETECTED_TRIGGER_TYPES.filter(b => b !== a).map(b => [a, b] as const)),
  )('neutralising %s leaves %s`s inputs present', (a, b) => {
    const base = FIRING[b]()
    // Only meaningful where B's inputs were present to begin with.
    if (!specFor(b)!.present(base)) return
    expect(specFor(b)!.present(specFor(a)!.neutralise(base)), `${a} silenced ${b}`).toBe(true)
  })
})

describe('TRIGGER_INPUTS — STARVED is distinguishable from silent', () => {
  it('a quiet input starves the data-driven triggers rather than testing their thresholds', () => {
    const q = quiet()
    const starved = DETECTED_TRIGGER_TYPES.filter(t => !specFor(t)!.present(q))
    // The whole point of the three-state report: on `quiet`, these detectors were never
    // given anything to judge, so "never fired" says nothing about the rule.
    expect(starved).toContain('zone_drift')
    expect(starved).toContain('ef_decline')
    expect(starved).toContain('fatigue_accumulation')
    expect(starved).toContain('long_run_shortfall')
    // ⚠️ And these two are NOT starved on a quiet input, which is why the distinction is
    // real rather than a relabelling of "did not fire": both read fields that are always
    // populated, so their silence genuinely is a threshold miss.
    expect(starved).not.toContain('shadow_load')
    expect(starved).not.toContain('acute_chronic_high')
  })
})
