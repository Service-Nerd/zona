'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const supabase = createClient()

  async function signInWithGoogle() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        skipBrowserRedirect: false,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '24px',
      background: '#000',
    }}>
      <div style={{ width: '100%', maxWidth: '340px' }}>

        {/* Brand */}
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <div style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '13px', color: '#D4501A',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: '6px',
          }}>
            @doinghardthingsbadly
          </div>
          <div style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '10px', color: '#333',
            letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            Race to the Stones · Training Hub
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#0d0d0d',
          border: '0.5px solid #1c1c1c',
          borderRadius: '16px',
          padding: '28px 24px',
        }}>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '18px', fontWeight: 500,
            color: '#fff', marginBottom: '6px',
            letterSpacing: '-0.3px',
          }}>
            Sign in
          </div>
          <div style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '11px', color: '#444',
            marginBottom: '24px', lineHeight: 1.5,
          }}>
            Use your Google account to access your training hub.
          </div>

          {/* Google button */}
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              background: loading ? '#111' : '#fff',
              color: '#111',
              border: '0.5px solid #1c1c1c',
              borderRadius: '10px',
              padding: '13px 16px',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '14px', fontWeight: 500,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {/* Google logo */}
            {!loading && (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
            )}
            {loading ? 'Redirecting...' : 'Continue with Google'}
          </button>

          {error && (
            <div style={{
              marginTop: '12px',
              fontFamily: "'DM Mono', monospace",
              fontSize: '11px', color: '#a44',
              padding: '8px 12px',
              background: 'rgba(170,68,68,0.08)',
              borderRadius: '8px',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '20px', textAlign: 'center',
          fontFamily: "'DM Mono', monospace",
          fontSize: '10px', color: '#2a2a2a',
        }}>
          Race to the Stones · 11 July 2026 · Make-A-Wish UK
        </div>
      </div>
    </div>
  )
}
