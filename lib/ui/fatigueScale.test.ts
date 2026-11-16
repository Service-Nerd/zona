import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { FATIGUE_HUE } from '@/components/shared/FatigueChips'
import { FATIGUE_TAGS } from '@/lib/coaching/completionVocab'

/**
 * FATIGUE-CHIP-DUPLICATE-01 (Design Board 2026-11-16) — one fatigue scale, and it stays a SCALE.
 *
 * 📐 The item said the row *"exists twice"* and that *"both render identically today"*. Re-measured:
 * **six surfaces, four different scales.** The divergence was visible, not theoretical — one
 * surface rendered Fresh and Fine in the *same* colour, and two used `--danger`, which the design
 * system forbids in the training UI.
 *
 * ⚠️ The arms below are PROPERTIES, not a snapshot of today's four tokens. A snapshot would have
 * passed on every one of the four broken scales.
 */

/** `--token: #RRGGBB;` out of globals.css, following one level of aliasing. */
function resolve(token: string): string {
  const css = readFileSync('app/globals.css', 'utf8')
  let name = /^var\((--[a-z0-9-]+)\)$/.exec(token)?.[1]
  for (let hop = 0; hop < 4 && name; hop++) {
    const m = new RegExp(`^\\s*${name}\\s*:\\s*([^;]+);`, 'm').exec(css)
    expect(m, `globals.css declares no ${name}`).toBeTruthy()
    const v = m![1].trim()
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase()
    name = /^var\((--[a-z0-9-]+)\)$/.exec(v)?.[1]
  }
  throw new Error(`could not resolve ${token} to a hex in 4 hops`)
}

const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
function lab(h: string): [number, number, number] {
  const [r, g, b] = hex(h).map(lin)
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116)
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
}
const deltaE = (a: string, b: string) => {
  const A = lab(a), B = lab(b)
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2])
}

describe('FATIGUE-CHIP-DUPLICATE-01 — the scale', () => {
  it('covers every tag the vocabulary owner declares, and nothing else', () => {
    // Derived from `FATIGUE_TAGS`, never a typed-out list: a new tag must get a hue or fail here.
    expect(Object.keys(FATIGUE_HUE).sort()).toEqual([...FATIGUE_TAGS].sort())
  })

  it('🔴 is a SCALE, not a list: every adjacent step is perceptibly distinct', () => {
    // The arm that would have caught `SessionPopupInner:1585`, which rendered Fresh and Fine in the
    // SAME token (ΔE 0.0) — exactly what Silvanto refused on 2026-10-05: *"a scale rendered in one
    // colour is a list."* The floor is 20, between the two scales that were wrong on this
    // (B's two greens at 9.8, C at 0.0) and the two that were not (30.4 and 43.2). It is a
    // perceptual threshold, not a tuned number: ~2.3 is just-noticeable and under ~10 a hue reads
    // as a shade of its neighbour.
    const steps = FATIGUE_TAGS.slice(1).map((tag, i) => {
      const prev = FATIGUE_TAGS[i]
      return { from: prev, to: tag, dE: deltaE(resolve(FATIGUE_HUE[prev]), resolve(FATIGUE_HUE[tag])) }
    })
    for (const s of steps) {
      expect(s.dE, `${s.from} → ${s.to} is ΔE ${s.dE.toFixed(1)}: the two steps read as one colour`)
        .toBeGreaterThan(20)
    }
  })

  it('🔴 never uses --danger: red is for form and error states, never the training UI', () => {
    // Two of the four scales used it for "Wrecked". `SESSION-INTERVALS-HUE-01` (2026-10-22) added
    // `--s-inter` as "a coral, distinct from --danger" for precisely this kind of use.
    for (const [tag, token] of Object.entries(FATIGUE_HUE)) {
      expect(token, `${tag} is painted in the error red`).not.toMatch(/--danger/)
    }
  })

  it('every hue resolves to a real colour in globals.css', () => {
    for (const [tag, token] of Object.entries(FATIGUE_HUE)) {
      expect(resolve(token), `${tag}`).toMatch(/^#[0-9A-F]{6}$/)
    }
  })
})

describe('FATIGUE-CHIP-DUPLICATE-01 — the mirrors', () => {
  it('🔴 the OG route’s resolved hex matches the owner, token for token', () => {
    // `next/og` cannot read CSS variables, so that route is allowed to hold hex. Being a hand-kept
    // mirror under a comment saying "mirrors the chip palette" is how the scale reached four
    // versions, so the mirror is CHECKED rather than asked nicely.
    const src = readFileSync('app/api/og/session-complete-card/route.tsx', 'utf8')
    const block = src.slice(src.indexOf('const FATIGUE_COLOURS'))
    for (const tag of FATIGUE_TAGS) {
      const m = new RegExp(`${tag}:\\s*'(#[0-9a-fA-F]{6})'`).exec(block)
      expect(m, `the OG route has no colour for ${tag}`).toBeTruthy()
      expect(m![1].toUpperCase(), `OG ${tag} disagrees with ${FATIGUE_HUE[tag]}`)
        .toBe(resolve(FATIGUE_HUE[tag]))
    }
  })

  // Comments out before the sweep: the owner and the mirrors all EXPLAIN the retired scales in
  // prose that names the tags. Quote-aware, so a `//` inside a string is not a comment.
  const stripComments = (s: string) => {
      let out = '', q: string | null = null
      for (let i = 0; i < s.length; i++) {
        const c = s[i]
        if (q) { out += c; if (c === '\\') { out += s[++i] ?? ''; continue } if (c === q) q = null; continue }
        if (c === '"' || c === "'" || c === '`') { q = c; out += c; continue }
        if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; out += '\n'; continue }
        if (c === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); i = e === -1 ? s.length : e + 1; continue }
        out += c
      }
    return out
  }

  it('🔴 no file hand-writes a fatigue tag to a colour — there is one owner', () => {
    const EXEMPT = new Set([
      'components/shared/FatigueChips.tsx',             // the owner
      'app/api/og/session-complete-card/route.tsx',      // the resolved mirror, held by the arm above
      'lib/ui/fatigueScale.test.ts',                     // this file: a detector catalogues what it detects
    ])
    const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean)
      .filter(f => /^(app|components|lib)\/.*\.tsx?$/.test(f))
      .filter(f => !EXEMPT.has(f))
    // A tag name sitting beside a colour token or a hex, in code.
    const offenders = files.filter(f => {
      const code = stripComments(readFileSync(f, 'utf8'))
      return FATIGUE_TAGS.some(t =>
        new RegExp(`['"]${t}['"][^\\n]{0,80}(var\\(--|#[0-9a-fA-F]{6})`).test(code)
        || new RegExp(`(var\\(--|#[0-9a-fA-F]{6})[^\\n]{0,80}['"]${t}['"]`).test(code))
    })
    expect(offenders, 'the scale has one owner: import FATIGUE_HUE from components/shared/FatigueChips')
      .toEqual([])
  })

  it('the sweep population is real — an empty one would pass the arm above', () => {
    expect(execSync('git ls-files', { encoding: 'utf8' }).split('\n')
      .filter(f => /^(app|components|lib)\/.*\.tsx?$/.test(f)).length).toBeGreaterThan(300)
  })

  it('the comment stripper works, and it is NOT load-bearing today — both stated', () => {
    // 🔴 THIS ARM'S TITLE USED TO SAY *"and the stripper works"* AND ITS BODY ONLY COUNTED FILES.
    // A hollow claim in a test name, found by mutating the stripper and watching nothing go red.
    //
    // 📐 Measured 2026-11-16: with comments left IN, **0 of 376 non-exempt files** match the
    // pattern — so stripping changes no verdict today and the sweep would pass without it. It is
    // kept, and tested here directly, because the shape it defends against bit FOUR separate
    // guards on this one day (`HOOK-RGBA-COMMENTS-01`): the first person to write *"we used to
    // paint Wrecked `--danger` here"* in a non-exempt file would otherwise be reported as the
    // defect. **Defence with a test is not the same as defence nobody has run.**
    expect(stripComments("const a = 'Fresh' // was var(--moss)")).not.toContain('var(--moss)')
    expect(stripComments("/* 'Wrecked' used var(--danger) */ const b = 1")).not.toContain('--danger')
    expect(stripComments("const u = 'Fresh' /* x */"), 'code survives').toContain("'Fresh'")
    expect(stripComments("const u = 'http://x' // gone"), 'a // inside a string is not a comment')
      .toContain('http://x')
  })
})
