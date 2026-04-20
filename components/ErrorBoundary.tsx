'use client'

import React from 'react'

interface Props { children: React.ReactNode }
interface State { hasError: boolean; message: string }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Zona] Uncaught error:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        data-theme="dark"
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
          <div style={{ fontSize: '32px', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '24px' }}>
            Zona
          </div>
          <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.3px' }}>
            Something went wrong.
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '32px', lineHeight: 1.6, fontFamily: 'var(--font-ui)' }}>
            Not ideal. Try refreshing — it usually sorts itself out.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'var(--accent)',
              color: 'var(--zona-navy)',
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
        </div>
      </div>
    )
  }
}
