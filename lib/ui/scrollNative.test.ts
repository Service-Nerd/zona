import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

// SCROLL-NATIVE-01 — the scroller bounces, the document does not, nothing chains.
//
// 👤 Founder: *"I want the scrolling to act more like a native app. I find it very sharp and
// not very smooth or bouncy."*
//
// 🔴 MEASURED CAUSE. `PullToRefresh` is the app's ONLY real scroller and it declared
// `overscroll-behavior: none`, which kills the rubber-band at BOTH ends of every screen in
// the product. It carried no comment explaining itself.
//
// 🥇 AND IT WAS NEVER NEEDED FOR THE PULL GESTURE. That gesture engages only at
// `scrollTop <= 0` and calls `e.preventDefault()` in its own non-passive `touchmove` — it
// suppresses the native bounce DIRECTLY while running. All `overscroll-behavior` was doing
// was preventing CHAINING, and `contain` does that while preserving the local bounce. At the
// BOTTOM the gesture never engages at all, so `none` was suppressing that bounce for nothing.
//
// ⚠️ `html, body` KEEPS `none`, and that is not an inconsistency. Stopping the whole WEBVIEW
// from bouncing is what makes this read as an app rather than a web page; the bounce belongs
// to the scroll view inside it, exactly as on iOS.
//
// ⚠️ NOT VERIFIED ON A DEVICE. Scroll feel cannot be measured from here. This gate enforces
// the declarations, not the sensation.

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
     .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

const UI = (): string[] =>
  execSync("git ls-files 'app/**/*.tsx' 'app/*.tsx' 'components/**/*.tsx' 'components/*.tsx'",
    { encoding: 'utf8' })
    .trim().split('\n').filter(f => f && !f.includes('.test.') && !f.includes('-preview')
                                    && !f.includes('sticky-probe'))

/** ⚠️ Scrollers that legitimately do not need `contain`, each with its reason. */
const NO_CONTAIN: Record<string, string> = {
  'components/shared/WheelPicker.tsx':
    'a scroll-SNAP picker, not a page. It is short by construction and its snap behaviour ' +
    'owns the overscroll; adding contain here changes a tuned control for no gain.',
  'components/ErrorBoundary.tsx':
    'a 140px stack-trace box on the crash screen. Nothing is behind it to chain to, and it ' +
    'is not a surface a runner scrolls.',
  'components/strava/StravaPanel.tsx':
    'the admin-only Strava panel, reachable by URL and not linked from any nav entry.',
  // ✅ `BenchmarkUpdateScreen` AND `GeneratePlanScreen` CAME OFF THIS LIST on 2026-10-01
  //    (`STICKY-INERT-SCREENS-01`, Design Board). They were declared here as INERT
  //    scrollports — `overflowY: auto` under `minHeight: 100%`, which can never overflow,
  //    so they never overscrolled either and `contain` bought nothing. **The board removed
  //    the declaration rather than repairing it**, so they are not scrollers at all now and
  //    there is nothing left to declare.
  //
  // 🔴 THIS ARM IS HOW THAT WAS CAUGHT. Removing three `overflowY: auto` declarations in two
  //    files was expected to touch `stickyScroller.test.ts`, which it did. **Nobody predicted
  //    THIS register**, and its stale-entry arm went red on the full suite: a file declared
  //    as a scroller that is no longer one. A second register tracking the same objects by a
  //    different measure, exactly as the completion rules say to reconcile.
}

describe('SCROLL-NATIVE-01 — bounce locally, never chain', () => {
  it('scans a real corpus (an empty sweep is not a pass)', () => {
    expect(UI().length, 'ui files').toBeGreaterThan(50)
  })

  it('🔴 the app’s main scroller allows its rubber-band', () => {
    const src = code(readFileSync('components/shared/PullToRefresh.tsx', 'utf8'))
    expect(src, 'the only real scroller in the app must not suppress the bounce')
      .not.toMatch(/overscrollBehavior:\s*'none'/)
    expect(src, 'and it must still prevent chaining to the document')
      .toMatch(/overscrollBehavior:\s*'contain'/)
  })

  it('🔴 the DOCUMENT still does not bounce', () => {
    // The other half of the principle. Without this the whole webview rubber-bands and the
    // app reads as a web page in a frame.
    const css = readFileSync('app/globals.css', 'utf8')
    const rule = /html,\s*body\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(rule, 'html, body must keep overscroll-behavior: none')
      .toMatch(/overscroll-behavior:\s*none/)
  })

  it('🔴 a sheet does not move the screen behind it', () => {
    const src = code(readFileSync('components/shared/Sheet.tsx', 'utf8'))
    expect(src, 'scrolling a sheet to its end would chain to the page underneath')
      .toMatch(/overscrollBehavior:\s*'contain'/)
  })

  it('🔴 EXHAUSTIVE: every scrolling surface either contains or is declared', () => {
    // The population is derived, and both directions are checked — a declared file that
    // stopped scrolling is as wrong as an undeclared one that started.
    const scrollers = UI().filter(f =>
      /overflowY:\s*'(auto|scroll)'/.test(code(readFileSync(f, 'utf8'))))
    expect(scrollers.length, 'the scan lost its subject').toBeGreaterThan(3)
    const undeclared = scrollers.filter(f => {
      const src = code(readFileSync(f, 'utf8'))
      return !/overscrollBehavior:\s*'contain'/.test(src) && !(f in NO_CONTAIN)
    })
    expect(undeclared,
      'a scroller that chains to whatever is behind it:\n' + undeclared.join('\n')).toEqual([])
    const stale = Object.keys(NO_CONTAIN).filter(f => !scrollers.includes(f))
    expect(stale, 'declared as a scroller but no longer one — delete the row:\n' + stale.join('\n'))
      .toEqual([])
    for (const [f, why] of Object.entries(NO_CONTAIN)) {
      expect(why.length, `${f}'s reason is too thin to be a reason`).toBeGreaterThan(40)
    }
  })
})
