// APP-SPACE-01 — the ruled spacing scale, applied to the APP.
//
// 🔴 `SITE-WAVE-4` ruled `--space-1…7` = `4 · 8 · 12 · 16 · 24 · 32 · 48` on
// 2026-09-22 and swept **the marketing site**. Measured 2026-09-23, the day the
// founder said two app surfaces were "too close": `var(--space-*)` appeared
// **17 times in `components/marketing` and ZERO times in `app/dashboard` or
// `components/shared`**, against **578 hand-typed gaps** and **25 distinct gap
// values, 13 of them off-scale above 5px** (6,7,9,10,11,14,18,20,28,36,40,…).
//
// The site had **24 distinct / 19 real** when it was ruled. **The app was in the
// state the site was in before the fix**, and Wave 4's own register row had
// already named the hazard: *"a token family nobody applies is the `surface=`
// failure repeated."*
//
// ⚠️ AND THE SWEEP ALONE COULD NOT HAVE FIXED THE REPORTED CASE.
// `design-rulings.md` § 332: *"a gap of zero is not a gap, it is an **absent
// decision** … a spacing audit finds wrong values and is structurally blind to
// missing ones."* The arc-to-tile gap was 6px because the tile declared **no
// top margin at all**; that value is declared explicitly, not swept.
//
// ⚠️ THE TIE BREAKS UPWARD, and the first cut of the sweep got this wrong. 6px
// is equidistant from 4 and 8; rounding DOWN tightened the commonest off-scale
// gap in the app — **74 of them** — on the day the complaint was crowding.
// Whitespace is a documented feature (*"restraint = progress"*), so a tie
// resolves in favour of more of it. Final sweep: **260 looser, 17 tighter**,
// none by more than 4px.

import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

const SCALE = [4, 8, 12, 16, 24, 32, 48]
const PROPS = '(?:marginTop|marginBottom|marginLeft|marginRight|gap|rowGap|columnGap|paddingTop|paddingBottom)'

/**
 * Declared exclusions, each with the reason it is not a spacing decision.
 *
 * ⚠️ BOTTOM CLEARANCE IS NOT A GAP — the room a fixed tab bar needs is safe
 * area, not spacing, and snapping it to the scale would put content under the
 * nav. That is the mirror of Wave 4 excluding ≤5px as line-box artefacts: one
 * end of the range is noise, the other is safe area.
 *
 * 🔴 THE 120px AND 80px ENTRIES WERE DELETED 2026-09-26, AND THEIR REASON HAD
 * BEEN FALSE THE WHOLE TIME. It read *"`paddingBottom` on a `minHeight:100% /
 * overflowY:auto` scroll container — the room the fixed tab bar needs."* Neither
 * half held: those elements were **not scroll containers** (`min-height` with no
 * height cannot overflow — see `stickyScroller.test.ts`), and the tab bar's room
 * is owned by `PullToRefresh`, which is handed `bottomNavH + 16`. So the app was
 * reserving the nav **twice**: 210px of dead ground, which the founder reported
 * as *"a lot of empty space."*
 *
 * ⚠️ **A DECLARED EXCEPTION WITH A WRONG REASON IS WORSE THAN NO EXCEPTION**,
 * because it looks examined. This one was read past every time the file was
 * touched. The reason column is not decoration — when an entry is added, the
 * claim in it has to be true, and when the code moves, the claim has to be
 * re-read rather than the entry re-keyed.
 */
const EXCLUDED: ReadonlyArray<{ file: string; value: number; reason: string }> = [
  { file: 'app/dashboard/DashboardClient.tsx', value: 40,  reason: 'deliberate end-of-section rest, 8px off the scale' },
]

const files = (): string[] =>
  execSync("git ls-files 'app/dashboard/*.tsx' 'components/shared/*.tsx'", { encoding: 'utf8' })
    .trim().split('\n').filter(f => f && !/\.test\.tsx?$/.test(f))

interface Hit { file: string; line: number; prop: string; value: number }

function scan(): Hit[] {
  const re = new RegExp(`(${PROPS}): '(\\d+)px'`, 'g')
  const out: Hit[] = []
  for (const f of files()) {
    readFileSync(f, 'utf8').split('\n').forEach((raw, i) => {
      const t = raw.trim()
      // A comment EXPLAINING the rule is not a second copy of it — the fifth
      // recording of "bound the region, never grep the file" was today.
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
      for (const m of Array.from(raw.matchAll(re))) {
        const value = Number(m[2])
        if (value <= 5) return            // line-box artefact, Wave 4's own exclusion
        out.push({ file: f, line: i + 1, prop: m[1], value })
      }
    })
  }
  return out
}

describe('APP-SPACE-01 — the app uses the ruled spacing scale', () => {
  const hits = scan()

  it('the scan reaches the app at all (guards the guard)', () => {
    const src = files().map(f => readFileSync(f, 'utf8')).join('')
    expect(files().length).toBeGreaterThan(10)
    expect(src).toContain('var(--space-')
  })

  it('🔴 no hand-typed gap above 5px outside the declared exclusions', () => {
    const offenders = hits.filter(h => !EXCLUDED.some(e => e.file === h.file && e.value === h.value))
    expect(
      offenders.map(h => `${h.file}:${h.line}  ${h.prop}: ${h.value}px`),
      'Use var(--space-1…7) = 4·8·12·16·24·32·48. If this genuinely is not a spacing ' +
        'decision (bottom clearance, a safe area), add it to EXCLUDED with the reason.',
    ).toEqual([])
  })

  it('every declared exclusion still exists — a stale reason is its own defect', () => {
    const gone = EXCLUDED.filter(e => !hits.some(h => h.file === e.file && h.value === e.value))
    expect(gone.map(e => `${e.file} ${e.value}px`), 'Fixed? Delete the entry.').toEqual([])
  })

  it('the tokens resolve to the ruled scale', () => {
    // Asserts against globals.css, the owner — never a copy of the numbers.
    const css = readFileSync('app/globals.css', 'utf8')
    SCALE.forEach((px, i) => {
      expect(css, `--space-${i + 1} must be ${px}px`).toMatch(
        new RegExp(`--space-${i + 1}:\\s*${px}px`),
      )
    })
  })
})
