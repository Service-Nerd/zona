'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { createClient } from '@/lib/supabase/client'
import { BRAND } from '@/lib/brand'
import { NATIVE_AUTH_CALLBACK } from '@/lib/native'
import { sendPasswordReset, RESET_SENT_MESSAGE } from '@/lib/auth/sendPasswordReset'
import { authErrorCopy } from '@/lib/auth/authErrorCopy'
import { Wordmark } from '@/components/ui/Wordmark'
import { TextField } from '@/components/shared/TextField'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import ExternalLink from '@/components/shared/ExternalLink'
import Button from '@/components/ui/Button'

// NATIVE_AUTH_CALLBACK is the custom URL scheme registered in
// ios/App/App/Info.plist. Google OAuth requires SFSafariViewController on iOS
// (WKWebView is blocked with disallowed_useragent), so on native we open the
// OAuth URL via @capacitor/browser and return through this scheme. The deep
// link listener in components/CapacitorBoot.tsx completes the auth.
//
// Sign in with Apple on native uses ASAuthorizationController via the
// @capawesome/capacitor-apple-sign-in plugin (no browser hop), so it
// returns inline rather than through this URL.
//
// Manual one-time setup: NATIVE_AUTH_CALLBACK must be added in the Supabase
// dashboard at Authentication -> URL Configuration -> Redirect URLs.

function generateNonce(): string {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function LoginPage() {
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [mode, setMode]         = useState<'signin' | 'signup'>('signin')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [signupName, setSignupName] = useState('')
  const [message, setMessage]   = useState<string | null>(null)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  // AUTH-RESET-01 — forgot-password request view (toggled from signin mode).
  const [forgot, setForgot]     = useState(false)
  // UX-AUTH-02 — the email form is disclosed, not displayed. Apple and Google
  // are the two taps that work for a runner who has just installed the app from
  // a charity email; a segmented control, two fields and a "Forgot password?"
  // sitting under them is four decisions asked before the first one is made.
  const [emailOpen, setEmailOpen] = useState(false)
  const supabase = createClient()
  const router   = useRouter()

  // AUTH-RESET-01 — send a password-reset email. redirectTo lands on /auth/reset;
  // the recovery link is verified there (token_hash via verifyOtp, cross-device
  // safe; ?code= as a same-device PKCE fallback). We never reveal whether the
  // email has an account — Supabase returns success for unknown addresses, and
  // we show the same neutral message either way.
  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null); setMessage(null)
    const { error } = await sendPasswordReset(supabase, email)
    setLoading(false)
    if (error) { setError(error); return }
    setMessage(RESET_SENT_MESSAGE)
  }

  async function signInWithApple() {
    setLoading(true); setError(null)

    if (Capacitor.isNativePlatform()) {
      try {
        const { AppleSignIn, SignInScope } = await import('@capawesome/capacitor-apple-sign-in')

        // Apple wants SHA-256 of the raw nonce in the authorize call;
        // Supabase needs the *raw* nonce to verify the returned id_token.
        const rawNonce = generateNonce()
        const hashedNonce = await sha256Hex(rawNonce)

        // iOS path: no clientId/redirectUrl needed — the plugin uses the
        // bundle ID + entitlement directly. Supabase Apple provider must
        // have NATIVE_BUNDLE_ID listed in Authorized Client IDs so the
        // id_token's audience claim verifies.
        const result = await AppleSignIn.signIn({
          scopes: [SignInScope.Email, SignInScope.FullName],
          nonce: hashedNonce,
        })

        const identityToken = result?.idToken
        if (!identityToken) {
          setError('Apple did not return an identity token.')
          setLoading(false)
          return
        }

        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: identityToken,
          nonce: rawNonce,
        })
        if (error) {
          setError(error.message)
          setLoading(false)
          return
        }

        // Apple returns name *only* on the first authorization (privacy
        // design) — never again. Persist it to user_metadata.full_name so
        // the existing pre-fill in DashboardClient picks it up the same way
        // it does for Google. Skipping this step leaves Profile fields blank
        // forever with no way to recover the name from Apple.
        const fn = (result.givenName || '').trim()
        const ln = (result.familyName || '').trim()
        const fullName = [fn, ln].filter(Boolean).join(' ')
        if (fullName) {
          await supabase.auth.updateUser({ data: { full_name: fullName } })
        }

        window.location.href = '/dashboard'
      } catch (e: any) {
        // User cancellation throws — don't surface as an error.
        const msg = e?.message || ''
        if (msg && !/cancel/i.test(msg) && !/1001/.test(msg)) {
          setError(msg)
        }
        setLoading(false)
      }
      return
    }

    // Web (browser / PWA): Supabase performs the redirect itself.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  async function signInWithGoogle() {
    setLoading(true); setError(null)

    if (Capacitor.isNativePlatform()) {
      // Open Google OAuth in SafariViewController via @capacitor/browser.
      // Google blocks WKWebView (disallowed_useragent) but accepts SFSafari.
      // Returns to the app via the registered custom URL scheme; the deep
      // link listener in CapacitorBoot finishes the code exchange.
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: NATIVE_AUTH_CALLBACK,
          skipBrowserRedirect: true,
        },
      })
      if (error || !data?.url) {
        setError(error?.message ?? 'Could not start Google sign-in.')
        setLoading(false)
        return
      }
      await Browser.open({ url: data.url, presentationStyle: 'popover' })
      // Loading stays true — the deep link handler navigates the user away.
      return
    }

    // Web (browser / PWA): Supabase performs the redirect itself.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null); setMessage(null)

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setError(authErrorCopy(error.message, 'signin')); setLoading(false); return }
        // Hard navigation ensures auth cookies are fully committed before
        // the next request — router.push (soft nav) can race the cookie write.
        // Loading stays true: we are navigating away.
        window.location.href = '/dashboard'
        return
      }

      // The name rides in on `user_metadata.full_name` — the SAME field Google
      // and Apple populate — because DashboardClient already reads that field on
      // first load and writes it to `user_settings`. Reusing that path means one
      // name-capture mechanism for all three sign-up routes rather than a fourth.
      // Optional on purpose: an account is not worth losing over a nicety, and
      // the Me screen prompts for it when it is missing.
      const fullName = signupName.trim()
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          ...(fullName ? { data: { full_name: fullName } } : {}),
        },
      })
      if (error) { setError(authErrorCopy(error.message, 'signup')); setLoading(false); return }
      // Auto-confirm (email confirmation disabled): signUp returns a live session
      // and the browser client has already persisted it — sign the user straight in
      // rather than stranding them on the login screen. Loading stays true: navigating away.
      if (data.session) {
        window.location.href = '/dashboard'
        return
      }
      // Email confirmation required: no session yet — tell the user to check their inbox.
      setMessage('Account created. Check your email.')
      setLoading(false)
    } catch (err) {
      // signUp/signIn can reject or hang (network, native webview cookie stall).
      // Without this the "Creating account…" state would persist forever.
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '24px',
        background: 'var(--bg)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '340px' }}>

        {/* Brand wordmark — Wordmark component sources text from BRAND.name */}
        <div style={{ marginBottom: '48px', textAlign: 'center' }}>
          <div style={{ marginBottom: '8px' }}>
            <Wordmark size="md" />
          </div>
          <div style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '11px', color: 'var(--mute)',
            letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>{BRAND.tagline}</div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--card)',
          border: '0.5px solid var(--line)',
          borderRadius: '16px',
          padding: '28px 24px',
        }}>
          {forgot ? (
          <>
          <div style={{
            fontFamily: 'var(--font-brand)',
            fontSize: '18px', fontWeight: 500,
            color: 'var(--ink)', marginBottom: '6px',
            letterSpacing: '-0.3px',
          }}>Reset password</div>
          <div style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '11px', color: 'var(--mute)',
            marginBottom: '24px', lineHeight: 1.6,
          }}>Enter your email and we&rsquo;ll send a link to set a new password.</div>

          <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <TextField
              type="email" placeholder="Email" required
              autoComplete="email"
              value={email} onChange={setEmail}
            />
            <Button variant="primary" fullWidth
              type="submit"
              disabled={loading || !email}>
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>

          <button className="btn btn--ghost btn--compact btn--full"
            onClick={() => { setForgot(false); setError(null); setMessage(null) }} style={{ marginTop: '14px' }}>
            ← Back to sign in
          </button>

          {error && (
            <div style={{
              marginTop: '12px',
              fontFamily: 'var(--font-ui)',
              fontSize: '11px', color: 'var(--amber)',
              padding: '8px 12px',
              background: 'var(--amber-soft)',
              borderRadius: '8px',
            }}>{error}</div>
          )}
          {message && (
            <div style={{
              marginTop: '12px',
              fontFamily: 'var(--font-ui)',
              fontSize: '11px', color: 'var(--moss)',
              padding: '8px 12px',
              background: 'var(--moss-soft)',
              borderRadius: '8px',
            }}>{message}</div>
          )}
          </>
          ) : (
          <>
          <div style={{
            fontFamily: 'var(--font-brand)',
            fontSize: '18px', fontWeight: 500,
            color: 'var(--ink)', marginBottom: '6px',
            letterSpacing: '-0.3px',
          }}>{mode === 'signin' ? 'Sign in' : 'Create account'}</div>
          <div style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '11px', color: 'var(--mute)',
            marginBottom: '24px', lineHeight: 1.6,
          }}>{mode === 'signin' ? BRAND.signinSub : BRAND.signupSub}</div>

          {/* Apple — Apple HIG requires equivalent prominence to other
              third-party sign-in. Black surface, white logo + text per HIG. */}
          <button
            onClick={signInWithApple}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              background: 'var(--ink)',
              color: 'var(--card)',
              border: 'none',
              borderRadius: '10px',
              padding: '13px 16px',
              fontFamily: 'var(--font-ui)',
              fontSize: '14px', fontWeight: 500,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'opacity 0.15s',
              marginBottom: '10px',
            }}
          >
            {!loading && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/apple-logo.svg" width="16" height="16" alt="" style={{ filter: 'invert(1)', transform: 'translateY(-1px)' }} />
            )}
            {loading ? 'Redirecting...' : 'Continue with Apple'}
          </button>

          {/* Google — `--line-strong`, not `--line`, and 1px rather than 0.5px.
              This button's fill is `--card` and it sits ON a `--card` surface,
              so the border is not a definition edge, it is the ONLY thing that
              says a control is there. At 8% alpha and half a pixel it was not
              saying it: reported from a device as "lost its outline and blends
              into the background". Same rule, same token as the redeem-code
              input (`RedeemCodeScreen.tsx`), which is white on white for the
              same reason. Google's own light-theme branding wants exactly this
              shape too — white surface, visible stroke. */}
          <button className="btn btn--secondary btn--regular btn--full"
            onClick={signInWithGoogle}
            disabled={loading}>
            {!loading && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/google-logo.svg" width="18" height="18" alt="" />
            )}
            {loading ? 'Redirecting...' : 'Continue with Google'}
          </button>

          {/* UX-AUTH-02 — progressive disclosure. Everything below the toggle is
              the email path; it stays closed until the runner asks for it, and
              it closes again. Apple and Google remain visible either way, so
              nothing is taken away and Apple keeps the prominence its HIG
              requires.

              ONE button, in ONE place, with a label that flips — not a link to
              open and a different control to close. It keeps `aria-expanded`
              attached to a single element across both states, and it stands
              exactly where the old "OR" rule stood, doing that rule's job as
              well as its own. That is why the divider is gone rather than
              stacked on top of it. */}
          <button className="btn btn--ghost btn--regular"
            onClick={() => { setEmailOpen(v => !v); setError(null); setMessage(null) }}
            aria-expanded={emailOpen}
            aria-controls="email-auth" style={{ margin: '20px 0', width: '100%', fontSize: '12px', padding: '4px 0', textDecoration: 'underline', textUnderlineOffset: '3px' }}
          >
            {emailOpen ? 'Hide email sign in' : 'Use email instead'}
          </button>

          {emailOpen && (
          <div id="email-auth">

          {/* Mode toggle */}
          <div style={{ marginBottom: '16px' }}>
            <SegmentedControl
              ariaLabel="Sign in or sign up"
              value={mode}
              onChange={m => { setMode(m); setError(null); setMessage(null) }}
              options={[
                { value: 'signin', label: 'Sign in' },
                { value: 'signup', label: 'Sign up' },
              ]}
            />
          </div>

          {/* Email/password form */}
          <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {mode === 'signup' && (
              /* PROFILE-NAME-01 follow-up (SLT 2026-09-18). The field was
                 already optional in code — no `required`, and the handler does
                 `...(fullName ? { data } : {})` — but it rendered as the FIRST
                 of three identical boxes, above two that ARE required, with
                 nothing to say so. Nobody skips a field they believe is
                 mandatory, so the optionality existed only for whoever read the
                 source.
                 The founder asked to delete the field for slickness. The board
                 declined: it feeds six prompt builders, the trial emails and
                 the avatar initials, and removing it would part-revert
                 PROFILE-NAME-01 shipped the day before. Naming it optional
                 delivers the same slickness and keeps the name.
                 Placeholder rather than a label: this form is placeholder-only
                 for email and password, and one labelled field would break that
                 rhythm for the sake of a word. */
              <TextField
                type="text" placeholder="First name (optional)"
                autoComplete="given-name"
                ariaLabel="First name, optional"
                value={signupName} onChange={setSignupName}
              />
            )}
            <TextField
              type="email" placeholder="Email" required
              autoComplete="email"
              value={email} onChange={setEmail}
            />
            <TextField
              type="password" placeholder="Password" required
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password} onChange={setPassword}
            />
            {mode === 'signup' && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={e => setAgeConfirmed(e.target.checked)}
                  style={{ marginTop: '2px', accentColor: 'var(--moss)', flexShrink: 0 }}
                />
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', lineHeight: 1.6 }}>
                  I confirm I am 13 years of age or older.
                </span>
              </label>
            )}
            <Button variant="primary" fullWidth
              type="submit"
              disabled={loading || !email || !password || (mode === 'signup' && !ageConfirmed)}>
              {loading
                ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
                : (mode === 'signin' ? 'Sign in' : 'Create account')}
            </Button>
          </form>

          {mode === 'signin' && (
            <button className="btn btn--ghost btn--regular"
              onClick={() => { setForgot(true); setError(null); setMessage(null) }} style={{ marginTop: '12px', width: '100%', fontSize: '12px', padding: '4px 0', textDecoration: 'underline', textUnderlineOffset: '3px' }}
            >
              Forgot password?
            </button>
          )}
          </div>
          )}

          {error && (
            <div style={{
              marginTop: '12px',
              fontFamily: 'var(--font-ui)',
              fontSize: '11px', color: 'var(--amber)',
              padding: '8px 12px',
              background: 'var(--amber-soft)',
              borderRadius: '8px',
            }}>{error}</div>
          )}

          {message && (
            <div style={{
              marginTop: '12px',
              fontFamily: 'var(--font-ui)',
              fontSize: '11px', color: 'var(--moss)',
              padding: '8px 12px',
              background: 'var(--moss-soft)',
              borderRadius: '8px',
            }}>{message}</div>
          )}
          </>
          )}
        </div>

        <div style={{
          marginTop: '24px', textAlign: 'center',
          fontFamily: 'var(--font-ui)',
          fontSize: '11px', color: 'var(--mute)',
          lineHeight: 1.6,
          padding: '0 4px',
        }}>
          {BRAND.name} is training guidance, not medical advice. If you have a health condition or haven&rsquo;t exercised in a while, check with a doctor first.
        </div>

        <div style={{
          marginTop: '12px', textAlign: 'center',
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
        }}>
          <ExternalLink
            href="/privacy"
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '10px', color: 'var(--mute)',
              opacity: 0.4, textDecoration: 'underline',
              textUnderlineOffset: '2px',
            }}
          >
            Privacy Policy
          </ExternalLink>
          <span style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '10px', color: 'var(--mute)',
            opacity: 0.4,
          }}>·</span>
          <ExternalLink
            href="/terms"
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '10px', color: 'var(--mute)',
              opacity: 0.4, textDecoration: 'underline',
              textUnderlineOffset: '2px',
            }}
          >
            Terms of Service
          </ExternalLink>
        </div>
      </div>
    </div>
  )
}
