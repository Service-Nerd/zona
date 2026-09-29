import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

// SUBPAGE-TYPE-SCALE-01 — a pushed screen's title comes from the documented role.
//
// 🔴 THE RULE HAS BEEN WRITTEN DOWN THE WHOLE TIME AND NOTHING ENFORCED IT.
// `ui-patterns.md` § type scale: **Screen title — `--font-ui` / 800 / 26px**. Nine pushed
// screens diverged anyway: five at 22px in `--font-brand`, two at 28px, and two that
// HAND-COPIED the right values instead of using the owner. `typeScale.test.ts` exists and
// is **marketing-only** — the app has never had a type-scale gate, which is the whole
// reason this drifted.
//
// ⚠️ IT READS `rem` AS WELL AS `px`, AND THAT IS NOT DEFENSIVE PROGRAMMING. My own analysis
// of this defect scanned for `px` only and therefore could not see `UpgradeScreen`'s title
// at `1.75rem` — I reported the screen's ✓ GLYPH as its title instead, and told the founder
// it was "the only title rendering at weight 400". Both halves were wrong. A unit the check
// cannot read is a screen the check cannot see.

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
     .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

/** The pushed screens whose title must come from the owner. */
const PUSHED = [
  'app/dashboard/UpgradeScreen.tsx',
  'app/dashboard/RedeemCodeScreen.tsx',
  'app/dashboard/FounderNoteScreen.tsx',
  'app/dashboard/BenchmarkUpdateScreen.tsx',
  'components/shared/FaqScreen.tsx',
  'components/dashboard/SupportScreen.tsx',
]

/** ⚠️ BIG NUMBERS ARE NOT TITLES, AND EACH ONE IS DECLARED RATHER THAN GUESSED AT.
 *
 *  🔴 The first cut of the arm below flagged all three, which is the SAME over-reach as my
 *  analysis of this defect: treat every large font as a heading and you sweep in the data
 *  the screen exists to show. I considered a heuristic — "an interpolated value is data,
 *  literal text is a title" — and rejected it, because `FaqScreen`'s title IS interpolated
 *  (`{FAQ_SUBTITLE}`), so that rule would blind the check to the exact kind of title this
 *  ship just converted. A short declared list with reasons is honest; a clever predicate
 *  that is wrong in one direction is not. */
const NOT_TITLES: Record<string, string> = {
  'app/dashboard/UpgradeScreen.tsx:PRICING.monthly':
    'the monthly PRICE. A number the screen exists to show, not the name of the screen.',
  'app/dashboard/UpgradeScreen.tsx:PRICING.annual':
    'the annual PRICE. Same reason as the monthly one directly above it.',
  'app/dashboard/BenchmarkUpdateScreen.tsx:meta.vdot':
    'the runner\'s VDOT, rendered large because it is the result. Not a heading.',
}

describe('SUBPAGE-TYPE-SCALE-01 — pushed-screen titles come from the owner', () => {
  it('the documented role is still what the owner renders', () => {
    // The pattern layer and the token layer in the same pass — the `--surface-moss-wash`
    // lesson: a rule and its token can live in different files and never meet.
    const css = readFileSync('app/globals.css', 'utf8')
    const rule = /\.screen-header__title\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(rule, 'the title role lost its size').toMatch(/font-size:\s*26px/)
    expect(rule, 'the title role lost its weight').toMatch(/font-weight:\s*800/)
    expect(rule, 'the title role must use --font-ui').toMatch(/var\(--font-ui\)/)
    const doc = readFileSync('docs/canonical/ui-patterns.md', 'utf8')
    expect(doc, 'the documented row and the CSS must agree')
      .toMatch(/Screen title \| `--font-ui` \| 800 \| 26px/)
  })

  it('🔴 no pushed screen hand-rolls a title, in px OR rem', () => {
    const offenders: string[] = []
    for (const f of PUSHED) {
      const src = code(readFileSync(f, 'utf8'))
      for (const m of Array.from(src.matchAll(/style=\{\{([^{}]*)\}\}/g))) {
        const obj = m[1]!
        const px = /fontSize:\s*'(\d+)px'/.exec(obj)
        const rem = /fontSize:\s*'([\d.]+)rem'/.exec(obj)
        const size = px ? Number(px[1]) : rem ? Math.round(Number(rem[1]) * 16) : null
        if (size === null || size < 20) continue
        // A glyph is not a title. The ✓ in a 56px circle is the thing my own analysis
        // mistook for one, so it is excluded by its CONTAINER, not by its size.
        if (/borderRadius:\s*'50%'/.test(obj)) continue
        const after = src.slice(m.index! + m[0].length, m.index! + m[0].length + 40)
        const body = after.replace(/<[^>]*>/g, '').replace(/[>\s]/g, '')
        if (body.length <= 2) continue
        const declared = Object.keys(NOT_TITLES).find(k => {
          const [file, token] = k.split(':')
          return f === file && body.includes(token!.split('.').pop()!)
        })
        if (declared) continue
        offenders.push(`${f}: ${size}px${rem ? ' (declared in rem)' : ''} — ${body.slice(0, 24)}`)
      }
    }
    expect(offenders,
      'a hand-rolled screen title; use className="screen-header__title":\n' + offenders.join('\n'))
      .toEqual([])
  })

  it('every declared not-a-title is still there (a stale exemption is a lie)', () => {
    for (const [k, why] of Object.entries(NOT_TITLES)) {
      const [file, token] = k.split(':')
      const src = code(readFileSync(file!, 'utf8'))
      expect(src, `${k} is declared as not-a-title but is gone — delete the row`)
        .toContain(token!.split('.').pop()!)
      expect(why.length, `${k}'s reason is too thin`).toBeGreaterThan(30)
    }
  })

  it('🔴 every pushed screen actually USES the owner', () => {
    // The inverse. Deleting a title passes the arm above by having nothing to find.
    for (const f of PUSHED) {
      const src = code(readFileSync(f, 'utf8'))
      expect(src, `${f} renders no screen title at all`).toContain('screen-header__title')
    }
  })

  it('scans a real corpus (an empty sweep is not a pass)', () => {
    const all = execSync("git ls-files 'app/**/*.tsx' 'components/**/*.tsx'", { encoding: 'utf8' })
      .trim().split('\n')
    expect(all.length).toBeGreaterThan(50)
    for (const f of PUSHED) expect(all, `${f} left the tree`).toContain(f)
  })
})
