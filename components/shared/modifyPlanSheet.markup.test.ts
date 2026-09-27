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
const SHEET_PRIMITIVE = readFileSync(join(process.cwd(), 'components/shared/Sheet.tsx'), 'utf8')
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
    // ⚠️ THE SHAPE CHANGED, THE RULE DID NOT (R-5, PLANVERB-01). This used to
    // read `pending.length === 0 ?` — a ternary choosing between a full-width
    // Close and Apply N. The resting state is now NO BAR AT ALL: a top-right
    // dismiss in the header, and the bottom bar arrives with the work. The
    // rule is satisfied more completely than before, because there is no
    // primary in the resting state to be disabled.
    expect(SHEET, 'the act-in bar is gated on there being something to apply')
      .toContain('{pending.length > 0 && (')
    // ⚠️ THE DISMISS MOVED TO `Sheet`, THE RULE DID NOT (SHEET-CLOSE-OWNER-01,
    // 2026-09-25). This asserted the sheet renders its OWN top-right cross
    // under `{pending.length === 0 && (`. Six sheets hand-rolled three
    // different ways out, so `Sheet` now owns the close and every sheet gets
    // the same one — plus swipe-down, which the drag pill had been promising
    // and not delivering since it was written.
    //
    // 🔴 THIS TEST FAILING IS WHAT CAUGHT THAT, and the right response was to
    // follow the rule to its new home, not to delete the assertion. The
    // behaviour asserted — a browse state with a dismiss and no bottom bar —
    // is unchanged and is now guaranteed for EVERY sheet rather than this one.
    expect(SHEET_PRIMITIVE, 'the dismiss must exist for the browse state')
      .toMatch(/<IconButton[\s\S]{0,200}ariaLabel="Close"/)
    expect(SHEET, 'this sheet must not re-grow its own close')
      .not.toContain('ariaLabel="Close"')
    expect(SHEET, 'and a pending state can still be abandoned').toContain('Discard changes')
    // The thing actually forbidden, stated directly rather than implied by a
    // ternary's presence: no `disabled` primary painted in the CTA colour
    // while nothing is pending.
    expect(SHEET).not.toMatch(/disabled=\{pending\.length === 0\}/)
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
    expect(SHEET).toMatch(/\bMODIFIABLE_ROWS\b/)
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

/**
 * MODIFY-CONFIRM-01 — Design Board, 2026-09-27. The founder, on his own device:
 * *"There is no back button top left… the message with mon, tues, wed, thurs.
 * Is that across the whole plan? It doesn't tell me a lot."*
 *
 * 🔴 THE DEFECT UNDER THE MISSING ARROW WAS WORSE THAN THE MISSING ARROW.
 * `edits` was `useState` INSIDE `ModifyPlanSheet`, and reaching the confirm
 * screen unmounts that sheet. So the diff's only exit — "Keep my current plan"
 * — **destroyed every edit**, and there was no other way back. Wanting to
 * change one of two edits cost you both. His screenshot says "Apply 2 changes".
 */
describe('MODIFY-CONFIRM-01 — the diff is reversible and names its own scale', () => {
  it('🔴 clause 1 — the sheet does NOT own `edits`; the caller does', () => {
    // This is the whole fix. A back arrow over sheet-local state would return
    // the runner to an EMPTY sheet, which is the same loss with extra steps.
    expect(SHEET, 'edits went back to sheet-local state — the arrow is now a lie')
      .not.toMatch(/useState<PlanEdits>/)
    expect(SHEET).toMatch(/edits,\s*\n\s*onEditsChange,/)
    expect(DASH, 'the caller must own the edits').toMatch(/const \[modifyEdits, setModifyEdits\] = useState<PlanEdits>/)
  })

  it('🔴 clause 1 — BACK returns to the sheet and does NOT clear the edits', () => {
    // ⚠️ BOUND THE REGION. A fixed-width slice here ran past the end of the
    // handler into the NEXT prop (`onCancel={clearModify}`) and failed on a
    // string that was not in the expression under test. Same class this repo
    // has recorded four times; caught by it firing on correct code.
    const start = DASH.indexOf('onBack={() =>')
    const onBack = DASH.slice(start, DASH.indexOf('}}', start) + 2)
    expect(onBack, 'back must re-open the sheet').toContain('setModifyOpen(true)')
    expect(onBack, '🔴 back must NOT discard — that was the defect').not.toContain('setModifyEdits')
    expect(onBack, 'back must not call the discard owner either').not.toContain('clearModify')
  })

  it('🔴 clause 3 — DISCARD is the only thing that drops the edits, and it is one owner', () => {
    expect(DASH).toMatch(/function clearModify\(\)/)
    const fn = DASH.slice(DASH.indexOf('function clearModify()'), DASH.indexOf('function clearModify()') + 260)
    expect(fn).toContain('setModifyEdits({})')
    expect(DASH, '"Keep my current plan" is the discard').toMatch(/onCancel=\{clearModify\}/)
  })

  it('🔴 clause 2 — the two scales are named, because they are different objects', () => {
    // The white card is the WHOLE PLAN (weeks.length / max / sum); the day rows
    // are ONE WEEK (`p.weeks[weekIndex]`). They rendered adjacent with nothing
    // between them, and the founder read them as one list.
    expect(CONFIRM).toContain('Your whole plan')
    expect(CONFIRM).toMatch(/This week\{weekLabel\}/)
    expect(CONFIRM, 'the week must name itself, not say "this week" and stop')
      .toMatch(/week \$\{weekN\} of \$\{a\.weeks\}/)
  })

  it('🔴 clause 2 — the accessible name is no longer a LIE about scope', () => {
    const DIFF = strip(readFileSync(join(process.cwd(), 'components/shared/AdjustmentDiff.tsx'), 'utf8'))
    expect(DIFF, 'aria-label was hardcoded "Plan changes" on ONE WEEK of data')
      .not.toMatch(/aria-label="Plan changes"/)
    expect(DIFF).toMatch(/aria-label=\{scopeLabel\}/)
    expect(CONFIRM, 'the confirm screen must pass the scope it is actually showing')
      .toMatch(/scopeLabel=/)
  })

  it('🔴 the back arrow is the OWNER, not a second hand-rolled one', () => {
    // UI-BACKARROW-01. `backArrowOwner.test.ts` pins the import form; this pins
    // that the control exists on this screen at all.
    expect(CONFIRM).toMatch(/<BackButton\b/)
    expect(CONFIRM).toMatch(/import BackButton from '@\/components\/shared\/BackButton'/)
  })
})
