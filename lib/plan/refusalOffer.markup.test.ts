import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P-15 — the refusal gains an action.
 *
 * THE DEFECT. `REFUSAL-SCREEN-01` made a §111 refusal read as a calm "not yet"
 * instead of a crash, but it still offered nothing: a first-time marathoner
 * below the base-volume door was told no and handed no route forward. Wood at
 * the SLT: a runner told no with nothing attached either gives up or **trains
 * anyway with no plan**, and the second is worse than admitting them, and more
 * likely for someone who has a London place and has told their friends.
 *
 * ⚠️ P-15'S OWN PREMISE WAS STALE IN OUR FAVOUR. It says the base-build "is
 * P-16 and does not exist yet, so for October the action is a stated route,
 * not a generated plan." §118 shipped the same day: `generateGetRunningPlan`
 * returns a full validated Plan and the route was throwing it away, keeping
 * only `endsAtKm` and `weeks` for the offer copy. So the October action is a
 * REAL PLAN, and the acceptance path is three lines rather than a second
 * generator.
 *
 * ⚠️ WHY A MARKUP TEST. This screen is behind auth and behind a wizard, so
 * nothing in the suite can drive it. This repo has recorded the cost of
 * treating that as permission to ship a comment instead of the work. The test
 * pins the properties that would be silently broken by an ordinary edit; it
 * cannot tell you the screen looks right, and P-15's own acceptance criteria
 * require it to be walked on a device before the codes go out.
 *
 * ⚠️ IT LIVES IN lib/ AND NOT BESIDE THE COMPONENT ON PURPOSE. vitest.config
 * collects `lib/**` and `components/**` only, so a test written next to the
 * screen in `app/dashboard/` is silently NEVER RUN. The first cut of this file
 * was there and reported "No test files found" rather than failing — a green
 * suite with a test in it that does not execute is worse than no test.
 */
const SCREEN = readFileSync(join(process.cwd(), 'app/dashboard/GeneratePlanScreen.tsx'), 'utf8')
/** The view itself, extracted so `/refusal-preview` can render the REAL one. */
const VIEW   = readFileSync(join(process.cwd(), 'components/shared/RefusalView.tsx'), 'utf8')
const ROUTE  = readFileSync(join(process.cwd(), 'app/api/generate-plan/route.ts'), 'utf8')
const COPY   = readFileSync(join(process.cwd(), 'lib/plan/baseBuildCopy.ts'), 'utf8')

/** The `appStep === 'error'` branch only, bounded by the next branch after it. */
/**
 * The markup under test: the whole extracted component.
 *
 * ⚠️ IT USED TO BE A SOURCE SLICE OF THE 1,400-LINE SCREEN, and that went
 * wrong THREE TIMES in this one file — an end bound that matched an earlier
 * occurrence and produced an EMPTY slice, then a start anchor that also
 * matched a one-line early return in a nav handler 450 lines away. Each time
 * the assertions passed while inspecting the wrong region, which is
 * indistinguishable from a passing test. Extracting `RefusalView` removed the
 * whole class: there is nothing to slice.
 */
function errorBranch(): string { return VIEW }

describe('P-15 — a refusal never terminates without a named next action', () => {
  it('reads the real files, so nothing below can pass vacuously', () => {
    expect(SCREEN).toContain('<RefusalView')
    expect(VIEW).toContain('export default function RefusalView')
    expect(ROUTE).toMatch(/\bgetRunningApplies\b/)
  })

  it('the client READS the offer the server already computes', () => {
    // It was computed, unit-formatted and attached for a full day while the
    // client read `payload.alternatives` and never `get_running`.
    expect(SCREEN).toMatch(/\bget_running\b/)
    expect(SCREEN).toMatch(/\berrorOffer\b/)
  })

  it('the offer renders ONLY on a refusal that carries one', () => {
    // A prep-time or days refusal gets no §118 offer and must show none.
    // ⚠️ Asserts the GUARD ON THE CARD, inside the error branch, not merely
    // that the substring exists somewhere. The first version checked the whole
    // file, so replacing the card's condition with `false &&` left it green —
    // the card could be switched off without a single test noticing.
    expect(VIEW).toContain('{showOffer && (')
    expect(VIEW).toContain('const showOffer = isRefusal && !!offer')
  })

  it('every offer string comes from the server, none from the component', () => {
    // Two variants keyed on `reaches_race_door`; the non-clearing one must say
    // NOTHING about a race. A client-side template would be free to break that.
    expect(VIEW).toContain('{offer!.title}')
    expect(VIEW).toContain('{offer!.line}')
    expect(VIEW).toContain('{offer!.why}')
    // The owner holds the sentences; the screen must not restate them.
    expect(COPY).toContain('base building takes you to')
    expect(VIEW).not.toContain('base building takes you to')
  })

  it('accepting posts the flag, through the SAME generate path', () => {
    // Not a second fetch: the success path it needs (save, foundation check,
    // preview) is forty lines long and a copy would drift from it.
    expect(SCREEN).toContain('handleGenerate({ acceptBaseBuild: true })')
    expect(SCREEN).toContain('accept_base_build: true')
    expect(ROUTE).toMatch(/\baccept_base_build\b/)
    expect(ROUTE).toContain('acceptBaseBuild && getRunningApplies(input)')
  })

  it('the server returns a real plan, not a promise of one', () => {
    expect(ROUTE).toMatch(/const \{ plan: baseBuildPlan \} = generateGetRunningPlan/)
    expect(ROUTE).toContain('NextResponse.json({ plan: baseBuildPlan })')
  })

  it('never a dead end: adjusting the answers stays visible alongside the offer', () => {
    // ux-principles bars dead ends and the design system treats a CTA with no
    // visible alternative as a dark pattern. Both branches keep the path.
    const count = VIEW.split('Adjust my answers').length - 1
    expect(count, 'the secondary path must exist in BOTH the offer and no-offer branches').toBe(2)
  })

  it('is not a modal, which P-15 names explicitly', () => {
    // ⚠️ Sliced to the NEXT preview branch AFTER the error one. The first cut
    // used a bare indexOf for the end bound, which matched an earlier
    // occurrence and produced an EMPTY slice — a "no hardcoded hex" assertion
    // that passes because it is inspecting nothing.
    const errorView = errorBranch()
    expect(errorView).not.toMatch(/Modal|Dialog|position: 'fixed'/)
  })

  it('uses design tokens only — no hardcoded hex, no hardcoded font stack', () => {
    // ⚠️ Sliced to the NEXT preview branch AFTER the error one. The first cut
    // used a bare indexOf for the end bound, which matched an earlier
    // occurrence and produced an EMPTY slice — a "no hardcoded hex" assertion
    // that passes because it is inspecting nothing.
    const errorView = errorBranch()
    expect(errorView).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(errorView).toContain('var(--moss)')
    expect(errorView).toContain('var(--font-ui)')
  })

  it('the offer sits on --card, not inside the amber warning block', () => {
    // Amber is coach-warning voice; an offer rendered inside it reads as more
    // bad news, which is the opposite of what this screen now needs to do.
    const offerAt = VIEW.indexOf('{offer!.title}')
    const block = VIEW.slice(VIEW.lastIndexOf('<div style={{', offerAt) - 600, offerAt)
    expect(block).toContain("background: 'var(--card)'")
    expect(block).not.toContain('var(--warn-bg)')
  })

  it('a failed acceptance keeps the offer on screen', () => {
    // The runner said yes and the network did not. Losing the card would make
    // the failure look like a second refusal.
    expect(SCREEN).toMatch(/\bofferFailed\b/)
    expect(SCREEN).toContain('if (!opts?.acceptBaseBuild) setErrorOffer(null)')
  })
})
