// DB-USER-PURGE-01 — the single owner of "what data belongs to one runner, and
// how does it go away when the account does".
//
// ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
// It does NOT perform deletion. The DATABASE performs deletion, via ON DELETE
// CASCADE foreign keys to auth.users (20260923_user_data_cascade.sql), because
// a delete list living in a route is correct the day it is written and wrong
// the day someone adds the next table. `/api/delete-account` named three
// tables out of twenty-four for months and every surface that described it —
// the route's own test exemption, the Me screen, the privacy policy — asserted
// it named all of them.
//
// This file is the DECLARATION the gate checks the live schema against. Its job
// is to make a new user-scoped table impossible to add silently: `npm run
// check:db` discovers user-keyed tables FROM THE SCHEMA and fails when one is
// not classified here. Discovery is schema-driven on purpose — a checker that
// iterates the same list it guards is blind to that list being wrong, which is
// how WEEK_KEYED_TABLES shipped incomplete and how supersedeCoverage.test.ts
// failed to notice.
//
// ⚠️ WHAT THIS FILE IS NOT. It is not the mechanism. Editing it deletes
// nothing. If you add a row here without adding the foreign key, the gate still
// fails — that is deliberate, and it is the only reason the declaration is
// worth keeping.

/** How an account's rows in a table stop being that account's rows. */
export type PurgeMode =
  /** FK to auth.users ON DELETE CASCADE. The row exists only to serve one runner. */
  | 'cascade'
  /** FK ON DELETE SET NULL. The row outlives the account, anonymised. */
  | 'set-null'
  /** No FK can reach it; the on_auth_user_deleted trigger clears it. */
  | 'trigger'

export interface UserDataSurface {
  table: string
  /** The column that carries the user identity. */
  column: string
  mode: PurgeMode
  /** Why this mode and not another. A row here is a DECISION, not a TODO. */
  why?: string
}

/**
 * Every store in the public schema that holds data belonging to one runner.
 *
 * Ordered as the schema lists them so a diff against `check:db` output reads
 * straight down.
 */
export const USER_DATA_SURFACES: readonly UserDataSurface[] = [
  // ── Profile and identity ────────────────────────────────────────────────
  { table: 'user_settings', column: 'id', mode: 'cascade',
    why: 'The profile row itself. Keyed on `id`, not `user_id` — the one table whose identity column is not named the way every other one is.' },

  // ── The plan and what the engine did to it ──────────────────────────────
  { table: 'plans',                    column: 'user_id', mode: 'cascade' },
  { table: 'plan_archive',             column: 'user_id', mode: 'cascade' },
  { table: 'plan_adjustments',         column: 'user_id', mode: 'cascade' },
  { table: 'plan_weekly_notes',        column: 'user_id', mode: 'cascade' },
  { table: 'phase_summaries',          column: 'user_id', mode: 'cascade' },
  { table: 'post_race_reshapes',       column: 'user_id', mode: 'cascade' },
  { table: 'race_readiness_notes',     column: 'user_id', mode: 'cascade' },

  // ── What the runner did ─────────────────────────────────────────────────
  { table: 'session_completions',      column: 'user_id', mode: 'cascade' },
  { table: 'session_overrides',        column: 'user_id', mode: 'cascade' },
  { table: 'session_reflections',      column: 'user_id', mode: 'cascade' },
  { table: 'session_metric_overrides', column: 'user_id', mode: 'cascade' },
  { table: 'weekly_reports',           column: 'user_id', mode: 'cascade' },

  // ── Health and activity (ADR-011: HealthKit is the SOR) ─────────────────
  { table: 'strava_activities',        column: 'user_id', mode: 'cascade',
    why: 'Source-agnostic run log despite the v1 name. Holds HealthKit-canonical rows, so this is the runner\'s training history, not a third-party mirror.' },
  { table: 'health_daily_samples',     column: 'user_id', mode: 'cascade',
    why: 'RHR / HRV / sleep. Special-category health data under GDPR Art.9 — the surface where incomplete erasure costs most.' },
  { table: 'run_analysis',             column: 'user_id', mode: 'cascade' },

  // ── Coaching output and messaging ───────────────────────────────────────
  { table: 'daily_coach_notes',        column: 'user_id', mode: 'cascade' },
  { table: 'free_insights',            column: 'user_id', mode: 'cascade' },
  { table: 'notifications',            column: 'user_id', mode: 'cascade' },
  { table: 'push_subscriptions',       column: 'user_id', mode: 'cascade',
    why: 'Holds the APNs device token. Left behind, a deleted account keeps receiving pushes — the most visible possible symptom of incomplete deletion.' },

  // ── Commercial ──────────────────────────────────────────────────────────
  { table: 'subscriptions',            column: 'user_id', mode: 'cascade' },

  // ── Telemetry ───────────────────────────────────────────────────────────
  { table: 'analytics_events',         column: 'user_id', mode: 'cascade',
    why: 'Behavioural events about one person. `user_id` is NOT NULL, so anonymising in place is not available; erasure means deletion.' },
  { table: 'ops_events',               column: 'user_id', mode: 'set-null',
    why: 'The AI spend ledger GET /api/ops/ai-spend reads (OPS-AI-OWNER-01). Nulling user_id anonymises the row and satisfies erasure; deleting it would silently rewrite what we actually spent.' },

  // ── The three the trigger has to reach ──────────────────────────────────
  { table: 'ai_rate_limits',           column: 'bucket_key', mode: 'trigger',
    why: 'Keyed `ai:<surface>:<uuid>` inside a TEXT column. There is no column for an FK to hold onto, so on_auth_user_deleted deletes by LIKE.' },
  { table: 'charity_codes',            column: 'claimed_by', mode: 'set-null',
    why: 'The code belongs to the BATCH, not the runner, so it is RELEASED back to the pool rather than deleted. The FK nulls claimed_by; the trigger clears claimed_at too, or the code reads as claimed by nobody and the batch cap stays spent (GTM-CHARITY-04).' },
  { table: 'waitlist',                 column: 'email',      mode: 'trigger',
    why: 'Email-keyed, so no FK reaches it. Deleting the account and then mailing the address about launch is the failure this prevents.' },
]

/** Tables in the public schema that hold no per-runner data. Named so the gate
 *  can tell "reference data" from "a table nobody classified yet". */
export const NON_USER_TABLES: Record<string, string> = {
  session_catalogue: 'Reference data — the session rows the engine selects from (ADR-010). Identical for every runner.',
  session_guidance:  'Reference data — why/how copy per session type and phase.',
  charity_batches:   'Partner-scoped, not runner-scoped. A batch outlives every runner who redeems from it.',
}

/**
 * Views that expose a `user_id` and therefore show up in any column-driven
 * scan of the schema — `information_schema.columns` does not distinguish a
 * view from a table.
 *
 * A view STORES NOTHING, so it needs no cascade: its rows disappear the moment
 * the base-table rows behind it do. They are declared rather than pattern-
 * matched on the `v_` prefix because two of them (`admin_user_directory`,
 * `admin_user_tiers`) do not carry it, and a convention that holds for five
 * names out of seven is not a convention.
 *
 * ⚠️ A NEW view will fail the gate until it is added here. That is deliberate.
 * The check cannot tell a view from a table it has never been told about, and
 * of the two possible errors — "declare this harmless view" and "a table of
 * runner data is silently surviving deletion" — only the first is safe to get
 * wrong.
 */
export const DERIVED_VIEWS: Record<string, string> = {
  admin_user_directory: 'Admin directory view over user_settings + auth.users.',
  admin_user_tiers:     'Admin tier view; resolves tier per user at read time.',
  v_coach_engagement:   'Engagement rollup over daily_coach_notes / notifications.',
  v_hr_present_pct:     'Share of activities carrying an HR stream (ADR-011 §5).',
  v_partner_cohort:     'Charity partner cohort rollup (GTM-CHARITY-04).',
  v_paying_users:       'Active-subscription rollup over subscriptions.',
  v_trial_conversion:   'Trial-to-paid funnel rollup.',
}

/** Discovery aliases: identity columns that are NOT called `user_id`. The gate
 *  searches the schema for these names as well, or it would miss exactly the
 *  tables that are easiest to forget. */
export const USER_ID_COLUMNS = ['user_id', 'claimed_by'] as const
