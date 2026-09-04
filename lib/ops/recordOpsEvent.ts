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
