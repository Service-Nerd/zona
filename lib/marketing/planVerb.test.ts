import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * PLANVERB-01 — two doors, two verbs; one input owner; one sheet shape.
 *
 * 🔴 THE DEFECT. The Plan screen and Me both carried a row titled
 * **"Change your plan"**. Plan's opened `ModifyPlanSheet` and KEPT the plan;
 * Me's opened the wizard, which ARCHIVES it. Four identical words, two
 * destinations, one of them destructive. The subtitles did carry the
 * difference and the title is what a runner reads.
 */

const SHELL = readFileSync(join(process.cwd(), 'app/dashboard/DashboardClient.tsx'), 'utf8')
const SHEET = readFileSync(join(process.cwd(), 'components/shared/ModifyPlanSheet.tsx'), 'utf8')

const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

describe('PLANVERB-01 — the two plan doors', () => {
  it('no runner-facing surface says "Change your plan" any more', () => {
    // ⚠️ Comments stripped: this file and the components both EXPLAIN the old
    // string, and a guard that punishes you for documenting what it guards is
    // a guard that gets deleted with the documentation.
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const e of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`
        if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel) }
        else if (/\.tsx$/.test(e.name) && !e.name.includes('.test.')) {
          if (/Change your plan/.test(strip(readFileSync(join(process.cwd(), rel), 'utf8')))) offenders.push(rel)
        }
      }
    }
    walk('app'); walk('components')
    expect(
      offenders,
      'two rows shared this title and went to different places, one of them destructive. '
      + 'Adjust = keeps the plan. Start = replaces it',
    ).toEqual([])
  })

  it('the two verbs exist, and they are different words', () => {
    const code = strip(SHELL)
    expect(code, 'the Plan row keeps the plan').toContain('Adjust your plan')
    expect(code, 'the Me row replaces it').toContain('Start a new plan')
  })

  it('the destructive row names the consequence, not just the destination', () => {
    // The verb change makes this path MORE discoverable, so the subtitle has
    // to be honest about what it costs. "Build a new plan around a different
    // race" described where you go; it never said the plan you have goes away.
    const i = strip(SHELL).indexOf("'Start a new plan'")
    expect(i, 'the Me row moved; re-point this assertion').toBeGreaterThan(0)
    expect(strip(SHELL).slice(i, i + 700)).toMatch(/Replaces the plan you have/)
  })

  it('the race date goes through TextField, never a hand-rolled input', () => {
    // 🔴 It was `<input type="date">` at fontSize 13px — the ONLY input in the
    // app below the 16px floor `TextField` exists to lock. iOS zooms the page
    // on a focused input under 16px, which is the founder's "the date, it's
    // not rendered correctly". The wizard asks the same question through
    // TextField and does not. Same shape as S5: the owner existed and the
    // call site went round it.
    const code = strip(SHEET)
    expect(code, 'the sheet must not hand-roll an input').not.toMatch(/<input\b/)
    const i = code.indexOf("case 'race_date'")
    expect(i).toBeGreaterThan(0)
    expect(code.slice(i, i + 400)).toContain('<TextField')
  })

  it('no input anywhere sets a fontSize below the 16px floor', () => {
    // The rule TextField's header states, made mechanical. Bounded to a style
    // block that also declares an input-ish padding+background, so it cannot
    // fire on ordinary 13px label text.
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const e of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`
        if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel) }
        else if (/\.tsx$/.test(e.name) && !e.name.includes('.test.') && !rel.endsWith('TextField.tsx')) {
          const code = strip(readFileSync(join(process.cwd(), rel), 'utf8'))
          for (const m of Array.from(code.matchAll(/<input\b[\s\S]{0,700}?\/>/g))) {
            const block = m[0]
            if (/type="(checkbox|radio|range)"/.test(block)) continue
            const fs = block.match(/fontSize:\s*'(\d+)px'/)
            if (fs && Number(fs[1]) < 16) offenders.push(`${rel}: ${fs[1]}px`)
          }
        }
      }
    }
    walk('app'); walk('components')
    expect(
      offenders,
      'iOS zooms the page on a focused input below 16px. TextField locks it; use TextField',
    ).toEqual([])
  })

  it('the sheet shows a bottom bar only when there is something to apply (R-5)', () => {
    const code = strip(SHEET)
    expect(code, 'the act-in bar is gated on pending work').toMatch(/\{pending\.length > 0 && \(/)
    expect(code, 'and the browse-state dismiss sits top-right').toMatch(/\{pending\.length === 0 && \(/)
    // Falsifiable both ways: un-gate the bar, or delete the header dismiss.
  })

  it('the sheet offers the wizard door that splitting the verbs closed', () => {
    // ⚠️ THIS ASSERTION WAS HOLLOW ON ITS FIRST WRITE and falsification caught
    // it: `toContain('onStartNewPlan')` passes against `onStartNewPlanX`,
    // because a substring of a renamed identifier is still a substring. Fifth
    // time this repo has recorded the class today. Bound each site: the prop
    // must be DECLARED, RENDERED behind a guard, and PASSED.
    const sheet = strip(SHEET)
    expect(sheet, 'the prop must be declared').toMatch(/\bonStartNewPlan\?:\s*\(\) => void/)
    expect(sheet, 'and rendered behind a guard, not just typed').toMatch(/\{onStartNewPlan && /)
    expect(sheet, 'the row itself').toContain('Start a new plan')
    expect(strip(SHELL), 'the sheet is handed a route to the wizard')
      .toMatch(/\bonStartNewPlan=\{\(\) =>/)
  })
})
