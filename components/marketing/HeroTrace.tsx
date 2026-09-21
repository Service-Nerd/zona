'use client'

import { useEffect, useState } from 'react'
import { HrTrace } from '@/components/marketing/HrTrace'
import { HERO_TRACE, LOOP_SECONDS, DRAW_DELAY_MS, type TracePhase } from '@/lib/marketing/heroTrace'

/**
 * DESIGN-V3 — the hero's evidence card. The homepage's proof, above the fold.
 *
 * ⚠️ THE PARENT OWNS `phase`, NOT THE TRACE. The verdict number, Kit's
 * sentence and the curve are three views of one state, and the handoff is
 * explicit that letting the trace own it desynchronises them.
 *
 * ⚠️ BOTH STATES ARE ALWAYS RENDERED, STACKED IN ONE GRID CELL. They
 * cross-fade on opacity rather than swapping text, so the card is sized to
 * the taller state and nothing below it moves when the loop ticks. Swapping
 * nodes would reflow the page every 7 seconds, which is a worse sin than the
 * animation itself. This is also why there is no layout shift to reserve
 * height against: the box cannot change size.
 *
 * ⚠️ REDUCED MOTION IS A DIFFERENT COMPONENT, EFFECTIVELY. `drawn` is set
 * immediately, the interval never starts, and the card stays in state A — the
 * amber breach — because that is the state that carries the product's point.
 * A reader who cannot have motion still gets the argument; they just get it
 * as a still. The CSS half is handled by the motion tokens collapsing to 0s
 * in globals.css, so the transitions are inert even mid-flight.
 */
export function HeroTrace({ compact = false }: { compact?: boolean }) {
  const [phase, setPhase] = useState<TracePhase>(0)
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setDrawn(true); return }

    const t = setTimeout(() => setDrawn(true), DRAW_DELAY_MS)
    const i = setInterval(() => setPhase(p => (p === 0 ? 1 : 0)), LOOP_SECONDS * 1000)
    return () => { clearTimeout(t); clearInterval(i) }
  }, [])

  const keen = phase === 0
  const fade = (on: boolean) => ({
    gridArea: '1 / 1',
    opacity: on ? 1 : 0,
    transition: 'opacity var(--motion-verdict)',
  } as const)

  return (
    <div style={{
      background: 'var(--surface-moss-wash)',
      borderRadius: 'var(--radius-xl)',
      padding: compact ? 12 : 'clamp(16px, 2.5vw, 36px)',
    }}>
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        padding: compact ? 18 : 'clamp(18px, 2.2vw, 28px)',
        display: 'flex', flexDirection: 'column', gap: compact ? 16 : 20,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'baseline', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{
            fontSize: 'var(--fs-micro)', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--mute)',
          }}>{HERO_TRACE.eyebrow}</span>
          <span style={{
            fontSize: compact ? 'var(--fs-caption)' : 'var(--fs-sm)',
            color: 'var(--mute)', fontVariantNumeric: 'tabular-nums',
          }}>
            <span className="hero-meta-long">{HERO_TRACE.meta}</span>
            <span className="hero-meta-short">{HERO_TRACE.metaShort}</span>
          </span>
        </div>

        {/* Verdict */}
        <div style={{ display: 'grid' }}>
          {HERO_TRACE.states.map((s, i) => (
            <div key={s.value} style={{
              ...fade(keen ? i === 0 : i === 1),
              display: 'flex', alignItems: 'baseline', gap: compact ? 10 : 12,
            }}>
              <span style={{
                fontSize: 'var(--fs-verdict)', fontWeight: 800, letterSpacing: '-0.04em',
                lineHeight: 0.9, fontVariantNumeric: 'tabular-nums',
                color: s.tone === 'warn' ? 'var(--warn-strong)' : 'var(--moss-strong)',
              }}>{s.value}</span>
              <span style={{
                fontSize: compact ? 'var(--fs-sm)' : 'var(--fs-body-lg)',
                color: 'var(--ink-2)', lineHeight: 1.35, maxWidth: compact ? '8em' : undefined,
              }}>{HERO_TRACE.label}</span>
            </div>
          ))}
        </div>

        <HrTrace phase={phase} drawn={drawn} ticks idSuffix={compact ? '-hero-c' : '-hero'} />

        <div style={{ height: 1, background: 'var(--line)' }} />

        {/* Kit */}
        <div style={{ display: 'grid' }}>
          {HERO_TRACE.states.map((s, i) => (
            <div key={s.value} style={{ ...fade(keen ? i === 0 : i === 1), display: 'flex', gap: compact ? 10 : 12 }}>
              <span aria-hidden="true" style={{
                width: 3, borderRadius: 2, flexShrink: 0,
                background: s.tone === 'warn' ? 'var(--warn-strong)' : 'var(--moss-strong)',
              }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{
                  fontSize: 'var(--fs-micro)', fontWeight: 700, letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: s.tone === 'warn' ? 'var(--warn-strong)' : 'var(--moss-strong)',
                }}>{HERO_TRACE.coachEyebrow}</span>
                <span style={{
                  fontSize: compact ? 'var(--fs-body)' : 'var(--fs-body-lg)', lineHeight: 1.55,
                  color: s.tone === 'warn' ? 'var(--coach-ink)' : 'var(--ink-2)',
                }}>{s.sentence}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
