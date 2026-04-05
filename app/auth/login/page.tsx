'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [mode, setMode]         = useState<'login' | 'signup'>('login')
  const supabase = createClient()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.refresh()
      router.push('/dashboard')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.2rem', color: 'var(--orange)', letterSpacing: '0.05em' }}>
            @doinghardthingsbadly
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '4px' }}>
            Race to the Stones · Training Hub
          </div>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderTop: '2px solid var(--orange)', borderRadius: '8px', padding: '28px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '20px' }}>
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)} required
              style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '5px', padding: '11px 14px', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', outline: 'none', width: '100%' }}
            />
            <input
              type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)} required
              style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '5px', padding: '11px 14px', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', outline: 'none', width: '100%' }}
            />
            {error && (
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: 'var(--red)', padding: '8px 12px', background: 'rgba(255,51,51,0.08)', borderRadius: '4px' }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              style={{ background: 'var(--orange)', color: '#1a1a1a', border: 'none', borderRadius: '5px', padding: '12px', fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}>
              {loading ? 'Signing in...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div style={{ marginTop: '16px', textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--text-dim)' }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}
              style={{ color: 'var(--orange)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </div>

        <div style={{ marginTop: '16px', textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: 'var(--muted)' }}>
          Race to the Stones · 11 July 2026 · Make-A-Wish UK
        </div>
      </div>
    </div>
  )
}
