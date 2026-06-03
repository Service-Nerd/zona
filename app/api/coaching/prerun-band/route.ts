/**
 * GET /api/coaching/prerun-band
 *
 * R25 Cut #2 — Today screen pre-run band.
 * Returns cohort stats for similar-distance past runs so the Today screen can
 * show "your last N similar [type] runs averaged X bpm · Y% in zone" before
 * the user heads out. Distance-only match (no HR band — the run hasn't happened).
 *
 * Auth: paid/trial — activity_intelligence gate.
 *
 * Query params:
 *   session_type  — session type label for display (e.g. 'easy', 'long'). Required.
 *   distance_km   — today's planned distance. Required. Cohort matches ±15%.
 *
 * Returns:
 *   { cohort: CohortSummary }  — when ≥ MIN_COHORT_SIZE similar runs exist
 *   { cohort: null }           — not enough data
 */

import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { fetchRunHistory, summariseCohort } from '@/lib/coaching/runHistory'
import { COHORT_SIMILARITY } from '@/lib/coaching/constants'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('activity_intelligence', tier)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const sessionType   = req.nextUrl.searchParams.get('session_type')
  const distanceKmStr = req.nextUrl.searchParams.get('distance_km')

  if (!sessionType || !distanceKmStr) {
    return NextResponse.json({ error: 'session_type and distance_km required' }, { status: 422 })
  }
  const distanceKm = Number(distanceKmStr)
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return NextResponse.json({ error: 'distance_km must be a positive number' }, { status: 422 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const history = await fetchRunHistory(service, user.id, COHORT_SIMILARITY.WINDOW_DAYS_DEFAULT)

  // Distance-only match for pre-run context — no HR known yet.
  // ±DISTANCE_TOLERANCE_PCT window (15%) around today's planned distance.
  const tolerance = COHORT_SIMILARITY.DISTANCE_TOLERANCE_PCT / 100
  const similar = history.filter(run => {
    const ratio = run.distanceKm / distanceKm
    return ratio >= (1 - tolerance) && ratio <= (1 + tolerance)
  })

  if (similar.length < COHORT_SIMILARITY.MIN_COHORT_SIZE) {
    return NextResponse.json({ cohort: null })
  }

  const cohort = summariseCohort(similar)
  return NextResponse.json({ cohort })
}
