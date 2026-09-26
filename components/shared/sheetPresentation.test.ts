import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { Z_LAYERS } from '@/lib/ui/zLayers'

// SHEET-PRESENT-01 — the presentation contract, enforced.
//
// Seven hand-rolled sheets each invented their own z-index; five sat below the
// bottom nav (100 / 200 / 2000) and the founder could not see the panel that
// opened over them. The fix is one <Sheet> primitive; these tests make copying
// the old pattern back a build failure, not a device-only regression nobody can
// reproduce.

const ROOT = join(__dirname, '..', '..')

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
}

describe('Sheet primitive is the single owner of sheet presentation', () => {
  const src = read('components/shared/Sheet.tsx')

  it('renders through a portal so it escapes the scrolling content container', () => {
    expect(src).toContain('createPortal')
  })

  it('takes its z-index from the shared ladder, never a hardcoded number', () => {
    expect(src).toContain('Z_LAYERS.sheet')
    // No four-digit zIndex literal (the old 2000/4000/4001 guesses).
    expect(src).not.toMatch(/zIndex:\s*\d{3,}/)
  })

  // S1 (Design Board 2026-09-22) — the sheet COVERS the nav.
  //
  // 🔴 THIS TEST USED TO ASSERT THE OPPOSITE RULE AND COULD NOT ENFORCE IT. It
  // read `expect(src).toContain('paddingBottom')`, which `paddingBottom: 0`
  // satisfies just as well as `paddingBottom: navH`. So the rule the reversal
  // overturned had a green tick with nothing behind it for nine days — the
  // `--section-gap` class again, found while reversing the rule it guarded.
  it('the backdrop reserves NOTHING at the bottom — the panel covers the nav', () => {
    const i = src.indexOf("position: 'fixed', inset: 0, zIndex: Z_LAYERS.sheet")
    expect(i, 'the backdrop style block').toBeGreaterThan(-1)
    const backdrop = src.slice(i, i + 600)
    expect(backdrop).toMatch(/paddingBottom:\s*0\b/)
    // The specific thing that is gone: reserving the measured nav height, which
    // left the nav visible, scrimmed at 40% ink, and wired to dismiss.
    expect(backdrop).not.toMatch(/paddingBottom:\s*`\$\{navH\}px`/)
  })

  it('but the measured nav height is still CONSUMED — by the height bound', () => {
    // It no longer positions anything. It keeps a tall sheet's own content out
    // of the home-indicator strip, which is why the context still exists.
    expect(src).toContain('useNavHeight')
    expect(src).toMatch(/maxHeight:[^\n]*\$\{navH\}px/)
  })

  it('the panel clears the home indicator itself, now that the nav does not', () => {
    // Same doctrine as A4: the safe-area inset is a reserved strip, ADDED, never
    // spent as content padding. Without this the close bar the standing rule
    // puts at the panel's bottom sits under the home bar.
    // ⚠️ RE-ANCHORED, NOT RELAXED (SHEET-ORIGIN-01). This keyed off
    // `borderRadius: '20px 20px 0 0'` — a VALUE the Design Board then changed to
    // 22px when sheets became pill-width objects rather than drawers. The rule
    // being asserted is the safe-area padding, which is unchanged; only the
    // landmark moved. Anchored on the panel's shadow instead, which is not a
    // number anyone is likely to rule on.
    const i = src.indexOf("boxShadow: '0 -8px 24px")
    expect(i, 'the panel block has moved — re-anchor this test').toBeGreaterThan(-1)
    expect(src.slice(i, i + 900)).toContain("paddingBottom: 'env(safe-area-inset-bottom, 0px)'")
  })

  /**
   * SHEET-ORIGIN-01 — six rounds of founder feedback, now in the primitive.
   * "Pop-ups should come out of the nav pill, be the width of the pill, and go
   * back into it." Two corrections came from the preview and both are load-bearing.
   */
  describe('SHEET-ORIGIN-01', () => {
    it('🔴 the panel is PILL WIDTH, which is what makes the entry readable', () => {
      // 📐 At pill width the entry transform's HORIZONTAL scale is exactly 1, so
      // the panel stops squashing its own text and needs no counter-fade. The
      // whole animation becomes one number. Full-width was the reason rounds 1-3
      // looked like "a squashed panel un-squashing".
      expect(src).toMatch(/width: `calc\(100% - \$\{PILL_INSET \* 2\}px\)`/)
      expect(src, 'the pill maxes at 448, so a wider sheet would not match it')
        .toMatch(/Math\.min\(maxWidth, PILL_MAXW\)/)
      // 🔴 THE PANEL RESTS ON THE PILL, NOT ON THE VIEWPORT FLOOR. The first cut
      // wrote `margin-bottom: -26px`, which on an `align-items: flex-end`
      // container pushed the panel 26px BELOW the screen edge and covered the
      // pill entirely — measured, panel bottom 838 against a pill top of 738.
      // It must be lifted by the nav height and pushed back by the overlap.
      expect(src, 'the foot tucks behind the pill; it does not sit under the screen')
        .toMatch(/marginBottom: `\$\{Math\.max\(0, navH - PILL_OVERLAP\)\}px`/)
      // ⚠️ The resting position and the transform's idea of it are TWO
      // STATEMENTS OF ONE NUMBER, and they disagreed on the first cut. Same
      // expression, both places, or the sheet grows from the wrong point.
      const occurrences = (src.match(/Math\.max\(0, navH - PILL_OVERLAP\)/g) ?? []).length
      expect(occurrences, 'the rest position and `closedTransform` must derive it identically')
        .toBeGreaterThanOrEqual(2)
      expect(src, 'a pill-width sheet is an object and carries the chrome edge')
        .toMatch(/var\(--chrome-edge\)/)
    })

    it('🔴 it grows from the control the runner PRESSED, not from the pill', () => {
      // The runner never taps the nav pill — they tap a card, a chip, an "i"
      // mark. Growing from the pill attributes the sheet to a control they did
      // not touch. The pill's top edge is the FALLBACK, not the default.
      expect(src).toMatch(/lastPressedRect\(\)/)
      expect(src, 'and the panel must actually be measured, not guessed')
        .toMatch(/closedTransform/)
    })

    it('🔴 the curve TRAVELS before it bounces — this is the round-6 fix', () => {
      // 📐 A front-loaded spring reaches 90% in 16% of its duration: at 360ms the
      // journey finished in 57ms and the rest was oscillation in place, so the
      // founder reported "it still comes from the bottom" about a sheet that
      // provably grew from his own tap. The origin was real and IMPERCEPTIBLE.
      //
      // ⚠️ THE RULE: on an origin-anchored transition, optimise TIME SPENT
      // TRAVELLING, not time to arrival. This curve is 90% at 56% of duration.
      expect(src).toMatch(/ENTER_EASE\s*=\s*'cubic-bezier\(0\.65, 0, 0\.35, 1\.55\)'/)
      // ⚠️ COMMENTS STRIPPED FOR THE NEGATIVE. `Sheet.tsx`'s own comment quotes
      // the old curve to explain why it went — and the first cut of this arm
      // matched that prose and failed. **Fifth time in this repo a guard has
      // fired on the documentation of the defect it guards**, and a guard that
      // does that gets switched off.
      const blank = (m: string) => m.replace(/[^\n]/g, '')
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, blank)
        .replace(/^[ \t]*\/\/.*$/gm, '')
      expect(code, 'the front-loaded curve is what caused the report')
        .not.toMatch(/cubic-bezier\(0\.18,/)
      const ms = src.match(/ENTER_MS\s*=\s*(\d+)/)
      expect(ms, 'ENTER_MS must be declared').not.toBeNull()
      expect(Number(ms![1]), 'below ~380 the 235ms travel half disappears again')
        .toBeGreaterThanOrEqual(380)
    })

    it('🔴 the RENDER does not own transform — React wins over an imperative write', () => {
      // 🔴 THIS IS THE DEFECT THAT SHIPPED AND REACHED THE FOUNDER. The enter
      // animation moved into a layout effect and these two declarative lines
      // stayed:
      //     transform: shown ? `translateY(${dragY}px)` : 'translateY(100%)'
      //     transition: dragY > 0 ? 'none' : 'transform 0.28s …'
      // The effect painted the closed frame at the tapped control, `setShown`
      // re-rendered, React re-applied the style prop, and BOTH the origin and
      // the 420ms curve were overwritten with the old bottom slide. Every new
      // value was verifiably in the production bundle and none of them ran.
      //
      // ⚠️ A declarative style prop and an imperative style write cannot both
      // own a property. React wins, on every render.
      const panel = src.slice(src.indexOf('ref={panelRef}'))
      const style = panel.slice(panel.indexOf('style={{'), panel.indexOf('}}\n      >'))
      expect(style, 'transform belongs to the effect now, in all three phases')
        .not.toMatch(/(^|[^-\w])transform:/)
      expect(style, 'so does the transition')
        .not.toMatch(/(^|[^-\w])transition:/)
      // …and all three phases must actually set it.
      expect(src, 'enter').toMatch(/panel\.style\.transform = 'translateY\(0px\) scaleY\(1\)'/)
      expect(src, 'drag').toMatch(/panel\.style\.transform = `translateY\(\$\{v\}px\)`/)
      expect(src, 'exit retracts to the SAME origin').toMatch(/panel\.style\.transform = closedTransform\(\)/)
    })

    it('🔴 reduced motion still skips the whole thing', () => {
      // The animation got more elaborate; the escape hatch must not get weaker.
      expect(src).toMatch(/if \(reduce\.current\) \{ setShown\(true\); return \}/)
    })

    it('🔴 the release does not depend on rAF alone', () => {
      // rAF does not fire while the document is hidden, which would leave the
      // scrim up and the body scroll-locked with no panel.
      expect(src).toMatch(/setTimeout\(release, \d+\)/)
    })
  })

  it('a sheet covers the nav; it does NOT become a screen (Silvanto, binding)', () => {
    // maxHeightVh 88 is load-bearing, not a default. A sheet whose content
    // cannot fit at 88vh is evidence the content belongs on a screen.
    expect(src).toMatch(/maxHeightVh\s*=\s*88/)
    expect(src).not.toMatch(/maxHeightVh\s*=\s*100/)
  })
})

describe('every migrated sheet goes through the primitive', () => {
  const migrated = [
    'components/shared/ZoneInfoSheet.tsx',
    'components/shared/TrendCard.tsx',
    'components/training/RaceResultSheet.tsx',
    'app/dashboard/DashboardClient.tsx',
    'app/dashboard/GeneratePlanScreen.tsx',
  ]

  for (const file of migrated) {
    it(`${file} imports the Sheet primitive`, () => {
      expect(read(file)).toMatch(/import Sheet(?:,|\s)/)
    })

    it(`${file} no longer hardcodes a sub-nav sheet z-index`, () => {
      const src = read(file)
      // The exact defect: the below-nav guesses the seven copies used.
      expect(src).not.toMatch(/zIndex:\s*(100|200|2000)\b/)
    })
  }
})

describe('no below-nav bottom-sheet overlay exists anywhere in the UI', () => {
  it('every flex-end fixed overlay with a scrim sits on the sheet/guide layer', () => {
    // The sheet signature: a full-viewport fixed overlay, bottom-anchored, with
    // an rgba scrim. Scan the whole UI tree and assert none carries a z-index
    // below the nav. (Charts, rulers and the marketing frame use flex-end for
    // layout but have no fixed scrim, so they are not matched.)
    const files = execSync('git ls-files "app/**/*.tsx" "components/**/*.tsx"', {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
      .filter(f => !f.endsWith('.test.tsx') && !f.endsWith('Sheet.tsx'))

    const offenders: string[] = []
    for (const f of files) {
      const src = read(f)
      // Find each fixed overlay style block and inspect its neighbourhood.
      const re = /position:\s*'fixed'[\s\S]{0,240}?/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src)) !== null) {
        const window = src.slice(m.index, m.index + 260)
        const isSheet = window.includes("alignItems: 'flex-end'") && /background:\s*(visible \?\s*)?'rgba\(/.test(window)
        if (!isSheet) continue
        const z = window.match(/zIndex:\s*(\d+)/)
        if (z && Number(z[1]) < Z_LAYERS.nav) {
          offenders.push(`${f}: zIndex ${z[1]} < nav ${Z_LAYERS.nav}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
