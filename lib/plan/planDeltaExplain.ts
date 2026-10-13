import type { Plan } from '@/types/plan'

/**
 * THE SINGLE OWNER of "why did the plan's totals move".
 *
 * Design Board amendment 3 (`MODIFY-CONFIRM-DIFF-01`, 2026-10-13). 🎓 Sierra:
 * *"'In total 373km → 221km' tells the runner a number. It does not tell them
 * the only thing that matters: is that good or bad for me? A 41% cut reads as
 * loss."* The engine knows why the totals moved; the confirm screen did not say.
 *
 * ⚠️ **FACTUAL ONLY — NEVER A CLAIM ABOUT TRAINING EFFECT.** The board routed
 * this to the Coaching Board *if* the sentence makes a physiology claim (the W-03
 * precedent: a marketing section was a coaching question). So this states
 * ARITHMETIC the runner can verify on the same screen — fewer weeks hold less
 * running — and never asserts that the result is good, safe, enough, or that it
 * will make them faster. Those sentences belong to the Coaching Board and none
 * of them is written here.
 *
 * Returns `null` when there is nothing honest to say, which is the common case
 * for a small edit. A sentence that fires on every change is noise.
 */
export function explainPlanDelta(
  before: { weeks: number; peak: number; total: number },
  after:  { weeks: number; peak: number; total: number },
): string | null {
  const weeksMoved = after.weeks !== before.weeks
  if (!weeksMoved) return null

  const shorter = after.weeks < before.weeks
  const dWeeks = Math.abs(after.weeks - before.weeks)
  const weekWord = dWeeks === 1 ? 'week' : 'weeks'

  // Is the PEAK roughly held while the TOTAL moves? That is the whole point of
  // the sentence: the big scary number moved because the block got shorter, not
  // because the training got easier. 5% is the band within which a peak reads as
  // "about the same" to a runner looking at two rounded figures.
  const peakHeld = before.peak > 0 && Math.abs(after.peak - before.peak) / before.peak <= 0.05

  if (shorter && peakHeld) {
    return `${dWeeks} fewer ${weekWord} of training, so there is less in total. Your biggest week is about the same.`
  }
  if (shorter) {
    return `${dWeeks} fewer ${weekWord} of training, so there is less in total.`
  }
  if (peakHeld) {
    return `${dWeeks} more ${weekWord} of training, so there is more in total. Your biggest week is about the same.`
  }
  return `${dWeeks} more ${weekWord} of training, so there is more in total.`
}

/** Convenience for callers holding whole plans rather than summaries. */
export function explainPlanDeltaFor(
  before: Plan, after: Plan,
  summarise: (p: Plan) => { weeks: number; peak: number; total: number },
): string | null {
  return explainPlanDelta(summarise(before), summarise(after))
}
