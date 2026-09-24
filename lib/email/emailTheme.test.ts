/**
 * The email palette cannot drift from the app's.
 *
 * 🔴 WHY THIS IS A TEST AND NOT A COMMENT. `--surface-moss-wash` was legal in
 * `globals.css` and forbidden by a rule in `ui-patterns.md`; neither file was
 * wrong, they had never met, and it shipped and was deleted within eight hours.
 * Email is the same shape of gap: a mail client cannot resolve `var(--bg)`, so
 * the value MUST be inlined, and an inlined value is one nobody updates when the
 * token moves.
 *
 * This reads both and asserts they are equal, which is the only thing that makes
 * `EMAIL_COLORS` a mirror rather than a second palette.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { EMAIL_COLORS } from './emailTheme'

const CSS = readFileSync('app/globals.css', 'utf8')

/** The token each email colour mirrors. */
const MIRRORS: Record<keyof typeof EMAIL_COLORS, string> = {
  bg: '--bg', card: '--card', ink: '--ink', ink2: '--ink-2', mute: '--mute', moss: '--moss',
}

function tokenValue(name: string): string | null {
  // Bound the region: the FIRST :root declaration of this exact token, not any
  // line that happens to contain the string. `--ink` is a prefix of `--ink-2`.
  const m = CSS.match(new RegExp(`${name}\\s*:\\s*(#[0-9A-Fa-f]{3,8})\\s*;`))
  return m ? m[1]!.toUpperCase() : null
}

describe('EMAIL_COLORS mirrors globals.css', () => {
  it('every email colour resolves to a real token in globals.css', () => {
    for (const [key, token] of Object.entries(MIRRORS)) {
      expect(tokenValue(token), `${token} not found in globals.css`).not.toBeNull()
    }
  })

  it('and every value is EQUAL to the token it mirrors', () => {
    const drift: string[] = []
    for (const [key, token] of Object.entries(MIRRORS)) {
      const css = tokenValue(token)
      const email = EMAIL_COLORS[key as keyof typeof EMAIL_COLORS].toUpperCase()
      if (css && css !== email) drift.push(`${key}: email ${email} vs ${token} ${css}`)
    }
    expect(drift, 'the email palette has drifted from the app palette').toEqual([])
  })

  it('the mirror map covers every colour — a new one cannot skip the check', () => {
    expect(Object.keys(MIRRORS).sort()).toEqual(Object.keys(EMAIL_COLORS).sort())
  })
})
