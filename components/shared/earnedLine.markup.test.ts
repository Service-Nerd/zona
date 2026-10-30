// COACH-SEEN-MOMENTS-01 — the earned line's encoding and its placements (Design Board 2026-10-30, ui-patterns § Earned line).
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import EarnedLine, { EARNED_DOT_PX } from './EarnedLine'
import { EasyShareHeader } from './EasyShare'
import TrendCard from './TrendCard'

const html = (el: React.ReactElement) => renderToStaticMarkup(el)

describe('EarnedLine', () => {
  const out = html(React.createElement(EarnedLine, { text: 'Your easiest week in eight weeks.' }))
  it('🔴 the sentence is ink; moss lives only on the dot (6t-g)', () => {
    expect(out).toMatch(/font-size:15px;font-weight:600;color:var\(--ink\)/)
    expect((out.match(/var\(--moss\)/g) ?? []).length).toBe(1)
    expect(out).toMatch(new RegExp(`aria-hidden="true" style="width:${EARNED_DOT_PX}px;height:${EARNED_DOT_PX}px;border-radius:50%;background:var\\(--moss\\)`))
  })
  it('no motion and no AI mark', () => {
    expect(out).not.toMatch(/animation|transition|data-ai-mark|AIMark/i)
  })
})

describe('placements', () => {
  it('EasyShareHeader: the line shows with a span, and an ordinary week shows nothing', () => {
    expect(html(React.createElement(EasyShareHeader, { share: 62, runs: 3, easiestSpan: 8 }))).toContain('Your easiest week in eight weeks.')
    const plain = html(React.createElement(EasyShareHeader, { share: 62, runs: 3, easiestSpan: null }))
    expect(plain).not.toContain('data-earned-line')
  })
  const live = { state: 'live' as const, earlierMonth: 'Aug', earlierHr: 146, nowHr: 141, cohortSize: 8, windowMonths: 6, glossless: true }
  it('TrendCard live: the moment is drawn only when passed', () => {
    expect(html(React.createElement(TrendCard, { ...live, moment: 'Easy is costing you less: 146 → 141 bpm since August.' })))
      .toContain('data-earned-line')
    expect(html(React.createElement(TrendCard, live))).not.toContain('data-earned-line')
  })
  it('Coach wires both from the rules, not a literal', () => {
    const shell = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    expect(shell).toContain('easiestSpan={easiestWeekSpan(easyShareWeeks.slice(-EASY_SHARE_BARS))}')
    expect(shell).toContain("moment:       data.easyCostMoment === true ? easyCostSentence(")
    expect(shell).toContain('moment={easyTrendData.moment}')
    const route = readFileSync('app/api/coaching/trend/route.ts', 'utf8')
    expect(route).toContain('const easyCostMoment = easyCostFellThisWeek(trend, trendWeekAgo)')
    expect(route).toContain('history.filter(r => r.startDate < weekAgoCutoff)')
  })
})
