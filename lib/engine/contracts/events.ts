// FREE — infrastructure. ADR-027 B3 step 4a (ADR027-B3-REMAINING): the run event vocabulary.
//
// L2's input. The trigger catalogue (step 4b, ARCH-ENG-018) is `event → condition → threshold →
// the adapt event it raises`, so the EVENT NAMES are the catalogue's vocabulary and have to be
// fixed before the catalogue can reference them. That ordering is why this lands first.
//
// ── NOTHING EMITS THESE YET, AND THAT IS THE STEP, NOT AN OVERSIGHT ─────────────────────────────
// ⚠️ `grep` for these three names across `lib/` and `app/` returned ZERO before this file: they
// existed only as prose in ARCH-ENG-022. This is a first definition, not a migration, and it
// deliberately does not make any path raise them — wiring the ingest route to raise `run_arrived`
// changes a production path and belongs to 4b/B4b. Defining the vocabulary and emitting it are two
// steps and this is the first.
//
// ── THREE EVENTS, AND ONLY TWO EVALUATE TRIGGERS (ARCH-ENG-022) ─────────────────────────────────
// The distinction is a RULING, not a design preference, and it is the whole reason the type below
// carries `evaluates_triggers` rather than leaving it to each call site to remember:
//
//   · `run_logged`   — UNCHANGED by §124 Amendment 1 (Coaching Board, 2026-11-21): the evaluation
//                      event for a runner with no analysis (free tier, or a manual log), for the
//                      ACTIVITY-LOG triggers only.
//   · `run_analysed` — ADDED, which that sitting asked for in as many words: *"ADR-027's event list
//                      has `run_logged` but no `run_analysed`; the catalogue needs it."*
//   · `run_arrived`  — ADDED and NOT an evaluation event. The same sitting ruled *"the evaluation
//                      event is `run_analysed`, never raw ingest"*, and that stands. Giving it a
//                      trigger would reverse §124 Am. 1.
//
// 🔴 WHY `run_arrived` HAS TO EXIST, MEASURED 2026-11-25: over 14 days of telemetry **39 distinct
// runs reached the matcher and were not linked**, and **27 of 176 live completion rows carry a run
// link — 15.3%**. A run that never links produces NEITHER `run_logged` NOR `run_analysed`, so
// without a third event that whole population is outside the catalogue's reach — and it is the
// population the SLT identified as the journey's break (`STEP4-RUNS-NO-COMPLETIONS-01`).
// ⚠️ ARCH-ENG-013 inherits it: L1's `observed` block is assembled from completions, so at that link
// rate it reads a fraction of what the runner actually ran.

import { RUN_UNMATCHED_REASONS, type RunUnmatchedReason } from './runOutcome'

/** The three run events, in the order a run passes through them. */
export type RunEventName = 'run_arrived' | 'run_logged' | 'run_analysed'

/**
 * What `run_arrived` carries. The outcome is the point of the event: an unmatched run is invisible
 * without it.
 *
 * ⚠️ `reason` is REQUIRED when unmatched and absent when linked, expressed in the type rather than
 * left to a convention — "unmatched with no reason" is absence written as a value, and this
 * codebase has paid for that shape repeatedly.
 *
 * 🔑 The reason vocabulary is READ FROM ITS OWNER (`./runOutcome`), never restated here. A second copy of a six-member list is the
 * `RESHAPE_SKIP_INVARIANTS` shape from two days ago: the comment said "never copied" while the list
 * sat where its second reader could not reach it.
 */
export type RunArrivedOutcome =
  | { outcome: 'linked' }
  | { outcome: 'unmatched'; reason: RunUnmatchedReason }

/** One entry in the vocabulary. `evaluates_triggers` is §124 Am. 1's ruling, as data. */
export interface RunEvent {
  name: RunEventName
  /** Does the trigger catalogue evaluate on this event? Ruled, not chosen (ARCH-ENG-022). */
  evaluates_triggers: boolean
  /** Why, in one line, traceable to the sitting that decided it. */
  ruling: string
}

export const RUN_EVENTS: readonly RunEvent[] = [
  {
    name: 'run_arrived',
    evaluates_triggers: false,
    ruling: '§124 Am. 1 — the evaluation event is run_analysed, never raw ingest. Raised for every run that lands, carrying its match outcome, so an unmatched run is visible to the catalogue, to L1 validity and to the runner (RUN-UNMATCHED-PROMPT-01).',
  },
  {
    name: 'run_logged',
    evaluates_triggers: true,
    ruling: '§124 Am. 1 — UNCHANGED. The evaluation event for a runner with no analysis (free tier, or a manual log), for the activity-log triggers only.',
  },
  {
    name: 'run_analysed',
    evaluates_triggers: true,
    ruling: '§124 Am. 1 — added at that sitting\'s request: the catalogue needs an event for an analysed run.',
  },
] as const

/** The events a trigger may evaluate on. 4b\'s catalogue reads this; a trigger naming any other event is a defect. */
export const TRIGGER_EVALUATION_EVENTS: readonly RunEventName[] =
  RUN_EVENTS.filter(e => e.evaluates_triggers).map(e => e.name)

/** Every reason an arrival may be unmatched, from the owner. Exported so a consumer need not import both. */
export const RUN_UNMATCHED_REASON_KEYS = Object.keys(RUN_UNMATCHED_REASONS) as RunUnmatchedReason[]
