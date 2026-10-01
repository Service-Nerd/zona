import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

/**
 * SMOKE-PLUMBING-01 — THE SMOKE TRACKER IS GONE, AND THIS KEEPS IT GONE.
 *
 * `CLAUDE.md` has recorded the smoke tracker as *"Removed from all UI surfaces"*
 * since Phase 1. It was not. `SmokeToggle` went (zero call sites), and
 * everything around it survived for months:
 *
 *   · `smoke_tracker_enabled` and `quit_date` SELECTed from `user_settings`
 *   · a quit-day count computed on every dashboard load
 *   · THREE dead props threaded into two screens (`quitDays`,
 *     `smokeTrackerEnabled`, `quitDate`) — read by nothing
 *   · a dead WRITE path, `onSmokeTrackerChange`, declared on `MeScreen` and
 *     never called in its body, because its only caller was the deleted toggle
 *   · an UNREACHABLE screen branch: `activeSection === 'quit'` rendered
 *     `QuitTab`, and no code anywhere set that section
 *
 * ⚠️ THE ITEM CALLED IT "DEAD PLUMBING" AND ITS OWN WARNING WAS THE REASON TO
 * LOOK HARDER: *"no UI and no consumer are different claims."* They were.
 * `quitDays` had a live-looking consumer (`QuitTab`) behind a branch nothing
 * could reach, and a write path nothing could trigger. **A removal that trusted
 * the item's scope would have left the SELECT, the computation and the writer.**
 *
 * ⚠️ WHAT IS DELIBERATELY STILL HERE, so the next reader does not think it was
 * missed: `components/dashboard/QuitTab.tsx` itself, rendered now only by
 * `/copy-preview`, and the `user_settings` columns. Deleting a component and
 * dropping columns are separate decisions → `QUIT-TAB-DEAD-01`.
 */
const ROOT = join(__dirname, '..', '..')

const files = (): string[] =>
  execSync('git ls-files "app/**/*.tsx" "components/**/*.tsx" "lib/**/*.ts"', { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean).filter(f => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))

/** Source with comments stripped: bound the region, never grep the file. */
const codeOf = (rel: string): string =>
  readFileSync(join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')

describe('SMOKE-PLUMBING-01 — no smoke-tracker plumbing comes back', () => {
  // `QuitTab.tsx` is the component itself and `/copy-preview` is the harness
  // that still renders it. Both are named, with their reason, rather than the
  // pattern being loosened to let them through.
  const EXEMPT = new Set([
    'components/dashboard/QuitTab.tsx',
    'app/copy-preview/page.tsx',
    // ⚠️ NOT A QUERY — the inventory of what `user_settings` ACTUALLY HAS. The
    // column still exists in the database, and this file's job is to say so
    // truthfully; `check:db` reads it. Dropping the column is the migration half
    // of `QUIT-TAB-DEAD-01`, and until that lands, removing it from here would
    // make the contract lie about the schema to satisfy a test.
    'lib/contracts/tableColumns.ts',
  ])

  it('🔴 no component threads a smoke-tracker prop', () => {
    const offenders = files()
      .filter(f => !EXEMPT.has(f))
      .filter(f => /\b(smokeTrackerEnabled|quitDays|onSmokeTrackerChange)\b/.test(codeOf(f)))
    expect(offenders,
      'the smoke tracker was removed from the UI in Phase 1; these props are its plumbing').toEqual([])
  })

  it('🔴 nothing SELECTs the smoke-tracker columns', () => {
    // The cost of the old state was not the props, it was a column fetched on
    // every dashboard load for a feature with no surface.
    const offenders = files()
      .filter(f => !EXEMPT.has(f))
      .filter(f => /smoke_tracker_enabled/.test(codeOf(f)))
    expect(offenders, 'a column fetched for a feature that has no UI').toEqual([])
  })

  it('🔴 no screen renders an UNREACHABLE quit section', () => {
    // The shape that made this survive: a branch that looks like a live
    // consumer. If `'quit'` is ever a section again it needs a way in, and a
    // way in is a Design Board question.
    const me = codeOf('components/dashboard/MeScreen.tsx')
    expect(me, "MeScreen declares a 'quit' section again").not.toMatch(/activeSection === 'quit'/)
    expect(me, 'MeScreen imports QuitTab again').not.toContain('QuitTab')
  })

  it('the exemptions still exist, so neither can rot into a blanket pass', () => {
    for (const f of Array.from(EXEMPT)) {
      expect(() => readFileSync(join(ROOT, f), 'utf8'),
        `${f} is exempted here but no longer exists — remove the exemption`).not.toThrow()
    }
  })
})
