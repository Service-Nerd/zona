'use client'

// The progress arc row — "where I was · where I am · what I'm aiming at".
//
// UX-COACH-01. Split out of RaceTimesCard deliberately: the card fetches an
// authed, tier-gated endpoint, so while the arc lived inside it there was no
// way to LOOK at the thing without a live paid session. That is how the first
// attempt shipped as a comment above an unchanged component. This takes plain
// props, so `/coach-preview` renders every state side by side.
//
// Shape decisions (which points exist, direction, goal gap) belong to
// `lib/coaching/raceProgressArc.ts` and are unit-tested there. This file only
// decides how the shape LOOKS. Strings come from `raceProjectionsCopy.ts`.

import { Fragment } from 'react'
import { formatClockTime, formatElapsedDelta } from '@/lib/format'
import type { ArcPointKey, RaceProgressArc } from '@/lib/coaching/raceProgressArc'
import type { RaceProjectionsCopy } from './raceProjectionsCopy'

type ArcCopy = NonNullable<RaceProjectionsCopy['arc']>

export function captionFor(arc: RaceProgressArc, copy: ArcCopy, key: ArcPointKey): string {
  if (key === 'now') {
    if (!arc.direction) return ''
    if (arc.direction === 'level') return copy.direction.level
    const delta = formatElapsedDelta(arc.deltaSeconds)
    return delta ? copy.direction[arc.direction].replace('{delta}', delta) : ''
  }
  if (key === 'goal') {
    if (arc.goalReached) return copy.reached
    const delta = formatElapsedDelta(arc.secondsToGoal)
    return delta ? copy.toGo.replace('{delta}', delta) : ''
  }
  return ''
}

/** One spoken sentence for the whole arc: a screen reader should not have to
 *  stitch three columns and two chevrons back into a claim. */
export function arcAriaLabel(arc: RaceProgressArc, copy: ArcCopy): string {
  const parts = arc.points.map(p => `${copy[p.key]} ${formatClockTime(p.seconds)}`)
  const now = captionFor(arc, copy, 'now')
  return now ? `${parts.join(', ')}. ${now} than plan start.` : parts.join(', ')
}

function captionColour(arc: RaceProgressArc, key: ArcPointKey): string {
  // Moss is earned, not decorative: only a real improvement and a met goal get
  // it. "Slower" stays muted rather than going --danger; --danger is errors
  // only and never appears in training UI (ADR-007).
  if (key === 'now')  return arc.direction === 'faster' ? 'var(--moss)' : 'var(--mute)'
  if (key === 'goal') return arc.goalReached ? 'var(--moss)' : 'var(--mute)'
  return 'var(--mute)'
}

export function RaceProgressArcRow({ arc, copy }: { arc: RaceProgressArc; copy: ArcCopy }) {
  return (
    <div
      role="group"
      aria-label={arcAriaLabel(arc, copy)}
      // Left-aligned with a fixed gap, NOT space-between. With three points
      // the two look identical; with two (a finish-goal runner, the common
      // beginner case) space-between flings them to opposite edges and leaves
      // a hole in the middle of the card.
      style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', gap: '10px' }}
    >
      {arc.points.map((point, i) => {
        const isNow = point.key === 'now'
        return (
          <Fragment key={point.key}>
            {i > 0 && (
              <span aria-hidden style={{
                fontFamily: 'var(--font-ui)', fontSize: '15px', color: 'var(--mute)',
                opacity: 0.45, alignSelf: 'center', paddingBottom: '18px', flexShrink: 0, margin: '0 -2px',
              }}>
                &rsaquo;
              </span>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
              <span style={{
                fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 700,
                color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.07em',
                whiteSpace: 'nowrap',
              }}>
                {copy[point.key]}
              </span>
              <span style={{
                fontFamily: 'var(--font-ui)',
                fontSize: isNow ? '26px' : '15px',
                fontWeight: isNow ? 800 : 600,
                color: isNow ? 'var(--ink)' : 'var(--ink-2)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: isNow ? '-0.8px' : '-0.2px',
                lineHeight: 1.05,
                whiteSpace: 'nowrap',
              }}>
                {formatClockTime(point.seconds)}
              </span>
              {/* The caption row is reserved on EVERY column, occupied or not,
                  so the three values sit on one baseline. Without it a column
                  with nothing to say pulls its neighbours out of alignment. */}
              <span style={{
                fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 600,
                color: captionColour(arc, point.key), minHeight: '14px', lineHeight: 1.25,
              }}>
                {captionFor(arc, copy, point.key)}
              </span>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}
