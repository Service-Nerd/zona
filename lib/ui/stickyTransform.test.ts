import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

// STICKY-TRANSFORM-01 — nothing between the scroller and a screen may carry a permanent
// `transform` or `will-change: transform`.
//
// 🔴 WHY. Both establish a CONTAINING BLOCK for their descendants. `PullToRefresh` wraps
// EVERY screen in the app, and it carried `translateY(0px)` plus a permanent
// `will-change: transform` — so every `position: sticky` header in the product had a
// containing block that was not the scroller.
//
// 👤 The founder, on an iPhone, on two different screens: *"Contact support still does the
// pull down to load with no static header"* and *"your zones has a header but does not stay
// static on scroll"*. Both were shipped as pinned, and both were green on every check.
//
// ⚠️ THE LIMIT OF THIS GATE, STATED. The identical nesting STICKS in desktop Blink —
// measured, with and without the transform — so this is a static guard against a
// containing block RETURNING, not proof that removing it fixes WebKit. `/sticky-probe`
// answers the engine question in five seconds on a real device.
//
// ⚠️ This is the third member of a family: `stickyScroller.test.ts` guards sticky against a
// scrollport that can never scroll, `STICKY-INERT-FLEX-01` is filed for `flex: 1` treated
// as a height, and this one guards the containing block. **All three make a sticky element
// silently not sticky, and none of them throws.**

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
     .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

const UI = (): string[] =>
  execSync("git ls-files 'app/**/*.tsx' 'app/*.tsx' 'components/**/*.tsx' 'components/*.tsx'",
    { encoding: 'utf8' })
    .trim().split('\n').filter(f => f && !f.includes('.test.'))

describe('STICKY-TRANSFORM-01 — no containing block between the scroller and the screen', () => {
  it('scans a real corpus (an empty sweep is not a pass)', () => {
    expect(UI().length, 'ui files').toBeGreaterThan(50)
  })

  it('🔴 PullToRefresh applies its transform ONLY while pulling', () => {
    const src = code(readFileSync('components/shared/PullToRefresh.tsx', 'utf8'))
    expect(src, 'an unconditional transform wraps every screen in the app')
      .not.toMatch(/transform:\s*`translateY\(\$\{pull\}px\)`/)
    expect(src, 'the transform must be conditional on a non-zero pull')
      .toMatch(/transform:\s*pull\s*!==\s*0\s*\?/)
    expect(src, 'will-change must be conditional too — it creates the same containing block')
      .toMatch(/willChange:\s*pull\s*!==\s*0\s*\?/)
  })

  it('🔴 the transform survives the settle, or the release animation jumps', () => {
    // `pull` stays non-zero for the whole easing-back animation and reaches 0 at the end,
    // so gating on `pull !== 0` keeps the transform exactly as long as it is needed.
    // Gating on a "finger down" flag instead would drop it mid-animation.
    const src = code(readFileSync('components/shared/PullToRefresh.tsx', 'utf8'))
    expect(src, 'gating on the gesture rather than the offset would break the release')
      .not.toMatch(/transform:\s*active\s*\?/)
    expect(src).toMatch(/transition:\s*active\s*\?\s*'none'/)
  })

  it('🔴 no OTHER wrapper reintroduces a permanent transform around the screens', () => {
    // The hub and the shell are the two files a screen is always mounted through.
    const offenders: string[] = []
    for (const f of ['components/shared/PullToRefresh.tsx', 'app/dashboard/DashboardClient.tsx']) {
      const src = code(readFileSync(f, 'utf8'))
      for (const m of Array.from(src.matchAll(/willChange:\s*'transform'/g))) {
        offenders.push(`${f}: unconditional willChange: 'transform' at offset ${m.index}`)
      }
    }
    expect(offenders, 'a permanent containing block is back:\n' + offenders.join('\n'))
      .toEqual([])
  })
})
