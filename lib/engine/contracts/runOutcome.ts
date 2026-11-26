// FREE — infrastructure. ADR-027 B3 step 4a (ADR027-B3-REMAINING).
//
// Why a run produced no read. **The vocabulary moved here from `lib/coaching/autoAnalyse.ts`, and
// the move is the point:** `run_arrived` carries this reason (ARCH-ENG-022), so the engine's event
// contract needs it — and importing `autoAnalyse` to get it dragged `readPlanJson`, `AI_LIMITS` and
// the activity-title helper into L2, which inverts ARCH-ENG-001 ("layers depend downward only").
// A contract may not depend on a server module to learn six strings.
//
// ⚠️ `autoAnalyse.ts` RE-EXPORTS these, so every existing consumer is untouched and there is still
// exactly one definition. Same lesson as `RESHAPE_SKIP_INVARIANTS` two days ago: a shared list
// belongs where every reader is permitted to reach it, and a comment saying "never copy this" is
// not a mechanism.
//
// ── THE ORIGINAL REASONING, CARRIED OVER BECAUSE IT IS STILL THE REASON ─────────────────────────
// ACT-RUNREAD-REACH-01 — every wall a run can hit between landing and being READ. `autoAnalyse` has
// four early returns and the ingest route has a fifth, and all five were silent on both sides: the
// runner watches the run appear and never gets a read, and we could not say which one stopped it.
//
// ⚠️ `tier_gated` is recorded by the CALLER, not by the matcher — `/api/health/ingest` wraps the
// whole analysis in `if (canAnalyse)` (HK-FREE-INGEST-LINE-01), so a free runner's run never
// reaches that code at all. A reason that lives outside the function it describes is exactly the
// kind that goes uncounted, which is why it is in this list rather than in that route.

export const RUN_UNMATCHED_REASONS = {
  no_plan:             'the runner had no plan at all when the run arrived',
  plan_read_failed:    'the plan read itself failed, so whether they had one is unknown',
  outside_plan_weeks:  'the run date is not inside the 7-day window of the week it resolved to',
  week_has_no_sessions: 'the week the run resolved to offers nothing to match: after overrides, and on a multi-session day after dropping ones already complete',
  below_threshold:     'a session was there and no candidate reached the auto-link score',
  tier_gated:          'free tier: the row lands, the read does not (recorded by the caller)',
} as const

export type RunUnmatchedReason = keyof typeof RUN_UNMATCHED_REASONS
