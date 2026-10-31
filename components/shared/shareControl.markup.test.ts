// SHARE-ICON-01 — every share is the one icon owner, never a labelled button (Design Board 2026-10-31,
// mockups approved by the founder the same day). The Coach share was a 52px full-width moss primary,
// the loudest control on the screen; the run surfaces carried a soft "Share" pill.
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ShareControl, { shareStatusText } from './ShareControl'

function files(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) files(p, out)
    else if (/\.tsx$/.test(p) && !/\.test\./.test(p)) out.push(p)
  }
  return out
}

/** A `<Button …>` whose text is a share label (Share, Share this week, Preparing…). Bounded to the
 *  element, so a comment or a string elsewhere in the file cannot satisfy or trip it. */
export function shareLabelledButtons(src: string): string[] {
  return Array.from(src.matchAll(/<Button\b[^>]*>([\s\S]*?)<\/Button>/g))
    .map(m => m[1]!)
    .filter(body => /\bShare\b|Preparing…/.test(body) && !/Share your week/.test(body))
}

describe('ShareControl', () => {
  const html = renderToStaticMarkup(React.createElement(ShareControl, { ariaLabel: 'Share this week', share: async () => {} }))

  it('🔴 is a 44px circle icon button with a name, and no visible label', () => {
    const btn = html.match(/<button[^>]*>/)![0]
    expect(btn).toContain('icon-btn--circle')
    expect(btn).toContain('icon-btn--regular')
    expect(btn).toContain('aria-label="Share this week"')
    expect(html).not.toMatch(/>Share</)
  })

  it('carries an always-mounted polite live region for the status words', () => {
    expect(html).toMatch(/<span aria-live="polite"[^>]*><\/span>/)
  })

  it('status: saved and failures speak, a dismissed sheet and a success stay silent', () => {
    expect(shareStatusText({ kind: 'downloaded' })).toBe('Saved')
    expect(shareStatusText({ kind: 'error', message: '' })).toBe("Couldn't share. Try again.")
    expect(shareStatusText({ kind: 'error', message: 'Need 2+ runs' })).toBe('Need 2+ runs')
    expect(shareStatusText({ kind: 'cancelled' })).toBeNull()
    expect(shareStatusText({ kind: 'success' })).toBeNull()
  })
})

describe('🔴 no share button outside the owner', () => {
  const all = [...files('app'), ...files('components')]

  it('scans a real corpus', () => { expect(all.length).toBeGreaterThan(100) })

  it('no `<Button>` anywhere is labelled Share', () => {
    const bad = all.flatMap(f => shareLabelledButtons(readFileSync(f, 'utf8')).map(b => `${f}: ${b.trim().slice(0, 60)}`))
    expect(bad).toEqual([])
  })

  it('the detector catches the shapes that shipped', () => {
    expect(shareLabelledButtons(`<Button variant="primary" fullWidth onClick={x}>{status ?? (busy ? 'Preparing…' : 'Share')}</Button>`)).toHaveLength(1)
    expect(shareLabelledButtons(`<Button variant="soft" onClick={x}>Share</Button>`)).toHaveLength(1)
    expect(shareLabelledButtons(`<Button onClick={up}>Share your week</Button>`)).toHaveLength(0)
  })

  it('both share call sites render the owner', () => {
    expect(readFileSync('components/dashboard/SaveImageButton.tsx', 'utf8')).toContain('<ShareControl ariaLabel="Share this run"')
    expect(readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')).toContain('<ShareControl ariaLabel="Share this week"')
  })
})
