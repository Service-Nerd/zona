import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import type { Plan } from '@/types/plan'
import harnessPlanJson from '@/components/dashboard/__fixtures__/harnessPlan.json'

/**
 * 🔴 SESSION-SLOTS-01 Phase 3 (Design Board, 2026-10-17) — a double on the Plan week.
 * Harness week 2 holds easy runs on Mon and Wed. Moving Mon onto Wed with a slot is a double
 * (§126): Wed renders TWO rows, AM then PM, the slot leading each metric line. The same move
 * WITHOUT a slot is today's swap, so the control proves the check can fail.
 */
;(globalThis as { React?: unknown }).React = React
const plan = harnessPlanJson as unknown as Plan
afterEach(() => { vi.useRealTimers() })

async function render(allOverrides: unknown[]) {
  vi.useFakeTimers(); vi.setSystemTime(new Date(plan.weeks[1].date + 'T12:00:00'))
  const { default: PlanCalendar } = await import('@/components/training/PlanCalendar')
  return renderToStaticMarkup(React.createElement(PlanCalendar, {
    weeks: plan.weeks, allOverrides, allCompletions: {}, onOverrideChange: () => {}, onSessionTap: () => {},
  } as never))
}

describe('PlanCalendar — a same-day double', () => {
  it('a slotted move renders two rows on one day, AM then PM', async () => {
    const html = await render([{ week_n: 2, original_day: 'mon', new_day: 'wed', new_slot: 'pm' }])
    expect(html.match(/data-slot="am"/g) ?? []).toHaveLength(1)
    expect(html.match(/data-slot="pm"/g) ?? []).toHaveLength(1)
    expect(html.indexOf('data-slot="am"')).toBeLessThan(html.indexOf('data-slot="pm"'))
  })
  it('🔴 control: the same move without a slot is a swap, and no row carries a slot', async () => {
    const html = await render([{ week_n: 2, original_day: 'mon', new_day: 'wed' }])
    expect(html).not.toContain('data-slot=')
  })
  it('🔴 a race-week double is refused by the owner, so Plan never draws one', async () => {
    // Constructed: the fixture's race week has one easy run, so add a second and pin the clock there.
    const ri = plan.weeks.findIndex(w => (w as { type?: string }).type === 'race')
    const rw = plan.weeks[ri]
    const weeks = plan.weeks.map((w, i) => i === ri ? { ...w, sessions: { ...w.sessions, fri: { ...w.sessions.mon, label: 'Shakeout' } } } : w)
    const go = async (type: string) => {
      vi.useFakeTimers(); vi.setSystemTime(new Date(rw.date + 'T12:00:00'))
      const { default: PlanCalendar } = await import('@/components/training/PlanCalendar')
      return renderToStaticMarkup(React.createElement(PlanCalendar, {
        weeks: weeks.map((w, i) => i === ri ? { ...w, type, badge: type } : w),
        allOverrides: [{ week_n: rw.n, original_day: 'fri', new_day: 'mon', new_slot: 'pm' }],
        allCompletions: {}, onOverrideChange: () => {}, onSessionTap: () => {},
      } as never))
    }
    expect(await go('race')).not.toContain('data-slot=')
    expect(await go('normal')).toContain('data-slot="pm"')   // control: the same move outside race week doubles
  })
})

describe('PlanCalendar — the move flow writes a double only from "Do both"', () => {
  const src = readFileSync('components/training/PlanCalendar.tsx', 'utf8')
  it('"Do both" is the secondary beside the swap, and it moves with the PM slot', () => {
    expect(src).toMatch(/pendingMove\.canBoth && pendingMove\.isSwap && \(\s*<Button variant="secondary"/)
    expect(src).toMatch(/onMove\(weekNum, pendingMove\.sourceOriginal, pendingMove\.targetKey, pendingMove\.sourceKey, 'pm'\)/)
  })
  it('target eligibility comes from moveChoices, never a hand-rolled occupancy test', () => {
    const body = src.slice(src.indexOf('function choicesFor('), src.indexOf('function handleMoveIconTap('))
    expect(body).toMatch(/moveChoices\(src, occupied, week, sourceList\.length >= 2\)/)
  })
  it('both writes in a move AND a swap are checked: a failed save reverts and says so', () => {
    const move = src.slice(src.indexOf('async function handleMove('), src.indexOf('async function handleSwap('))
    const swap = src.slice(src.indexOf('async function handleSwap('), src.indexOf('return (', src.indexOf('async function handleSwap(')))
    for (const body of [move, swap]) {
      expect(body.match(/\.error\) \{ onOverrideChange\(before\); setMoveError\(MOVE_FAILED\); return \}/g) ?? []).toHaveLength(2)
    }
    expect(src).toMatch(/\{moveError && <InlineError>\{moveError\}<\/InlineError>\}/)
  })
})
