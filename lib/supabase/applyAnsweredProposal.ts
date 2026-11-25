// CONFIRM-REVERT-WRITE-ERRORS-01 — the single owner of "the runner answered a proposed plan
// change, so apply it and record the answer".
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────────────────────────
// Four routes do this same job and each wrote it out by hand:
//   · POST /api/confirm-adjustment          (plan_adjustments  → confirmed)
//   · POST /api/revert-adjustment           (plan_adjustments  → reverted)
//   · POST /api/post-race-reshape/confirm   (post_race_reshapes → confirmed)
//   · POST /api/post-race-reshape/revert    (post_race_reshapes → reverted)
//
// `ADJUST-STATUS-WITHOUT-SAVE-01` (2026-10-16) fixed the ORDER in two of the four — save the
// plan first, then mark it done — and left the CHECKING in none of them. Measured 2026-11-25:
//
//   🔴 the two adjustment routes ran the status update and the Me flag in a bare
//      `await Promise.all([...])` whose result was DISCARDED. supabase-js RESOLVES with
//      `{ error }` rather than rejecting, so there was nothing to catch and nothing was
//      recorded: the plan changed, the row stayed `pending`, a 200 came back, and the change
//      card returned on the next load with no trace of why.
//
//   🔴 the two post-race-reshape routes had NO try/catch around `savePlanForUser` at all, so a
//      failed save produced a bare 500 and — unlike their siblings — no `plan_save_failed`
//      event. Same job, two of four instrumented. That is the remedy-applied-to-one-twin class.
//
//   🔴 every status update was keyed on `id` ALONE, never on the status the route had just read,
//      so a second answer (a second device, or `pre-session-readiness` closing a stale card)
//      overwrote the first silently.
//
// ⚠️ IT IS LATENT, AND THAT IS NOT THE SAME AS HARMLESS. Measured read-only against production:
// 27 `plan_adjustments` rows ever, 7 lifetime confirm/revert resolutions, 0 `plan_save_failed`
// from either route, 0 resolved rows missing their timestamp. These are service-client updates by
// primary key against two small tables, so the only failure mode is transient — unlike
// `ADJUST-PLAN-SAVE-CLIENT-01`'s RLS refusal, which was systematic and fired three times.
//
// ── THE CONTRACT ───────────────────────────────────────────────────────────────────────────
// 🔴 A FAILED TRANSITION IS NOT A FAILED REQUEST. The plan is saved first, so by the time the
// transition runs the runner's plan has already changed. Returning non-200 would make every
// client show `PLAN_CHANGE_SAVE_FAILED` for a change that landed, which is a worse lie than the
// card reappearing. So: `ok: true` with `transition: 'conflict' | 'unrecorded'`, and the caller
// still answers 200. Only a failed PLAN SAVE is a 500.
//
// ⚠️ A CONFLICT IS NOT AN ERROR. It means the row no longer holds the status the route read, so
// somebody else answered first and the conditional predicate correctly declined to overwrite
// them. The plan write is still last-writer-wins across two devices; closing THAT needs the
// optimistic-concurrency check ADR-027 ARCH-ENG-016 specifies, and this module is deliberately
// shaped to be the place that check lands rather than four places it would have to be added.

// 🔴 IT LIVES IN `lib/supabase/`, NOT `lib/plan/`, AND TWO ADR-027 GATES DECIDED THAT.
// Written under `lib/plan/` first, where it tripped both: `ENGINE-PURITY-GATE-01` (an engine
// file may not import `@supabase/` — the app is the CALLER) and `ARCH-ENG-005` (the engine may
// not read the wall clock; this stamps `confirmed_at` / `reverted_at`). Both were RIGHT: this is
// a persistence module at the route boundary, not engine code. Same correction as the completion
// HR mirror three days earlier (`cb02e1b7`, 2026-11-22) — twice in one week, so: **a new module
// that touches Supabase or `new Date()` does not belong under `lib/plan/`.**

import type { SupabaseClient } from '@supabase/supabase-js'
import { savePlanForUser } from '@/lib/plan'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import type { Plan } from '@/types/plan'

/** The two tables that hold a plan change awaiting the runner's answer. */
export type ProposalTable = 'plan_adjustments' | 'post_race_reshapes'

/** The answer, which is also the status it transitions to. Both tables use these words. */
export type ProposalAnswer = 'confirmed' | 'reverted'

export type ApplyOutcome =
  /** Plan saved, row transitioned. The only clean result. */
  | { ok: true; transition: 'recorded' }
  /** Plan saved; the row had moved on, so it was left alone. Recorded, still a 200. */
  | { ok: true; transition: 'conflict'; observedStatus: string | null }
  /** Plan saved; a write errored after one retry. Recorded, still a 200. */
  | { ok: true; transition: 'unrecorded'; failed: 'row' | 'flag'; message: string }
  /**
   * `savePlanForUser` threw. Nothing was marked, and the caller returns 500.
   *
   * ⚠️ IT DOES NOT MEAN "THE PLAN DID NOT CHANGE", AND THIS TYPE SAID SO UNTIL CODE REVIEW
   * CORRECTED IT. `savePlanForUser` throws AFTER the `plans` upsert has already succeeded on at
   * least one path — the `plan_weekly_notes` invalidation (`lib/plan.ts:329`) — so on that path
   * the runner's plan HAS changed, every route answers 500, and the client shows
   * `PLAN_CHANGE_SAVE_FAILED` for a change that applied. The row stays at its prior status, so a
   * retry re-applies the same change, which is idempotent (`applyAdjustmentDays` writes `to[i]`
   * wherever it differs from `from[i]`, regardless of what the week currently holds).
   *
   * ⚠️ The behaviour is UNCHANGED from before this module existed and is deliberately not
   * "fixed" here: telling the two apart means reading the thrown message, and this repo forbids
   * matching a failure by its message. Narrowing it belongs with the owner that throws, so it is
   * filed as `SAVEPLAN-PARTIAL-THROW-01` rather than guessed at. `plan_save_failed` carries the
   * message, so the ledger can be read for which path it was.
   */
  | { ok: false; reason: 'save_failed'; message: string }

export interface ApplyAnsweredProposalArgs {
  userId: string
  /** Names the API route, for the ops detail. Matches the `route` tag the siblings already use. */
  route: string
  /** The plan to persist. Already built by the caller; this module never edits plan JSON. */
  plan: Plan
  proposal: {
    table: ProposalTable
    id: string
    /**
     * The status the route READ before it decided to act. The transition is conditional on it,
     * so a concurrent answer is a conflict rather than a silent overwrite.
     *
     * ⚠️ It is not a constant per route: `revert-adjustment` accepts a row that is `pending` OR
     * `confirmed` (it only refuses one already `reverted`), so the caller passes what it saw.
     */
    fromStatus: string
    answer: ProposalAnswer
  }
  /**
   * Clear `user_settings.last_adjustment_check_found_change`. True for the adjustment routes
   * (answering a pending change IS its resolution, PROFILE-ADJ-01); the post-race reshape
   * routes do not touch that flag and never did.
   */
  clearAdjustmentFlag: boolean
  /** Merged into every event this emits — `week_n`, `weeks_affected`, whatever the caller holds. */
  detail?: Record<string, unknown>
}

/** The timestamp column each answer stamps. Both tables carry both columns. */
const STAMP: Record<ProposalAnswer, 'confirmed_at' | 'reverted_at'> = {
  confirmed: 'confirmed_at',
  reverted:  'reverted_at',
}

export async function applyAnsweredProposal(
  db: SupabaseClient,
  args: ApplyAnsweredProposalArgs,
): Promise<ApplyOutcome> {
  const { userId, route, plan, proposal, clearAdjustmentFlag } = args
  const detail = args.detail ?? {}
  const nowIso = new Date().toISOString()

  // ── 1. The plan. Save FIRST, and a failure stops everything (ADJUST-STATUS-WITHOUT-SAVE-01).
  try {
    await savePlanForUser(userId, plan, db)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await recordOpsEvent('plan_save_failed', { route, ...detail, message }, userId)
    return { ok: false, reason: 'save_failed', message }
  }

  // ── 3. The Me-screen flag. Ordered AFTER the row deliberately: the ROW decides whether a retry
  // can succeed, so it is written first and a flag failure never un-resolves a resolved proposal.
  // Same ordering, and the same reason, as `revert-adjustment`'s week-not-found branch.
  //
  // Declared here and called from TWO places — the clean path and the retry-landed path above,
  // which is a transition that DID happen and must not skip the flag.
  const clearFlagIfAsked = async (): Promise<ApplyOutcome> => {
    if (!clearAdjustmentFlag) return { ok: true, transition: 'recorded' }
    const flagRes = await db.from('user_settings')
      .update({ last_adjustment_check_at: nowIso, last_adjustment_check_found_change: false })
      .eq('id', userId)
    if (flagRes.error) {
      const message = flagRes.error.message
      await recordOpsEvent('proposal_transition_incomplete', {
        route, table: proposal.table, proposal_id: proposal.id, answer: proposal.answer,
        outcome: 'flag_write_failed', message, ...detail,
      }, userId)
      return { ok: true, transition: 'unrecorded', failed: 'flag', message }
    }
    return { ok: true, transition: 'recorded' }
  }

  // ── 2. The row. Conditional on the status the caller read, and the result is READ.
  const transitionRow = async () =>
    db.from(proposal.table)
      .update({ status: proposal.answer, [STAMP[proposal.answer]]: nowIso })
      .eq('id', proposal.id)
      .eq('status', proposal.fromStatus)
      // `.select()` is what makes the predicate observable: without it PostgREST returns no rows
      // either way and a conflict is indistinguishable from a success.
      .select('id')

  let rowRes = await transitionRow()
  // One retry, because the realistic failure here is transient (a service-client update by
  // primary key on a small table). A second failure is reported, never swallowed.
  if (rowRes.error) rowRes = await transitionRow()

  if (rowRes.error) {
    const message = rowRes.error.message
    await recordOpsEvent('proposal_transition_incomplete', {
      route, table: proposal.table, proposal_id: proposal.id, answer: proposal.answer,
      outcome: 'row_write_failed', message, ...detail,
    }, userId)
    return { ok: true, transition: 'unrecorded', failed: 'row', message }
  }

  if (!rowRes.data?.length) {
    // 0 rows matched: the row is no longer at `fromStatus`. Read it back so the event names what
    // it actually holds — "it conflicted" without the observed value is not actionable.
    //
    // ⚠️ The read-back's OWN error is kept apart from a missing row. `null` from a failed read
    // and `null` from a deleted row are the same byte and not the same fact
    // (`BOOT-STALL-HIDDEN-ABSENT-01`).
    const { data: observed, error: readBackError } = await db.from(proposal.table)
      .select('status').eq('id', proposal.id).maybeSingle()
    const observedStatus = readBackError ? null : ((observed?.status as string | undefined) ?? null)

    // 🔴 A COMMITTED-BUT-UNACKNOWLEDGED WRITE IS NOT A CONFLICT, AND THE RETRY ABOVE CREATES
    // EXACTLY THAT CASE (code review, 2026-11-25). If attempt 1 commits in Postgres and the
    // response is lost — a timeout, a dropped connection — supabase-js resolves with `{ error }`,
    // the retry's `.eq('status', fromStatus)` now matches 0 rows because the status has already
    // moved, and without this the route would log a conflict, skip the flag, and leave Me
    // claiming a change is pending while the row and the plan both agree it is done. That is the
    // precise state this module exists to prevent, reintroduced by its own retry.
    //
    // The row holding OUR answer is the evidence the write landed. Nobody else writes
    // `proposal.answer` for this id in this window; a genuine concurrent answer leaves a
    // DIFFERENT status (that is what makes it a conflict).
    if (observedStatus === proposal.answer) {
      await recordOpsEvent('proposal_transition_incomplete', {
        route, table: proposal.table, proposal_id: proposal.id, answer: proposal.answer,
        outcome: 'retry_landed_first_attempt', observed_status: observedStatus, ...detail,
      }, userId)
      // Fall through to the flag write — the transition DID happen.
      return await clearFlagIfAsked()
    }

    await recordOpsEvent('proposal_transition_incomplete', {
      route, table: proposal.table, proposal_id: proposal.id, answer: proposal.answer,
      outcome: 'conflict', observed_status: observedStatus,
      ...(readBackError ? { read_back_error: readBackError.message } : {}),
      ...detail,
    }, userId)
    return { ok: true, transition: 'conflict', observedStatus }
  }

  return await clearFlagIfAsked()
}
