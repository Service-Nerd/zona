import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { releaseOnNextFrame, RAF_FALLBACK_MS, type FrameTimers } from './rafRelease'

// SHEET-RAF-FALLBACK-01 — behavioural, not a source grep.
//
// ⚠️ The repo's vitest environment is `node`: no jsdom, no testing-library, so
// a component cannot be rendered and a source assertion would be the only
// alternative. A source assertion passes on a comment. Timers are injected
// instead, so the arms below prove what actually happens in the hidden-document
// case rather than that a line of code is present.

/** A controllable stand-in for the two ambient timer pairs. */
function fakeTimers() {
  const rafs = new Map<number, () => void>()
  const outs = new Map<number, { run: () => void; ms: number }>()
  let next = 1
  const timers: FrameTimers = {
    requestAnimationFrame: (cb) => { const h = next++; rafs.set(h, () => cb(0)); return h },
    cancelAnimationFrame: (h) => { rafs.delete(h) },
    setTimeout: (cb, ms) => { const h = next++; outs.set(h, { run: cb, ms }); return h },
    clearTimeout: (h) => { outs.delete(h) },
  }
  return {
    timers,
    /** What a VISIBLE document does. */
    fireFrame: () => Array.from(rafs.values()).forEach(f => f()),
    /** What a HIDDEN document does: the frame never arrives, the clock still runs. */
    fireTimeout: () => Array.from(outs.values()).forEach(o => o.run()),
    pendingFrames: () => rafs.size,
    pendingTimeouts: () => outs.size,
    timeoutDelays: () => Array.from(outs.values()).map(o => o.ms),
  }
}

describe('releaseOnNextFrame — a frame that never comes still releases', () => {
  it('releases on the frame when the document is visible', () => {
    const f = fakeTimers()
    let released = 0
    releaseOnNextFrame(() => { released++ }, f.timers)
    expect(released, 'nothing should run synchronously').toBe(0)
    f.fireFrame()
    expect(released).toBe(1)
  })

  it('🔴 releases on the fallback when the frame NEVER comes (document.hidden)', () => {
    // This is the whole defect. `requestAnimationFrame` does not fire while the
    // document is hidden, so without the fallback `released` stays 0 forever and
    // the caller's state is stuck: a sheet at translateY(100%) behind a live
    // scrim, or a WheelPicker with `suppress` latched true.
    const f = fakeTimers()
    let released = 0
    releaseOnNextFrame(() => { released++ }, f.timers)
    f.fireTimeout()                      // the frame is deliberately NOT fired
    expect(released, 'a hidden document must still release').toBe(1)
  })

  it('releases exactly ONCE when both fire, in either order', () => {
    // A document that becomes visible at the wrong moment runs the queued rAF
    // callback right after the timeout. A second release re-sets state React has
    // already committed.
    for (const order of [['timeout', 'frame'], ['frame', 'timeout']] as const) {
      const f = fakeTimers()
      let released = 0
      releaseOnNextFrame(() => { released++ }, f.timers)
      for (const which of order) which === 'frame' ? f.fireFrame() : f.fireTimeout()
      expect(released, `both fired (${order.join(' then ')})`).toBe(1)
    }
  })

  it('cancel disarms BOTH handles, so a teardown leaves nothing pending', () => {
    const f = fakeTimers()
    let released = 0
    const cancel = releaseOnNextFrame(() => { released++ }, f.timers)
    expect(f.pendingFrames()).toBe(1)
    expect(f.pendingTimeouts()).toBe(1)
    cancel()
    expect(f.pendingFrames(), 'frame left armed after cancel').toBe(0)
    expect(f.pendingTimeouts(), 'timeout left armed after cancel').toBe(0)
    f.fireFrame(); f.fireTimeout()
    expect(released, 'cancelled, so nothing may run').toBe(0)
  })

  it('arms the fallback at the declared delay, not an inline number', () => {
    const f = fakeTimers()
    releaseOnNextFrame(() => {}, f.timers)
    expect(f.timeoutDelays()).toEqual([RAF_FALLBACK_MS])
  })
})

describe('every one-shot rAF release goes through the owner', () => {
  // ⚠️ D-08, single owner. Two components had this bug independently; a third
  // written tomorrow would have it again. `TrendCard` is exempt BY NAME and with
  // a reason, because it drives an animation LOOP rather than releasing a state.
  const ROOT = join(__dirname, '..', '..')
  const EXEMPT = new Set([
    // A recursive rAF tick for a count-up. A loop that has not started is a
    // value that has not moved, and it resumes correctly on visibility; running
    // the easing off a timer would be worse.
    'components/shared/TrendCard.tsx',
  ])

  /**
   * Source with comments removed.
   *
   * ⚠️ BOUND THE REGION, NEVER GREP THE FILE. The first cut of the arm below
   * matched the bare word anywhere in the file and immediately flagged
   * `WheelPicker.tsx` -- for the COMMENT this very fix had just added to it,
   * which explains the rule it was being accused of breaking. That is the
   * fourth time this repo has recorded the substring-bias class (twice in the
   * hook guards, once in the backlog parser), and it got a fifth because the
   * failing file was the one I had edited thirty seconds earlier.
   */
  const codeOf = (rel: string): string =>
    readFileSync(join(ROOT, rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ')

  it('no component outside the owner calls requestAnimationFrame directly', () => {
    const files = JSON.parse(
      execSyncJson('git ls-files "components/**/*.tsx" "app/**/*.tsx" "lib/**/*.ts"'),
    ) as string[]
    const offenders = files
      .filter(f => !EXEMPT.has(f) && f !== 'lib/ui/rafRelease.ts' && !f.endsWith('.test.ts'))
      // The CALL shape, not the word: `requestAnimationFrame(` with an optional
      // `window.` prefix. A type annotation or an identifier in a string is not
      // a call site.
      .filter(f => /(?:window\s*\.\s*)?\brequestAnimationFrame\s*\(/.test(codeOf(f)))
    expect(
      offenders,
      'use releaseOnNextFrame from lib/ui/rafRelease, or add a named exemption with its reason',
    ).toEqual([])
  })
})

/** git ls-files, as a JSON array of paths. */
function execSyncJson(cmd: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { execSync } = require('node:child_process') as typeof import('node:child_process')
  const out = execSync(cmd, { cwd: join(__dirname, '..', '..'), encoding: 'utf8' })
  return JSON.stringify(out.split('\n').filter(Boolean))
}
