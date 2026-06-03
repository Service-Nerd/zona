'use client'

// GTM-08 — Marketing-site waitlist capture form.
// Pattern: single-field inline capture (input + moss action), all states handled.
// Voice: dry confirmation, never cheerleader. Tokens only — no hardcoded colour.

import { useState } from 'react'

type State = 'idle' | 'submitting' | 'success' | 'error'

export function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'submitting') return
    setState('submitting')
    setError('')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Something went wrong. Try again.')
        setState('error')
        return
      }
      setState('success')
    } catch {
      setError('Something went wrong. Try again.')
      setState('error')
    }
  }

  // Success — replace the form with a quiet confirmation (Zona voice).
  if (state === 'success') {
    return (
      <div
        style={{
          maxWidth: '420px',
          margin: '0 auto',
          padding: '14px 18px',
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderLeft: '3px solid var(--moss)',
          borderRadius: 'var(--radius-md, 8px)',
          fontSize: '15px',
          lineHeight: 1.5,
          color: 'var(--ink)',
          textAlign: 'left',
        }}
      >
        You&apos;re on the list. We&apos;ll ping you the day it&apos;s live. Nothing before then.
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      style={{
        maxWidth: '460px',
        margin: '0 auto',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}
    >
      <label htmlFor="waitlist-email" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        Email address
      </label>
      <input
        id="waitlist-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle') }}
        placeholder="you@email.com"
        disabled={state === 'submitting'}
        style={{
          flex: '1 1 220px',
          minWidth: 0,
          padding: '13px 16px',
          fontSize: '15px',
          fontFamily: 'var(--font-ui)',
          color: 'var(--ink)',
          background: 'var(--bg-soft)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-md, 8px)',
          outline: 'none',
        }}
      />
      <button
        type="submit"
        disabled={state === 'submitting'}
        style={{
          flex: '0 0 auto',
          padding: '13px 24px',
          fontSize: '15px',
          fontWeight: 600,
          fontFamily: 'var(--font-ui)',
          color: 'white',
          background: 'var(--moss)',
          border: 'none',
          borderRadius: 'var(--radius-md, 8px)',
          cursor: state === 'submitting' ? 'default' : 'pointer',
          opacity: state === 'submitting' ? 0.7 : 1,
        }}
      >
        {state === 'submitting' ? 'Adding…' : 'Notify me'}
      </button>

      {state === 'error' && (
        <div
          role="alert"
          style={{
            flexBasis: '100%',
            fontSize: '13px',
            color: 'var(--warn)',
            textAlign: 'center',
            marginTop: '2px',
          }}
        >
          {error}
        </div>
      )}
    </form>
  )
}
