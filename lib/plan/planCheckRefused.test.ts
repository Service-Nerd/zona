/**
 * PLAN-CHECK-REFUSED-01 — a refusal must never be shown as reassurance.
 *
 * 🔴 THE DEFECT. `/api/adjust-plan` returned `{ adjustment: null, message: 'No adjustment
 * needed' }` on two different outcomes: the engine found nothing, and the engine REFUSED
 * because the reshaped plan breaches its own rules (`reshape_invalid`). `ReshapeScreen` maps
 * `adjustment: null` to `status: 'clean'`, which renders a green tick over **"Plan looks
 * good."** and *"No adjustment signals in your recent sessions. Keep going."* — and
 * `onChecked(false)` stamps "Last checked …" as a check that ran and found nothing.
 *
 * Measured 2026-11-03: `validateReshapedPlan` returns EVERY error-severity violation in the
 * plan, so one historical defect anywhere refuses every adjustment forever — **18 of 39 live
 * plans (46%)**, measured at 20 / 51% before the 2 plans §40b Am.4 had frozen were remediated. Those runners were being told their plan looks good by a check that declined to run.
 *
 * ⚠️ WHY THIS IS A SOURCE TEST AND NOT A RENDER TEST, stated rather than skipped.
 * `vitest.config.ts` is `environment: 'node'` with no jsdom, so no test in this repo can
 * mount `ReshapeScreen` and read the rendered panel. The reachable property is the one that
 * actually broke: the route must DISTINGUISH the two outcomes, and the client must branch on
 * that distinction BEFORE the `adjustment` branch and without claiming a check happened.
 * A source assertion can pass on a comment, so each arm is anchored on executable text and
 * falsified.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLAN_CHECK_REFUSED, PLAN_CHANGE_SAVE_FAILED } from '@/lib/ui/planChangeCopy'

const ROUTE  = readFileSync(join(process.cwd(), 'app/api/adjust-plan/route.ts'), 'utf8')
const CLIENT = readFileSync(join(process.cwd(), 'app/dashboard/DashboardClient.tsx'), 'utf8')

/** Blank comment text, preserving length, so an arm cannot be satisfied by prose. */
function stripComments(src: string): string {
  const out = src.split('')
  let i = 0
  while (i < src.length) {
    const c = src[i], d = src[i + 1]
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') { out[i] = ' '; i++ } }
    else if (c === '/' && d === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] !== '\n') out[i] = ' '; i++ }
      out[i] = ' '; out[i + 1] = ' '; i += 2
    } else if (c === '"' || c === "'" || c === '`') {
      i++
      while (i < src.length && src[i] !== c) { if (src[i] === '\\') i++; i++ }
      i++
    } else i++
  }
  return out.join('')
}

const ROUTE_CODE  = stripComments(ROUTE)
const CLIENT_CODE = stripComments(CLIENT)

describe('the copy', () => {
  it('says what happened, promises nothing, and blames nobody', () => {
    expect(PLAN_CHECK_REFUSED).toBeTruthy()
    expect(PLAN_CHECK_REFUSED).not.toBe(PLAN_CHANGE_SAVE_FAILED)   // a refusal is not a failed save
    // §brand voice: never motivational, no exclamation, no emoji in functional copy.
    expect(PLAN_CHECK_REFUSED).not.toMatch(/!|😀|🎉/)
    // CLAUDE.md: no em dash in a sentence the runner reads. En dashes in ranges are fine.
    expect(PLAN_CHECK_REFUSED).not.toContain('—')
    // The claim that was false must not reappear in it.
    expect(PLAN_CHECK_REFUSED.toLowerCase()).not.toContain('looks good')
  })
})

describe('the route distinguishes the two outcomes', () => {
  /**
   * ⚠️ BOUNDED BY LANDMARKS, NOT BY A CHARACTER COUNT. The first cut took 1,400 chars from
   * `'reshape_invalid'` and failed — `stripComments` pads comment text with spaces to keep line
   * numbers honest, so the explanatory comment added by this very fix ate the window whole.
   * That is the second time in two days; a byte window over commented code is not a region.
   */
  const refusalReturn = (() => {
    const start = ROUTE_CODE.indexOf("'reshape_invalid'")
    expect(start, 'the reshape_invalid branch has moved — re-anchor this arm').toBeGreaterThan(0)
    // The branch ends where the happy path resumes; `adjustmentRow` is the next statement.
    const end = ROUTE_CODE.indexOf('const adjustmentRow', start)
    expect(end, 'adjustmentRow has moved — re-anchor this arm').toBeGreaterThan(start)
    const branch = ROUTE_CODE.slice(start, end)
    const m = branch.match(/return NextResponse\.json\(\{[^)]*\)/)
    expect(m, 'the refusal branch no longer returns a NextResponse').toBeTruthy()
    return m![0]
  })()

  it('the reshape-refusal response carries `refused`', () => {
    expect(refusalReturn).toMatch(/refused:/)
  })

  it('still returns `adjustment: null`, so no existing caller changes behaviour', () => {
    expect(refusalReturn).toMatch(/adjustment:\s*null/)
  })

  it('and it is the ONLY place in the route that sets `refused`', () => {
    // A second producer would let the two disagree about what a refusal is.
    expect(ROUTE_CODE.match(/refused:/g) ?? []).toHaveLength(1)
  })
})

describe('the client branches on it, and does not claim a check ran', () => {
  it('reads `data.refused` and routes it away from the clean screen', () => {
    expect(CLIENT_CODE).toMatch(/if \(data\.refused\)/)
  })

  it('the refused branch sits BEFORE the adjustment branch', () => {
    // Order is the defect. After it, a refusal with `adjustment: null` falls through to
    // `setStatus('clean')` and the green tick, which is exactly what shipped.
    const refused = CLIENT_CODE.indexOf('if (data.refused)')
    const adjust  = CLIENT_CODE.indexOf('if (data.adjustment)')
    expect(refused).toBeGreaterThan(0)
    expect(adjust).toBeGreaterThan(0)
    expect(refused).toBeLessThan(adjust)
  })

  it('does NOT call onChecked on a refusal — the check did not run', () => {
    const refused = CLIENT_CODE.indexOf('if (data.refused)')
    const line = CLIENT_CODE.slice(refused, CLIENT_CODE.indexOf('\n', refused))
    expect(line).not.toContain('onChecked')
    // And it must not fall into 'clean', which is what stamps the reassurance.
    expect(line).not.toContain("setStatus('clean')")
    expect(line).toContain('PLAN_CHECK_REFUSED')
  })
})
