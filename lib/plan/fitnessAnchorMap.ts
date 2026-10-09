import type { PaceGuide } from './paceBands'
import type { PaceAnchorMap } from './resolveMainSet'

/**
 * THE ANCHORS THAT MOVE WITH FITNESS — the single owner of "what band does this
 * anchor mean for a runner at this pace guide?"
 *
 * ⚠️ DELIBERATELY NOT THE WHOLE MAP. Generation layers three goal-aware
 * overrides on top of this base and they must stay there:
 *
 *   · `T`    — §22 substitutes the goal band on a goal-pace week
 *   · `HM`   — §120 makes it "the pace of the race you are training for" on a
 *              time-target plan, resolved through `resolveAnchorPace`
 *   · `goal` — exists only for a time target
 *
 * **None of those three move when a benchmark moves**, which is the whole
 * reason the split is here rather than in one function: a runner's race goal is
 * not a function of their fitness, so a recalibration re-prices THIS map and
 * must leave the overrides exactly where they were. Folding them in would make
 * a recalibration silently re-aim a goal-paced session at the runner's new
 * threshold, which is §22's override undone — the same class of defect as the
 * header one this work exists to fix.
 */
export function fitnessAnchorMap(pace: PaceGuide): PaceAnchorMap {
  return {
    E:  pace.easyPaceStr,
    T:  pace.qualityPaceStr,
    // §85 — CV is never substituted by §22. The "over" of an over-under is
    // defined against the runner's own threshold, not their race goal.
    CV: pace.cvPaceStr,
    I:  pace.intervalPaceStr,
    ...(pace.marathonPaceStr ? { M: pace.marathonPaceStr } : {}),
    ...(pace.hmPaceStr ? { HM: pace.hmPaceStr } : {}),
  }
}
