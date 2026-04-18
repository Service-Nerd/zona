'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [mode, setMode]         = useState<'signin' | 'signup'>('signin')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage]   = useState<string | null>(null)
  const supabase = createClient()
  const router   = useRouter()

  async function signInWithGoogle() {
    setLoading(true); setError(null)
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
      router.push('/dashboard')
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) { setError(error.message); setLoading(false); return }
      setMessage('Account created — check your email to confirm, or sign in if confirmation is disabled.')
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
      data-theme="dark"
      style={{
        minHeight: '100dvh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '24px',
        background: 'var(--bg)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '340px' }}>

        {/* ZONA wordmark */}
        <div style={{ marginBottom: '48px', textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--font-brand)',
            fontSize: '40px', fontWeight: 500,
            letterSpacing: '0.08em', color: 'var(--accent)',
            lineHeight: 1, marginBottom: '8px',
          }}>ZONA</div>
          <div style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '11px', color: 'var(--text-muted)',
            letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>effort-first training</div>
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
          }}>Sign in</div>
          <div style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '11px', color: 'var(--text-muted)',
            marginBottom: '24px', lineHeight: 1.6,
          }}>Access your training plan.</div>

          {/* Google */}
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              background: loading ? 'var(--border-col)' : 'var(--text-primary)',
              color: 'var(--zona-navy)',
              border: '0.5px solid var(--border-col)',
              borderRadius: '10px',
              padding: '13px 16px',
              fontFamily: 'var(--font-ui)',
              fontSize: '14px', fontWeight: 500,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.6 : 1,
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
            <button type="submit" disabled={loading || !email || !password} style={{
              width: '100%', padding: '13px',
              background: 'var(--accent)', color: 'var(--zona-navy)',
              border: 'none', borderRadius: '10px',
              fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 500,
              cursor: loading || !email || !password ? 'default' : 'pointer',
              opacity: loading || !email || !password ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}>
              {loading ? '...' : mode === 'signin' ? 'Sign in' : 'Create account'}
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
          fontFamily: 'var(--font-ui)',
          fontSize: '10px', color: 'var(--text-muted)',
          opacity: 0.5, lineHeight: 1.7,
        }}>
          Slow down. You&apos;re not Kipchoge.
        </div>
      </div>
    </div>
  )
}
