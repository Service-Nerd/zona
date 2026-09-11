// SEC-08 — the live RLS policy inventory, checked in so it can be reasoned about
// without a production query.
//
// WHY THIS FILE EXISTS. `createUserScopedClient` runs queries as the USER, so
// RLS applies and a manual `.eq('user_id', ...)` becomes a second layer rather
// than the only one. But a JWT client against a table with RLS enabled and NO
// matching policy does not error — it silently returns zero rows, and writes
// silently fail. That is this codebase's signature failure class, and it is why
// the rollout recipe says "per-table RLS check FIRST".
//
// Four public tables have RLS enabled with ZERO policies: `ai_rate_limits`,
// `charity_batches`, `ops_events`, `waitlist`. Any route touching one of those
// must keep the service-role client.
//
// ── KEEPING THIS HONEST ────────────────────────────────────────────────────
// This is a snapshot, and a snapshot of someone else's state is exactly the
// thing that goes stale. `scripts/check-rls-manifest.ts` re-queries production
// and diffs it against this file. Run it before converting any route, and after
// any migration that adds or drops a policy.
//
// Verified against project wkppmpsvqkaxbekdgzdm on 2026-09-11.

/** Postgres `pg_policy.polcmd` values, as operations we actually perform. */
export type PolicyOp = 'select' | 'insert' | 'update' | 'delete'

/** `*` in pg_policy means ALL commands. */
export const ALL_OPS: readonly PolicyOp[] = ['select', 'insert', 'update', 'delete']

/**
 * table → the operations a user-scoped (JWT) client may perform on it.
 * An empty array means RLS is on and NOTHING is permitted: the service-role
 * client is mandatory there.
 */
export const RLS_POLICIES: Record<string, readonly PolicyOp[]> = {
  // Full CRUD
  plans:                    ['select', 'insert', 'update', 'delete'],
  session_metric_overrides: ['select', 'insert', 'update', 'delete'],
  session_reflections:      ['select', 'insert', 'update', 'delete'],
  // `*` (ALL) policies
  push_subscriptions:       ALL_OPS,
  session_completions:      ALL_OPS,
  session_overrides:        ALL_OPS,
  // Read + insert + update, no delete
  free_insights:            ['select', 'insert', 'update'],
  plan_adjustments:         ['select', 'insert', 'update'],
  post_race_reshapes:       ['select', 'insert', 'update'],
  run_analysis:             ['select', 'insert', 'update'],
  user_settings:            ['select', 'insert', 'update'],
  weekly_reports:           ['select', 'insert', 'update'],
  // Read + insert + delete, no update
  plan_weekly_notes:        ['select', 'insert', 'delete'],
  // Restored to production 2026-09-11 after being absent for months.
  daily_coach_notes:        ['select', 'insert', 'update'],
  // Read + insert only
  phase_summaries:          ['select', 'insert'],
  plan_archive:             ['select', 'insert'],
  race_readiness_notes:     ['select', 'insert'],
  // Read only — a write here silently fails under a JWT client
  charity_codes:            ['select'],
  health_daily_samples:     ['select'],
  strava_activities:        ['select'],
  subscriptions:            ['select'],
  session_catalogue:        ['select'],   // public read
  session_guidance:         ['select'],   // public read
  // Notifications: read + mark-read. No insert policy — the server creates them.
  notifications:            ['select', 'update'],
  // Insert only — clients emit, nobody reads back under their own identity
  analytics_events:         ['insert'],
  // ── RLS ON, ZERO POLICIES. Service role only. ────────────────────────────
  ai_rate_limits:           [],
  charity_batches:          [],
  ops_events:               [],
  waitlist:                 [],
}

/** Does a user-scoped client cover every operation this route needs? */
export function isCoveredByRls(table: string, ops: readonly PolicyOp[]): boolean {
  const allowed = RLS_POLICIES[table]
  if (!allowed) return false          // unknown table: assume not covered
  return ops.every(op => allowed.includes(op))
}
