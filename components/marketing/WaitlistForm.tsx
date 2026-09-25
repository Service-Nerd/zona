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
          fontSize: 'var(--fs-body-lg)',
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
        gap: 'var(--space-2)',
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
          // ⚠️ 14px padding and --radius-lg so this AGREES WITH THE BUTTON
          // beside it (WEBSITE-BUTTON-UNIFY-01, 2026-09-25). It was 13px /
          // --radius-md, which computed to 46px tall with a 14px corner against
          // the button's 48px and 18px — a 2px and 4px mismatch in a
          // side-by-side flex row. The button now carries the design system and
          // this input is a one-off, so the one-off moves. 13+18+13+2 = 46;
          // 14+18+14+2 = 48.
          padding: '14px 16px',
          fontSize: 'var(--fs-body-lg)',
          fontFamily: 'var(--font-ui)',
          color: 'var(--ink)',
          background: 'var(--bg-soft)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          outline: 'none',
        }}
      />
      <button
        type="submit"
        disabled={state === 'submitting'}
        aria-busy={state === 'submitting' || undefined}
        className={`btn btn--primary btn--regular${state === 'submitting' ? ' btn--busy' : ''}`}
        style={{ flex: '0 0 auto' }}
      >
        {state === 'submitting' ? 'Adding…' : 'Notify me'}
      </button>

      {state === 'error' && (
        <div
          role="alert"
          style={{
            flexBasis: '100%',
            fontSize: 'var(--fs-sm)',
            color: 'var(--warn-strong)',
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
