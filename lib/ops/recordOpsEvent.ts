import { createClient } from '@supabase/supabase-js'

// OPS-01: internal operational telemetry (owned Supabase, no third-party vendor).
//
// SERVER-ONLY. Uses the service-role key, so never import this into a client
// component / isomorphic module (e.g. lib/plan.ts is imported by DashboardClient
// — do not pull this in there). The daily integrity probe backstops any write
// failure that can't be recorded at its site.

export type OpsEventKind =
  | 'plan_save_failed'          // savePlanForUser threw on a server reshape/write path
  | 'plan_integrity_mismatch'   // an auto_applied adjustment never landed in plan_json (probe)
  | 'reshape_invalid'           // a reshaped plan failed a constitutional invariant (prod soft-degrade)
  | 'plan_enrich_failed'        // AI enrichment silently fell back to rule-engine output (GEN-FIX-02)
  | 'plan_rule_invalid'         // a GENERATED rule plan violated its own constitution (ENRICH-ATTRIB-01)
  // ENRICH-SERVER-SAVE-01 (2026-09-04) — the server's own persist of the enriched
  // plan. `_saved` is the SUCCESS case and is recorded deliberately: it is the
  // only evidence that the backstop caught a runner who closed the app, and a
  // backstop nobody can see firing is one nobody trusts.
  | 'plan_enrich_server_saved'
  | 'plan_enrich_server_save_failed'
  // GTM-CHARITY-03 (2026-09-11) — a RevenueCat webhook event the handler has no
  // mapping for. It used to reply "received" and do nothing, which is why a
  // comp grant could fail without a trace: the subscriptions row was never
  // written, getUserTier stayed 'free', and the runner met a paywall we thought
  // we had lifted. Unhandled is still the correct BEHAVIOUR (we must not guess a
  // status), but it must be visible.
  | 'revenuecat_event_unhandled'
  // SEC-08 sweep (2026-09-11) — the daily coach note's CACHE could not be read
  // or written. Found because `daily_coach_notes` did not exist in production
  // at all: the migration was committed AND recorded in the applied-migrations
  // ledger, but never landed. Both call sites discarded their error, so the
  // only symptom was an Anthropic call on every app open instead of one per
  // user per day. A cache that silently never hits is indistinguishable from a
  // cache that works, which is why this needs a trace and not a comment.
  | 'coach_note_cache_unavailable'
  // TIER-ENFORCE-01 (2026-09-11) — the distance paywall now exists server-side.
  // A legitimate client cannot reach it (the wizard locks the tile using the
  // SAME predicate), so every firing is either a hand-crafted request or a bug
  // in tier resolution. The second would be far worse than the first: it would
  // mean a paying or comped runner being refused a plan. Recorded so the
  // difference is visible rather than inferred from a support email.
  | 'plan_distance_gate_blocked'

/**
 * Record an internal ops event. Fire-and-forget by nature but awaitable, so a
 * caller can guarantee the row lands before it rethrows the original error.
 *
 * NEVER throws: telemetry must not break the path it monitors. If the insert
 * itself fails, it degrades to a console.error and returns.
 */
export async function recordOpsEvent(
  kind: OpsEventKind,
  detail: Record<string, unknown> = {},
  userId: string | null = null,
): Promise<void> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { error } = await supabase.from('ops_events').insert({ kind, user_id: userId, detail })
    if (error) console.error('[ops] failed to record event', kind, error.message)
  } catch (err) {
    console.error('[ops] failed to record event', kind, err)
  }
}
