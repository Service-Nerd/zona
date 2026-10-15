// ENGINE-ENTRY-01 — the coaching engine's single entry point.
//
// 🎯 WHY THIS EXISTS. The founder intends to lift the engine out and host it
// centrally. Parts 1 and 3 of that are done: `ENGINE-PURITY-GATE-01` proved and
// now enforces that `lib/plan` and `lib/coaching` import no Next, no React, no
// app and no Supabase, and `docs/contracts/engine.md` wrote the interface down.
//
// 🔴 THE FINDING THAT MADE THIS NECESSARY: the ROUTE was the orchestrator, not the
// engine. `app/api/generate-plan/route.ts` imported **eighteen** engine modules and
// sequenced them itself, so extracting the engine would have made all eighteen
// public API surface — the sequencing lived on the caller's side.
//
// ⚠️ WHAT THIS DELIBERATELY DOES NOT TAKE, and the reasons are not stylistic:
//
//   - **auth and tier resolution** (ADR-003: the route is the auth boundary;
//     `lib/trial.ts → resolveTier` is the single owner). A hosted engine takes
//     `tier` from an authenticated caller and never looks a user up.
//   - **the distance paywall** (`canGenerateDistance`). It returns 403, not 422,
//     and emits its own `plan_distance_gate_blocked`. It is a COMMERCIAL gate: a
//     second consumer of a hosted engine would not apply Zonna's price list.
//   - **the AI layer** — `enrich` and `freeIntro` both call Anthropic. ADR-006
//     makes enrichment a silent, optional pass, and `docs/contracts/engine.md`
//     already assigns it to the caller.
//   - **persistence and telemetry** — the `waitUntil` chain, every
//     `recordOpsEvent`, the `plans` writes. `ENGINE-PURITY-GATE-01` exists to keep
//     them out.
//
// 🔑 SO THE HONEST COUNT IS 18 → 7, NOT 18 → 1. The item's acceptance criterion
// said one, and one contradicts the item's own constraints: five of the eighteen
// are the AI and persistence modules above, and `invariants` is split (its
// `enforceViolations` is synchronous and lives here; its `validatePlan` is used by
// the caller's enrichment chain, and is re-exported below so the caller still has
// exactly one engine door). Re-measured at pickup, symbol by symbol, rather than
// taken from the item.
//
// 🔴 A DESIGNED REFUSAL IS RETURNED FROM HERE, NOT THROWN. `generateRulePlan`
// throws it — that is the engine WORKING (§44, §52, §111, §113) — and the naive
// HTTP mapping of "threw" is 500. This function catches the four, maps each to the
// 422 the client already renders, and hands back the telemetry payload for the
// caller to record. A genuine fault is **re-thrown untouched** so the route's own
// 500 path still owns it. `docs/contracts/engine.md` § Output is the authority.
//
// ⚠️ NO `next/` IMPORTS, SO NO `NextResponse`. A refusal comes back as a plain
// `{ status, body }` and the route wraps it. That is what makes the refusal mapping
// testable for the first time: it used to be gated by GREPPING THE ROUTE'S SOURCE,
// because the logic was welded to a handler that needs auth and Supabase to run.

import { generateRulePlan, derivedLevelsFor, type Tier } from './ruleEngine'
import { composePlanWithFoundation, type ComposePlanWithFoundationResult } from './foundationCompose'
import { enforceViolations, type Violation } from './invariants'
import { nextMonday, formatDate, weeksBetweenLocal } from './length'
import { PrepTimeError, DaysAvailableError, InputFieldError } from './inputs'
import { isDesignedRefusal } from './designedRefusal'
import { effectiveStartKm } from './startVolume'
import { BaseVolumeError } from './baseVolume'
import { onRampOfferFor, assessOnRamp } from './baseBuildOnRamp'
import { generateGetRunningPlan, getRunningApplies } from './getRunningPlan'
import { baseBuildOfferLine, baseBuildOfferTitle, baseBuildOfferWhy } from './baseBuildCopy'
import { LongRunReadinessError } from './longRunReadiness'
import { formatDistance, type DistanceUnits } from '@/lib/format'
import type { GeneratorInput, Plan } from '@/types/plan'

/** Re-exported so the caller has ONE engine import for generate + validate. The
 *  enrichment chain legitimately re-validates a plan it modified (PV2-A), and a
 *  hosted engine would publish validation as part of its surface. */
export { validatePlan } from './invariants'

type GapClass = ComposePlanWithFoundationResult['gapClass']

/** An ops event the ENGINE computed and the CALLER records. The payload is the
 *  engine's own derivation (`derivedLevelsFor`, `effectiveStartKm`, `assessOnRamp`);
 *  writing it to a table is the caller's (ADR-003). Splitting it this way is what
 *  lets the engine stay free of the service-role client while still owning the
 *  thing only it can compute. */
export interface EngineTelemetry {
  event: 'plan_refused_by_design'
  detail: Record<string, unknown>
}

export type EngineOutcome =
  /** A race plan, composed and validated. */
  | {
      kind: 'plan'
      /** The plan to return or stream. Foundation weeks composed (ADR-020). */
      plan: Plan
      /**
       * The foundation-FREE plan, exposed deliberately and not as a leak.
       *
       * ⚠️ §57 keeps foundation-week copy away from the model, which ADR-020's own
       * blast-radius table confirms is correct BY DESIGN. So `enrich()` and
       * `generateFreeIntro()` must both receive THIS plan, while the revert ladder
       * needs `plan` above as its source of rule copy. The caller genuinely needs
       * both, and naming them is better than letting it guess.
       *
       * 🔴 DO NOT MUTATE IT AND READ `plan`. That was
       * `FOUNDATION-META-ALIAS-01` — for 30 days the route stamped
       * `rulePlan.meta.plan_intro` and returned the composed plan, which cost every
       * delayed-start free runner CA-01's intro entirely. `composePlanWithFoundation`
       * now always returns a fresh `meta`, so the two are never the same object.
       */
      rulePlan: Plan
      gapClass: GapClass
      /** Reused by the caller's enrichment baseline rather than re-validating the
       *  same plan a second time (ENRICH-ATTRIB-01). */
      composeViolations: Violation[]
    }
  /** §118 / P-15 — the runner asked for a base build and gets one. Its own plan
   *  object: no enrichment, no foundation composition, both shaped for a race block. */
  | { kind: 'base_build'; plan: Plan }
  /** A designed refusal, or an out-of-range input field. Always 422, never 500. */
  | {
      kind: 'refusal'
      status: 422
      body: Record<string, unknown>
      /** Null for `InputFieldError`, which the route has always answered WITHOUT
       *  recording an event — `isDesignedRefusal` is false for it, and that
       *  ordering is preserved rather than tidied. */
      telemetry: EngineTelemetry | null
    }

export interface EngineRequest {
  input: GeneratorInput
  tier: Tier
  /** Client intent about WHICH plan to build, read off the raw body by the caller.
   *  Deliberately not on `GeneratorInput`: it is not an attribute of the runner, and
   *  putting it there would leak a UI decision into every grid that sweeps those
   *  fields. */
  acceptBaseBuild?: boolean
  /** ADR-015 — the CALLER reads the runner's units and passes them in. The engine
   *  never looks up a preference; a distance string assembled without them is the
   *  units defect ADR-015 exists to prevent. */
  displayUnits: DistanceUnits
  /** Defaults to next Monday, exactly as the route derived it. Overridable so a
   *  test or a support reproduction can pin it. */
  planStart?: string
  /** Defaults to the wall clock. NOTE this does not make the engine deterministic:
   *  `applyVdotDiscount` reads the real clock when a benchmark is present, which is
   *  deliberate (`docs/contracts/engine.md` § The clock). */
  today?: string
}

/**
 * The synchronous engine path, end to end.
 *
 * Order is preserved EXACTLY as the route ran it, because several of these steps
 * are observable and one ordering was load-bearing: `InputFieldError` is answered
 * before any telemetry is computed, and the four designed refusals record their
 * event BEFORE the branch-specific response so a new refusal type cannot be added
 * without it (REFUSAL-TELEMETRY-01).
 *
 * Throws only on a GENUINE fault, which the caller must map to 500.
 */
export function runEngine(req: EngineRequest): EngineOutcome {
  const { input, tier, displayUnits } = req
  const planStart = req.planStart ?? formatDate(nextMonday())
  const today = req.today ?? formatDate(new Date())

  // 🔴 `accept_base_build` IS HONOURED BEFORE GENERATION, NOT INSIDE THE REFUSAL
  // CATCH, AND THE OLD PLACEMENT WAS UNSOUND (`BASEBUILD-ADJUST-REBUILD-01`).
  //
  // It used to live only inside `catch (err) { if (err instanceof BaseVolumeError) }`,
  // so "give me the base build" was honoured ONLY IF the race generator happened to
  // refuse this input. Fine for P-15's original flow and unsound for a runner who
  // already HAS a base-build plan and is editing it, because §111's refusal is not
  // stable under the edits the Adjust sheet offers. ⚠️ MEASURED on the two live
  // base-build plans: of 8 editable keys, ONE flips §111 from refusing to admitting
  // (Tom at `days_available: 3`) — which under the old placement would have silently
  // handed a base-build runner a RACE PLAN.
  //
  // So the intent is unconditional, guarded only by whether a base build is a thing
  // this runner can have at all.
  if (req.acceptBaseBuild && getRunningApplies(input)) {
    const { plan } = generateGetRunningPlan(
      input, planStart, weeksBetweenLocal(planStart, input.race_date),
    )
    return { kind: 'base_build', plan }
  }

  let rulePlan: Plan
  try {
    rulePlan = generateRulePlan(input, tier, planStart)
  } catch (err) {
    const refusal = mapRefusal(err, input, planStart, displayUnits)
    if (refusal) return refusal
    // Not a refusal: a genuine engine fault. The caller owns the 500.
    throw err
  }

  // ADR-020 Option A — `composePlanWithFoundation` is the SINGLE owner of
  // post-generation `plan.weeks` mutation. This entry point CALLS it; it must never
  // reimplement it, which would be the second orchestration path ADR-020 exists to
  // prevent. It re-validates unfiltered, so both tiers' checks see foundation weeks.
  const { plan, gapClass, violations } =
    composePlanWithFoundation(rulePlan, input, today, input.foundation_decision)
  enforceViolations(violations)
  plan.meta.foundation_gap_class = gapClass

  return { kind: 'plan', plan, rulePlan, gapClass, composeViolations: violations }
}

/**
 * Every designed refusal → the 422 the client already renders, plus the event the
 * caller should record. Returns null for anything that is NOT a refusal, so the
 * caller re-throws it.
 *
 * ⚠️ MATCHED BY TYPE AND BY `error.name`, NEVER BY MESSAGE. `isDesignedRefusal` is
 * the single owner of "was that throw the engine working?", and the messages are
 * runner-facing copy that changes — REFUSAL-COPY-02 recorded a tone rewrite
 * breaking four checks across three files.
 */
function mapRefusal(
  err: unknown,
  input: GeneratorInput,
  planStart: string,
  displayUnits: DistanceUnits,
): Extract<EngineOutcome, { kind: 'refusal' }> | null {
  // §55 — critical input validation. Answered FIRST and with NO telemetry, exactly
  // as the route did: `isDesignedRefusal` is false for this, so recording it here
  // would be a new event, not a refactor.
  if (err instanceof InputFieldError) {
    return {
      kind: 'refusal', status: 422, telemetry: null,
      body: { error: err.message, field: err.field, value: err.value, range: err.range },
    }
  }

  if (!isDesignedRefusal(err)) return null

  // REFUSAL-TELEMETRY-01 — computed for EVERY designed refusal at one site, so a new
  // refusal type cannot be added without it.
  const telemetry: EngineTelemetry = {
    event: 'plan_refused_by_design',
    detail: {
      rule: (err as Error).name,
      race_distance_km: input.race_distance_km,
      current_weekly_km: input.current_weekly_km,
      effective_start_km: Math.round(effectiveStartKm(input) * 10) / 10,
      longest_recent_run_km: input.longest_recent_run_km,
      days_available: input.days_available,
      // REFUSAL-TELEMETRY-LEVEL-01 — this used to be `input.fitness_level`, the
      // API-level STRUCTURAL override the wizard never sends, so 20 refusal events
      // carried no level at all. Both halves are recorded because they answer
      // different questions: what the runner SAID and what the engine ASSESSED, and
      // a refusal where they disagree is the interesting one. Via `derivedLevelsFor`,
      // the engine's own owner, so it cannot drift from what generation would use.
      ...(() => {
        const l = derivedLevelsFor(input)
        return {
          fitness_level_declared: l.declared ?? null,
          fitness_level_assessed: l.assessedStructural,
          fitness_level_structural: l.structural,
          fitness_level_intensity: l.intensity,
          fitness_level_api_override: input.fitness_level ?? null,
        }
      })(),
      training_age: input.training_age,
      goal: input.goal,
      // 🔴 `reason` distinguishes a hard refusal from a warning the runner could have
      // acknowledged. Without it, 12 of 20 PrepTimeError events were unusable for
      // exactly the question `PREP-ACK-NO-WRITER-01` needed answering.
      reason: (err as { reason?: unknown }).reason ?? null,
      weeks_to_race: input.race_date
        ? Math.round((new Date(input.race_date).getTime() - Date.now()) / 6048e5)
        : null,
      // §116 — WOULD an on-ramp have been offered, and how long?
      //
      // ⚠️ RECORDED EVEN WHEN THE FLAG IS OFF, deliberately: it is the only way the
      // 76%-offered figure gets checked against real runners instead of a synthetic
      // grid, and it must accrue BEFORE the flag flips or there is nothing to compare
      // against. Calls `assessOnRamp` directly rather than the flag-gated
      // `onRampOfferFor`, because the flag governs what the RUNNER sees, never what we
      // can measure.
      ...(err instanceof BaseVolumeError ? {
        onramp: assessOnRamp(input, err.base.min_base_km, weeksBetweenLocal(planStart, input.race_date)),
      } : {}),
    },
  }

  // §44 — prep time. Structured so the client can render the warning plus
  // alternatives and re-submit with `acknowledged_prep_warning: true`.
  if (err instanceof PrepTimeError) {
    return {
      kind: 'refusal', status: 422, telemetry,
      body: {
        error: err.message, reason: err.reason, prep: err.prep,
        requires_acknowledgment: err.reason === 'warn_unacknowledged',
      },
    }
  }

  // §52 — days availability. Same shape as §44 so the client renders both the same
  // way: a hard refusal with alternatives, or a warning to acknowledge.
  if (err instanceof DaysAvailableError) {
    return {
      kind: 'refusal', status: 422, telemetry,
      body: {
        error: err.message, reason: err.reason, days: err.days,
        requires_acknowledgment: err.reason === 'warn_unacknowledged',
      },
    }
  }

  // §113 — long-run readiness. Same 422 shape as §44/§52/§111 so the "not yet"
  // screen renders every refusal identically.
  if (err instanceof LongRunReadinessError) {
    return {
      kind: 'refusal', status: 422, telemetry,
      body: { error: err.message, reason: 'long_run_readiness', readiness: err.readiness },
    }
  }

  // §111 — the base-build ceiling, and the only refusal that can carry an OFFER.
  if (err instanceof BaseVolumeError) {
    const runway = weeksBetweenLocal(planStart, input.race_date)

    // §116 (P-16) — §111 names a base-building plan as the remedy and §57 made that
    // remedy structurally impossible; `onRampOfferFor` is the remedy.
    //
    // ⚠️ AN OFFER, NEVER A SUBSTITUTION. We do not hand a runner who asked for a
    // marathon an eleven-week base block instead — ADR-012's model is that a
    // structural change surfaces for confirmation, and rendering the choice is the
    // client's job. ⚠️ BEHIND A FLAG AND DARK BY DEFAULT: `onRampOfferFor` returns
    // null unless ENABLE_BASE_BUILD_ONRAMP=1, so with the flag off this payload is
    // byte-identical to what it was before §116 existed. ⚠️ §111 IS NOT CREDITED IN
    // ADVANCE (board amendment 7) — the runner performs the block, re-declares, and
    // is gated on OBSERVED volume.
    const onramp = onRampOfferFor(input, err.base.min_base_km, runway)

    // §118 / P-15 — NO REFUSAL LEAVES WITHOUT SOMETHING TO DO. The founder's
    // directive after the board twice ruled zero rejection unreachable by coaching:
    // *"we can't just say no, go away."*
    //
    // ⚠️ IT MUST NOT IMPLY A MARATHON FOLLOWS. Most of this cohort finish above
    // §117's door with weeks to spare and genuinely can come back; a 2 km/week runner
    // will not. `reaches_race_door` says which, so the copy can tell the truth per
    // runner rather than in general.
    //
    // ⚠️ THIS DESCRIBES a base build; it does not BUILD one. The accept branch lives
    // at the top of `runEngine`, above the generation attempt, and leaving a second
    // copy here would be two producers of one decision — the exact unsoundness that
    // moved it (`BASEBUILD-ADJUST-REBUILD-01`).
    let getRunning: Record<string, unknown> | null = null
    if (!onramp && getRunningApplies(input)) {
      const { endsAtKm, weeks } = generateGetRunningPlan(input, planStart, runway)
      const reachesRaceDoor = endsAtKm >= err.base.min_base_km
      // ADR-015 owns every distance string; this module never formats one itself.
      // ⚠️ NO FALLBACK STRING. The first cut wrote `?? \`${Math.round(endsAtKm)} km\``
      // and PREF-SWEEP-01's guard caught it: a unit glyph welded to an interpolated
      // value is the defect ADR-015 exists to prevent. `formatDistance` returns null
      // only on a non-finite input, so the branch is the honest way to say that.
      const label = formatDistance(endsAtKm, displayUnits)
      if (label) getRunning = {
        weeks,
        ends_at_km: Math.round(endsAtKm * 10) / 10,
        reaches_race_door: reachesRaceDoor,
        // ⚠️ THE COPY SHIPS WITH THE OFFER, from its single owner, rather than being
        // assembled client-side. Two variants keyed on `reaches_race_door` (SLT
        // 2026-09-20), and the non-clearing one must say NOTHING about a race — a
        // rule a client-side template would be free to break.
        title: baseBuildOfferTitle(),
        line: baseBuildOfferLine({ weeks, endsAtKm, reachesRaceDoor, distanceLabel: label }),
        why: baseBuildOfferWhy(),
      }
    }

    return {
      kind: 'refusal', status: 422, telemetry,
      body: {
        error: err.message,
        reason: 'base_volume',
        base: err.base,
        ...(onramp ? { onramp } : {}),
        ...(getRunning ? { get_running: getRunning } : {}),
      },
    }
  }

  // `isDesignedRefusal` said yes and no branch claimed it, which means a fifth
  // refusal type was added without a response shape. Re-throw rather than invent
  // one: a silent generic 422 would be worse than the 500 the caller will give.
  return null
}
