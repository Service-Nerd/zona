'use client'

// Upgrade screen — shown when a user hits a PAID gate post-trial.
// Pattern: upgrade screen (see frontend-design skill for anatomy rules).
// Single job: show what paid access includes, offer subscription.
//
// Two variants:
//   trialExpired=false — gain framing (fresh gate during/before trial)
//   trialExpired=true  — loss framing (trial ended, user has experienced the product)

import { useState } from 'react'
import { PRICING } from '@/lib/brand'
import { authedFetch } from '@/lib/supabase/authedFetch'

// Ordered by recurring value — weekly coaching and zone scoring are the ongoing proof of
// subscription value. AI plans are high at onboarding but low thereafter.
const FEATURES = [
  { name: 'Weekly zone coaching',  detail: 'Your zone discipline score, every week. Honest.' },
  { name: 'Strava analysis',       detail: 'Your actual paces and HR. Not guesses.' },
  { name: 'AI session feedback',   detail: 'After every run. Knows your plan and your zones.' },
  { name: 'AI training plans',     detail: 'Built around your race, not a template.' },
  { name: 'Dynamic reshaping',     detail: 'Miss a week. The plan adapts.' },
]

// Loss framing — shown when the user's trial has expired.
// Names specifically what stopped, not what they could have.
const LOSSES = [
  { name: 'Zone discipline coaching', detail: 'Your weekly zone score has paused.' },
  { name: 'Weekly coaching reports',  detail: 'No more weekly reports.' },
  { name: 'Session feedback',         detail: 'Post-run analysis has stopped.' },
  { name: 'Plan adjustments',         detail: 'Your plan will no longer adapt.' },
]

export default function UpgradeScreen({ onBack, trialExpired = false }: {
  onBack: () => void
  trialExpired?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe(annual: boolean) {
    setLoading(true)
    setError(null)
    try {
      const res = await authedFetch('/api/checkout', {
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

  const items    = trialExpired ? LOSSES    : FEATURES
  const accent   = trialExpired ? 'var(--amber)' : 'var(--teal)'
  const headline = trialExpired ? 'Your coaching has paused.' : "Your trial's done."
  const sub      = trialExpired ? "14 days done. Here's what stopped." : 'Time to make it official.'

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
          {headline}
        </h1>
        <p style={{
          fontFamily: 'var(--font-ui)',
          fontWeight: 400, fontSize: '0.9375rem',
          color: 'var(--text-muted)', margin: '8px 0 0',
        }}>
          {sub}
        </p>

        <div style={{ height: '1px', background: 'var(--border-col)', margin: '24px 0' }} />

        {/* Feature / loss list — left accent, session card visual language */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {items.map((f) => (
            <div
              key={f.name}
              style={{
                display: 'flex', alignItems: 'flex-start',
                background: 'var(--card-bg)',
                border: '1px solid var(--border-col)',
                borderLeft: `3px solid ${accent}`,
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
            }}>{PRICING.monthly.display}</div>
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
              color: 'var(--ink)',
              whiteSpace: 'nowrap',
            }}>{PRICING.annual.savingLabel}</div>
            <div style={{
              fontFamily: 'var(--font-ui)', fontWeight: 700,
              fontSize: '1.5rem', color: 'var(--text-primary)',
            }}>{PRICING.annual.display}</div>
            <div style={{
              fontFamily: 'var(--font-ui)', fontWeight: 400,
              fontSize: '0.75rem', color: 'var(--text-muted)',
              marginTop: '4px',
            }}>per year · {PRICING.annual.perMonthDisplay}</div>
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
            fontSize: '1rem', color: 'var(--ink)',
            cursor: loading ? 'default' : 'pointer',
            letterSpacing: '0.02em',
            transition: 'opacity 0.15s',
          }}
        >
          {loading ? 'Loading…' : 'Start your subscription'}
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
