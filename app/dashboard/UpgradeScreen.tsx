'use client'

// Upgrade screen — shown when a user hits a PAID gate post-trial.
// Pattern: upgrade screen (see frontend-design skill for anatomy rules).
// Single job: show what paid access includes, offer subscription.

import { useState } from 'react'

const FEATURES = [
  { name: 'AI training plans',   detail: 'Built around your race, not a template.' },
  { name: 'Strava sync',         detail: 'Your actual paces. Not guesses.' },
  { name: 'AI coaching',         detail: 'Session feedback that knows your plan.' },
  { name: 'Dynamic reshaping',   detail: 'Miss a week. The plan adapts.' },
]

export default function UpgradeScreen({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe(annual: boolean) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annual }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Something went wrong. Try again.')
      }
    } catch {
      setError('Could not reach the server. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      minHeight: '100%',
      background: 'var(--bg)',
    }}>
      {/* Back */}
      <div style={{ padding: '16px 20px 0' }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: '4px 0',
            fontFamily: 'var(--font-ui)', fontSize: '15px',
            display: 'flex', alignItems: 'center', gap: '4px',
          }}
          aria-label="Back"
        >
          ← Back
        </button>
      </div>

      <div style={{ flex: 1, padding: '28px 20px 32px', display: 'flex', flexDirection: 'column' }}>
        {/* Headline */}
        <h1 style={{
          fontFamily: 'var(--font-brand)',
          fontWeight: 700, fontSize: '1.75rem',
          color: 'var(--text-primary)', margin: 0,
          lineHeight: 1.15,
        }}>
          Your trial's done.
        </h1>
        <p style={{
          fontFamily: 'var(--font-ui)',
          fontWeight: 400, fontSize: '0.9375rem',
          color: 'var(--text-muted)', margin: '8px 0 0',
        }}>
          Time to make it official.
        </p>

        <div style={{ height: '1px', background: 'var(--border-col)', margin: '24px 0' }} />

        {/* Feature list — left accent, session card visual language */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {FEATURES.map((f) => (
            <div
              key={f.name}
              style={{
                display: 'flex', alignItems: 'flex-start',
                background: 'var(--card-bg)',
                border: '1px solid var(--border-col)',
                borderLeft: '3px solid var(--teal)',
                borderRadius: '10px',
                padding: '13px 16px',
              }}
            >
              <div>
                <div style={{
                  fontFamily: 'var(--font-ui)', fontWeight: 600,
                  fontSize: '0.9375rem', color: 'var(--text-primary)',
                }}>{f.name}</div>
                <div style={{
                  fontFamily: 'var(--font-ui)', fontWeight: 400,
                  fontSize: '0.8125rem', color: 'var(--text-muted)',
                  marginTop: '2px',
                }}>{f.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ height: '1px', background: 'var(--border-col)', margin: '24px 0' }} />

        {/* Pricing — metric pair pattern */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => handleSubscribe(false)}
            disabled={loading}
            style={{
              flex: 1, textAlign: 'center',
              background: 'var(--card-bg)',
              border: '1px solid var(--border-col)',
              borderRadius: '10px', padding: '16px 12px',
              cursor: loading ? 'default' : 'pointer',
            }}
          >
            <div style={{
              fontFamily: 'var(--font-ui)', fontWeight: 700,
              fontSize: '1.5rem', color: 'var(--text-primary)',
            }}>£7.99</div>
            <div style={{
              fontFamily: 'var(--font-ui)', fontWeight: 400,
              fontSize: '0.75rem', color: 'var(--text-muted)',
              marginTop: '4px',
            }}>per month</div>
          </button>

          <button
            onClick={() => handleSubscribe(true)}
            disabled={loading}
            style={{
              flex: 1, textAlign: 'center',
              background: 'var(--card-bg)',
              border: '2px solid var(--teal)',
              borderRadius: '10px', padding: '16px 12px',
              cursor: loading ? 'default' : 'pointer',
              position: 'relative',
            }}
          >
            <div style={{
              position: 'absolute', top: '-11px', left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--teal)',
              borderRadius: '4px', padding: '2px 8px',
              fontFamily: 'var(--font-ui)', fontWeight: 600,
              fontSize: '0.625rem', letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--zona-navy)',
              whiteSpace: 'nowrap',
            }}>BEST VALUE</div>
            <div style={{
              fontFamily: 'var(--font-ui)', fontWeight: 700,
              fontSize: '1.5rem', color: 'var(--text-primary)',
            }}>£59.99</div>
            <div style={{
              fontFamily: 'var(--font-ui)', fontWeight: 400,
              fontSize: '0.75rem', color: 'var(--text-muted)',
              marginTop: '4px',
            }}>per year · £5/mo</div>
          </button>
        </div>

        {/* Legal */}
        <p style={{
          fontFamily: 'var(--font-ui)', fontWeight: 400,
          fontSize: '0.6875rem', color: 'var(--text-muted)',
          margin: '14px 0 0', textAlign: 'center', lineHeight: 1.5,
        }}>
          Auto-renews. Cancel any time.{' '}
          14-day free trial included on first subscription.
        </p>

        {/* Error state */}
        {error && (
          <p style={{
            fontFamily: 'var(--font-ui)', fontSize: '0.875rem',
            color: 'var(--amber)', margin: '12px 0 0', textAlign: 'center',
          }}>{error}</p>
        )}

        {/* Primary CTA */}
        <button
          onClick={() => handleSubscribe(true)}
          disabled={loading}
          style={{
            marginTop: '20px', width: '100%', padding: '16px',
            background: loading ? 'var(--border-col)' : 'var(--teal)',
            border: 'none', borderRadius: '10px',
            fontFamily: 'var(--font-ui)', fontWeight: 600,
            fontSize: '1rem', color: 'var(--zona-navy)',
            cursor: loading ? 'default' : 'pointer',
            letterSpacing: '0.02em',
            transition: 'opacity 0.15s',
          }}
        >
          {loading ? 'Loading…' : 'Get Zona Premium'}
        </button>

        {/* Free path — always visible */}
        <button
          onClick={onBack}
          style={{
            marginTop: '16px',
            background: 'none', border: 'none',
            fontFamily: 'var(--font-ui)', fontWeight: 400,
            fontSize: '0.875rem', color: 'var(--text-muted)',
            cursor: 'pointer', textDecoration: 'underline',
            padding: '4px 0',
          }}
        >
          Continue with free plan →
        </button>
      </div>
    </div>
  )
}
