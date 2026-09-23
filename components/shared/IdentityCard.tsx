'use client'

// IdentityCard — the top card on the Me screen: who is signed in, and on what.
//
// ui-patterns.md §20 (Action List Card) governs its MISSING-NAME state. With a
// name it is a plain card. Without one it becomes a single tappable row with a
// chevron, because the old behaviour was a grey "Your name" label: a dead
// string that looked like a value the app already held, with nothing to tap.
// A prompt you cannot act on is the §8 Empty State mistake in miniature.
//
// Tapping focuses the real field further down the same screen (see
// focusProfileNameField) — no modal, no extra screen for one input.

import type React from 'react'
import { BRAND } from '@/lib/brand'

function Chevron() {
  return (
    <span style={{ color: 'var(--mute)', display: 'inline-flex', marginLeft: 'var(--space-3)' }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export function IdentityCard({ initials, firstName, lastName, tierLabel, onAddName }: {
  /** Already resolved by the caller — see the fallback chain in DashboardClient. */
  initials: string
  firstName: string
  lastName: string
  /** Trial / Pro / Free. */
  tierLabel: string
  onAddName: () => void
}) {
  const displayName = [firstName, lastName].filter(Boolean).join(' ')

  const cardStyle: React.CSSProperties = {
    background: 'var(--card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
    padding: '16px', border: '1px solid var(--line)',
    display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
  }

  const inner = (
    <>
      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--moss)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-brand)', fontSize: '16px', fontWeight: 600, color: 'var(--card)', flexShrink: 0 }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: '17px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName || 'Add your name'}
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName ? tierLabel : `${tierLabel} · ${BRAND.coachName} will use it.`}
        </div>
      </div>
      {!displayName && <Chevron />}
    </>
  )

  if (displayName) return <div style={cardStyle}>{inner}</div>

  // The whole card is the tap target: 80px tall, well clear of the 44pt floor.
  return (
    <button
      onClick={onAddName}
      aria-label="Add your name"
      style={{ ...cardStyle, width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'var(--ink)' }}
    >
      {inner}
    </button>
  )
}
