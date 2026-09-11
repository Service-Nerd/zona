'use client'

import { useEffect, useRef, useState } from 'react'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { BRAND } from '@/lib/brand'
import { Wordmark } from '@/components/ui/Wordmark'
import { TextField } from '@/components/shared/TextField'
import { sendPasswordReset, RESET_SENT_MESSAGE } from '@/lib/auth/sendPasswordReset'
import { DEAD_END_COPY, isDeadEnd, type ResetPhase } from '@/lib/auth/resetDeadEnd'

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
//
// UX-AUTH-03 (2026-09-11) — WHY THE DEAD END IS SPLIT IN THREE.
// Path 2 failing used to render "This reset link is invalid or has already been
// used. Request a fresh one and try again." When the template is NOT configured
// for token_hash that sentence is false AND it is a loop: the link is fine, the
// verifier simply lives in another browser, and every fresh link fails the same
// way. On iOS-native it can never succeed — the request is made in the Capacitor
// webview and the email opens in Safari, so the two browsers are different by
// construction, on the same device.
// So: say which of the three things actually happened, and offer a new link
// here rather than bouncing the runner back to sign-in to start again.

const MIN_PASSWORD = 8


export default function ResetPasswordPage() {
  const supabase = createClient()
  const [phase, setPhase]       = useState<ResetPhase>('verifying')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [resendEmail, setResendEmail] = useState('')
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [resendError, setResendError] = useState<string | null>(null)
  const settled = useRef(false)

  async function handleResend(e: React.FormEvent) {
    e.preventDefault()
    setResendError(null)
    setResendState('sending')
    const { error } = await sendPasswordReset(supabase, resendEmail)
    if (error) { setResendError(error); setResendState('idle'); return }
    setResendState('sent')
  }

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
    const markDeadEnd = (why: 'expired' | 'wrong_browser' | 'no_credential') => {
      if (settled.current) return
      settled.current = true
      setPhase(why)
    }

    // Path 1 — explicit OTP verification (cross-device safe).
    if (tokenHash) {
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: (type as EmailOtpType) || 'recovery' })
        .then(({ error }) => (error ? markDeadEnd('expired') : markReady()))
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
      // The distinction is the whole point. No credential means a mangled link.
      // A credential that never exchanged means the PKCE verifier is not in THIS
      // browser, which is a different problem with a different answer.
      markDeadEnd(code ? 'wrong_browser' : 'no_credential')
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

          {isDeadEnd(phase) && (
            <>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: '18px', fontWeight: 500, color: 'var(--ink)', marginBottom: '6px', letterSpacing: '-0.3px' }}>
                {DEAD_END_COPY[phase].heading}
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', marginBottom: '20px', lineHeight: 1.6 }}>
                {DEAD_END_COPY[phase].body}
              </div>

              {resendState === 'sent' ? (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--moss)', lineHeight: 1.6, marginBottom: '16px' }}>
                  {RESET_SENT_MESSAGE}
                </div>
              ) : (
                <form onSubmit={handleResend} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                  <TextField
                    type="email" placeholder="Your email" required
                    autoComplete="email"
                    value={resendEmail} onChange={setResendEmail}
                  />
                  <button
                    type="submit"
                    disabled={resendState === 'sending' || !resendEmail}
                    style={{
                      width: '100%', padding: '13px',
                      background: 'var(--moss)', color: 'var(--card)',
                      border: 'none', borderRadius: '10px',
                      fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 500,
                      cursor: resendState === 'sending' || !resendEmail ? 'default' : 'pointer',
                      opacity: resendState === 'sending' || !resendEmail ? 0.5 : 1,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {resendState === 'sending' ? 'Sending…' : 'Send a new link'}
                  </button>
                </form>
              )}

              {resendError && (
                <div style={{ marginBottom: '16px', fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--amber)', padding: '8px 12px', background: 'var(--amber-soft)', borderRadius: '8px' }}>
                  {resendError}
                </div>
              )}

              <a
                href="/auth/login"
                style={{
                  display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'center',
                  padding: '13px', background: 'none', color: 'var(--mute)',
                  border: '1px solid var(--line)', borderRadius: '10px', textDecoration: 'none',
                  fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500,
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
