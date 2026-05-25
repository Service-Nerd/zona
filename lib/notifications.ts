import { createClient } from '@supabase/supabase-js'

// NOTIF-01 — durable record of every push the app sends. One row per user per
// event (callers that loop per-device must dedupe). Reads + mark-read happen
// from the browser client under RLS; inserts are service-role only.
// Contract: docs/contracts/api/notifications.md

export type NotificationType =
  | 'daily_training'
  | 'weekly_report'
  | 'trial_insight'
  | 'run_feedback'
  | 'plan_adjustment'

export interface NotificationInput {
  type:  NotificationType
  title: string
  body:  string
  /** Deep link — mirror the push payload's `data.url` so the inbox row and the
   *  push it shadows can't diverge. */
  url?:  string
}

/**
 * Records a sent notification for the inbox/bell. Best-effort: never throws.
 * A failed inbox write must not break a cron run, a plan save, or a run
 * auto-link (ADR-006 — "enricher failure is silent"). Call it adjacent to the
 * push send, reusing the same title/body/url already built for the payload.
 */
export async function recordNotification(
  userId: string,
  n: NotificationInput,
): Promise<void> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      type:    n.type,
      title:   n.title,
      body:    n.body,
      url:     n.url ?? null,
    })
    if (error) console.warn('[notifications] record failed:', error.message)
  } catch (err) {
    console.warn('[notifications] record threw:', err instanceof Error ? err.message : err)
  }
}

// Retention window for the inbox. Read rows older than this are pruned so the
// daily-training push (one row every training morning) can't grow the table
// unbounded. Unread rows are kept — the user hasn't seen them. Ops constant,
// not a coaching numeric (a coach wouldn't tune inbox retention), so it lives
// inline rather than in GENERATION_CONFIG.
const NOTIFICATION_RETENTION_DAYS = 30

/**
 * Housekeeping: delete READ notifications older than the retention window.
 * Best-effort, never throws. Folded into the weekly-report cron rather than a
 * new Vercel cron (Hobby plan caps at 2). Weekly cadence means rows live up to
 * ~37 days — immaterial for a 30-day target.
 */
export async function pruneReadNotifications(): Promise<void> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const cutoff = new Date(Date.now() - NOTIFICATION_RETENTION_DAYS * 86_400_000).toISOString()
    const { error } = await supabase
      .from('notifications')
      .delete()
      .not('read_at', 'is', null)
      .lt('created_at', cutoff)
    if (error) console.warn('[notifications] prune failed:', error.message)
  } catch (err) {
    console.warn('[notifications] prune threw:', err instanceof Error ? err.message : err)
  }
}
