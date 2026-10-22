import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 🔴 ACCENT-TEXT-CONTRAST-01 (Design Board 2026-10-22, 6t-g, amended at build). A session hue, `--moss` or `--coral`
 * is never SMALL TEXT: on their own 15% header tint, 7 of 9 hues measured below 4.5:1 (amber 2.80, coral 2.86).
 * Small moss text takes `--moss-strong` (its ratified text shade: 5.48 on --card, 4.52 on --bg-soft); small session-hue
 * text takes `--ink-2`. The hue stays on graphics.
 *
 * Population: every `color: 'var(--<hue>)'` under components/ and app/. Each surviving site must be NAMED below with
 * its reason, so a new one fails until someone says why it is not small text. ⚠️ A literal scan: a hue reaching text
 * through a variable is not seen here; the seven known ones were fixed by hand (SessionSteps' SECTION_TEXT holds the
 * main one) and are not re-proven.
 */
const HUE = /color:\s*'var\(--(s-(?:easy|long|quality|inter|race|recov|strength|cross)|session-[a-z-]+|moss|coral)\)'/g
const ALLOWED: Record<string, { count: number; why: string }> = {
  'components/ErrorBoundary.tsx': { count: 1, why: '32px display text (large)' },
  'components/training/PlanCalendar.tsx': { count: 1, why: 'the ⇄ swap glyph, an icon (non-text, 3:1)' },
  'components/dashboard/TodayScreen.tsx': { count: 6, why: 'five 56px hero words (large) and a → glyph' },
  'components/dashboard/PlanAdjustmentsScreen.tsx': { count: 1, why: 'a chevron icon' },
  'components/dashboard/SessionPopupInner.tsx': { count: 1, why: 'a → glyph inside a button' },
  'components/marketing/PhoneFrame.tsx': { count: 1, why: '56px hero word (large)' },
  'app/dashboard/BenchmarkUpdateScreen.tsx': { count: 1, why: '28px figure (large)' },
}

function files(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) { if (!/-preview$/.test(f)) files(p, out) }
    else if (/\.tsx$/.test(f) && !/\.test\./.test(f)) out.push(p)
  }
  return out
}

describe('a session hue is never small text', () => {
  const found: Record<string, number> = {}
  for (const f of [...files('components'), ...files('app')]) {
    const n = (readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').match(HUE) ?? []).length
    if (n) found[f] = n
  }
  it('the scan reaches the codebase (population not empty)', () => {
    expect(Object.keys(found).length).toBeGreaterThan(3)
  })
  it('🔴 every hue-coloured text site is a named exception (large text, a glyph), never small text', () => {
    const unexplained = Object.entries(found).filter(([f, n]) => !ALLOWED[f] || n > ALLOWED[f].count).map(([f, n]) => `${f} (${n})`)
    expect(unexplained, 'small text in a session hue: use --moss-strong (moss) or --ink-2 (session hue)').toEqual([])
  })
  it('the exception list may only shrink: a stale entry fails too', () => {
    const stale = Object.entries(ALLOWED).filter(([f, a]) => (found[f] ?? 0) < a.count).map(([f]) => f)
    expect(stale).toEqual([])
  })
  it('🔴 the step list\'s section text is ink, never the hue', () => {
    const src = readFileSync('components/shared/SessionSteps.tsx', 'utf8')
    expect(src).toMatch(/const SECTION_TEXT = 'var\(--ink-2\)'/)
    expect(src).not.toMatch(/color: (accent|mainAccent)[,\s}]/)
  })
  it('🔴 the session detail\'s tile text is ink; only the large zone label keeps the hue', () => {
    const src = readFileSync('components/dashboard/SessionPopupInner.tsx', 'utf8')
    // The one survivor is the 22px/800 "Zone 3 · tempo" label: large text, every hue >= 3:1 on --card.
    expect((src.match(/color: config\.color\b/g) ?? []).length).toBe(1)
  })
})
