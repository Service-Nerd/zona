// TRIGGER-BACKTEST-02 — what each detector READS, so "silent" can be interpreted.
//
// 🔴 WHY THIS EXISTS, AND WHY THE ANSWER IT GIVES IS WORTH A MODULE.
//
// `checkAdjustmentTriggers` returns the FIRST match in priority order, never a list. So a
// trigger that comes back silent in `scripts/backtest-adjustment-triggers.ts` is in one of
// THREE states, and the harness could only ever report two of them:
//
//   ✅ reachable  — it fired
//   ⬜ silent     — its inputs were present and no threshold was crossed   ← a real finding
//   ⚠️ STARVED    — its inputs were never present at all                   ← the harness cannot speak
//   🔁 outranked  — it would have fired, but a senior trigger won first    ← the harness cannot speak
//
// The last two were reported in the same column as the second, which is this repo's
// `SWEEP-VACUOUS-01` class in the one place the answer gets handed to a BLOCKED board
// decision (`POSTRUN-PLAN-FEEDBACK-01`, Hutchinson's false-positive audit). It has already
// cost once: `recentLongRunAnalyses` was never built by the harness at all, so
// `long_run_shortfall` could not fire no matter what the data said, and its zero sat beside
// seven genuine ones (`BACKTEST-SECOND-ASSEMBLY-01`).
//
// 📐 MEASURED 2026-11-09, which is what makes STARVED the load-bearing state rather than a
// theoretical one. `run_analysis`, live rows only: `hr_above_ceiling_pct` present on 75 of
// 97 (77.3%) — and **72 of those 75 belong to ONE user**, a single-day backfill. Of the four
// genuine users, two have ANY, and one of those has three rows. The runner with the deepest
// real history (6 plan weeks, 14 analyses, 13 separate write days) has **zero**. So
// `zone_drift` is starved for every real runner, and the 77.3% aggregate reads healthy.
// `actual_load_mins` / `planned_load_mins` — which `long_run_shortfall` needs — are on
// **10 of 97**.
//
// ⚠️ THIS MODULE IS A SECOND COPY BY CONSTRUCTION AND THAT IS THE RISK. The engine's own
// code is the truth about what it reads; this is a declared reflection of it, and this repo
// has a register of second copies that drifted (`deloadCadence`, `tierResolution`,
// `SESSION-KM-01`, `OPS-AI-OWNER-01`). Two things hold it:
//
//   1. **`triggerInputs.test.ts` falsifies every entry.** For each detected trigger it
//      builds an input that makes that trigger fire, asserts it fires, applies
//      `neutralise`, and asserts it stops. A `neutralise` that does not neutralise fails
//      the build. An entry missing from the map fails the build.
//   2. **The PRIORITY ORDER is never declared here.** The harness observes it by peeling:
//      call the detector, neutralise the winner, call again. The sequence of winners IS the
//      order, measured rather than re-typed — so the one thing most likely to drift cannot.
//
// ⚠️ `present` is deliberately the DETECTOR'S OWN precondition, not "is the field non-null".
// `long_run_shortfall` needs `LONG_RUN_SHORTFALL_CONSECUTIVE` rows, not one; `fitness_signal`
// needs a session count AND a plan week. A field that is present but below the detector's
// own arity is still STARVED, because no data in that shape could ever reach the threshold.
import {
  type AdjustmentCheckInput,
  type TriggerType,
  DETECTED_TRIGGER_TYPES,
} from './planAdjustment'
// ⚠️ From `constants`, the same module the DETECTOR imports them from — never re-typed here.
// `present` asks the detector's own arity question, so it must read the detector's own number.
import {
  LONG_RUN_SHORTFALL_CONSECUTIVE,
  FITNESS_SIGNAL_SESSION_THRESHOLD,
  FITNESS_SIGNAL_MIN_PLAN_WEEKS,
  FATIGUE_ACCUMULATION_THRESHOLD,
} from './constants'

/**
 * 🔴 HOW a neutralisation works, because `present` and `neutralise` answer DIFFERENT
 * questions and the first cut of `triggerInputs.test.ts` assumed they answered one.
 *
 * It asserted *"`present` must be false after neutralising"* for every trigger, and
 * `shadow_load` failed it — correctly. `shadow_load` reads `plannedKm`, which is populated
 * on every week a plan exists, so it can never be STARVED; neutralising it means making the
 * percentage benign (planned = actual → exactly 0%), not taking the input away. **`present`
 * asks "could this detector see anything at all?"; `neutralise` asks "can it still fire?"**
 * Collapsing them would have forced either a named exemption or a `present` that lies.
 *
 * ⚠️ The kind is DECLARED and then CHECKED: a spec claiming `removes-input` whose `present`
 * stays true after neutralising fails the build, and so does a `benign-value` spec whose
 * `present` goes false — which would mean the input really was removable and the weaker
 * claim was hiding it.
 */
export type NeutraliseKind =
  /** The field is emptied, so the detector has nothing to judge: `present` goes FALSE. */
  | 'removes-input'
  /** The field stays, set to a value that cannot cross the threshold: `present` stays TRUE. */
  | 'benign-value'

export interface TriggerInputSpec {
  /** The input fields this detector reads, for the report. Prose, not a mechanism. */
  readonly reads: readonly string[]
  readonly neutraliseKind: NeutraliseKind
  /**
   * Could this detector see anything at all on this input? FALSE means STARVED: no
   * threshold was tested, so "never fired" says nothing about the rule.
   */
  readonly present: (i: AdjustmentCheckInput) => boolean
  /**
   * A copy of the input on which this detector cannot fire, leaving every OTHER
   * detector's inputs untouched. Used to peel the priority order.
   *
   * ⚠️ The non-interference requirement is why two of these are written the way they are:
   * `acute_chronic_high` and `shadow_load` both read `linkedKm`, so neither may blank it.
   * acute_chronic empties `priorWeeksKm` (the ratio then defaults to 1, below
   * `LOAD_RATIO.watch` by construction — `acuteChronicRatio`'s own documented behaviour);
   * shadow_load sets `plannedKm` equal to the total, making the percentage exactly 0.
   */
  readonly neutralise: (i: AdjustmentCheckInput) => AdjustmentCheckInput
}

export const TRIGGER_INPUTS: Readonly<Record<string, TriggerInputSpec>> = {
  fatigue_accumulation: {
    reads: ['recentFatigueRows'],
    neutraliseKind: 'removes-input',
    present: i => (i.recentFatigueRows?.length ?? 0) >= FATIGUE_ACCUMULATION_THRESHOLD,
    neutralise: i => ({ ...i, recentFatigueRows: [] }),
  },

  acute_chronic_high: {
    // Reads `linkedKm` too, deliberately NOT blanked — `shadow_load` reads it as well.
    reads: ['linkedKm', 'priorWeeksKm'],
    neutraliseKind: 'removes-input',
    present: i => {
      const w = (i.priorWeeksKm ?? []).slice(0, 4)
      return w.length > 0 && w.reduce((s, v) => s + v, 0) > 0
    },
    neutralise: i => ({ ...i, priorWeeksKm: [] }),
  },

  readiness_signal: {
    reads: ['readinessSignal'],
    neutraliseKind: 'removes-input',
    present: i => Boolean(i.readinessSignal?.hasBaseline),
    neutralise: i => ({ ...i, readinessSignal: undefined }),
  },

  zone_drift: {
    // 🔴 TWO input paths, and missing the second would have mis-reported this trigger as
    // starved on a runner with no HR but a high RPE. `buildRpeDisconnectAdjustment`
    // returns `{ type: 'zone_drift', detail: { source: 'rpe_disconnect' } }` — the SAME
    // trigger type, which is why the RPE fallback belongs in this entry and not its own.
    reads: ['hrInZoneData[].aboveCeilingPct', 'rpeSignal'],
    neutraliseKind: 'removes-input',
    present: i =>
      (i.hrInZoneData ?? []).some(s => s.aboveCeilingPct !== null)
      || Boolean(i.rpeSignal),
    neutralise: i => ({ ...i, hrInZoneData: [], rpeSignal: undefined }),
  },

  shadow_load: {
    reads: ['linkedKm', 'offPlanKm', 'plannedKm'],
    // `plannedKm` exists on every week a plan exists, so this trigger is never STARVED.
    neutraliseKind: 'benign-value',
    present: i => i.plannedKm > 0,
    neutralise: i => ({ ...i, plannedKm: i.linkedKm + i.offPlanKm }),
  },

  ef_decline: {
    reads: ['efTrendPct'],
    neutraliseKind: 'removes-input',
    present: i => i.efTrendPct !== null && i.efTrendPct !== undefined,
    neutralise: i => ({ ...i, efTrendPct: null }),
  },

  long_run_shortfall: {
    reads: ['recentLongRunAnalyses'],
    neutraliseKind: 'removes-input',
    present: i => (i.recentLongRunAnalyses?.length ?? 0) >= LONG_RUN_SHORTFALL_CONSECUTIVE,
    neutralise: i => ({ ...i, recentLongRunAnalyses: [] }),
  },

  fitness_signal: {
    reads: ['recentQualityAnalyses', 'currentWeekN'],
    neutraliseKind: 'removes-input',
    present: i =>
      (i.recentQualityAnalyses?.length ?? 0) >= FITNESS_SIGNAL_SESSION_THRESHOLD
      && i.currentWeekN >= FITNESS_SIGNAL_MIN_PLAN_WEEKS,
    neutralise: i => ({ ...i, recentQualityAnalyses: [] }),
  },
}

/** The detected triggers this map covers, read from the engine's own vocabulary. */
export function specFor(t: TriggerType): TriggerInputSpec | undefined {
  return TRIGGER_INPUTS[t]
}

/**
 * Every DETECTED trigger must have a spec. Exported so both the harness and the test read
 * one answer: a trigger added to the engine with no spec here would silently fall back to
 * the old two-state report, which is the thing this module exists to end.
 */
export function unspecified(): TriggerType[] {
  return DETECTED_TRIGGER_TYPES.filter(t => !TRIGGER_INPUTS[t])
}
