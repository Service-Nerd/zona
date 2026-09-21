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

/** Every marketing component, read from disk rather than listed — a hand-written
 *  list is the "only as wide as its list" failure this repo keeps recording. */
const MARKETING_FILES = fs.readdirSync(path.join(ROOT, 'components/marketing'))
  .filter(f => /\.tsx?$/.test(f))
  .map(f => `components/marketing/${f}`)

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

  /**
   * ⚠️ THE MOSS WASH IS GONE, AND THE CHECK BECAME THE OPPOSITE OF ITSELF.
   *
   * `--surface-moss-wash` (#E7EDE4) framed the hero evidence card for one
   * day. This test used to scope it to that one file. The founder queried it
   * on sight — "the new graph card with the green shadow: not sure the site
   * looks consistent with that" — and the reason was already written down:
   * W-08 had reduced the site to THREE grounds, each spent once, and the
   * wash was a fourth, used once, and the only tinted surface anywhere.
   *
   * The frame is now the documented inset (`--bg-soft` + a hairline,
   * `ProductStill`'s pattern). So the rule to enforce is no longer "keep it
   * scoped" but "it does not come back" — including as a fresh hex, which is
   * how a removed token usually returns.
   */
  it('no tinted surface returns to make one card special', () => {
    for (const f of ['app/globals.css', 'app/page.tsx',
                     'components/marketing/HeroTrace.tsx', 'components/marketing/Section.tsx']) {
      expect(src(f), `${f} reintroduces the moss wash token`).not.toContain('--surface-moss-wash')
    }
    // The hex itself, and its near neighbours, in any marketing component.
    for (const f of MARKETING_FILES) {
      expect(src(f), `${f} hardcodes the retired wash colour`).not.toMatch(/#E7EDE4/i)
    }
  })

  it('the hero card is framed as an INSET, the pattern ProductStill documents', () => {
    const hero = src('components/marketing/HeroTrace.tsx')
    const i = hero.indexOf("background: 'var(--bg-soft)'")
    expect(i, 'the frame should use the inset ground').toBeGreaterThan(-1)

    // ⚠️ SCOPE IT TO THE INSET'S OWN STYLE OBJECT. A file-level
    // `toContain("border: '1px solid var(--line)'")` passed with the inset's
    // border deleted, because the white card INSIDE it carries an identical
    // border two lines further down — so the check could not go red, which
    // deleting the border proved. Third substring-bias miss today; the fix
    // is always to bound the region rather than to grep the file.
    const frame = hero.slice(i, hero.indexOf('}}', i))
    expect(frame, 'an inset carries exactly one hairline of its own')
      .toContain("border: '1px solid var(--line)'")
  })
})
