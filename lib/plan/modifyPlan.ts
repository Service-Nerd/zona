import type { GeneratorInput, Plan } from '@/types/plan'
import { isRaceIdentityChange } from './supersede'

/**
 * P-02 — what a runner may change about a live plan, and what changing it does.
 *
 * THE PROBLEM THIS EXISTS FOR. There was no surface on which a runner could
 * change a plan parameter. `ReshapeScreen` renders whatever `/api/adjust-plan`
 * proposes; `MeScreen → "Your training"` is four rows, two of them display
 * preferences. **The only way to change days available, weekday cap, race
 * date, long-run day, injuries or terrain was to re-run the fourteen-screen
 * wizard, which archives the existing plan.** A runner whose life changes
 * either starts over or carries a plan that is now wrong, and the second is
 * the churn path.
 *
 * ⚠️ THE ROWS LIVE HERE, NOT IN THE COMPONENT. Each carries the consequence
 * subtitle the SLT's approved pattern requires (second person implied, present
 * tense, states the blast radius, no benefit claim). Copy in a component is
 * copy no test can see, and hard rule 7 applies to every one of these: a
 * subtitle describing a consequence the engine does not produce is a claim.
 *
 * ⚠️ NO INTENSITY RATIO. The Coaching Board VETOED it (2026-09-20): 80/20 is a
 * session-count observation (CD-19), so at four running days 80/20 vs 90/10 is
 * 0.8 vs 0.4 quality sessions and the control does not quantise — illusory at
 * the volumes most of our runners train at, consequential only at the top; and
 * dialling intensity UP is the injury vector, self-selecting for the runner
 * least likely to stop. `hard_session_relationship` is the governed expression
 * of the same preference (§110) and is what appears instead.
 */

/** The parameters a runner may edit. Every one already exists on GeneratorInput. */
export type ModifiableKey =
  | 'days_available'
  | 'days_cannot_train'
  | 'preferred_long_run_day'
  | 'max_weekday_mins'
  | 'injury_history'
  | 'hard_session_relationship'
  | 'terrain'
  | 'race_date'

/**
 * Grouped by CONSEQUENCE, not by data type. That is the teardown's actual
 * idea: "your week" changes how the week is shaped, "your body" changes what
 * is prescribed into it, "the race" moves everything.
 */
export type ModifyGroup = 'week' | 'body' | 'race'

export interface ModifiableRow {
  key: ModifiableKey
  group: ModifyGroup
  label: string
  /** The consequence subtitle. SLT-approved pattern, 2026-09-20. */
  consequence: string
  /** Gated features. `undefined` means free. */
  gate?: 'dynamic_reshape_r20'
}

export const MODIFY_GROUP_LABELS: Record<ModifyGroup, string> = {
  week: 'Your week',
  body: 'Your body',
  race: 'The race',
}

/**
 * ⚠️ EVERY CONSEQUENCE IS CHECKED AGAINST THE ENGINE, not written to sound
 * right. "Shift the whole plan forward or back" must be what actually happens.
 * Where a claim could not be verified it is not made: none of these promises a
 * session will be kept, because the regeneration decides that.
 */
export const MODIFIABLE_ROWS: readonly ModifiableRow[] = [
  {
    key: 'days_available', group: 'week', label: 'Days a week',
    consequence: 'Rebuilds the week around the days you have.',
  },
  {
    key: 'days_cannot_train', group: 'week', label: 'Days you cannot run',
    consequence: 'Moves sessions off those days for the rest of the plan.',
  },
  {
    key: 'preferred_long_run_day', group: 'week', label: 'Long run day',
    consequence: 'Anchors your weekly long run, and the week rebuilds around it.',
  },
  {
    key: 'max_weekday_mins', group: 'week', label: 'Weekday time limit',
    consequence: 'Caps how long a weekday session can be. Long runs are exempt.',
  },
  {
    key: 'injury_history', group: 'body', label: 'Injury history',
    consequence: 'Caps how fast volume climbs and removes the sessions that aggravate it.',
  },
  {
    key: 'hard_session_relationship', group: 'body', label: 'Hard sessions',
    consequence: 'Changes how much quality work the plan gives you, within the safe range.',
  },
  {
    key: 'terrain', group: 'body', label: 'Terrain',
    consequence: 'Changes the sessions the plan picks, not how much you run.',
  },
  {
    key: 'race_date', group: 'race', label: 'Race date',
    consequence: 'Shifts the whole plan forward or back, and resets your logged weeks.',
  },
] as const

/** A sparse overlay onto the stored input. NOT a second copy of GeneratorInput (D-16). */
export type PlanEdits = Partial<Pick<GeneratorInput, ModifiableKey>>

/**
 * Can this plan be modified at all?
 *
 * ⚠️ GATED ON THE STORED INPUT, AND THAT EXCLUDES REAL RUNNERS TODAY.
 * Regeneration needs the input the plan was built from. Generated plans stamp
 * `meta.generator_input`; **legacy plans predate it**. Measured against
 * production 2026-09-20: **10 of 22 live plans (45%) have none.**
 *
 * Those runners cannot be served by guessing the original answers — a
 * regeneration from invented inputs changes things the runner never asked to
 * change, silently. So the sheet is unavailable and says why, rather than
 * offering an edit it cannot honour. Every plan generated from today carries
 * the stamp, so this shrinks on its own; the October charity cohort is
 * unaffected because their plans will all be new.
 */
export function canModifyPlan(plan: Plan | null | undefined): boolean {
  return !!plan?.meta?.generator_input
}

/** Apply the overlay. Returns a new input; never mutates the stored one. */
export function applyEdits(base: GeneratorInput, edits: PlanEdits): GeneratorInput {
  return { ...base, ...edits }
}

/** Only the keys whose value actually differs from the stored plan. */
export function pendingKeys(base: GeneratorInput, edits: PlanEdits): ModifiableKey[] {
  return (Object.keys(edits) as ModifiableKey[]).filter(k => !sameValue(base[k], edits[k]))
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    const sa = [...a].map(String).sort(), sb = [...b].map(String).sort()
    return sa.every((v, i) => v === sb[i])
  }
  return a === b
}

/**
 * Will applying these edits reset the runner's logged weeks?
 *
 * ⚠️ THIS IS THE FEATURE'S NAMED FAILURE MODE AND IT IS INHERITED, NOT
 * RE-IMPLEMENTED. `PLAN-WEEK-COLLISION-01` put a 94%-pre-completed plan in
 * front of a real runner because `week_n` is a within-plan coordinate that
 * seven tables used as a cross-plan key. `savePlanForUser` already supersedes
 * week-keyed rows, gated on `isRaceIdentityChange` (`race_name|race_date`).
 *
 * So this does not decide anything — it ASKS THE SAME OWNER, so the warning
 * the runner sees and the behaviour they get cannot disagree. Editing days,
 * cap, long-run day, injuries, hard sessions or terrain preserves completions
 * (same race, the history is theirs); editing the race date supersedes them,
 * because that is a different block.
 */
export function editsResetLoggedWeeks(plan: Plan, edits: PlanEdits): boolean {
  const base = plan.meta?.generator_input
  if (!base) return false
  const next = applyEdits(base, edits)
  return isRaceIdentityChange(
    { race_name: plan.meta?.race_name ?? null, race_date: base.race_date ?? null },
    { race_name: plan.meta?.race_name ?? null, race_date: next.race_date ?? null },
  )
}
