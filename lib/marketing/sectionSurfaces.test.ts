import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * DESIGN-V3 — the surface rules the v3 handoff was held to.
 *
 * ⚠️ THE HANDOFF ASKED FOR THINGS THE SITE HAD ALREADY DECIDED AGAINST, and
 * the decisions were hours old when it arrived. All three were confirmed with
 * the founder rather than assumed, and all three are checked here, because a
 * decision that lives only in a chat is a decision the next handoff reverses.
 *
 *  1. TWO full-bleed ink bands. `ui-patterns.md` § Dark Ground: "Exactly one
 *     near-black section per marketing page... A second dark section would
 *     make it a dark theme; don't" (ADR-008). The identical request had
 *     already been refused during the Miles teardown (W-10).
 *  2. Alternating warm bands. § Section grounds (W-08, the same day): "The
 *     marketing site does not alternate band colours", with a note saying in
 *     as many words that the proposal should not "be re-imported from the
 *     next teardown". It was, from a different source.
 *  3. A paper-grain overlay. That is W-11, killed by the SLT unanimously on
 *     2026-09-21 and marked "do not re-propose".
 */

const ROOT = path.resolve(__dirname, '../..')
const src = (f: string) =>
  fs.readFileSync(path.join(ROOT, f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const HOME = 'app/page.tsx'

describe('marketing section surfaces', () => {
  it('uses at most ONE dark ground on the homepage', () => {
    const home = src(HOME)
    const viaSection = Array.from(home.matchAll(/surface="dark"/g)).length
    const viaToken = Array.from(home.matchAll(/background:\s*'var\(--ground\)'/g)).length
    expect(viaSection + viaToken, 'a second near-black band makes it a dark theme (ADR-008)').toBeLessThanOrEqual(1)
  })

  it('does not alternate warm bands', () => {
    // W-08: --bg-soft is an inset area and an input field, not a section
    // ground. `Section surface="inset"` exists for surfaces that legitimately
    // have one; the homepage is not one of them.
    expect(src(HOME)).not.toContain('surface="inset"')
  })

  it('ships no paper-grain overlay', () => {
    for (const f of [HOME, 'app/globals.css', 'app/layout.tsx']) {
      const code = src(f)
      expect(code, `${f} reintroduces W-11`).not.toMatch(/feTurbulence|fractalNoise/)
    }
  })

  it('Section offers the three surfaces and maps them to real tokens', () => {
    const sec = src('components/marketing/Section.tsx')
    for (const s of ['page', 'inset', 'dark']) expect(sec).toContain(`${s}:`)
    for (const t of ['--bg)', '--bg-soft)', '--ground)']) expect(sec).toContain(t)
    // No hardcoded colour may enter the surface map.
    expect(sec).not.toMatch(/#[0-9a-f]{3,8}/i)
  })

  it('the hero moss wash is scoped to the hero, not a page ground', () => {
    const uses = ['app/page.tsx', 'components/marketing/HeroTrace.tsx', 'components/marketing/Section.tsx']
      .filter(f => src(f).includes('--surface-moss-wash'))
    expect(uses, 'the moss wash escaped the hero').toEqual(['components/marketing/HeroTrace.tsx'])
  })
})
