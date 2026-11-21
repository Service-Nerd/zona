import { AI_LIMITS } from '@/lib/ai/limits'
import { getInternalBaseUrl } from '@/lib/coaching/autoAnalyse'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getStravaToken, fetchHRStreamSummary } from '@/lib/strava'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { tryEnrichHealthKitRow } from '@/lib/coaching/healthkitConsolidate'

// 🔴 AI-ROUTE-HTTP-HOP-CEILING-01 (2026-11-10) — THIS ROUTE AWAITS AN AI ROUTE OVER HTTP, SO IT
// NEEDS A CEILING OF ITS OWN. `OPS-FN-DURATION-01` set `maxDuration` on every route in
// `callAnthropic`'s IMPORT closure, and that population is right for the routes that CALL the
// model and wrong for the ones that WAIT on one — the two sets do not overlap. The fix made this
// exposure WORSE: the downstream may now hold for up to `CALL_TIMEOUT_MS` (240 s) where the
// platform used to cut it off, and the caller with no declared ceiling is what dies instead.
// ⚠️ Vercel cannot read `AI_LIMITS` from a route config, so the literal is duplicated here and
// `aiRouteHopCeiling.test.ts` is the link that fails if they disagree.
export const maxDuration = 300

// POST /api/strava/link-activity
// Called when a user manually links a run to a planned session. Apple Health is the system of record (ADR-011,
// STRAVA-WEBHOOK-SOR-01). An `apple_health_uuid` re-triggers analyse-run on that row. A `strava_activity_id` only
// patches a matching, unattached Apple Health row (tryEnrichHealthKitRow) and answers `enriched_healthkit` without
// triggering analysis itself; with no Apple Health run it is refused with 409 `discarded_no_healthkit_match`, nothing
// is stored, and the completion's link is left as it is (a client clean-up was trimmed, STRAVA-SOR-REVIEW-FIX-03).

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('activity_intelligence', tier)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const body = await req.json()
  const { strava_activity_id, apple_health_uuid, week_n, session_day } = body as {
    strava_activity_id?: number
    apple_health_uuid?:  string
    week_n: number
    session_day: string
  }
  if (week_n == null || !session_day) {
    return NextResponse.json({ error: 'week_n, session_day required' }, { status: 422 })
  }
  if (!strava_activity_id && !apple_health_uuid) {
    return NextResponse.json({ error: 'strava_activity_id or apple_health_uuid required' }, { status: 422 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // HealthKit path: the activity already lives in strava_activities (written by
  // /api/health/ingest), so there's no external API to call. The completion row
  // was already written client-side in saveCompletion — all that's left is to
  // (re)trigger analyse-run, which writes the run_analysis row keyed by
  // apple_health_uuid. Idempotent: safe even if auto-match already analysed it.
  if (apple_health_uuid) {
    // 🔴 GTM-SITE-01 / AI-ROUTE-HTTP-HOP-CEILING-01 (2026-11-10) — `getInternalBaseUrl()` is the
    // ONE OWNER of the server→server base, and this file was the last copy of the hand-built
    // fallback it replaced. The owner's own comment states the consequence: `VERCEL_URL`
    // "carries Vercel Deployment Protection and is not the canonical host", and it "silently
    // degraded the no-app run-analysis on both ingest paths after 2026-09-10". This route had
    // the same bypass, TWICE, so a manually linked Strava run triggered analysis against a
    // protected deployment URL — and the catch below only `console.warn`s, so it said nothing.
    const baseUrl = getInternalBaseUrl()
    try {
      await fetch(`${baseUrl}/api/analyse-run`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'x-service-key': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          'x-user-id':     user.id,
        },
        body: JSON.stringify({ apple_health_uuid, week_n, session_day }),
        // AI-ROUTE-HTTP-HOP-CEILING-01 — bound the hop, or the CALLER is what dies.
        signal: AbortSignal.timeout(AI_LIMITS.HOP_TIMEOUT_MS),
      })
    } catch (err) {
      console.warn('[link-activity] healthkit analyse-run trigger failed', err)
    }
    return NextResponse.json({ ok: true, mode: 'healthkit' })
  }

  // ── Strava path (strava_activity_id guaranteed present below) ──
  if (!strava_activity_id) {
    return NextResponse.json({ error: 'strava_activity_id required' }, { status: 422 })
  }

  // user_settings PK is `id` (referencing auth.users.id) — same column-name bug pattern fixed in 991c617.
  const { data: settings } = await supabase
    .from('user_settings')
    .select('strava_refresh_token')
    .eq('id', user.id)
    .single() as { data: { strava_refresh_token: string } | null; error: unknown }

  if (!settings?.strava_refresh_token) {
    console.warn(`[link-activity] no strava_refresh_token for user ${user.id}`)
    return NextResponse.json({ error: 'Strava not connected' }, { status: 400 })
  }

  const { access_token } = await getStravaToken(settings.strava_refresh_token)

  const actRes = await fetch(
    `https://www.strava.com/api/v3/activities/${strava_activity_id}`,
    { headers: { Authorization: `Bearer ${access_token}` }, cache: 'no-store' }
  )
  if (!actRes.ok) {
    console.warn(`[link-activity] activity fetch failed ${strava_activity_id} -> ${actRes.status}`)
    return NextResponse.json({ error: 'Strava activity fetch failed', status: actRes.status }, { status: 502 })
  }
  const activity = await actRes.json()

  if (activity.type !== 'Run' && activity.sport_type !== 'Run') {
    console.warn(`[link-activity] not a run ${strava_activity_id} type=${activity.type}/${activity.sport_type}`)
    return NextResponse.json({ error: 'Activity is not a run' }, { status: 422 })
  }

  const hrSummary = await fetchHRStreamSummary(supabase, access_token, strava_activity_id, user.id)

  // HealthKit-primary architecture: if the user already has a HealthKit row
  // for this workout, patch it in place rather than create a duplicate.
  const consolidation = await tryEnrichHealthKitRow(supabase, user.id, activity, hrSummary)
  if (consolidation.enriched) {
    return NextResponse.json({ ok: true, mode: 'enriched_healthkit' })
  }

  // STRAVA-WEBHOOK-SOR-01 (founder 2026-11-21, ADR-011 §3, INV-DATA-008): Apple Health is the system of record.
  // A Strava activity with no matching Apple Health run is NOT stored. It used to be upserted as `source: 'strava'`
  // and analysed here, the same breach as the webhook's.
  await recordOpsEvent('strava_activity_discarded', { reason: 'no_healthkit_match', strava_activity_id, via: 'link-activity' }, user.id)
  return NextResponse.json({ ok: false, mode: 'discarded_no_healthkit_match' }, { status: 409 })
}
