// RESHAPE-MOMENT-01 (Design Board, 2026-10-08) — the eight signals, in the runner's words.
//
// 🔴 WHY A CONSTANT AND NOT COPY IN A COMPONENT. `planAdjustment.ts` carried this instruction
// for months:
//
//     SYNC RULE: keep in step with TriggerType in lib/coaching/planAdjustment.ts.
//     If you add or remove a trigger type, update this copy in the same commit.
//
// **A sync rule enforced by a comment is this repo's most-recorded failure shape.** It was
// also already broken: the union declared ELEVEN members, one (`'manual'`) could never fire
// and two are the runner telling us rather than us noticing, so the disclosure described a
// taxonomy the engine did not have. The record is keyed by `DetectedTrigger` and
// `watchedSignals.test.ts` fails the build when a new trigger has no description, so the
// two can no longer drift.
//
// ⚠️ VOICE CONSTRAINTS, EACH FROM A RULING RATHER THAN TASTE.
//   · ⚕️ Sims' clause (§124, mandatory): a decline detector may say what it MEASURED and
//     what it CHANGED, never a CAUSE. None of these sentences explains why a number moved.
//   · 🎓 Sierra (Design Board): no promises. These describe what is LOOKED AT, not what is
//     caught or guaranteed — the "commitments block" was killed under W-03 for being a
//     promise where evidence was wanted, and 7 of the 8 have never fired in production.
//   · `brand.md`: no em dash in a sentence the runner reads. No motivational register.
//   · 💼 SLT ("a settings screen that merchandises", unanimous): no tier language, no CTA.
//     This is Me doing its own job legibly, not Me doing a conversion job.
import type { TriggerType } from './planAdjustment'
import { DETECTED_TRIGGER_TYPES } from './planAdjustment'
// 🔴 EVERY FIGURE BELOW IS DERIVED FROM THE RATIFIED CONSTANT, never typed. If the Coaching
// Board moves a threshold, this screen moves with it; if someone types a number here instead,
// `watchedSignals.test.ts` fails. That is the difference between quoting the engine and
// describing it from memory.
import {
  ZONE_DRIFT_ABOVE_CEILING_PCT, LOAD_RATIO, SHADOW_LOAD_THRESHOLD_PCT,
  FATIGUE_ACCUMULATION_THRESHOLD, EF_DECLINE_THRESHOLD_PCT, EF_BASELINE_WINDOW,
  FITNESS_SIGNAL_SESSION_THRESHOLD, LONG_RUN_SHORTFALL_COMPLETION_PCT, READINESS,
} from './constants'

/** The subset the product can honestly say it WATCHES: the union minus the two the runner
 *  initiates. Derived, so the count on any surface is 8 because the code says 8. */
export type DetectedTrigger = Exclude<TriggerType, 'skip_with_reason' | 'session_reorder'>

export type SignalHorizon = 'before' | 'week' | 'block'

export interface WatchedSignal {
  /** Which horizon this signal belongs to. ✋ Silvanto's hierarchy-of-horizon, made
   *  structural rather than implied by list order. */
  horizon: SignalHorizon
  /**
   * 🔴 THE THRESHOLD, AS THE RUNNER WOULD READ IT, AND **DERIVED FROM THE RATIFIED
   * CONSTANT** rather than typed.
   *
   * This is the element the first version of this block was missing entirely, and its
   * absence was the whole craft failure: `ui-patterns.md` § Metric Pair is *"large numbers,
   * small muted labels underneath; value always dominates"*, and eight rows of prose have no
   * value at all. The founder's verdict on it was *"boring and just a list of words"*, which
   * is what the house style predicts a valueless list will feel like.
   *
   * ⚠️ These numbers are quotable **only because the Coaching Board ratified them on
   * 2026-10-08** (§2 Am.5, §124, §109 Am.1) and the pre-existing ones carry principles of
   * their own. Before that they were undocumented magic numbers and putting them on a screen
   * would have been asserting precision nobody had defended.
   */
  figure: string
  /** What the figure is a threshold ON. Reads as the continuation of the figure. */
  label:  string
  /** One line of context. A sentence, so it takes a full stop. */
  detail: string
}

/** The three horizons, nearest first, with the words the runner sees. */
export const HORIZONS: ReadonlyArray<{ key: SignalHorizon; label: string }> = [
  { key: 'before', label: 'Before a hard session' },
  { key: 'week',   label: 'Across the week' },
  { key: 'block',  label: 'Over the block' },
]

export const WATCHED_SIGNALS: Record<DetectedTrigger, WatchedSignal> = {
  readiness_signal: {
    horizon: 'before',
    figure: `+${READINESS.RHR_ELEVATION_BPM} bpm`,
    label:  'resting heart rate over your baseline',
    detail: `Your own ${READINESS.BASELINE_WINDOW_DAYS} day baseline, checked before the session rather than after it.`,
  },
  zone_drift: {
    horizon: 'week',
    figure: `${ZONE_DRIFT_ABOVE_CEILING_PCT}%`,
    label:  'of an easy run above its zone ceiling',
    detail: 'The grey middle, measured on the run you actually did.',
  },
  acute_chronic_high: {
    horizon: 'week',
    figure: `${LOAD_RATIO.flag}\u00d7`,
    label:  'this week against your recent weeks',
    detail: 'Two weeks running at that ratio, not one.',
  },
  shadow_load: {
    horizon: 'week',
    figure: `${SHADOW_LOAD_THRESHOLD_PCT}%`,
    label:  'more running than the plan asked for',
    detail: 'Your own extra miles still count toward the load.',
  },
  fatigue_accumulation: {
    horizon: 'week',
    figure: `${FATIGUE_ACCUMULATION_THRESHOLD} in a row`,
    label:  'sessions you called heavy or wrecked',
    detail: 'What you said about them, not what the watch said.',
  },
  ef_decline: {
    horizon: 'block',
    // − is U+2212 MINUS SIGN, not a hyphen. The constant is -8 and a hyphen-minus in
    // display type reads as punctuation at 20px. Built from the absolute value so the sign
    // is a typographic choice and the number still comes from the constant.
    figure: `\u2212${Math.abs(EF_DECLINE_THRESHOLD_PCT)}%`,
    label:  'aerobic efficiency against your recent runs',
    detail: `The same pace starting to cost more heart rate, over your last ${EF_BASELINE_WINDOW} runs.`,
  },
  fitness_signal: {
    horizon: 'block',
    figure: `${FITNESS_SIGNAL_SESSION_THRESHOLD} sessions`,
    label:  'quality work ahead of its target band',
    detail: 'With the heart rate still controlled, which is the part that matters.',
  },
  long_run_shortfall: {
    horizon: 'block',
    figure: `${Math.round(LONG_RUN_SHORTFALL_COMPLETION_PCT * 100)}%`,
    label:  'of a long run, twice in a row',
    detail: 'Short of the distance prescribed, two consecutive weeks.',
  },
}

/**
 * The signals in the order the runner reads them, nearest-horizon first.
 *
 * ✋ Silvanto's hierarchy-of-horizon rule. Readiness is checked before this morning's
 * session; efficiency decline is a trend over six runs. Alphabetical or declaration order
 * would make the runner do that sorting, which is the defect this ruling exists to fix.
 */
export const WATCHED_SIGNAL_ORDER: readonly DetectedTrigger[] = [
  'readiness_signal',
  'zone_drift',
  'acute_chronic_high',
  'shadow_load',
  'fatigue_accumulation',
  'ef_decline',
  'fitness_signal',
  'long_run_shortfall',
]

/** Every detected trigger, described, in reading order. The only accessor surfaces should use. */
export function watchedSignals(): ReadonlyArray<WatchedSignal & { type: DetectedTrigger }> {
  return WATCHED_SIGNAL_ORDER.map(t => ({ type: t, ...WATCHED_SIGNALS[t] }))
}

/** Grouped by horizon, in reading order, empty groups dropped. */
export function watchedSignalsByHorizon(): ReadonlyArray<{
  key: SignalHorizon; label: string; signals: ReadonlyArray<WatchedSignal & { type: DetectedTrigger }>
}> {
  return HORIZONS
    .map(h => ({ ...h, signals: watchedSignals().filter(s => s.horizon === h.key) }))
    .filter(g => g.signals.length > 0)
}

/** The count, DERIVED. Never type `8` on a surface. */
export const WATCHED_SIGNAL_COUNT = DETECTED_TRIGGER_TYPES.length
