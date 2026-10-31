// COACH-KIT-CAUGHT-01 — the receipts card, free Coach and the Upgrade screen (boards 2026-10-31, approved mockup).
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import KitReceipts from './KitReceipts'
import CoachTeaser from '@/components/dashboard/CoachTeaser'
import { BRAND, PRICING } from '@/lib/brand'
import type { KitReceipt } from '@/lib/coaching/kitReceipts'

const text = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, ' ').trim()
const R: KitReceipt[] = [
  { tone: 'drifted', lead: '27 Oct, 9.5km:', text: '43% of it in Zone 3.' },
  { tone: 'held', lead: '23 Oct, 6km:', text: '100% of it in Zones 1–2.' },
]
const plan: any = { weeks: [{ n: 1, date: '2026-10-26', sessions: {} }], meta: {} }
const teaser = (p: Record<string, unknown>) => renderToStaticMarkup(React.createElement(CoachTeaser, { plan, firstName: 'Sam', onUpgrade: () => {}, ...p }))

describe('KitReceipts', () => {
  it('draws nothing with no receipts', () => {
    expect(renderToStaticMarkup(React.createElement(KitReceipts, { receipts: [] }))).toBe('')
  })
  it('🔴 P-01 on the mark only: moss held, amber drifted, words in ink', () => {
    const h = renderToStaticMarkup(React.createElement(KitReceipts, { receipts: R }))
    expect(h).toMatch(/data-receipt="drifted"[^]*?background:var\(--warn\)/)
    expect(h).toMatch(/data-receipt="held"[^]*?background:var\(--moss\)/)
    expect(text(h)).toContain(`What ${BRAND.coachName} caught`)
  })
})

describe('free Coach (CoachTeaser)', () => {
  it('🔴 with receipts: the card, one line on Pro, the price from BRAND, and no second Kit card', () => {
    const h = teaser({ receipts: R })
    const t = text(h)
    expect(t).toContain('27 Oct, 9.5km: 43% of it in Zone 3.')
    expect(t).toContain(`Get ${BRAND.coachName} · ${PRICING.monthly.perWeekDisplay}`)
    expect(h).not.toContain('data-kit-nothing-yet')
    expect((h.match(/data-kit-receipts/g) ?? []).length).toBe(1)
  })
  it('🔴 a paid runner who lands here sees no buy button and is not told Pro is something else', () => {
    const t = text(teaser({ receipts: R, showUpgrade: false }))
    expect(t).not.toContain('Get ')
    expect(t).not.toContain('That part is Pro')
  })
  it('loading shows a skeleton, never a guess', () => {
    const h = teaser({ receipts: null })
    expect(h).toContain('data-receipts-loading')
    expect(h).not.toContain('data-kit-receipts')
  })
  it('🔴 the stale teaser is gone: no locked tiles, no example data, no "Needs Strava"', () => {
    const t = text(teaser({ receipts: R }) + teaser({ receipts: [] }))
    for (const gone of ['Example', 'not your data', 'See your zone discipline score', 'Share your week', 'Load ratio', 'Race projections', '—:——'])
      expect(t).not.toContain(gone)
  })
})

describe('🔴 Upgrade screen: receipts sit above what Pro includes', () => {
  const src = readFileSync('app/dashboard/UpgradeScreen.tsx', 'utf8')
  it('"In your trial" only while a trial runs; an ended trial reads the true window', () => {
    expect(src).toMatch(/title=\{inTrial \? `In your trial/)
    expect(src).not.toMatch(/framing === 'trial-ended' \? `In your trial/)
  })
  it('order', () => {
    const r = src.indexOf('<KitReceipts')
    expect(r).toBeGreaterThan(src.indexOf('{headline}'))
    expect(r).toBeLessThan(src.indexOf('Feature / loss list'))
  })
})
