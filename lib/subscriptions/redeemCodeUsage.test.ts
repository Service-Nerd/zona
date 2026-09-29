import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { REDEEM_CODE_LABEL, REDEEM_CODE_PLACEMENTS } from './redeemCode'

// CHARITY-CODE-CONTROL-01 (Design Board, 2026-09-28) — the mechanical check the board
// required, replacing a comment that asked the next person not to reword the string.
//
// 🔴 WHAT IT REPLACES. Three placements each typed the string out, held together only by
// this note beside one of them: *"a third phrasing of the same string is how surfaces
// drift apart (the reason the existing door reuses the other two doors' wording)."* A
// note is not a mechanism, and this repo's record says a rule that holds only while
// someone remembers is not a rule.
//
// ⚠️ THE POPULATION IS DERIVED, NOT TRUSTED. `REDEEM_CODE_PLACEMENTS` is hand-written,
// and a hand-written population is the failure this repo recorded four times in one week
// (`sheetClose.test.ts`'s four typed paths, `buttonGeometry`'s already-compliant filter,
// a `file:line` baseline key, an anchored `color:`). So this walks the TRACKED files for
// the control and fails in BOTH directions: an undeclared placement, and a declared one
// that has vanished.
//
// ⚠️ IT USES `git ls-files`, SO A NEW FILE MUST BE STAGED TO BE SEEN. That is recorded
// because it has already cost a green run on a component that existed only on disk.

// 🔴 GATE-GLOB-SHORT-01 (2026-09-29): `git ls-files "app/**/*.tsx"` returns 129 files;
// the truth is 134 — git's `**/` needs a directory level, so files sitting DIRECTLY under
// `app/` or `components/` were invisible, including `app/page.tsx`. Measured 0 extra
// violations today: LATENT, not costly. Fixed in all five gates that shared it.
const tracked = (): string[] =>
  execSync('git ls-files', { encoding: 'utf8' })
    .split('\n').filter(Boolean)
    .filter(f => /^(app|components)\/.*\.tsx$/.test(f))

const OWNER = 'components/shared/RedeemCodeLink.tsx'

/** Files that RENDER the control, derived from the source rather than declared. */
function rendersControl(): string[] {
  return tracked().filter(f => {
    if (f === OWNER) return false
    return /<RedeemCodeLink[\s/>]/.test(readFileSync(f, 'utf8'))
  })
}

describe('CHARITY-CODE-CONTROL-01 — one control, one string, declared placements', () => {
  it('every placement that renders the control is declared', () => {
    const found = rendersControl().sort()
    const declared = REDEEM_CODE_PLACEMENTS.map(p => p.file).sort()
    expect(found, 'an undeclared placement, or a declared one that has gone').toEqual(declared)
  })

  // Guards the arm above against the emptiness that makes every other arm pass.
  it('the derived population is not empty', () => {
    expect(rendersControl().length).toBeGreaterThan(0)
  })

  // 🔴 WROBLEWSKI'S BLOCKING CONDITION, AS A TEST.
  // `presentCodeRedemptionSheet()` returns `Promise<void>` — no success, no cancellation,
  // no error — so a placement that does not re-check afterwards dismisses the sheet and
  // leaves the screen unchanged, and the runner taps it again believing it failed.
  //
  // ⚠️ THIS PROVES THE PROP IS PASSED, NOT THAT THE CALLBACK RECONCILES. The callback is
  // `runEntitlementRecheck` in `DashboardClient.tsx`, which lives under `app/` where
  // vitest does not collect. Stating the limit rather than implying the check is wider
  // than it is.
  it('every placement passes onAfterSheet', () => {
    for (const f of rendersControl()) {
      const src = readFileSync(f, 'utf8')
      const uses = src.match(/<RedeemCodeLink[\s\S]{0,400}?\/>/g) ?? []
      expect(uses.length, `${f}: no self-closing usage parsed`).toBeGreaterThan(0)
      for (const u of uses) {
        expect(u, `${f}: a placement with no onAfterSheet cannot report an outcome`)
          .toMatch(/onAfterSheet=/)
      }
    }
  })

  it('the label lives in the constant and nowhere else', () => {
    const owner = readFileSync(OWNER, 'utf8')
    expect(owner).toMatch(/\bREDEEM_CODE_LABEL\b/)
    // The words must not be typed into the component beside the constant.
    expect(owner).not.toContain(`'${REDEEM_CODE_LABEL}'`)
    for (const f of rendersControl()) {
      expect(readFileSync(f, 'utf8'), `${f} should render the control, not restate it`)
        .not.toContain(REDEEM_CODE_LABEL)
    }
  })

  // 🔴 The old string named a programme. Apple's sheet is generic and the same control is
  // about to serve ambassador and discount codes, so a label naming one programme is a
  // label rewritten every time a programme is added.
  //
  // ⚠️ SCOPED TO THE APP, AND THE MARKETING PAGE IS A DECLARED DEBT BELOW rather than an
  // exclusion. Scoping a check to the surfaces that already pass is this repo's
  // population-failure class; naming the one that fails, with its owner, is not.
  it('no programme-specific label survives in the app', () => {
    const offenders = tracked()
      .filter(f => f.startsWith('app/dashboard/') || f.startsWith('components/'))
      .filter(f => /Have a charity code/i.test(readFileSync(f, 'utf8')))
    expect(offenders, 'the programme-named label is retired from the app').toEqual([])
  })

  // 🔴 FOUNDER-OWNED COPY DEBT, DECLARED SO IT IS VISIBLE RATHER THAN EXCLUDED.
  //
  // `/charity-runners` carries a three-step "If you have a code" section, and
  // CHARITY-CODE-CONTROL-01 plus the move to Apple offer codes makes **all three steps
  // wrong**, not just the label:
  //
  //   1. "Download the app" first — the real journey is REDEEM first, by URL, and Apple
  //      prompts the download. Measured twice on 2026-09-28.
  //   2. 'Open Me, then "Have a charity code?" ... Type the code' — there is no text field
  //      any more and the label has changed.
  //   3. "That is when your access stretches to cover race day, so it cannot run out
  //      mid-block" — an Apple offer code has a FLAT duration. It cannot stretch.
  //
  // ⚠️ THE WORDS ARE THE FOUNDER'S AND I AM NOT REWRITING THEM. The SLT routed this page
  // to him. This arm holds the debt at exactly one file so it cannot grow, and fails if a
  // SECOND surface starts describing redemption incorrectly.
  it('the founder-owned copy debt does not grow beyond the one known page', () => {
    const FOUNDER_COPY_DEBT = ['app/charity-runners/page.tsx']
    const describing = tracked()
      .filter(f => !f.startsWith('app/dashboard/') && !f.startsWith('components/'))
      .filter(f => /Have a charity code/i.test(readFileSync(f, 'utf8')))
    expect(describing.sort(), 'a new surface is describing code redemption the old way')
      .toEqual(FOUNDER_COPY_DEBT)
  })

  it('the label names no programme', () => {
    expect(REDEEM_CODE_LABEL.toLowerCase()).not.toMatch(/charity|ambassador|make-?a-?wish|discount/)
  })
})
