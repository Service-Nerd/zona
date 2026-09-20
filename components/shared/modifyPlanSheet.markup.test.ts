import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MODIFIABLE_ROWS } from '@/lib/plan/modifyPlan'

/**
 * P-02 — the modify-plan sheet's wiring.
 *
 * The edit logic is unit-tested in `lib/plan/modifyPlan.test.ts`, including
 * the collision semantic. This pins the things that can go wrong in the
 * plumbing without a single sentence changing.
 */
const strip = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

const SHEET   = strip(readFileSync(join(process.cwd(), 'components/shared/ModifyPlanSheet.tsx'), 'utf8'))
const CONFIRM = strip(readFileSync(join(process.cwd(), 'components/shared/ModifyPlanConfirm.tsx'), 'utf8'))
const DASH_RAW = readFileSync(join(process.cwd(), 'app/dashboard/DashboardClient.tsx'), 'utf8')
const DASH = strip(DASH_RAW)

describe('P-02 — the save path is the single writer', () => {
  it('⚠️ applies through savePlanForUser, never a direct plan_json write', () => {
    // Nine routes once bypassed it and persisted unvalidated plans
    // (SAVE-VALIDATE-01). It is ALSO what supersedes week-keyed rows, so a
    // direct write would skip the collision guard as well.
    expect(DASH).toContain('await savePlanForUser(user.id, modifyPreview.next, supabase)')
    const fn = DASH.slice(DASH.indexOf('async function acceptModify'), DASH.indexOf('async function acceptModify') + 900)
    expect(fn).not.toMatch(/from\('plans'\)|plan_json/)
  })

  it('nothing regenerates until Apply, and nothing saves until Accept', () => {
    // Two separate gates. The sheet only ever calls onApply; the save only
    // happens from the confirm step.
    expect(SHEET).toContain('onApply(applyEdits(base, edits), resets)')
    expect(SHEET).not.toContain('savePlanForUser')
    expect(CONFIRM).not.toContain('savePlanForUser')
  })

  it('the confirm step is always shown before a change lands', () => {
    // Acceptance criterion, and a brand rule: no silent structural change.
    expect(DASH).toContain('setModifyPreview({ next, resets })')
    expect(DASH).toContain('<ModifyPlanConfirm')
  })
})

describe('P-02 — gated on the stored input', () => {
  it('the entry point is withheld when the plan has none', () => {
    // 45% of live plans on 2026-09-20. Regenerating from guessed inputs would
    // silently change what the runner never asked to change.
    expect(DASH).toContain('canModifyPlan(plan) ? () => setModifyOpen(true) : undefined')
    expect(DASH).toContain('{onOpenModify && (')
  })
})

describe('P-02 — presentation and copy live where they belong', () => {
  it('uses the Sheet primitive, and does not hand-roll one', () => {
    // SHEET-PRESENT-01: seven surfaces once invented their own z-index and
    // five sat BELOW the nav, so the runner could not see what mattered.
    expect(SHEET).toContain('<Sheet ')
    expect(SHEET).not.toMatch(/position: 'fixed'|zIndex/)
  })

  it('no Cancel top-right: the bar is at the bottom', () => {
    // ux-principles: "slide-up sheets: mirrored nav bar at bottom, not top".
    expect(SHEET).toContain("position: 'sticky', bottom: 0")
  })

  it('never renders a disabled primary as the resting state', () => {
    // Two states: Close when nothing changed, Apply N when something has.
    expect(SHEET).toContain('pending.length === 0 ?')
    expect(SHEET).toContain('Discard changes')
  })

  it('a pending edit reads in MOSS, not amber', () => {
    // Amber is coaching-warning voice; an unapplied edit is not a warning.
    const dot = SHEET.slice(SHEET.indexOf('changed &&'), SHEET.indexOf('changed &&') + 300)
    expect(dot).toContain('var(--moss)')
    expect(dot).not.toContain('var(--warn)')
  })

  it('the row copy comes from the owner, not the component', () => {
    for (const r of MODIFIABLE_ROWS) {
      expect(SHEET, `"${r.consequence}" is retyped in the sheet`).not.toContain(r.consequence)
      expect(SHEET, `"${r.label}" is retyped in the sheet`).not.toContain(`>${r.label}<`)
    }
    expect(SHEET).toContain('MODIFIABLE_ROWS')
  })

  it('reuses AdjustmentDiff rather than building a second diff', () => {
    expect(CONFIRM).toContain('<AdjustmentDiff')
    expect(CONFIRM).not.toContain('computeSessionDiff')
  })

  it('no hardcoded hex, no hardcoded font stack', () => {
    for (const [name, src] of [['sheet', SHEET], ['confirm', CONFIRM]] as const) {
      expect(src, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(src, name).toContain('var(--font-ui)')
    }
  })

  it('no em dash in user-facing copy', () => {
    for (const src of [SHEET, CONFIRM]) {
      for (const m of src.match(/'[^']{15,}'/g) ?? []) expect(m).not.toContain('—')
    }
  })
})

describe('P-02 — a refused edit reads as a coaching decision, not a fault', () => {
  it('a 422 surfaces the engine’s own message', () => {
    // The runner's edit can produce inputs the engine will not build (too few
    // weeks, below the base door). That is a designed refusal, not an error.
    expect(DASH).toContain("setModifyError(data.error ?? 'That change could not be built into a plan.')")
  })
})
