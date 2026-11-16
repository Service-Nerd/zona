import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * SITE-BAND-RHYTHM-01 (Design Board 2026-11-16) — a free-standing band takes its rhythm from the
 * token family, never from a typed number.
 *
 * 📐 **THE ITEM SAID "16 BAND VERTICAL RHYTHMS ARE HAND-TYPED". MEASURED: 21 SITES, AND 20 OF THEM
 * ARE CORRECT.** Every one of the 21 passes `rhythm="none"` **explicitly** — not one takes the
 * default and discards it — so they are a declared opt-out, not drift. And they opt out for good
 * reasons: 16 are sub-band pads (4–28px, where `--sect-y`'s 56px floor would be wrong), and three
 * more are the inside of a **hairline-ruled** block or a **card**, which is padding, not rhythm.
 *
 * 🔴 **EXACTLY ONE WAS A FREE-STANDING BAND TYPING A VALUE THE TOKEN OWNS**: the homepage's dark
 * closing band, at `112px` — **`--sect-y-close`'s own clamp MAXIMUM**, from a token whose
 * declaration in `globals.css` names that very band (*"the ONE dark band, deliberately heavier"*).
 * Frozen, it never shrank: measured at 375px it padded **112px where the token resolves to 72px**,
 * a **659px** band the rhythm system intends to be **579px**.
 *
 * ⚠️ So this file does NOT sweep `rhythm="none"`. A gate that forbade it would fire on 20 correct
 * decisions, which this repo records as how a guard gets switched off.
 */

const tracked = (): string[] =>
  execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter(f => /^(app|components)\/.*\.tsx$/.test(f))
    .filter(f => !f.includes('.test.'))

/** Every `<Section …>` opening tag, bounded at its own depth-0 `>`. Never a line grep. */
function sectionTags(src: string): string[] {
  const out: string[] = []
  const re = /<Section\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    let depth = 0, q: string | null = null
    for (let i = m.index; i < src.length; i++) {
      const c = src[i]
      if (q) { if (c === q) q = null; continue }
      if (c === '"' || c === "'" || c === '`') { q = c; continue }
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) { out.push(src.slice(m.index, i + 1)); break }
    }
  }
  return out
}

describe('SITE-BAND-RHYTHM-01 — the dark band is on its token', () => {
  const HOME = readFileSync('app/page.tsx', 'utf8')

  it('🔴 the ONE dark band declares rhythm="close" and types no padding', () => {
    const dark = sectionTags(HOME).filter(t => /surface="dark"/.test(t))
    // Vacuity guard: ADR-008 allows exactly one near-black band per page, and if it stops being
    // found every assertion below passes on an empty array.
    expect(dark.length, 'the homepage has no dark band; this gate is pointed at nothing').toBe(1)
    expect(dark[0], 'the dark band opted out of its own token again').toContain('rhythm="close"')
    expect(dark[0], 'the dark band types a padding, which freezes the clamp').not.toMatch(/padding/)
  })

  it('🔴 and it may not type the token’s clamp maximum, which is what it did', () => {
    // 112px is `--sect-y-close`'s max, so the typed value was only ever correct at >= 1244px and
    // was 40px too tall at 375px, top and bottom.
    const dark = sectionTags(HOME).filter(t => /surface="dark"/.test(t))
    expect(dark[0]).not.toMatch(/112px/)
  })

  it('the token family still declares the three rhythms, and close is the heaviest', () => {
    // If a rhythm is renamed or dropped, `rhythm="close"` silently falls back to the default pad.
    const css = readFileSync('app/globals.css', 'utf8')
    const px = (name: string) => {
      const m = new RegExp(`${name}:\\s*clamp\\((\\d+)px,[^,]+,\\s*(\\d+)px\\)`).exec(css)
      expect(m, `${name} is not a clamp() in globals.css`).toBeTruthy()
      return { min: Number(m![1]), max: Number(m![2]) }
    }
    const hero = px('--sect-y-hero'), normal = px('--sect-y'), close = px('--sect-y-close')
    expect(close.min).toBeGreaterThan(normal.min)
    expect(close.max).toBeGreaterThan(normal.max)
    expect(normal.min).toBeGreaterThan(hero.min)
    // The measured numbers behind the ruling, so a silent re-tune is visible here.
    expect([hero.min, normal.min, close.min]).toEqual([32, 56, 72])
    expect([hero.max, normal.max, close.max]).toEqual([48, 80, 112])
  })
})

describe('SITE-BAND-RHYTHM-01 — what this gate deliberately does NOT forbid', () => {
  it('🔑 `rhythm="none"` stays legal, and the population proves it is used correctly', () => {
    // Forbidding the prop would fire on every one of them. This arm asserts the SHAPE of the
    // population instead, so nobody re-proposes the sweep the item wanted. An opt-out that types a
    // padding is legitimate on any of three grounds:
    //
    //   1. 🔑 IT ALREADY USES THE TOKENS. `rhythm` only offers a SYMMETRIC top/bottom, so a band
    //      wanting token-top and zero-bottom must opt out and spell it: `var(--sect-y) 24px 0`.
    //      **25 sites do this and they are the rhythm system, not a bypass of it.** ⚠️ My first
    //      classifier missed this and reported all 25 as offenders — the gate was wrong, not the
    //      tree, and a looser rule here is the CORRECT population rather than a retreat to green.
    //   2. It is sub-band (max < `--sect-y`'s 56px floor) — a 4–28px stack, where the band scale
    //      would be the wrong family.
    //   3. It is the inside of a hairline-ruled block or a card, where the padding is not rhythm.
    const offenders: string[] = []
    let optOuts = 0
    for (const f of tracked()) {
      const src = readFileSync(f, 'utf8')
      for (const tag of sectionTags(src)) {
        if (!/rhythm="none"/.test(tag) || !/padding/.test(tag)) continue
        optOuts++
        // ⚠️ `Array.from`, not a spread. `[...tag.matchAll(…)]` is the `--downlevelIteration`
        // class CLAUDE.md records for `Set`, and it passes vitest while failing `tsc` — the
        // second time today that exact divergence has bitten.
        const px = Array.from(tag.matchAll(/(\d+)px/g)).map(x => Number(x[1])).filter(v => v !== 24)
        const tokenValued = /var\(--(sect-y|space-)/.test(tag)
        const subBand = px.length > 0 && Math.max(...px) < 56
        const delimited = /border(Top|Bottom)|background: 'var\(--card\)'/.test(tag)
        if (!tokenValued && !subBand && !delimited) offenders.push(`${f}: ${tag.replace(/\s+/g, ' ').slice(0, 90)}`)
      }
    }
    expect(optOuts, 'no opt-out sites found; the scanner is broken, not the tree').toBeGreaterThan(15)
    expect(offenders,
      'a free-standing band is typing its own rhythm. Use the `rhythm` prop: hero / normal / close.')
      .toEqual([])
  })
})
