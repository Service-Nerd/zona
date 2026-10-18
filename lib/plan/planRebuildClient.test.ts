import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * PLAN-REBUILD-SUPERSEDE-01 — the two client halves, asserted on the source because `app/` has no render harness
 * for these flows. Comments are stripped first: an assertion that passes on a comment is not one.
 */
const src = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const body = (start: string, end: string) => { const i = src.indexOf(start); return src.slice(i, src.indexOf(end, i + start.length)) }

describe('the modify preview asks the same owner as the save', () => {
  it('🔴 every preview it records carries resetsFor(next), and resetsFor reads calendarChangedWeeks', () => {
    const b = body('async function runModifyPreview(', 'setModifyPreview({ next, resets: resetsFor(next) })')
    expect(b).toMatch(/const resetsFor = \(built: Plan\) => resets \|\| calendarChangedWeeks\(plan, built\)\.length > 0/)
    expect((src.match(/resets: resetsFor\(next\)/g) ?? []).length).toBe(3)
    expect(src).not.toMatch(/modifyPreviewRef\.current = \{ next, resets \}/)
  })
})

describe('a saved plan drops the rows it set aside from the screen', () => {
  it('🔴 the wizard save re-reads AFTER the plan write, never before it', () => {
    const b = body('async function handlePlanSaved(', 'async function ')
    const save = b.indexOf('savePlanForUser(user.id, savedPlan, supabase)')
    const refresh = b.indexOf('refreshPlanScopedRows()')
    expect(save).toBeGreaterThan(-1)
    expect(refresh).toBeGreaterThan(save)
  })
  it('🔴 the modify save re-reads after its write', () => {
    const b = body('await savePlanForUser(user.id, pending.next, supabase)', 'clearModify()')
    expect(b).toContain('refreshPlanScopedRows()')
  })
  it('the re-read covers completions AND moves, live only', () => {
    const b = body('async function refreshPlanScopedRows()', 'async function refreshCompletions()')
    expect(b).toContain('await refreshCompletions()')
    expect(b).toMatch(/from\('session_overrides'\)\.select\(SESSION_OVERRIDE_COLUMNS\)[^\n]*\.is\('superseded_at', null\)/)
  })
})
