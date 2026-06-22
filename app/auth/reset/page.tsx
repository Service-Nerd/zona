'use client'

import { useEffect, useRef, useState } from 'react'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { BRAND } from '@/lib/brand'
import { Wordmark } from '@/components/ui/Wordmark'
import { TextField } from '@/components/shared/TextField'

// AUTH-RESET-01 — password reset landing.
//
// The recovery email links here. Two ways the link can carry its credential,
// both handled so the page works regardless of how the Supabase email template
// is configured:
//   1. token_hash + type=recovery (PREFERRED) — verified via verifyOtp. No PKCE
//      code_verifier needed, so it works cross-device and on iOS-native (where
//      the email opens in Safari, not the Capacitor webview). Configure the
//      "Reset Password" template link as
//        {{ .SiteURL }}/auth/reset?token_hash={{ .TokenHash }}&type=recovery
//   2. ?code= (PKCE, same-device only) — the browser client auto-exchanges via
//      detectSessionInUrl. Fallback for the default template; fails silently
//      cross-device because the verifier lives in the initiating browser.
//
// Either way the page ends with a recovery session, then updateUser sets the
// new password. Middleware allows the unauthenticated landing; the session is
// only established client-side here.

const MIN_PASSWORD = 8

type Phase = 'verifying' | 'ready' | 'invalid' | 'saving' | 'done'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const [phase, setPhase]       = useState<Phase>('verifying')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState<string | null>(null)
  const settled = useRef(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tokenHash = params.get('token_hash')
    const type      = params.get('type')
    const code      = params.get('code')

    // Strip the credential from the address bar once we've read it.
    const cleanUrl = () => window.history.replaceState({}, '', '/auth/reset')

    const markReady = () => {
      if (settled.current) return
      settled.current = true
      cleanUrl()
      setPhase('ready')
    }
    const markInvalid = () => {
      if (settled.current) return
      settled.current = true
      setPhase('invalid')
    }

    // Path 1 — explicit OTP verification (cross-device safe).
    if (tokenHash) {
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: (type as EmailOtpType) || 'recovery' })
        .then(({ error }) => (error ? markInvalid() : markReady()))
      return
    }

    // Path 2 — PKCE ?code= / implicit hash. The browser client auto-detects and
    // exchanges; we listen for the resulting recovery session, with a timeout
    // backstop for the cross-device case where the verifier is absent.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        markReady()
      }
    })
    supabase.auth.getSession().then(({ data }) => { if (data.session) markReady() })

    const timer = setTimeout(() => {
      if (!code) markInvalid()           // no credential at all → bad link
      else markInvalid()                 // had a code but exchange never landed
    }, 5000)

    return () => { sub.subscription.unsubscribe(); clearTimeout(timer) }
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD) { setError(`Password must be at least ${MIN_PASSWORD} characters.`); return }
    if (password !== confirm)           { setError('Passwords don’t match.'); return }

    setPhase('saving')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setPhase('ready'); return }
    setPhase('done')
    // Hard nav so the refreshed session cookies are committed before /dashboard.
    setTimeout(() => { window.location.href = '/dashboard' }, 1200)
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: '340px' }}>
        <div style={{ marginBottom: '48px', textAlign: 'center' }}>
          <div style={{ marginBottom: '8px' }}><Wordmark size="md" /></div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {BRAND.tagline}
          </div>
        </div>

        <div style={{ background: 'var(--card)', border: '0.5px solid var(--line)', borderRadius: '16px', padding: '28px 24px' }}>

          {phase === 'verifying' && (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', textAlign: 'center', padding: '12px 0' }}>
              Checking your link…
            </div>
          )}

          {phase === 'invalid' && (
            <>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: '18px', fontWeight: 500, color: 'var(--ink)', marginBottom: '6px', letterSpacing: '-0.3px' }}>
                Link expired
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', marginBottom: '20px', lineHeight: 1.6 }}>
                This reset link is invalid or has already been used. Request a fresh one and try again.
              </div>
              <a
                href="/auth/login"
                style={{
                  display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'center',
                  padding: '13px', background: 'var(--moss)', color: 'var(--card)',
                  border: 'none', borderRadius: '10px', textDecoration: 'none',
                  fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 500,
                }}
              >
                Back to sign in
              </a>
            </>
          )}

          {phase === 'done' && (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--moss)', textAlign: 'center', padding: '12px 0', lineHeight: 1.6 }}>
              Password updated. Taking you in…
            </div>
          )}

          {(phase === 'ready' || phase === 'saving') && (
            <>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: '18px', fontWeight: 500, color: 'var(--ink)', marginBottom: '6px', letterSpacing: '-0.3px' }}>
                Set a new password
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', marginBottom: '24px', lineHeight: 1.6 }}>
                Make it one you&rsquo;ll remember. At least {MIN_PASSWORD} characters.
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <TextField
                  type="password" placeholder="New password" required
                  autoComplete="new-password"
                  value={password} onChange={setPassword}
                />
                <TextField
                  type="password" placeholder="Confirm new password" required
                  autoComplete="new-password"
                  value={confirm} onChange={setConfirm}
                />
                <button
                  type="submit"
                  disabled={phase === 'saving' || !password || !confirm}
                  style={{
                    width: '100%', padding: '13px',
                    background: 'var(--moss)', color: 'var(--card)',
                    border: 'none', borderRadius: '10px',
                    fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 500,
                    cursor: phase === 'saving' || !password || !confirm ? 'default' : 'pointer',
                    opacity: phase === 'saving' || !password || !confirm ? 0.5 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {phase === 'saving' ? 'Saving…' : 'Update password'}
                </button>
              </form>

              {error && (
                <div style={{ marginTop: '12px', fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--amber)', padding: '8px 12px', background: 'var(--amber-soft)', borderRadius: '8px' }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
