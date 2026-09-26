import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * LINK-HIERARCHY-01 — Design Board, 2026-09-26. SHIP (4 clauses).
 *
 * Founder: *"The buttons look too big/fat… the Run (Connect) above Log without
 * activity is actually a button, it's not clear… is it clear which buttons we
 * prefer the user to select? Ideally we want them to connect to a run right?
 * This is a real moment."*
 *
 * 🔴 THE FINDING UNDER THE OTHER THREE: THE SCREEN ARGUED WITH ITSELF. The
 * runner taps a green **MATCH A RUN** and lands on a screen whose loudest
 * control says **LOG WITHOUT ACTIVITY**, while the run they came to link sits
 * above it as a `<div>` painted the exact colour of its own ground.
 *
 * ⚠️ AND THE PREFERENCE IS DOCTRINAL, NOT TASTE. ADR-011: HealthKit is the SOR
 * and carries the HR stream; a manual log carries none, and CLAUDE.md states the
 * consequence — those runners *"get no HR-based coaching"*. Linking is materially
 * better COACHING.
 */
const ROOT = path.resolve(__dirname, '../..')
const RAW = fs.readFileSync(path.join(ROOT, 'app/dashboard/DashboardClient.tsx'), 'utf8')
// Comments blanked: this file's own explanation quotes the defect, and a check
// that fires on prose describing the bug it guards gets switched off.
const blank = (m: string) => m.replace(/[^\n]/g, '')
const SRC = RAW
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
  .replace(/^[ \t]*\/\/.*$/gm, '')

/** The activity picker: from the list open to its closing tag. */
const picker = () => {
  const i = SRC.indexOf('stravaRuns.slice(0, 20)')
  expect(i, 'the activity list has moved — re-anchor this test').toBeGreaterThan(-1)
  return SRC.slice(i, i + 1800)
}

describe('LINK-HIERARCHY-01', () => {
  it('🔴 the run row is a real <button>, not a clickable div', () => {
    const p = picker()
    expect(p, 'a div has no role, no tabIndex and no focus ring — it is not a control')
      .toMatch(/<button\s+[\s\S]{0,120}?key=\{run\.id\}|key=\{run\.id\}[\s\S]{0,200}?type="button"/)
    expect(p, 'selection must be announced — a ✓ glyph announces nothing')
      .toMatch(/aria-pressed=\{isSelected\}/)
    expect(p, 'the clickable div is gone').not.toMatch(/<div key=\{run\.id\} onClick/)
  })

  it('🔴 it takes a SURFACE — it was --bg painted on --bg, zero levels', () => {
    // 📐 Measured: `fill_vs_page_ground_levels: 0`. The only thing marking the
    // control was an 8% hairline. `GHOST-AFFORDANCE-01`: a primary action on its
    // screen takes a surface, and picking a run IS the primary action here.
    // `:191`'s inset pattern is `--bg-soft` + ONE HAIRLINE, verbatim.
    const p = picker()
    expect(p, 'the unselected ground must differ from the page ground').toMatch(/var\(--bg-soft\)/)
    expect(p, 'never --bg on --bg').not.toMatch(/isSelected\s*\?[^:]*:\s*'var\(--bg\)'/)
    expect(p, '§ 20: always 1px, never 0.5px').not.toMatch(/0\.5px/)
    // `:240` permits a CONDITIONAL fill as a selected state, and legacy aliases
    // are what hid two failing CTAs from an earlier gate.
    expect(p).toMatch(/var\(--moss-soft\)/)
    expect(p, 'legacy aliases resolve to real tokens').not.toMatch(/--teal|--border-col|--text-primary/)
  })

  it('🔴 the primary EMERGES only when a run is picked', () => {
    // Before selection the row has NO primary, deliberately: the primary is the
    // run card. ⚠️ `SESSION-ACTIONS-01` flagged a primary-less row as a defect,
    // so this one is asserted as intentional rather than left to be "fixed".
    const i = SRC.indexOf("selectedActivity ? saveCompletion('complete'")
    expect(i, 'the link CTA has moved — re-anchor').toBeGreaterThan(-1)
    const cta = SRC.slice(i - 400, i + 200)
    expect(cta, 'the escape hatch must not be the loudest control on the screen')
      .toMatch(/variant=\{selectedActivity \? 'primary' : 'secondary'\}/)
  })

  it('🔴 both action rows are `compact`, because `regular` WRAPPED', () => {
    // 📐 Measured at 375pt: `regular` → both labels on two lines, row **74px**
    // against a 44px floor. `compact` → one line, exactly 44.
    // ⚠️ Sentence case with no tracking measured **identical at 74px**, so the
    // cause is the size class, not the copy and not the uppercase.
    //
    // 🔴 THE FIRST CUT OF THIS ARM ANCHORED ON THE WRONG BUTTONS. It used
    // `setShowManualModal(true)` and `onClick={handleMarkComplete}`, and BOTH
    // appear EARLIER on the same screen in other views — so it was reporting on
    // controls this ruling never touched. The population class, this time in the
    // anchor rather than the set. Anchors are now the `flex`/`minWidth` pairs
    // that are unique to these two rows.
    // ⚠️ `[^>]*` CANNOT BE USED HERE — a style prop contains arrow functions,
    // so `>` appears inside the tag. Walk back to the opening `<Button` from a
    // prop that is unique to the row, and read the whole tag.
    const tagAround = (needle: string) => {
      const i = SRC.indexOf(needle)
      expect(i, `${needle}: anchor not found — re-anchor this test`).toBeGreaterThan(-1)
      const open = SRC.lastIndexOf('<Button', i)
      return SRC.slice(open, i + needle.length)
    }
    for (const [what, needle] of [
      ["the session row's secondary", "minWidth: '100px'"],
      ["the session row's primary",   "minWidth: '120px'"],
    ] as const) {
      expect(tagAround(needle), `${what}: a wrapped label is what "too big/fat" was`)
        .toMatch(/size="compact"/)
    }
    // ⚠️ BOTH `Back` buttons, not the first one — there are two, and an
    // `indexOf` would have graded one and ignored the other.
    const backs = Array.from(SRC.matchAll(/<Button[\s\S]{0,200}?>Back<\/Button>/g))
    expect(backs.length, 'expected two Back buttons; the screen has changed').toBe(2)
    for (const b of backs) expect(b[0]).toMatch(/size="compact"/)
  })
})
