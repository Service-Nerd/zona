'use client'

// Race projections card. Shown on the Coach screen (paid/trial).
// Fetches /api/race-times on mount.
//
// R31 — target race shown at top with improvement delta vs plan-creation baseline.
// R32 — recalibration nudge shown at bottom when fitness has moved significantly.
//
// TIER: server route gates by tier; on free this won't be rendered (the Coach
// screen swaps in CoachTeaser, and the benchmark flow is paid-only).

import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/supabase/authedFetch'

type TargetRace = {
  distanceKm:      number
  raceName:        string
  ultraDistance:   boolean
  currentSeconds:  number | null
  baselineSeconds: number | null
  deltaSeconds:    number | null
  deltaFormatted:  string | null
  improved:        boolean | null
}

type RaceTimeData = {
  state:      1 | 2 | 3 | 4 | 5
  confidence: 'high' | 'moderate' | 'low' | null
  label:      string | null
  source:     'benchmark' | 'strava' | 'wizard' | 'none'
  vdot?:      number
  distances:  Array<{ distanceKm: number; label: string; timeSeconds: number; formattedTime: string }> | null
  target:     TargetRace | null
  recalibrationSuggested: boolean
  upgradeCtaType: 'benchmark' | 'strava' | 'both' | null
  stravaQualifyingRunCount?: number
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.round(totalSeconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function RaceTimesCard({
  stravaConnected,
  benchmarkRecalDismissedAt,
  onOpenBenchmark,
  onDismissRecal,
}: {
  stravaConnected:           boolean
  benchmarkRecalDismissedAt?: string | null
  onOpenBenchmark?:          () => void
  onDismissRecal?:           () => void
}) {
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

  // R32: recal nudge is visible when route suggests it AND user hasn't dismissed
  // recently (within 21 days).
  const showRecalNudge = (() => {
    if (!data?.recalibrationSuggested || !onOpenBenchmark) return false
    if (!benchmarkRecalDismissedAt) return true
    const dismissedMs = new Date(benchmarkRecalDismissedAt).getTime()
    const daysSince   = (Date.now() - dismissedMs) / 86_400_000
    return daysSince > 21
  })()

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
          {/* ── Source label + confidence chip ───────────────────────── */}
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

          {/* ── R31: target race row — shown when plan has a specific race ── */}
          {data.target && (
            <div style={{
              background: 'var(--bg-soft)',
              borderRadius: '10px',
              borderLeft: '3px solid var(--s-race)',
              padding: '12px 14px',
              marginBottom: '14px',
            }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                Your race
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--ink-2)', marginBottom: '8px' }}>
                {data.target.raceName}
              </div>

              {data.target.ultraDistance ? (
                /* Ultra distances can't be projected from VDOT — honest note instead of a wrong number */
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.55, margin: 0 }}>
                  Ultra finish times depend on terrain, conditions, and pacing — not pace-based formulas.
                  The projections below are still accurate for your training.
                </p>
              ) : (
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.8px', lineHeight: 1 }}>
                    {data.target.currentSeconds !== null ? formatTime(data.target.currentSeconds) : '—'}
                  </span>
                  {/* Delta chip — only shown when improvement/regression is significant */}
                  {data.target.deltaFormatted && data.target.improved !== null && (
                    <span style={{
                      fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600,
                      color: data.target.improved ? 'var(--moss)' : 'var(--warn)',
                    }}>
                      {data.target.improved ? '↑' : '↓'} {data.target.deltaFormatted} since plan start
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Standard distances ───────────────────────────────────── */}
          <div>
            {data.distances?.map((d, i) => (
              <div
                key={d.label}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 0',
                  borderBottom: i < (data.distances?.length ?? 0) - 1 ? '1px solid var(--line)' : undefined,
                }}
              >
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)' }}>
                  {d.label}
                </span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: 600, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.2px' }}>
                  {d.formattedTime}
                </span>
              </div>
            ))}
          </div>

          {/* Low-confidence prompt */}
          {(data.state === 3 || data.state === 4) && (
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', lineHeight: 1.55, margin: '12px 0 0' }}>
              {data.state === 3
                ? 'Log a benchmark result in Profile for a higher-confidence estimate.'
                : stravaConnected
                  ? 'Log a benchmark result in Profile to improve accuracy.'
                  : 'Add a benchmark in Profile, or connect Strava and complete a few easy runs.'}
            </p>
          )}

          {/* ── R32: recalibration nudge ─────────────────────────────── */}
          {showRecalNudge && (
            <div style={{
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px solid var(--line)',
            }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 10px' }}>
                Aerobic fitness has moved since plan start. Your training zones may be set too low for where you are now.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                  onClick={onOpenBenchmark}
                  style={{
                    fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
                    color: 'var(--moss)', background: 'rgba(107,142,107,0.10)',
                    border: 'none', borderRadius: '20px', padding: '7px 14px',
                    cursor: 'pointer',
                  }}
                >
                  Update zones →
                </button>
                <button
                  onClick={onDismissRecal}
                  style={{
                    fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 400,
                    color: 'var(--mute)', background: 'none', border: 'none',
                    padding: '0', cursor: 'pointer',
                  }}
                >
                  Not now
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
