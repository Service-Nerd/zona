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
import { EMAIL_COLORS, EMAIL_TYPE, emailWordmark } from './emailTheme'

const CSS = readFileSync('app/globals.css', 'utf8')

/** The token each email colour mirrors. */
const MIRRORS: Record<keyof typeof EMAIL_COLORS, string> = {
  bg: '--bg', card: '--card', ink: '--ink', ink2: '--ink-2', mute: '--mute', moss: '--moss',
  // BUTTON-COMPONENT-01 — the CTA fill and its border. This map is why they had
  // to be real tokens rather than two more hexes typed into the email layer.
  mossStrong: '--moss-strong', mossDeep: '--moss-deep',
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

describe('EMAIL_TYPE mirrors the documented scale', () => {
  const SCALE: Record<keyof typeof EMAIL_TYPE, string | null> = {
    micro: '--fs-micro', eyebrow: '--fs-eyebrow', caption: '--fs-caption',
    body: '--fs-body', lead: '--fs-lead', heading: '--fs-h4',
    metric: '--fs-metric', metricLg: '--fs-metric-lg',
    // The wordmark's brand size comes from Wordmark.tsx's SIZE_PX, not globals.
    wordmark: null,
  }

  function px(token: string): number | null {
    const m = CSS.match(new RegExp(`${token}\\s*:\\s*(\\d+)px\\s*;`))
    return m ? Number(m[1]) : null
  }

  it('every step resolves to a real token', () => {
    for (const [key, token] of Object.entries(SCALE)) {
      if (!token) continue
      expect(px(token), `${token} not found in globals.css`).not.toBeNull()
    }
  })

  it('and EQUALS it — the scale cannot drift from the app', () => {
    const drift: string[] = []
    for (const [key, token] of Object.entries(SCALE)) {
      if (!token) continue
      const css = px(token)
      const email = EMAIL_TYPE[key as keyof typeof EMAIL_TYPE]
      if (css !== null && css !== email) drift.push(`${key}: email ${email}px vs ${token} ${css}px`)
    }
    expect(drift, 'the email type scale has drifted from the app').toEqual([])
  })

  it('the wordmark matches its spec, not a tracked-caps label', () => {
    // 🔴 Silvanto's veto, mechanised. The five counts it was regressed on.
    const mark = emailWordmark('Zonna')
    expect(mark, 'weight').toContain('font-weight:800')
    expect(mark, 'tracking must be NEGATIVE').toContain('letter-spacing:-0.03em')
    expect(mark, 'never uppercased').not.toContain('text-transform:uppercase')
    expect(mark, 'the name as written').toContain('>Zo')
    // The NN-moss device: the double letter, and ONLY it, in moss.
    expect(mark).toContain(`<span style="color:${EMAIL_COLORS.moss};">nn</span>`)
  })

  it('the double letter is DERIVED, so a rename carries the device', () => {
    expect(emailWordmark('Vetra')).not.toContain(EMAIL_COLORS.moss)   // no double letter
    expect(emailWordmark('Rossi')).toContain(`<span style="color:${EMAIL_COLORS.moss};">ss</span>`)
  })

  it('no email template hardcodes a font size', () => {
    // The whole finding: 12 of 20 declarations were the same 16px because sizes
    // were typed rather than chosen.
    const tpl = readFileSync('lib/email/trialEmailTemplates.ts', 'utf8')
    const literals = tpl.match(/font-size:\d+px/g) ?? []
    expect(literals, `hardcoded sizes: ${literals.join(', ')}`).toEqual([])
  })
})
