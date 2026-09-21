'use client'

import { useState } from 'react'
import { PhoneShell, type PhoneTab } from '@/components/marketing/PhoneShell'
import { TodayStill } from '@/components/marketing/PhoneFrame'
import { formatDistance, formatDuration } from '@/lib/format'
import { BRAND } from '@/lib/brand'

/**
 * DESIGN-V3 — one phone, three screens, switched by the bottom nav.
 *
 * ⚠️ NO SEGMENTED CONTROL. The handoff draws a three-up segmented row above
 * the frame and says in as many words that it is "a prototype affordance for
 * reviewing all three screens in one frame — in the real app, tab switching
 * is the bottom nav. Don't ship the segmented row." So the nav does it, which
 * also means the marketing mockup demonstrates the real navigation instead of
 * a control that does not exist in the product.
 *
 * ⚠️ TODAY IS IMPORTED, NOT REDRAWN. `TodayStill` is the same screen the hero
 * renders. Drawing a second Today for the tabbed version is how the two would
 * drift, which is precisely the defect `realComponents.test.ts` exists for.
 *
 * ⚠️ EVERY DISTANCE AND DURATION GOES THROUGH lib/format (ADR-015). The
 * handoff writes "8 km" and "2 h 05"; the product renders "8km" and "2h 05".
 * A mockup that spells them differently from the app is the exact drift that
 * was caught on 2026-09-11 by putting a real component next to a drawn one.
 */

const EASY = 'var(--s-easy)'
const QUALITY = 'var(--s-quality)'
const LONG = 'var(--s-long)'

function ScreenHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ padding: '14px 16px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontSize: 'var(--fs-micro)', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--mute)',
      }}>{eyebrow}</span>
      <span style={{
        fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)',
      }}>{title}</span>
    </div>
  )
}

function CoachBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      margin: '0 16px', background: 'var(--warn-bg)', borderRadius: 'var(--radius-md)',
      padding: '12px 14px', display: 'flex', gap: 10,
    }}>
      <span aria-hidden="true" style={{ width: 3, borderRadius: 2, background: 'var(--warn-strong)', flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{
          fontSize: 'var(--fs-micro)', fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: 'var(--warn-strong)',
        }}>{BRAND.coachName} · your coach</span>
        <span style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5, color: 'var(--coach-ink)' }}>{children}</span>
      </div>
    </div>
  )
}

const WEEK = [
  { d: 'M', n: 15, state: 'done' }, { d: 'T', n: 16, state: 'today' },
  { d: 'W', n: 17, state: 'rest' }, { d: 'T', n: 18, state: 'session' },
  { d: 'F', n: 19, state: 'rest' }, { d: 'S', n: 20, state: 'future' },
  { d: 'S', n: 21, state: 'future' },
] as const

const SESSIONS = [
  { day: 'Tue', label: 'Easy run', accent: EASY, km: 8, mins: 55, note: 'Zone 2 · under 145 bpm', current: true },
  { day: 'Thu', label: 'Threshold · 3 × 8 min', accent: QUALITY, km: null, mins: 50, note: 'Zone 3 · the one hard day', current: false },
  { day: 'Sat', label: 'Easy run', accent: EASY, km: 6, mins: 40, note: 'Zone 2 · keep it dull', current: false },
  { day: 'Sun', label: 'Long run', accent: LONG, km: 18, mins: 125, note: 'Zone 2 · time on feet', current: false },
]

function PlanStill() {
  return (
    <>
      <ScreenHeader eyebrow="Week 6 of 16 · Base" title="This week" />

      {/* Week strip */}
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 14px' }}>
        {WEEK.map(d => {
          const today = d.state === 'today'
          const dot = d.state === 'done' ? 'var(--moss-strong)'
            : d.state === 'session' ? QUALITY
            : d.state === 'today' ? 'var(--card)' : 'transparent'
          return (
            <div key={d.n} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              padding: '7px 0', borderRadius: 'var(--radius-sm)',
              background: today ? 'var(--moss-strong)' : 'transparent',
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: today ? 'var(--card)' : 'var(--mute)' }}>{d.d}</span>
              <span style={{
                fontSize: 'var(--fs-caption)', fontWeight: today ? 700 : 500,
                color: today ? 'var(--card)' : 'var(--ink-2)', fontVariantNumeric: 'tabular-nums',
              }}>{d.n}</span>
              <span style={{ width: 4, height: 4, borderRadius: 2, background: dot }} />
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px' }}>
        {SESSIONS.map(s => (
          <div key={s.day} style={{
            background: 'var(--card)', borderRadius: 'var(--radius-md)',
            borderLeft: `3px solid ${s.accent}`, padding: '13px 14px',
            boxShadow: s.current ? 'var(--shadow-card)' : 'none',
            border: s.current ? undefined : '1px solid var(--line)',
            borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: s.accent,
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <span style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 600, color: 'var(--ink)' }}>
                {s.km != null ? `${s.label} · ${formatDistance(s.km)}` : s.label}
              </span>
              <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--mute)' }}>{s.day} · {s.note}</span>
            </div>
            <span style={{
              fontSize: 'var(--fs-caption)', color: 'var(--mute)',
              fontVariantNumeric: 'tabular-nums', flexShrink: 0,
            }}>{formatDuration(s.mins)}</span>
          </div>
        ))}
      </div>

      {/* Week summary */}
      <div style={{
        margin: '14px 16px 0', background: 'var(--bg-soft)', borderRadius: 'var(--radius-md)',
        padding: '14px', display: 'flex', justifyContent: 'space-between',
      }}>
        {[['4', 'sessions'], [formatDistance(38) ?? '', 'this week'], ['3', 'rest days']].map(([v, l]) => (
          <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{
              fontSize: 'var(--fs-lead-lg)', fontWeight: 800, color: 'var(--ink)',
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
            }}>{v}</span>
            <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{l}</span>
          </div>
        ))}
      </div>
    </>
  )
}

/** §1 counts SESSIONS, and the target it states is 80%. These are the zone
 *  shares of a real-looking week, not a claim about any runner. */
const ZONES = [
  { z: 'Z1', pct: 9,  colour: 'var(--s-recov)' },
  { z: 'Z2', pct: 71, colour: EASY },
  { z: 'Z3', pct: 14, colour: QUALITY },
  { z: 'Z4', pct: 6,  colour: 'var(--s-race)' },
]

function CoachStill() {
  return (
    <>
      <ScreenHeader eyebrow="15–21 September" title="This week in zones" />

      <div style={{
        margin: '0 16px 14px', background: 'var(--card)', borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-card)', padding: '18px 16px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{
            fontSize: 56, fontWeight: 800, lineHeight: 0.9, letterSpacing: '-0.04em',
            color: 'var(--ink)', fontVariantNumeric: 'tabular-nums',
          }}>71%</span>
          <span style={{ fontSize: 'var(--fs-body-lg)', color: 'var(--ink-2)' }}>in Zone 2</span>
        </div>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--mute)' }}>Target is 80%. Last week: 62%.</span>

        <div style={{ height: 1, background: 'var(--line)' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ZONES.map(z => (
            <div key={z.z} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--mute)', width: 20, flexShrink: 0 }}>{z.z}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--bg-soft)', overflow: 'hidden' }}>
                <div style={{ width: `${z.pct}%`, height: '100%', borderRadius: 4, background: z.colour }} />
              </div>
              <span style={{
                fontSize: 'var(--fs-caption)', color: 'var(--ink-2)',
                fontVariantNumeric: 'tabular-nums', width: 32, textAlign: 'right', flexShrink: 0,
              }}>{z.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      <CoachBlock>Closer. The easy days are still creeping up at the end.</CoachBlock>
    </>
  )
}

export function TabbedPhone({ initial = 'Today' }: { initial?: PhoneTab }) {
  const [tab, setTab] = useState<PhoneTab>(initial)
  return (
    <PhoneShell
      activeTab={tab}
      // `Me` is in the nav because the product has four tabs and a mockup that
      // hides one is a mockup of a different app. It has no screen here, so
      // selecting it would show Today under a "Me" nav, which is worse than
      // not responding. It stays visible and inert.
      onTab={t => { if (t !== 'Me') setTab(t) }}
    >
      {tab === 'Plan' ? <PlanStill /> : tab === 'Coach' ? <CoachStill /> : <TodayStill />}
    </PhoneShell>
  )
}
