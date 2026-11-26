// FREE — infrastructure. ADR-027 B3 step 4b (ADR027-B3-REMAINING): L2, the trigger catalogue.
//
// ARCH-ENG-018: *"Triggers are a catalogue: event → condition → threshold (a config key, never
// inline) → the adapt event it raises. Triggers are evaluated when data arrives (ingest, analysis),
// not only when the runner taps something."*
//
// ── WHAT THIS IS, AND THE THREE THINGS IT DELIBERATELY DOES NOT DO ─────────────────────────────
//
// 🔴 (1) IT DOES NOT RESTATE THE CONDITIONS. `lib/coaching/planAdjustment.ts` owns them, and
// `lib/coaching/triggerInputs.ts` is ALREADY a declared reflection of what feeds each one — its own
// header says *"THIS MODULE IS A SECOND COPY BY CONSTRUCTION AND THAT IS THE RISK"* and lists the
// register of copies that drifted. A catalogue that re-described the predicates would be the THIRD
// representation of the same ten rules. Each row names its owner and its threshold by symbol; the
// predicate stays where it is.
//
// 🔴 (2) IT DOES NOT DECLARE PRIORITY. The detector is an if-chain with early returns, so order is
// real and load-bearing — and `triggerInputs.test.ts` already OBSERVES it by peeling (fire, neutralise
// the winner, fire again; the sequence of winners IS the order, measured rather than re-typed).
// Writing the order here would create exactly the drift that harness exists to prevent. **The one
// thing most likely to go stale is the one thing this file refuses to hold.**
//
// 🔴 (3) NOTHING EVALUATES THIS YET. The events in `evaluates_on` are the 4a vocabulary, which
// nothing raises. Wiring evaluation onto data arrival is `TRIGGERS-ON-DATA-ARRIVAL-01`, parked by
// founder decision because ARCH-ENG-018 routes its thresholds to the Coaching Board and its
// FREQUENCY to Design/SLT — moving evaluation to arrival changes how often runners are prompted.
//
// ── THE EVENT BINDING IS RULED, NOT CHOSEN ─────────────────────────────────────────────────────
// Coaching Board, 2026-11-21 (sitting `docs/decisions/boards-2026-11-21-triggers-on-run-arrival.md`,
// register row in `docs/canonical/coaching-rulings.md`), measured on a production replay of 17
// events across 6 runners: per-run evaluation gives 10 fires against 6 per-week verdicts, and
// **7 of 8 `zone_drift` fires rested on a single run**.
//
//   *"evaluate on `run_analysed` (free/manual: `run_logged`, `shadow_load` only); `zone_drift` needs
//   `ZONE_DRIFT_MIN_RUNS` (2); `ef_decline` at week close with `EF_DECLINE_MIN_RUNS` (2); fatigue,
//   RPE and readiness never on arrival; one fire per trigger type per week."*
//
// ⚠️ **ADR-027's ARCH-ENG-022 cites this as "§124 Amendment 1" and no such amendment exists** —
// §124 has four sub-headings and none is one (verified 2026-11-26). The ruling is real and
// enforceable from the register; the principle artifact was never written, and is owed by the board
// as `S124-TRIGGER-ARRIVAL-AMENDMENT-01`. Cited here by sitting and register, which resolve.

import type { TriggerType } from '@/lib/engine/contracts/triggers'
import type { RunEventName } from '@/lib/engine/contracts/events'

/**
 * When a trigger may be evaluated.
 *
 * `never_on_arrival` and `week_close` are RULED values, not absences: fatigue, RPE and readiness are
 * judged on a window or a pre-session signal, so a single arriving run cannot decide them, and
 * `ef_decline` was ruled to evaluate **at week close** rather than on each arrival. Writing either as
 * an empty event list would read as "nobody has said yet", which is the absence-as-a-value shape —
 * so the array form is typed non-empty and cannot express it.
 *
 * 🔴 `week_close` EXISTS BECAUSE THE FIRST CUT OF THIS FILE DID NOT HAVE IT. `ef_decline` carried
 * `on: ['run_analysed']` with a NOTE saying week close — so the note was right, the only
 * machine-readable field was wrong, and `triggersFor('run_analysed')` returned it. Every arm was
 * green: 4c would have evaluated EF on every arriving run, which is the thing the ruling forbids,
 * **because the prose and the data disagreed and only the prose was correct.** Found by code review.
 */
export type TriggerEvaluation =
  | { on: readonly [RunEventName, ...RunEventName[]]; note?: string }
  | { on: 'never_on_arrival' | 'week_close'; note: string }

export interface TriggerRule {
  id: TriggerType
  /** The ruled evaluation binding (Coaching Board 2026-11-21). */
  evaluates_on: TriggerEvaluation
  /** Threshold symbols, by name. `lib/coaching/constants.ts` unless stated; never a copied number. */
  threshold_keys: readonly string[]
  /** What the detector raises, in its own vocabulary. `null` = user-initiated, no detection. */
  raises: 'adjustment' | 'observation' | null
  /** Is this one of the eight the product claims to WATCH FOR? */
  detected: boolean
}

/**
 * ⚠️ `threshold_keys` names SYMBOLS, never values — ARCH-ENG-003's rule applied to triggers. The
 * gate resolves each one against the module that exports it, so a renamed or deleted constant fails
 * the build rather than leaving a row pointing at nothing.
 *
 * 🔻 **THE GATE CHECKS named→exists, NOT exists→named, AND THAT LIMIT IS REAL.** A row that omits a
 * constant its detector genuinely reads passes, because proving the reverse direction means parsing
 * the detector for the symbols it dereferences — the "grep the file" shape this repo keeps paying
 * for. The arms narrow it to one per detected row rather than an aggregate (a single fat row used to
 * satisfy the count for all ten), so an EMPTY row now fails; a row that is merely INCOMPLETE still
 * passes. `readiness_signal` was the live instance: it named none at all until code review.
 */
export const TRIGGER_RULES: readonly TriggerRule[] = [
  {
    id: 'acute_chronic_high',
    evaluates_on: { on: ['run_analysed'] },
    threshold_keys: ['LOAD_RATIO', 'MAX_ADJUSTMENTS_PER_WEEK', 'TAPER_PROTECTION_WEEKS'],
    raises: 'adjustment',
    detected: true,
  },
  {
    id: 'zone_drift',
    evaluates_on: { on: ['run_analysed'], note: 'needs ZONE_DRIFT_MIN_RUNS (2): 7 of 8 fires in the replay rested on a single run' },
    threshold_keys: ['ZONE_DRIFT_ABOVE_CEILING_PCT', 'RPE_DISCONNECT_THRESHOLD'],
    raises: 'adjustment',
    detected: true,
  },
  {
    id: 'shadow_load',
    evaluates_on: { on: ['run_analysed', 'run_logged'], note: 'the ONLY trigger a free or manual-log runner evaluates, per the ruling' },
    threshold_keys: ['SHADOW_LOAD_THRESHOLD_PCT', 'MAX_ADJUSTMENTS_PER_WEEK'],
    raises: 'observation',
    detected: true,
  },
  {
    id: 'ef_decline',
    evaluates_on: { on: 'week_close', note: 'ruled to evaluate at WEEK CLOSE with EF_DECLINE_MIN_RUNS (2), never on each arriving run' },
    threshold_keys: ['EF_DECLINE_THRESHOLD_PCT'],
    raises: 'adjustment',
    detected: true,
  },
  {
    id: 'fatigue_accumulation',
    evaluates_on: { on: 'never_on_arrival', note: 'judged on a window of recent sessions, so one arriving run cannot decide it' },
    threshold_keys: ['FATIGUE_ACCUMULATION_THRESHOLD'],
    raises: 'adjustment',
    detected: true,
  },
  {
    id: 'readiness_signal',
    evaluates_on: { on: 'never_on_arrival', note: 'a PRE-session signal (RHR / HRV / sleep); it pre-empts the day rather than reacting to a run' },
    threshold_keys: ['READINESS'],
    raises: 'adjustment',
    detected: true,
  },
  {
    id: 'fitness_signal',
    evaluates_on: { on: ['run_analysed'] },
    threshold_keys: ['FITNESS_SIGNAL_PACE_SCORE_MAX', 'FITNESS_SIGNAL_HR_CEILING_MAX', 'FITNESS_SIGNAL_SESSION_THRESHOLD', 'FITNESS_SIGNAL_MIN_PLAN_WEEKS'],
    raises: 'observation',
    detected: true,
  },
  {
    id: 'long_run_shortfall',
    evaluates_on: { on: ['run_analysed'] },
    threshold_keys: ['LONG_RUN_SHORTFALL_COMPLETION_PCT', 'LONG_RUN_SHORTFALL_CONSECUTIVE', 'LONG_RUN_SHORTFALL_REDUCE_PCT'],
    raises: 'adjustment',
    detected: true,
  },
  {
    id: 'skip_with_reason',
    evaluates_on: { on: 'never_on_arrival', note: 'user-initiated: the runner tells us, we do not notice' },
    threshold_keys: ['MAX_ADJUSTMENTS_PER_WEEK'],
    raises: null,
    detected: false,
  },
  {
    id: 'session_reorder',
    evaluates_on: { on: 'never_on_arrival', note: 'user-initiated: the runner tells us, we do not notice' },
    threshold_keys: ['MAX_ADJUSTMENTS_PER_WEEK'],
    raises: null,
    detected: false,
  },
] as const

/** Which triggers a given run event may evaluate. 4c reads this; nothing does today. */
export function triggersFor(event: RunEventName): TriggerType[] {
  return TRIGGER_RULES
    .filter(r => Array.isArray(r.evaluates_on.on) && r.evaluates_on.on.includes(event))
    .map(r => r.id)
}
