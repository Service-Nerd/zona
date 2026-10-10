/**
 * `BASEBUILD-HANDOVER-01` — THE BLOCK ENDS, AND SOMETHING HAS TO SAY SO.
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────
 * A base-build plan is finite. It ends, and until now **nothing noticed**. The only
 * route to the race plan it was building toward is the wizard, **which archives the
 * block the runner just completed.** Measured 2026-10-10 on the two live plans:
 *
 *     Sheena  5 → 18.9 km/wk   block ends 2027-01-18   race 2027-04-24 (13 wks)
 *     Tom    10 → 37.9 km/wk   block ends 2027-01-25   race 2027-04-24 (12 wks)
 *
 * 🔴 **AND THE ITEM WAS FILED ON A PREMISE THAT INVERTS.** It said both plans carry
 * `base_build_onramp: true` and called it *"a producer with no consumer"*. **The marker
 * is `undefined` on both** — `generateGetRunningPlan` deletes it on purpose, because
 * *"this plan is not an on-ramp to anything, and leaving the flag on would let a
 * downstream reader infer a marathon handover that does not exist."* **The code was
 * honest. The gap was a product decision never taken**, which the SLT then took.
 *
 * ⚠️ SO THE TRIGGER IS NOT THE MARKER. It is the plan KIND plus the calendar, because
 * the marker deliberately says nothing and reading it would resurrect the false premise.
 *
 * ── WHY THIS IS A MODULE AND NOT A BRANCH IN `DashboardClient` ──────────────
 * 💼 **SLT 2026-10-10: this is MAINT-06's twin** — the race→maintenance transition
 * already ships this mechanism (a one-time card keyed off `plan_kind`, seen-state on the
 * plan's own meta), and ADR-013 §36 names `user generates next race` in the same
 * lifecycle it solved. **That is the "hazard solved for one transition, named but not
 * solved for its twin" class**, so the decision lives where it can be tested rather
 * than inside an 8,000-line client component.
 *
 * 🔴 **THE RISK THE SLT NAMED, AND IT IS IN THE MECHANISM WE ARE REUSING.**
 * `markMaintenanceTransitionSeen` writes through `savePlanForUser`, which archives on a
 * RACE-IDENTITY change (`race_name|race_date`). Writing a seen-flag is safe **only
 * because it changes neither.** A base-build variant that also touched `race_name` would
 * **archive the runner's block while announcing it.** `SEEN_FLAG` is therefore a meta key
 * and nothing else, and `handoverSeenPatch` is the only thing that writes it.
 */

import type { Plan, GeneratorInput } from '@/types/plan'
import { isBaseBuildPlan } from './validateStoredPlan'
import { isDatePastWeek } from './weekResolution'
import { raceLabelFor } from './raceLabel'
import { raceDistanceKey } from './generationConfig'

/** The seen-flag, mirroring `maintenance_transition_seen`. ⚠️ A meta key and nothing
 *  else: it must not touch `race_name` or `race_date` or the save archives the plan. */
export const SEEN_FLAG = 'base_build_handover_seen' as const

export type HandoverState =
  /** Not a base-build plan, or the block is still running. */
  | { show: false; reason: 'not_base_build' | 'block_running' | 'already_seen' | 'no_input' }
  /** The block is done and we can offer the race plan it was building toward. */
  | { show: true; input: GeneratorInput; raceName: string; weeksToRace: number | null }

/**
 * Has the block finished, and can we offer what comes next?
 *
 * ⚠️ `now` IS INJECTED. A date read from the clock inside a predicate is a test that
 * passes until a Tuesday, and this repo's parity grid exists because wall-clock fields
 * made a diff report every plan as changed.
 */
export function handoverState(plan: Plan | null | undefined, now: Date): HandoverState {
  if (!isBaseBuildPlan(plan) || !plan) return { show: false, reason: 'not_base_build' }
  const meta = plan.meta as unknown as Record<string, unknown>
  if (meta[SEEN_FLAG]) return { show: false, reason: 'already_seen' }

  const last = plan.weeks?.[plan.weeks.length - 1]
  if (!last || !isDatePastWeek(last, now)) return { show: false, reason: 'block_running' }

  // 🔴 THE OFFER REQUIRES THE STORED INPUT, AND THAT IS NOT A FORMALITY.
  // `BASEBUILD-GENINPUT-REMEDIATION-01` stamped these two plans on 2026-10-10; before
  // that there was nothing to regenerate from. A handover without it would have to
  // invent the race, which is the trap that whole item refused.
  const input = meta.generator_input as GeneratorInput | undefined
  if (!input?.race_date || !input?.race_distance_km) return { show: false, reason: 'no_input' }

  return {
    show: true,
    input,
    raceName: handoverRaceName(input),
    weeksToRace: weeksBetween(now, input.race_date),
  }
}

/**
 * 🔴 WHAT WE CALL THE RACE, AND THE RUNNER'S OWN NAME FOR IT IS GONE.
 *
 * `generateBaseBuildPlan` overwrites `meta.race_name` with **"Base building"** before
 * anything persists, and `BASEBUILD-GENINPUT-REMEDIATION-01` stamped the input FROM that
 * meta. **Measured 2026-10-10: `generator_input.race_name === "Base building"` on both
 * live plans, and the refusal telemetry records no `race_name` at all** — so unlike the
 * race DATE, this one is not recoverable from anywhere.
 *
 * ⚠️ SO THE HANDOVER MUST NOT PASS IT THROUGH. A race plan called "Base building" is
 * wrong on the Plan screen, in the countdown and in every notification, and it would be
 * the app contradicting itself at the moment it hands over.
 *
 * We name it by the one thing we DO know, through the single owner of that noun
 * (`raceLabel.ts`, REFUSAL-COPY-02). A runner who typed "London Marathon" sees
 * "Marathon", which is a LOSS and not a lie. Inventing a name, or keeping "Base
 * building", would be both.
 */
export function handoverRaceName(input: GeneratorInput): string {
  const stated = input.race_name
  if (stated && stated !== 'Base building') return stated
  const label = raceLabelFor(raceDistanceKey(input.race_distance_km))
  // Title case for a plan NAME, where `raceLabel` is article-ready lower case for prose.
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Whole weeks from `now` to the race, or null when the date is unusable. */
export function weeksBetween(now: Date, raceDate: string): number | null {
  const t = Date.parse(`${raceDate}T00:00:00Z`)
  if (!Number.isFinite(t)) return null
  const d = new Date(now); d.setHours(0, 0, 0, 0)
  return Math.floor((t - d.getTime()) / 6048e5)
}

/**
 * The input the race plan is generated from.
 *
 * ⚠️ `current_weekly_km` BECOMES WHAT THE BLOCK DELIVERED, NOT WHAT THE RUNNER TYPED
 * FIFTEEN WEEKS AGO. Tom typed 10 and finishes at 37.9. Regenerating from 10 would
 * refuse him under §111 for a base he no longer has, and would be **the engine ignoring
 * the work it prescribed.** The block's own `base_build_target_km` is that figure, read
 * from the plan rather than recomputed.
 *
 * ⚠️ `plan_start` IS NOT SET HERE AND THAT IS NOT AN OMISSION. It is not a
 * `GeneratorInput` field at all — `generateRulePlan` takes it as its third ARGUMENT, and
 * `tsc` caught me adding it. The caller passes today as that argument.
 *
 * ⚠️ `longest_recent_run_km` IS DELIBERATELY LEFT AS STATED. The block's longest session
 * is knowable, but whether the runner RAN it is not: completions are a separate table and
 * a handover that assumes compliance would hand a §113 pass to someone who skipped the
 * long runs. The stated value is stale and honest; an assumed one is fresh and invented.
 */
export function handoverInput(plan: Plan, input: GeneratorInput): GeneratorInput {
  const meta = plan.meta as unknown as Record<string, unknown>
  const delivered = Number(meta.base_build_target_km ?? 0)
  return {
    ...input,
    race_name: handoverRaceName(input),
    ...(delivered > 0 ? { current_weekly_km: delivered } : {}),
  }
}

/** The only writer of the seen-flag. Returns a meta patch, never a saved plan, so the
 *  caller owns the write and the archive guard stays visible at the call site. */
export function handoverSeenPatch(): Record<string, true> {
  return { [SEEN_FLAG]: true }
}
