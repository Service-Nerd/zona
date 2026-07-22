import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Behavioural analytics events (INSTRUMENT-01).
 *
 * This union is the single source of truth for event names. The `analytics_events`
 * table has no CHECK constraint on `event`, so a new event ships by adding a member
 * here — no migration needed (mirrors NotificationType in lib/notifications.ts).
 *
 * Keep events behavioural. Never put PII or user content in `props`.
 */
export type AnalyticsEvent =
  | 'coach_open' // user navigated into the Coach screen — powers the CO-ONE engagement gate

/**
 * Fire-and-forget telemetry write.
 *
 * Never throws and never blocks the UI: a dropped analytics event is not a
 * user-facing failure. The insert runs in the background; RLS allows the client
 * to INSERT its own rows but not read them (all analysis is owner/service-role
 * via the report views). A no-op when `userId` is not yet known.
 */
export function trackEvent(
  supabase: SupabaseClient,
  userId: string | null,
  event: AnalyticsEvent,
  props: Record<string, unknown> = {},
): void {
  if (!userId) return
  void supabase
    .from('analytics_events')
    .insert({ user_id: userId, event, props })
    .then(({ error }) => {
      if (error) console.warn('[analytics] event dropped:', event, error.message)
    })
}
