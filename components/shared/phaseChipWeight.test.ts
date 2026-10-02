// MICRO-LABEL-CHIPS-01 (Design Board, 2026-10-02) — the phase chip carries its
// documented weight.
//
// ── WHAT THE SITTING FOUND ───────────────────────────────────────────────────
// `ui-patterns.md` § Plan voice card documents the phase chip as
// `10px 700 uppercase 0.08em`. The ONE live implementation — `GeneratingCeremony`
// — set size, tracking and transform and **omitted `fontWeight`**, so it
// inherited 400. On the one screen in the app that is meant to feel like a
// moment.
//
// 🔴 AND THE REASON NO CHECK CAUGHT IT IS THE INTERESTING HALF. `microLabel.test.ts`
// excludes anything with a `background` or a `border` as "a chip, not a
// micro-label" — true, and it means **every chip in the app is excluded from the
// only type check the app has**. `MICRO-LABEL-CHIPS-01` was filed on that gap and
// asked for a chip spec; measured, the excluded set is FIVE different jobs (an
// avatar, a phase, a verdict, a countdown, a pointer) and the board ruled
// DON'T SHIP on both a fourth micro-label role and a blanket chip gate:
// "this board does not author a pattern to give a test something to check."
//
// So this is deliberately NARROW. It guards the ONE chip that has a documented
// value, and nothing else. ⚠️ It is not a chip gate and must not grow into one
// without a ruling — the other eight spans are governed by nothing, on purpose,
// and that is recorded rather than hidden.
//
// ⚠️ Silvanto declined the veto for a reason worth keeping: the card the value is
// documented on **has no phase chip at all**, so there was no conforming twin to
// regress against. The doc was asserting a component. That note lives beside the
// documented values in `ui-patterns.md`.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = 'components/GeneratingCeremony.tsx'
const DOC = 'docs/canonical/ui-patterns.md'

describe('MICRO-LABEL-CHIPS-01 — the documented phase chip', () => {
  it('the live phase chip sets fontWeight explicitly, and sets it to 700', () => {
    const src = readFileSync(SRC, 'utf8')
    const at = src.indexOf('{phaseLabel}')
    expect(at, `${SRC} no longer renders {phaseLabel} — this check has lost its subject`)
      .toBeGreaterThan(-1)
    // Bound the enclosing style object rather than grepping the file: the repo's
    // standing rule, and the reason the micro-label scanner is trusted.
    const open = src.lastIndexOf('{{', at)
    expect(open).toBeGreaterThan(-1)
    const blk = src.slice(open, src.indexOf('}}', open) + 2)

    expect(blk, 'the phase chip must not inherit its weight — that is the defect this guards')
      .toMatch(/fontWeight:\s*700/)
    // The rest of the documented value, so a partial drift cannot pass.
    expect(blk).toMatch(/fontSize:\s*'10px'/)
    expect(blk).toMatch(/letterSpacing:\s*'0\.08em'/)
    expect(blk).toMatch(/textTransform:\s*'uppercase'/)
  })

  it('the documented values still say 10px 700 0.08em — if the doc moves, this check is wrong', () => {
    // 🔴 A CHECK THAT HARDCODES A SPEC DRIFTS FROM THE SPEC. This asserts the
    // DOC still carries the values the arm above enforces, so changing one
    // without the other goes red rather than silently diverging.
    const doc = readFileSync(DOC, 'utf8')
    expect(doc).toContain('phase chip `10px 700 --moss uppercase 0.08em`')
  })

  it('the note recording that the documented card has no phase chip is still present', () => {
    // Deleting the note would restore the original defect: a structure block
    // reading as a description of a shipped card that does not exist.
    const doc = readFileSync(DOC, 'utf8')
    expect(doc).toContain('THE PHASE CHIP ON THIS CARD IS NOT IMPLEMENTED')
  })
})
