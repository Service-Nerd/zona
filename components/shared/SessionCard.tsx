// SessionCard — Zonna Phase 2 shared component
// Runna-style: left accent bar + content block + right metadata.
// Handles four states: future (default), current, done, skipped.
// Session colour always from lib/session-types — never duplicated here.
// See docs/canonical/ui-patterns.md § SessionCard and docs/alignment/phase-2-decisions.md D-003, D-010.

import { getSessionColor } from '@/lib/session-types'
import { formatDistance, type DistanceUnits, type SessionMetric } from '@/lib/format'
import HrPendingStatusRow, { type HrPendingState } from './HrPendingStatusRow'

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
  /** Which metric to render. Resolve via `resolveSessionMetric` upstream so
   *  per-session overrides → plan primary_metric → global preference cascade
   *  is consistent with the session detail screen. Defaults to 'distance'. */
  metric?: SessionMetric
  /** HR-SYNC-02: when non-null on a done session, renders the pending-HR
   *  status row beneath the provenance line and overrides the done-state
   *  visual treatment back to full presence (the run still matters).
   *  See `lib/coaching/hrPending.ts → classifyHrPending`. */
  hrPendingState?: HrPendingState | null
  /** Required when hrPendingState='fallback'. Caller should wire to the
   *  throttled `retryHrFromUi()` wrapper in `lib/health/clientSync.ts`. */
  onHrRetry?:     () => void | Promise<void>
  /** True while a retry is in flight. Drives the "Checking…" copy. */
  isHrRetrying?:  boolean
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
  metric = 'distance',
  hrPendingState = null,
  onHrRetry,
  isHrRetrying = false,
}: Props) {
  const accentColor = getSessionColor(type)
  const isDone = state === 'done'
  const isSkipped = state === 'skipped'
  const isCurrent = state === 'current'
  // HR-SYNC-02: when pending, suppress the done-state's "transparent / muted"
  // treatment. The run still matters; we're just waiting on Apple's sync.
  const showHrPending = isDone && hrPendingState != null
  const renderAsDone  = isDone && !showHrPending

  // Format duration: "46min" or "1h 12min"
  function fmtDur(mins: number): string {
    if (mins < 60) return `${mins}min`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}min` : `${h}h`
  }

  // Right-side metric: render the metric the caller chose. Falls back to the
  // other one if the chosen value isn't available (e.g. session has distance
  // but no duration), so the card never goes blank. Completion km wins over
  // planned km when present.
  // Race day keeps the iconic decimal (21.1 / 13.1) via opts.exact.
  const isRace = type === 'race'
  const distText = isDone && completion?.distanceKm != null
    ? formatDistance(completion.distanceKm, units, { exact: true })
    : distanceKm != null
    ? formatDistance(distanceKm, units, { exact: isRace })
    : null
  const durText = durationMin != null ? fmtDur(durationMin) : null

  const rightValue = metric === 'duration'
    ? (durText ?? distText)
    : (distText ?? durText)

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
          : renderAsDone
          ? 'none'
          : `1px solid var(--line)`,
        background: renderAsDone || isSkipped ? 'transparent' : 'var(--card)',
        cursor: onClick ? 'pointer' : 'default',
        minHeight: showHrPending ? '76px' : '64px',
        overflow: 'hidden',
        transition: 'border-color 0.12s, min-height 0.2s ease-out',
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          width: '3px',
          flexShrink: 0,
          background: accentColor,
          opacity: renderAsDone ? 0.3 : isSkipped ? 0.2 : 1,
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
              fontWeight: renderAsDone ? 500 : 600,
              color: renderAsDone ? 'var(--mute)' : isSkipped ? 'var(--danger)' : 'var(--ink)',
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
          {/* HR-SYNC-02: pending-HR status row beneath provenance. Sits in
           *  --mute (pending) or --ink-2 (fallback, tappable). */}
          {showHrPending && (
            <div style={{ marginTop: '4px' }}>
              <HrPendingStatusRow
                state={hrPendingState!}
                onRetry={onHrRetry}
                isRetrying={isHrRetrying}
                size="sm"
              />
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
            {rightValue && (
              <div
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: renderAsDone ? '14px' : '17px',
                  fontWeight: renderAsDone ? 600 : 700,
                  color: renderAsDone ? 'var(--mute)' : 'var(--ink)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.3px',
                  lineHeight: 1,
                }}
              >
                {rightValue}
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
