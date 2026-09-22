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
// the board. One exists today (56px), and it is listed rather than hidden.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const src = (f: string) =>
  fs.readFileSync(path.join(ROOT, f), 'utf8')
    // Strip comments first. This file's own rationale quotes pixel values, and
    // so do the swept files — a naive scan flags the paragraph describing the
    // rule as a breach of it. Sixth time this repo has met that shape.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const PAGES = [
  'app/page.tsx', 'app/plans/page.tsx', 'app/pricing/page.tsx',
  'app/about/page.tsx', 'app/charity-runners/page.tsx',
]
const COMPONENTS = fs.readdirSync(path.join(ROOT, 'components/marketing'))
  .filter(f => f.endsWith('.tsx'))
  .map(f => `components/marketing/${f}`)
const SURFACES = [...PAGES, ...COMPONENTS]

const SPACING_PROP = /(marginBottom|marginTop|gap|rowGap|columnGap|paddingTop|paddingBottom):\s*'(\d+)px'/g

/** Values knowingly left hand-typed, with the reason. Debt register, not a hole. */
const ALLOWED: Record<string, string> = {
  '56': 'a 8px shift to --space-7 exceeds the board\'s 4px limit; returns to the board',
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

  it('no marketing surface hand-types a spacing value above 5px', () => {
    const offenders: string[] = []
    for (const f of SURFACES) {
      for (const m of Array.from(src(f).matchAll(SPACING_PROP))) {
        const v = Number(m[2])
        if (v <= 5) continue                      // line-box artefact, exempt
        if (ALLOWED[String(v)]) continue          // declared debt
        offenders.push(`${f}: ${m[1]}: '${v}px' — use a --space-* token`)
      }
    }
    expect(offenders, 'hand-typed spacing has returned').toEqual([])
  })

  it('the ≤5px exemption is real, not an accident', () => {
    // If this ever reads 0, someone has swept the line-box artefacts and the
    // exemption has been lost — which is the diff-burying outcome it prevents.
    const small = SURFACES.flatMap(f =>
      Array.from(src(f).matchAll(SPACING_PROP)).filter(m => Number(m[2]) <= 5))
    // ⚠️ A BASELINE, NOT `> 0`. The first version asserted only that the band was
    // non-empty, and emptying an entire FILE did not turn it red — it counts
    // across every surface, so 90% could be swept and it would still pass. A
    // guard that only fires on total destruction is barely a guard.
    // Baseline measured at the sweep: 17. Lower it deliberately or not at all.
    expect(small.length, 'the ≤5px band has shrunk — the exemption is being swept away')
      .toBeGreaterThanOrEqual(17)
  })
})
