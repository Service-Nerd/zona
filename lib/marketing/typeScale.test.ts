import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * SITE-TYPE-01 — the marketing site has a type scale, and only the scale.
 *
 * Measured before this existed: 170 hand-typed font sizes across 16 files in
 * NINETEEN distinct values, plus nine separate hero clamps, three of them
 * within 2px of each other. The tell was the half-pixels (12.5, 13.5, 14.5,
 * 15.5 = 30 of the 170). Nobody chooses 14.5px; it is what a number becomes
 * after each component nudges a value copied from its neighbour.
 *
 * ⚠️ A SCALE WITHOUT A GATE IS A SUGGESTION. This repo has written the same
 * epitaph several times: the eslint rule that shipped for a year and never
 * ran, the config/principle sync that drifted for months, the canonical-host
 * default. The tokens in globals.css do not stop the 171st hand-typed size.
 * This does.
 */

// NB: Array.from, never [...set] / [...matchAll]. This repo's tsconfig target
// rejects the spread (CLAUDE.md, TypeScript gotchas) and vitest transpiles it
// happily, so the tests pass while `npm run typecheck` fails the build.
const ROOT = path.resolve(__dirname, '../..')

/**
 * ⚠️ EXEMPT BY DESIGN, and the reasoning ships here so it is inherited rather
 * than rediscovered. These two components draw a simulated iPhone running the
 * app. Their 9px tab-bar labels and 56px metric are a PICTURE of iOS chrome
 * at mockup scale, not this website's typography. Putting them on the site
 * scale would make the drawing wrong in order to make a grep clean.
 */
const MOCKUPS = [
  'components/marketing/PhoneFrame.tsx',
  'components/marketing/ProductStill.tsx',
  // DESIGN-V3 — the same drawing, split across more files. `PhoneShell` is
  // the frame extracted OUT of PhoneFrame so there is one device rather than
  // two, and `TabbedPhone` adds the Plan and Coach screens to it. Their 10px
  // nav labels and 11px status bar are iOS chrome at mockup scale, exactly as
  // PhoneFrame's were before the extraction. ⚠️ An exemption that does not
  // follow a refactor is how a rule quietly stops applying to the thing it
  // was written about.
  'components/marketing/PhoneShell.tsx',
  'components/marketing/TabbedPhone.tsx',
]

const SURFACES = [
  'app/page.tsx', 'app/plans', 'app/pricing', 'app/about', 'app/guides',
  'app/comparisons', 'app/coopah-vs-runna', 'app/runna-alternatives',
  'app/charity-runners', 'app/support', 'app/privacy', 'app/terms',
  'components/marketing',
]

function walk(p: string): string[] {
  const abs = path.join(ROOT, p)
  if (!fs.existsSync(abs)) return []
  if (fs.statSync(abs).isFile()) return abs.endsWith('.tsx') ? [p] : []
  return fs.readdirSync(abs).flatMap(c => walk(path.join(p, c)))
}

const files = Array.from(new Set(SURFACES.flatMap(walk))).filter(f => !MOCKUPS.includes(f))

describe('marketing type scale', () => {
  it('covers a real set of files (a gate over nothing is not a gate)', () => {
    expect(files.length).toBeGreaterThanOrEqual(14)
  })

  it('declares every size as a token in globals.css', () => {
    const css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8')
    const declared = new Set(Array.from(css.matchAll(/^\s*(--fs-[a-z0-9-]+)\s*:/gim)).map(m => m[1]))
    expect(declared.size).toBeGreaterThanOrEqual(16)

    const used = new Set<string>()
    const offenders: string[] = []
    for (const f of files) {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8')
      src.split('\n').forEach((line, i) => {
        // A literal number or a bare clamp() where a token belongs.
        const raw = line.match(/fontSize:\s*'?(?:\d|clamp\()/)
        if (raw) offenders.push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}`)
        for (const m of Array.from(line.matchAll(/fontSize:\s*'var\((--fs-[a-z0-9-]+)\)'/g))) used.add(m[1])
      })
    }
    expect(offenders, `hand-typed font size outside the scale:\n${offenders.join('\n')}`).toEqual([])

    // Every token a surface names must actually exist, or it silently renders
    // at the browser default and nothing fails.
    const undeclared = Array.from(used).filter(t => !declared.has(t))
    expect(undeclared, `fontSize names a token globals.css does not declare: ${undeclared}`).toEqual([])
  })
})
