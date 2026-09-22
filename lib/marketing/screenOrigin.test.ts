import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * POSTRUN-ORIGIN-01 — a pushed screen returns to where the runner CAME from.
 *
 * 🔴 THE DEFECT, AND IT IS A REPEAT. `PostRunScreen`'s `onDone` correctly
 * routed to the session the runner came from — POST-RUN-02 reasoned that
 * terminus out and left a comment saying why. Its `onBack` was a hardcoded
 * `setScreen('today')`. So one screen had two exits that disagreed, and the
 * one that disagreed was BACK: open a session from Plan, tap the linked run,
 * tap back, land on Today, two screens from where you were. **The escape
 * hatch was worse than the completion path.**
 *
 * ⚠️ This is D4's class, already fixed once IN THIS FILE. `sessionOrigin`
 * exists precisely because back-from-Plan was the same hardcoded line, and the
 * write-up at the time noted *"the identical line appears TWICE in that
 * file"*. The second screen with the same shape was never looked for.
 *
 * So this gate is deliberately GENERAL: it checks that no pushed screen sends
 * `onBack` to a literal destination when it has more than one way in.
 */

const SHELL = readFileSync(join(process.cwd(), 'app/dashboard/DashboardClient.tsx'), 'utf8')
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
const CODE = strip(SHELL)

describe('POSTRUN-ORIGIN-01 — back goes where you came from', () => {
  it('post-run has an origin, and every entry point stamps it', () => {
    expect(CODE, 'the origin state must exist').toMatch(/const \[postRunOrigin, setPostRunOrigin\]/)
    // Bounded by COUNT, not presence: a stamped origin on two of three entries
    // is the same defect with better odds. Three ways in — the push deep-link
    // / cold start, Today, and Session Detail.
    const entries = Array.from(CODE.matchAll(/setScreen\('post-run'\)/g)).length
    const stamps  = Array.from(CODE.matchAll(/setPostRunOrigin\(/g)).length
    expect(entries, 'the count of entry points changed; re-check each one stamps').toBe(3)
    expect(stamps, 'every route into post-run must stamp where it came from').toBe(entries)
  })

  it('post-run BACK reads the origin, never a literal screen', () => {
    const i = CODE.indexOf('<PostRunScreen')
    expect(i).toBeGreaterThan(0)
    const back = CODE.slice(i, CODE.indexOf('onDone', i))
    expect(back, 'onBack must consult the origin').toContain('postRunOrigin')
    expect(back, 'onBack must not hardcode a single destination')
      .not.toMatch(/onBack=\{\(\) => \{ setActivePostRunData\(null\); setScreen\('today'\) \}\}/)
  })

  it("back and done no longer disagree about where the runner was", () => {
    // The whole finding in one assertion: both exits resolve through state.
    const i = CODE.indexOf('<PostRunScreen')
    const block = CODE.slice(i, i + 1600)
    expect(block, 'done returns to the session').toMatch(/setScreen\('session'\)/)
    expect(block, 'and so does back, when that is where the runner came from').toContain('postRunOrigin')
  })

  it('the pattern it copies is still there (sessionOrigin)', () => {
    // If someone deletes sessionOrigin, the reason this exists goes with it.
    expect(CODE).toMatch(/const \[sessionOrigin, setSessionOrigin\]/)
    expect(CODE, 'SessionScreen must still route back through its origin')
      .toMatch(/onBack=\{\(\) => setScreen\(sessionOrigin\)\}/)
  })
})
