// PLAN-DOORS-01 (6t-k) — leaving a door returns to where it was opened. vitest is `environment: 'node'`, so the
// screen state machine cannot run here; the wiring is checked on BOUNDED regions of DashboardClient, never a file grep.
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { dashboardSource } from '@/lib/testing/dashboardSources'
import { AdjustPlanDoor, StrengthDoor } from '@/components/shared/PlanDoors'
import { ADJUST_PLAN_TITLE, adjustPlanSubtitle } from '@/components/shared/meDoors'

const src = dashboardSource().replace(/\/\/.*$/gm, '')
const region = (start: string, len = 400) => { const i = src.indexOf(start); return i < 0 ? '' : src.slice(i, i + len) }

describe('PLAN-DOORS-01 — Back and Close return to the origin', () => {
  it('Strength opened from the Adjust screen is the "modify" origin, and leaving it reopens Adjust', () => {
    expect(region("strengthDoor={strengthDoorAvailable ? {", 300)).toContain("openStrengthSetup('modify')")
    const leave = region('const leaveStrengthSetup = () => {', 200)
    expect(leave).toMatch(/strengthSetupOrigin === 'modify'\) \{ setScreen\('plan'\); setModifyOpen\(true\) \}/)
  })
  it('both exits from the strength screen use that one function (no second route back)', () => {
    expect(src).not.toMatch(/setScreen\(strengthSetupOrigin\)\s*\}\}/)
    expect(region('<ScreenHeader title={STRENGTH_TITLE}', 120)).toContain('onBack={leaveStrengthSetup}')
  })
  it('the Adjust screen opened from Me closes back to Me', () => {
    expect(region("<MeScreen onOpenModify=", 200)).toContain("setModifyOrigin('me')")
    expect(src).toContain("onClose={() => { clearModify(); if (modifyOrigin === 'me') setScreen('me') }}")
  })
})

describe('PLAN-DOORS-01 — the doors render their glyph and words', () => {
  it('the run-plan door carries the glyph box, the title and the strength-aware subtitle', () => {
    const html = renderToStaticMarkup(createElement(AdjustPlanDoor, { onOpen: () => {}, strengthAvailable: true }))
    expect(html).toContain('<svg')
    expect(html).toContain(ADJUST_PLAN_TITLE)
    expect(html).toContain(adjustPlanSubtitle(true))
    expect(adjustPlanSubtitle(false)).not.toMatch(/strength/)
  })
  it('the strength door carries its glyph too', () => {
    expect(renderToStaticMarkup(createElement(StrengthDoor, { onOpen: () => {}, subtitle: 'x' }))).toContain('<svg')
  })
})
