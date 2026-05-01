// ZoneShapeCard — shows this week's time-in-zone distribution as a
// horizontal stacked bar.
//
// When `analyses` rows are available (≥1 completed run with HR analysis),
// renders ACTUAL time-in-zone — weighted aggregate across runs. Three
// buckets: below Z2 (Z1), in Z2, above Z2 (Z3+). The HR bucketing only
// produces these three categories, so we don't sub-bucket Z3 vs Z4-5.
//
// Falls back to PRESCRIBED shape (mapping session.type → its prescribed
// zone) when no analyses are provided — useful as the empty-state view
// before any runs are completed in the week.

'use client'

import { zoneForSessionType, type ZoneKey } from '@/lib/coaching/zoneRules'

type Session = { type?: string; duration_mins?: number; distance_km?: number }

export interface ZoneShapeAnalysis {
  inZonePct:       number
  aboveCeilingPct: number
  belowFloorPct:   number
  durationMins:    number
}

interface Props {
  sessions: Session[]
  /** Actual time-in-zone data from completed-run analyses. Empty / omitted
   *  means we fall back to prescribed shape. */
  analyses?: ZoneShapeAnalysis[]
}

const ZONE_ORDER: ZoneKey[] = ['Z2', 'Z3', 'Z4-5']
const ACTUAL_ORDER = ['Z1', 'Z2', 'Z3+'] as const
type ActualKey = typeof ACTUAL_ORDER[number]

const ZONE_COLOUR: Record<ZoneKey | ActualKey, string> = {
  'Z1':   'var(--s-recov)',
  'Z2':   'var(--s-easy)',
  'Z3':   'var(--s-quality)',
  'Z3+':  'var(--s-quality)',
  'Z4-5': 'var(--s-inter)',
}
const ZONE_LABEL: Record<ZoneKey | ActualKey, string> = {
  'Z1':   'Z1',
  'Z2':   'Z2',
  'Z3':   'Z3',
  'Z3+':  'Z3+',
  'Z4-5': 'Z4–5',
}

export default function ZoneShapeCard({ sessions, analyses }: Props) {
  const hasActual = (analyses?.length ?? 0) >= 1

  // Build bucket → minutes map, with the right keys for the active mode.
  const order: readonly (ZoneKey | ActualKey)[] = hasActual ? ACTUAL_ORDER : ZONE_ORDER
  const minutesByZone: Record<string, number> = {}
  for (const k of order) minutesByZone[k] = 0

  if (hasActual) {
    // Time-weighted actual: minutes(zone) = sum over runs of pct(zone) × duration.
    for (const a of analyses!) {
      minutesByZone['Z1']  += (a.belowFloorPct   / 100) * a.durationMins
      minutesByZone['Z2']  += (a.inZonePct       / 100) * a.durationMins
      minutesByZone['Z3+'] += (a.aboveCeilingPct / 100) * a.durationMins
    }
  } else {
    // Prescribed shape — map each session.type to its prescribed zone.
    // Sessions without a duration fall back to a coarse 6.5 min/km estimate.
    for (const s of sessions) {
      const zone = zoneForSessionType(s?.type)
      if (!zone) continue
      const mins = s.duration_mins
        ?? (s.distance_km != null ? Math.round(s.distance_km * 6.5) : null)
      if (mins == null || mins <= 0) continue
      minutesByZone[zone.zone] += mins
    }
  }

  const total = order.reduce((sum, k) => sum + minutesByZone[k], 0)
  if (total === 0) return null

  const titleLabel = hasActual ? 'Actual zone time' : 'Planned shape'

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
        }}>{titleLabel}</div>
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
        {order.map(k => {
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
        {order.map(k => {
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
              }}>{formatMins(Math.round(mins))}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatMins(m: number): string {
  // Inputs may be fractional minutes (when actuals are computed from
  // pct × duration weights). Round at the boundary so legend cells and
  // the total in the title never show "1.18m"-style decimals.
  const r = Math.max(0, Math.round(m))
  if (r < 60) return `${r}m`
  const h = Math.floor(r / 60)
  const rem = r % 60
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`
}
