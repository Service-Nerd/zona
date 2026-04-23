'use client'

import { useState } from 'react'
import type { Plan, BenchmarkInput } from '@/types/plan'

// ─── Constants ────────────────────────────────────────────────────────────────

const BENCHMARK_DISTANCES = [
  { label: '5K',   value: 5    },
  { label: '10K',  value: 10   },
  { label: 'Half', value: 21.1 },
  { label: 'Full', value: 42.2 },
]

// ─── Primitives ───────────────────────────────────────────────────────────────

function ChipToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '9px 16px', borderRadius: '10px',
        border: `0.5px solid ${active ? 'var(--moss)' : 'var(--line)'}`,
        background: active ? 'var(--moss-soft)' : 'none',
        color: active ? 'var(--moss)' : 'var(--ink-2)',
        fontFamily: 'var(--font-ui)', fontSize: '13px',
        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

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

function StepInput({ value, onChange, placeholder, type = 'text', min }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; min?: number
}) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} min={min}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: 'var(--bg-soft)', border: '0.5px solid var(--line)',
        borderRadius: '10px', padding: '12px 14px',
        fontFamily: 'var(--font-ui)', fontSize: '15px',
        color: 'var(--ink)', outline: 'none',
      }}
    />
  )
}

// ─── Current zones summary ────────────────────────────────────────────────────

function CurrentZonesSummary({ plan }: { plan: Plan }) {
  const { meta } = plan
  const hasVDOT = meta.vdot !== undefined

  return (
    <div style={{
      background: 'var(--card)', borderRadius: '12px',
      border: '0.5px solid var(--line)', padding: '16px',
    }}>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
        Current zones
      </div>

      {hasVDOT && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '12px' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 600, color: 'var(--moss)' }}>
            {meta.vdot}
          </span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)' }}>VDOT</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[
          { label: 'Zone 2 ceiling', value: `< ${meta.zone2_ceiling} bpm` },
          { label: 'Max HR',         value: `${meta.max_hr} bpm` },
          ...(meta.resting_hr ? [{ label: 'Resting HR', value: `${meta.resting_hr} bpm` }] : []),
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)' }}>{label}</span>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>{value}</span>
          </div>
        ))}
      </div>

      {!hasVDOT && (
        <div style={{
          marginTop: '12px', paddingTop: '12px', borderTop: '0.5px solid var(--line)',
          fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5,
        }}>
          Zones are based on age estimates. A benchmark test will make them personal.
        </div>
      )}
    </div>
  )
}

// ─── Updated zones result ─────────────────────────────────────────────────────

function UpdatedZonesResult({ plan, weeksUpdated }: { plan: Plan; weeksUpdated: number }) {
  const { meta } = plan
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{
        background: 'var(--card)', borderRadius: '12px',
        border: '0.5px solid var(--moss)', borderLeft: '3px solid var(--moss)',
        padding: '16px',
      }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--moss)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
          Zones updated
        </div>
        {meta.vdot !== undefined && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '12px' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 600, color: 'var(--moss)' }}>
              {meta.vdot}
            </span>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)' }}>VDOT</span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { label: 'Zone 2 ceiling', value: `< ${meta.zone2_ceiling} bpm` },
            { label: 'Max HR',         value: `${meta.max_hr} bpm` },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)' }}>{label}</span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

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
  onUpdated,
}: {
  onBack: () => void
  plan: Plan
  onUpdated: (plan: Plan) => void
}) {
  const [benchmarkType, setBenchmarkType] = useState<'race' | 'tt_30min' | null>(null)
  const [benchmarkDistKm, setBenchmarkDistKm] = useState<number | null>(null)
  const [benchmarkTime, setBenchmarkTime] = useState('')
  const [benchmarkTTDist, setBenchmarkTTDist] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ plan: Plan; weeksUpdated: number } | null>(null)

  function canSubmit() {
    if (benchmarkType === 'race') return benchmarkDistKm !== null && benchmarkTime !== ''
    if (benchmarkType === 'tt_30min') return benchmarkTTDist !== ''
    return false
  }

  async function handleRecalibrate() {
    if (!canSubmit()) return
    setLoading(true)
    setError(null)

    const benchmark: BenchmarkInput = benchmarkType === 'race'
      ? { type: 'race', distance_km: benchmarkDistKm!, time: benchmarkTime }
      : { type: 'tt_30min', distance_km: Number(benchmarkTTDist), time: '30:00' }

    try {
      const res = await fetch('/api/recalibrate-zones', {
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
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '26px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            Update your zones.
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.55 }}>
            You've done the work. Let's make sure your targets reflect it.
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        <CurrentZonesSummary plan={plan} />

        {result ? (
          <UpdatedZonesResult plan={result.plan} weeksUpdated={result.weeksUpdated} />
        ) : (
          <>
            {/* Benchmark type selection */}
            <div>
              <FieldLabel>New benchmark</FieldLabel>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <ChipToggle
                  label="Recent race result"
                  active={benchmarkType === 'race'}
                  onClick={() => setBenchmarkType(benchmarkType === 'race' ? null : 'race')}
                />
                <ChipToggle
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
                        <ChipToggle
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
                    <StepInput
                      value={benchmarkTime}
                      onChange={setBenchmarkTime}
                      placeholder="e.g. 24:15 or 1:49:30"
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
                border: '0.5px solid var(--warn)', padding: '12px 14px',
              }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--warn)' }}>{error}</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* CTA */}
      <div style={{
        flexShrink: 0,
        padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
        borderTop: '0.5px solid var(--line)',
        background: 'var(--bg)',
      }}>
        {result ? (
          <button
            onClick={onBack}
            style={{
              width: '100%', padding: '15px', borderRadius: '12px',
              background: 'var(--moss)', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600,
              color: 'var(--card)',
            }}
          >
            Back to plan
          </button>
        ) : (
          <button
            onClick={handleRecalibrate}
            disabled={!canSubmit() || loading}
            style={{
              width: '100%', padding: '15px', borderRadius: '12px',
              background: canSubmit() && !loading ? 'var(--moss)' : 'var(--moss-soft)',
              border: 'none', cursor: canSubmit() && !loading ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600,
              color: canSubmit() && !loading ? 'var(--card)' : 'var(--moss)',
              transition: 'all 0.15s',
            }}
          >
            {loading ? 'Recalibrating…' : 'Recalibrate zones'}
          </button>
        )}
      </div>
    </div>
  )
}
