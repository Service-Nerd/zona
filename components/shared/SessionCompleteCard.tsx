// SessionCompleteCard — COMPLETE-01.
//
// Kahneman peak-end artefact rendered after RPE entry on both the manual
// reflect-view path (SessionPopupInner) and the Strava/HealthKit-matched
// path (PostRunScreen). Screenshot-able by design — bold metric, Warm
// Slate restraint, brand voice anchor stamp.
//
// Two render states (tier-divergent in inputs, not in component):
//
//   State A — run_analysis present (paid + analysed):
//     TIME IN ZONE eyebrow → big % digit → ZoneBar (Pattern 21).
//     RPE and fatigue chips render below if present.
//
//   State B — no run_analysis (free, or paid pre-analysis):
//     EFFORT eyebrow → big RPE / 10 digit → fatigue chip.
//
// Hand-authored completion copy via getCompletionCopy (rule-engine
// output, not model) — therefore no CoachByline, no AIMark. Provenance
// honesty per ui-patterns.md § Pattern 16.
//
// Save Image affordance is deferred to v1.1 (see backlog SAVE-IMG-01)
// — this card is iOS-screenshot-able as-is; v1.1 will add a next/og
// renderer + @capacitor/share for higher-fidelity export.

import React from 'react'
import ZoneBar, { zoneNumberForType } from './ZoneBar'
import { getSessionLabel } from '@/lib/session-types'
import { BRAND } from '@/lib/brand'

export interface SessionCompleteCardProps {
  /** Session type — drives the chip label, zone bar, and completion copy. */
  sessionType: string
  /** Completion date — formatted on the card as "Wed · 22 May". */
  date?: Date | string | null
  /** Hand-authored completion copy (sourced from getCompletionCopy in DashboardClient). */
  completionCopy: { headline: string; body: string }
  /** Per-session % in prescribed zone (`run_analysis.hr_in_zone_pct`). When
   *  null, the card renders State B. */
  zonePct: number | null
  /** Self-reported effort 1–10. Always shown in State B; small chip in State A. */
  rpe: number | null
  /** Fatigue tag — 'Fresh' / 'Fine' / 'Heavy' / 'Wrecked'. */
  fatigueTag: 'Fresh' | 'Fine' | 'Heavy' | 'Wrecked' | string | null
  /** DOCTRINE-01 — when the discipline ledger advanced this week, the card
   *  surfaces `BRAND.brandStatement` quietly below the voice anchor. False
   *  / undefined → only the voice anchor renders. */
  ledgerAdvancedThisWeek?: boolean
}

// Three-letter weekday + day + three-letter month — "Wed · 22 May". Short
// and reads at thumbnail size in a screenshot.
function formatDate(d: Date | string | null | undefined): string | null {
  if (!d) return null
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/^(\w+) /, '$1 · ')
}

// Fatigue tag → token. Mirrors the chip palette in SessionPopupInner reflect
// view — kept canonical so the chip reads the same across surfaces.
function fatigueChipColour(tag: string | null): string {
  switch (tag) {
    case 'Fresh':   return 'var(--s-recov)'
    case 'Fine':    return 'var(--s-easy)'
    case 'Heavy':   return 'var(--warn)'
    case 'Wrecked': return 'var(--s-inter)'
    default:        return 'var(--mute)'
  }
}

export default function SessionCompleteCard({
  sessionType,
  date,
  completionCopy,
  zonePct,
  rpe,
  fatigueTag,
  ledgerAdvancedThisWeek = false,
}: SessionCompleteCardProps) {
  const dateLabel = formatDate(date)
  const chipLabel = getSessionLabel(sessionType)
  const zone      = zoneNumberForType(sessionType)
  const showZone  = zonePct != null && zone != null
  const pctDisplay = zonePct != null ? Math.round(zonePct) : null

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)',
      padding: '24px 20px',
      position: 'relative',
    }}>
      {/* Top row — session chip on left, date on right. Pattern 6 chip. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '8px', marginBottom: '20px',
      }}>
        <span style={{
          display: 'inline-block',
          fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
          color: 'var(--ink)',
          background: 'var(--bg-soft)',
          padding: '4px 10px', borderRadius: '999px',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          {chipLabel}
        </span>
        {dateLabel && (
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: '12px',
            color: 'var(--mute)',
          }}>
            {dateLabel}
          </span>
        )}
      </div>

      {/* Hero metric stack — State A (% in zone) or State B (RPE / 10). */}
      {showZone ? (
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
            color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: '8px',
          }}>
            Time in zone
          </div>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: '4px',
            marginBottom: '12px',
            fontFamily: 'var(--font-ui)', letterSpacing: '-0.05em',
          }}>
            <span style={{
              fontSize: '44px', fontWeight: 800, color: 'var(--ink)',
              fontVariantNumeric: 'tabular-nums', lineHeight: 1,
            }}>
              {pctDisplay}
            </span>
            <span style={{
              fontSize: '22px', fontWeight: 600, color: 'var(--moss)',
            }}>
              %
            </span>
          </div>
          <ZoneBar activeZone={zone!} height={5} showLabels />
        </div>
      ) : (
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
            color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: '8px',
          }}>
            Effort
          </div>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: '6px',
            marginBottom: fatigueTag ? '14px' : 0,
            fontFamily: 'var(--font-ui)', letterSpacing: '-0.05em',
          }}>
            <span style={{
              fontSize: '44px', fontWeight: 800, color: 'var(--ink)',
              fontVariantNumeric: 'tabular-nums', lineHeight: 1,
            }}>
              {rpe ?? '—'}
            </span>
            <span style={{
              fontSize: '22px', fontWeight: 600, color: 'var(--mute)',
            }}>
              / 10
            </span>
          </div>
          {fatigueTag && (
            <span style={{
              display: 'inline-block',
              fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600,
              color: fatigueChipColour(fatigueTag),
              background: `color-mix(in srgb, ${fatigueChipColour(fatigueTag)} 12%, transparent)`,
              border: `1px solid ${fatigueChipColour(fatigueTag)}`,
              padding: '5px 12px', borderRadius: '999px',
            }}>
              {fatigueTag}
            </span>
          )}
        </div>
      )}

      {/* Hand-authored completion copy. No AIMark — rule-engine output. */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{
          fontFamily: 'var(--font-brand)', fontSize: '17px', fontWeight: 600,
          color: 'var(--ink)', letterSpacing: '-0.2px', lineHeight: 1.3,
          marginBottom: '6px',
        }}>
          {completionCopy.headline}
        </div>
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '13.5px',
          color: 'var(--ink-2)', lineHeight: 1.55,
        }}>
          {completionCopy.body}
        </div>
      </div>

      {/* Voice anchor stamp — quiet but present. Matches Pattern 10 eyebrow
          tracking; signals "watermark" without lowering opacity. */}
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
        color: 'var(--mute)', letterSpacing: '0.14em', textTransform: 'uppercase',
      }}>
        {BRAND.voiceAnchor}
      </div>

      {/* DOCTRINE-01 — append BRAND.brandStatement quietly when the
          discipline ledger advanced this week. Hairline forces visual
          breathing room between the anchor and the statement so they
          don't read as a single overrun stamp. */}
      {ledgerAdvancedThisWeek && (
        <>
          <div style={{ height: '1px', background: 'var(--line)', margin: '12px 0' }} />
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
            color: 'var(--mute)', letterSpacing: '0.14em', textTransform: 'uppercase',
          }}>
            {BRAND.brandStatement}
          </div>
        </>
      )}
    </div>
  )
}
