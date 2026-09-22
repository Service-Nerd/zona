// LoadShape — where this week's load sits against the runner's recent normal.
//
// A5 (Design Board, app review 2026-09-22): "Coach gets a progress language —
// SHAPE, never SCORE." The load ratio was rendered as a bare `1.15x` at 28px /
// 800, with its meaning demoted to an 11px sub-line and the explanation hidden
// behind a tap. Sierra: *a number that has to be tapped to mean anything has
// taught nobody anything.*
//
// ⚠️ THIS IS A RECORDED REVERSAL OF "no dashboards", on Zhuo's distinction: the
// rule was against a wall of numbers substituting for a decision, not against
// showing a runner their own progress. A shape is not a dashboard — it answers
// the question at a glance instead of posing it.
//
// The band is the runner's normal (LOAD_RATIO.under … LOAD_RATIO.watch, the same
// constants the coaching layer flags on). The marker is this week. Reading it
// requires no arithmetic and no tap: inside the band is fine, past its right
// edge is more than usual, short of its left edge is less.
//
// Deliberately NOT a chart. No axis, no gridlines, no tick labels, no legend —
// those are the wall of numbers the rule was actually written against.

'use client'

import { LOAD_RATIO } from '@/lib/coaching/constants'

// Domain, not a coaching threshold: how much of the number line to draw so the
// normal band sits centrally and an extreme week still lands on the track
// rather than off the end of it.
const DOMAIN_MIN = 0.5
const DOMAIN_MAX = 1.7

const pct = (v: number) =>
  ((Math.min(Math.max(v, DOMAIN_MIN), DOMAIN_MAX) - DOMAIN_MIN) / (DOMAIN_MAX - DOMAIN_MIN)) * 100

export default function LoadShape({ ratio, color, label }: {
  /** Acute:chronic load ratio. Null renders the empty track — see below. */
  ratio: number | null
  /** The verdict colour from the single owner (`loadRatioContext`), so the
   *  marker and the words above it can never disagree. */
  color: string
  ariaLabel?: string
  label?: string
}) {
  const bandLeft  = pct(LOAD_RATIO.under)
  const bandWidth = pct(LOAD_RATIO.watch) - bandLeft

  return (
    <div
      role="img"
      aria-label={label ?? (ratio === null ? 'Not enough runs yet to show your load' : `Load ${ratio.toFixed(2)} times your recent normal`)}
      style={{ position: 'relative', height: '10px', marginTop: '10px' }}
    >
      {/* Track */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '3px', height: '4px',
        background: 'var(--bg-soft)', borderRadius: '2px',
      }} />
      {/* The runner's normal */}
      <div style={{
        position: 'absolute', left: `${bandLeft}%`, width: `${bandWidth}%`, top: '3px', height: '4px',
        background: 'var(--moss-soft)', borderRadius: '2px',
      }} />
      {/* This week. Absent rather than guessed when there is no ratio — an
          empty track reads as "nothing measured yet", a marker at 1.0 would
          read as "you are exactly normal", which is a claim we cannot make. */}
      {ratio !== null && (
        <div style={{
          position: 'absolute', left: `calc(${pct(ratio)}% - 1.5px)`, top: 0,
          width: '3px', height: '10px', background: color, borderRadius: '2px',
        }} />
      )}
    </div>
  )
}
