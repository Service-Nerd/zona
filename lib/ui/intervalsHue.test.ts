import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 🔴 SESSION-INTERVALS-HUE-01 (Design Board 2026-10-22, 6t-f). `--s-inter` was `#B84545`, the `--danger` value, with
 * `--coral` an alias, against ux-principles' *"No red in the training UI… coral for high-intensity"*. The token and the
 * rule lived in different files and had never met; this test is where they meet. The share image hardcodes resolved
 * hex (next/og cannot read CSS variables), so it is held to the token here too.
 */
const css = readFileSync('app/globals.css', 'utf8')
const token = (name: string): string => {
  const m = new RegExp(`\\n\\s*${name}:\\s*([^;]+);`).exec(css)
  if (!m) throw new Error(`${name} not declared`)
  const v = m[1].trim()
  const ref = /^var\((--[a-z0-9-]+)\)$/.exec(v)
  return ref ? token(ref[1]) : v.toUpperCase()
}

describe('the intervals hue is a coral, never the error red', () => {
  it('🔴 --s-inter is not --danger (and --coral, which aliases it, follows)', () => {
    expect(token('--s-inter')).toBe('#D4705A')
    expect(token('--s-inter')).not.toBe(token('--danger'))
    expect(token('--coral')).toBe(token('--s-inter'))
    expect(token('--session-intervals')).toBe(token('--s-inter'))
  })
  it('🔴 the share image\'s resolved Zone 5 and Wrecked match the token', () => {
    const og = readFileSync('app/api/og/session-complete-card/route.tsx', 'utf8')
    const zones = /const ZONE_COLOURS = \[([^\]]+)\]/.exec(og)![1].split(',').map(x => x.trim().replace(/'/g, '').toUpperCase())
    expect(zones[4]).toBe(token('--s-inter'))
    expect(/Wrecked:\s*'(#[0-9A-Fa-f]{6})'/.exec(og)![1].toUpperCase()).toBe(token('--s-inter'))
  })
  it('🔴 the delete-account screen, a destructive context, uses --danger and never the session colour', () => {
    const me = readFileSync('components/dashboard/MeScreen.tsx', 'utf8')
    const i = me.indexOf('Your sessions, plan, and profile will be permanently removed.')
    const seg = me.slice(i, me.indexOf('DESTRUCTIVE-WIRING-01', i))
    expect(seg).not.toMatch(/var\(--coral\)|var\(--session-intervals/)
    expect(seg).toMatch(/var\(--danger\)/)
  })
})
