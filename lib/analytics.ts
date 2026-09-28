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
  // ── OPS-FUNNEL-01 (2026-09-28) — the upgrade funnel ────────────────────────
  //
  // 🔴 WHY: the 1 January trial-to-paid gate reads `v_trial_conversion`, which can
  // report a RATE and nothing else. Measured in production 2026-09-28, this table
  // held 192 rows of exactly ONE event type (`coach_open`), so if that gate reads
  // 0% the data could not distinguish "nobody reached the paywall" from "they
  // reached it and left" from "they tried to buy and it failed". The denominator
  // was observable and the numerator was observable; everything between them was
  // not. `design-rulings.md` (the SLT-killed merchandising screen) names the same
  // hole from the other side: "we would be designing a funnel nobody has observed."
  //
  // Three events, one per answerable question: was it SEEN, was it TRIED, what
  // HAPPENED. Behavioural only — no price, no receipt, no identifier.
  /** The Upgrade screen mounted. `props.reason` is `upgradeFraming()`'s variant
   *  (gain | trial-ended | grant-ended), reused rather than re-derived. */
  | 'upgrade_view'
  /** Subscribe tapped. `props`: { annual, platform }. Fires BEFORE the store sheet,
   *  so a sheet that never opens is still visible as an attempt with no result. */
  | 'upgrade_purchase_attempt'
  /** How it ended. `props.outcome`: success | cancelled | failed.
   *  ⚠️ `cancelled` is NOT a failure and must stay separable — a funnel that
   *  counts a dismissed StoreKit sheet as a broken purchase would send someone
   *  hunting a defect that does not exist. */
  | 'upgrade_purchase_result'
  // ── OPS-ATTRIB-01 (2026-09-28) — where did this runner come from? ─────────
  //
  // 🔴 WHY: 27 accounts and no idea how any of them arrived. You cannot tell a
  // LinkedIn post from a Make-A-Wish code from a Google search, so when installs
  // move there is no way to know which effort moved them. This is the cheapest
  // possible answer: one tap, once, never again.
  //
  // Design Board 2026-09-28 — SHIP WITH AMENDMENT: Today, BELOW the session card
  // (Silvanto: "today's job is the next decision; this is admin"), visually inert,
  // one tap to answer or dismiss, never returns. Behaviour-triggered — it renders
  // only once a plan exists, which is `design-rulings.md:266`'s rule applied to a
  // non-upgrade prompt. Success condition, stated before the design: **40% of new
  // accounts within 30 days.**
  //
  // ⚠️ THE ANSWER LIVES ONLY HERE, and that is deliberate. The consistent choice
  // was a 7th `user_settings` ask-once column (`orientation_seen`,
  // `push_permission_seen`, `connect_runs_seen` + three `*_dismissed_at` already
  // exist). It was rejected because DDL cannot be applied from here, so that ships
  // a DEAD FEATURE waiting on hand-run SQL. The PURPOSE is an aggregate count, not
  // a per-user lookup, and `analytics_events` answers that. Suppression uses
  // `localStorage`, which is what per-viewer convenience state is for.
  // ACCEPTED IMPERFECTION: a second device may ask once more.
  /** A source was chosen. `props.source` is one of ATTRIBUTION_SOURCES. */
  | 'attribution_answered'
  /** Dismissed without answering. Recorded because "chose not to say" and "never
   *  saw it" are different facts, and only one of them is a design problem. */
  | 'attribution_dismissed'
  // ── OPS-ARTIFACT-REACH-01 (2026-09-28) — are the two shipped restraint
  // artifacts ever reached? ─────────────────────────────────────────────────
  //
  // 🔴 MEASURED BEFORE BUILDING: only **2 users** can see the share button at all
  // (it needs a CURRENT weekly report carrying a `zone_discipline_score`), and
  // `analytics_events` held exactly ONE event type, so nobody could say whether
  // the button had ever been pressed. The SLT declined to touch the UX or the
  // marketing of `LEDGER-01` / `SHARE-01` until these exist.
  //
  // ⚠️ `weekly_reports.opened_at` EXISTS AND IS WRITTEN BY NOTHING. An event is
  // used instead of wiring the column: a column nothing writes is how "0 reports
  // opened" nearly got quoted as a measurement.
  /** The weekly report card was rendered with a report in it. */
  | 'weekly_report_open'
  /** The "Weeks within the lines" ledger was rendered with a resolved snapshot. */
  | 'ledger_view'
  /** Share tapped. Fires BEFORE the platform sheet, so a sheet that never opens is
   *  still visible as an attempt with no result. */
  | 'share_week_pressed'
  /** How the share ended. `props.outcome`: shared | cancelled | failed. */
  | 'share_week_result'

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

/**
 * How a purchase attempt ended, for `upgrade_purchase_result`.
 *
 * ⚠️ `redirected` EXISTS SO THE WEB PATH IS NOT COUNTED AS A SALE. On web,
 * `handleSubscribe` hands off to Stripe Checkout and the purchase completes on
 * Stripe's domain, so the app never observes the outcome — the webhook does.
 * Recording that handoff as `success` would overstate conversion on exactly the
 * number the 1 January gate reads, which is the failure mode this instrumentation
 * exists to prevent rather than create. `success` is reserved for a StoreKit
 * purchase that actually resolved.
 */
export type PurchaseOutcome = 'success' | 'redirected' | 'cancelled' | 'failed'

/**
 * Did the USER dismiss the store sheet, rather than the purchase failing?
 *
 * 🔴 SINGLE OWNER, because this rule already existed TWICE in `UpgradeScreen` and
 * the two copies had drifted: `handleSubscribe` tested `err?.userCancelled === true`
 * and `handleRestore` tested `err?.userCancelled` (truthy). Nothing was visibly
 * broken — both reach the same verdict for RevenueCat's actual boolean — but it is
 * one rule with two answers, which is the class this repo keeps paying for
 * (TIER-OWNER-01, DELOAD-OWNER-01, SESSION-KM-01).
 *
 * Now it matters more than it did: it decides whether the funnel records a
 * `cancelled` or a `failed`, and those two lead to opposite conclusions about
 * whether the purchase path works. STRICT `=== true` is kept deliberately — a
 * truthy test would classify any object-shaped `userCancelled` as a cancellation
 * and hide a real failure as a shrug.
 */
export function isUserCancelled(err: unknown): boolean {
  return (err as { userCancelled?: unknown } | null | undefined)?.userCancelled === true
}

/** The outcome to record for a thrown purchase error. */
export function purchaseOutcome(err: unknown): Extract<PurchaseOutcome, 'cancelled' | 'failed'> {
  return isUserCancelled(err) ? 'cancelled' : 'failed'
}

/**
 * The attribution options, in the order the runner sees them.
 *
 * ⚠️ A NAMED CONSTANT, not literals in the component, because this list is also
 * the vocabulary every future query groups by. Adding a source here is the whole
 * change; a seventh string typed into JSX would be invisible to the analysis.
 *
 * ⚠️ NO "other (please specify)". Wroblewski's condition: one tap to answer, zero
 * typing — a free-text field is a keyboard outdoors, and the long tail is not worth
 * the tap. `other` exists as a tap, not a prompt.
 */
export const ATTRIBUTION_SOURCES = [
  { id: 'linkedin',  label: 'LinkedIn' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok',    label: 'TikTok' },
  { id: 'friend',    label: 'A friend or my club' },
  { id: 'charity',   label: 'A charity place' },
  { id: 'search',    label: 'Search' },
  { id: 'other',     label: 'Somewhere else' },
] as const

export type AttributionSource = typeof ATTRIBUTION_SOURCES[number]['id']

/** The one `localStorage` key that suppresses the row. Exported so the test and the
 *  component cannot disagree about its spelling — the drift class this repo keeps
 *  paying for. */
export const ATTRIBUTION_STORAGE_KEY = 'zona_attribution_answered'

/**
 * Has this viewer already answered or dismissed?
 *
 * NEVER THROWS. `localStorage` is absent in SSR, throws in some private-browsing
 * modes, and can be cleared at any time. Every failure resolves to "not yet
 * answered", which shows the row again — the safe direction for a dismissible row,
 * and the only one that cannot lose data.
 */
export function attributionAnswered(): boolean {
  try {
    return typeof window !== 'undefined'
      && window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Record that this viewer has answered or dismissed. Never throws, for the same
 *  reasons; a failed write means the row reappears, which is recoverable. */
export function markAttributionAnswered(): void {
  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, '1')
  } catch { /* a reappearing row is better than a thrown error on Today */ }
}

/**
 * The signed-in user id, for a fire-and-forget event at a call site that does not
 * already hold one.
 *
 * 🔴 ONE OWNER, because three surfaces need it and three copies of
 * `auth.getUser()` is the drift class this repo keeps paying for (TIER-OWNER-01,
 * DELOAD-OWNER-01). `UpgradeScreen` had the first copy; `ShareWeekButton` and the
 * weekly-report card would have been the second and third.
 *
 * NEVER THROWS and never rejects. A null return means `trackEvent` no-ops, which
 * is the correct outcome: telemetry must not break the surface it measures.
 */
export async function currentUserId(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser()
    return data?.user?.id ?? null
  } catch {
    return null
  }
}

/**
 * OPS-FUNNEL-02 — which door sent the runner to the paywall.
 *
 * 🔴 A NAMED VOCABULARY, not literals at nine call sites. `upgrade_view` already
 * told us the paywall was seen; it could not say whether the Coach teaser
 * converts better than Me, which is the question `design-rulings.md`'s killed
 * merchandising screen could not be argued without.
 *
 * Two of these are DEEP LINKS rather than in-app doors (`link_email`,
 * `link_strava`) and are deliberately distinguished: a paywall arrived at from an
 * email is a different event from one tapped inside the app.
 */
export const UPGRADE_SOURCES = [
  'today', 'coach_teaser', 'coach_teaser_empty', 'me', 'session', 'wizard',
  'recal_tile', 'link_email', 'link_strava',
] as const

export type UpgradeSource = typeof UPGRADE_SOURCES[number]
