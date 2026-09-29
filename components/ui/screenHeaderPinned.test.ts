import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

// BACK-ARROW-TITLE-COLLIDE-01 — a pushed screen pins its header (Design Board, 2026-09-29).
//
// 🔴 THE DEFECT, AND WHY NO CHECK COULD HAVE FOUND IT. `ScreenHeader`'s `sticky` prop
// defaulted to FALSE and was passed on exactly TWO surfaces — `Your plan` and `Your coach`
// — **both tab roots, which have no back arrow and therefore cannot collide with one.**
// Every screen that COULD collide had never pinned. So a 44px opaque disc at x 16–60 sat
// on top of a 26px/800 title whose text box also starts at x 16, and "Your zones" rendered
// as "ur zones". The founder found it on a device, in a screenshot he took for something
// else entirely.
//
// ⚠️ IT IS NOT THAT THEY OVERLAP, IT IS WHERE. A disc over a card edge is what
// `--shadow-card` exists for. A disc stopping on the second character of a word reads as a
// rendering fault. `.pinned-chrome` is `--bg` with an edge that appears on scroll, so
// content passing beneath disappears AT A LINE rather than AT A CURVE, MID-WORD.

/** 🔴 COMMENTS STRIPPED. This gate's FIRST run flagged `ScreenHeader.tsx` itself, because
 *  the prop's own doc comment contains the words `sticky={false}` while explaining how to
 *  opt out. NINTH time a check in this repo has matched a comment, and the second today.
 *  The owner file is also excluded outright: it DECLARES the prop, it does not use it. */
const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
     .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

const OWNER = 'components/ui/ScreenHeader.tsx'

const UI = (): string[] =>
  execSync("git ls-files 'app/**/*.tsx' 'app/*.tsx' 'components/**/*.tsx' 'components/*.tsx'",
    { encoding: 'utf8' })
    .trim().split('\n').filter(f => f && !f.includes('.test.') && f !== OWNER)

/** ⚠️ EVERY OPT-OUT, NAMED, WITH ITS REASON. An unexplained `sticky={false}` is how the
 *  default got stuck pointing the wrong way in the first place. */
const NOT_PINNED: Record<string, string> = {
  'components/marketing/TabbedPhone.tsx':
    'phone MOCKUPS on the marketing homepage. A sticky header inside a fake phone pins to ' +
    'the PAGE, not to the mockup, and would slide out of the device frame as the page scrolls.',
}

describe('BACK-ARROW-TITLE-COLLIDE-01 — pushed screens pin their header', () => {
  it('scans a real corpus (an empty sweep is not a pass)', () => {
    expect(UI().length, 'ui files').toBeGreaterThan(50)
  })

  it('🔴 the default is PINNED, because the screens that can collide never passed the prop', () => {
    const src = readFileSync('components/ui/ScreenHeader.tsx', 'utf8')
    expect(src, 'the sticky default flipped back to false').toMatch(/sticky\s*=\s*true/)
    expect(src, 'the default must not be false').not.toMatch(/sticky\s*=\s*false\s*,/)
  })

  it('🔴 EXHAUSTIVE: every sticky={false} is declared, and every declaration is used', () => {
    // Both directions, so neither a silent new opt-out nor a stale name survives.
    const optedOut = UI().filter(f => /sticky=\{false\}/.test(code(readFileSync(f, 'utf8'))))
    const declared = Object.keys(NOT_PINNED)
    const undeclared = optedOut.filter(f => !declared.includes(f))
    expect(undeclared,
      'a screen opted out of a pinned header with no reason on the page:\n' + undeclared.join('\n'))
      .toEqual([])
    const stale = declared.filter(f => !optedOut.includes(f))
    expect(stale, 'declared as not-pinned but no longer opts out — delete the row:\n' + stale.join('\n'))
      .toEqual([])
    for (const [f, why] of Object.entries(NOT_PINNED)) {
      expect(why.length, `${f}'s reason is too thin to be a reason`).toBeGreaterThan(40)
    }
  })

  it('🔴 no screen pairs a back control with a header that scrolls', () => {
    // THE ARM FOR THE ACTUAL COLLISION. A file that renders both a back control and a
    // ScreenHeader must not opt that header out — that pairing IS the defect.
    const offenders: string[] = []
    for (const f of UI()) {
      const src = readFileSync(f, 'utf8')
      if (!/<(Floating)?BackButton\b/.test(src)) continue
      if (!/<ScreenHeader\b/.test(src)) continue
      if (/sticky=\{false\}/.test(code(src))) offenders.push(f)
    }
    expect(offenders,
      'a floating 44px disc will pass over this screen\'s title:\n' + offenders.join('\n'))
      .toEqual([])
  })

  it('the marketing mockups are genuinely still opted out (the website must not move)', () => {
    // Consumer check, app AND website. Flipping a shared default changes the homepage, and
    // that is the one surface where pinning is actively wrong.
    const src = readFileSync('components/marketing/TabbedPhone.tsx', 'utf8')
    expect((src.match(/sticky=\{false\}/g) ?? []).length, 'both mockup headers stay unpinned')
      .toBe(2)
  })
})
