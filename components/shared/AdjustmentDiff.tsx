// RESHAPE-FIX-WAVE2A — AdjustmentDiff
//
// Per-day before/after strip rendered under the PendingAdjustmentBanner
// prose. Lets the user see the structural change in plain terms before
// tapping Confirm. The 2026-06-26 incident root cause was a runner who
// could not see what Confirm would do — only the AI summary, which lied.
//
// Layering doctrine (SLT 2026-06-26): voice prose handles WHY, the
// rule-engine diff handles WHAT.
//
// AI provenance rule (ui-patterns.md § AIMark): this component is
// rule-engine output — derived deterministically from sessionsBefore /
// sessionsAfter — and does NOT carry the AIMark glyph. The AIMark
// belongs only on the prose above (via CoachByline in the parent).
// Mixing provenance signals here would teach users to ignore the mark.

import { computeSessionDiff, labelSession, type SessionLike } from '@/lib/coaching/diff/sessionDiff'

interface Props {
  sessionsBefore: ReadonlyArray<SessionLike | null | undefined>
  sessionsAfter:  ReadonlyArray<SessionLike | null | undefined>
}

const DAY_LABEL: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu',
  fri: 'Fri', sat: 'Sat', sun: 'Sun',
}

export default function AdjustmentDiff({ sessionsBefore, sessionsAfter }: Props) {
  const diff = computeSessionDiff(sessionsBefore, sessionsAfter)
  const changes = diff.filter(d => d.kind !== 'unchanged')

  if (changes.length === 0) {
    // No structural changes — nothing to render. The prose covers it.
    return null
  }

  return (
    <div
      role="list"
      aria-label="Plan changes"
      style={{
        display:      'flex',
        flexDirection:'column',
        gap:          '4px',
        marginTop:    '12px',
        paddingTop:   '12px',
        borderTop:    '1px solid rgba(61,38,0,0.12)',
      }}
    >
      {changes.map(entry => {
        const dayLabel = DAY_LABEL[entry.day] ?? entry.day
        const beforeLabel = entry.before ? labelSession(entry.before) : 'empty'
        const afterLabel  = entry.after  ? labelSession(entry.after)  : 'empty'

        return (
          <div
            key={entry.day}
            role="listitem"
            style={{
              display:    'flex',
              alignItems: 'baseline',
              gap:        '8px',
              fontFamily: 'var(--font-ui)',
              fontSize:   '12px',
              lineHeight: 1.45,
            }}
          >
            <span
              style={{
                minWidth:      '32px',
                color:         'var(--coach-ink, var(--ink))',
                fontWeight:    600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontSize:      '10px',
              }}
            >
              {dayLabel}
            </span>
            <span
              style={{
                color:           'var(--mute)',
                textDecoration:  'line-through',
                textDecorationColor: 'rgba(61,38,0,0.35)',
                flex:             '0 0 auto',
              }}
            >
              {beforeLabel}
            </span>
            <span
              aria-hidden="true"
              style={{ color: 'var(--mute)', fontSize: '11px' }}
            >
              →
            </span>
            <span
              style={{
                color:      'var(--warn)',
                fontWeight: 600,
                flex:       '1 1 auto',
              }}
            >
              {afterLabel}
            </span>
          </div>
        )
      })}
    </div>
  )
}
