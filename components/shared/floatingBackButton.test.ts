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

/** ⚠️ EVERY FILE THAT STILL USES A BARE `<BackButton>`, EACH WITH ITS REASON.
 *
 * 🔴 THIS USED TO BE TWO ENTRIES AND A PERMISSIVE ARM, AND THAT IS THE DEFECT THE FOUNDER
 * FOUND. The old check asserted only that the two DECLARED exclusions still used
 * `BackButton`; every OTHER bare use passed in silence. So `BACK-ARROW-FLOAT-01` converted
 * eight doors, I reported the remainder as "inline or declared", and **five pushed screens
 * were quietly left with an arrow that scrolls away** — `Update pace targets` among them,
 * which is the one he opened. Same class as every other short population in this repo:
 * the predicate was right and the SET was a hand-typed pair.
 *
 * So the register is now EXHAUSTIVE. A new bare use fails the build until it is named here,
 * and a name left behind after its `BackButton` goes also fails. Both directions.
 */
const BARE_BACK_BUTTON: Record<string, string> = {
  // ── Pinned GROUPS: arrow and title in one row, sticky together. The other arrow
  //    family, named by `useScrolledContainer` as `BACK-HEADER-OWNER-01`. Floating the
  //    arrow out of one of these tears it off its own title.
  'app/dashboard/DashboardClient.tsx':
    'holds the session and post-run headers, both `.pinned-chrome` groups, AND the two ' +
    'converted screens - a mixed file, so the group arms below check it by position.',
  'app/dashboard/GeneratePlanScreen.tsx':
    'the wizard step header is a pinned GROUP (arrow + ProgressLine). BACK-ARROW-FLOAT-03: ' +
    'floating the arrow alone let "where am I" scroll away and the founder caught it.',
  'components/dashboard/MeScreen.tsx':
    'DeleteAccountScreen is a pinned GROUP (arrow beside "Delete your account"); the rest ' +
    'of the file uses FloatingBackButton.',
  'components/dashboard/SupportScreen.tsx':
    'a pinned GROUP - arrow beside "Contact support". BACK-ARROW-FLOAT-04.',

  // ── Not pushed screens. A hovering arrow inside a tile is meaningless: it has no
  //    scroller of its own to hover against, so `position: sticky` would resolve to the
  //    page and the arrow would wander away from the tile it belongs to.
  'app/dashboard/RecalibrationTile.tsx':
    'a TILE, not a screen. Its arrow sits inline with `marginLeft: -10px` against the ' +
    'tile edge and owns no scroll container.',
  'components/shared/ModifyPlanConfirm.tsx':
    'a confirm surface, not a pushed screen. It is short by construction - if it ever ' +
    'scrolls, that is the defect, not the arrow.',

  'components/ui/ScreenHeader.tsx':
    'the pinned-band owner for screens that use it. BACK-ARROW-TITLE-COLLIDE-01 am.1 put ' +
    'the arrow INSIDE the band: rendered beside it, the opaque header covered it on scroll ' +
    'and the screen had a title and no way back.',
  // ── The two components that OWN a back-arrow placement.
  'components/shared/PinnedBackHeader.tsx':
    'the pinned-band owner (BACK-ARROW-TITLE-COLLIDE-01). It renders the bare arrow by ' +
    'design, exactly as FloatingBackButton does, and is the reason five screens do not ' +
    'each hand-roll a band.',
  // ── The component itself.
  'components/shared/FloatingBackButton.tsx':
    'the wrapper that owns the floating placement. It renders the bare arrow by design.',

  // ── Retired surface.
  'components/dashboard/QuitTab.tsx':
    'the smoke tracker, REMOVED from all UI surfaces (CLAUDE.md, Phase 1). Its BackHeader ' +
    'is an arrow-beside-title group and would be pinned if the surface ever returned; ' +
    'pinning a screen no runner can reach is work with no reader.',
}

/** Files that must carry a `.pinned-chrome` group rather than a floating arrow. */
const PINNED_GROUPS = [
  'app/dashboard/DashboardClient.tsx',
  'app/dashboard/GeneratePlanScreen.tsx',
  'components/dashboard/MeScreen.tsx',
  'components/dashboard/SupportScreen.tsx',
]

describe('BACK-ARROW-FLOAT-01 — one owner for where the arrow sits', () => {
  it('scans a real corpus (an empty sweep is not a pass)', () => {
    expect(UI().length, 'ui files').toBeGreaterThan(50)
  })

  it('🔴 no file hand-rolls a wrapper around BackButton again', () => {
    // The exact shape that was written eight ways: a positioning div whose only child
    // is the arrow. That is what `FloatingBackButton` now owns.
    // ⚠️ THE TWO OWNERS ARE EXEMPT, because owning that wrapper is the whole point of
    // them: `FloatingBackButton` (the hovering circle) and `ScreenHeader` (the arrow inside
    // the pinned band, BACK-ARROW-TITLE-COLLIDE-01 am.1).
    const WRAPPER_OWNERS = [
      'components/shared/FloatingBackButton.tsx',
      'components/ui/ScreenHeader.tsx',
      'components/shared/PinnedBackHeader.tsx',
    ]
    const offenders: string[] = []
    for (const f of UI()) {
      if (WRAPPER_OWNERS.includes(f)) continue
      const src = readFileSync(f, 'utf8')
      if (!src.includes('<BackButton')) continue
      const re = /<div style=\{\{[^}]*\}\}>\s*<BackButton[^/]*?\/>\s*<\/div>/g
      if (re.test(src)) offenders.push(f)
    }
    expect(offenders,
      'a positioning div wrapping BackButton is FloatingBackButton\'s job:\n' + offenders.join('\n'))
      .toEqual([])
  })

  it('🔴 EXHAUSTIVE: every bare BackButton file is declared, and every declaration is used', () => {
    // The arm the founder's report replaced. Both directions, so neither a new silent
    // opt-out nor a stale name survives.
    const bare = UI().filter(f => readFileSync(f, 'utf8').includes('<BackButton'))
    const declared = Object.keys(BARE_BACK_BUTTON)
    const undeclared = bare.filter(f => !declared.includes(f))
    expect(undeclared,
      'a pushed screen cannot opt out of the floating arrow in silence. Convert it to ' +
      '`FloatingBackButton`, pin it as a group, or declare it with a reason:\n' +
      undeclared.join('\n')).toEqual([])
    const stale = declared.filter(f => !bare.includes(f))
    expect(stale, 'declared as a bare BackButton user but no longer one - delete the row:\n' +
      stale.join('\n')).toEqual([])
    // A reason with no content in it is not a reason.
    for (const [f, why] of Object.entries(BARE_BACK_BUTTON)) {
      expect(why.length, `${f}'s reason is too thin to be a reason`).toBeGreaterThan(40)
    }
  })

  it('🔴 every pinned-group file actually pins something', () => {
    // A file declared as a GROUP and carrying no `.pinned-chrome` is a screen whose arrow
    // scrolls away with a reason written beside it. That is worse than no reason.
    for (const f of PINNED_GROUPS) {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} is declared a pinned group and pins nothing`).toContain('pinned-chrome')
      expect(src, `${f} pins without the shared scroll-state owner, so its edge never reveals`)
        .toContain('useScrolledContainer')
    }
  })

  it('🔴 the five screens the founder\'s report uncovered all float their arrow', () => {
    // BACK-ARROW-FLOAT-04. Named individually, because "the file imports
    // FloatingBackButton somewhere" is what let `Update pace targets` pass: MeScreen and
    // DashboardClient both already imported it while still carrying a bare arrow.
    // 🔴 THIS ARM LISTED `BenchmarkUpdateScreen` AND `FaqScreen` AS FLOATING, AND WENT RED
    // ON BACK-ARROW-TITLE-COLLIDE-01 — correctly. Both hand-roll their own title, so the
    // founder's device screenshots showed the floating disc free to park on it mid-word.
    // They now pin through `PinnedBackHeader`. **The arm follows the decision rather than
    // being deleted**: what it guards is that these screens have ONE owner for where the
    // arrow sits, and that is still true — the owner changed.
    // 🔴 THIS LIST HAS GROWN TWICE AS THE RULING COMPLETED. Every pushed screen now pins
    // rather than floats: the five hand-rolled ones through `PinnedBackHeader`, and the
    // `ScreenHeader` family through its own `onBack`. The arm follows the decision.
    const PINNED_INSTEAD: string[] = [
      'app/dashboard/BenchmarkUpdateScreen.tsx',
      'components/shared/FaqScreen.tsx',
      'app/dashboard/UpgradeScreen.tsx',
      'app/dashboard/FounderNoteScreen.tsx',
      'app/dashboard/RedeemCodeScreen.tsx',
    ]
    for (const f of PINNED_INSTEAD) {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} must not float its arrow over its own title`)
        .not.toContain('<FloatingBackButton')
      expect(src, `${f} lost its pinned header`).toContain('<PinnedBackHeader')
    }
    // The three inside mixed files are checked by their own `backBtn` binding, which is
    // what the padded header used to hold.
    // 🔴 AND THE HUB AND ME NO LONGER FLOAT AN ARROW AT ALL. Notifications and the four
    // Me doors take `ScreenHeader onBack`; Reshape and Plan history take `PinnedBackHeader`.
    for (const f of ['app/dashboard/DashboardClient.tsx', 'components/dashboard/MeScreen.tsx']) {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} floats an arrow beside a pinned header again`)
        .not.toContain('<FloatingBackButton')
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

  it('the session detail header stays a pinned GROUP too', () => {
    // 🥇 THIS ONE WAS ALREADY RIGHT — `SessionScreen` has pinned its header since the
    // founder asked for it, and the comment above it records that the FIRST attempt only
    // CLAIMED to: `position: sticky` against a wrapper declaring `overflow-y: auto` with
    // `min-height: 100%`, a scrollport that can never scroll, measured at -800px after an
    // 800px scroll. `stickyScroller.test.ts` guards that class from returning.
    //
    // What nothing guarded is the arrow being lifted OUT of the group — exactly what I
    // did to the wizard before the founder caught it. Same arm, same reason.
    const src = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    const i = src.indexOf("className={`pinned-chrome")
    expect(i, 'the session header is not pinned').toBeGreaterThan(-1)
    const open = src.lastIndexOf('<div', i)
    const close = src.indexOf('\n      </div>', i)
    const group = src.slice(open, close)
    expect(group, 'the arrow must stay inside the pinned group').toContain('<BackButton')
    expect(group, 'and it must not float out of it').not.toContain('<FloatingBackButton')
    expect(group, 'z-index from the owner, never a literal').toContain('Z_LAYERS.screenHeader')
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
