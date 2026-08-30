'use client'

// Ruler — the canonical bounded/stepped numeric input. A horizontal draggable
// ruler with a large value readout above (metric-pair), tick marks, and a
// min→max scale. Used for self-reported training volumes (weekly km, longest
// run) where a continuous-but-stepped estimate beats a coarse band.
//
// Board ruling 2026-08-30 (CORRECT WITH AMENDMENT, replacing the old
// WEEKLY_KM_CHIPS / LONGEST_RUN_CHIPS bands): stepped (not per-unit), bounded,
// anchored. The stepped/clamped guarantee lives in ./Ruler.logic → snapToStep.
// CoachingPrinciples §18; GENERATION_CONFIG.WIZARD_VOLUME_RULER; guarded by
// INV-INPUT-LONGEST-LE-WEEKLY.
//
// Interaction: pointer-drag on the track (tap or drag, anywhere) drives the
// value — this works identically for touch and mouse. A native <input
// type="range"> is kept screen-reader/keyboard-only (visually hidden), NOT as
// the pointer target: on iOS a transparent range input has a zero-size,
// ungrabbable thumb and no tap-to-jump, so it can't commit a value by touch
// (the "greyed-out ruler" bug). `touch-action: none` stops the drag from
// scrolling the page. `value` is nullable so the field can distinguish "not yet
// set" (muted readout, thumb resting at restAnchor) from a real self-report —
// the honest-input stance §18 depends on.
//
// Pure math in ./Ruler.logic (node-testable).
//
// ui-patterns.md § Form Fields & Pickers → Ruler.

import type React from 'react'
import { useRef } from 'react'
import { snapToStep, thumbPercent, makeTicks, scaleLabels, valueFromFraction } from './Ruler.logic'

export function Ruler({
  value,
  onChange,
  min,
  max,
  step,
  unit,
  caption,
  restAnchor,
  ariaLabel,
}: {
  value: number | null
  onChange: (n: number) => void
  min: number
  max: number
  step: number
  /** Suffix beside the readout, e.g. "km/week", "km". */
  unit: string
  /** Small line under the readout, e.g. "Your longest recent effort". */
  caption?: string
  /** Where the thumb rests before the user has set a value. Default: midpoint. */
  restAnchor?: number
  ariaLabel?: string
}) {
  const touched = value !== null
  const rest = restAnchor ?? snapToStep((min + max) / 2, min, max, step)
  const shown = touched ? (value as number) : rest
  const pct = thumbPercent(shown, min, max)
  const ticks = makeTicks(21, 4)
  const labels = scaleLabels(min, max, 5)

  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  function setFromClientX(clientX: number) {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const frac = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
    onChange(valueFromFraction(frac, min, max, step))
  }
  function handleDown(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    setFromClientX(e.clientX)
  }
  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragging.current) setFromClientX(e.clientX)
  }
  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = false
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* capture may already be gone */ }
  }

  return (
    <div>
      {/* Readout — metric-pair. Muted until the user commits a value. */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '52px', fontWeight: 800,
          color: touched ? 'var(--ink)' : 'var(--mute-2)',
          letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
        }}>
          {touched ? value : '–'}
          <span style={{ fontSize: '20px', fontWeight: 600, color: 'var(--mute)', letterSpacing: 0 }}> {unit}</span>
        </div>
        {caption && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 500, color: 'var(--mute)', marginTop: '6px' }}>
            {caption}
          </div>
        )}
      </div>

      {/* Track: ticks + drawn thumb. Pointer-drag anywhere sets the value. */}
      <div
        ref={trackRef}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          position: 'relative', background: 'var(--card)', border: '1px solid var(--line)',
          borderRadius: '18px', padding: '22px 0 18px', overflow: 'hidden',
          cursor: 'pointer', touchAction: 'none', userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '44px', padding: '0 18px' }}>
          {ticks.map((t, i) => (
            <div key={i} style={{
              width: '1.5px', borderRadius: '1px', background: 'var(--line-strong)',
              height: t.h === 3 ? '34px' : t.h === 2 ? '22px' : '14px',
              opacity: t.h === 3 ? 0.85 : t.h === 2 ? 0.55 : 0.35,
            }} />
          ))}
        </div>

        {/* Drawn moss thumb — position mirrors the native range value. */}
        <div style={{
          position: 'absolute', top: '10px', bottom: '10px', width: '3px',
          background: 'var(--moss)', borderRadius: '3px',
          left: `${pct}%`, transform: 'translateX(-50%)',
          opacity: touched ? 1 : 0.5, transition: 'left 0.05s ease-out',
          pointerEvents: 'none',
        }}>
          <span style={{
            position: 'absolute', top: '-6px', left: '50%', transform: 'translateX(-50%)',
            width: '20px', height: '20px', borderRadius: '50%',
            background: 'var(--moss)', border: '3px solid var(--card)',
          }} />
        </div>

        {/* Screen-reader / keyboard control only (visually hidden). Pointer
            interaction is handled on the track above — a native range input is
            unreliable as a touch target on iOS. */}
        <input
          type="range"
          aria-label={ariaLabel}
          min={min}
          max={max}
          step={step}
          value={shown}
          onChange={e => onChange(snapToStep(Number(e.target.value), min, max, step))}
          style={{
            position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px',
            overflow: 'hidden', clip: 'rect(0 0 0 0)', border: 0, opacity: 0,
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px 0' }}>
          {labels.map((n, i) => (
            <span key={i} style={{
              fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 600,
              color: 'var(--mute-2)', fontVariantNumeric: 'tabular-nums',
            }}>
              {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
