import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { EmptyState } from './EmptyState'

/**
 * EMPTY-STATE-OWNER-01 (Design Board, 2026-10-16) — ui-patterns.md § 8, written once.
 * Two hand-written copies already disagreed on alignment when this was ruled.
 */
const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(React.createElement(EmptyState, { title: 'No prior plans.', ...props } as never))

describe('EmptyState is § 8', () => {
  it('heading 600 1rem --ink, body 400 0.875rem --mute, centred on both axes', () => {
    const html = render({ body: 'This is the first one.' })
    expect(html).toContain('font-size:1rem;font-weight:600;color:var(--ink)')
    expect(html).toContain('font-size:0.875rem;font-weight:400;color:var(--mute)')
    expect(html).toContain('justify-content:center')
    expect(html).toContain('text-align:center')
  })
  it('renders no action and no body unless given (§ 8: no button without an action)', () => {
    const html = render({})
    expect(html).not.toContain('<button')
    expect(html).not.toContain('var(--mute)')
  })
  it('fill makes it a whole-screen state on the page ground', () => {
    expect(render({ fill: true })).toContain('min-height:100dvh')
  })
})

describe('🔴 no screen hand-writes § 8 again', () => {
  const files = execSync('git ls-files app components', { encoding: 'utf8' }).split('\n')
    .filter(f => /\.tsx$/.test(f) && !f.includes('.test.') && f !== 'components/shared/EmptyState.tsx')
  it('the population is real', () => { expect(files.length).toBeGreaterThan(100) })
  it('no 600/--ink heading at 1rem or 16px is followed by a --mute body at 0.875rem or 14px', () => {
    const offenders: string[] = []
    for (const f of files) {
      const s = readFileSync(f, 'utf8')
      for (const m of Array.from(s.matchAll(/fontSize:\s*'(1rem|16px)',\s*fontWeight:\s*600,\s*color:\s*'var\(--ink\)'/g))) {
        const win = s.slice(m.index! + m[0].length, m.index! + m[0].length + 500)
        if (/fontSize:\s*'(0\.875rem|14px)'[^}]*color:\s*'var\(--mute\)'|color:\s*'var\(--mute\)'[^}]*fontSize:\s*'(0\.875rem|14px)'/.test(win)) {
          offenders.push(`${f}:${s.slice(0, m.index).split('\n').length}`)
        }
      }
    }
    expect(offenders, 'use <EmptyState> from components/shared/EmptyState').toEqual([])
  })
})
