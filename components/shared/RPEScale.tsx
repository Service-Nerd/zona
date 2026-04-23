// RPEScale — Zona Phase 2 shared component
// 10-square filling RPE selector. Squares 1..(value-1) filled dark, square (value) moss selected.
// See docs/canonical/ui-patterns.md § RPEScale and docs/alignment/phase-2-decisions.md D-007.

type Props = {
  /** Current RPE value 1–10, or null for unset */
  value: number | null
  onChange: (value: number) => void
  /** Optional hint text shown below the label row */
  hint?: React.ReactNode
}

export default function RPEScale({ value, onChange, hint }: Props) {
  return (
    <div>
      {/* Label row: "Effort (RPE)" flex-between value display */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: hint ? '4px' : '10px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--ink)',
          }}
        >
          Effort (RPE)
        </span>
        {value !== null ? (
          <span style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '18px',
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.5px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {value}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--mute-2)',
              }}
            >
              / 10
            </span>
          </span>
        ) : (
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '13px',
              fontWeight: 400,
              color: 'var(--mute-2)',
            }}
          >
            — / 10
          </span>
        )}
      </div>

      {/* Hint */}
      {hint && (
        <div
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '12px',
            fontWeight: 400,
            color: 'var(--mute)',
            lineHeight: 1.4,
            marginBottom: '10px',
          }}
        >
          {hint}
        </div>
      )}

      {/* 10-square row */}
      <div style={{ display: 'flex', gap: '3px' }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
          const isSelected = value === n
          const isFilled = value !== null && n < value
          const isDefault = !isSelected && !isFilled

          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              style={{
                flex: 1,
                aspectRatio: '1',
                borderRadius: '6px',
                border: isSelected ? '2px solid var(--moss-mid)' : 'none',
                // Selected: moss bg, white text, inset outline effect via box-shadow
                // Filled: ink bg, bg text
                // Default: bg-soft bg, mute text
                background: isSelected
                  ? 'var(--moss)'
                  : isFilled
                  ? 'var(--ink)'
                  : 'var(--bg-soft)',
                color: isSelected
                  ? 'var(--card)'
                  : isFilled
                  ? 'var(--bg)'
                  : 'var(--mute)',
                fontFamily: 'var(--font-ui)',
                fontSize: '12px',
                fontWeight: isSelected ? 700 : isFilled ? 600 : 400,
                cursor: 'pointer',
                transition: 'background 0.1s, color 0.1s',
                // Remove default button styles
                outline: 'none',
                padding: 0,
                lineHeight: 1,
              }}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}
