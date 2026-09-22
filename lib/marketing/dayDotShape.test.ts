import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * DESIGN-DAYDOT-CHANNEL-01 (Design Board § 6q) — HUE CARRIES THE SESSION TYPE,
 * AND NOTHING ELSE OVERWRITES IT.
 *
 * 🔴 What this replaced, on `PlanCalendar`'s 3x34px rail:
 *
 *     background: isComplete ? --moss
 *               : isSkipped  ? --line
 *               : isMoving || isSwapTarget ? --moss
 *               : accent
 *
 * THREE facts on one channel. A completed interval and a completed easy run
 * were the same colour — **the session type was destroyed by finishing the
 * run**. Skipped was `--line`, the hairline colour, which is also how absence
 * reads. And **moss meant both "complete" and "being moved"**. A fourth fact
 * rode on `opacity` at 0.5 (skipped), 0.45 (past, not complete) and 0.4 (move
 * mode) — three meanings inside 0.1 of each other.
 *
 * The remedy follows the rule `ui-patterns.md` already carries — *state must
 * live in the label, never colour alone* (WCAG 1.4.1) — and splits by whether
 * there is room for a label:
 *
 *   · the Plan row HAS room → completion is the word **"Done"**
 *   · Today's dot is 4px, where ICON-RULE-01 records that neither a glyph nor
 *     a label fits → completion is the **fill** (solid = done, ring = not yet)
 */

const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const CAL = strip(readFileSync(join(process.cwd(), 'components/training/PlanCalendar.tsx'), 'utf8'))
const SHELL = strip(readFileSync(join(process.cwd(), 'app/dashboard/DashboardClient.tsx'), 'utf8'))

describe('DESIGN-DAYDOT-CHANNEL-01 — one channel, one fact', () => {
  it('the plan row rail is the session accent, never a completion colour', () => {
    const i = CAL.indexOf("height: hasSession ? '34px'")
    expect(i, 'the rail moved; re-point this assertion').toBeGreaterThan(0)
    const rail = CAL.slice(i, i + 320)
    expect(rail, 'the rail must resolve to the session accent').toContain('accent')
    expect(rail, 'completion must not repaint the rail — it destroys the type')
      .not.toMatch(/isComplete\s*\?/)
    expect(rail, 'skip must not repaint the rail either').not.toMatch(/isSkipped\s*\?/)
  })

  it('completion is stated in words on the row that has room for words', () => {
    expect(CAL, 'the completed row must SAY it is done').toMatch(/\{isComplete && \(/)
    const i = CAL.indexOf('{isComplete && (')
    expect(CAL.slice(i, i + 400)).toContain('Done')
  })

  it('moss on the rail now means exactly one thing: in flight', () => {
    // It meant "complete" AND "being moved". Only the transient sense remains.
    const i = CAL.indexOf("height: hasSession ? '34px'")
    const rail = CAL.slice(i, i + 320)
    const mossBranches = Array.from(rail.matchAll(/var\(--moss\)/g)).length
    expect(mossBranches, 'moss on the rail may carry one meaning only').toBeLessThanOrEqual(1)
  })

  it("Today's dot keeps the type hue and carries state on fill and opacity", () => {
    const i = SHELL.indexOf('function getDot(')
    expect(i).toBeGreaterThan(0)
    const body = SHELL.slice(i, i + 900)
    expect(body, 'one hue source: the session').toMatch(/colour:\s*getSessionColor\(s\)/)
    expect(body, 'state travels as flags, not as colours').toMatch(/complete:/)
    expect(body, 'skip is its own flag, not a grey').toMatch(/skipped:/)
  })

  it('the dot does not reflow the strip when a run is logged', () => {
    // The old encoding swapped 4px/6px, which moved every dot on the row the
    // moment one session was completed. Fixed box, variable fill.
    const i = SHELL.indexOf('dot?.complete ? dot.colour')
    expect(i, 'the dot moved; re-point this assertion').toBeGreaterThan(0)
    const block = SHELL.slice(Math.max(0, i - 300), i + 300)
    expect(block, 'the dot box must be a constant size').toMatch(/width: '8px', height: '8px'/)
  })
})
