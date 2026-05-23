'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { createClient } from '@/lib/supabase/client'
import { BRAND } from '@/lib/brand'
import { NATIVE_AUTH_CALLBACK } from '@/lib/native'
import { Wordmark } from '@/components/ui/Wordmark'

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
  const [message, setMessage]   = useState<string | null>(null)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const supabase = createClient()
  const router   = useRouter()

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

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      // Hard navigation ensures auth cookies are fully committed before
      // the next request — router.push (soft nav) can race the cookie write
      window.location.href = '/dashboard'
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) { setError(error.message); setLoading(false); return }
      setMessage('Account created. Check your email.')
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--input-bg)',
    border: '0.5px solid var(--border-col)', borderRadius: '10px',
    padding: '12px 14px', color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box',
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
            fontSize: '11px', color: 'var(--text-muted)',
            letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>{BRAND.tagline}</div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--card-bg)',
          border: '0.5px solid var(--border-col)',
          borderRadius: '16px',
          padding: '28px 24px',
        }}>
          <div style={{
            fontFamily: 'var(--font-brand)',
            fontSize: '18px', fontWeight: 500,
            color: 'var(--text-primary)', marginBottom: '6px',
            letterSpacing: '-0.3px',
          }}>{mode === 'signin' ? 'Sign in' : 'Create account'}</div>
          <div style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '11px', color: 'var(--text-muted)',
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
              color: '#FFFFFF',
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

          {/* Google */}
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              border: '0.5px solid var(--border-col)',
              borderRadius: '10px',
              padding: '13px 16px',
              fontFamily: 'var(--font-ui)',
              fontSize: '14px', fontWeight: 500,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {!loading && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/google-logo.svg" width="18" height="18" alt="" />
            )}
            {loading ? 'Redirecting...' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '20px 0' }}>
            <div style={{ flex: 1, height: '0.5px', background: 'var(--border-col)' }} />
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>or</span>
            <div style={{ flex: 1, height: '0.5px', background: 'var(--border-col)' }} />
          </div>

          {/* Mode toggle */}
          <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: '8px', padding: '3px', marginBottom: '16px' }}>
            {(['signin', 'signup'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(null); setMessage(null) }} style={{
                flex: 1, padding: '7px',
                background: mode === m ? 'var(--card-bg)' : 'transparent',
                border: mode === m ? '0.5px solid var(--border-col)' : 'none',
                borderRadius: '6px',
                fontFamily: 'var(--font-ui)', fontSize: '11px',
                color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {m === 'signin' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          {/* Email/password form */}
          <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="email" placeholder="Email" required
              value={email} onChange={e => setEmail(e.target.value)}
              style={inputStyle}
            />
            <input
              type="password" placeholder="Password" required
              value={password} onChange={e => setPassword(e.target.value)}
              style={inputStyle}
            />
            {mode === 'signup' && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={e => setAgeConfirmed(e.target.checked)}
                  style={{ marginTop: '2px', accentColor: 'var(--accent)', flexShrink: 0 }}
                />
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  I confirm I am 13 years of age or older.
                </span>
              </label>
            )}
            <button
              type="submit"
              disabled={loading || !email || !password || (mode === 'signup' && !ageConfirmed)}
              style={{
                width: '100%', padding: '13px',
                background: 'var(--accent)', color: 'var(--card)',
                border: 'none', borderRadius: '10px',
                fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 500,
                cursor: loading || !email || !password || (mode === 'signup' && !ageConfirmed) ? 'default' : 'pointer',
                opacity: loading || !email || !password || (mode === 'signup' && !ageConfirmed) ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {loading
                ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
                : (mode === 'signin' ? 'Sign in' : 'Create account')}
            </button>
          </form>

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
              fontSize: '11px', color: 'var(--accent)',
              padding: '8px 12px',
              background: 'var(--accent-soft)',
              borderRadius: '8px',
            }}>{message}</div>
          )}
        </div>

        <div style={{
          marginTop: '24px', textAlign: 'center',
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
        }}>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '10px', color: 'var(--text-muted)',
              opacity: 0.4, textDecoration: 'underline',
              textUnderlineOffset: '2px',
            }}
          >
            Privacy Policy
          </a>
          <span style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '10px', color: 'var(--text-muted)',
            opacity: 0.4,
          }}>·</span>
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '10px', color: 'var(--text-muted)',
              opacity: 0.4, textDecoration: 'underline',
              textUnderlineOffset: '2px',
            }}
          >
            Terms of Service
          </a>
        </div>
      </div>
    </div>
  )
}
