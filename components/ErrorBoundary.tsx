'use client'

import React from 'react'
import { BRAND } from '@/lib/brand'

interface Props { children: React.ReactNode }
interface State { hasError: boolean; message: string; stack: string; copied: boolean }

/** A bundle chunk that no longer exists on the server — the classic symptom of a
 *  deploy landing while an app is open. The Capacitor webview holds a cached
 *  document referencing chunk hashes the new deployment does not have, so the
 *  next lazy import 404s. Reloading genuinely does fix it, which is the one case
 *  where "try refreshing" is a real instruction rather than a shrug. */
const CHUNK_ERROR = /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '', stack: '', copied: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message, stack: '', copied: false }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[${BRAND.name}] Uncaught error:`, error, info.componentStack)
    this.setState({ stack: (info.componentStack ?? '').trim() })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          background: 'var(--bg)',
          fontFamily: 'var(--font-brand)',
        }}
      >
        <div style={{ width: '100%', maxWidth: '320px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--moss)', marginBottom: '24px' }}>
            {BRAND.name}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--ink)', marginBottom: '8px', letterSpacing: '-0.3px' }}>
            Something went wrong.
          </div>
          <div style={{ fontSize: '13px', color: 'var(--mute)', marginBottom: '20px', lineHeight: 1.6, fontFamily: 'var(--font-ui)' }}>
            {CHUNK_ERROR.test(this.state.message)
              ? 'The app updated while you had it open. Reloading will fix this.'
              : 'Not ideal. Reloading usually sorts it out.'}
          </div>

          {/* WHAT BROKE — 2026-09-11.
              This boundary has always captured `error.message` into state and
              NEVER RENDERED IT. The app knew exactly what had failed and showed
              the runner "Something went wrong", so the only report anyone could
              give was that sentence. A whole debugging session went on a Coach
              crash that the screen itself could have named in one line.
              Shown to everyone, deliberately: a runner who can read the message
              to me is worth more than a tidier error screen, and there is
              nothing sensitive in a React error. */}
          {this.state.message && (
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '11px', lineHeight: 1.5,
              color: 'var(--ink-2)', background: 'var(--bg-soft)',
              border: '1px solid var(--line-strong)', borderRadius: '8px',
              padding: '10px 12px', marginBottom: '20px',
              textAlign: 'left', wordBreak: 'break-word',
              maxHeight: '140px', overflowY: 'auto',
            }}>
              {this.state.message}
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'var(--moss)',
              color: 'var(--card)',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 24px',
              fontFamily: 'var(--font-ui)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            Reload
          </button>

          {this.state.message && (
            <button
              onClick={() => {
                const detail = `${this.state.message}\n\n${this.state.stack}`.trim()
                void navigator.clipboard?.writeText(detail)
                  .then(() => this.setState({ copied: true }))
                  .catch(() => { /* clipboard blocked — the message is on screen anyway */ })
              }}
              style={{
                display: 'block', margin: '14px auto 0',
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)',
                textDecoration: 'underline', textUnderlineOffset: '3px',
              }}
            >
              {this.state.copied ? 'Copied' : 'Copy details'}
            </button>
          )}
        </div>
      </div>
    )
  }
}
