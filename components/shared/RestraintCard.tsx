// RestraintCard — Zona Phase 2 shared component
// The brand's counter-intuitive moment: showing restraint as progress.
// "78% of your runs stayed in Zone 2. That's why you're getting faster."
// See docs/canonical/ui-patterns.md § RestraintCard and docs/alignment/phase-2-decisions.md D-005.

type Props = {
  /** Section label — default "How this week went" */
  label?: string
  /** Zone discipline percent 0–100 */
  percent: number
  /** Meta shown top-right — e.g. "3 / 5 sessions" or "32 / 44km" */
  meta?: string
  /**
   * Explanation line. Text after the big number.
   * Supports <strong> for emphasis: "--ink 600" rendering.
   * Example: <>of your runs were <strong>Zone 2 sessions</strong>. That's the work.</>
   */
  body: React.ReactNode
}

export default function RestraintCard({ label = 'How this week went', percent, meta, body }: Props) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: `1px solid var(--line)`,
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
      }}
    >
      {/* Top row: label + meta */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--mute)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        {meta && (
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '10px',
              fontWeight: 400,
              color: 'var(--mute-2)',
              letterSpacing: '0.02em',
            }}
          >
            {meta}
          </span>
        )}
      </div>

      {/* Big number */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '2px',
          marginBottom: '10px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '44px',
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-1.5px',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {percent}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '22px',
            fontWeight: 600,
            color: 'var(--moss)',
            lineHeight: 1,
            letterSpacing: '-0.5px',
          }}
        >
          %
        </span>
      </div>

      {/* Body copy */}
      <div
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '13px',
          fontWeight: 400,
          color: 'var(--ink-2)',
          lineHeight: 1.45,
        }}
      >
        {body}
      </div>
    </div>
  )
}
