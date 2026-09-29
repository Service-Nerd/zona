import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { Z_LAYERS } from '@/lib/ui/zLayers'

// BACK-ARROW-FLOAT-01 — the arrow floats, and its placement has one owner.
//
// 🔴 THE THING THIS GUARDS IS NOT THE FLOATING, IT IS THE WRAPPER. `BackButton` was
// already the single arrow (UI-BACKARROW-01) — and its PLACEMENT was hand-written at 25
// call sites in EIGHT wrapper shapes, so "make it float" had no single place to happen.
// A hand-written wrapper coming back would not break anything visible; it would just
// quietly not float, on one screen, and nobody would notice. Same class as `SectionLabel`
// and `ACTION-ROW-01`: a pattern that is a local variable cannot travel.

const UI = (): string[] =>
  execSync("git ls-files 'app/**/*.tsx' 'app/*.tsx' 'components/**/*.tsx' 'components/*.tsx'",
    { encoding: 'utf8' })
    .trim().split('\n').filter(f => f && !f.includes('.test.'))

/** ⚠️ DECLARED, DATED EXCLUSIONS — not a loophole, and each names WHY it is not a pushed
 *  screen. A hovering arrow inside a tile is meaningless: it has no scroller of its own
 *  to hover against, so `position: sticky` would resolve to the page and the arrow would
 *  wander away from the tile it belongs to. */
const NOT_PUSHED_SCREENS: Record<string, string> = {
  'app/dashboard/RecalibrationTile.tsx':
    'a TILE, not a screen. Its arrow sits inline with `marginLeft: -10px` against the ' +
    'tile edge and owns no scroll container.',
  'components/shared/ModifyPlanConfirm.tsx':
    'a confirm surface, not a pushed screen. It is short by construction — if it ever ' +
    'scrolls, that is the defect, not the arrow.',
}

describe('BACK-ARROW-FLOAT-01 — one owner for where the arrow sits', () => {
  it('scans a real corpus (an empty sweep is not a pass)', () => {
    expect(UI().length, 'ui files').toBeGreaterThan(50)
  })

  it('🔴 no file hand-rolls a wrapper around BackButton again', () => {
    // The exact shape that was written eight ways: a positioning div whose only child
    // is the arrow. That is what `FloatingBackButton` now owns.
    const offenders: string[] = []
    for (const f of UI()) {
      const src = readFileSync(f, 'utf8')
      if (!src.includes('<BackButton')) continue
      const re = /<div style=\{\{[^}]*\}\}>\s*<BackButton[^/]*?\/>\s*<\/div>/g
      if (re.test(src)) offenders.push(f)
    }
    expect(offenders,
      'a positioning div wrapping BackButton is FloatingBackButton\'s job:\n' + offenders.join('\n'))
      .toEqual([])
  })

  it('every remaining bare BackButton is either inline or a DECLARED exclusion', () => {
    // Bare uses are legitimate — an arrow beside a title, a wizard step. What must not
    // happen is a pushed screen quietly opting out with no reason on the page.
    const bare = UI().filter(f => {
      const src = readFileSync(f, 'utf8')
      return src.includes('<BackButton') && !src.includes('FloatingBackButton')
    })
    for (const f of Object.keys(NOT_PUSHED_SCREENS)) {
      expect(bare, `${f} is declared as not-a-pushed-screen but no longer uses BackButton — ` +
        'delete the exclusion').toContain(f)
    }
    // Every declared exclusion must still carry a reason with real content in it.
    for (const [f, why] of Object.entries(NOT_PUSHED_SCREENS)) {
      expect(why.length, `${f}'s exclusion reason is too thin to be a reason`).toBeGreaterThan(40)
    }
  })

  it('the floating wrapper sits ABOVE content and far BELOW the nav', () => {
    const src = readFileSync('components/shared/FloatingBackButton.tsx', 'utf8')
    expect(src, 'z-index comes from the Z_LAYERS owner, never a literal')
      .toContain('Z_LAYERS.screenHeader')
    expect(src).not.toMatch(/zIndex:\s*\d+/)
    // Ordering contract: an arrow is page furniture. A sheet or the nav paints over it.
    expect(Z_LAYERS.screenHeader).toBeGreaterThan(Z_LAYERS.content)
    expect(Z_LAYERS.screenHeader).toBeLessThan(Z_LAYERS.nav)
  })

  it('🔴 the rest position equals the stick point, so it cannot jump on first scroll', () => {
    // A 4px shift the moment a screen moves is a visible flinch on exactly the screens
    // this is meant to calm — the same reason `.pinned-chrome`'s border starts
    // transparent rather than appearing.
    const src = readFileSync('components/shared/FloatingBackButton.tsx', 'utf8')
    const top = /top:\s*'([^']+)'/.exec(src)?.[1]
    const margin = /margin:\s*'([^']+)'/.exec(src)?.[1]
    expect(top, 'sticky offset').toBeTruthy()
    expect(margin?.split(' ')[0], 'rest offset must equal the stick offset').toBe(top)
  })

  it('carries a DOCUMENTED elevation, not a new one', () => {
    // Silvanto's craft condition, and the only reason this differs visually from the old
    // arrow. "No chrome" forbids STACKED shadows, not a single documented elevation.
    const src = readFileSync('components/shared/FloatingBackButton.tsx', 'utf8')
    expect(src).toMatch(/boxShadow:\s*'var\(--shadow-(card|lifted)\)'/)
    // One shadow. A second would be the stacked-shadow the rule actually bans.
    expect((src.match(/boxShadow/g) ?? []).length, 'exactly one shadow declaration').toBe(1)
  })

  it('🔴 a CAPTIONED float carries a ground, because its label has none of its own', () => {
    // BACK-ARROW-FLOAT-02. `BackButton`'s captioned form is a GHOST button: only the 44px
    // circle carries `--bg-soft` and the label span carries nothing. Floated without a
    // ground, "Adjust inputs" would be bare text over whatever scrolls beneath it — worse
    // than the smudge the shadow exists to prevent. Remove the ground and this goes red.
    const src = readFileSync('components/shared/FloatingBackButton.tsx', 'utf8')
    const branch = src.slice(src.indexOf('...(caption'), src.indexOf('...(caption') + 260)
    expect(branch, 'the captioned branch needs a card ground').toContain("background: 'var(--card)'")
    expect(branch, 'and a pill radius, not a circle').toContain("borderRadius: '999px'")
    // The UNCAPTIONED float must stay a bare circle — it has no label needing a ground,
    // and giving it one would be inventing a surface to solve a problem it does not have.
    expect(branch, 'uncaptioned stays a circle').toContain("borderRadius: '50%'")
    expect(branch, 'uncaptioned must NOT gain a background').not.toMatch(/\}\s*:\s*\{[^}]*background/)
  })

  it('🔴 the wizard step pins arrow AND progress as ONE group', () => {
    // BACK-ARROW-FLOAT-03. Floating the arrow alone kept the exit and let "where am I"
    // scroll away — the founder caught that. Splitting them again would not break
    // anything visible; the progress cue would just quietly stop being there on long
    // steps, which is precisely how this was missed the first time.
    const src = readFileSync('app/dashboard/GeneratePlanScreen.tsx', 'utf8')
    const i = src.indexOf('pinned-chrome')
    expect(i, 'the step header is not pinned at all').toBeGreaterThan(-1)
    // 🔴 BOUNDED BY THE CONTAINER, NOT BY A CHARACTER BUDGET — and the first cut of this
    // arm was the budget version. `src.slice(i, i + 900)` PASSED when I moved
    // `<ProgressLine>` out of the pinned div, because it was still within 900 characters
    // of the class name. That is the same defect as the brand-string scan that counted a
    // BUTTON because `BRAND.name` sat in a sentence 200 chars below it. A region measured
    // in bytes is not a region.
    //
    // The container's children are indented 8 spaces and it closes at 6, so the element
    // ends at the first `\n      </div>` after it.
    const open = src.lastIndexOf('<div', i)
    const close = src.indexOf('\n      </div>', i)
    expect(close, 'could not find the pinned container\'s close').toBeGreaterThan(open)
    const group = src.slice(open, close)
    expect(group, 'the pinned group must contain the back arrow').toContain('<BackButton')
    expect(group, 'and the progress line — that is the whole point of the group')
      .toContain('<ProgressLine')
    // The arrow must NOT also float independently, or there are two stickies.
    expect(group).not.toContain('<FloatingBackButton')
  })

  it('does not swallow taps across the top of the screen', () => {
    // A sticky FULL-WIDTH strip would sit over the whole top edge and eat taps meant for
    // the content behind it. The wrapper is the circle's size and nothing more.
    const src = readFileSync('components/shared/FloatingBackButton.tsx', 'utf8')
    // 🔴 WHITESPACE-TOLERANT ON PURPOSE. The first cut asserted the exact string
    // `width:        'fit-content'` with its column alignment, and went red the moment
    // the style block was reformatted — nothing about the behaviour changed. That is the
    // same brittleness as the micro-label regexes that required exactly one space and
    // hid 13 labels. Assert the property, never the indentation.
    expect(src).toMatch(/width:\s*'fit-content'/)
  })
})
