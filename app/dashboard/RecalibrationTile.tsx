'use client'
// PV2-H / ADR-014 / CD-13 — the living plan's client surface. Presentational only;
// DashboardClient owns the trigger (nextRecalibrationDue), routing, and the POST
// to /api/recalibrate-zones. Design 2026-08-06.
import React, { CSSProperties, useMemo, useState } from 'react'
import { DurationPicker } from '@/components/shared/DurationPicker'
import {
  recalSecondsFromParts, isRecalTimeInRange, formatRecalTime, defaultRecalMins,
} from '@/lib/coaching/recalTime'

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

export function RecalibrationEntryScreen({
  distanceKm, status, onBack, onConfirm,
}: RecalibrationEntryScreenProps) {
  // Wheel input (FORMS-PRIM-01): minutes:seconds via the shared DurationPicker —
  // no keyboard, no format-guessing, no iOS zoom trap. Pre-filled to a plausible
  // time so the runner nudges rather than scrolling from zero.
  const [mins, setMins] = useState(() => defaultRecalMins(distanceKm))
  const [secs, setSecs] = useState(0)

  const seconds = useMemo(() => recalSecondsFromParts(mins, secs), [mins, secs])
  const inRange = isRecalTimeInRange(seconds)
  const busy = status === 'confirming'
  const canConfirm = inRange && !busy

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
            <div style={eyebrow}>{`${distanceKm}K · ${formatRecalTime(mins, secs)}`}</div>
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
            <label style={{ font: '500 14px/1 var(--font-ui)', color: busy ? 'var(--mute)' : 'var(--ink-2)' }}>
              Your time
            </label>
            <div style={{ opacity: busy ? 0.5 : 1, pointerEvents: busy ? 'none' : 'auto' }}>
              <DurationPicker
                showHours={false} showSeconds maxMins={90}
                hours={0} mins={mins} secs={secs}
                onHoursChange={() => {}} onMinsChange={setMins} onSecsChange={setSecs}
              />
            </div>
            <div id="tt-help" style={{ font: '400 13px/1.4 var(--font-ui)', color: inRange ? 'var(--mute)' : 'var(--danger)' }}>
              {inRange ? 'Minutes and seconds, like 22:41.' : `That's outside a plausible ${distanceKm}K time.`}
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
              onClick={() => { if (inRange) onConfirm(seconds) }}>
              {busy ? 'Updating' : status === 'error' ? 'Try again' : 'Update my paces'}
            </button>
            {!busy && (<button type="button" style={quiet} onClick={onBack}>Not now</button>)}
          </div>
        </>
      )}
    </div>
  )
}
