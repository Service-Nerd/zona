import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

/**
 * GUARD-TREE-SWEEP-01 — "is this a hardcoded colour?" has ONE owner.
 *
 * 🔴 WHY. `.githooks/pre-commit` reads STAGED FILES ONLY, which is not a bug — it is the shape of
 * every commit-time check. So a colour already in the tree is invisible to it: measured 2026-10-01,
 * the one live hardcoded hex in the whole app was `var(--bg, #111)` in `app/dashboard/layout.tsx`,
 * a dark-mode fallback that survived ADR-008 and would have painted the dashboard near-black, alive
 * purely because nothing had touched that file for months.
 *
 * `scripts/sweep-colours.sh` reads the tree. Two readers of the same rule is exactly the shape this
 * repo keeps paying for — `deloadCadence`, `tierResolution`, `supersedeCoverage`, `OPS-AI-OWNER-01`,
 * `SESSION-KM-01`, `open-items.sh` — and here the drift would be silent and the wrong way round:
 * the sweep reporting CLEAN under a looser rule than the hook enforces, so a colour that cannot be
 * committed is never found in the code already shipped.
 *
 * ⚠️ WHAT THIS DOES NOT PROVE: that either reader's POPULATION is right. The rule is shared; the
 * file selection is each caller's own job, deliberately. `sweep-colours.test.sh` asserts the sweep's
 * population (12 cases, 6 in the red direction); `.githooks/pre-commit.test.sh` asserts the hook's.
 */

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const LIB = 'scripts/lib/colour-guards.sh'
const CALLERS = ['.githooks/pre-commit', 'scripts/sweep-colours.sh'] as const
const OWNED = [
  'HEX_RE', 'RGBA_RE', 'RGBA_SCRIM', 'BANNED_RE', 'FONT_RE', 'SETP_RE',
  'PALETTE_EXEMPT_REGEX', 'COLOUR_FILE_REGEX', 'strip_comments', 'colour_violations',
] as const

describe('GUARD-TREE-SWEEP-01 — one owner of the colour predicates', () => {
  it('1. the owner exists and defines every name', () => {
    expect(existsSync(join(ROOT, LIB)), `${LIB} is the single owner and must exist`).toBe(true)
    const lib = read(LIB)
    for (const name of OWNED) {
      const defines = new RegExp(`(^|\\n)\\s*(${name}\\(\\)|${name}=)`).test(lib)
      expect(defines, `${LIB} must define ${name}`).toBe(true)
    }
  })

  it('2. NO caller defines any of them itself — a second copy is the defect', () => {
    for (const caller of CALLERS) {
      const src = read(caller)
      for (const name of OWNED) {
        const redefines = new RegExp(`(^|\\n)\\s*(${name}\\(\\)\\s*\\{|${name}=)`).test(src)
        expect(redefines, `${caller} must SOURCE ${name} from ${LIB}, never define it`).toBe(false)
      }
    }
  })

  it('3. every caller sources the owner', () => {
    for (const caller of CALLERS) {
      expect(read(caller), `${caller} must source ${LIB}`).toMatch(/colour-guards\.sh/)
    }
  })

  it('4. no caller writes a colour regex of its own', () => {
    // 🔴 A COLOUR INSIDE A COMMENT IS PROSE, AND THE FIRST CUT OF THIS ARM FORGOT IT.
    // `HOOK-RGBA-COMMENTS-01` is the recorded instance — both colour checks grepped the whole
    // file, so a comment RECORDING a measured value was blocked as a hardcoded one. This arm
    // was written to protect the owner and committed the same mistake: `pre-commit` explains
    // its own rgba rule by naming the retired System-B teal in a comment, which is the
    // reviewable form the hook's own OG exemption endorses. Shell comments are blanked first.
    const code = (src: string) =>
      src.split('\n').map(l => l.replace(/(^|\s)#.*$/, '$1')).join('\n')
    // The literal shapes the owner holds. A caller re-typing one of these is drift
    // arriving by copy-paste rather than by redefinition, which name-matching misses.
    const SHAPES: Array<[string, RegExp]> = [
      ['a hex character class', /\[0-9A-Fa-f\]\{3,8\}/],
      ['an rgb() triple', /rgba\?\\\(\\s\*\[0-9\]\{1,3\}/],
      ['a retired System-B colour', /#5BC0BE|#0B132B/],
      ['a banned font name', /DM Mono|Space Grotesk|Bebas Neue/],
    ]
    for (const caller of CALLERS) {
      const src = code(read(caller))
      for (const [what, re] of SHAPES) {
        expect(re.test(src), `${caller} writes ${what} itself — it belongs in ${LIB}`).toBe(false)
      }
    }
  })

  it('5. the tree sweep is a GATE, not a note', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    expect(pkg.scripts['sweep:colours'], 'npm run sweep:colours must exist').toBeTruthy()
    // 🔴 This repo's record: a check that depends on remembering is a check that does not run.
    expect(pkg.scripts['verify:ci'], 'the sweep must run in verify:ci').toContain('sweep:colours')
    expect(pkg.scripts['test:githooks'], 'its falsification suite must run too')
      .toContain('sweep-colours.test.sh')
  })
})
