// ADJUST-ENGINE-ENTRY-01 — the adaptive engine's single entry point.
//
// 🎯 WHY THIS EXISTS. `ENGINE-ENTRY-01` (`1c10f90d`) gave `/api/generate-plan` one
// door: eighteen engine imports became seven and the route stopped being the
// orchestrator. `/api/adjust-plan` was the remaining route in the same shape —
// **fourteen** engine modules, sequenced by the handler — so extracting the engine
// would have made all fourteen public API surface. `lib/plan/engine.ts` is the
// pattern this file follows; read its header first, because every constraint it
// records applies here unchanged.
//
// ⚠️ WHAT THIS DELIBERATELY DOES NOT TAKE. The reasons are not stylistic, and two
// of them differ from generate-plan's, which is why they are argued rather than
// copied:
//
//   - **auth, tier and the paywall.** `isFeatureAllowed('dynamic_reshape_r20',
//     tier)` answers **403**, not 422, and it is a COMMERCIAL gate: a second
//     consumer of a hosted engine would not apply Zonna's price list. ADR-003
//     makes the route the auth boundary. Moving it inside would turn a paywall
//     into a 200 carrying an empty outcome.
//   - **every Supabase read and write.** The six queries, `fetchWeeklyLoad`,
//     `savePlanForUser`, `recordAdjustmentCheck`, the `plan_adjustments` insert.
//     `ENGINE-PURITY-GATE-01` exists to keep them out. ⚠️ AND MOVING
//     `savePlanForUser` WOULD BREAK AN UNRELATED GATE: `planRouteClient.test.ts`
//     derives its population from every `savePlanForUser` call in `app/api` and
//     floors it at eight.
//   - **telemetry.** `recordOpsEvent('reshape_invalid' | 'plan_save_failed')`,
//     the notification sends. The engine COMPUTES, the caller RECORDS — the same
//     split `runEngine` uses for its refusal telemetry.
//   - 🔴 **THE PROMPT BUILDERS, AND THIS IS NOT THE SAME ANSWER AS THE VALIDATOR.**
//     `buildAdjustmentExplanationPrompt` takes `units` — a display preference —
//     and assembles runner-facing voice for a model this engine may not call.
//     ADR-006 makes that pass silent and optional, so its failure must not be an
//     engine outcome. ⚠️ **But `acceptAiSummary` below IS the engine's**, because
//     it does not ask *"is this good copy?"* — it asks *"does this prose
//     contradict what I changed?"*, and **the engine is the only thing that knows
//     what changed.** A hosted engine that returned a reshape without publishing
//     that check would make every consumer re-derive it, which is the
//     `SESSION-KM-01` class. Prompts out, validator in.
//
// 🔑 SO THE HONEST COUNT IS 14 → 5, NOT 14 → 1. The five the route keeps are the
// entry point, `canUseFeature` (the 403), `weeklyActualLoad` (`fetchWeeklyLoad` is
// I/O) and the two prompt builders above. ⚠️ **AND THERE IS A SIXTH THE OLD GATE
// COULD NOT SEE**: `getCurrentWeekIndex` and `savePlanForUser` arrive through the
// `@/lib/plan` BARREL (`lib/plan.ts`), and `engineContract.test.ts`'s reader
// required `@/lib/plan/` — the same hole as the `@/lib/coaching/` one
// `ENGINE-ENTRY-01` closed, one character further along. The reader now counts the
// barrel too, so the figure is **14 → 5 on the old reader, 15 → 6 on the widened
// one**, and both are stated rather than whichever is flattering.
//
// ⚠️ `getCurrentWeekIndex` STAYS IN THE ROUTE OUT OF NECESSITY, not doctrine: the
// week number scopes three of the route's own Supabase queries, so it must be
// known BEFORE this engine is called. It is passed in.
//
// 🔴 THE CONSTITUTIONAL CHECK RUNS HERE; THE REACTION DOES NOT. `validateReshapedPlan`
// is called inside, and the error-severity violations are RETURNED. The route keeps
// its own dev/test throw and its production `reshape_invalid` ops event verbatim,
// because the two differ from `generate-plan`'s `enforceViolations` in message and in
// side effect, and a refactor that quietly changes which error text appears is the
// thing this file exists to avoid.
//
// ⚠️ NO `next/` IMPORTS, SO NO `NextResponse`. The outcome is a plain value and the
// route wraps it. That is what makes the row→signal assembly testable for the first
// time: it used to be gated by GREPPING THE ROUTE'S SOURCE, in two separate files,
// one of which says so in its own comment — *"the ROUTE is where the axes are
// assembled ... which is why this reads the shipped source."*

import {
  checkAdjustmentTriggers,
  type AdjustmentCheckInput,
  type ProposedAdjustment,
} from './planAdjustment'
import { computeReshapeMagnitude, type ReshapeMagnitude } from './reshapeMagnitude'
import { recordQualityDowngrade } from './qualityDowngrade'
import { COACHING_RULE_ENGINE_VERSION } from './constants'
import { priorWeeks, EMPTY_LOAD, type WeeklyLoad } from './weeklyActualLoad'
import { computeSessionDiff } from './diff/sessionDiff'
import { validateSummaryAgainstDiff } from './diff/validateAiSummary'
import { isLongRun, isQualitySession } from '@/lib/plan/sessionRole'
import { orderedWeekSessions } from '@/lib/plan/weekSessions'
import { validateReshapedPlan, type Violation } from '@/lib/plan/invariants'
import { refreshWeekCopyIfStale } from '@/lib/plan/ruleEngine'
import type { Plan, Session } from '@/types/plan'

/**
 * A `run_analysis` row, as this engine reads one. Declared here with plain types
 * rather than imported from a Supabase generated type, because the engine must
 * not depend on the caller's storage client — the caller maps its query result
 * into this by field name, which is what it already does.
 *
 * Every field is nullable because every one of them genuinely is in production:
 * the columns were added at different times and rows predating them are not
 * backfilled (live-plan policy).
 */
export interface AnalysisRow {
  week_n:               number | null
  session_day:          string | null
  hr_in_zone_pct:       number | null
  actual_load_km:       number | null
  planned_load_km:      number | null
  actual_load_mins:     number | null
  planned_load_mins:    number | null
  ef_trend_pct:         number | null
  pace_score:           number | null
  hr_above_ceiling_pct: number | null
  distance_score:       number | null
}

/** A `session_completions` row, same reasoning as `AnalysisRow`. */
export interface CompletionRow {
  week_n:      number | null
  session_day: string | null
  fatigue_tag: string | null
  skip_reason: string | null
  status:      string | null
}

/** Canonical day order. mon=0 … sun=6, matching `orderedWeekSessions`. */
const DAY_ORDER: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }

/**
 * ENGINE-01 — which analysed sessions count as quality for the fitness signal.
 *
 * QUALITY-TYPE-NO-OWNER-01 (Coaching Board 2026-10-24): `isQualitySession`, the training-
 * stimulus question. The time trial is excluded, as it always was here, so the calibration
 * does not move (amendment 2: recalibration owns the time trial, ADR-014).
 */

/** §112 / ENGINE-01 / ENGINE-02 window sizes, moved verbatim with the code that
 *  used them. Pre-existing values; this relocation changes none of them. */
const PRIOR_WEEKS_COUNT        = 4
const RECENT_QUALITY_MAX       = 10
const RECENT_LONG_RUN_MAX      = 4

export type AdjustmentOutcome =
  /** The engine ran and nothing needs changing. The caller still stamps the
   *  check time — the engine HAVING run is the fact that line reports. */
  | { kind: 'none' }
  /** A proposed adjustment, resolved: §69 magnitude applied, the prospective plan
   *  built and run past the constitutional layer. */
  | {
      kind: 'adjustment'
      proposed: ProposedAdjustment
      /** §69 / ADR-012. Returned as well as applied so the caller can record it. */
      magnitude: ReshapeMagnitude
      /** The authoritative answer, NOT the builder's `requiresConfirmation` —
       *  which is retained on the proposal type for compatibility and is no
       *  longer the source of truth (RESHAPE-FIX-WAVE3). */
      requiresConfirmation: boolean
      status: 'pending' | 'auto_applied'
      /** The plan with the week's sessions replaced. Built ONCE here and reused
       *  by the caller's save, exactly as the route did — building it twice is
       *  two producers of one decision. */
      updatedPlan: Plan
      /**
       * Error-severity violations only, from `validateReshapedPlan`.
       *
       * ⚠️ RETURNED, NEVER ACTED ON. The caller throws in dev/test and records
       * `reshape_invalid` in production, and keeping that here would change the
       * error text a refactor is supposed to leave alone.
       */
      reshapeErrors: Violation[]
      /** Stamped on the caller's row. The engine's own version, so the caller
       *  does not import `constants` to find it. */
      ruleEngineVersion: string
    }

export interface AdjustmentRequest {
  plan: Plan
  /** The live week, 1-based (`week.n`, not an array index). Resolved by the
   *  caller because it also scopes the caller's own queries. */
  weekN: number
  /** `manual: true` on the body — the runner is polling a review surface, so
   *  §69 forces confirmation regardless of magnitude. */
  isManual: boolean
  /** Count of `pending`/`confirmed`/`auto_applied` rows already in this week.
   *  Enforces `MAX_ADJUSTMENTS_PER_WEEK`. */
  adjustmentsThisWeek: number
  /** `run_analysis`, most recent first, already scoped to the live plan. */
  analyses: readonly AnalysisRow[]
  /** `session_completions` carrying a fatigue tag or a skip reason. */
  completions: readonly CompletionRow[]
  /** `fetchWeeklyLoad`'s result — the single owner of weekly load (LOG-OFFPLAN-01).
   *  The FETCH is the caller's; what the triggers read off it is the engine's. */
  weeklyLoad: ReadonlyMap<number, WeeklyLoad>
  rpeSignal?: { rpe: number; sessionType: string }
  /** As read off the body. `weekSessionsByDay` is attached here, not by the
   *  caller: it is this engine's own week, and the caller assembling it was one
   *  of the two places the week was hand-rolled (ADJUST-ENGINE-DEAD-01). */
  skipSignal?: { reason: string; sessionType: string; sessionDay: string }
  reorderSignal?: { fromDay: string; toDay: string }
  /** Defaults to the wall clock. Pinnable so a test or a support reproduction can
   *  fix the `quality_downgraded` stamp. */
  now?: string
}

/**
 * The synchronous adjustment path, end to end.
 *
 * Order is preserved EXACTLY as the route ran it, because two orderings are
 * observable: the trigger stack's own priority (owned by `checkAdjustmentTriggers`),
 * and the fact that the prospective plan is built and validated BEFORE the
 * adjustment row is written, so a plan that fails its constitution is visible
 * before anything is persisted (RESHAPE-FIX-WAVE3-PHASE2).
 *
 * Throws only on a genuine fault — including `orderedWeekSessions`' deliberate
 * throw on a malformed week, which the caller must map to 500 exactly as before
 * (ADJUST-ENGINE-DEAD-01: that assertion is the only thing standing between a
 * sparse week and a silently wrong reshape, and must not be relaxed).
 */
export function runAdjustmentEngine(req: AdjustmentRequest): AdjustmentOutcome {
  const { plan, weekN, isManual } = req
  const nowIso = req.now ?? new Date().toISOString()

  const proposed = checkAdjustmentTriggers(buildAdjustmentSignals(req))
  if (!proposed) return { kind: 'none' }

  // RESHAPE-FIX-WAVE3 / §69 / ADR-012 — magnitude is the single decision point.
  // The builder's own `requiresConfirmation` is NOT consulted: the 2026-06-26
  // incident's tue↔thu swap set it false because no §7 alternation fired, and the
  // swap landed the long run on a Tuesday.
  const magnitude = computeReshapeMagnitude(proposed)
  const requiresConfirmation = isManual || magnitude === 'high'
  const status: 'pending' | 'auto_applied' = requiresConfirmation ? 'pending' : 'auto_applied'

  const updatedPlan = applyAdjustmentToPlan(
    plan, weekN, proposed.sessionsAfter, proposed.trigger?.type, nowIso,
  )
  const reshapeErrors = validateReshapedPlan(updatedPlan, weekN).filter(v => v.severity === 'error')

  return {
    kind: 'adjustment',
    proposed,
    magnitude,
    requiresConfirmation,
    status,
    updatedPlan,
    reshapeErrors,
    ruleEngineVersion: COACHING_RULE_ENGINE_VERSION,
  }
}

/**
 * Supabase rows → `AdjustmentCheckInput`.
 *
 * 🔴 THIS IS THE HALF THAT WAS ONLY EVER GATED BY GREPPING A ROUTE. Two separate
 * test files assert properties of this mapping by reading `app/api/adjust-plan/route.ts`
 * as text, and `planAdjustment.test.ts` explains why in its own comment: *"the ROUTE
 * is where the axes are assembled, and the original defect lived there."* True of a
 * Next handler. Not true of the problem — this is a function of its arguments.
 *
 * ⚠️ IT IS ALSO WHERE SEVERAL COACHING PRINCIPLES ARE IMPLEMENTED, which is the
 * argument for it being the engine's rather than the caller's: §66 Amendment 1's
 * two-axis comparability rule, §112's completions window, TRIGGER-AUDIT-01's
 * directional HR column and ENGINE-01's quality set all live in these filters. The
 * ownership map's seam rule settles it — **coaching owns the meaning.**
 *
 * ⚠️ EXPORTED DELIBERATELY, AND NOT MERELY FOR TESTS. *"What would you read off my
 * rows?"* is a question an external consumer of a hosted engine has to be able to
 * ask, and it is the only honest way to gate the mapping: a test that hopes a
 * trigger fires is at the mercy of `MAX_ADJUSTMENTS_PER_WEEK` and taper protection,
 * neither of which is what it means to be asserting.
 */
export function buildAdjustmentSignals(req: AdjustmentRequest): AdjustmentCheckInput {
  const { plan, weekN, analyses, completions, weeklyLoad } = req
  const week = plan.weeks[weekN - 1]

  // Resolve the current training phase from plan.phases (R23+ plans only).
  const currentPhase = plan.phases
    ? plan.phases.find(p => p.start_week <= weekN && weekN <= p.end_week)?.name
    : undefined

  const chronological = <T extends { week_n: number | null; session_day: string | null }>(rows: readonly T[]): T[] =>
    rows.slice().sort((a, b) => {
      if (a.week_n !== b.week_n) return (a.week_n ?? 0) - (b.week_n ?? 0)
      return (DAY_ORDER[a.session_day ?? ''] ?? 99) - (DAY_ORDER[b.session_day ?? ''] ?? 99)
    })

  // `recentFatigueTags` is kept only for callers not yet migrated (@deprecated on
  // the input type); §112 reads `recentFatigueRows`, which can see a skip.
  const ordered = chronological(completions)
  const recentFatigueTags = ordered.map(c => c.fatigue_tag as string)
  const recentFatigueRows = ordered.map(c => ({
    fatigue_tag: c.fatigue_tag ?? null,
    skip_reason: c.skip_reason ?? null,
  }))

  // 🔴 §12 Amendment 2 (`ADJUST-SESSIONDAY-PREFIX-01`, Coaching Board 2026-10-15) —
  // THIS WEEK'S ANALYSES ARE SELECTED ON `week_n`, NEVER ON A `session_day` PREFIX.
  //
  // This line read `(a.session_day ?? '').startsWith(`week_${weekN}_`)`, and it matched
  // NOTHING. Measured in production: **154 `run_analysis` rows, ZERO carry the prefix**,
  // every one is a bare day key (`mon`, `tue`, …), and the oldest surviving row
  // (2026-04-28) is already bare. 120 of them carry `hr_in_zone_pct`.
  //
  // So `hrInZoneData` was ALWAYS EMPTY and `efTrendPct` ALWAYS NULL for every real
  // runner, and §12's drift detector had no input at all. Nothing failed: the writer's
  // format changed, `.startsWith()` returned false, and a trigger quietly stopped
  // having data.
  //
  // 🔑 THE CONTRADICTION WAS THREE LINES APART IN THIS FILE. `chronological()` above
  // and the session lookup below both read `session_day` as a BARE DAY; only this line
  // expected a prefix, and it was the one feeding two triggers. Two of three readers
  // agreed with production.
  //
  // ⚠️ `week_n` is the right axis and is populated: **88 of 88 live rows**, 78 of them
  // with HR. `app/api/analyse-run/route.ts` still strips a `week_${n}_` prefix on write,
  // which is a silent no-op now that every producer sends a bare day
  // (`autoAnalyse.ts`, `DashboardClient.tsx`) — that strip is harmless and is left alone
  // deliberately, because removing it would reject any historical row that still has one.
  const thisWeekAnalyses = analyses.filter(a => a.week_n === weekN)
  const plannedKm = week?.weekly_km ?? 0

  // ⚠️ A FETCH FAILURE MUST NOT READ AS "THE RUNNER DID NOTHING" — that is §68
  // Am.1's failure exactly. The caller refuses to answer at all rather than
  // handing in an empty map, so `EMPTY_LOAD` here only ever covers a week with no
  // logged runs, which genuinely is zero load.
  const thisWeek = weeklyLoad.get(weekN) ?? EMPTY_LOAD
  const priorWeeksKm = priorWeeks(weeklyLoad, weekN, PRIOR_WEEKS_COUNT)

  const hrInZoneData = thisWeekAnalyses.map(a => ({
    hrInZonePct: a.hr_in_zone_pct ?? null,
    // TRIGGER-AUDIT-01 — the DIRECTIONAL column. §12 prescribes a cap, so only
    // time ABOVE it is drift.
    aboveCeilingPct: a.hr_above_ceiling_pct ?? null,
    actualLoadKm: a.actual_load_km ?? null,
  }))

  const efTrendValues = thisWeekAnalyses
    .map(a => a.ef_trend_pct)
    .filter((v): v is number => v !== null && v !== undefined)
  const efTrendPct = efTrendValues.length
    ? efTrendValues.reduce((s, v) => s + v, 0) / efTrendValues.length
    : null

  // ADJUST-ENGINE-DEAD-01 — `orderedWeekSessions` is the single owner and
  // materialises an absent day as an explicit rest session (§64 / GEN-FIX-09:
  // the two representations are equally valid, so the conversion is lossless).
  // The route used to hand in `?? null` and `checkAdjustmentTriggers` throws on a
  // null slot, which killed the engine for 31 of 31 live plans for 104 days.
  const currentWeekSessions = orderedWeekSessions(
    week as unknown as { sessions: Record<string, never> },
  ) as unknown as Session[]

  // SKIP-MAKEUP-DAY-01 — what the make-up may not ignore: the runner's blocked days, and which of this week's days
  // have already passed (from the week's own Monday and the request's clock, the date part only).
  const weekStart = String((week as unknown as { date?: string } | undefined)?.date ?? '').slice(0, 10)
  const todayIso = (req.now ?? new Date().toISOString()).slice(0, 10)
  const earliestDayIdx = weekStart
    ? Math.max(0, Math.round((Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${weekStart}T00:00:00Z`)) / 864e5))
    : 0
  const blockedDays = ((plan.meta as unknown as { generator_input?: { days_cannot_train?: string[] } } | undefined)?.generator_input?.days_cannot_train ?? [])
  const skipSignal = req.skipSignal
    ? { ...req.skipSignal, weekSessionsByDay: (week?.sessions ?? {}) as Record<string, Session | undefined | null>,
        blockedDays, earliestDayIdx }
    : undefined

  const sessionFor = (a: AnalysisRow): Session | undefined => {
    const w = plan.weeks.find(pw => pw.n === a.week_n)
    return (w?.sessions as Record<string, Session | undefined> | undefined)?.[a.session_day ?? '']
  }

  // ENGINE-01 — fitness signal. Only rows carrying a pace score (VDOT-based
  // plans), cross-referenced against the plan to establish the session type.
  const recentQualityAnalyses = analyses
    .filter(a => {
      if (a.pace_score === null || a.pace_score === undefined) return false
      const s = sessionFor(a)
      return isQualitySession(s)
    })
    .slice(0, RECENT_QUALITY_MAX)
    .map(a => ({
      paceScore: a.pace_score as number,
      hrAboveCeilingPct: a.hr_above_ceiling_pct,
      weekN: a.week_n as number,
    }))

  // ENGINE-02 — long-run shortfall.
  //
  // §66 Amendment 1 — BOTH axes are passed and `shortfallAxis` picks the one the
  // session is anchored on. The filter used to require `actual_load_km`, which a
  // duration-anchored analysis can legitimately carry; what it could never carry
  // was a PLANNED km, so the trigger dropped it downstream. A row qualifies if it
  // can be compared on EITHER axis.
  const recentLongRunAnalyses = analyses
    .filter(a => {
      const comparableOnDistance = a.actual_load_km != null && a.planned_load_km != null
      const comparableOnTime     = a.actual_load_mins != null && a.planned_load_mins != null
      if (!comparableOnDistance && !comparableOnTime) return false
      const s = sessionFor(a)
      return !!s && isLongRun(s)
    })
    .slice(0, RECENT_LONG_RUN_MAX)
    .map(a => {
      const s = sessionFor(a)
      return {
        actualKm: a.actual_load_km ?? null,
        // Read from the STORED analysis rather than re-derived from the plan. The
        // plan can be reshaped after the run; the analysis records what the session
        // prescribed on the day, which is what the runner was measured against.
        // Falls back to the plan for rows written before the columns existed (not
        // backfilled — live-plan policy).
        plannedKm:   a.planned_load_km ?? (s?.distance_km ?? null),
        actualMins:  a.actual_load_mins ?? null,
        plannedMins: a.planned_load_mins ?? (s?.duration_mins ?? null),
        weekN:       a.week_n as number,
      }
    })

  return {
    currentWeekN:  weekN,
    totalWeeks:    plan.weeks.length,
    currentWeekSessions,
    linkedKm:      thisWeek.linkedKm,
    offPlanKm:     thisWeek.offPlanKm,
    plannedKm,
    priorWeeksKm,
    hrInZoneData,
    efTrendPct,
    adjustmentsThisWeek: req.adjustmentsThisWeek,
    currentPhase,
    recentFatigueTags,
    recentFatigueRows,
    rpeSignal: req.rpeSignal,
    skipSignal,
    reorderSignal: req.reorderSignal,
    recentQualityAnalyses,
    recentLongRunAnalyses,
  }
}

/**
 * The prospective plan: the week's sessions replaced, the intentional downgrade
 * recorded, the week's copy re-derived if the reshape falsified it.
 *
 * Moved verbatim from `app/api/adjust-plan/route.ts`. It mutates `plan.weeks`,
 * which makes it the kind of thing ADR-020 insists has exactly one owner — and it
 * had one, in a route handler, where nothing could call it.
 */
function applyAdjustmentToPlan(
  plan: Plan,
  weekN: number,
  sessionsAfter: Session[],
  triggerType: string | undefined,
  nowIso: string,
): Plan {
  const updated = JSON.parse(JSON.stringify(plan)) as Plan
  const week = updated.weeks.find(w => w.n === weekN)
  if (!week) return updated

  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
  days.forEach((day, idx) => {
    if (sessionsAfter[idx]) {
      week.sessions[day] = sessionsAfter[idx]
    }
  })

  // GEN-FIX-10 — record an intentional intensity downgrade before validating, so
  // the invariant can distinguish it from a generator defect.
  recordQualityDowngrade(week, triggerType, nowIso)

  // §27 — a reshape can remove the very session the week's copy promises (the AEF
  // downgrade swaps quality to easy). Re-derive the copy when, and only when, it
  // has become false; enriched copy is a paid deliverable and must not be
  // blanket-reverted to rule-engine strings.
  refreshWeekCopyIfStale(updated, weekN)

  return updated
}

/**
 * Does the model's prose contradict what the engine actually changed?
 *
 * 🔴 THE ENGINE'S, NOT THE AI LAYER'S, and the distinction is the whole reason
 * this function exists rather than two imports in a route. RESHAPE-FIX-WAVE2A:
 * the 2026-06-26 incident shipped a summary reading *"the 24km run stays intact"*
 * when the 24 km run had moved. Anti-confabulation rules in the prompt did not
 * catch it. The check is against the DIFF, and the engine is the only thing that
 * holds the diff.
 *
 * ⚠️ THE CALLER STILL OWNS THE FALLBACK. On `ok: false` it keeps the rule-engine
 * summary silently (ADR-006) and logs `reason` so prompt drift surfaces. This
 * function never decides what the runner reads; it decides whether the model
 * earned the right to.
 */
export function acceptAiSummary(
  proposed: ProposedAdjustment,
  summary: string,
): { ok: true } | { ok: false; reason: string } {
  const diff = computeSessionDiff(proposed.sessionsBefore, proposed.sessionsAfter)
  const v = validateSummaryAgainstDiff(summary, diff)
  return v.ok ? { ok: true } : { ok: false, reason: v.reason }
}
