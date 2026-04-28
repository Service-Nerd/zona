// ZoneShapeCard — shows this week's prescribed time-in-zone distribution
// as a horizontal stacked bar. Makes the polarised shape (mostly Z2,
// some Z3/Z4-5) legible at a glance.
//
// Phase 1: prescribed-only (each session's duration → prescribed zone).
// A future iteration could overlay actual HR distribution from completions.

'use client'

import { zoneForSessionType, type ZoneKey } from '@/lib/coaching/zoneRules'

type Session = { type?: string; duration_mins?: number; distance_km?: number }

interface Props {
  sessions: Session[]
}

const ZONE_ORDER: ZoneKey[] = ['Z2', 'Z3', 'Z4-5']
const ZONE_COLOUR: Record<ZoneKey, string> = {
  'Z1': 'var(--s-recov)',
  'Z2': 'var(--s-easy)',
  'Z3': 'var(--s-quality)',
  'Z4-5': 'var(--s-inter)',
}
const ZONE_LABEL: Record<ZoneKey, string> = {
  'Z1': 'Z1',
  'Z2': 'Z2',
  'Z3': 'Z3',
  'Z4-5': 'Z4–5',
}

export default function ZoneShapeCard({ sessions }: Props) {
  // Tally minutes per zone. Sessions without a duration but with a distance
  // get a coarse estimate (~6.5 min/km easy pace). Better than dropping
  // them silently — most plans include both.
  const minutesByZone: Record<ZoneKey, number> = { 'Z1': 0, 'Z2': 0, 'Z3': 0, 'Z4-5': 0 }
  for (const s of sessions) {
    const zone = zoneForSessionType(s?.type)
    if (!zone) continue
    const mins = s.duration_mins
      ?? (s.distance_km != null ? Math.round(s.distance_km * 6.5) : null)
    if (mins == null || mins <= 0) continue
    minutesByZone[zone.zone] += mins
  }

  const total = ZONE_ORDER.reduce((sum, k) => sum + minutesByZone[k], 0)
  if (total === 0) return null

  return (
    <div style={{
      background: 'var(--card)',
      borderRadius: '14px',
      border: '0.5px solid var(--line)',
      padding: '14px 16px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: '10px',
      }}>
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
          color: 'var(--mute)', letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>This week's shape</div>
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 500,
          color: 'var(--mute)', fontVariantNumeric: 'tabular-nums',
        }}>{formatMins(total)}</div>
      </div>

      {/* Stacked bar */}
      <div style={{
        display: 'flex', height: '10px', borderRadius: '5px',
        overflow: 'hidden', background: 'var(--bg-soft)',
        marginBottom: '12px',
      }}>
        {ZONE_ORDER.map(k => {
          const pct = (minutesByZone[k] / total) * 100
          if (pct === 0) return null
          return (
            <div
              key={k}
              style={{
                width: `${pct}%`,
                background: ZONE_COLOUR[k],
                transition: 'width 0.3s ease',
              }}
              title={`${ZONE_LABEL[k]} · ${formatMins(minutesByZone[k])}`}
            />
          )
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', gap: '12px',
      }}>
        {ZONE_ORDER.map(k => {
          const mins = minutesByZone[k]
          const pct = Math.round((mins / total) * 100)
          return (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: ZONE_COLOUR[k], flexShrink: 0,
                }} />
                <div style={{
                  fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 600,
                  color: 'var(--mute)', letterSpacing: '0.04em',
                }}>{ZONE_LABEL[k]}</div>
              </div>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
                color: 'var(--ink)', fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.1,
              }}>{pct}%</div>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '10px',
                color: 'var(--mute)', fontVariantNumeric: 'tabular-nums',
              }}>{formatMins(mins)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatMins(m: number): string {
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h}h` : `${h}h ${r}m`
}
