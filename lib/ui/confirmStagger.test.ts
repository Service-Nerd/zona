import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * CONFIRM-STAGGER-01 — the Design Board's four conditions, checked.
 *
 * Ruled as amendment 5 of `ADJUST-JOURNEY-TYPE-01` (2026-10-14). The three
 * whole-plan totals and four day rows on the confirm screen arrive in sequence.
 * The board attached four conditions and every one of them is here:
 *
 *   1. TOKEN-DRIVEN — no literal duration in a component
 *   2. TOTAL <= 600ms
 *   3. THE CTA IS INTERACTIVE FROM FIRST PAINT
 *   4. IT COLLAPSES under `prefers-reduced-motion`
 *
 * ⚠️ WHY THIS IS ARITHMETIC AND NOT A RENDER TEST. `vitest.config.ts` is
 * `environment: 'node'` with no jsdom, so nothing here can observe an animation.
 * A source assertion was the alternative, and this repo has recorded that **a
 * source assertion passes on a comment** (SHEET-RAF-FALLBACK-01). So the 600ms
 * arm PARSES BOTH TOKEN VALUES out of `globals.css` and does the sum. Change
 * either number and it goes red with the real total — that is a measurement, not
 * a restatement of the rule.
 *
 * ⚠️ WHAT IT STILL CANNOT SEE: whether 580ms FEELS right in the hand. Nothing in
 * Zonna has ever been tested on a device, and the founder's own evidence for this
 * came from a desktop browser.
 */

const CSS = readFileSync('app/globals.css', 'utf8')
const CONFIRM = readFileSync('components/shared/ModifyPlanConfirm.tsx', 'utf8')
const DIFF = readFileSync('components/shared/AdjustmentDiff.tsx', 'utf8')

/** Reads a `--token: <n><unit>` declaration back as milliseconds. */
function ms(token: string, scope: string): number {
  const m = new RegExp(`--${token}:\\s*([\\d.]+)(ms|s)`).exec(scope)
  if (!m) throw new Error(`--${token} not found — the token was renamed or removed`)
  return m[2] === 's' ? Number(m[1]) * 1000 : Number(m[1])
}

/** The `@media (prefers-reduced-motion: reduce)` block, bounded, never grepped whole-file. */
function reducedMotionBlock(): string {
  const i = CSS.indexOf('@media (prefers-reduced-motion: reduce)')
  expect(i, 'the prefers-reduced-motion block is gone').toBeGreaterThan(-1)
  const open = CSS.indexOf('{', i)
  let depth = 0
  for (let k = open; k < CSS.length; k++) {
    if (CSS[k] === '{') depth++
    else if (CSS[k] === '}' && --depth === 0) return CSS.slice(open, k)
  }
  throw new Error('unbalanced braces in the reduced-motion block')
}

describe('CONFIRM-STAGGER-01 — the board attached four conditions', () => {
  it('1 · the timing is TOKEN-driven, with no literal duration in the component', () => {
    expect(CONFIRM).not.toMatch(/animation(-duration|-delay)?:\s*[\d.]+m?s/)
    expect(DIFF).not.toMatch(/animation(-duration|-delay)?:\s*[\d.]+m?s/)
    // and the component names the class rather than the time
    expect(CONFIRM).toContain('zonna-stagger')
  })

  it('2 · the whole sequence is <= 600ms, computed from the two tokens', () => {
    const root = CSS.slice(0, CSS.indexOf('@media (prefers-reduced-motion'))
    const duration = ms('motion-verdict', root)
    const step = ms('motion-stagger-step', root)

    // The LAST element's delay, read from the stylesheet rather than assumed:
    // whichever nth-child multiplier is highest is the one that lands last.
    const mults = Array.from(CSS.matchAll(/calc\((\d+) \* var\(--motion-stagger-step\)\)/g))
      .map(m => Number(m[1]))
    expect(mults.length, 'no staggered delays found — the pattern was removed').toBeGreaterThan(0)
    const last = Math.max(...mults)

    const total = duration + last * step
    expect(total, `the sequence runs ${total}ms; the board capped it at 600ms `
      + `(--motion-verdict ${duration}ms + ${last} x --motion-stagger-step ${step}ms)`)
      .toBeLessThanOrEqual(600)
  })

  it('2b · the delays are a CONTINUOUS sequence with no gap and no repeat', () => {
    // Two groups animate, and they are meant to read as one arrival. If the
    // multipliers ever collide or skip, two elements land together or the
    // sequence stalls — neither is visible in a diff.
    const mults = Array.from(CSS.matchAll(/calc\((\d+) \* var\(--motion-stagger-step\)\)/g))
      .map(m => Number(m[1])).sort((a, b) => a - b)
    expect(mults, 'the stagger multipliers must be 0..n with no gap or repeat')
      .toEqual(mults.map((_, i) => i))
  })

  it('3 · the CTA is interactive from first paint — the buttons are NOT in the animated set', () => {
    // The screen's job is CONSENT (MODIFY-CONFIRM-DIFF-01 ruled it a checkout
    // page), so an element the runner must be able to press may not be waiting
    // on an animation. Checked structurally: the stagger classes are only ever
    // applied to the two content containers, and the Buttons are siblings of
    // those containers, not children.
    const staggerOnButton = /<Button[^>]*className=["'][^"']*zonna-stagger/.test(CONFIRM)
    expect(staggerOnButton, 'a Button carries a stagger class').toBe(false)

    // ...and nothing wraps the buttons in a staggered container either. SAVE-PATTERN-01 moved the CTA into the
    // shared frame: the frame animates nothing, and renders the caller's (staggered) body BEFORE the buttons.
    const FRAME = readFileSync('components/shared/ChangeConfirm.tsx', 'utf8')
    expect(CONFIRM, 'the confirm screen re-grew its own buttons').not.toMatch(/<Button\b/)
    expect(FRAME).not.toContain('zonna-stagger')
    // Bounded to the frame's own function: ScaleLabel, above it, renders {children} too.
    const own = FRAME.slice(FRAME.indexOf('export default function ChangeConfirm'))
    const bodyAt = own.indexOf('{children}')
    const buttonAt = own.search(/<Button[\s\S]{0,400}?Accept and save/)
    expect(bodyAt, 'the frame renders the body').toBeGreaterThan(-1)
    expect(buttonAt, 'the primary CTA moved or was renamed — re-check this arm').toBeGreaterThan(-1)
    expect(buttonAt).toBeGreaterThan(bodyAt) // the CTA renders after, outside, the animated body
  })

  it('4 · BOTH tokens collapse under prefers-reduced-motion', () => {
    // A token added to :root and forgotten here never collapses, and nothing
    // would say so. The standing ruling is that every motion token collapses.
    const block = reducedMotionBlock()
    expect(ms('motion-verdict', block), '--motion-verdict does not collapse').toBe(0)
    expect(ms('motion-stagger-step', block), '--motion-stagger-step does not collapse').toBe(0)
  })

  it('5 · the stagger is OPT-IN, because AdjustmentDiff has three consumers', () => {
    // Only the confirm screen was ruled. A hardcoded class would animate the
    // pending-adjustment banner and the adjustments screen too.
    expect(DIFF).toMatch(/stagger\s*=\s*false/)
    expect(DIFF).toContain("stagger ? 'zonna-stagger--late' : undefined")
  })
})
