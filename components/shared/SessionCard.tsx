// SessionCard — Zona Phase 2 shared component
// Runna-style: left accent bar + content block + right metadata.
// Handles four states: future (default), current, done, skipped.
// Session colour always from lib/session-types — never duplicated here.
// See docs/canonical/ui-patterns.md § SessionCard and docs/alignment/phase-2-decisions.md D-003, D-010.

import { getSessionColor } from '@/lib/session-types'
import { formatDistance, type DistanceUnits } from '@/lib/format'

type SessionState = 'future' | 'current' | 'done' | 'skipped'

type CompletionData = {
  distanceKm?: number
  avgBpm?: number
  viaStrava?: boolean
  activityName?: string
}

type Props = {
  type: string
  name: string
  /** Supporting detail — e.g. "Zone 2 · ≤145bpm" */
  detail?: string
  distanceKm?: number
  durationMin?: number
  state?: SessionState
  completion?: CompletionData
  onClick?: () => void
  showDragHandle?: boolean
  /** User's preferred display units. Plan distances are stored in km. */
  units?: DistanceUnits
}

export default function SessionCard({
  type,
  name,
  detail,
  distanceKm,
  durationMin,
  state = 'future',
  completion,
  onClick,
  showDragHandle = false,
  units = 'km',
}: Props) {
  const accentColor = getSessionColor(type)
  const isDone = state === 'done'
  const isSkipped = state === 'skipped'
  const isCurrent = state === 'current'

  // Format duration: "46min" or "1h 12min"
  function fmtDur(mins: number): string {
    if (mins < 60) return `${mins}min`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}min` : `${h}h`
  }

  // Right-side metric: prefer completion data if done, else planned.
  // Race day keeps the iconic decimal (21.1 / 13.1) via opts.exact.
  // Strava-recorded completion km also keeps 1 dp (real recorded data).
  const isRace = type === 'race'
  const rightDist = isDone && completion?.distanceKm != null
    ? formatDistance(completion.distanceKm, units, { exact: true })
    : distanceKm != null
    ? formatDistance(distanceKm, units, { exact: isRace })
    : null

  const rightDur = durationMin != null ? fmtDur(durationMin) : null

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        borderRadius: 'var(--radius-md)',
        border: isSkipped
          ? '1px dashed var(--line-strong)'
          : isCurrent
          ? `1px solid var(--line-strong)`
          : isDone
          ? 'none'
          : `1px solid var(--line)`,
        background: isDone || isSkipped ? 'transparent' : 'var(--card)',
        cursor: onClick ? 'pointer' : 'default',
        minHeight: '64px',
        overflow: 'hidden',
        transition: 'border-color 0.12s',
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          width: '3px',
          flexShrink: 0,
          background: accentColor,
          opacity: isDone ? 0.3 : isSkipped ? 0.2 : 1,
          borderRadius: '2px 0 0 2px',
        }}
      />

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: '14px 12px 14px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          minWidth: 0,
        }}
      >
        {/* Done checkmark */}
        {isDone && (
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: 'var(--moss-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M1.5 5L4 7.5L8.5 2.5"
                stroke="var(--moss)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

        {/* Name + detail */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '15px',
              fontWeight: isDone ? 500 : 600,
              color: isDone ? 'var(--mute)' : isSkipped ? 'var(--danger)' : 'var(--ink)',
              textDecoration: isSkipped ? 'line-through' : 'none',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {name}
          </div>
          {detail && !isSkipped && (
            <div
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '12px',
                fontWeight: 400,
                color: 'var(--mute)',
                marginTop: '2px',
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {detail}
            </div>
          )}
          {/* Strava activity name if done */}
          {isDone && completion?.viaStrava && completion?.activityName && (
            <div
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '11px',
                color: 'var(--strava)',
                marginTop: '2px',
                opacity: 0.75,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              via Strava · {completion.activityName}
            </div>
          )}
        </div>

        {/* Right side */}
        {isSkipped ? (
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '11px',
              fontWeight: 500,
              color: 'var(--danger)',
              flexShrink: 0,
            }}
          >
            Skipped
          </span>
        ) : (
          <div
            style={{
              flexShrink: 0,
              textAlign: 'right',
            }}
          >
            {rightDist && (
              <div
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: isDone ? '14px' : '17px',
                  fontWeight: isDone ? 600 : 700,
                  color: isDone ? 'var(--mute)' : 'var(--ink)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.3px',
                  lineHeight: 1,
                }}
              >
                {rightDist}
              </div>
            )}
            {rightDur && (
              <div
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '11px',
                  fontWeight: 400,
                  color: 'var(--mute-2)',
                  marginTop: rightDist ? '3px' : 0,
                  lineHeight: 1,
                }}
              >
                {rightDur}
              </div>
            )}
          </div>
        )}

        {/* Drag handle */}
        {showDragHandle && (
          <div
            style={{
              flexShrink: 0,
              color: 'var(--mute-2)',
              fontSize: '14px',
              paddingLeft: '4px',
              cursor: 'grab',
            }}
          >
            ⋮⋮
          </div>
        )}
      </div>
    </div>
  )
}
