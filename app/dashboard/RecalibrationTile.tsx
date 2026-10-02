'use client'
// PV2-H / ADR-014 / CD-13 — the living plan's client surface. Presentational only;
// DashboardClient owns the trigger (nextRecalibrationDue), routing, and the POST
// to /api/recalibrate-zones. Design 2026-08-06.
import React, { CSSProperties, useMemo, useState } from 'react'
import Button from '@/components/ui/Button'
import { DurationPicker } from '@/components/shared/DurationPicker'
import BackButton from '@/components/shared/BackButton'
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
    display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', fontFamily: 'var(--font-ui)',
  }

  return (
    <section style={card} aria-label="Time trial recalibration">
      <div style={{ font: '500 12px/1 var(--font-ui)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)' }}>
        {`Week ${weekN} · ${DAY_LABEL[sessionDay] ?? sessionDay} · ${distanceKm}K time trial`}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <h2 style={{ margin: 0, font: '600 20px/1.3 var(--font-ui)', color: 'var(--ink)' }}>
          Your time trial is in.
        </h2>
        <p style={{ margin: 0, font: '400 15px/1.5 var(--font-ui)', color: 'var(--ink-2)' }}>
          {isPaid
            ? 'Enter the time and every pace from here on updates to match it.'
            : 'Rewriting the rest of your paces around it is part of Zonna Plus.'}
        </p>
      </div>
      {/* BUTTON-MIGRATION-02 batch 7a. 🔴 I FIRST KEPT `minHeight: 52px` INLINE to
          hold the box, and the override gate refused it with the right reason:
          "a Button's box belongs to its variant and size". `BUTTON-SIZE-SCALE-01`
          ratified 44 (compact) / 47 (regular) the same day — preserving a bespoke
          52 would keep exactly the thing the scale exists to end, and grow a
          register that is meant to be frozen. All three CTAs here join the scale:
          52 -> 47, declared in `buttonGeometry`'s baseline rather than hidden. */}
      <Button variant="primary" fullWidth onClick={onEnter}>
        {isPaid ? 'Enter your time →' : 'See what Plus changes →'}
      </Button>
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
    display: 'flex', flexDirection: 'column', gap: 'var(--space-6)',
  }
  /* S2 — dismiss is never the CTA colour. `Back to today` was painted with
     `primary(true)`, so the moss never appeared in the button and the S2 gate
     was structurally blind to it (S2-GATE-NARROW-01). The helper is unchanged:
     it still paints the real confirm at line ~169. */
  const eyebrow: CSSProperties = {
    font: '500 12px/1 var(--font-ui)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)',
  }
  const skeletonBar = (width: string): CSSProperties => ({
    height: '14px', width, background: 'var(--bg-soft)', borderRadius: 'var(--radius-lg)',
  })

  return (
    <div style={screen}>
      <BackButton onClick={onBack} style={{ marginLeft: '-10px', color: busy ? 'var(--mute)' : 'var(--ink)' }} />

      {status === 'applied' ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
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
            <Button variant="secondary" fullWidth onClick={onBack}>Back to today</Button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={eyebrow}>Recovery week</div>
            <h1 style={{ margin: 0, font: '600 26px/1.25 var(--font-ui)', color: 'var(--ink)' }}>
              {`${distanceKm}K time trial`}
            </h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <label style={{ font: '500 14px/1 var(--font-ui)', color: busy ? 'var(--mute)' : 'var(--ink-2)' }}>
              Your time
            </label>
            <div style={{ opacity: busy ? 0.5 : 1, pointerEvents: busy ? 'none' : 'auto' }}>
              <DurationPicker
                showHours={false} maxMins={90}
                hours={0} mins={mins} secs={secs}
                onHoursChange={() => {}} onMinsChange={setMins} onSecsChange={setSecs}
              />
            </div>
            <div id="tt-help" style={{ font: '400 13px/1.4 var(--font-ui)', color: inRange ? 'var(--mute)' : 'var(--danger)' }}>
              {inRange ? 'Minutes and seconds, like 22:41.' : `That's outside a plausible ${distanceKm}K time.`}
            </div>
          </div>

          {busy ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} aria-live="polite">
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

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {/* `busy` is the component's own concern: it disables AND sets
                `aria-busy`, so the screen reader is told what the dimmed label
                says. The hand-rolled version said it to nobody. */}
            <Button
              variant="primary" fullWidth
              disabled={!canConfirm}
              busy={busy}
              busyLabel="Updating"
              onClick={() => { if (inRange) onConfirm(seconds) }}
             
            >
              {status === 'error' ? 'Try again' : 'Update my paces'}
            </Button>
            {/* 🔴 `ghost` + `fullWidth` IS FORBIDDEN — `GHOST-AFFORDANCE-01`: a
                full-width control owes a surface. And the hand-rolled version it
                replaces was full-width AND transparent, so it had been breaking that
                rule all along, invisibly: the gate inspects `<Button>` usage and
                cannot see a hand-rolled control. **Converting it is what made the
                violation visible**, which is the actual value of this migration.
                `secondary` is the rule's first-named remedy and still satisfies S2
                ("dismiss is never the CTA colour") — `.btn--secondary` is
                `--card` with a `--line` border, not moss. ⚠️ This comment first said
                `--bg-soft`, which is what the HAND-ROLLED control used; the variant
                uses `--card`. The visible delta is a white surface, not the grey one. */}
            {!busy && (<Button variant="secondary" fullWidth onClick={onBack}>Not now</Button>)}
          </div>
        </>
      )}
    </div>
  )
}
