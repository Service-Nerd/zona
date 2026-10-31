// COACH-WEEK-FACTS-01 — runs and strength are the foot of Coach's "This week" card, in one treatment (Design Board
// 2026-10-31, option C, founder-approved). They were two cards, two layouts, two formats, and "Sessions" counted runs.
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import WeekFacts from './WeekFacts'

const html = (p: Parameters<typeof WeekFacts>[0]) => renderToStaticMarkup(React.createElement(WeekFacts, p))
const text = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const ON_TRACK = { label: 'on track', color: 'var(--moss-strong)' }

describe('WeekFacts', () => {
  it('🔴 says runs, not sessions, and puts both counts in one treatment', () => {
    const h = html({ runs: { done: 2, planned: 3, verdict: ON_TRACK }, strength: { done: 2, planned: 2, next: null } })
    expect(text(h)).toBe('2 of 3 runs on track 2 of 2 strength')
    expect(h).not.toMatch(/Sessions/i)
    // Same count style on both halves: the inconsistency the founder found.
    const counts = Array.from(h.matchAll(/<span style="([^"]*)">\d+ of \d+<\/span>/g)).map(m => m[1])
    expect(counts).toHaveLength(2)
    expect(counts[0]).toBe(counts[1])
  })

  it('one planned run reads "run"', () => {
    expect(text(html({ runs: { done: 0, planned: 1, verdict: ON_TRACK }, strength: null }))).toBe('0 of 1 run on track')
  })

  it("carries the strength plan's next step under the line, and nothing when there is none", () => {
    expect(text(html({ runs: null, strength: { done: 1, planned: 2, next: { kind: 'heavier', week: 4 } } }))).toBe('1 of 2 strength Heavier lifts from week 4.')
    expect(html({ runs: null, strength: null })).toBe('')
  })
})

describe('🔴 Coach renders the facts as the card foot, and the long view last', () => {
  const src = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
  const card = src.slice(src.indexOf("label: 'This week',"), src.indexOf('── LOAD RATIO SHEET'))

  it('no separate Sessions row or Strength card survives', () => {
    expect(src).not.toContain("label: 'Sessions'")
    expect(src).not.toContain('STRENGTH_COACH.count')
  })

  it('the facts are inside the This week card and OUTSIDE its load-sheet button', () => {
    expect(card).toContain('<WeekFacts')
    const button = card.slice(card.indexOf('<button onClick={() => setLoadSheetOpen(true)}'), card.indexOf('</button>'))
    expect(button.length).toBeGreaterThan(0)
    expect(button).not.toContain('<WeekFacts')
  })

  it('race times render after the easy run trend', () => {
    const trend = src.indexOf('<TrendCard state="pending"')
    const arc = src.indexOf('<RaceTimesCard')
    expect(trend).toBeGreaterThan(-1)
    expect(arc).toBeGreaterThan(trend)
  })
})
