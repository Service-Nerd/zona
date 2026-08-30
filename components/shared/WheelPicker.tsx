'use client'

// WheelPicker — the canonical scroll-snap wheel column (one value list). An
// iOS-style picker: drag the strip, the value under the centre band is selected.
// Replaces the +/- stepper idiom for time entry; DurationPicker composes three
// of these (hours : minutes : seconds).
//
// Controlled + stateless-ish: the parent owns `value`. Scroll settles → onChange
// with the snapped value; an external value change scrolls the strip to match.
// The loop is broken by only re-scrolling when the strip isn't already there and
// by suppressing the settle handler during a programmatic scroll.
//
// Scroll↔index math is pure in ./WheelPicker.logic (node-tested); only the DOM
// scroll wiring lives here.
//
// ui-patterns.md § Form Fields & Pickers → WheelPicker.

import { useEffect, useRef } from 'react'
import { valueToIndex, nearestIndexForScroll, scrollTopForIndex } from './WheelPicker.logic'

export function WheelPicker({
  values,
  value,
  onChange,
  format,
  rowHeight = 40,
  visibleRows = 5,
  ariaLabel,
}: {
  values: readonly number[]
  value: number
  onChange: (v: number) => void
  /** Render a value as a label, e.g. pad-2 for minutes. Default: String(v). */
  format?: (v: number) => string
  rowHeight?: number
  /** Odd number of rows shown; the middle one is the selection. Default 5. */
  visibleRows?: number
  ariaLabel?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const suppress = useRef(false)          // true while we programmatically scroll
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pad = Math.floor(visibleRows / 2)

  // External value → scroll position (mount + parent-driven changes). Skipped
  // when the strip is already there — i.e. when the change came from our own
  // settle — so the wheel never fights the user's scroll.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = scrollTopForIndex(valueToIndex(values, value), rowHeight)
    if (Math.abs(el.scrollTop - target) < 1) return
    suppress.current = true
    el.scrollTo({ top: target })
    requestAnimationFrame(() => { suppress.current = false })
  }, [value, values, rowHeight])

  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current) }, [])

  function onScroll() {
    if (suppress.current) return
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      const el = scrollRef.current
      if (!el) return
      const idx = nearestIndexForScroll(el.scrollTop, rowHeight, values.length)
      const next = values[idx]
      if (next !== value) onChange(next)
    }, 90)
  }

  const height = rowHeight * visibleRows
  const selIdx = valueToIndex(values, value)

  return (
    <div style={{ position: 'relative', height: `${height}px`, width: '64px' }}>
      {/* Centre selection band — the only affordance; the scroll track is hidden. */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: `${pad * rowHeight}px`, height: `${rowHeight}px`,
        borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
        pointerEvents: 'none',
      }} />
      <div
        ref={scrollRef}
        className="wheel-scroll"
        role="listbox"
        aria-label={ariaLabel}
        onScroll={onScroll}
        style={{
          height: '100%', overflowY: 'scroll',
          scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ height: `${pad * rowHeight}px` }} />
        {values.map((v, i) => {
          const dist = Math.abs(i - selIdx)
          const selected = i === selIdx
          return (
            <div
              key={v}
              role="option"
              aria-selected={selected}
              style={{
                height: `${rowHeight}px`, scrollSnapAlign: 'center',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-ui)', fontVariantNumeric: 'tabular-nums',
                fontSize: selected ? '24px' : '20px',
                fontWeight: selected ? 700 : 400,
                color: selected ? 'var(--ink)' : 'var(--mute)',
                opacity: dist === 0 ? 1 : dist === 1 ? 0.55 : 0.3,
                transition: 'opacity 0.1s, font-size 0.1s, font-weight 0.1s',
              }}
            >
              {format ? format(v) : String(v)}
            </div>
          )
        })}
        <div style={{ height: `${pad * rowHeight}px` }} />
      </div>
    </div>
  )
}
