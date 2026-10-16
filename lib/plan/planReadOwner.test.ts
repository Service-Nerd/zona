import { describe, it, expect, vi } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { readPlanJson, fetchPlanForUser, PlanReadError } from '@/lib/plan'

/**
 * PLANS-SINGLE-NOT-MAYBE-01 (2026-10-16) — one read of the `plans` row, and a failed read
 * is never treated as "no plan".
 *
 * 🔴 WHAT IT FIXED. 18 hand-written `.single()` reads made a runner with no plan a 406
 * warning (89 of 94 in one day), and none read the error, so a real DB failure WAS "no
 * plan". On `fetchPlanForUser` that meant auto-saving an old gist/legacy plan over the one
 * that could not be read (3 live runners exposed), and on the dashboard it sent a runner who
 * HAS a plan to the wizard.
 */

/** A PostgREST double for one `plans` read. */
function client(result: { data: unknown; error: { message: string } | null }) {
  const calls: string[] = []
  const q: Record<string, unknown> = {}
  Object.assign(q, {
    select: () => q, eq: () => q,
    maybeSingle: async () => { calls.push('maybeSingle'); return result },
    single: async () => { calls.push('single'); return result },
    upsert: async () => { calls.push('upsert'); return { error: null } },
  })
  return { calls, sb: { from: (t: string) => { calls.push(`from:${t}`); return q } } as never }
}

describe('readPlanJson — the one owner', () => {
  it('a runner with no plan is null with NO error (maybeSingle, not single)', async () => {
    const { sb, calls } = client({ data: null, error: null })
    expect(await readPlanJson(sb, 'u1')).toEqual({ plan: null, error: null })
    expect(calls).toContain('maybeSingle')
    expect(calls).not.toContain('single')
  })
  it('a stored plan comes back as the plan', async () => {
    const plan = { meta: {}, weeks: [{ n: 1 }] }
    const { sb } = client({ data: { plan_json: plan }, error: null })
    expect((await readPlanJson(sb, 'u1')).plan).toEqual(plan)
  })
  it('a database error is an ERROR, not "no plan"', async () => {
    const { sb } = client({ data: null, error: { message: 'connection reset' } })
    expect(await readPlanJson(sb, 'u1')).toEqual({ plan: null, error: 'connection reset' })
  })
})

describe('🔴 fetchPlanForUser never auto-saves on a failed read', () => {
  it('throws PlanReadError, and neither fetches the gist nor saves the legacy plan', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { sb, calls } = client({ data: null, error: { message: 'connection reset' } })
    const legacy = { meta: { race_name: 'OLD' }, weeks: [{ n: 1, sessions: {} }] } as never
    await expect(fetchPlanForUser('u1', sb, { gistUrl: 'https://gist.example/old.json', legacyPlanJson: legacy }))
      .rejects.toBeInstanceOf(PlanReadError)
    expect(fetchSpy, 'the old gist was fetched after a failed read').not.toHaveBeenCalled()
    expect(calls.filter(c => c !== 'from:plans' && c !== 'maybeSingle'), 'something was written').toEqual([])
    fetchSpy.mockRestore()
  })
})

describe('no hand-written plan read comes back', () => {
  const files = execSync('git ls-files app lib components', { encoding: 'utf8' }).split('\n')
    .filter(f => /\.(ts|tsx)$/.test(f) && !f.includes('.test.') && f !== 'lib/plan.ts' && f !== 'lib/planRead.ts')
  it('the population is real', () => { expect(files.length).toBeGreaterThan(300) })
  it('🔴 nothing outside lib/planRead.ts (and lib/plan.ts\'s own save path) selects plan_json from plans by hand', () => {
    const offenders = files.filter(f => {
      const s = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
      // Bounded to the call chain that follows `.from('plans')`, never the whole file.
      return Array.from(s.matchAll(/\.from\('plans'\)/g)).some(m => {
        const chain = s.slice(m.index!, m.index! + 160).split(/\n\s*\n|;|\)\s*\n\s*(?:const|let|if|return)\b/)[0]
        return /\.select\('plan_json'\)/.test(chain) && /\.(single|maybeSingle)\(\)/.test(chain)
      })
    })
    expect(offenders, 'use readPlanJson from @/lib/plan').toEqual([])
  })
})

describe('the dashboard shows the load-failed state, not the wizard', () => {
  const src = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
  it('a PlanReadError sets the state, releases the splash and stops', () => {
    const at = src.indexOf('err instanceof PlanReadError')
    expect(at).toBeGreaterThan(-1)
    const arm = src.slice(at, src.indexOf('throw err', at))
    expect(arm).toMatch(/setPlanLoadFailed\(true\)/)
    expect(arm).toMatch(/setAppReady\(true\)/)
    expect(arm).toMatch(/return/)
    expect(arm, 'a failed read must not route to the wizard').not.toMatch(/setScreen\('generate'\)/)
  })
  it('the state renders before the plan guard', () => {
    const failed = src.indexOf('if (planLoadFailed) return <PlanLoadFailed')
    expect(failed).toBeGreaterThan(-1)
    // The render's own guard is the FIRST `if (!plan) return null` after the state, and it
    // must be the one immediately following it (comments are stripped, so anchor on code).
    const guard = src.indexOf('if (!plan) return null', failed)
    expect(guard).toBeGreaterThan(failed)
    expect(src.slice(failed, guard).split('\n').filter(l => l.trim()).length, 'the state is not directly before the guard').toBeLessThanOrEqual(2)
  })
})

describe('PlanLoadFailed renders the §8 Empty State with its one action', () => {
  it('says what happened, that the plan is safe, and offers one retry', async () => {
    const React = (await import('react')).default
    const { renderToStaticMarkup } = await import('react-dom/server')
    ;(globalThis as { React?: unknown }).React = React
    const { PlanLoadFailed } = await import('@/app/dashboard/DashboardClient')
    const html = renderToStaticMarkup(React.createElement(PlanLoadFailed, { onRetry: () => {} }))
    expect(html).toContain('t load your plan.')
    expect(html).toContain('Your plan is safe. Check your connection and try again.')
    expect(html.match(/<button/g) ?? []).toHaveLength(1)
    expect(html).toContain('Try again')
    expect(html, 'no em dash in a runner-facing sentence').not.toContain('—')
  })
})
