'use client'
// SESSION-SCREENS-WOW-01 — the run's Zone Trace for `SessionCompleteCard`, on both logged paths (the hand-logged
// reflect view and the linked post-run screen).
//
// Reads ONE field of ONE row the runner owns: `raw_payload->hrSamples` of the linked Apple Health activity, through
// the same browser client and RLS scope the dashboard already uses for `strava_activities` (no new route, works on
// native). Strava and manual rows carry no samples (ADR-011), so they never draw; that is the zone bar's job.
//
// The band and its ceiling come from the session's PRESCRIBED zone (§84) through the same helpers the session
// screen's zone card uses, so the ceiling drawn here is the ceiling the runner was shown before the run.

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildRunTrace, type RunTrace } from '@/lib/coaching/zoneTrace'

export function useRunTrace(
  appleHealthUuid: string | null | undefined,
  session: { zone?: string; type?: string; role?: string; label?: string } | null,
  restingHR: number | null | undefined,
  maxHR: number | null | undefined,
  analysisAbovePct: number | null | undefined,
): RunTrace | null {
  const [samples, setSamples] = useState<unknown>(null)
  useEffect(() => {
    if (!appleHealthUuid) { setSamples(null); return }
    let live = true
    createClient()
      .from('strava_activities')
      .select('hrSamples:raw_payload->hrSamples')
      .eq('apple_health_uuid', appleHealthUuid)
      .maybeSingle()
      // A failed read is "no trace": the card keeps the zone bar, exactly as before. Nothing is reserved for it.
      .then(({ data, error }) => { if (live) setSamples(error ? null : (data as { hrSamples?: unknown } | null)?.hrSamples ?? null) })
    return () => { live = false }
  }, [appleHealthUuid])
  return useMemo(() => (session ? buildRunTrace(samples, session, restingHR, maxHR, analysisAbovePct) : null),
    [samples, session, restingHR, maxHR, analysisAbovePct])
}
