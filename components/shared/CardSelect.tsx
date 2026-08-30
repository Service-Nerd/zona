'use client'

// CardSelect — the canonical single-choice radio card. A large tappable card
// with a label, optional sub-line, and a moss active state. Two layouts:
//   • 'row'  — full-width, sub stacked under the label (goal, terrain,
//              hard-session relationship). The old wizard-local OptionCard.
//   • 'tile' — grid cell, vertical, optional lock badge top-right (race
//              distance). The old bespoke distance tiles.
//
// Stateless: the caller owns selection and maps options into its own grid/stack
// container (same idiom as <Chip>). `locked` is VISUAL only — the caller decides
// what a tap does when locked (e.g. distance taps route to upgrade), so the
// primitive never swallows the handler.
//
// For a compact select from a set (injuries, benchmark type) use <Chip>. For a
// control that also carries validation state (blocked / warn), keep it bespoke —
// CardSelect deliberately stays a plain radio card.
//
// ui-patterns.md § Form Fields & Pickers → CardSelect.

export function CardSelect({
  label,
  sub,
  active,
  onClick,
  layout = 'row',
  locked,
  lockLabel,
  ariaLabel,
}: {
  label: string
  sub?: string
  active: boolean
  onClick: () => void
  /** 'row' (default) = full-width stacked; 'tile' = grid cell. */
  layout?: 'row' | 'tile'
  /** Visual-only: dims the card + shows lockLabel. Tap behaviour is the caller's. */
  locked?: boolean
  lockLabel?: string
  ariaLabel?: string
}) {
  const common = {
    borderRadius: 'var(--radius-lg)',
    border: `1.5px solid ${active ? 'var(--moss)' : 'var(--line)'}`,
    background: active ? 'var(--moss-soft)' : 'var(--card)',
    cursor: locked ? 'default' : 'pointer',
    transition: 'all 0.15s',
    opacity: locked ? (layout === 'tile' ? 0.55 : 0.5) : 1,
    textAlign: 'left' as const,
  }

  if (layout === 'tile') {
    return (
      <button
        onClick={onClick}
        aria-pressed={active}
        aria-label={ariaLabel}
        style={{
          ...common,
          width: '100%', padding: '18px 16px', minHeight: '72px',
          display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative',
        }}
      >
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: active ? 700 : 500, color: active ? 'var(--moss)' : 'var(--ink)' }}>{label}</span>
        {sub && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)' }}>{sub}</span>}
        {locked && lockLabel && (
          <span style={{ position: 'absolute', top: '8px', right: '10px', fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 700, color: 'var(--moss)', letterSpacing: '0.08em' }}>
            {lockLabel}
          </span>
        )}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      style={{
        ...common,
        width: '100%', padding: '18px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}
    >
      <div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: active ? 700 : 500, color: active ? 'var(--moss)' : 'var(--ink)', marginBottom: sub ? '4px' : 0 }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.45 }}>
            {sub}
          </div>
        )}
      </div>
      {lockLabel && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 700, color: 'var(--moss)', letterSpacing: '0.08em', marginTop: '2px', flexShrink: 0 }}>{lockLabel}</span>}
    </button>
  )
}
