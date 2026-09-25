// ZoneInfoSheet — slide-up sheet that explains what a zone is.
// Used by: session card zone chip (tap to learn), Profile zones (tap to expand).
//
// CLAUDE.md UX: slide-up sheets have a mirrored nav bar at bottom, not top.
// This component renders the close affordance at the bottom edge.

'use client'

import Sheet from './Sheet'
import IconButton from '@/components/ui/IconButton'
import { ZONE_COPY, type ZoneCopy } from '@/lib/coaching/zoneCopy'
import type { ZoneKey } from '@/lib/coaching/zoneRules'

interface Props {
  zoneKey: ZoneKey | 'Z1' | 'Z5' | null
  /** Live HR band for this zone (lo, hi). Null when HR data unavailable. */
  hrBand?: { lo: number; hi: number } | null
  onClose: () => void
}

export default function ZoneInfoSheet({ zoneKey, hrBand, onClose }: Props) {
  if (!zoneKey) return null
  const copy: ZoneCopy = ZONE_COPY[zoneKey]
  if (!copy) return null

  return (
    <Sheet onClose={onClose} ariaLabel={copy.name}>
      {(close) => (
        <>
          {/* Header. ⚠️ THE CLOSE IS THE STANDARDISED CROSS (founder, device
              review 2026-09-25) — the same `IconButton shape="circle"` as
              `ModifyPlanSheet`. This sheet had a bottom full-width "Close"
              while its sibling had a top cross, so two sheets disagreed about
              how to leave them. 🔻 The real fix is that `Sheet` should OWN its
              close rather than each sheet hand-rolling one — filed as
              `SHEET-CLOSE-OWNER-01`, the same shape as `.cta-pill` and
              `BackButton`. ⚠️ `CLAUDE.md` § UI Principles says *"slide-up
              sheets: mirrored nav bar at bottom, not top"*, and this makes the
              second of two sheets disagree with it — flagged for the board in
              that item rather than silently reversed here. */}
          <div style={{ padding: '0 20px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
              color: 'var(--mute)', letterSpacing: '0.1em', textTransform: 'uppercase',
              marginBottom: 'var(--space-2)',
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
            <IconButton
              onClick={onClose}
              ariaLabel="Close"
              shape="circle"
              style={{ marginTop: '-6px', marginRight: '-6px' }}
              icon={
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              }
            />
          </div>

          {/* Body — three lines, no headers. Voice does the work. */}
          <div style={{ padding: '18px 20px 8px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Line>{copy.what}</Line>
            <Line>{copy.feel}</Line>
            <Line>{copy.why}</Line>
          </div>

        </>
      )}
    </Sheet>
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
