import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { stripTsComments } from '@/lib/ops/stripTsComments'

/**
 * SITE-FRAME-TAXONOMY-01 (Design Board 2026-11-16) — 🔴 **DON'T SHIP, closed as measured.** This
 * gate exists because the ruling rests on FACTS ABOUT OWNERSHIP, and a fact in prose is one the
 * next sitting re-derives. The register already records paying for that twice in one day.
 *
 * 📐 **THE FILING SAID "six ways to frame a product visual on one site" AND COUNTED EXPORTED
 * COMPONENT NAMES.** Measured, the six are one chrome, one Today still, one trace geometry and one
 * inset:
 *
 *   · `PhoneShell` (168 lines) is **the one device chrome** — extracted 2026-09-21 *"so there is
 *     ONE phone on this site rather than two"*, **six weeks before this item was filed**.
 *   · `PhoneFrame` (322) is `<PhoneShell activeTab="Today">{TodayStill}</PhoneShell>`. Four lines.
 *     The 322 is `TodayStill`, which it **exports**.
 *   · `TabbedPhone` (265) **imports that same `TodayStill`** — *"TODAY IS IMPORTED, NOT REDRAWN"*.
 *   · `HrTrace` (175) owns the trace geometry; `HeroTrace` (155) animates it. Parent and child.
 *   · `ProductStill` (57) is the **ratified inset**: `design-rulings.md` killed
 *     `--surface-moss-wash` on 2026-09-21 with *"if a card needs emphasis, it is an inset
 *     (`--bg-soft` + one hairline, ProductStill's pattern)"*. **Collapsing it reverses a kill.**
 *
 * 📱 **AND THE TWO DEVICE PRESENTATIONS ARE A MEASURED DECISION, NOT SPRAWL** (Wroblewski):
 * `/charity-runners` renders the STATIC `PhoneFrame` so that page takes no client boundary. Folding
 * it into `TabbedPhone` hands it 8 hooks, and `clientBundleBoundary.test.ts` exists because this
 * site silently went 110 kB → 251 kB twice.
 *
 * ⚠️ **IT STRIPS COMMENTS, AND IT MUST.** Every reference to the device geometry outside
 * `PhoneShell` is in a COMMENT — three of them quoting `NAV_H = 60` while explaining that the
 * website was right and the app had drifted. A scan that reads prose reports four owners where
 * there is one, which is `HOOK-RGBA-COMMENTS-01` exactly.
 */

const DIR = 'components/marketing'
const files = readdirSync(DIR).filter(f => f.endsWith('.tsx'))
const code = new Map(files.map(f => [f, stripTsComments(readFileSync(`${DIR}/${f}`, 'utf8'))]))

const declares = (src: string, n: string) =>
  new RegExp(`export\\s+(?:const|function|type|interface)\\s+${n}\\b`).test(src)

/** Every file whose CODE declares ANY of `names` — i.e. a second owner appearing. */
function declarers(names: readonly string[]): string[] {
  return Array.from(code.entries())
    .filter(([, src]) => names.some(n => declares(src, n)))
    .map(([f]) => f).sort()
}

/**
 * The names of `set` that `owner` does NOT declare. Empty is the claim.
 *
 * 🔴 **A SINGLE-OWNER CLAIM NEEDS BOTH HALVES AND MY FIRST TWO CUTS HAD ONE.** `declarers` alone
 * used `names.some(...)`, so un-exporting `KEEN_PATH` left the trace arm GREEN — `TRACE_VIEWBOX`
 * still matched and one surviving member satisfied `some`. My second cut returned the union of
 * "declares all" and "declares any", which passes identically, and I nearly shipped it on the
 * prediction that it would not. **"One file owns this" means: that file declares EVERY name, and
 * no other file declares ANY of them.** Two assertions, never one.
 */
function missingFrom(owner: string, set: readonly string[]): string[] {
  const src = code.get(owner) ?? ''
  return set.filter(n => !declares(src, n))
}

describe('SITE-FRAME-TAXONOMY-01 — the site has one of each frame, not six', () => {
  it('the population is real and the stripper ran', () => {
    // Vacuity: an empty `files` passes every arm below. 17 .tsx today; the floor is a floor,
    // and the arms that matter below assert an EXACT owner list rather than a count — a threshold
    // cannot see a member missing (MKT-STEP-CEILING-BAND-01, the same day).
    expect(files.length).toBeGreaterThan(12)
    expect(code.get('PhoneShell.tsx')).toContain('export const SCREEN_W')
    // Proof the stripper actually ran on this corpus: PhoneFrame's prose names CONTENT_H and its
    // code does not declare it. If comments were being read, this would hold a declaration.
    expect(readFileSync(`${DIR}/PhoneFrame.tsx`, 'utf8')).toContain('CONTENT_H with')
    expect(code.get('PhoneFrame.tsx')).not.toContain('CONTENT_H with')
  })

  it('🔑 ONE device chrome: the phone geometry is declared in exactly one file', () => {
    // The 2026-09-21 extraction, held. A second phone is how the mockup and the product drift.
    const GEOM = ['SCREEN_W', 'STATUS_H', 'CONTENT_H', 'NAV_H'] as const
    expect(declarers(GEOM), 'a second file declares the phone geometry').toEqual(['PhoneShell.tsx'])
    expect(missingFrom('PhoneShell.tsx', GEOM), 'the chrome stopped owning part of its geometry').toEqual([])
  })

  it('🔑 ONE Today still: declared once, and the tabbed device imports it', () => {
    expect(declarers(['TodayStill']), 'Today is declared in more than one place').toEqual(['PhoneFrame.tsx'])
    expect(code.get('TabbedPhone.tsx'), 'TabbedPhone redrew Today instead of importing it')
      .toMatch(/import\s*\{[^}]*\bTodayStill\b[^}]*\}\s*from/)
  })

  it('🔑 ONE trace geometry: the paths live with the shape, not with the motion', () => {
    // Silvanto's craft point, and it argues AGAINST collapsing: geometry and animation in one file
    // is the drift he objects to elsewhere.
    const TRACE = ['TRACE_VIEWBOX', 'KEEN_PATH', 'HELD_PATH'] as const
    expect(declarers(TRACE), 'a second file declares the trace geometry').toEqual(['HrTrace.tsx'])
    expect(missingFrom('HrTrace.tsx', TRACE), 'the shape stopped owning part of its geometry').toEqual([])
    expect(code.get('HeroTrace.tsx')).toMatch(/import\s*\{[^}]*\bHrTrace\b[^}]*\}\s*from/)
  })

  it('📱 the static presentation stays static — the charity page takes no client boundary', () => {
    // Wroblewski. This is the measured reason there are two device presentations rather than one,
    // so a `'use client'` added here deletes the ruling's own justification.
    expect(code.get('PhoneFrame.tsx'), 'PhoneFrame gained a client boundary').not.toMatch(/['"]use client['"]/)
    expect(code.get('PhoneShell.tsx'), 'the shared chrome gained a client boundary').not.toMatch(/['"]use client['"]/)
  })

  it('⛔ the inset is an INSET — reversing this reverses the --surface-moss-wash kill', () => {
    const still = code.get('ProductStill.tsx')!
    expect(still, 'the inset lost --bg-soft, which IS the pattern').toContain('var(--bg-soft)')
    expect(still, 'a shadow makes it a card; card-in-card with two stacked shadows is banned')
      .not.toMatch(/boxShadow|box-shadow/)
    // A fourth ground is what was killed. Any background other than --bg-soft here is that.
    const grounds = Array.from(still.matchAll(/background:\s*'([^']+)'/g)).map(m => m[1])
    expect(grounds, 'a second ground appeared on the inset').toEqual(['var(--bg-soft)'])
  })
})
