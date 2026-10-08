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

/** The subset the product can honestly say it WATCHES: the union minus the two the runner
 *  initiates. Derived, so the count on any surface is 8 because the code says 8. */
export type DetectedTrigger = Exclude<TriggerType, 'skip_with_reason' | 'session_reorder'>

export interface WatchedSignal {
  /** The short name. Sentence case, no trailing full stop: it is a label, not a sentence. */
  label:  string
  /** One line on what is actually measured. A sentence, so it gets a full stop. */
  detail: string
}

export const WATCHED_SIGNALS: Record<DetectedTrigger, WatchedSignal> = {
  readiness_signal: {
    label:  'Resting heart rate, HRV and sleep',
    detail: 'Checked before a hard session, not after it.',
  },
  zone_drift: {
    label:  'Easy runs creeping hard',
    detail: 'How much of your easy running sat above its zone ceiling.',
  },
  acute_chronic_high: {
    label:  'This week against your recent weeks',
    detail: 'A sharp jump compared with the last four.',
  },
  shadow_load: {
    label:  'Running the plan did not ask for',
    detail: 'Your own extra miles still count toward the load.',
  },
  fatigue_accumulation: {
    label:  'How you said it felt',
    detail: 'Heavy or wrecked, session after session.',
  },
  ef_decline: {
    label:  'Aerobic efficiency over time',
    detail: 'The same pace starting to cost more heart rate.',
  },
  fitness_signal: {
    label:  'Quality sessions getting easier',
    detail: 'Faster than the target band with heart rate still controlled.',
  },
  long_run_shortfall: {
    label:  'Long runs falling short',
    detail: 'Two in a row under the distance prescribed.',
  },
}

/**
 * The signals in the order the runner reads them, nearest-horizon first.
 *
 * ✋ Silvanto's hierarchy-of-horizon rule, applied: today's decision before the eight-week
 * arc. Readiness is checked before this morning's session; efficiency decline is a trend
 * over six runs. Alphabetical or declaration order would make the runner do that sorting,
 * which is the defect this ruling exists to fix.
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

/** The count, DERIVED. Never type `8` on a surface. */
export const WATCHED_SIGNAL_COUNT = DETECTED_TRIGGER_TYPES.length
