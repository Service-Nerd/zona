'use client'

// Upgrade screen — shown when a user hits a PAID gate post-trial.
// Pattern: upgrade screen (see frontend-design skill for anatomy rules).
// Single job: show what paid access includes, offer subscription.
//
// Two variants:
//   trialExpired=false — gain framing (fresh gate during/before trial)
//   trialExpired=true  — loss framing (trial ended, user has experienced the product)

import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { BRAND, PRICING } from '@/lib/brand'
import { authedFetch } from '@/lib/supabase/authedFetch'

// Ordered by recurring value — Kit's daily read and the weekly zone score are the ongoing
// proof of subscription value. AI plan generation is high at onboarding but low thereafter.
// Kit-led copy: the paid product is a named coach, not a feature list. Names go through
// BRAND.coachName per the parameterisation rule.
const FEATURES = [
  { name: `${BRAND.coachName} reads every run`, detail: 'Tells you what you actually did.' },
  { name: 'Weekly zone score',                  detail: 'How disciplined was your week. Every Sunday.' },
  { name: 'Real paces and HR',                  detail: "What you did vs the zone you should've been in." },
  { name: 'A plan that moves',                  detail: `Miss a week. ${BRAND.coachName} reshapes it.` },
  { name: 'Built for your race',                detail: 'Your race, your week, your easy pace.' },
]

// Loss framing — shown when the user's trial has expired.
// Names specifically what stopped. Kit is the protagonist who's gone quiet.
const LOSSES = [
  { name: `${BRAND.coachName}'s gone quiet`, detail: "He's not reading your runs." },
  { name: 'Zone score paused',               detail: 'No new ones for now.' },
  { name: 'Sundays got quieter',             detail: 'No weekly review.' },
  { name: 'The plan stops moving',           detail: "Miss a week, you're on your own." },
]

export default function UpgradeScreen({ onBack, trialExpired = false }: {
  onBack: () => void
  trialExpired?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubscribe(annual: boolean) {
    setLoading(true)
    setError(null)
    try {
      if (Capacitor.isNativePlatform()) {
        // iOS native — RevenueCat StoreKit 2 purchase sheet.
        // Dynamic import keeps the native SDK out of the web bundle.
        const { Purchases } = await import('@revenuecat/purchases-capacitor')
        const offerings = await Purchases.getOfferings()
        const offering = offerings.current
        if (!offering) throw new Error('No offering available.')

        // Use RevenueCat's typed accessors — cleaner than searching availablePackages.
        const pkg = annual ? offering.annual : offering.monthly
        if (!pkg) throw new Error(`${annual ? 'Annual' : 'Monthly'} package not found.`)

        await Purchases.purchasePackage({ aPackage: pkg })
        // Webhook fires async and updates subscriptions table.
        // Show success state here — tier refreshes on next dashboard load.
        setSuccess(true)
      } else {
        // Web — Stripe Checkout (existing path).
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
      }
    } catch (err: any) {
      // User tapped Cancel on the StoreKit sheet — not an error.
      if (err?.userCancelled === true) return
      setError('Purchase failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  // Success state — shown after a successful native StoreKit purchase.
  if (success) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100%',
        background: 'var(--bg)', padding: '40px 24px', textAlign: 'center',
      }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'var(--moss)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', marginBottom: '24px',
          fontSize: '26px',
        }}>✓</div>
        <h1 style={{
          fontFamily: 'var(--font-brand)', fontWeight: 700,
          fontSize: '1.5rem', color: 'var(--ink)', margin: 0,
        }}>You&rsquo;re in.</h1>
        <p style={{
          fontFamily: 'var(--font-ui)', fontSize: '0.9375rem',
          color: 'var(--mute)', margin: '10px 0 0', lineHeight: 1.5,
        }}>
          Welcome to {PRICING.trialDays}-day free access.<br />
          Your plan adapts. Your coaching starts now.
        </p>
        <button
          onClick={onBack}
          style={{
            marginTop: '36px', padding: '14px 32px',
            background: 'var(--moss)', border: 'none', borderRadius: '10px',
            fontFamily: 'var(--font-ui)', fontWeight: 600,
            fontSize: '1rem', color: 'var(--card)',
            cursor: 'pointer',
          }}
        >
          Back to training
        </button>
      </div>
    )
  }

  const items    = trialExpired ? LOSSES    : FEATURES
  const accent   = trialExpired ? 'var(--amber)' : 'var(--teal)'
  const headline = trialExpired ? `${BRAND.coachName}'s gone quiet.` : `Keep ${BRAND.coachName} on.`
  const sub      = trialExpired ? "14 days done. Here's what stopped." : 'Pick the coach, not the template.'

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
            className="card-primary"
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
            className="card-primary"
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

        {/* Legal disclosure — Apple §3.1.2(a) compliant.
            Must cover: per-period prices, trial conversion, Apple-ID charge,
            renewal terms, cancellation path, links to Terms + Privacy.
            Submission-blocking on iOS — copy length is intentional. Brand
            voice is allowed to break here; this is a compliance surface. */}
        <div style={{
          fontFamily: 'var(--font-ui)', fontWeight: 400,
          fontSize: '0.6875rem', color: 'var(--text-muted)',
          margin: '14px 0 0', textAlign: 'center', lineHeight: 1.55,
        }}>
          <p style={{ margin: 0 }}>
            {PRICING.monthly.label} or {PRICING.annual.label} ({PRICING.annual.perMonthDisplay} equivalent).
            New subscribers get {PRICING.trialDays} days free — the first payment is charged at the
            end of the trial unless you cancel.
          </p>
          <p style={{ margin: '8px 0 0' }}>
            Payment is charged to your Apple ID at confirmation of purchase. Subscription auto-renews
            at the end of each period unless turned off at least 24 hours before renewal. Manage or
            cancel any time in your Apple ID account settings.
          </p>
          <div style={{
            marginTop: '10px',
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
          }}>
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
            >
              Terms of Service
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
            >
              Privacy Policy
            </a>
          </div>
        </div>

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
