import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { waitUntil } from '@vercel/functions'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { getUserHRZones } from '@/lib/strava'
import { adaptHealthKitWorkout, adaptManualRun, type HealthKitWorkoutPayload, type ManualRunPayload } from '@/lib/health/adapter'
import { autoMatchAndAnalyse, getInternalBaseUrl } from '@/lib/coaching/autoAnalyse'
import { consolidateIncomingHealthKitRow } from '@/lib/coaching/healthkitConsolidate'
import { decideLateArrival } from '@/lib/coaching/lateArrivalGate'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'

// POST /api/health/ingest
//
// Accepts a HealthKit workout payload from the iOS sync, adapts it to the
// canonical strava_activities row shape, persists it, and triggers the same
// auto-match + AI analysis pipeline the Strava webhook uses.
//
// Auth: bearer token, ANY authenticated user. The ROW lands for everyone; the
// ANALYSIS is tier-gated on `activity_intelligence` further down (HK-FREE-INGEST-LINE-01,
// SLT 2026-10-07). ADR-011 makes HealthKit the system of record, and DS-06 forty lines
// below already held that logging is free.
//
// 🔴 THIS HEADER SAID THE OPPOSITE UNTIL 2026-10-08, AND THAT IS THE SECOND TIME THIS
// FILE HAS CONTRADICTED ITSELF. It read "Free users cannot ingest... the gate also
// lives client-side in lib/health/sync.ts" — describing a gate that had MOVED to the
// analysis below it, and naming a file that DOES NOT EXIST (there is no tier gate
// anywhere in `lib/health/`; verified, so the server-side move is not inert).
// `HK-NEVER-SYNCED-COHORT-01` was filed because this route's top contradicted its own
// DS-06 branch; the fix corrected the code and left a header asserting the old rule,
// which is the same defect pointing the other way. A reader deciding how urgent an
// ingest bug is would have read this first.

let _supabase: ReturnType<typeof createServiceClient> | undefined
function getSupabase(): any {
  return (_supabase ??= createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ))
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 })
  }

  // DS-06 — manual run entry. FREE: any authenticated user may log a run by hand
  // (stored for history / R25 cohorts / load). Branches BEFORE the PAID
  // activity_intelligence gate — logging is free, richer analysis stays gated
  // downstream (/api/analyse-run/manual). Same gateway (INV-DATA-008), isolated
  // from the HealthKit machinery below.
  if ((body as { source?: string } | null)?.source === 'manual') {
    return handleManualIngest(user.id, body as Partial<ManualRunPayload>)
  }

  // 🔴 HK-FREE-INGEST-LINE-01 (SLT, 2026-10-07) — THE ROW LANDS FOR EVERYONE. THE
  // COACHING DOES NOT.
  //
  // This route used to 403 a free runner before storing anything, and that
  // CONTRADICTED THE RULING FORTY LINES ABOVE IT. DS-06's comment states the
  // doctrine: "logging is free, richer analysis stays gated downstream". So a free
  // runner could TYPE "8km, 45 minutes" by hand and we stored it forever, while the
  // identical run measured by their watch was thrown away. Same user, same route,
  // same table, opposite answers.
  //
  // MEASURED: 7 of the 13 users who have never had a run arrive are free tier. One
  // sweep reported `workouts_found: 10, posted: 0, failed: 10` — HealthKit HAD their
  // runs and the server refused all ten.
  //
  // ⚠️ AND IT IS IRREVERSIBLE. The client looks back 30 days, so a run refused today
  // is unrecoverable next month even if the runner subscribes. 🧠 Sutherland: when one
  // side of a decision is undoable and the other is free, you do not need a conversion
  // model. ADR-011 makes HealthKit the SYSTEM OF RECORD, and we were discarding it
  // while accepting the hand-typed substitute.
  //
  // 🔴 WHAT STAYS PAID, AND THIS IS THE WHOLE TRAP: `autoMatchAndAnalyse` below
  // triggers the AI read, the score and a push. Letting the row land while leaving
  // that trigger in place would hand free users the paid product. The gate moves from
  // the TOP of the route to the ANALYSIS, which is where DS-06 put it. Every other
  // surface is gated at its own route and is untouched: /api/analyse-run,
  // /api/weekly-report, /api/phase-summary, /api/health/samples.
  const tier = await getUserTier(user.id)
  const canAnalyse = isFeatureAllowed('activity_intelligence', tier)

  const payload = body as HealthKitWorkoutPayload

  // 🔴 HK-INGEST-REASON-01 (2026-10-08) — THE REJECTION IS NOW RECORDED, AND ZERO
  // `health_ingest_failed` ROWS IS WHAT PROVED IT HAD TO BE.
  //
  // Measured: 14 sweeps on 2026-10-08 reported `failed: 1` with no reason, and one user
  // has 22 sweeps that found workouts and NEVER posted. `health_ingest_failed` is
  // recorded further down this route and has **zero rows ever**, which eliminates the
  // upsert entirely: the request is rejected BEFORE the route does any work, and every
  // early return here was silent on both sides.
  //
  // ⚠️ `!payload.totalDistanceMeters` REJECTS ZERO, which is the leading hypothesis and
  // the reason this event names the field. `clientSync` sends
  // `totalDistance ?? 0`, so an indoor or treadmill run with no GPS and no footpod is a
  // legitimate run that can NEVER be stored — it is re-offered on every sweep and
  // rejected every time. ADR-011 makes HealthKit the system of record, and duration plus
  // HR are the coaching-relevant parts, so discarding it is not obviously correct.
  // **Whether to accept it is a separate decision; this event is what makes it decidable.**
  // ✅ HK-ZERO-DISTANCE-RUN-01 (2026-10-08) — A RUN WITH NO DISTANCE IS STILL A RUN.
  //
  // 🔴 `!payload.totalDistanceMeters` REJECTED ZERO, and `clientSync` sends
  // `totalDistance ?? 0`. So an indoor or treadmill run — no GPS, no footpod — was
  // rejected with a 422 **every single time it was offered**, forever.
  //
  // 📐 Measured the moment the new logging landed: `distance_m: 0, duration_s: 1941,
  // source_name: "Connect"` — a real 32-minute Garmin run, permanently refused.
  //
  // ⚠️ ADR-011 MAKES HEALTHKIT THE SYSTEM OF RECORD, and §80 holds that for a
  // duration-anchored runner the prescription IS their time on feet. A 32-minute run with
  // a heart-rate trace is exactly the data the coaching uses; discarding it because the
  // treadmill did not report metres contradicts both.
  //
  // Distance is now OPTIONAL and duration is REQUIRED — a run must be measurable on at
  // least one axis, and time on feet is the one HealthKit always has.
  const missing = [
    !payload.uuid && 'uuid',
    !payload.startDate && 'startDate',
    !payload.durationSeconds && 'durationSeconds',
  ].filter(Boolean) as string[]
  if (missing.length) {
    await recordOpsEvent('health_ingest_rejected', {
      status:  422,
      missing: missing.join(','),
      // The VALUES, not just the names: `totalDistanceMeters: 0` and `undefined` are
      // different findings and `!x` cannot tell them apart.
      distance_m:       payload.totalDistanceMeters ?? null,
      duration_s:       payload.durationSeconds ?? null,
      has_uuid:         payload.uuid != null,
      has_start:        payload.startDate != null,
      source_name:      payload.sourceName ?? null,
    }, user.id)
    return NextResponse.json({ error: `missing or zero: ${missing.join(', ')}` }, { status: 422 })
  }
  if (payload.workoutType !== 'running') {
    return NextResponse.json({ status: 'ignored', reason: 'non-run workout' })
  }

  const userId = user.id
  const supabase = getSupabase()
  const zones = await getUserHRZones(supabase, userId)

  const row = adaptHealthKitWorkout(userId, payload, zones)

  // INGEST-DEDUP-01 + HR-SYNC-01: if a Strava row or another HealthKit row
  // already covers this physical run (±5 min / ±5%), don't insert a duplicate.
  // The canonical row stays and keeps its completion/analysis links; we only
  // lift the HR summary onto it if it was missing one. When the lift happens
  // INSIDE the fresh-coaching window, re-trigger analyse-run so the score card
  // and reframe reflect real HR. When OUTSIDE the window, the consolidate
  // helper already stamped hr_arrived_late_at — we skip the trigger here so
  // the user doesn't get a stale fresh reframe two days after the run
  // (Hutchinson, ADR-011 §5).
  const dedup = await consolidateIncomingHealthKitRow(supabase, userId, row)
  if (dedup.skipped) {
    // HR-LATE-RESCORE-01 — no longer gated on `withinFreshWindow`. A stale
    // arrival re-scores without a narrative (see the longer note on the
    // same-uuid path below); only the reframe is withheld.
    if (dedup.hrLifted && dedup.canonicalAppleHealthUuid) {
      const { data: canonicalAnalysis } = await supabase
        .from('run_analysis')
        .select('week_n, session_day')
        .eq('user_id', userId)
        .eq('apple_health_uuid', dedup.canonicalAppleHealthUuid)
        .maybeSingle()
      if (canonicalAnalysis) {
        // HK-FREE-INGEST-LINE-01 — the SECOND of three analysis triggers in this
        // route. It re-runs analyse-run, so it is the paid product too.
        if (canAnalyse) waitUntil(triggerHrRefreshAnalysis(userId, dedup.canonicalAppleHealthUuid,
          canonicalAnalysis.week_n, canonicalAnalysis.session_day,
          dedup.withinFreshWindow === false))
      }
    }
    return NextResponse.json({ status: 'deduped', canonical_id: dedup.canonicalId })
  }

  // Capture the existing row's state before the upsert. Three things we need
  // to know:
  //   1. wasHrAbsent — was HR missing on the existing row? Drives whether
  //      this is an HR-arrival event worth re-analysing.
  //   2. hr_present_at_first_query — set ONCE on insert; preserved on resync.
  //      Drives the instrumentation cohort (Fried/Traynor non-negotiable).
  //   3. workout-end staleness — if HR just arrived but the run is > 24h old,
  //      patch HR but skip the fresh-reframe trigger (Hutchinson).
  const { data: existingAct } = await supabase
    .from('strava_activities')
    .select('id, avg_hr, hr_present_at_first_query')
    .eq('user_id', userId)
    .eq('apple_health_uuid', payload.uuid)
    .maybeSingle()
  const isFirstInsert = existingAct == null
  const wasHrAbsent   = !!existingAct && existingAct.avg_hr == null && row.avg_hr != null

  // HR-SYNC-01 instrumentation: stamp the first-query state once on insert.
  // On resync, preserve whatever was set originally (Supabase upsert doesn't
  // expose a per-column UPDATE filter, so we set the field explicitly to its
  // existing value to make the preservation intent explicit).
  const rowToWrite = {
    ...row,
    hr_present_at_first_query: isFirstInsert
      ? (row.avg_hr != null)
      : existingAct!.hr_present_at_first_query ?? null,
  }

  // HR-SYNC-01: late-arrival stamp on the same-uuid resync path.
  // (Cross-source consolidate path stamps via consolidate helper above.)
  let lateArrival: ReturnType<typeof decideLateArrival> | null = null
  if (wasHrAbsent) {
    lateArrival = decideLateArrival(
      { workoutStartIso: payload.startDate, durationSeconds: payload.durationSeconds },
      new Date(),
    )
    if (!lateArrival.withinFreshWindow) {
      (rowToWrite as any).hr_arrived_late_at = new Date().toISOString()
    }
  }

  const { error } = await supabase
    .from('strava_activities')
    .upsert(rowToWrite, { onConflict: 'user_id,apple_health_uuid' })

  if (error) {
    // HEALTH-SYNC-OBS-01 — this was a `console.error` and nothing else. The
    // client's `postWorkout` reads only `res.ok`, so a 500 here left the runner's
    // run silently unsynced and left no record anywhere a human would look.
    console.error('[health-ingest] upsert failed', error.message)
    await recordOpsEvent('health_ingest_failed', {
      stage:   'upsert',
      message: error.message.slice(0, 500),
      uuid:    payload.uuid,
    }, userId)
    return NextResponse.json({ error: 'Persist failed' }, { status: 500 })
  }

  // HR just arrived for an already-linked + already-analysed session AND we're
  // still inside the fresh-coaching window — re-run analyse-run so the score
  // card + reframe reflect real HR. Stale arrivals (> 24h) are intentionally
  // skipped: the column is patched, the daily coach note can reference it
  // tomorrow via hr_arrived_late_at, but no fresh reframe.
  //
  // HR-LATE-RESCORE-01 (2026-09-13) — STALE ARRIVALS ARE NO LONGER SKIPPED
  // ENTIRELY, they are re-scored WITHOUT a fresh narrative.
  //
  // The gate's own contract above promises that a late patch still serves "the
  // zone ledger, weekly report, fitness signals". It did not: the patch writes
  // `strava_activities`, and every one of those consumers reads `run_analysis`.
  // So a >24h arrival left the analysis row permanently HR-null — measured
  // 2026-09-13, 1 of 12 no-HR analyses was stranded with the data sitting in the
  // activity row beside it. And since §108 Amendment 1 withholds the score when
  // HR is unmeasured, that run now shows no score forever despite having HR.
  //
  // The split the board's rule actually draws is NARRATIVE vs NUMBERS. "Two-day
  // stale coaching is dishonest" is about the reframe. A score is deterministic
  // arithmetic over stored columns and does not go stale. `scores_only` skips
  // the AI call and OMITS `feedback_text` from the upsert, so the original note
  // survives untouched.
  //
  // Defect fix restoring documented intent (the comment above is the intent),
  // so ADR-017-exempt from the Coaching Board.
  if (wasHrAbsent && lateArrival) {
    const { data: existingAnalysis } = await supabase
      .from('run_analysis')
      .select('week_n, session_day')
      .eq('user_id', userId)
      .eq('apple_health_uuid', payload.uuid)
      .maybeSingle()
    if (existingAnalysis) {
      // HK-FREE-INGEST-LINE-01 — the THIRD. Gating one of three would have handed
      // free users the paid read by a different door.
      if (canAnalyse) waitUntil(triggerHrRefreshAnalysis(userId, payload.uuid,
        existingAnalysis.week_n, existingAnalysis.session_day,
        !lateArrival.withinFreshWindow))
    }
  }

  // Auto-match + analysis runs in the background. Fire-and-forget via waitUntil
  // mirrors the Strava webhook behaviour (the AI step takes 5-15s).
  //
  // 🔴 HK-FREE-INGEST-LINE-01 — GATED HERE, not at the top of the route. This is the
  // paid product: the match, the score, the AI read and the link-time push. A free
  // runner gets their run stored and visible in the picker and can log the session by
  // hand; they do not get the coaching.
  if (canAnalyse) waitUntil(
    autoMatchAndAnalyse(
      supabase,
      userId,
      {
        id:                   payload.uuid,
        type:                 'Run',
        sport_type:           'Run',
        start_date:           payload.startDate,
        distance:             payload.totalDistanceMeters,
        moving_time:          payload.durationSeconds,
        elapsed_time:         payload.durationSeconds,
        total_elevation_gain: payload.elevationGainMeters ?? 0,
        average_heartrate:    row.avg_hr ?? undefined,
        max_heartrate:        row.max_hr ?? undefined,
        average_speed:        row.avg_speed ?? undefined,
        name:                 row.name,
      },
      { source: 'apple_health', appleHealthUuid: payload.uuid },
      getInternalBaseUrl(),
    ).catch(err => console.error('[health-ingest] auto-analyse failed', err))
  )

  return NextResponse.json({ status: 'ok', activity_id: row.apple_health_uuid })
}

// DS-06 — manual run insert. FREE, isolated from the HealthKit path above: no
// PAID gate, no HR-stream machinery, no auto-analyse trigger (the reflect flow
// calls /api/analyse-run/manual, which owns the manual coaching row and is where
// the PAID metric scoring lives). Just persists the source='manual' row so the
// run counts in history / R25 cohorts / load. Cross-source dedup is intentionally
// skipped — manual entry targets users with NO device, so a colliding Strava/HK
// row is not the expected case (documented limitation, ADR-011 §Manual entry).
async function handleManualIngest(
  userId: string,
  body: Partial<ManualRunPayload>,
): Promise<NextResponse> {
  if (!body.manualUuid || !body.startDate || !body.distanceMeters || !body.durationSeconds) {
    return NextResponse.json(
      { error: 'manualUuid, startDate, distanceMeters, durationSeconds required' },
      { status: 422 },
    )
  }

  const row = adaptManualRun(userId, body as ManualRunPayload)
  const { error } = await getSupabase()
    .from('strava_activities')
    .upsert(row, { onConflict: 'user_id,manual_uuid' })

  if (error) {
    console.error('[health-ingest] manual upsert failed', error.message)
    return NextResponse.json({ error: 'Persist failed' }, { status: 500 })
  }

  return NextResponse.json({ status: 'ok', activity_id: row.manual_uuid })
}

// HR-SYNC-01: re-fire analyse-run silently when HR appears for a session that
// was already linked + analysed with no HR. Shared between the same-uuid
// resync path and the cross-source consolidation patch path. No push — the
// link-time notification already fired on the original ingest, and Wendy's
// habit rule says we don't re-trigger the post-run loop with a notification.
function triggerHrRefreshAnalysis(
  userId:           string,
  appleHealthUuid:  string,
  weekN:            number,
  sessionDay:       string,
  // HR-LATE-RESCORE-01 — true for HR that landed outside the fresh window:
  // recompute the numbers, leave the narrative alone.
  scoresOnly = false,
): Promise<void> {
  return fetch(`${getInternalBaseUrl()}/api/analyse-run`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'x-service-key': process.env.SUPABASE_SERVICE_ROLE_KEY!,
      'x-user-id':     userId,
    },
    body: JSON.stringify({
      apple_health_uuid: appleHealthUuid,
      week_n:            weekN,
      session_day:       sessionDay,
      scores_only:       scoresOnly,
    }),
  })
    .then(() => undefined)
    .catch(err => { console.error('[health-ingest] hr-refresh analyse failed', err) })
}
