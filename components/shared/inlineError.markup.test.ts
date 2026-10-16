import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { InlineError } from './InlineError'

/**
 * INLINE-ERROR-OWNER-01 (Design Board, 2026-10-16) — one owner for the inline error line.
 * Six hand-written copies had split on colour, and plain `--danger` fails AA on two of the
 * four grounds the line sits on (4.36:1 `--bg-soft`, 4.46:1 `--warn-bg`).
 */
const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(React.createElement(InlineError, { children: 'Could not save that change. Try again.', ...props } as never))

describe('InlineError renders the error line', () => {
  it('announced, 14px, the error-TEXT colour, left by default', () => {
    const html = render({})
    expect(html).toContain('role="alert"')
    expect(html).toContain('font-size:14px')
    expect(html).toContain('color:var(--danger-strong)')
    expect(html).toContain('text-align:left')
  })
  it('centres when asked, and spacing passes through', () => {
    const html = render({ align: 'center', style: { marginTop: '8px' } })
    expect(html).toContain('text-align:center')
    expect(html).toContain('margin-top:8px')
  })
})

describe('🔴 no screen hand-writes the error line again', () => {
  // Every tracked .tsx in app/ and components/, comments stripped. The two owners are
  // exempt by name: InlineError itself, and FieldText (FieldReadback's VALUE-slot refusal,
  // ruled distinct). WaitlistForm is a pre-launch component, unmounted anywhere.
  const EXEMPT = new Set([
    'components/shared/InlineError.tsx',
    'components/shared/FieldText.tsx',
    'components/marketing/WaitlistForm.tsx',
  ])
  const files = execSync('git ls-files app components', { encoding: 'utf8' }).split('\n')
    .filter(f => /\.tsx$/.test(f) && !f.includes('.test.') && !EXEMPT.has(f))

  it('the population is real', () => {
    expect(files.length).toBeGreaterThan(100)
  })
  it('no file renders its own role="alert"', () => {
    const offenders = files.filter(f => {
      const s = readFileSync(f, 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
      return /role=["']alert["']/.test(s)
    })
    expect(offenders, 'use <InlineError> from components/shared/InlineError').toEqual([])
  })
})
