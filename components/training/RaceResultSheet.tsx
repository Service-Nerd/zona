// RaceResultSheet — slide-up sheet for logging a post-race result (AI-DEPTH-08)
// PAID — opens the post-race reshape flow.
//
// ui-patterns.md: slide-up sheet anatomy (Pattern 19 keyframes, mirrored nav
// at bottom, no close button at top). Pre-commit hook compliant: no hardcoded hex.
//
// Two-CTA model per design decision:
//   Primary  — "Log result" → calls /api/post-race-reshape → emits onReshapeReady
//   Secondary — text link "Log without reshaping" → emits onLogOnly (embeds result,
//               no plan change, for users who don't want the reshape)

'use client'

import { useState } from 'react'
import type { RaceResult } from '@/types/plan'
import { authedFetch } from '@/lib/supabase/authedFetch'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReshapeProposal {
  reshapeId:           string
  summary:             string | null
  weeksAffected:       number[]
  sessionsModified:    number
  recoveryWindowWeeks: number
  distanceBucket:      string
}

interface Props {
  raceWeekN:     number
  raceName?:     string
  onClose:       () => void
  /** Called when the reshape is proposed (status: pending). Caller shows the card. */
  onReshapeReady: (proposal: ReshapeProposal) => void
  /** Called when the user logs a result but skips the reshape offer. */
  onLogOnly:     (result: RaceResult) => void
}

// ── Outcome options ───────────────────────────────────────────────────────────

const OUTCOMES: Array<{ value: RaceResult['outcome']; label: string; sub: string }> = [
  { value: 'pb',         label: 'Personal best',   sub: 'Faster than anything before' },
  { value: 'on_target',  label: 'On target',        sub: 'Hit the goal or close to it' },
  { value: 'off_target', label: 'Off target',       sub: 'Harder than expected' },
  { value: 'dnf',        label: 'Did not finish',   sub: 'Stopped before the line' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function RaceResultSheet({
  raceWeekN,
  raceName,
  onClose,
  onReshapeReady,
  onLogOnly,
}: Props) {
  const [outcome,        setOutcome]        = useState<RaceResult['outcome'] | null>(null)
  const [finishTime,     setFinishTime]     = useState('')
  const [rpe,            setRpe]            = useState<number | null>(null)
  const [notes,          setNotes]          = useState('')
  const [showAdvanced,   setShowAdvanced]   = useState(false)
  const [whatWorked,     setWhatWorked]     = useState('')
  const [whatBroke,      setWhatBroke]      = useState('')
  const [fuelingNote,    setFuelingNote]    = useState('')
  const [strategyNote,   setStrategyNote]   = useState('')

  const [submitting,     setSubmitting]     = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  function buildResult(): RaceResult {
    return {
      outcome:         outcome ?? undefined,
      finish_time:     finishTime.trim() || undefined,
      rpe:             rpe ?? undefined,
      notes:           notes.trim() || undefined,
      what_worked:     whatWorked.trim() || undefined,
      what_broke:      whatBroke.trim() || undefined,
      fueling_outcome: fuelingNote.trim() || undefined,
      strategy_outcome: strategyNote.trim() || undefined,
      date:            new Date().toISOString().slice(0, 10),
    }
  }

  async function handleLogAndReshape() {
    if (!outcome) return
    setSubmitting(true)
    setError(null)

    try {
      const result = buildResult()
      const res = await authedFetch('/api/post-race-reshape', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ race_result: result, race_week_n: raceWeekN }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error ?? 'Something went wrong. Try again.')
        return
      }

      const data = await res.json()

      if (!data.reshape_available) {
        // No weeks to reshape — treat as log-only
        onLogOnly(result)
        return
      }

      onReshapeReady({
        reshapeId:           data.reshape_id,
        summary:             data.summary ?? null,
        weeksAffected:       data.weeks_affected ?? [],
        sessionsModified:    data.sessions_modified ?? 0,
        recoveryWindowWeeks: data.recovery_window_weeks ?? 0,
        distanceBucket:      data.distance_bucket ?? '',
      })
    } catch {
      setError('Network error. Check your connection.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleLogOnly() {
    onLogOnly(buildResult())
  }

  const canSubmit = !!outcome && !submitting

  return (
    <div
      onClick={onClose}
      style={{
        // zIndex must sit ABOVE the bottom nav bar (zIndex 3000 in
        // DashboardClient) — otherwise the fixed nav floats over the sheet and
        // its scrim, reading as the nav "pulling off the bottom" on scroll.
        position: 'fixed', inset: 0, zIndex: 4000,
        background: 'rgba(26,26,26,0.40)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'vetra-fade-in 0.18s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '480px',
          background: 'var(--card)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
          paddingTop: '8px',
          maxHeight: '90vh', overflowY: 'auto',
          animation: 'vetra-slide-up 0.22s ease-out',
        }}
      >
        {/* Drag indicator */}
        <div style={{ width: '36px', height: '4px', background: 'var(--line)', borderRadius: '2px', margin: '6px auto 0' }} />

        {/* Header */}
        <div style={{ padding: '16px 20px 4px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
            {raceName ?? 'Race result'}
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '24px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px', lineHeight: 1.15 }}>
            How did it go?
          </div>
        </div>

        <div style={{ padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── Outcome picker ─────────────────────────── */}
          <div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)', letterSpacing: '0.02em', marginBottom: '10px' }}>
              How would you call it?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {OUTCOMES.map(o => (
                <button
                  key={o.value}
                  onClick={() => setOutcome(o.value)}
                  style={{
                    display: 'flex', alignItems: 'center',
                    padding: '11px 14px',
                    background: outcome === o.value ? 'var(--bg-soft)' : 'transparent',
                    border: `1.5px solid ${outcome === o.value ? 'var(--moss)' : 'var(--line)'}`,
                    borderRadius: '12px',
                    cursor: 'pointer', textAlign: 'left',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '16px', height: '16px', borderRadius: '50%',
                      border: `2px solid ${outcome === o.value ? 'var(--moss)' : 'var(--line)'}`,
                      background: outcome === o.value ? 'var(--moss)' : 'transparent',
                      flexShrink: 0,
                      transition: 'all 0.12s',
                    }}
                  />
                  <div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>
                      {o.label}
                    </div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.3, marginTop: '1px' }}>
                      {o.sub}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Finish time ────────────────────────────── */}
          <div>
            <label style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: '6px' }}>
              Finish time <span style={{ fontWeight: 400, color: 'var(--mute)' }}>(optional)</span>
            </label>
            <input
              type="text"
              value={finishTime}
              onChange={e => setFinishTime(e.target.value)}
              placeholder="4:32:00 or 21:48"
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--bg-soft)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                // 16px (not 15) — iOS zooms any focused input below 16px, and
                // the maximum-scale=1 viewport then traps the user zoomed in.
                fontFamily: 'var(--font-ui)', fontSize: '16px', color: 'var(--ink)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* ── RPE ────────────────────────────────────── */}
          <div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '10px' }}>
              Overall effort <span style={{ fontWeight: 400, color: 'var(--mute)' }}>(optional)</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button
                  key={n}
                  onClick={() => setRpe(rpe === n ? null : n)}
                  style={{
                    width: '40px', height: '40px',
                    background: rpe === n ? 'var(--moss)' : 'var(--bg-soft)',
                    border: `1px solid ${rpe === n ? 'var(--moss)' : 'var(--line)'}`,
                    borderRadius: '8px', cursor: 'pointer',
                    fontFamily: 'var(--font-ui)', fontSize: '14px',
                    fontWeight: rpe === n ? 700 : 400,
                    color: rpe === n ? 'var(--card)' : 'var(--ink)',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', marginTop: '4px' }}>
              1 = walked it · 10 = everything
            </div>
          </div>

          {/* ── Notes ──────────────────────────────────── */}
          <div>
            <label style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: '6px' }}>
              Notes <span style={{ fontWeight: 400, color: 'var(--mute)' }}>(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What happened out there?"
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', resize: 'vertical',
                background: 'var(--bg-soft)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                // 16px — see finish-time note: anything smaller triggers the iOS zoom trap.
                fontFamily: 'var(--font-ui)', fontSize: '16px', color: 'var(--ink)',
                lineHeight: 1.5, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* ── Advanced section ───────────────────────── */}
          <div>
            <button
              onClick={() => setShowAdvanced(v => !v)}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--moss)', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              {showAdvanced ? '⌃ Less' : '⌄ What worked / what broke'}
            </button>

            {showAdvanced && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px', animation: 'vetra-fade-in 0.15s ease-out' }}>
                <AdvancedField label="What worked" placeholder="Pacing, fueling, mindset…" value={whatWorked} onChange={setWhatWorked} />
                <AdvancedField label="What broke" placeholder="Faded at km 30, stomach issues…" value={whatBroke} onChange={setWhatBroke} />
                <AdvancedField label="Fueling" placeholder="Gels every 25 min, cramped at km 35…" value={fuelingNote} onChange={setFuelingNote} />
                <AdvancedField label="Strategy / pacing" placeholder="Even splits, went out too fast…" value={strategyNote} onChange={setStrategyNote} />
              </div>
            )}
          </div>

          {/* ── Error ──────────────────────────────────── */}
          {error && (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--danger)', padding: '8px 12px', background: 'var(--bg-soft)', borderRadius: '8px' }}>
              {error}
            </div>
          )}

        </div>

        {/* ── Footer nav (mirrored nav bar pattern) ─────────────────────────── */}
        <div style={{
          position: 'sticky', bottom: 0,
          padding: '12px 20px 24px',
          background: 'var(--card)',
          borderTop: '0.5px solid var(--line)',
          marginTop: '20px',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          <button
            onClick={handleLogAndReshape}
            disabled={!canSubmit}
            style={{
              width: '100%', height: '50px',
              background: canSubmit ? 'var(--moss)' : 'var(--bg-soft)',
              border: 'none', borderRadius: '14px',
              cursor: canSubmit ? 'pointer' : 'default',
              fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600,
              color: canSubmit ? 'var(--card)' : 'var(--mute)',
              transition: 'opacity 0.15s',
            }}
          >
            {submitting ? 'Checking plan…' : 'Log result'}
          </button>

          <button
            onClick={handleLogOnly}
            disabled={!outcome || submitting}
            style={{
              background: 'none', border: 'none', cursor: outcome ? 'pointer' : 'default',
              fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)',
              padding: '4px 0', opacity: outcome ? 1 : 0.4,
            }}
          >
            Log result only, keep my plan →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function AdvancedField({
  label, placeholder, value, onChange,
}: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: '5px' }}>
        {label}
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        style={{
          width: '100%', padding: '9px 12px', resize: 'vertical',
          background: 'var(--bg-soft)',
          border: '1px solid var(--line)',
          borderRadius: '10px',
          // 16px — see finish-time note: anything smaller triggers the iOS zoom trap.
          fontFamily: 'var(--font-ui)', fontSize: '16px', color: 'var(--ink)',
          lineHeight: 1.5, outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}
