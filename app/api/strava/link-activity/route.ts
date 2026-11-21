import { AI_LIMITS } from '@/lib/ai/limits'
import { getInternalBaseUrl } from '@/lib/coaching/autoAnalyse'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getStravaToken, fetchHRStreamSummary, fetchStravaActivity } from '@/lib/strava'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { tryEnrichHealthKitRow } from '@/lib/coaching/healthkitConsolidate'
import { findRowByStravaId } from '@/lib/strava/stravaSor'
import { LINK_DISCARDED_MODE } from '@/lib/strava/linkActivity'

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
// STRAVA-WEBHOOK-SOR-01), so every path ends on the Apple Health row: run_analysis is keyed by its
// apple_health_uuid, and a Strava id only ever patches that row (tryEnrichHealthKitRow). A Strava activity with no
// Apple Health run is refused with 409 `discarded_no_healthkit_match`, and nothing is stored.

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

  // The Apple Health run this link resolves to, and how it got there.
  let hkUuid: string | null = apple_health_uuid ?? null
  let mode: 'healthkit' | 'enriched_healthkit' = 'healthkit'

  if (!hkUuid && strava_activity_id) {
    // STRAVA-SOR-REVIEW-FIX-01 — an id ALREADY on an Apple Health row is that run, not a discard. The merge only
    // matches an unattached row, so a re-link (or the auto-heal re-trying one) used to find "no match", record a
    // false discard and leave the session with no analysis. Asked first, so it costs no Strava call.
    const existing = await findRowByStravaId(supabase, user.id, strava_activity_id)
    if (existing?.source === 'apple_health' && existing.apple_health_uuid) {
      hkUuid = existing.apple_health_uuid
    } else {
      // user_settings PK is `id` (referencing auth.users.id), not `user_id`.
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
      const { status, activity } = await fetchStravaActivity(access_token, strava_activity_id)
      if (!activity) {
        console.warn(`[link-activity] activity fetch failed ${strava_activity_id} -> ${status}`)
        return NextResponse.json({ error: 'Strava activity fetch failed', status }, { status: 502 })
      }

      if (activity.type !== 'Run' && activity.sport_type !== 'Run') {
        console.warn(`[link-activity] not a run ${strava_activity_id} type=${activity.type}/${activity.sport_type}`)
        return NextResponse.json({ error: 'Activity is not a run' }, { status: 422 })
      }

      const hrSummary = await fetchHRStreamSummary(supabase, access_token, strava_activity_id, user.id)
      const consolidation = await tryEnrichHealthKitRow(supabase, user.id, activity, hrSummary)
      if (!consolidation.enriched || !consolidation.appleHealthUuid) {
        // STRAVA-WEBHOOK-SOR-01 (founder 2026-11-21, ADR-011 §3, INV-DATA-008): no Apple Health run, so it is NOT
        // stored. The client clears the completion's link on this answer (lib/strava/linkActivity.ts).
        await recordOpsEvent('strava_activity_discarded', { reason: 'no_healthkit_match', strava_activity_id, via: 'link-activity' }, user.id)
        return NextResponse.json({ ok: false, mode: LINK_DISCARDED_MODE }, { status: 409 })
      }
      hkUuid = consolidation.appleHealthUuid
      mode = 'enriched_healthkit'
    }
  }

  // STRAVA-SOR-REVIEW-FIX-02 — the completion names the Apple Health run it is linked to. The client saved it with the
  // Strava id only, so a later reader keyed by uuid (the auto-heal, the post-run screen, a Strava delete repointing the
  // link) found no completion for this run. The LIVE row only (COMPLETION-TOMBSTONE-01).
  const { error: completionErr } = await supabase
    .from('session_completions')
    .update({ apple_health_uuid: hkUuid })
    .eq('user_id', user.id)
    .eq('week_n', week_n)
    .eq('session_day', session_day)
    .is('superseded_at', null)
  if (completionErr) {
    console.error('[link-activity] completion uuid stamp failed', completionErr.message)
    await recordOpsEvent('strava_sor_write_failed', { stage: 'link_stamp_completion_uuid', message: completionErr.message.slice(0, 500) }, user.id)
  }

  // The analysis. The run already lives in strava_activities (written by /api/health/ingest), so all that is left is
  // to (re)trigger analyse-run, which writes the run_analysis row keyed by apple_health_uuid. Idempotent: safe even if
  // auto-match already analysed it. STRAVA-SOR-REVIEW-FIX-01: the enriched path reaches it too; it used to return
  // before any analysis, so a run linked from the Strava picker was never read.
  //
  // 🔴 GTM-SITE-01 / AI-ROUTE-HTTP-HOP-CEILING-01 (2026-11-10) — `getInternalBaseUrl()` is the ONE OWNER of the
  // server→server base. `VERCEL_URL` "carries Vercel Deployment Protection and is not the canonical host", and this
  // route once hand-built it, so the catch below (a `console.warn`) hid every failed trigger.
  const baseUrl = getInternalBaseUrl()
  try {
    await fetch(`${baseUrl}/api/analyse-run`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'x-service-key': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'x-user-id':     user.id,
      },
      body: JSON.stringify({ apple_health_uuid: hkUuid, week_n, session_day }),
      // AI-ROUTE-HTTP-HOP-CEILING-01 — bound the hop, or the CALLER is what dies.
      signal: AbortSignal.timeout(AI_LIMITS.HOP_TIMEOUT_MS),
    })
  } catch (err) {
    console.warn('[link-activity] healthkit analyse-run trigger failed', err)
  }
  return NextResponse.json({ ok: true, mode })
}
