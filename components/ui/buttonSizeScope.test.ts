import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import BASELINE from './__fixtures__/fullWidthCompactBaseline.json'

/**
 * CTA-COMPACT-SCOPE-01 — `compact` means FOR SIDE-BY-SIDE ROWS, not "small".
 *
 * Design Board, 2026-10-14. The founder, on a device: "The CTA's still look dated
 * though. i.e. Apply x change and discard changes."
 *
 * 🔴 THE PRECEDENT THAT SHAPED THE RULING. He raised this once before
 * (`BUTTON-COMPONENT-01`, 2026-09-24: "all our cta buttons are very flat visually").
 * The board ruled the question was wrong, that the answer was a missing Button
 * component with elevation as one of its properties, and THAT SHIPPED —
 * `--shadow-lifted` went from 0 consumers to 3. **The complaint survived its own fix**,
 * so the second sitting had to look somewhere other than polish.
 *
 * 📐 WHERE IT LOOKED, measured from the real globals.css at 375pt:
 *   primary   47px / 14px / radius 18 / --shadow-lifted
 *   secondary 44px / 12px / radius 14 / no shadow
 * Same width, stacked 8px apart, differing on THREE properties at once.
 *
 * 🔑 AND THE REASON IS A LAYOUT REASON WEARING A SIZE NAME. `ui-patterns.md` states
 * compact's entire justification: "Action rows use `compact`, because `regular` wraps",
 * measured on **a two-button row at flex:1 / flex:2**, where regular gives 74px and two
 * lines. A STACKED FULL-WIDTH button has the whole 295px and cannot wrap — measured at
 * regular: 49px, one line. So the class was being chosen by its name, by 17 call sites.
 *
 * ⚠️ THE RULING IS NOT "MAKE THE PAIR MATCH", AND THAT MATTERS HERE. Sierra: these are
 * not peer actions. Only ONE of the journey's five was the form reset the board gave a
 * ghost treatment; "Keep my current plan" is the DECLINE on a consent screen, and
 * quietening a decline is a dark pattern. The other four became `regular`, not ghost.
 */

const FILES = execSync("git ls-files '*.tsx'", { encoding: 'utf8' })
  .trim().split('\n').filter(f => f && !f.includes('.test.'))

/** A `<Button …>` open tag carrying BOTH fullWidth and size="compact". */
const PAIR = /<Button(?=[^>]*\bfullWidth\b)(?=[^>]*size=["']compact["'])[^>]*>/g

function offenders(src: string): number {
  return (src.match(PAIR) ?? []).length
}

const counted: Record<string, number> = {}
for (const f of FILES) {
  const n = offenders(readFileSync(f, 'utf8'))
  if (n) counted[f] = n
}

// The plan-adjustment journey — the scope the founder named and the board ruled on.
const JOURNEY = [
  'components/shared/ModifyPlanSheet.tsx',
  'components/shared/ModifyPlanConfirm.tsx',
  'components/shared/RefusalView.tsx',
  'components/shared/AdjustmentDiff.tsx',
  'components/shared/PendingAdjustmentBanner.tsx',
  'components/dashboard/PlanAdjustmentsScreen.tsx',
]

describe('CTA-COMPACT-SCOPE-01 — compact is for rows, not for stacks', () => {
  it('the population is real', () => {
    expect(FILES.length).toBeGreaterThan(100)
    // The regex must be able to find the shape at all, or every arm below is
    // asserting about an empty set. The baseline is the proof it can.
    expect(Object.keys(BASELINE as Record<string, number>).length).toBeGreaterThan(0)
  })

  it('the matcher finds the shape in both prop orders, and ignores a plain compact', () => {
    // Falsifying this by hand found that a naive /fullWidth.*compact/ misses the
    // reversed order, which is how a population quietly halves.
    expect(offenders('<Button variant="x" size="compact" fullWidth >a</Button>')).toBe(1)
    expect(offenders('<Button variant="x" fullWidth size="compact">a</Button>')).toBe(1)
    expect(offenders('<Button variant="x" size="compact">a</Button>')).toBe(0)   // a ROW button: legal
    expect(offenders('<Button variant="x" fullWidth>a</Button>')).toBe(0)
  })

  it('🔴 the plan-adjustment journey carries NONE', () => {
    const found = JOURNEY.filter(f => counted[f]).map(f => `${f}: ${counted[f]}`)
    expect(found, found.length
      ? `a stacked full-width button took \`compact\` again:\n${found.join('\n')}\n\n`
        + 'compact exists to stop a SIDE-BY-SIDE row wrapping (ui-patterns.md). A '
        + 'full-width button has the whole width and cannot wrap. Drop the size prop.'
      : 'ok').toEqual([])
  })

  it('the 12 elsewhere are declared debt and cannot grow', () => {
    // Not a sweep: the founder declined the all-9-screens option and the board
    // shipped only the journey. This holds the rest where they are.
    const grown: string[] = []
    for (const [f, n] of Object.entries(counted)) {
      const allowed = (BASELINE as Record<string, number>)[f] ?? 0
      if (n > allowed) grown.push(`${f}: ${n} vs baseline ${allowed}`)
    }
    expect(grown, grown.length ? `fullWidth+compact grew:\n${grown.join('\n')}` : 'ok').toEqual([])
  })

  it('a baseline entry that has been PAID is removed, not left to rot', () => {
    const stale: string[] = []
    for (const [f, allowed] of Object.entries(BASELINE as Record<string, number>)) {
      const actual = counted[f] ?? 0
      if (actual < allowed) stale.push(`${f}: ${actual} vs baseline ${allowed} — PAID, lower it`)
    }
    expect(stale, stale.length ? `BASELINE IS STALE.\n${stale.join('\n')}` : 'ok').toEqual([])
  })

  it('ui-patterns.md carries the meaning, or this gate enforces an unwritten rule', () => {
    const doc = readFileSync('docs/canonical/ui-patterns.md', 'utf8')
    expect(doc).toContain('`compact` is a ROW class, not a size')
  })

  it('the reset action says what it does', () => {
    // It clears the pending selections and LEAVES YOU ON THE SHEET; the X exits.
    // "Discard changes" named the X's outcome. Founder approved the replacement.
    // ⚠️ STRIP COMMENTS FIRST. The first cut of this arm failed on the comment I
    // had just written three lines above the button, which QUOTES the old label to
    // explain why it went. A string in a comment is prose -- the same lesson as
    // HOOK-RGBA-COMMENTS-01, and the third time it has bitten in one day.
    const raw = readFileSync('components/shared/ModifyPlanSheet.tsx', 'utf8')
    const code = raw
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    expect(code).toContain('Reset my selections')
    expect(code).not.toContain('Discard changes')
    expect(raw).toContain('Discard changes')  // the comment explaining the change survives
  })
})
