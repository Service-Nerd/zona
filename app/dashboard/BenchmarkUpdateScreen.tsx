'use client'

import { useState } from 'react'
import type { Plan, BenchmarkInput } from '@/types/plan'
import { authedFetch } from '@/lib/supabase/authedFetch'
import { DurationPicker } from '@/components/shared/DurationPicker'
import { TextField } from '@/components/shared/TextField'
import { Chip } from '@/components/shared/Chip'
import { RaceTimesCard } from '@/components/shared/RaceTimesCard'

// ─── Constants ────────────────────────────────────────────────────────────────

const BENCHMARK_DISTANCES = [
  { label: '5K',   value: 5    },
  { label: '10K',  value: 10   },
  { label: 'Half', value: 21.1 },
  { label: 'Full', value: 42.2 },
]

// ─── Primitives ───────────────────────────────────────────────────────────────

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <div style={{
      fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)',
      letterSpacing: '0.08em', textTransform: 'uppercase',
      marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px',
    }}>
      {children}
      {optional && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--mute)', textTransform: 'none', letterSpacing: 0, opacity: 0.7 }}>optional</span>}
    </div>
  )
}

// Thin wrapper over the canonical TextField — keeps this screen's call site
// unchanged while the control is the shared primitive.
function StepInput({ value, onChange, placeholder, type = 'text', min }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: 'text' | 'number'; min?: number
}) {
  return (
    <TextField
      value={value}
      onChange={onChange}
      type={type}
      placeholder={placeholder}
      min={min}
      inputMode={type === 'number' ? 'decimal' : undefined}
    />
  )
}

// ─── Pace band extraction ─────────────────────────────────────────────────────

// Pull the first easy + quality pace_target from the plan so the panel shows
// the actual bands the user is currently training to (not synthesised values).
function getPaceBands(plan: Plan): { easy: string | null; quality: string | null } {
  let easy: string | null = null
  let quality: string | null = null
  for (const week of plan.weeks) {
    for (const session of Object.values(week.sessions)) {
      if (!session) continue
      if (!easy && (session.type === 'easy' || session.type === 'long' || session.type === 'recovery')) {
        if (session.pace_target) easy = session.pace_target
      }
      if (!quality && (session.type === 'quality' || session.type === 'tempo' || session.type === 'intervals')) {
        if (session.pace_target) quality = session.pace_target
      }
      if (easy && quality) return { easy, quality }
    }
  }
  return { easy, quality }
}

// ─── Updated pace result ──────────────────────────────────────────────────────

function UpdatedPaceResult({ plan, weeksUpdated, stravaConnected }: { plan: Plan; weeksUpdated: number; stravaConnected: boolean }) {
  const { meta } = plan
  const { easy, quality } = getPaceBands(plan)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{
        background: 'var(--card)', borderRadius: '12px',
        border: '0.5px solid var(--moss)', borderLeft: '3px solid var(--moss)',
        padding: '16px',
      }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--moss)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
          Pace updated
        </div>
        {meta.vdot !== undefined && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '12px' }}>
            <span style={{ fontFamily: 'var(--font-brand)', fontSize: '28px', fontWeight: 600, color: 'var(--moss)' }}>
              {meta.vdot}
            </span>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)' }}>VDOT</span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            ...(easy    ? [{ label: 'Easy pace',    value: easy }]    : []),
            ...(quality ? [{ label: 'Quality pace', value: quality }] : []),
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)' }}>{label}</span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <RaceTimesCard variant="result" stravaConnected={stravaConnected} />

      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', textAlign: 'center' }}>
        {weeksUpdated} remaining {weeksUpdated === 1 ? 'week' : 'weeks'} updated.
      </div>
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function BenchmarkUpdateScreen({
  onBack,
  plan,
  stravaConnected,
  onUpdated,
}: {
  onBack: () => void
  plan: Plan
  stravaConnected: boolean
  onUpdated: (plan: Plan) => void
}) {
  const [benchmarkType, setBenchmarkType] = useState<'race' | 'tt_30min' | null>(null)
  const [benchmarkDistKm, setBenchmarkDistKm] = useState<number | null>(null)
  const [benchHours, setBenchHours] = useState(0)
  const [benchMins, setBenchMins] = useState(0)
  const [benchmarkTTDist, setBenchmarkTTDist] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ plan: Plan; weeksUpdated: number } | null>(null)

  function canSubmit() {
    if (benchmarkType === 'race') return benchmarkDistKm !== null && (benchHours > 0 || benchMins > 0)
    if (benchmarkType === 'tt_30min') return benchmarkTTDist !== ''
    return false
  }

  async function handleRecalibrate() {
    if (!canSubmit()) return
    setLoading(true)
    setError(null)

    const benchTimeStr = `${benchHours}:${String(benchMins).padStart(2, '0')}:00`
    const benchmark: BenchmarkInput = benchmarkType === 'race'
      ? { type: 'race', distance_km: benchmarkDistKm!, time: benchTimeStr }
      : { type: 'tt_30min', distance_km: Number(benchmarkTTDist), time: '30:00' }

    try {
      const res = await authedFetch('/api/recalibrate-zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benchmark }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Try again.')
        return
      }
      setResult({ plan: data.plan, weeksUpdated: data.weeks_updated })
      onUpdated(data.plan)
    } catch {
      setError('Could not reach the server. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ padding: '16px 16px 0', flexShrink: 0 }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', padding: '0 0 20px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px' }}>Back</span>
        </button>

        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: '22px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.3px', marginBottom: '6px' }}>
            Update pace targets.
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.55 }}>
            You've done the work. Let's make sure your paces reflect it.
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {result ? (
          <UpdatedPaceResult plan={result.plan} weeksUpdated={result.weeksUpdated} stravaConnected={stravaConnected} />
        ) : (
          <>
            <RaceTimesCard variant="anchor" stravaConnected={stravaConnected} />
            {/* Benchmark type selection */}
            <div>
              <FieldLabel>New benchmark</FieldLabel>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <Chip
                  label="Recent race result"
                  active={benchmarkType === 'race'}
                  onClick={() => setBenchmarkType(benchmarkType === 'race' ? null : 'race')}
                />
                <Chip
                  label="30-min time trial"
                  active={benchmarkType === 'tt_30min'}
                  onClick={() => setBenchmarkType(benchmarkType === 'tt_30min' ? null : 'tt_30min')}
                />
              </div>

              {benchmarkType === 'race' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <FieldLabel>Race distance</FieldLabel>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {BENCHMARK_DISTANCES.map(d => (
                        <Chip
                          key={d.value}
                          label={d.label}
                          active={benchmarkDistKm === d.value}
                          onClick={() => setBenchmarkDistKm(d.value)}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Finish time</FieldLabel>
                    <DurationPicker
                      hours={benchHours} mins={benchMins}
                      onHoursChange={setBenchHours} onMinsChange={setBenchMins}
                      maxHours={9}
                    />
                  </div>
                </div>
              )}

              {benchmarkType === 'tt_30min' && (
                <div>
                  <FieldLabel>Distance covered in 30 minutes (km)</FieldLabel>
                  <StepInput
                    type="number"
                    value={benchmarkTTDist}
                    onChange={setBenchmarkTTDist}
                    placeholder="e.g. 5.4"
                    min={1}
                  />
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', marginTop: '6px' }}>
                    Run flat, no stops, 30 minutes. Record distance covered.
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div style={{
                background: 'var(--card)', borderRadius: '10px',
                border: '0.5px solid var(--amber)', padding: '12px 14px',
              }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--amber)' }}>{error}</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* CTA */}
      <div style={{
        flexShrink: 0,
        padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--line)',
        background: 'var(--bg)',
      }}>
        {result ? (
          <button
            onClick={onBack}
            style={{
              width: '100%', padding: '15px', borderRadius: 'var(--radius-md)',
              background: 'var(--moss)', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600,
              color: 'var(--card)',
              transition: 'all 0.15s',
            }}
          >
            Back to plan
          </button>
        ) : (
          <button
            onClick={canSubmit() && !loading ? handleRecalibrate : undefined}
            disabled={!canSubmit() || loading}
            style={{
              width: '100%', padding: '15px', borderRadius: 'var(--radius-md)',
              background: canSubmit() && !loading ? 'var(--moss)' : 'var(--moss-soft)',
              color:      canSubmit() && !loading ? 'var(--card)' : 'var(--mute)',
              border: 'none', cursor: canSubmit() && !loading ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600,
              transition: 'all 0.15s',
            }}
          >
            {loading ? 'Recalibrating…' : 'Recalibrate paces'}
          </button>
        )}
      </div>
    </div>
  )
}
