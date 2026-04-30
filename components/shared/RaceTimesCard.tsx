'use client'

// Race projections card. Shown on the Coach screen (paid/trial) and on the
// Benchmark recalibration success state. Fetches /api/race-times on mount.
//
// TIER: server route gates by tier; on free this won't be rendered (the Coach
// screen swaps in CoachTeaser, and the benchmark flow is paid-only).

import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/supabase/authedFetch'

type RaceTimeData = {
  state: 1 | 2 | 3 | 4 | 5
  confidence: 'high' | 'moderate' | 'low' | null
  label: string | null
  source: 'benchmark' | 'strava' | 'wizard' | 'none'
  vdot?: number
  distances: Array<{ distanceKm: number; label: string; timeSeconds: number; formattedTime: string }> | null
  upgradeCtaType: 'benchmark' | 'strava' | 'both' | null
  stravaQualifyingRunCount?: number
}

export function RaceTimesCard({ stravaConnected }: { stravaConnected: boolean }) {
  const [data, setData]       = useState<RaceTimeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    authedFetch('/api/race-times')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed')
        setData(await res.json())
      })
      .catch(() => setError('Could not load race projections.'))
      .finally(() => setLoading(false))
  }, [])

  function confidenceChipStyle(c: 'high' | 'moderate' | 'low') {
    const isHigh = c === 'high'
    return {
      fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 600 as const,
      color:      isHigh ? 'var(--moss)' : 'var(--mute)',
      textTransform: 'uppercase' as const, letterSpacing: '0.06em',
      background: isHigh ? 'rgba(107,142,107,0.12)' : 'rgba(138,133,125,0.10)',
      borderRadius: '10px', padding: '2px 8px',
    }
  }

  return (
    <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', padding: '20px' }}>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
        Race projections
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[100, 75, 90, 80].map((w, i) => (
            <div key={i} style={{ height: '14px', background: 'var(--bg-soft)', borderRadius: '4px', width: `${w}%` }} />
          ))}
        </div>
      ) : error || !data || data.state === 5 ? (
        <div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 500, color: 'var(--ink-2)', marginBottom: '6px' }}>
            No estimate yet.
          </div>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.6, margin: 0 }}>
            {stravaConnected
              ? 'Add a benchmark result in Profile, or complete a few easy runs with Strava.'
              : 'Add a benchmark result in Profile, or connect Strava and complete a few easy runs.'}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.45, flex: 1 }}>
              {data.label}
            </span>
            {data.confidence && (
              <span style={confidenceChipStyle(data.confidence)}>
                {data.confidence}
              </span>
            )}
          </div>

          <div>
            {data.distances?.map((d, i) => (
              <div
                key={d.label}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: i < (data.distances?.length ?? 0) - 1 ? '1px solid var(--line)' : undefined,
                }}
              >
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--ink-2)' }}>
                  {d.label}
                </span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '18px', fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.3px' }}>
                  {d.formattedTime}
                </span>
              </div>
            ))}
          </div>

          {(data.state === 3 || data.state === 4) && (
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', lineHeight: 1.55, margin: '12px 0 0' }}>
              {data.state === 3
                ? 'Log a benchmark result in Profile for a higher-confidence estimate.'
                : stravaConnected
                  ? 'Log a benchmark result in Profile to improve accuracy.'
                  : 'Add a benchmark in Profile, or connect Strava and complete a few easy runs.'}
            </p>
          )}
        </>
      )}
    </div>
  )
}
