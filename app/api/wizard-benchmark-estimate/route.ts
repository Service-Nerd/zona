// FREE — GET /api/wizard-benchmark-estimate?raceDistanceKm=&rhr=&mhr=
//
// CI-4: auto-estimates a benchmark from the user's recent aerobic runs so the
// wizard's benchmark step can pre-fill ("Looks like a 10K in about 55:52").
//
// FREE and rule-derived — deliberately NOT the PAID /api/race-times ladder, and
// it must NOT surface the PAID RaceTimesCard. It returns only a single-distance
// estimate for the wizard to confirm/adjust; the runner-facing label carries no
// AIMark (it's arithmetic, not a model).
//
// HR is provided by the caller (the wizard reads resting/max HR from HealthKit
// client-side — the only place that read works on device); this route reads the
// runs server-side and does the pure math (lib/plan/aerobicEstimate). If HR is
// absent or no runs qualify, it returns { available: false } — the wizard falls
// back to the manual benchmark ask. Never a dead end.

import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { estimateBenchmarkFromRuns, type AerobicRun } from '@/lib/plan/aerobicEstimate'

const WINDOW_WEEKS = 6

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const raceDistanceKm = Number(url.searchParams.get('raceDistanceKm'))
  const rhrParam = url.searchParams.get('rhr')
  const mhrParam = url.searchParams.get('mhr')
  const restingHr = rhrParam != null && rhrParam !== '' ? Number(rhrParam) : null
  const maxHr     = mhrParam != null && mhrParam !== '' ? Number(mhrParam) : null

  if (!Number.isFinite(raceDistanceKm) || raceDistanceKm <= 0) {
    return NextResponse.json({ error: 'raceDistanceKm required' }, { status: 400 })
  }
  // No HR → can't qualify Z2 runs. Answer honestly; the wizard shows manual.
  if (restingHr == null || maxHr == null || !Number.isFinite(restingHr) || !Number.isFinite(maxHr)) {
    return NextResponse.json({ available: false, reason: 'no_hr' })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - WINDOW_WEEKS * 7)

  // Same run source + coarse pre-filter as /api/race-times States 2/3; the fine
  // Z2 qualification happens in estimateBenchmarkFromRuns.
  const { data: runs } = await supabase
    .from('strava_activities')
    .select('avg_speed, avg_hr, distance_m')
    .eq('user_id', user.id)
    .eq('activity_type', 'Run')
    .gte('start_date', windowStart.toISOString())
    .not('avg_speed', 'is', null)
    .not('avg_hr', 'is', null)
    .or('hr_above_ceiling_pct.is.null,hr_above_ceiling_pct.lt.25')
    .order('start_date', { ascending: false })

  const estimate = estimateBenchmarkFromRuns({
    runs: (runs ?? []) as AerobicRun[],
    restingHr,
    maxHr,
    raceDistanceKm,
  })

  return NextResponse.json(estimate)
}
