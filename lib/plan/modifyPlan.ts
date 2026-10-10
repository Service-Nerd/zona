import type { GeneratorInput, Plan } from '@/types/plan'
import { isRaceIdentityChange } from './supersede'
// ⚠️ THE KIND PREDICATE IS NOT RE-WRITTEN HERE. `isBaseBuildPlan` is its single
// owner (`validateStoredPlan.ts`), which exists so two policies cannot disagree
// about what a base-build plan IS — the `deloadCadence` / `TIER-OWNER-01` lesson.
// Costs nothing: `lib/plan.ts` already pulls that module into the dashboard graph.
import { isBaseBuildPlan } from './validateStoredPlan'

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
 * offering an edit it cannot honour. The October charity cohort is unaffected
 * because their plans will all be new.
 *
 * 🔴 THIS COMMENT USED TO END "every plan generated from today carries the
 * stamp, so this shrinks on its own". True when written, and FALSE from the
 * moment §118 shipped a second producer: `generateBaseBuildPlan` did not stamp
 * it, so every base-build runner silently lost this sheet. Measured 2026-10-09:
 * 9 of 34 stored plans unstamped, of which **2 were base-build plans created
 * after the field existed** — one of them 29 minutes after that day's deploy.
 * Fixed in BASEBUILD-GENINPUT-01 and now held by `generatorInputStamp.test.ts`,
 * which derives the producer set from source rather than trusting a sentence.
 * ⚠️ A claim about ALL producers, parked in a comment next to ONE of them, is a
 * claim nobody re-checks when the second one arrives.
 */
export function canModifyPlan(plan: Plan | null | undefined): boolean {
  // 🔴 A BASE-BUILD PLAN IS NOT A RACE PLAN, AND THIS SHEET REGENERATES A RACE
  // PLAN. `BASEBUILD-ADJUST-DOOR-01`, 2026-10-10.
  //
  // The predicate above asks "do we hold the input?" The row it gates asks "can
  // this plan be modified?", and for `plan_kind: 'base_build'` the answer is no
  // for a reason the stamp cannot fix: `runModifyPreview` POSTs the overlaid
  // input to `/api/generate-plan`, which is the RACE generator. A base-build
  // runner is on that plan *because* the race generator refused them (§111's
  // base-volume door, §113's long-run floor), and none of the eight editable
  // keys is the one that was refused — `current_weekly_km` is deliberately not
  // modifiable.
  //
  // ⚠️ MEASURED on the two live base-build plans, every offered edit walked
  // (`BASEBUILD-GENINPUT-REMEDIATION-01`'s dry run):
  //
  //     Sheena  0 of 27 edits produce a plan
  //     Tom     2 of 27 — `max_weekday_mins: 30` (a TIGHTER cap) and
  //             `injury_history: ['knee']` (an injury she/he does not have)
  //
  // Both of Tom's work for the same wrong reason: §111 refuses on delivered peak
  // ÷ current volume, so anything that SHRINKS the plan clears the gate. **The
  // honest answer is refused and the self-constraining one is admitted** — the
  // §113 `longest > 0` inversion again, one axis over. §111's monotonicity
  // guarantee is proven over `current_weekly_km` only (`baseVolume.test.ts`);
  // the constraint axes were never monotonic and the Adjust sheet turned two of
  // them into runner-facing controls. Filed for the Coaching Board as
  // `BASEBUILD-ADJUST-MONOTONIC-01` — proposed, not built, per the standing rule
  // that coaching logic needs sign-off.
  //
  // So the row is withheld for the SAME reason the doc comment above gives for
  // withholding it from a legacy plan: we do not offer an edit we cannot honour.
  // This is not the design question "what SHOULD a base-build runner be able to
  // change?" — that needs a surface that regenerates the base build rather than
  // a race, and it is filed with the handover item (`BASEBUILD-HANDOVER-01`).
  //
  // ⚠️ REGRESSES NOTHING. Measured 2026-10-10: 2 base-build plans in the fleet,
  // **both unstamped**, so no runner has ever been offered this row. Without this
  // line the remediation backfill would have been the thing that first offered it.
  // 🧭 `BASEBUILD-ADJUST-REBUILD-01` (Design Board, SHIP WITH AMENDMENT, 2026-10-10)
  // SUPERSEDES THE INTERIM ABOVE. A base-build plan IS modifiable now, because the
  // sheet rebuilds the base build instead of a race plan — but it offers only the keys
  // that change the output of the producer it actually calls.
  //
  // 📐 Measured against `generateBaseBuildPlan` on both live plans:
  // `days_cannot_train` changes the plan 2/2, `days_available` 1/2, **the other six do
  // NOTHING.** Six rows that cannot move the output would be the door defect one layer
  // along, against this board's own standard (*"a control with a measured 0% success
  // rate is not a capability, it is an affordance"*).
  if (isBaseBuildPlan(plan)) return !!plan?.meta?.generator_input
  return !!plan?.meta?.generator_input
}

/**
 * Which rows this plan kind may offer.
 *
 * 🔴 DERIVED FROM A DECLARED PER-KIND SET, NOT A HAND-WRITTEN LIST AT THE CALL SITE,
 * and the Design Board made that binding: *"withholding must be MECHANICAL, so a key
 * that becomes effective later is a DECISION and not an oversight."* A hand-typed list
 * in the component is this repo's most-recorded gate failure (`const HOME`,
 * `CONSUMERS`, the six-file `appScreenTitle` list).
 *
 * ⚠️ `preferred_long_run_day` IS WITHHELD AND IT IS THE INTERESTING ONE. A base-build
 * block carries **0 long runs (one live plan) and 1 in 15 weeks (the other)**, and the
 * key is inert across **6 genuinely available alternative days** on both. There is
 * almost nothing to place. 🎓 Sierra WITHDREW her door-sitting dissent on exactly that
 * measurement rather than being overruled. Whether a 15-week block SHOULD carry more
 * long runs is routed to the Coaching Board, not decided here.
 */
export const MODIFIABLE_KEYS_BY_PLAN_KIND: Readonly<Record<'base_build', readonly ModifiableKey[]>> = {
  base_build: ['days_available', 'days_cannot_train'],
}

/** The rows to render for this plan. Every other kind gets the full set. */
export function modifiableRowsFor(plan: Plan | null | undefined): readonly ModifiableRow[] {
  if (!isBaseBuildPlan(plan)) return MODIFIABLE_ROWS
  const allowed = MODIFIABLE_KEYS_BY_PLAN_KIND.base_build
  return MODIFIABLE_ROWS.filter(r => allowed.includes(r.key))
}

/** Does this plan rebuild its OWN kind rather than a race plan?
 *  One predicate, so the sheet and the request body cannot disagree. */
export function rebuildsBaseBuild(plan: Plan | null | undefined): boolean {
  return isBaseBuildPlan(plan)
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

/**
 * The two day controls, reconciled — or `null` when they agree.
 *
 * 🔴 SHEET-DAY-QUESTION-01 (Design Board, SHIP scoped). `GeneratePlanScreen`
 * derives BOTH `days_available` and `days_cannot_train` from a single `WeekGrid`,
 * so in the wizard **they cannot contradict.** `ModifyPlanSheet` asks them as two
 * independent controls — a `SegmentedControl` (2–6) and an uncapped 7-cell
 * `DayGridSelector` — so **two taps state a contradiction and the sheet says
 * nothing.** 🎪 Collins: *"one question rendered as two controls is the taxonomy
 * defect — the wizard proves it, because there it's one grid."*
 * 📱 Wroblewski: *"the error path wasn't designed, it was inherited."*
 *
 * ⚠️ THE BOARD RULED OUT A CAP, EXPLICITLY. Blocking six days is a legitimate
 * statement — *"I can run once a week"* — so the grid is not clamped. The defect
 * is that the OTHER control then disagrees in silence.
 *
 * 🔴 AND THIS DELIBERATELY SAYS NOTHING ABOUT WHAT THE PLAN WILL DO.
 * `DAYS-GATE-CAPACITY-01` establishes that `validateDaysAvailable` reads
 * `input.days_available` and **never mentions `days_cannot_train`** — so the
 * engine acts on the number the runner TYPED, not the number they can achieve.
 * A line reading *"the plan will use 2 days"* would therefore be **false today**,
 * and hard rule 7 applies: a subtitle describing a consequence the engine does
 * not produce is a claim. This restates the runner's own two inputs and stops
 * there. The engine half is the 🏃 Coaching Board's.
 *
 * Returns `null` when there is nothing to say — the declared count is achievable,
 * so a line would be noise on a sheet whose whole design is restraint.
 */
export function dayConflict(
  daysAvailable: number | null | undefined,
  daysCannotTrain: readonly string[] | null | undefined,
): { declared: number; blocked: number; clear: number } | null {
  const declared = typeof daysAvailable === 'number' ? daysAvailable : null
  if (declared === null) return null
  // Deduplicated: a repeated day in the stored array is one blocked day, and
  // counting it twice would invent a conflict that the runner cannot see.
  const blocked = new Set((daysCannotTrain ?? []).filter(d => typeof d === 'string')).size
  const clear = Math.max(0, 7 - blocked)
  return clear < declared ? { declared, blocked, clear } : null
}
