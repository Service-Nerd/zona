// RestraintCard — Zonna shared component
// The brand's counter-intuitive moment: showing restraint as progress.
//
// TIER-DIVERGENT — FREE:                locked card, "—%", upgrade CTA.
//                  PAID/TRIAL pre-data: pending card, "—%", calm copy.
//                  PAID/TRIAL with data: live card, score + verdict body.
//
// See docs/canonical/ui-patterns.md § RestraintCard (Pattern 11) and
// docs/alignment/phase-2-decisions.md D-005.

type LiveProps = {
  state?: 'live'
  /** Section label — default "Zone discipline" */
  label?: string
  /** Zone discipline percent 0–100 */
  percent: number
  /** Meta shown top-right — e.g. "across 3 runs" */
  meta?: string
  /**
   * Explanation line. Text after the big number.
   * Supports <strong> for emphasis: "--ink 600" rendering.
   */
  body: React.ReactNode
}

type PendingProps = {
  /** Trial/paid users who don't yet have analysed-run data. */
  state: 'pending'
  label?: string
}

type LockedProps = {
  /** Free users — score requires Strava analysis (paid). */
  state: 'locked'
  label?: string
  /** Tap target for the moss "Unlock score →" link. */
  onUpgrade?: () => void
}

type Props = LiveProps | PendingProps | LockedProps

/** Loading-state shell for RestraintCard.
 *  Same dimensions as the real card so the Today-screen layout doesn't
 *  reflow when run_analysis data finishes loading. Used only during the
 *  brief window when paid users have completed runs but the analysis
 *  payload hasn't returned yet. */
export function RestraintCardSkeleton({ label = 'Zone discipline' }: { label?: string }) {
  return (
    <div
      aria-busy="true"
      style={{
        background: 'var(--card)',
        border: `1px solid var(--line)`,
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
      }}
    >
      <div style={{ marginBottom: '16px' }}>
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
          color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>{label}</span>
      </div>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: '10px',
      }}>
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: '44px', fontWeight: 800,
          color: 'var(--mute)', letterSpacing: '-1.5px', lineHeight: 1,
          fontVariantNumeric: 'tabular-nums', opacity: 0.4,
        }}>—</span>
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: '22px', fontWeight: 600,
          color: 'var(--mute)', lineHeight: 1, opacity: 0.4,
        }}>%</span>
      </div>
      <div style={{
        height: '17px',
        width: '70%',
        borderRadius: '4px',
        background: 'var(--bg-soft)',
        opacity: 0.6,
      }} />
    </div>
  )
}

// Eyebrow row — shared anatomy across all three states.
function Eyebrow({ label, meta }: { label: string; meta?: string }) {
  return (
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
  )
}

export default function RestraintCard(props: Props) {
  const label = props.label ?? 'Zone discipline'

  // ── LOCKED — free user, score gated behind Strava + upgrade ─────────
  if (props.state === 'locked') {
    return (
      <div
        style={{
          background: 'var(--bg-soft)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
        }}
      >
        <Eyebrow label={label} />
        {/* Muted "—%" placeholder — preserves card shape, signals "score lives here" */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: '12px',
        }}>
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: '44px', fontWeight: 800,
            color: 'var(--mute)', letterSpacing: '-1.5px', lineHeight: 1,
            fontVariantNumeric: 'tabular-nums', opacity: 0.4,
          }}>—</span>
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: '22px', fontWeight: 600,
            color: 'var(--mute)', lineHeight: 1, opacity: 0.4,
          }}>%</span>
        </div>
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400,
          color: 'var(--mute)', lineHeight: 1.55, marginBottom: '14px',
        }}>
          The score that names the medium-hard middle. Upgrade to unlock it.
        </div>
        {props.onUpgrade && (
          <button
            onClick={props.onUpgrade}
            style={{
              fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600,
              color: 'var(--moss)', background: 'none', border: 'none',
              padding: 0, cursor: 'pointer',
            }}
          >
            Unlock score →
          </button>
        )}
      </div>
    )
  }

  // ── PENDING — trial/paid user, no analysed runs yet ─────────────────
  if (props.state === 'pending') {
    return (
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
        }}
      >
        <Eyebrow label={label} />
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: '12px',
        }}>
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: '44px', fontWeight: 800,
            color: 'var(--mute)', letterSpacing: '-1.5px', lineHeight: 1,
            fontVariantNumeric: 'tabular-nums', opacity: 0.5,
          }}>—</span>
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: '22px', fontWeight: 600,
            color: 'var(--mute)', lineHeight: 1, opacity: 0.5,
          }}>%</span>
        </div>
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400,
          color: 'var(--ink-2)', lineHeight: 1.45,
        }}>
          Your first score lands after a couple of analysed runs. Kit&rsquo;s watching.
        </div>
      </div>
    )
  }

  // ── LIVE — trial/paid user with ≥1 analysed run ─────────────────────
  return (
    <div
      style={{
        background: 'var(--card)',
        border: `1px solid var(--line)`,
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
      }}
    >
      <Eyebrow label={label} meta={props.meta} />
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
          {props.percent}
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
      <div
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '13px',
          fontWeight: 400,
          color: 'var(--ink-2)',
          lineHeight: 1.45,
        }}
      >
        {props.body}
      </div>
    </div>
  )
}
