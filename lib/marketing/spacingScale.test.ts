// The marketing site's spacing comes from the scale, not from a person's hand.
//
// SITE-WAVE-4 / SITE-SPACE-01, Design Board 2026-09-22. Found by the founder on
// his phone: "the space between sections or tiles then next text is
// inconsistent. e.g. the zone image then the next text is very close."
//
// Measured: 448 gaps across six pages at 375px, 24 distinct values, NINETEEN of
// them real spacing decisions. Nineteen is THE SAME NUMBER `SITE-TYPE-01` found
// for font sizes — type was tokenised and nobody looked at space. Same disease,
// one layer down.
//
// ⚠️ GAPS OF 5px AND UNDER ARE DELIBERATELY EXEMPT (Wroblewski). They are
// line-box artefacts between inline elements — typography, not spacing — and
// 193 of the 448 measured gaps were in that band. Tokenising them would produce
// hundreds of meaningless diffs and bury the real ones.
//
// ⚠️ A value needing a shift of MORE than 4px is not swept either; it returns to
// the board. They are listed below rather than hidden.
//
// 🔴 WIDENED 2026-11-05 — `SITE-SPACE-GATE-02`. THE SWEEP ABOVE SHIPPED AND THIS
// GATE THEN GOVERNED ONE LIVE DECLARATION.
//
// `SPACING_PROP` matched a SINGLE BARE VALUE — `gap: '12px'` — so the
// `padding:` / `margin:` SHORTHAND, which is the form most spacing in this
// codebase is actually written in, was invisible to it. So were every
// left/right property and five whole pages. Measured on 2026-11-05:
//
//   declarations it could read ................................  18
//     ...of those ≤5px and therefore exempt ...................  17
//     ...of those the ALLOWED 56px ............................   1
//   LIVE DECLARATIONS ACTUALLY GOVERNED .......................   1
//   declarations it could not read ............................ 256
//     ...individual off-scale values >5px inside them ......... 187
//   on pages outside its surface list entirely ................  70
//
// Falsified before the widening: `padding: '19px 21px'` on a /pricing card left
// all three arms GREEN. ⚠️ `SITE-WAVE-4`'s own row warned that "a token family
// nobody applies is the `surface=` failure repeated" — and then shipped a check
// that could not see whether the family was applied.
//
// ⚠️ SILVANTO DECLINED HIS OWN VETO over this and named the distinction, which
// is worth keeping: `SITE-TYPE-01` found 170 hand-typed sizes and GATED them.
// This found 19 real spacing decisions, swept them, and shipped a hollow
// instrument. **The rule was right; the check was empty.** That is not a
// palette or type regression, so it was not a veto.
//
// ⚠️ BAND VERTICAL RHYTHM IS A DIFFERENT FAMILY AND IS EXEMPT BY NAME. The
// `padding` on a `Section`'s `innerStyle` whose horizontal value is the 24px
// page gutter is a BAND's vertical rhythm, which W-07 owns through
// `--sect-y` / `--sect-y-hero` / `--sect-y-close` — not `--space-*`. Sixteen of
// those are hand-typed today, on six surfaces, and pushing them onto the
// element scale would be a 16px change to a band on the worst case and the
// wrong family in every case. Filed as `SITE-BAND-RHYTHM-01`, not swept here:
// a gate that quietly reassigns a value to another family is worse than one
// that cannot see it.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { comparisonArticles, articlePath } from './articles'

const ROOT = path.resolve(__dirname, '../..')
const src = (f: string) =>
  fs.readFileSync(path.join(ROOT, f), 'utf8')
    // Strip comments first. This file's own rationale quotes pixel values, and
    // so do the swept files — a naive scan flags the paragraph describing the
    // rule as a breach of it. Sixth time this repo has met that shape.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

// ⚠️ EVERY MARKETING PAGE, not the five the sweep happened to visit. /support,
// /privacy, /terms, /guides and /comparisons were outside the old list and held
// 70 spacing declarations between them. The shim pages are DERIVED from the
// article catalogue for the reason `noEmDash` already records.
const PAGES = [
  'app/page.tsx', 'app/plans/page.tsx', 'app/pricing/page.tsx',
  'app/about/page.tsx', 'app/charity-runners/page.tsx',
  'app/support/page.tsx', 'app/privacy/page.tsx', 'app/terms/page.tsx',
  'app/guides/page.tsx', 'app/comparisons/page.tsx',
  'app/plans/[slug]/page.tsx', 'app/guides/[slug]/page.tsx',
  ...comparisonArticles().map(a => `app${articlePath(a)}/page.tsx`),
].filter(f => fs.existsSync(path.join(ROOT, f)))
const COMPONENTS = fs.readdirSync(path.join(ROOT, 'components/marketing'))
  .filter(f => f.endsWith('.tsx'))
  .map(f => `components/marketing/${f}`)

/** ⚠️ EXEMPT BY DESIGN, inheriting `typeScale.test.ts`'s reason verbatim rather
 *  than re-deciding it: these four draw a simulated iPhone running the app, and
 *  their 9px tab-bar gaps are a PICTURE of iOS chrome at mockup scale, not this
 *  website's spacing. Putting them on the site scale would make the drawing
 *  wrong in order to make a grep clean. They were never exempt here before
 *  because the old regex could not see them either — an exemption that exists
 *  only by accident of a regex is not an exemption. */
const MOCKUPS = [
  'components/marketing/PhoneFrame.tsx',
  'components/marketing/ProductStill.tsx',
  'components/marketing/PhoneShell.tsx',
  'components/marketing/TabbedPhone.tsx',
]
const SURFACES = [...PAGES, ...COMPONENTS].filter(f => !MOCKUPS.includes(f))

/** Every spacing declaration, SHORTHAND INCLUDED. `padding: '18px 20px'` is two
 *  spacing decisions and the old pattern saw neither. Capture 3 is the whole
 *  value; the arms pull each `<n>px` out of it. */
const SPACING_PROP =
  /(padding|margin|gap|rowGap|columnGap)(Top|Bottom|Left|Right|Block|Inline)?:\s*'([^']*)'/g

/** The ruled element scale. `--sect-y*` is a different family (see the header). */
const SCALE = [4, 8, 12, 16, 24, 32, 48]

/** A band's vertical rhythm, which W-07 owns, not this scale: `padding` on a
 *  Section's `innerStyle` whose horizontal value is the 24px page gutter. */
function isBandRhythm(src: string, m: RegExpMatchArray): boolean {
  const before = src.slice(Math.max(0, (m.index ?? 0) - 260), m.index ?? 0)
  return /innerStyle=\{\{[^}]*$/.test(before)
    && m[1] === 'padding'
    && /(^|\s)24px(\s|$)/.test(m[3])
}

/** Values knowingly left hand-typed, with the reason. Debt register, not a hole.
 *  ⚠️ `A DECLARED REASON IS NOT A FIXED PROBLEM` — every row here is a value
 *  whose nearest-token shift EXCEEDS the board's 4px limit, so it returns to the
 *  board rather than being swept by me. Filed as `SITE-SPACE-OVERLIMIT-01`. */
const ALLOWED: Record<string, string> = {
  '40': 'SiteFooter top padding; an 8px shift to --space-7 exceeds the 4px limit',
  '56': 'an 8px shift to --space-7 exceeds the board\'s 4px limit; returns to the board',
  '64': '/support, /privacy, /terms page padding; 16px from --space-7',
  '80': '/support, /privacy, /terms page padding; 32px from --space-7',
}

describe('spacing scale — SITE-WAVE-4', () => {
  it('the tokens exist and are the ruled scale', () => {
    const css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8')
    const want = [4, 8, 12, 16, 24, 32, 48]
    want.forEach((px, i) => {
      expect(css, `--space-${i + 1} is missing or not ${px}px`)
        .toMatch(new RegExp(`--space-${i + 1}:\\s*${px}px`))
    })
  })

  it('no marketing surface hand-types an off-scale spacing value above 5px', () => {
    const offenders: string[] = []
    for (const f of SURFACES) {
      const text = src(f)
      for (const m of Array.from(text.matchAll(SPACING_PROP))) {
        if (isBandRhythm(text, m)) continue        // W-07's family, not this one
        for (const px of m[3].match(/\d+px/g) ?? []) {
          const v = Number(px.replace('px', ''))
          if (v <= 5) continue                     // line-box artefact, exempt
          if (SCALE.includes(v)) continue          // already on the scale
          if (ALLOWED[String(v)]) continue         // declared debt
          offenders.push(`${f}: ${m[1]}${m[2] ?? ''}: '${m[3]}' — ${v}px is off the scale, use a --space-* token`)
        }
      }
    }
    expect(offenders, `hand-typed spacing:\n  ${offenders.join('\n  ')}`).toEqual([])
  })

  it('reads the SHORTHAND, which is the form the hole was in', () => {
    // 🔴 THE ARM THAT EXISTS BECAUSE THE GATE WAS HOLLOW. The old pattern read
    // only a single bare value, so `padding: '18px 20px'` — two spacing
    // decisions — was invisible, and 187 off-scale values lived under three
    // green arms. This asserts the pattern can still see a shorthand at all. A
    // regex narrowed back to `'(\d+)px'` turns this red immediately.
    const sample = "<div style={{ padding: '19px 21px', margin: '0 0 17px' }} />"
    const found = Array.from(sample.matchAll(SPACING_PROP))
      .flatMap(m => (m[3].match(/\d+px/g) ?? []).map(Number.parseFloat))
    expect(found).toEqual([19, 21, 17])
  })

  it('counts the surfaces it is supposed to cover', () => {
    // The five pages that were outside the list held 70 declarations between
    // them. Derived, so a new comparison page cannot arrive outside the
    // population — which is how page 3 escaped `typeScale` for two months.
    for (const p of ['app/support/page.tsx', 'app/privacy/page.tsx', 'app/terms/page.tsx',
                     'app/guides/page.tsx', 'app/comparisons/page.tsx']) {
      expect(SURFACES, `${p} is outside the spacing gate`).toContain(p)
    }
    expect(SURFACES.length).toBeGreaterThan(20)
    expect(SURFACES.some(f => f.includes('what-is-zone-2-running'))).toBe(true)
  })

  it('the \u22645px exemption is real, not an accident', () => {
    // If this ever reads 0, someone has swept the line-box artefacts and the
    // exemption has been lost — which is the diff-burying outcome it prevents.
    const small = SURFACES.flatMap(f => {
      const text = src(f)
      return Array.from(text.matchAll(SPACING_PROP))
        .flatMap(m => (m[3].match(/\d+px/g) ?? []).map(px => Number(px.replace('px', ''))))
        .filter(v => v <= 5)
    })
    // ⚠️ A BASELINE, NOT `> 0`. The first version asserted only that the band was
    // non-empty, and emptying an entire FILE did not turn it red — it counts
    // across every surface, so 90% could be swept and it would still pass. A
    // guard that only fires on total destruction is barely a guard.
    // Re-baselined at the widening: the shorthand brought more of the band into
    // view. Lower it deliberately or not at all.
    expect(small.length, 'the \u22645px band has shrunk — the exemption is being swept away')
      .toBeGreaterThanOrEqual(17)
  })
})
