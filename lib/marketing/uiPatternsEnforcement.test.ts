// UI-PATTERNS-ENFORCEMENT-01 — "SHIP THE MEASUREMENT, NOT THE GATES" (Design Board).
//
// 🔴 THE OPEN HALF, ANSWERED 2026-10-05. The item had the counts (35 sections, N
// naming a check) and an unanswered question that was the one that mattered:
// *of the unguarded sections, how many are HONOURED today?* — because that
// separates "unenforced and fine" from "unenforced and already drifted", and only
// the second needs a gate.
//
// 📐 MEASURED, all 14 then-unguarded sections:
//   · 4 ARE GUARDED by a test the section never named
//        § 7 nav selected state -> navActiveState.test.ts
//        Training Zones screen  -> trainingZones.markup.test.ts (4 suites)
//        Dark Ground band       -> sectionSurfaces.test.ts (every page.tsx)
//        Typography Scale       -> typeScale.test.ts, but MARKETING ONLY
//   · 4 HONOURED and unguarded
//        Design Token Reference — 28 tokens listed, 0 missing from globals.css
//        Card Elevation         — `--shadow-card` declared once, used in 36 files
//        SameWeekTwice          — component exists and is rendered
//        FAQ disclosure         — `FaqScreen` exists, rendered on 2 surfaces
//   · 2 PROSE (Core Aesthetic, What Not to Build) — not mechanically checkable
//   · 4 UNMEASURED — the semantic colour pair and three marketing layout sections;
//     "amber means cooked it" is a MEANING, not a value, and 24 files use `--warn`
//   · 🥇 **0 DRIFTED.**
//
// 🥇 THE PROXY COUNTS NAMING, NOT GUARDING, SO THE UNGUARDED FIGURE OVERSTATES THE
// RISK. Four sections were guarded all along and simply did not say so. The fix was
// four lines of documentation, not four new gates — which is exactly what the board
// ruled: ship the measurement.
//
// ⚠️ THE ONE REAL GAP IS NARROWER THAN THE SECTION: `typeScale.test.ts` is
// `describe('marketing type scale')` over a `SURFACES` list of marketing pages. The
// APP's type scale is ungated. That is the finding worth acting on, and it is a
// fraction of "the Typography Scale section is unguarded".
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = () => readFileSync('docs/canonical/ui-patterns.md', 'utf8')
const NAMES_A_CHECK = /\.test\.ts|\.test\.tsx|markup\.test|npm run |pre-commit|audit-docs|invariant|Gated by|Held by|guarded by/i

function sections() {
  const lines = SRC().split('\n')
  const out: { title: string; body: string }[] = []
  let cur: { title: string; body: string[] } | null = null
  for (const l of lines) {
    if (/^## /.test(l)) { if (cur) out.push({ title: cur.title, body: cur.body.join('\n') }); cur = { title: l.replace(/^## /, '').trim(), body: [l] } }
    else if (cur) cur.body.push(l)
  }
  if (cur) out.push({ title: cur.title, body: cur.body.join('\n') })
  return out
}

describe('UI-PATTERNS-ENFORCEMENT-01 — the measurement holds', () => {
  it('the population is real', () => {
    // An empty parse passes every arm below, and this document is the subject.
    expect(sections().length, 'the `##` parse stopped matching — this file would go vacuously green')
      .toBeGreaterThan(25)
  })

  // ⚠️ A FALLING REGISTER, NOT A TARGET. The unguarded count may DROP freely; it
  // may not grow. A gate demanding zero would be deleted rather than satisfied
  // (this repo's own rule), and 2 of the sections are prose that can never carry one.
  it('the unguarded count does not grow', () => {
    const UNGUARDED_BASELINE = 10   // was 14 before the four gates were NAMED
    const n = sections().filter(s => !NAMES_A_CHECK.test(s.body)).length
    expect(n,
      n > UNGUARDED_BASELINE
        ? `a NEW ui-patterns section names no check (${n} vs ${UNGUARDED_BASELINE}). Name its gate, or write one.`
        : `debt PAID: ${n} vs ${UNGUARDED_BASELINE} — lower UNGUARDED_BASELINE and say which section gained a gate.`,
    ).toBe(UNGUARDED_BASELINE)
  })

  // 🔴 THE ARM THAT STOPS THE MEASUREMENT ROTTING. These four sections were found
  // to be guarded by tests they did not name; if the reference is deleted the
  // section silently reads as unguarded again and the next audit re-does this work.
  it('the four sections that were guarded-but-unnamed still name their gate', () => {
    const want: [string, string][] = [
      ["§ 7 Amendment — the bottom nav's selected state", 'navActiveState.test.ts'],
      ['Training Zones screen', 'trainingZones.markup.test.ts'],
      ['Dark Ground', 'sectionSurfaces.test.ts'],
      ['Typography Scale', 'typeScale.test.ts'],
    ]
    const secs = sections()
    const missing = want.filter(([title, test]) => {
      const sec = secs.find(s => s.title.includes(title))
      return !sec || !sec.body.includes(test)
    }).map(([t]) => t)
    expect(missing, 'a section stopped naming the gate that holds it').toEqual([])
  })

  // ⚠️ AND THE HONEST LIMIT, ASSERTED SO IT IS NOT QUOTED AS MORE THAN IT IS.
  it('the guarded/unguarded split is a NAMING proxy, and says so in the item', () => {
    // The split is a regex for a test name in the section body. It cannot tell a
    // guarded rule from a rule whose section merely mentions a test, and it found
    // four false "unguarded" results. Nobody should quote it as audited coverage.
    const marketingOnly = readFileSync('lib/marketing/typeScale.test.ts', 'utf8')
    expect(marketingOnly, 'typeScale.test.ts stopped being marketing-scoped — re-measure the Typography Scale gap')
      .toMatch(/describe\('marketing type scale'/)
  })
})
