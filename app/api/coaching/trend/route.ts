/**
 * GET /api/coaching/trend
 *
 * Multi-month trend backend (AI-DEPTH-03). Returns a sparse series of
 * same-effort runs over time at a given anchor distance. Powers:
 *   - POST-RUN-REFRAME-01 Tier A reframe enrichment (internal call inline)
 *   - Coach screen TrendCard (AI-DEPTH-03)
 *
 * Auth: paid/trial only — uses the same `activity_intelligence` gate as the
 * rest of the run-history surface.
 *
 * Query params:
 *   session_type   — e.g. 'easy', 'long', 'tempo'. Required.
 *   distance_km    — anchor distance (cohort matches ±15%). Required.
 *   window_months  — lookback window. Defaults to TREND_SERIES.DEFAULT_WINDOW_MONTHS.
 *   include_gloss  — 'true' to append a model-written gloss sentence when the
 *                    trend is live and hrIsTrending. Haiku call. Default false.
 *
 * Returns:
 *   { trend: TrendSeries, gloss?: string }  — live trend (gloss only when requested + signal present)
 *   { trend: null }                          — not enough data to claim a trend
 */

import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { buildHrTrendSeries, fetchRunHistory } from '@/lib/coaching/runHistory'
import { COHORT_SIMILARITY, TREND_SERIES } from '@/lib/coaching/constants'
import { buildAerobicTrendPrompt } from '@/lib/coaching/prompts/aerobicTrend'
import { ANTHROPIC_MODEL } from '@/lib/ai/models'
import { getUserDisplayPrefs } from '@/lib/userPrefs'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('activity_intelligence', tier)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const sessionType   = req.nextUrl.searchParams.get('session_type')
  const distanceKmStr = req.nextUrl.searchParams.get('distance_km')
  const windowStr     = req.nextUrl.searchParams.get('window_months')
  const includeGloss  = req.nextUrl.searchParams.get('include_gloss') === 'true'

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

  // ── AI gloss — optional, only when signal is present ────────────────────
  // Haiku call: ~500ms, ≤2 sentences. Silently skipped when:
  //   - `include_gloss` is not set
  //   - trend is null (no data)
  //   - hrIsTrending is false (no meaningful HR delta to interpret)
  //   - the Anthropic call fails (ADR-006 hybrid: return trend without gloss)
  let gloss: string | undefined
  if (includeGloss && trend?.hrIsTrending) {
    const first  = trend.buckets[0]
    const last   = trend.buckets[trend.buckets.length - 1]
    // FMT-01 — render pace/distance in the reader's unit (INV-PREF-001).
    const { units: displayUnits } = await getUserDisplayPrefs(service, user.id)
    const prompt = buildAerobicTrendPrompt({
      units:            displayUnits,
      earlierMonth:     first.shortLabel,
      nowMonth:         last.shortLabel,
      earlierHr:        first.avgHr ?? 0,
      nowHr:            last.avgHr ?? 0,
      hrDeltaBpm:       trend.hrDeltaBpm ?? 0,
      anchorDistanceKm: trend.distanceKm,
      avgPaceSecPerKm:  last.avgPaceSecPerKm,
    })

    try {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'x-api-key':         process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
          'content-type':      'application/json',
        },
        body: JSON.stringify({
          model:      ANTHROPIC_MODEL,
          max_tokens: 120,
          messages:   [{ role: 'user', content: prompt }],
        }),
      })
      if (aiRes.ok) {
        const aiData = await aiRes.json()
        gloss = (aiData.content?.[0]?.text ?? '').trim() || undefined
      }
    } catch {
      // Silent fallback per ADR-006 — return trend without gloss
    }
  }

  return NextResponse.json({ trend, ...(gloss ? { gloss } : {}) })
}
