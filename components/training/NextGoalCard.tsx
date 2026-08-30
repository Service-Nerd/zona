// NextGoalCard — CA-03 post-race "what next" goal ladder.
//
// Renders after a goal race is completed: an achievement line + the engine's
// sequenced next-goal options (chase a time / step up / hold base). Tapping an
// option seeds the plan wizard and navigates to it.
//
// NOT an AI surface — the options are deterministic (lib/coaching/goalSequencing.ts),
// so this card carries NO AIMark and NO CoachByline (provenance honesty,
// ui-patterns.md § AIMark). The accent rail is --s-race (the race session
// colour), deliberately distinct from the moss AI rail.
//
// Deliberately NOT the shared CardSelect primitive: these are an action/nav
// ladder, not a single-select radio — tapping navigates into the wizard, there
// is no persistent selected state, and each row is race-themed (--s-race rail +
// inline --s-race target time + trailing → arrow), the opposite of CardSelect's
// moss "selected" language. Folding it in would need a nav-arrow + coloured-value
// slot used by no other consumer. See ui-patterns.md § Form Fields & Pickers.

'use client'

import type { NextGoalOption } from '@/lib/coaching/goalSequencing'

interface Props {
  /** Voice line: finish vs goal, e.g. "You ran 2:04:00 — 6:00 inside your goal." */
  achievement: string
  options:     NextGoalOption[]
  onPick:      (option: NextGoalOption) => void
  onDismiss:   () => void
}

export default function NextGoalCard({ achievement, options, onPick, onDismiss }: Props) {
  return (
    <div style={{ position: 'relative', background: 'var(--card)', borderRadius: '16px', padding: '16px 16px 16px 22px' }}>
      {/* --s-race rail — race-themed, NOT the moss AI rail */}
      <span style={{ position: 'absolute', left: '8px', top: '16px', bottom: '16px', width: '3px', borderRadius: '2px', background: 'var(--s-race)' }} aria-hidden />

      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
        What&apos;s next
      </div>

      {/* Achievement line — one sentence, one number, never a celebration */}
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35, marginBottom: '14px' }}>
        {achievement}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        {options.map(opt => (
          <button
            key={opt.kind}
            onClick={() => onPick(opt)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
              width: '100%', textAlign: 'left',
              background: 'var(--bg-soft)', border: '0.5px solid var(--line)', borderRadius: '12px',
              padding: '12px 14px', cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                  {opt.label}
                </span>
                {opt.targetTime && (
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--s-race)' }}>
                    {opt.targetTime}
                  </span>
                )}
              </span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--ink-2)', lineHeight: 1.45 }}>
                {opt.blurb}
              </span>
            </span>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', color: 'var(--mute)', flexShrink: 0 }} aria-hidden>→</span>
          </button>
        ))}
      </div>

      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', cursor: 'pointer', padding: '4px 0', width: '100%' }}
      >
        Not yet
      </button>
    </div>
  )
}
