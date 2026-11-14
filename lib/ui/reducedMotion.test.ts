import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { prefersReducedMotion } from './reducedMotion'

// A11Y-REDUCED-MOTION-01 — one owner for the JS half of `prefers-reduced-motion`.
//
// 📐 THE ITEM'S PREMISE, RE-MEASURED: *"animations ignore `prefers-reduced-motion`"* was true of
// exactly ONE animation. `globals.css` has collapsed the six motion tokens in a single block since
// DESIGN-V3, and three components honoured the query already — `Sheet`, `PullToRefresh` and
// `HeroTrace` — each with its own hand-written guard. **What was missing was the owner, which is
// why a fourth animation (`useCountUp` in `TrendCard`) could be written without one and ran a
// 600 ms ease-out cubic for everybody.**
const src = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
const tracked = (): string[] =>
  execSync('git ls-files "app/**/*.ts" "app/**/*.tsx" "components/**/*.ts" "components/**/*.tsx" "lib/**/*.ts"',
    { encoding: 'utf8' }).split('\n').filter(Boolean)

afterEach(() => { vi.unstubAllGlobals() })

describe('prefersReducedMotion — the owner', () => {
  it('is false with no window: the server animates nothing and must not throw', () => {
    vi.stubGlobal('window', undefined)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('is false where matchMedia is absent — some embedded webviews', () => {
    vi.stubGlobal('window', {})
    expect(prefersReducedMotion()).toBe(false)
  })

  it('⚠️ defaults to ANIMATE when it cannot be determined, which is the safe direction', () => {
    // A runner who has expressed no preference gets the designed motion; one who HAS is on a
    // browser that implements the query. Defaulting the other way would strip motion from
    // everybody on an old webview.
    vi.stubGlobal('window', { matchMedia: undefined })
    expect(prefersReducedMotion()).toBe(false)
  })

  it('reads the query at the moment of use, never a cached module constant', () => {
    // The preference changes while the app is open (iOS Settings → Accessibility → Motion).
    let reduce = false
    vi.stubGlobal('window', { matchMedia: (q: string) => ({ matches: reduce && q.includes('reduce') }) })
    expect(prefersReducedMotion()).toBe(false)
    reduce = true
    expect(prefersReducedMotion()).toBe(true)
  })
})

describe('🔴 it is the ONLY implementation — the defect was a missing owner', () => {
  it('no tracked file outside the owner queries the media feature itself', () => {
    // ⚠️ CODE SHAPES, ANCHORED. Comments and docs legitimately NAME the query — `globals.css`'s
    // own block explains it — and a guard that reads prose as code is `HOOK-RGBA-COMMENTS-01`.
    // So this matches a `matchMedia(` CALL, and only in TS/TSX.
    const offenders = tracked().filter(f => {
      if (f === 'lib/ui/reducedMotion.ts') return false
      const body = src(f).split('\n')
        .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
      return /matchMedia\s*\??\.?\s*\(/.test(body)
    })
    expect(offenders, 'a second implementation of the reduced-motion check').toEqual([])
  })

  it('and the three components that had their own copy now import the owner', () => {
    // An empty population would pass the arm above while nothing honoured anything.
    for (const f of ['components/shared/Sheet.tsx', 'components/shared/PullToRefresh.tsx',
                     'components/marketing/HeroTrace.tsx', 'components/shared/TrendCard.tsx']) {
      expect(src(f), `${f} imports the owner`).toContain("from '@/lib/ui/reducedMotion'")
      expect(src(f), `${f} calls it`).toMatch(/prefersReducedMotion\(\)/)
    }
  })

  it('🔴 and the count-up takes the final value instead of running the loop', () => {
    // The named defect: a 600 ms ease-out cubic on the Coach trend numbers, for everybody.
    // `done` must flip too, or the gloss that `ui-patterns.md` fades in "after count-up
    // completes" would wait on a loop that never runs.
    const card = src('components/shared/TrendCard.tsx')
    const hook = card.slice(card.indexOf('function useCountUp'), card.indexOf('export', card.indexOf('function useCountUp')))
    expect(hook).toMatch(/if \(prefersReducedMotion\(\)\) \{/)
    const guard = hook.slice(hook.indexOf('if (prefersReducedMotion()) {'))
    expect(guard.slice(0, 200), 'sets the final value').toMatch(/setValue\(target\)/)
    expect(guard.slice(0, 200), 'and flips done, or the gloss never arrives').toMatch(/setDone\(true\)/)
    // ...and it returns BEFORE scheduling a frame.
    expect(guard.indexOf('return'), 'returns before requestAnimationFrame')
      .toBeLessThan(guard.indexOf('requestAnimationFrame'))
  })
})
