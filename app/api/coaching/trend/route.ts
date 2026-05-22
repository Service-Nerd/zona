/**
 * GET /api/coaching/trend
 *
 * Multi-month trend backend (AI-DEPTH-03). Returns a sparse series of
 * same-effort runs over time at a given anchor distance. Powers:
 *   - POST-RUN-REFRAME-01 Tier A reframe enrichment (internal call inline)
 *   - Coach screen trend cards (when wired)
 *
 * Auth: paid/trial only — uses the same `activity_intelligence` gate as the
 * rest of the run-history surface.
 *
 * Query params:
 *   session_type   — e.g. 'easy', 'long', 'tempo'. Required.
 *   distance_km    — anchor distance (cohort matches ±15%). Required.
 *   window_months  — lookback window. Defaults to TREND_SERIES.DEFAULT_WINDOW_MONTHS.
 *
 * Returns the TrendSeries object verbatim, or `{ trend: null }` if there
 * isn't enough data to produce a non-noisy claim.
 */

import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { buildHrTrendSeries, fetchRunHistory } from '@/lib/coaching/runHistory'
import { COHORT_SIMILARITY, TREND_SERIES } from '@/lib/coaching/constants'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('activity_intelligence', tier)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const sessionType = req.nextUrl.searchParams.get('session_type')
  const distanceKmStr = req.nextUrl.searchParams.get('distance_km')
  const windowStr = req.nextUrl.searchParams.get('window_months')

  if (!sessionType || !distanceKmStr) {
    return NextResponse.json({ error: 'session_type and distance_km required' }, { status: 422 })
  }
  const distanceKm = Number(distanceKmStr)
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return NextResponse.json({ error: 'distance_km must be a positive number' }, { status: 422 })
  }
  const windowMonths = windowStr
    ? Math.max(1, Math.min(24, Math.round(Number(windowStr))))
    : TREND_SERIES.DEFAULT_WINDOW_MONTHS

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const history = await fetchRunHistory(
    service,
    user.id,
    Math.max(windowMonths * 31, COHORT_SIMILARITY.WINDOW_DAYS_DEFAULT),
  )

  const trend = buildHrTrendSeries(history, { sessionType, distanceKm }, windowMonths)

  return NextResponse.json({ trend })
}
