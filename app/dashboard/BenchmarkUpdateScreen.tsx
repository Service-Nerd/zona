'use client'

import { useState } from 'react'
import type { Plan, BenchmarkInput } from '@/types/plan'
import { authedFetch } from '@/lib/supabase/authedFetch'
import { isLongRun } from '@/lib/plan/sessionRole'
import { convertPaceString, type DistanceUnits } from '@/lib/format'
import { DurationPicker } from '@/components/shared/DurationPicker'
import { TextField } from '@/components/shared/TextField'
import { Chip } from '@/components/shared/Chip'
import { RaceTimesCard } from '@/components/shared/RaceTimesCard'
import BackButton from '@/components/shared/BackButton'

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
      marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
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
// PACE-UNITS-01 — `pace_target` is a STRING with `/km` welded on at generation
// time (674 of 888 stored sessions), so the unit cannot be fixed at the
// producer for a plan that already exists. Converted here, at the read, before
// either band reaches the panel.
function getPaceBands(plan: Plan, units: DistanceUnits): { easy: string | null; quality: string | null } {
  let easy: string | null = null
  let quality: string | null = null
  for (const week of plan.weeks) {
    for (const session of Object.values(week.sessions)) {
      if (!session) continue
      if (!easy && (session.type === 'easy' || isLongRun(session) || session.type === 'recovery')) {
        if (session.pace_target) easy = session.pace_target
      }
      if (!quality && (session.type === 'quality' || session.type === 'tempo' || session.type === 'intervals')) {
        if (session.pace_target) quality = session.pace_target
      }
      if (easy && quality) return { easy: convertPaceString(easy, units) ?? null, quality: convertPaceString(quality, units) ?? null }
    }
  }
  return { easy: convertPaceString(easy, units) ?? null, quality: convertPaceString(quality, units) ?? null }
}

// ─── Updated pace result ──────────────────────────────────────────────────────

function UpdatedPaceResult({ plan, weeksUpdated, stravaConnected, units }: { plan: Plan; weeksUpdated: number; stravaConnected: boolean; units: DistanceUnits }) {
  const { meta } = plan
  const { easy, quality } = getPaceBands(plan, units)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{
        background: 'var(--card)', borderRadius: '12px',
        border: '0.5px solid var(--moss)', borderLeft: '3px solid var(--moss)',
        padding: '16px',
      }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--moss)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>
          Pace updated
        </div>
        {meta.vdot !== undefined && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <span style={{ fontFamily: 'var(--font-brand)', fontSize: '28px', fontWeight: 600, color: 'var(--moss)' }}>
              {meta.vdot}
            </span>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)' }}>VDOT</span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
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
  units = 'km',
}: {
  onBack: () => void
  plan: Plan
  stravaConnected: boolean
  onUpdated: (plan: Plan) => void
  units?: DistanceUnits
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
        <BackButton onClick={onBack} style={{ marginBottom: 'var(--space-5)' }} />

        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: '22px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.3px', marginBottom: 'var(--space-2)' }}>
            Update pace targets.
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.55 }}>
            You've done the work. Let's make sure your paces reflect it.
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

        {result ? (
          <UpdatedPaceResult plan={result.plan} weeksUpdated={result.weeksUpdated} stravaConnected={stravaConnected} units={units} />
        ) : (
          <>
            <RaceTimesCard variant="anchor" stravaConnected={stravaConnected} />
            {/* Benchmark type selection */}
            <div>
              <FieldLabel>New benchmark</FieldLabel>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div>
                    <FieldLabel>Race distance</FieldLabel>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
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
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', marginTop: 'var(--space-2)' }}>
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
              // S2 — dismiss is never the CTA colour.
              background: 'var(--bg-soft)', border: '1px solid var(--line)', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600,
              color: 'var(--ink-2)',
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
