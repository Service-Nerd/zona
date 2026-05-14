// ZoneBar — canonical zone-visualisation primitive.
//
// Five segments in a row, one filled in its zone colour. Highest information
// per pixel of any chart we put on the session surfaces — at a glance, the
// user sees both the zone they're in AND its position in the 5-zone arc.
//
// Used on the session card (Today), the session card prescription block
// (Session Detail), and the post-plan-gen zone intro.
//
// Zone → colour mapping comes from ui-patterns.md § HR Zone → Session Colour
// Coherence. Zone colours and session colours are the same token by design.

import React from 'react'

export type Zone = 1 | 2 | 3 | 4 | 5

const ZONE_COLOURS: Record<Zone, string> = {
  1: 'var(--s-recov)',
  2: 'var(--s-easy)',
  3: 'var(--s-quality)',
  4: 'var(--s-race)',
  5: 'var(--s-inter)',
}

export interface ZoneBarProps {
  /** The active zone (1–5). The other four segments render in --bg-soft. */
  activeZone: Zone
  /** Segment height in px. Default 4 (session card variant). 6 on Session Detail. */
  height?: number
  /** Show 1–5 number labels under the bar. Off by default on the session card,
   *  on by default on Session Detail's prescription card. */
  showLabels?: boolean
  /** Extra inline style on the container — for spacing tweaks. */
  style?: React.CSSProperties
}

export default function ZoneBar({
  activeZone,
  height = 4,
  showLabels = false,
  style,
}: ZoneBarProps) {
  const colour = ZONE_COLOURS[activeZone]
  return (
    <div style={style}>
      {/* 5 segments */}
      <div
        role="img"
        aria-label={`Zone ${activeZone} of 5`}
        style={{
          display: 'flex', gap: '3px',
          marginBottom: showLabels ? '4px' : 0,
        }}
      >
        {([1, 2, 3, 4, 5] as Zone[]).map(z => (
          <div
            key={z}
            style={{
              flex: 1,
              height: `${height}px`,
              borderRadius: '2px',
              background: z === activeZone ? colour : 'var(--bg-soft)',
              transition: 'background 0.2s ease',
            }}
          />
        ))}
      </div>
      {showLabels && (
        <div style={{ display: 'flex', gap: '3px' }}>
          {([1, 2, 3, 4, 5] as Zone[]).map(z => (
            <div
              key={z}
              style={{
                flex: 1,
                fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 600,
                color: z === activeZone ? colour : 'var(--mute)',
                textAlign: 'center',
                letterSpacing: '0.06em',
              }}
            >
              {z}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Resolve a zone NUMBER (1–5) from a session type. Distinct from
 * `zoneForSessionType` in `lib/coaching/zoneRules.ts` which returns a
 * `ZoneBand` object grouping 4+5 as 'Z4-5'. This helper is for the visual
 * ZoneBar — one segment lights up per session type, including Z5 for
 * intervals (separate from Z4 for race effort).
 */
export function zoneNumberForType(type: string | undefined): Zone | null {
  if (!type) return null
  if (type === 'recovery') return 1
  if (type === 'easy' || type === 'run' || type === 'long') return 2
  if (type === 'quality' || type === 'tempo') return 3
  if (type === 'race') return 4
  if (type === 'intervals' || type === 'hard') return 5
  return null
}

/**
 * Short label for a zone — used in eyebrows and chips ("Zone 2 · aerobic").
 */
export function zoneShortName(zone: Zone): string {
  return ({
    1: 'recovery',
    2: 'aerobic',
    3: 'tempo',
    4: 'threshold',
    5: 'VO₂ max',
  } as Record<Zone, string>)[zone]
}
