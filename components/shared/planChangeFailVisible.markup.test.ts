import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { readFileSync } from 'node:fs'
import PendingAdjustmentBanner from './PendingAdjustmentBanner'
import { PLAN_CHANGE_SAVE_FAILED } from '@/lib/ui/planChangeCopy'

/**
 * PLAN-CHANGE-FAIL-VISIBLE-01 (2026-10-16) — a plan change that did not save is SAID, on
 * every surface that can make one, and the Adjust sheet's failure is RECORDED.
 *
 * 🔴 THE DEFECT. Six handlers on three surfaces (Today's change card, Today's readiness
 * card, the Reshape screen) caught a failed confirm/revert with `/* keep visible *\/` and
 * nothing else, so a failed save looked like a tap that did not register. The Adjust sheet
 * did tell the runner, in `--warn` (the COACHING colour), and recorded nothing.
 *
 * The banner is RENDERED. The handlers live in components that need a session and a
 * network, so they are asserted on bounded, comment-stripped source — stated, not hidden.
 */

const strip = (f: string) => readFileSync(f, 'utf8')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')

/** The body of `async function <name>(`, bounded to its own braces. */
function body(src: string, name: string, from = 0): string {
  const at = src.indexOf(`async function ${name}(`, from)
  expect(at, `${name} moved or was renamed — re-anchor`).toBeGreaterThan(-1)
  let depth = 0, i = src.indexOf('{', src.indexOf(')', at)), start = i
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) break }
  }
  return src.slice(start, i + 1)
}

const banner = (error?: string | null) => renderToStaticMarkup(
  React.createElement(PendingAdjustmentBanner, { onConfirm: () => {}, onRevert: () => {}, error, children: 'Moved your tempo.' }),
)

describe('PendingAdjustmentBanner renders the failure', () => {
  it('🔴 an error renders as an announced alert in the error-text colour', () => {
    const html = banner(PLAN_CHANGE_SAVE_FAILED)
    expect(html).toContain('role="alert"')
    expect(html).toContain(PLAN_CHANGE_SAVE_FAILED)
    // --danger fails AA on --warn-bg (4.46:1); --danger-strong is 5.38:1.
    expect(html).toContain('var(--danger-strong)')
    expect(html).not.toMatch(/color:\s*var\(--danger\)[;"]/)
  })
  it('no error renders nothing extra', () => {
    expect(banner(null)).not.toContain('role="alert"')
    expect(banner(undefined)).not.toContain('role="alert"')
  })
})

describe('every confirm/revert handler says so when it fails', () => {
  const today = strip('components/dashboard/TodayScreen.tsx')
  const dash = strip('app/dashboard/DashboardClient.tsx')

  const handlers: [string, string, string, number][] = [
    ['TodayScreen', today, 'confirm', 0],
    ['TodayScreen', today, 'revert', 0],
    // STRENGTH-RECOVERY-01 — the recovery card's two handlers became ONE `answer(kind)` (the run's answer
    // covers the lift), so one anchor holds both buttons.
    ['TodayScreen', today, 'answer', 0],
    ['DashboardClient', dash, 'handleConfirm', 0],
    ['DashboardClient', dash, 'handleDismiss', 0],
  ]
  for (const [file, src, fn] of handlers) {
    it(`${file} ${fn}: clears on retry and sets the message on failure`, () => {
      const b = body(src, fn)
      expect(b, 'a retry leaves the old message up').toMatch(/setSaveError\(\s*null\s*\)/)
      expect(b, 'the failure is swallowed again').toMatch(/catch\s*\{\s*setSaveError\(PLAN_CHANGE_SAVE_FAILED\)/)
    })
  }

  it('the Reshape dismiss also says so on a non-200 (it only checked res.ok)', () => {
    expect(body(dash, 'handleDismiss')).toMatch(/else\s+setSaveError\(PLAN_CHANGE_SAVE_FAILED\)/)
  })

  it('both banners and the readiness card render the error', () => {
    expect((today.match(/error=\{saveError\}/g) ?? []).length).toBe(1)
    expect(dash).toMatch(/onRevert=\{handleDismiss\}[\s\S]{0,80}error=\{saveError\}/)
    expect(today).toMatch(/\{saveError && \(\s*<InlineError\b/)
  })
})

describe('the Adjust sheet is recorded, and in the error colour', () => {
  const dash = strip('app/dashboard/DashboardClient.tsx')

  it('🔴 acceptModify reports the failure, tagged modify, AFTER showing the message', () => {
    const b = body(dash, 'acceptModify')
    const c = b.slice(b.lastIndexOf('catch'))
    expect(c).toMatch(/catch\s*\(\s*\w+\s*\)/)
    expect(c).toMatch(/reportPlanSaveFailure\([^)]*surface:\s*'modify'/)
    expect(c.indexOf('setModifyError(')).toBeLessThan(c.indexOf('reportPlanSaveFailure('))
  })

  it('its message is no longer the coaching colour', () => {
    const at = dash.indexOf('{modifyError && (')
    expect(at).toBeGreaterThan(-1)
    const block = dash.slice(at, dash.indexOf('</InlineError>', at))
    expect(block).not.toContain('var(--warn)')
    expect(block, 'the Adjust sheet hand-styles its error again').toMatch(/<InlineError\b/)
  })
})
