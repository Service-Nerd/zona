import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildVoiceHeader } from './voiceRules'

// KIT-EXEMPLAR-LEAK-01 — THE PROMPT'S EXAMPLES WERE TEACHING THE MODEL TO BREAK
// TWO HOUSE RULES, AND NO GUARD COULD SEE IT.
//
// A live paid runner on MILES was told "hold the zone today from the first km",
// in a sentence carrying an em dash. Both are banned for runner-facing copy
// (BRAND-EMDASH-APP-01; ADR-015 unit preference). Both reached him anyway.
//
// ── WHY EVERY EXISTING CHECK WAS BLIND ──────────────────────────────────────
// `noEmDashApp.test.ts` scans string literals and JSX text under `components/`
// and `app/dashboard/`, and EXPLICITLY exempts "AI prompt text — model input,
// never rendered". That exemption is correct about what it covers and wrong
// about what it CAUSES: a prompt is not runner-facing, it MANUFACTURES
// runner-facing text. `promptDistanceParity.test.ts` guards the DATA — it was
// built for BUG-KIT-DECIMALS-01 and asserts the numbers match the card. The
// exemplars are neither: they are prose, inside prompt source.
//
// 🔴 MEASURED AT THE TIME: 36 of 42 exemplars demonstrated an em dash, while
// only ONE prompt of four carried the ban — and that one contradicted itself,
// forbidding em dashes on line 386 and showing the model two on line 103.
// A negative instruction loses to a positive demonstration. The runner's note
// was near-verbatim the exemplar, unit and punctuation included.

const DIR = join(__dirname)
const SOURCES = readdirSync(DIR)
  .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))

/** Every few-shot exemplar across every prompt builder, derived from source. */
function exemplars(): { file: string; line: number; text: string }[] {
  const out: { file: string; line: number; text: string }[] = []
  for (const f of SOURCES) {
    readFileSync(join(DIR, f), 'utf8').split('\n').forEach((l, i) => {
      const m = l.match(/Output: "(.*)"/)
      if (m) out.push({ file: f, line: i + 1, text: m[1] })
    })
  }
  return out
}

describe('prompt exemplars teach only what the house rules allow', () => {
  it('finds the exemplars at all — an empty population passes every other arm', () => {
    // The population is DERIVED, not hand-listed. A hand-written file list is
    // how `sheetClose.test.ts` missed four of nine sheets.
    expect(exemplars().length).toBeGreaterThan(30)
    expect(SOURCES.length).toBeGreaterThan(8)
  })

  it('no exemplar demonstrates an em dash', () => {
    const bad = exemplars().filter(e => e.text.includes('—'))
      .map(e => `${e.file}:${e.line} — ${e.text.slice(0, 70)}`)
    expect(bad, 'the model imitates the example, not the rule').toEqual([])
  })

  it('no exemplar hardcodes a distance unit', () => {
    // A static example cannot know the reader's units, so it must not speak one.
    // "from the first km" reached a miles runner verbatim.
    const bad = exemplars().filter(e => /\b\d*\s*k[m]\b|\bmiles?\b/i.test(e.text))
      .map(e => `${e.file}:${e.line} — ${e.text.slice(0, 70)}`)
    expect(bad, 'make the exemplar unit-neutral; the DATA is formatted elsewhere').toEqual([])
  })
})

describe('buildVoiceHeader carries both rules, for every surface', () => {
  it('bans the em dash', () => {
    expect(buildVoiceHeader({ role: 'testing' })).toMatch(/Never use an em dash/)
  })

  it('names the reader’s actual unit, and only that one', () => {
    const mi = buildVoiceHeader({ role: 'testing', units: 'mi' })
    expect(mi).toMatch(/MILES/)
    expect(mi).not.toMatch(/KILOMETRES/)
    const km = buildVoiceHeader({ role: 'testing', units: 'km' })
    expect(km).toMatch(/KILOMETRES/)
    expect(km).not.toMatch(/MILES/)
  })

  it('defaults to km rather than throwing, so an un-migrated caller still gets a rule', () => {
    expect(buildVoiceHeader({ role: 'testing' })).toMatch(/KILOMETRES/)
  })
})
