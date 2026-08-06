'use client'
// PV2-H / ADR-014 / CD-13 — the living plan's client surface. Presentational only;
// DashboardClient owns the trigger (nextRecalibrationDue), routing, and the POST
// to /api/recalibrate-zones. Design 2026-08-06.
import React, { CSSProperties, useMemo, useState } from 'react'

interface RecalibrationReadyTileProps {
  weekN: number
  sessionDay: string
  distanceKm: number
  tier: 'free' | 'trial' | 'paid'
  onEnter: () => void
}

const DAY_LABEL: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
}

export function RecalibrationReadyTile({
  weekN, sessionDay, distanceKm, tier, onEnter,
}: RecalibrationReadyTileProps) {
  const isPaid = tier === 'paid' || tier === 'trial'

  const card: CSSProperties = {
    boxSizing: 'border-box', width: '100%', background: 'var(--card)',
    border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '20px',
    display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'var(--font-ui)',
  }
  const button: CSSProperties = {
    boxSizing: 'border-box', width: '100%', minHeight: '48px', padding: '0 16px',
    borderRadius: 'var(--radius-lg)', font: '600 16px/1 var(--font-ui)', cursor: 'pointer',
    background: isPaid ? 'var(--moss)' : 'transparent',
    color: isPaid ? 'var(--card)' : 'var(--moss)',
    border: '1px solid var(--moss)',
  }

  return (
    <section style={card} aria-label="Time trial recalibration">
      <div style={{ font: '500 12px/1 var(--font-ui)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)' }}>
        {`Week ${weekN} · ${DAY_LABEL[sessionDay] ?? sessionDay} · ${distanceKm}K time trial`}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <h2 style={{ margin: 0, font: '600 20px/1.3 var(--font-ui)', color: 'var(--ink)' }}>
          Your time trial is in.
        </h2>
        <p style={{ margin: 0, font: '400 15px/1.5 var(--font-ui)', color: 'var(--ink-2)' }}>
          {isPaid
            ? 'Enter the time and every pace from here on updates to match it.'
            : 'Rewriting the rest of your paces around it is part of Zonna Plus.'}
        </p>
      </div>
      <button type="button" style={button} onClick={onEnter}>
        {isPaid ? 'Enter your time →' : 'See what Plus changes →'}
      </button>
    </section>
  )
}

interface RecalibrationEntryScreenProps {
  distanceKm: number
  status: 'idle' | 'confirming' | 'applied' | 'error'
  onBack: () => void
  onConfirm: (timeSeconds: number) => void
}

const MIN_SECONDS = 12 * 60
const MAX_SECONDS = 60 * 60

function parseTime(raw: string): number | null {
  const m = raw.trim().match(/^(\d{1,2}):([0-5]\d)$/)
  if (!m) return null
  const seconds = parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
  if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) return null
  return seconds
}

export function RecalibrationEntryScreen({
  distanceKm, status, onBack, onConfirm,
}: RecalibrationEntryScreenProps) {
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)

  const seconds = useMemo(() => parseTime(value), [value])
  const invalid = touched && value.trim().length > 0 && seconds === null
  const busy = status === 'confirming'
  const canConfirm = seconds !== null && !busy

  const screen: CSSProperties = {
    boxSizing: 'border-box', width: '100%', minHeight: '100%', background: 'var(--bg)',
    fontFamily: 'var(--font-ui)', padding: '16px 20px 28px',
    display: 'flex', flexDirection: 'column', gap: '28px',
  }
  const primary = (enabled: boolean): CSSProperties => ({
    boxSizing: 'border-box', width: '100%', minHeight: '52px', padding: '0 16px',
    borderRadius: 'var(--radius-lg)', border: '1px solid transparent',
    font: '600 16px/1 var(--font-ui)', cursor: enabled ? 'pointer' : 'default',
    background: enabled ? 'var(--moss)' : 'var(--bg-soft)',
    color: enabled ? 'var(--card)' : 'var(--mute)',
  })
  const quiet: CSSProperties = {
    width: '100%', minHeight: '44px', background: 'transparent', border: 'none',
    font: '500 15px/1 var(--font-ui)', color: 'var(--mute)', cursor: 'pointer',
  }
  const eyebrow: CSSProperties = {
    font: '500 12px/1 var(--font-ui)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)',
  }
  const skeletonBar = (width: string): CSSProperties => ({
    height: '14px', width, background: 'var(--bg-soft)', borderRadius: 'var(--radius-lg)',
  })

  return (
    <div style={screen}>
      <button type="button" onClick={onBack} aria-label="Back"
        style={{ width: '44px', height: '44px', marginLeft: '-10px', display: 'flex', alignItems: 'center',
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M12 4L6 10l6 6" stroke={busy ? 'var(--mute)' : 'var(--ink)'}
            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {status === 'applied' ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={eyebrow}>{`${distanceKm}K · ${value}`}</div>
            <h1 style={{ margin: 0, font: '600 26px/1.25 var(--font-ui)', color: 'var(--ink)' }}>Paces updated.</h1>
            <p style={{ margin: 0, font: '400 15px/1.5 var(--font-ui)', color: 'var(--ink-2)' }}>
              The rest of your plan just moved with you.
            </p>
          </div>
          <p style={{ margin: 0, font: '400 15px/1.5 var(--font-ui)', color: 'var(--warn)' }}>
            There it is. Don&rsquo;t ruin it.
          </p>
          <div style={{ marginTop: 'auto' }}>
            <button type="button" style={primary(true)} onClick={onBack}>Back to today</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={eyebrow}>Recovery week</div>
            <h1 style={{ margin: 0, font: '600 26px/1.25 var(--font-ui)', color: 'var(--ink)' }}>
              {`${distanceKm}K time trial`}
            </h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label htmlFor="tt-time" style={{ font: '500 14px/1 var(--font-ui)', color: busy ? 'var(--mute)' : 'var(--ink-2)' }}>
              Your time
            </label>
            <input id="tt-time" inputMode="numeric" autoComplete="off" placeholder="mm:ss"
              value={value} disabled={busy} aria-invalid={invalid} aria-describedby="tt-help"
              onChange={(e) => setValue(e.target.value)} onBlur={() => setTouched(true)}
              style={{ boxSizing: 'border-box', width: '100%', minHeight: '60px', padding: '16px',
                background: 'var(--bg-soft)', border: `1px solid ${invalid ? 'var(--danger)' : 'var(--line)'}`,
                borderRadius: 'var(--radius-lg)', font: '600 28px/1 var(--font-ui)',
                color: busy ? 'var(--mute)' : 'var(--ink)', outline: 'none' }} />
            <div id="tt-help" style={{ font: '400 13px/1.4 var(--font-ui)', color: invalid ? 'var(--danger)' : 'var(--mute)' }}>
              {invalid ? `That's not a ${distanceKm}K time. Enter it as mm:ss.` : 'Minutes and seconds, like 22:41.'}
            </div>
          </div>

          {busy ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }} aria-live="polite">
              <p style={{ margin: 0, font: '400 15px/1.5 var(--font-ui)', color: 'var(--ink-2)' }}>Moving the rest of your plan.</p>
              <div style={skeletonBar('80%')} /><div style={skeletonBar('62%')} /><div style={skeletonBar('71%')} />
            </div>
          ) : status === 'error' ? (
            <p style={{ margin: 0, font: '400 15px/1.5 var(--font-ui)', color: 'var(--danger)' }} aria-live="polite">
              That didn&rsquo;t go through. Your time is still here &mdash; try again.
            </p>
          ) : (
            <p style={{ margin: 0, font: '400 15px/1.5 var(--font-ui)', color: 'var(--ink-2)' }}>
              Your easy and workout paces update from here on.
            </p>
          )}

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button type="button" disabled={!canConfirm} style={primary(canConfirm)}
              onClick={() => { if (seconds !== null) onConfirm(seconds) }}>
              {busy ? 'Updating' : status === 'error' ? 'Try again' : 'Update my paces'}
            </button>
            {!busy && (<button type="button" style={quiet} onClick={onBack}>Not now</button>)}
          </div>
        </>
      )}
    </div>
  )
}
