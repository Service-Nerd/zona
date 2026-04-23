// PendingAdjustmentBanner — Zona Phase 2 shared component
// Hero-level feature — this is the proof point for "the plan adapts to your life."
// Visual: warm amber banner, "!" icon, action row with confirm + revert.
// API calls live in the parent. This component is pure UI.
// See docs/canonical/ui-patterns.md § PendingAdjustmentBanner.

type Props = {
  /** Banner heading — default "Plan adjusted" */
  title?: string
  /** Description of what changed */
  children: React.ReactNode
  /** Called when user taps Confirm */
  onConfirm: () => void
  /** Called when user taps Revert */
  onRevert: () => void
  /** Disable both actions while an API call is in flight */
  loading?: boolean
}

export default function PendingAdjustmentBanner({
  title = 'Plan adjusted',
  children,
  onConfirm,
  onRevert,
  loading = false,
}: Props) {
  return (
    <div
      style={{
        background: 'var(--warn-bg)',
        borderRadius: '14px',
        padding: '14px 16px',
      }}
    >
      {/* Eyebrow row: icon + label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        {/* "!" icon circle */}
        <div
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: 'var(--warn)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '11px',
              fontWeight: 800,
              color: 'var(--card)',
              lineHeight: 1,
            }}
          >
            !
          </span>
        </div>

        {/* Eyebrow label */}
        <span
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--warn)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </span>
      </div>

      {/* Body */}
      <div
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '13px',
          fontWeight: 400,
          lineHeight: 1.55,
          color: 'var(--coach-ink)',
          marginBottom: '14px',
        }}
      >
        {children}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {/* Primary — Confirm */}
        <button
          onClick={onConfirm}
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px 0',
            background: loading ? 'var(--warn-bg)' : 'var(--warn)',
            border: 'none',
            borderRadius: '100px',
            fontFamily: 'var(--font-ui)',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--card)',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {loading ? '…' : 'Confirm'}
        </button>

        {/* Ghost — Revert */}
        <button
          onClick={onRevert}
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px 0',
            background: 'transparent',
            border: '1px solid rgba(61,38,0,0.2)',
            borderRadius: '100px',
            fontFamily: 'var(--font-ui)',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--coach-ink)',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          Revert
        </button>
      </div>
    </div>
  )
}
