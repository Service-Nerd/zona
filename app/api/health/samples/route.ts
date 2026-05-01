import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'

// POST /api/health/samples
//
// Accepts a batch of daily HealthKit samples (RHR / HRV / sleep / VO2 max),
// upserts to health_daily_samples keyed on (user_id, sample_date).
//
// The iOS sync calls this with the last 14 days on every app open. Idempotent.
// Same tier gate as /api/health/ingest — readiness signal + VO2 cross-check
// are paid features.

interface SamplePayload {
  /** ISO date string (YYYY-MM-DD). */
  sampleDate:    string
  rhrBpm?:       number | null
  hrvMs?:        number | null
  sleepHours?:   number | null
  vo2Max?:       number | null
}

interface BatchPayload {
  samples: SamplePayload[]
}

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

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('activity_intelligence', tier)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  let payload: BatchPayload
  try {
    payload = await req.json() as BatchPayload
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 })
  }
  if (!Array.isArray(payload.samples)) {
    return NextResponse.json({ error: 'samples[] required' }, { status: 422 })
  }
  if (payload.samples.length === 0) {
    return NextResponse.json({ status: 'ok', count: 0 })
  }

  const rows = payload.samples
    .filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s.sampleDate))
    .map(s => ({
      user_id:     user.id,
      sample_date: s.sampleDate,
      rhr_bpm:     s.rhrBpm     ?? null,
      hrv_ms:      s.hrvMs      ?? null,
      sleep_hours: s.sleepHours ?? null,
      vo2_max:     s.vo2Max     ?? null,
      source:      'apple_health',
    }))

  if (rows.length === 0) {
    return NextResponse.json({ status: 'ok', count: 0 })
  }

  const { error } = await getSupabase()
    .from('health_daily_samples')
    .upsert(rows, { onConflict: 'user_id,sample_date' })

  if (error) {
    console.error('[health-samples] upsert failed', error.message)
    return NextResponse.json({ error: 'Persist failed' }, { status: 500 })
  }

  return NextResponse.json({ status: 'ok', count: rows.length })
}
