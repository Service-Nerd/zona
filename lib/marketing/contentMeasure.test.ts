// SITE-MEASURE-THIRD-02 — the marketing site has TWO content measures, and it
// nests the narrow one rather than centring it.
//
// This gate exists because `SITE-MEASURE-THIRD-01` was RULED and never
// EXECUTED. The register retired the 760px third measure on 2026-10-01 — "it
// matched no rule and existed because somebody typed a number" — and on
// 2026-11-05 the number was still declared as `const SECTION_MAX = 760` in
// SEVEN files: /about, /charity-runners, /plans, /pricing, ArticlePage,
// ArticleHub and PlanPage. Only `app/page.tsx` had been converted.
//
// 🔴 AND IT WAS NOT ONLY A THIRD MEASURE. Every one of those 34 call sites
// wrote `maxWidth: SECTION_MAX, margin: '0 auto'` — a CENTRED narrow box
// inside the viewport — which is the exact defect the homepage ruling fixed:
//
//     "One left edge: a narrower measure narrows the box, it does not move
//      it. The cause was one property: `margin: '0 auto'` on a 720px box
//      inside an 1100px frame pushes it 190px inboard."
//
// The header and footer sit at `SITE_WIDTH = 1100` centred, so on every page
// except the homepage the content's left edge sat ~170px inboard of the
// chrome's. That ruling is recorded 🟢 SHIPPED. It was shipped on one file of
// eight.
//
// ⚠️ A RETIRED NUMBER THAT NOBODY DELETED IS A RULING THAT DID NOT HAPPEN, and
// nothing in 47 marketing gate files could see it. Hence a check, not a note.
//
// SCOPE, stated so it is not mistaken for more than it is. This governs
// SECTION-LEVEL measures: the box that decides where a band's content starts.
// It deliberately does NOT govern sub-column widths (a paragraph capped at
// 620, a heading wrapped at 520) — the register says "720px for prose stays…
// the measure was never the defect", and sweeping those would be a new ruling
// rather than the execution of an old one. That sprawl is filed as
// `SITE-SUBMEASURE-SPRAWL-01`.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { comparisonArticles, articlePath } from './articles'

const ROOT = path.resolve(__dirname, '../..')

/** 🔴 COMMENTS ARE NOT CODE. A comment recording the REMOVAL of 760
 *  necessarily quotes 760, so a naive scan fails the paragraph documenting the
 *  fix — the trap `typeScale.test.ts` and `spacingScale.test.ts` each hit, and
 *  the pre-commit hook hit twice. Line numbers are preserved so a failure can
 *  still be located. */
function strip(src: string): string {
  let inBlock = false
  return src.split('\n').map(raw => {
    const s = raw.trim()
    const was = inBlock
    const opens = (s.match(/\/\*/g) ?? []).length
    const closes = (s.match(/\*\//g) ?? []).length
    if (opens > closes) inBlock = true
    else if (closes > 0 && closes >= opens) inBlock = false
    const isComment = was || s.startsWith('//') || s.startsWith('*') || s.startsWith('/*') || s.startsWith('{/*')
    return isComment ? '' : raw
  }).join('\n')
}

/** ⚠️ DERIVED, NOT LISTED, for both halves. The comparison and guide shim
 *  pages come from the catalogue — `noEmDash` already does this and
 *  `typeScale` does not, which is how page 3 went unlisted for two months —
 *  and `components/marketing` is globbed, so a new frame cannot arrive
 *  outside the population. */
const PAGES = [
  'app/page.tsx', 'app/plans/page.tsx', 'app/pricing/page.tsx', 'app/about/page.tsx',
  'app/charity-runners/page.tsx', 'app/support/page.tsx', 'app/privacy/page.tsx',
  'app/terms/page.tsx', 'app/guides/page.tsx', 'app/comparisons/page.tsx',
  'app/plans/[slug]/page.tsx', 'app/guides/[slug]/page.tsx',
  ...comparisonArticles().map(a => `app${articlePath(a)}/page.tsx`),
].filter(f => fs.existsSync(path.join(ROOT, f)))

const COMPONENTS = fs.readdirSync(path.join(ROOT, 'components/marketing'))
  .filter(f => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
  .map(f => `components/marketing/${f}`)

/** `Section.tsx` is the OWNER of the nesting and is therefore the one file
 *  allowed to express it. Exempting the owner is not a hole: the owner is what
 *  every other surface is required to go through. */
const OWNER = 'components/marketing/Section.tsx'
const SURFACES = [...PAGES, ...COMPONENTS]

const read = (f: string) => strip(fs.readFileSync(path.join(ROOT, f), 'utf8'))

describe('SITE-MEASURE-THIRD-02 — two measures, nested not centred', () => {
  it('is reading a real, non-empty population', () => {
    // Guards the guard. If the file list or the comment stripper ever empties,
    // every arm below passes vacuously — which is how three checks in this repo
    // were silently dead on their first write.
    expect(SURFACES.length).toBeGreaterThan(20)
    expect(SURFACES).toContain(OWNER)
    const total = SURFACES.map(read).join('\n')
    expect(total.length).toBeGreaterThan(50_000)
    expect(total).toMatch(/maxWidth/)
  })

  it('the two measures exist in globals.css at the ruled values', () => {
    const css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8')
    expect(css).toMatch(/--measure-page:\s*1100px/)
    expect(css).toMatch(/--measure-read:\s*720px/)
  })

  it('declares the retired 760px third measure nowhere', () => {
    const offenders = SURFACES.flatMap(f =>
      read(f).split('\n')
        .map((l, i) => ({ f, n: i + 1, l }))
        .filter(x => /maxWidth:\s*'?760/.test(x.l) || /SECTION_MAX/.test(x.l))
        .map(x => `  ${x.f}:${x.n}  ${x.l.trim().slice(0, 110)}`),
    )
    expect(
      offenders,
      'SITE-MEASURE-THIRD-01 RETIRED the 760px measure. Use `Section width="read"`, '
      + 'which nests --measure-read inside the page frame:\n' + offenders.join('\n'),
    ).toEqual([])
  })

  it('never centres the read measure — a narrower box must not move the left edge', () => {
    // THE DEFECT, EXPRESSED AS A SHAPE. `maxWidth` at the reading width on the
    // same declaration as `margin: '0 auto'` is a centred narrow box, which is
    // what pushed the content edge 190px inboard of the header.
    const DECL = /\{[^{}]*maxWidth:\s*(?:'?var\(--measure-read\)'?|'?720px?'?)[^{}]*\}/g
    const offenders = SURFACES.filter(f => f !== OWNER).flatMap(f => {
      const src = read(f)
      return Array.from(src.matchAll(DECL))
        // ⚠️ THE DARK CLOSE IS THE ONE RATIFIED EXCEPTION, and it declares
        // itself. "The dark close is centred — the ONE exception" is 🟢
        // RATIFIED (W-09): one deliberate break at the end is a full stop.
        // `textAlign: 'center'` is the signal because a box centred for
        // CENTRED TEXT is the exception, and a box centred while its text is
        // left-aligned is the defect. `sectionSurfaces.test.ts` already caps
        // dark bands at one per page, so this cannot become a rhythm.
        // 🔴 THIS ARM FOUND IT ON ITS FIRST RUN and the register is why it is
        // an exemption rather than a fix: an unrecognised ruled exception is
        // how a correct layout gets "corrected".
        .filter(m => /margin:\s*'0 auto'/.test(m[0]) && !/textAlign:\s*'center'/.test(m[0]))
        .map(m => `  ${f}  ${m[0].replace(/\s+/g, ' ').slice(0, 120)}`)
    })
    expect(
      offenders,
      'A centred read-measure box moves the left edge instead of narrowing the box '
      + '(the SHIPPED "one left edge" ruling). Nest it: the outer element owns '
      + '--measure-page and the centring, the inner element owns --measure-read '
      + 'and is NOT centred. `Section width="read"` already does this:\n' + offenders.join('\n'),
    ).toEqual([])
  })

  it('no Section hand-rolls a numeric section measure in innerStyle', () => {
    // A `width="full"` Section re-wrapping at `var(--measure-page)` is REQUIRED
    // (the register: "A width=full Section must re-wrap its content in the page
    // column"). A NUMBER there is a section measure somebody typed, which is
    // the whole class SITE-MEASURE-THIRD-01 retired.
    const offenders = SURFACES.flatMap(f =>
      Array.from(read(f).matchAll(/innerStyle=\{\{[^}]*maxWidth:\s*'?[0-9]/g))
        .map(m => `  ${f}  ${m[0].replace(/\s+/g, ' ').slice(0, 120)}`),
    )
    expect(
      offenders,
      'A Section measure must be a token, never a typed number:\n' + offenders.join('\n'),
    ).toEqual([])
  })
})
