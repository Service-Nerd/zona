// ZoneInfoSheet — slide-up sheet that explains what a zone is.
// Used by: session card zone chip (tap to learn), Profile zones (tap to expand).
//
// CLAUDE.md UX: slide-up sheets have a mirrored nav bar at bottom, not top.
// This component renders the close affordance at the bottom edge.

'use client'

import { useEffect } from 'react'
import { ZONE_COPY, type ZoneCopy } from '@/lib/coaching/zoneCopy'
import type { ZoneKey } from '@/lib/coaching/zoneRules'

interface Props {
  zoneKey: ZoneKey | 'Z1' | 'Z5' | null
  /** Live HR band for this zone (lo, hi). Null when HR data unavailable. */
  hrBand?: { lo: number; hi: number } | null
  onClose: () => void
}

export default function ZoneInfoSheet({ zoneKey, hrBand, onClose }: Props) {
  useEffect(() => {
    if (!zoneKey) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [zoneKey, onClose])

  if (!zoneKey) return null
  const copy: ZoneCopy = ZONE_COPY[zoneKey]
  if (!copy) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(26,26,26,0.4)',
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
          maxHeight: '80vh',
          overflowY: 'auto',
          animation: 'vetra-slide-up 0.22s ease-out',
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: '36px', height: '4px',
          background: 'var(--line)', borderRadius: '2px',
          margin: '6px auto 18px',
        }} />

        {/* Header */}
        <div style={{ padding: '0 20px 4px' }}>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
            color: 'var(--mute)', letterSpacing: '0.1em', textTransform: 'uppercase',
            marginBottom: '6px',
          }}>{copy.label}</div>
          <div style={{
            fontFamily: 'var(--font-brand)', fontSize: '24px', fontWeight: 600,
            color: 'var(--ink)', letterSpacing: '-0.4px', lineHeight: 1.15,
          }}>{copy.name}</div>
          {hrBand && (
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500,
              color: 'var(--moss)', marginTop: '4px',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {hrBand.lo}–{hrBand.hi} bpm
            </div>
          )}
        </div>

        {/* Body — three lines, no headers. Voice does the work. */}
        <div style={{ padding: '18px 20px 8px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Line>{copy.what}</Line>
          <Line>{copy.feel}</Line>
          <Line>{copy.why}</Line>
        </div>

        {/* Bottom close — mirrored nav per CLAUDE.md UI principles */}
        <div style={{
          position: 'sticky', bottom: 0,
          padding: '14px 20px 20px',
          background: 'var(--card)',
          borderTop: '0.5px solid var(--line)',
          marginTop: '8px',
        }}>
          <button onClick={onClose} style={{
            width: '100%', padding: '12px',
            background: 'var(--bg-soft)',
            border: 'none', borderRadius: '10px',
            fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
            color: 'var(--ink)', cursor: 'pointer',
            letterSpacing: '0.04em',
          }}>Close</button>
        </div>
      </div>

      <style>{`
        @keyframes vetra-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes vetra-slide-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </div>
  )
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 400,
      color: 'var(--ink-2)', lineHeight: 1.55,
    }}>{children}</div>
  )
}
