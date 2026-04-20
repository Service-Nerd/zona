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
    console.error('[ZONA] Uncaught error:', error, info.componentStack)
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
          background: '#0B132B',
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        <div style={{ width: '100%', maxWidth: '320px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: 500, letterSpacing: '0.08em', color: '#5BC0BE', marginBottom: '24px' }}>
            ZONA
          </div>
          <div style={{ fontSize: '16px', fontWeight: 500, color: '#F7F9FB', marginBottom: '8px', letterSpacing: '-0.3px' }}>
            Something went wrong.
          </div>
          <div style={{ fontSize: '13px', color: '#3A506B', marginBottom: '32px', lineHeight: 1.6, fontFamily: "'Inter', sans-serif" }}>
            Not ideal. Try refreshing — it usually sorts itself out.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#5BC0BE',
              color: '#0B132B',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 24px',
              fontFamily: "'Inter', sans-serif",
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
