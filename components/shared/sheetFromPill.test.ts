// SHEET-ORIGIN-01, S1 Amendment 1 (Design Board 2026-10-24). The sheet comes out of the nav pill and the pill becomes
// its foot. vitest runs in `node` with no DOM, so the geometry was verified in a browser (375×812, /sheet-preview, real
// Sheet: foot box = real pill box 343×62 at 16,738; panel 343 wide, bottom 764 = pill top + 26) and these arms hold the
// pieces that make it true, each on a bounded region rather than a grep of the file.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { claimSheetFoot, isSheetFootActive, getNavNode } from '@/lib/ui/sheetFoot'
import { SHEET_FROM_PILL, PILL_OVERLAP_PX } from './Sheet'

const ROOT = path.resolve(__dirname, '../..')
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')

describe('the release gate — the app keeps S1 until the founder has seen it', () => {
  it('SHEET_FROM_PILL is off (flip it only on the founder\'s approval, in the same commit as the register row)', () => {
    expect(SHEET_FROM_PILL).toBe(false)
  })
  it('the preview turns it on through the provider, so what he sees is the real component', () => {
    const src = read('app/sheet-preview/page.tsx')
    expect(src).toMatch(/<SheetPresentationProvider value=\{presentation\}>/)
    expect(src).toContain("useState<SheetPresentation>('pill')")
  })
})

describe('the foot store', () => {
  it('counts claims, so overlapping sheets cannot release the foot early, and release is idempotent', () => {
    expect(isSheetFootActive()).toBe(false)
    const a = claimSheetFoot(), b = claimSheetFoot()
    a(); a()
    expect(isSheetFootActive()).toBe(true)
    b()
    expect(isSheetFootActive()).toBe(false)
  })
  it('has no nav node until a nav registers one (no nav → the sheet keeps S1)', () => {
    expect(getNavNode()).toBeNull()
  })
})

describe('Sheet — the pill branch', () => {
  const src = read('components/shared/Sheet.tsx')
  const i = src.indexOf('return fromPill ? (')
  const region = i >= 0 ? src.slice(i, src.indexOf(') : panel })()}', i)) : ''
  it('found the branch (an empty region passes everything below)', () => expect(region.length).toBeGreaterThan(200))
  it('draws the foot INSIDE the sheet\'s own layer, at the real pill\'s measured box', () => {
    // 🔴 The first build raised the nav's z-index instead, and measured in a browser the scrim still dimmed it: the
    // nav's ancestor is position:fixed, a stacking context. The foot must be drawn here.
    expect(region).toContain('className="nav-bar nav-bar--floating nav-bar--sheet-foot"')
    expect(region).toMatch(/left: pill!\.left, top: pill!\.top, width: pill!\.width, height: pill!\.height/)
    expect(region).toContain('aria-hidden="true"')
  })
  it('the clip\'s bottom edge sits PILL_OVERLAP_PX below the pill\'s top, and is the pill\'s width', () => {
    expect(region).toContain('bottom: `calc(100vh - ${pill!.top + PILL_OVERLAP_PX}px)`')
    expect(region).toContain('left: pill!.left, width: pill!.width')
    expect(region).toContain("overflow: 'hidden'")
    expect(PILL_OVERLAP_PX).toBe(26)
  })
  it('the pill branch needs a measured pill; without one the sheet is S1', () => {
    expect(src).toContain("const fromPill = wantsPill && pill != null")
  })
  it('the panel slides (translateY), never scales: round 4\'s line-collapse cannot come back', () => {
    const panel = src.slice(src.indexOf('ref={panelRef}'), src.indexOf('return fromPill ? ('))
    expect(panel).not.toMatch(/scaleY|scale\(/)
    expect(panel).toContain("translateY(100%)")
  })
})

describe('the nav — it is not a nav while it is the foot', () => {
  const css = read('app/globals.css')
  it('tabs fade to NOTHING (not grey) and the foot takes no taps', () => {
    expect(css).toMatch(/\.nav-bar--floating\.nav-bar--sheet-foot \.nav-tab \{\s*opacity: 0;\s*\}/)
    expect(css).toMatch(/\.nav-bar--floating\.nav-bar--sheet-foot \{\s*pointer-events: none;\s*\}/)
  })
  it('the dashboard nav registers itself, goes inert and aria-hidden, and is NOT raised above the scrim', () => {
    const src = read('app/dashboard/DashboardClient.tsx')
    expect(src).toContain('useSheetFootNav(bottomNavNodeRef, sheetFoot)')
    expect(src).toContain('bottomNavNodeRef.current = node')
    const i = src.indexOf("className={`nav-bar nav-bar--floating${navReceded ? ' nav-bar--receded' : ''}")
    const nav = i >= 0 ? src.slice(i, src.indexOf('}}>', i)) : ''
    expect(nav).toContain("${sheetFoot ? ' nav-bar--sheet-foot' : ''}")
    expect(nav).toContain("{...(sheetFoot ? { 'aria-hidden': true } : {})}")
    expect(nav).toContain('zIndex: Z_LAYERS.nav,')
  })
})
