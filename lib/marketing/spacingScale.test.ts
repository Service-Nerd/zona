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

/** 🔴 THE UNITLESS FORM, AND IT IS THE SAME HOLE ONE LAYER IN. The widening
 *  above caught the shorthand and still read only QUOTED values, so React's
 *  bare-number form — `gap: 20`, `paddingLeft: 18`, which React renders as px —
 *  stayed invisible. **26 off-scale values >5px across the gate's own surfaces**,
 *  found by code review on the commit that closed the first hole. Same lesson,
 *  same day: the population, not the rule. */
const SPACING_PROP_BARE =
  /(padding|margin|gap|rowGap|columnGap)(Top|Bottom|Left|Right|Block|Inline)?:\s*(\d+)\s*[,}]/g

/** The ruled element scale. `--sect-y*` is a different family (see the header). */
const SCALE = [4, 8, 12, 16, 24, 32, 48]

/** Is this value this gate's business on this file? */
function governed(file: string, v: number): boolean {
  if (v <= 5) return false                                   // line-box artefact
  if (SCALE.includes(v)) return false                        // already on the scale
  if (ALLOWED[String(v)]) return false                       // declared debt (now empty; see below)
  if (OVERLIMIT_BY_FILE[file]?.[String(v)]) return false     // overlimit debt, FILE-SCOPED
  if (ALLOWED_IN_FILE[file]?.[String(v)]) return false       // another system owns it
  return true
}

/** The bare-value twin of `isBandRhythm`. */
function isBandRhythmBare(src: string, m: RegExpMatchArray): boolean {
  const before = src.slice(Math.max(0, (m.index ?? 0) - 260), m.index ?? 0)
  return /innerStyle=\{\{[^}]*$/.test(before) && m[1] === 'padding'
}

/** A band's vertical rhythm, which W-07 owns, not this scale: `padding` on a
 *  Section's `innerStyle` whose horizontal value is the 24px page gutter. */
function isBandRhythm(src: string, m: RegExpMatchArray): boolean {
  const before = src.slice(Math.max(0, (m.index ?? 0) - 260), m.index ?? 0)
  return /innerStyle=\{\{[^}]*$/.test(before)
    && m[1] === 'padding'
    && /(^|\s)24px(\s|$)/.test(m[3])
}

/**
 * Values knowingly left hand-typed, with the reason. Debt register, not a hole.
 * Every entry is a value whose nearest-token shift EXCEEDS the board's 4px limit, so it
 * returns to the board rather than being swept here. Filed as `SITE-SPACE-OVERLIMIT-01`.
 *
 * 🔴 IT WAS FOUR BARE VALUES AND ITS REASONS NAMED THREE FILES WHILE IT EXEMPTED SEVEN
 * (SITE-SPACE-OVERLIMIT-01, re-measured 2026-11-08). The register said *"/support, /privacy,
 * /terms page padding"* for 64 and 80 — and because a bare value exempts a number on EVERY
 * surface, 64 was also covering `SiteHeader` ×2 and `charity-runners` ×2, and 56 was covering
 * `PhoneFrame` ×5 that no reason mentioned at all. **8 instances were described; 19 were
 * exempt.** The backlog item inherited the figure of 8 from the reasons.
 *
 * ⚠️ `ALLOWED_IN_FILE`'s own comment already said why this was wrong — *"the bare-value
 * `ALLOWED` above exempts a number on EVERY surface, which is wider than any of its
 * reasons"* — so the mechanism and the warning both existed and the four overlimit values
 * were in the loose half anyway. `VERIFY THE EXEMPTION'S JUSTIFICATION, NOT THE STAMP.`
 *
 * 🔑 SO THE REGISTER IS FILE-SCOPED NOW AND NOT ONE PIXEL MOVED. Whether these 19 should be
 * swept onto the scale is a VISIBLE change of up to 32px and belongs to the Design Board,
 * which is what the item always said and what its ⚙️ NO BOARD tag disagreed with. This half
 * — making the exemption describe what it exempts — is a defect fix against the gate's own
 * documented intent.
 */
const ALLOWED: Record<string, string> = {}

/**
 * The 19 overlimit instances, by file, measured 2026-11-08.
 *
 * ⚠️ A NEW instance of one of these values on a NEW file now FAILS, which is the whole point
 * of the file scope: the debt is frozen where it is rather than being a standing permission
 * for four numbers everywhere.
 */
const OVERLIMIT_BY_FILE: Record<string, Record<string, string>> = {
  'app/support/page.tsx':   { '64': 'marginTop; 16px from --space-7', '80': 'bottom padding; 32px from --space-7' },
  'app/privacy/page.tsx':   { '64': 'marginTop; 16px from --space-7', '80': 'bottom padding; 32px from --space-7' },
  'app/terms/page.tsx':     { '64': 'marginTop; 16px from --space-7', '80': 'bottom padding; 32px from --space-7' },
  'app/charity-runners/page.tsx': { '56': 'section marginTop; an 8px shift to --space-7 exceeds the 4px limit' },
  'components/marketing/SiteFooter.tsx': { '40': 'top padding; an 8px shift to --space-7 exceeds the 4px limit' },
}

/** Values exempt on ONE named file, because they belong to another system.
 *
 *  🔴 `WaitlistForm`'s 14px was SWEPT TO 16 BY THIS GATE AND CODE REVIEW CAUGHT
 *  IT. The input's padding exists to match `btn--regular`'s 48px height, and the
 *  arithmetic is written in the comment beside it: `14+18+14+2 = 48`. At
 *  `--space-4` it becomes 52 and re-opens `WEBSITE-BUTTON-UNIFY-01`. **A value
 *  that exists to match another component's geometry does not belong to the
 *  spacing scale**, the same way a band's vertical rhythm belongs to `--sect-y`.
 *  ⚠️ File-scoped on purpose: the bare-value `ALLOWED` above exempts a number on
 *  EVERY surface, which is wider than any of its reasons. */
const ALLOWED_IN_FILE: Record<string, Record<string, string>> = {
  'components/marketing/WaitlistForm.tsx': {
    '14': 'input padding is load-bearing against btn--regular 48px (WEBSITE-BUTTON-UNIFY-01): 14+18+14+2 = 48',
  },
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
          if (!governed(f, v)) continue
          offenders.push(`${f}: ${m[1]}${m[2] ?? ''}: '${m[3]}' — ${v}px is off the scale, use a --space-* token`)
        }
      }
      // The unitless form React renders as px.
      for (const m of Array.from(text.matchAll(SPACING_PROP_BARE))) {
        if (isBandRhythmBare(text, m)) continue
        const v = Number(m[3])
        if (!governed(f, v)) continue
        offenders.push(`${f}: ${m[1]}${m[2] ?? ''}: ${v} — ${v}px is off the scale, use a --space-* token`)
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

  /**
   * SITE-SPACE-OVERLIMIT-01 (2026-11-08) — THE REGISTER MUST DESCRIBE WHAT IT EXEMPTS.
   *
   * 🔑 The arm above proves no NEW off-scale value appears. This one proves the register is
   * not quietly wider than its reasons, which is how it came to describe 8 instances while
   * exempting 19: a bare value is a permission for that number on every surface, forever.
   *
   * ⚠️ BOTH DIRECTIONS. A row for a file that no longer carries the value is a STALE
   * exemption and hides the next genuine offender — the same shape as a dead entry in a debt
   * register, and the reason `storedPlanDebt.test.ts` grew a stale-exemption arm the same day.
   */
  it('🔴 every overlimit exemption exempts something the GATE ACTUALLY GOVERNS', () => {
    // 🔴 THE FIRST VERSION OF THIS ARM GREPPED RAW FILE TEXT AND COULD NOT SEE THE DEFECT IT
    // WAS WRITTEN FOR (code review, 2026-11-08). I registered **19** instances; the gate
    // governs **8**. The other eleven were:
    //   · `PhoneFrame.tsx` ×5 — the file is in `MOCKUPS` and excluded from `SURFACES` entirely,
    //     and its `56px` are 3 COMMENTS plus 2 `fontSize` values, which are not spacing at all
    //   · `SiteHeader.tsx` ×2 — one `//` comment, counted twice by a raw grep
    //   · `charity-runners` `64`/`80` — band rhythm (W-07's family) and a `scrollMarginTop`
    // **So I shipped the same over-exemption the commit says it closes, in the register that
    // replaced it**, and my own honesty arm was blind to it because it asked the filesystem
    // instead of asking the gate. `HOOK-RGBA-COMMENTS-01` as well: a raw count can be moved by
    // editing a comment, so `toBe(19)` was never load-bearing.
    //
    // 🔑 THE ARM NOW WALKS THE GATE'S OWN POPULATION — `SURFACES`, `src()` (comment-stripped),
    // the same two property regexes and the same band-rhythm exclusions — and asks `governed()`
    // with the register momentarily ignored. An exemption that exempts nothing FAILS.
    const governedNow: Array<[string, number]> = []
    for (const f of SURFACES) {
      const text = src(f)
      for (const m of Array.from(text.matchAll(SPACING_PROP))) {
        if (isBandRhythm(text, m)) continue
        for (const px of m[3].match(/\d+px/g) ?? []) {
          const v = Number(px.replace('px', ''))
          // `governed()` minus the overlimit register: what WOULD be flagged without it.
          if (v <= 5 || SCALE.includes(v) || ALLOWED[String(v)] || ALLOWED_IN_FILE[f]?.[String(v)]) continue
          governedNow.push([f, v])
        }
      }
      for (const m of Array.from(text.matchAll(SPACING_PROP_BARE))) {
        if (isBandRhythmBare(text, m)) continue
        const v = Number(m[3])
        if (!Number.isFinite(v) || v <= 5 || SCALE.includes(v) || ALLOWED[String(v)] || ALLOWED_IN_FILE[f]?.[String(v)]) continue
        governedNow.push([f, v])
      }
    }
    expect(governedNow.length, 'the derivation found nothing — an empty population passes everything')
      .toBeGreaterThan(0)

    // Every REGISTERED pair must be one the gate would flag. A row that exempts nothing is a
    // stale exemption and hides the next genuine offender.
    const stale: string[] = []
    for (const [file, vals] of Object.entries(OVERLIMIT_BY_FILE))
      for (const v of Object.keys(vals))
        if (!governedNow.some(([f, n]) => f === file && n === Number(v)))
          stale.push(`${file}: ${v}px is exempt and the gate does not govern it there`)
    expect(stale, 'delete the row — see the comment above for the eleven that did this').toEqual([])

    // And every GOVERNED pair must be registered, or the main arm would already be red.
    const unregistered = governedNow
      .filter(([f, v]) => !OVERLIMIT_BY_FILE[f]?.[String(v)])
      .map(([f, v]) => `${f}: ${v}px`)
    expect(Array.from(new Set(unregistered)), 'a new off-scale value: fix it or register it').toEqual([])

    // 📐 The measured figure, derived from the gate rather than from a grep, so a comment
    // cannot move it. 8 on 2026-11-08.
    expect(new Set(governedNow.map(([f, v]) => `${f}|${v}`)).size,
      'distinct file+value pairs the overlimit register carries').toBe(8)
  })

  it('the bare-value register is EMPTY — an overlimit value is file-scoped or it fails', () => {
    // The mechanism that caused the over-exemption, closed rather than documented. A future
    // entry here would re-open a permission for one number on every marketing surface.
    expect(Object.keys(ALLOWED),
      'put the value in OVERLIMIT_BY_FILE with its file, not in the bare register').toEqual([])
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
