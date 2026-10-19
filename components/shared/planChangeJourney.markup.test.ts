import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { generateStrengthPlan, standaloneContext, withChosenDays, type StrengthProfile } from '@/packages/strength'

/**
 * 🔴 SAVE-PATTERN-01 (Design Board 2026-10-18) — changing a plan is ONE journey, run or strength:
 * edit (a screen) → "Here is what changes" (strength only when a plan exists) → accept → Plan, with a line
 * naming the change. The founder's report: "It's not clear it's doing anything."
 */
;(globalThis as { React?: unknown }).React = React
const strip = (s: string) => s.split('\n').filter(l => !/^\s*(\/\/|\*|\{\/\*)/.test(l)).join('\n')
const DASH = strip(readFileSync('app/dashboard/DashboardClient.tsx', 'utf8'))
const fn = (name: string, len = 1400) => { const i = DASH.indexOf(name); expect(i, name).toBeGreaterThan(-1); return DASH.slice(i, i + len) }

async function frame(props: Record<string, unknown>) {
  const { default: C } = await import('./ChangeConfirm')
  return renderToStaticMarkup(React.createElement(C, { onBack: () => {}, backLabel: 'Back', onAccept: () => {}, onCancel: () => {}, applying: false, ...props } as never, React.createElement('p', null, 'body')))
}

describe('the consent frame (shared by the run and strength screens)', () => {
  it('while saving, the primary button carries the state, and Keep cannot be pressed', async () => {
    const html = await frame({ applying: true })
    expect(html).toContain('Saving your plan…')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*Keep my current plan/)
  })
  it('🔴 a failure is said under Accept, in the error component, and only when there is one', async () => {
    const html = await frame({ error: 'Couldn’t save that change. Your plan is as it was.' })
    const accept = html.indexOf('Accept and save'), err = html.indexOf('role="alert"'), keep = html.indexOf('Keep my current plan')
    expect(err).toBeGreaterThan(accept)
    expect(err).toBeLessThan(keep)
    expect(await frame({})).not.toContain('role="alert"')
  })
  it('both consent screens use the frame, so they cannot drift', () => {
    expect(readFileSync('components/shared/ModifyPlanConfirm.tsx', 'utf8')).toMatch(/<ChangeConfirm\b/)
    expect(readFileSync('components/dashboard/StrengthChangeConfirm.tsx', 'utf8')).toMatch(/<ChangeConfirm\b/)
  })
})

describe('the run journey lands on Plan with a readback', () => {
  it('🔴 acceptModify sets the readback only AFTER the save lands', () => {
    const body = fn('async function acceptModify')
    const save = body.indexOf('await savePlanForUser(user.id, pending.next, supabase)')
    const read = body.indexOf('setPlanReadback(runPlanReadback(')
    expect(save).toBeGreaterThan(-1)
    expect(read).toBeGreaterThan(save)
  })
  it('Plan renders it first, above the race, announced, at FieldReadback weight', () => {
    const plan = fn('function PlanScreen', 40000)
    const line = plan.indexOf('{readback && (')
    expect(line).toBeGreaterThan(-1)
    expect(plan.slice(line, line + 200)).toMatch(/role="status"[\s\S]*<FieldReadback>\{readback\}<\/FieldReadback>/)
    expect(line).toBeLessThan(plan.indexOf('{(raceName || raceDateStr) && ('))
  })
  it('it lives until the runner leaves Plan (no timer, no auto-dismiss)', () => {
    expect(DASH).toContain("useEffect(() => { if (screen !== 'plan') setPlanReadback(null) }, [screen])")
    expect(DASH).not.toMatch(/setTimeout\([^)]*setPlanReadback/)
  })
})

describe('the strength journey is the same journey', () => {
  it('🔴 with a plan already: preview first, never a direct save', () => {
    const body = fn('async function handleStrengthSetupSave', 500)
    expect(body).toMatch(/if \(!before\) return commitStrength\(profile, null\)/)
    expect(body).toContain('await previewStrength(profile)')
    expect(body).not.toContain('saveStrength(')
  })
  it('accepting saves, then lands on Plan with the strength readback', () => {
    const body = fn('async function commitStrength', 500)
    expect(body.indexOf('await saveStrength(profile)')).toBeLessThan(body.indexOf('setPlanReadback(strengthPlanReadback('))
    expect(body).toContain("setScreen('plan')")
  })
  it('back from the consent screen keeps the answers', () => {
    expect(DASH).toContain('draft={strengthDraft}')
  })
})

describe('StrengthChangeConfirm, on real engine plans', () => {
  const base: StrengthProfile = { focus: 'running', session_minutes: 45, sessions_per_week: 2, equipment: ['dumbbells', 'bench'], experience: 'some' }
  const ctx = standaloneContext('2026-11-02')
  const render = async (b: StrengthProfile, a: StrengthProfile) => {
    const { default: S } = await import('@/components/dashboard/StrengthChangeConfirm')
    return renderToStaticMarkup(React.createElement(S, {
      before: generateStrengthPlan(b, ctx), after: generateStrengthPlan(a, ctx), weekN: 3,
      onAccept: () => {}, onBack: () => {}, onCancel: () => {}, applying: false,
    }))
  }
  it('new days show on the plan scale and in this week', async () => {
    const html = await render(withChosenDays(base, ['mon', 'wed']), withChosenDays(base, ['tue', 'fri']))
    expect(html).toContain('Your strength plan')
    expect(html).toMatch(/Mon, Wed[\s\S]*Tue, Fri/)
    expect(html).toContain('What changes this week')
  })
  it('🔴 a session that changes KIND on the same day is shown changing, not as the same thing twice', async () => {
    const { default: S } = await import('@/components/dashboard/StrengthChangeConfirm')
    const before = generateStrengthPlan(withChosenDays(base, ['mon', 'fri']), ctx)
    const after = JSON.parse(JSON.stringify(before))
    const fri = after.weeks.find((w: { n: number }) => w.n === 3).sessions.find((x: { day: string }) => x.day === 'fri')
    fri.kind = fri.kind === 'upper_core' ? 'lower_core' : 'upper_core'
    const html = renderToStaticMarkup(React.createElement(S, { before, after, weekN: 3, onAccept: () => {}, onBack: () => {}, onCancel: () => {}, applying: false }))
    const row = html.match(/>Fri<\/span>[\s\S]*?strength \(([^)]+)\)[\s\S]*?strength \(([^)]+)\)/)
    expect(row, 'the Friday row renders both sides by kind').not.toBeNull()
    expect(row![1]).not.toBe(row![2])
  })
  it('🔴 STRENGTH-CHOSEN-NO-LEGS-01: days with no legal heavy legs are said, in the approved words', async () => {
    const { default: S } = await import('@/components/dashboard/StrengthChangeConfirm')
    const before = generateStrengthPlan(withChosenDays(base, ['mon', 'wed']), ctx)
    const after = { ...generateStrengthPlan(withChosenDays(base, ['tue', 'fri']), ctx), notes: ['legs_limited_by_run_week' as const] }
    const html = renderToStaticMarkup(React.createElement(S, { before, after, weekN: 3, onAccept: () => {}, onBack: () => {}, onCancel: () => {}, applying: false }))
    expect(html).toContain('Your run week keeps heavy legs off these days, so they get lighter leg work.')
    expect(await render(withChosenDays(base, ['mon', 'wed']), withChosenDays(base, ['tue', 'fri']))).not.toContain('lighter leg work')
  })
  it('🔴 a General runner is never promised leg work they do not get (founder\'s plan, 2026-10-19)', async () => {
    const { default: S } = await import('@/components/dashboard/StrengthChangeConfirm')
    const general = { ...base, focus: 'general' as const }
    const before = generateStrengthPlan(withChosenDays(general, ['mon', 'wed']), ctx)
    const after = { ...generateStrengthPlan(withChosenDays(general, ['tue', 'fri']), ctx), notes: ['legs_limited_by_run_week' as const] }
    const html = renderToStaticMarkup(React.createElement(S, { before, after, weekN: 3, onAccept: () => {}, onBack: () => {}, onCancel: () => {}, applying: false }))
    expect(html).not.toContain('lighter leg work')
    expect(html).toContain('some sessions are upper body')
  })
  it('an unchanged plan says so instead of showing an empty screen', async () => {
    const html = await render(withChosenDays(base, ['mon', 'wed']), withChosenDays(base, ['mon', 'wed']))
    expect(html).toContain('Your sessions stay as they are.')
    expect(html).not.toContain('What changes this week')
  })
})
