// CoachNoteBlock — Zona Phase 2 shared component
// Renders the coach voice card in amber-warm style.
// See docs/canonical/ui-patterns.md § CoachNoteBlock and docs/alignment/phase-2-decisions.md D-001.

type Props = {
  /** Eyebrow label — default "COACH" */
  label?: string
  /** Optional timestamp shown in eyebrow row — e.g. "6:12am" */
  timestamp?: string
  /** Letter shown in avatar circle — default "Z" */
  initial?: string
  /** The coaching copy. One sentence per brand voice rules. */
  children: React.ReactNode
  /**
   * 'why'  = "Why this session" variant for Session Detail.
   *          Slightly smaller body, no avatar circle — label is the visual anchor.
   */
  variant?: 'default' | 'why'
}

export default function CoachNoteBlock({
  label = 'COACH',
  timestamp,
  initial = 'Z',
  children,
  variant = 'default',
}: Props) {
  const isWhy = variant === 'why'

  return (
    <div
      style={{
        background: 'var(--warn-bg)',
        borderRadius: '14px',
        padding: isWhy ? '14px 16px' : '16px 18px',
      }}
    >
      {/* Top row: avatar + eyebrow */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '10px',
        }}
      >
        {/* Avatar circle — hidden in 'why' variant */}
        {!isWhy && (
          <div
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: 'var(--ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '10px',
                fontWeight: 800,
                color: 'var(--bg)',
                letterSpacing: '0.02em',
                lineHeight: 1,
              }}
            >
              {initial}
            </span>
          </div>
        )}

        {/* Eyebrow: "COACH · 6:12am" */}
        <span
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--warn)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            lineHeight: 1,
          }}
        >
          {label}
          {timestamp && (
            <span style={{ fontWeight: 400, opacity: 0.65 }}>
              {' '}·{' '}{timestamp}
            </span>
          )}
        </span>
      </div>

      {/* Body copy — warm dark brown on warm amber background */}
      <div
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: isWhy ? '13px' : '14px',
          fontWeight: 400,
          lineHeight: 1.55,
          color: 'var(--coach-ink)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
