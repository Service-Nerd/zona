'use client'

// GTM-CHARITY-04 — redeem a charity access code.
//
// A FULL SCREEN, not a modal (UI principle: no popups, all interactions
// navigate). One job: take a code, exchange it for access, say what happened.
//
// Reachable from Me and from the Upgrade screen. Two doors on purpose: the
// organised runner redeems on day one from Me and never thinks about it again;
// the one who put the email away gets the prompt at the gate, which is exactly
// when it bites. One mechanism, two entry points, no duplicated logic.
//
// VOICE: this is a gift from a charity, not a transaction, and the copy should
// not read like a checkout. No "promo", no "discount", no exclamation marks.
// And per the SLT ruling we never name the charity back to the runner: the
// fundraising page and the people watching are the extrinsic pressure that
// makes this cohort overtrain, so reflecting it into the app amplifies the
// thing that hurts them.

import { useState } from 'react'
import { BRAND } from '@/lib/brand'
import { authedFetch } from '@/lib/supabase/authedFetch'

function formatEnds(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return ''
  }
}

export default function RedeemCodeScreen({ onBack, onRedeemed }: {
  onBack: () => void
  /** Fires after a successful redemption so the dashboard can re-resolve tier
   *  without a reload — the runner should see the app unlock, not be told it
   *  will unlock. */
  onRedeemed?: (expiresAt: string | null) => void
}) {
  const [code, setCode]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [endsOn, setEndsOn]   = useState<string | null>(null)

  async function handleRedeem() {
    if (!code.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await authedFetch('/api/charity/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      // Check res.ok explicitly — an unchecked fetch that treats a 409 as
      // success is one of this codebase's named silent-failure classes.
      if (!res.ok) {
        // 401 means the session lapsed mid-flow. The route's body says
        // "Unauthorized", which is developer language: caught by looking at the
        // rendered screen, not by reading the diff. Never show a runner a
        // status string.
        setError(res.status === 401
          ? 'Your session timed out. Sign in again and retry your code.'
          : data?.error ?? 'Could not redeem that code. Try again.')
        return
      }
      setEndsOn(data.expiresAt ?? null)
      onRedeemed?.(data.expiresAt ?? null)
    } catch {
      setError('No connection. Try again when you are back online.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div style={{ padding: '16px 16px 8px' }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            width: '44px', height: '44px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', borderRadius: '50%',
            background: 'var(--bg-soft)', color: 'var(--ink)', cursor: 'pointer',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div style={{ padding: '8px 20px 48px', maxWidth: '480px', margin: '0 auto' }}>

        {endsOn ? (
          /* ── Redeemed ──────────────────────────────────────────────────
             Lead with what they now have and when it ends. Traynor's
             requirement: the end date is visible from the start, because a
             silent expiry turns a gift into a complaint. */
          <>
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700,
              color: 'var(--moss)', letterSpacing: '0.1em', textTransform: 'uppercase',
              marginBottom: '12px',
            }}>
              You&rsquo;re in
            </div>
            <h1 style={{
              fontFamily: 'var(--font-brand)', fontSize: '28px', fontWeight: 800,
              color: 'var(--ink)', letterSpacing: '-0.5px', lineHeight: 1.2,
              margin: '0 0 14px',
            }}>
              Full access, unlocked.
            </h1>
            <p style={{
              fontFamily: 'var(--font-ui)', fontSize: '15px', lineHeight: 1.6,
              color: 'var(--ink-2)', margin: '0 0 20px',
            }}>
              Everything {BRAND.coachName} does is switched on: your plan, your real
              zones, and the reshaping when a week goes sideways. Nothing to pay,
              nothing to cancel.
            </p>
            <div style={{
              background: 'var(--card)', border: '1px solid var(--line)',
              borderLeft: '3px solid var(--moss)',
              borderRadius: 'var(--radius-lg)', padding: '16px 18px',
              fontFamily: 'var(--font-ui)', fontSize: '14px', lineHeight: 1.55,
              color: 'var(--ink-2)',
            }}>
              Your access runs to <strong style={{ color: 'var(--ink)' }}>{formatEnds(endsOn)}</strong>.
              Once you set your race date it extends to a week after race day, so it
              will not run out mid-training.
            </div>
            <button
              onClick={onBack}
              style={{
                marginTop: '24px', width: '100%', padding: '16px',
                background: 'var(--moss)', color: 'var(--card)',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Get started
            </button>
          </>
        ) : (
          <>
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700,
              color: 'var(--moss)', letterSpacing: '0.1em', textTransform: 'uppercase',
              marginBottom: '12px',
            }}>
              Charity access
            </div>
            <h1 style={{
              fontFamily: 'var(--font-brand)', fontSize: '28px', fontWeight: 800,
              color: 'var(--ink)', letterSpacing: '-0.5px', lineHeight: 1.2,
              margin: '0 0 14px',
            }}>
              Got a code?
            </h1>
            <p style={{
              fontFamily: 'var(--font-ui)', fontSize: '15px', lineHeight: 1.6,
              color: 'var(--ink-2)', margin: '0 0 24px',
            }}>
              If your charity gave you a code, enter it here. It switches on everything
              {' '}{BRAND.coachName} does, free, for your whole training block.
            </p>

            <label
              htmlFor="charity-code"
              style={{
                display: 'block', fontFamily: 'var(--font-ui)', fontSize: '10px',
                fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.08em',
                textTransform: 'uppercase', marginBottom: '8px',
              }}
            >
              Your code
            </label>
            <input
              id="charity-code"
              value={code}
              onChange={e => { setCode(e.target.value); setError(null) }}
              onKeyDown={e => { if (e.key === 'Enter') handleRedeem() }}
              placeholder="ZONNA-XXXX-XXXX"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              style={{
                width: '100%', padding: '14px 16px',
                background: 'var(--card)', border: '1px solid var(--line-strong)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-ui)',
                // 16px minimum: anything smaller makes iOS Safari zoom the
                // viewport on focus, which reads as the app breaking.
                fontSize: '16px', fontWeight: 600,
                color: 'var(--ink)', letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            />

            {error && (
              <div role="alert" style={{
                marginTop: '12px', fontFamily: 'var(--font-ui)', fontSize: '14px',
                lineHeight: 1.5, color: 'var(--danger)',
              }}>
                {error}
              </div>
            )}

            <button
              onClick={handleRedeem}
              disabled={!code.trim() || loading}
              style={{
                marginTop: '20px', width: '100%', padding: '16px',
                background: !code.trim() || loading ? 'var(--bg-soft)' : 'var(--moss)',
                color: !code.trim() || loading ? 'var(--mute)' : 'var(--card)',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600,
                cursor: !code.trim() || loading ? 'default' : 'pointer',
              }}
            >
              {loading ? 'Checking…' : 'Redeem'}
            </button>

            <p style={{
              marginTop: '18px', fontFamily: 'var(--font-ui)', fontSize: '13px',
              lineHeight: 1.55, color: 'var(--mute)',
            }}>
              No code? You do not need one to use {BRAND.name}. Every new account gets
              two weeks of everything.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
