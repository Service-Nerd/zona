import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * SHEET-CLOSE-OWNER-01 — `Sheet` owns the close and the swipe. No sheet rolls
 * its own.
 *
 * 🔴 WHY. Six sheets hand-rolled THREE different ways out: a bottom sticky
 * full-width "Close", a top-right cross, and on two of them nothing at all
 * besides the scrim. A runner met a different exit from each. Third time in one
 * day a thing every caller needs was left to each caller (`.cta-pill`,
 * `BackButton`, this).
 *
 * 🔴 AND THE PRIMITIVE DREW A DRAG PILL THAT DRAGGED NOTHING. A false affordance
 * shipped inside the shared component, promising a gesture no sheet supported,
 * and every sheet in the app inherited it. Founder, 2026-09-25: *"I want ALL
 * popups we have to be able to swipe down to close them as well as have the
 * cross to close."*
 *
 * ⚠️ The swipe only engages at `scrollTop <= 0`. A sheet scrolled mid-way must
 * SCROLL, not dismiss — otherwise a runner reading a long zone explanation loses
 * it trying to scroll back up. That guard is the reason this is safe on a
 * scrollable panel, and it is asserted here so it cannot be removed as
 * redundant.
 */
const ROOT = path.resolve(__dirname, '../..')
const SHEET = fs.readFileSync(path.join(ROOT, 'components/shared/Sheet.tsx'), 'utf8')

const CONSUMERS = [
  'components/shared/ZoneInfoSheet.tsx',
  'components/shared/ModifyPlanSheet.tsx',
  'components/shared/TrendCard.tsx',
  'components/training/RaceResultSheet.tsx',
]
const blank = (m: string) => m.replace(/[^\n]/g, '')
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
   .replace(/^[ \t]*\/\/.*$/gm, '')

describe('SHEET-CLOSE-OWNER-01', () => {
  it('Sheet renders the close itself', () => {
    expect(SHEET, 'Sheet stopped rendering its own close').toMatch(/<IconButton[\s\S]{0,200}ariaLabel="Close"/)
  })

  it('🔴 the drag pill actually drags', () => {
    // It was decoration for the life of the component.
    expect(SHEET, 'no touch handling — the pill is a false affordance again').toMatch(/onTouchStart=\{onTouchStart\}/)
    expect(SHEET).toMatch(/onTouchMove=\{onTouchMove\}/)
    expect(SHEET).toMatch(/onTouchEnd=\{onTouchEnd\}/)
  })

  it('🔴 the swipe yields to scrolling', () => {
    expect(SHEET, 'the scrollTop guard is gone — a scrolled sheet will dismiss ' +
      'instead of scrolling').toMatch(/scrollTop\s*>\s*0/)
  })

  it('the panel tracks the finger and springs back', () => {
    expect(SHEET).toMatch(/translateY\(\$\{dragY\}px\)/)
    // No transition WHILE dragging, or the panel lags the finger.
    expect(SHEET).toMatch(/dragY\s*>\s*0\s*\?\s*'none'/)
  })

  it('🔴 no sheet hand-rolls its own close', () => {
    const offenders: string[] = []
    for (const f of CONSUMERS) {
      const p = path.join(ROOT, f)
      if (!fs.existsSync(p)) continue
      const src = strip(fs.readFileSync(p, 'utf8'))
      if (/ariaLabel="Close"/.test(src)) offenders.push(`${f} renders its own close cross`)
      if (/>\s*Close\s*</.test(src)) offenders.push(`${f} renders its own "Close" button`)
    }
    expect(offenders, `Sheet owns the close:\n${offenders.join('\n')}`).toEqual([])
  })
})
