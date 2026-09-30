import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { REDEEM_CODE_LABEL } from '@/lib/subscriptions/redeemCode'

// REDEEM-MECHANISM-TRUTH-01 (2026-09-30) — no surface may describe a redemption
// mechanism the product no longer has.
//
// 🔴 THE DEFECT THIS EXISTS FOR, FOUND BY THE FOUNDER PREPARING A PARTNER DECK.
// `CHARITY-CODE-CONTROL-01` (2026-09-28) retired the hand-rolled code screen — a
// licence-key text field redeeming outside IAP is **Apple Guideline 3.1.1** — and
// replaced it with Apple's own sheet. The code half shipped. `/charity-runners`,
// the page the partner's runners are SENT TO, went on instructing them for two more
// days to "Open Me, then 'Have a charity code?'" and type a `ZONNA-XXXX-XXXX` code
// into a screen that is now unreachable.
//
// ⚠️ NOTHING WAS WRONG WITH THE PAGE WHEN IT WAS WRITTEN, which is the whole class:
// the mechanism moved and the page describing it did not. `noEmDashApp` guards the
// PUNCTUATION of this copy and `pricing.test.ts` guards its PAID-FEATURE rows, so the
// page had two mechanical checks and neither could see it had become false.
//
// ⚠️ IT GUARDS THE MECHANISM, NOT THE PROSE. There is no check for "is this sentence
// true", and inventing one would fire on every rewrite. What it can do is assert that
// the two artefacts of the RETIRED mechanism — its label and its code format — appear
// nowhere a runner reads, and that the one label that does appear is the owner's.

/** Every surface a runner or a partner's runner can read. Derived, never hand-typed. */
const SURFACES = () => {
  const files = execSync(
    "git ls-files 'app/**/*.tsx' 'app/*.tsx' 'components/**/*.tsx' 'components/*.tsx'",
    { encoding: 'utf8' }).trim().split('\n')
    .filter(f => f && !f.includes('.test.') && !f.includes('__fixtures__'))
  // An empty population passes every assertion below it — the quietest way a gate dies.
  expect(files.length, 'the surface scan found no files').toBeGreaterThan(20)
  return files
}

/** Strip comments: this repo's comments quote retired strings to explain them. */
const code = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

describe('REDEEM-MECHANISM-TRUTH-01 — the retired code screen is not described anywhere', () => {
  // 🔴 THE EXACT STRING THE PARTNER PAGE CARRIED. The label moved to `REDEEM_CODE_LABEL`
  // ('Have a code?') when the control became Apple's sheet, and prose that still says
  // "charity code" is prose written against the screen that went away.
  it('no surface says "Have a charity code?"', () => {
    const bad = SURFACES().filter(f => /Have a charity code/i.test(code(readFileSync(f, 'utf8'))))
    expect(bad, 'the retired label is still on a runner-facing surface:\n' + bad.join('\n')).toEqual([])
  })

  // The `ZONNA-XXXX-XXXX` format was OURS. Apple offer codes look nothing like it, so a
  // page showing that shape is teaching a runner to expect the wrong thing.
  it('no surface shows the retired ZONNA-XXXX code format', () => {
    const bad = SURFACES().filter(f => /ZONNA\s*-\s*X{4}/i.test(code(readFileSync(f, 'utf8'))))
    expect(bad, 'the retired code format is still shown:\n' + bad.join('\n')).toEqual([])
  })

  // ⚠️ AND THE POSITIVE HALF, because the two arms above pass on a page that says
  // nothing at all. The partner page must still tell a runner where the door is, and
  // must name it with the OWNER's label rather than a second spelling of it.
  it('the charity page points at the door, using the owner’s label', () => {
    const src = code(readFileSync('app/charity-runners/page.tsx', 'utf8'))
    // The label carries a '?' which is fine inside a string; compare on the words.
    const label = REDEEM_CODE_LABEL.replace(/[?]/g, '')
    expect(src, `the page no longer names the in-app door (${REDEEM_CODE_LABEL})`)
      .toContain(label)
    expect(src, 'the page must send runners to the link first, which is the primary route')
      .toMatch(/App Store/)
  })

  // The expiry is the fact most likely to rot next: it changed from "a week past race
  // day" (the Supabase grant) to twelve months (an Apple annual at zero price), and a
  // partner deck quotes whatever this page says.
  it('the charity page states the twelve-month window, not the retired race-day one', () => {
    const src = code(readFileSync('app/charity-runners/page.tsx', 'utf8'))
    expect(src, 'the twelve-month window is not stated').toMatch(/[Tt]welve months/)
    expect(src, 'the retired grant window is still promised')
      .not.toMatch(/stretches to cover it|week past race day/)
  })
})
