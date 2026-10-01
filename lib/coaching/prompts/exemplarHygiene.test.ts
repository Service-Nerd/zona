import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
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
    expect(buildVoiceHeader({ role: 'testing', units: 'km' })).toMatch(/Never use an em dash/)
  })

  it('names the reader’s actual unit, and only that one', () => {
    const mi = buildVoiceHeader({ role: 'testing', units: 'mi' })
    expect(mi).toMatch(/MILES/)
    expect(mi).not.toMatch(/KILOMETRES/)
    const km = buildVoiceHeader({ role: 'testing', units: 'km' })
    expect(km).toMatch(/KILOMETRES/)
    expect(km).not.toMatch(/MILES/)
  })

  // ⚠️ THE ARM THAT USED TO LIVE HERE BLESSED A DEFAULT, AND THE DEFAULT WAS THE BUG.
  // It read "defaults to km rather than throwing, so an un-migrated caller still gets
  // a rule" — true, and also how a tenth surface quietly tells a miles runner
  // KILOMETRES. `post-run-reframe.md` already carried the rule from UNITS-DURATION-01:
  // required, not defaulted, because a value restated in the wrong unit is SILENTLY
  // wrong. `units` is now required, so the compiler is the check — and making it so
  // immediately surfaced a call site my own grep had missed (`lib/plan/freeIntro.ts`,
  // which already HELD units and simply never passed them).
  it('every call site supplies units — derived from source, never a hand-written list', () => {
    const offenders: string[] = []
    const walk = (d: string) => {
      for (const e of readdirSync(d)) {
        if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
        const f = join(d, e)
        if (statSync(f).isDirectory()) { walk(f); continue }
        if (!/\.tsx?$/.test(f) || /\.test\.tsx?$/.test(f)) continue
        const src = readFileSync(f, 'utf8')
        let i = src.indexOf('buildVoiceHeader({')
        while (i !== -1) {
          const end = src.indexOf('})', i)
          if (end > i && !src.slice(i, end).includes('units')) {
            offenders.push(`${f.split('/zona/')[1] ?? f} @${i}`)
          }
          i = src.indexOf('buildVoiceHeader({', i + 1)
        }
      }
    }
    for (const r of ['lib', 'app', 'components']) walk(join(__dirname, '..', '..', '..', r))
    expect(offenders, 'a voice header with no units speaks the wrong one').toEqual([])
  })

  it('finds the call sites at all — an empty population passes the arm above', () => {
    // The grep that missed freeIntro was scoped to one directory. This walks three.
    let n = 0
    const walk = (d: string) => {
      for (const e of readdirSync(d)) {
        if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
        const f = join(d, e)
        if (statSync(f).isDirectory()) { walk(f); continue }
        if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)) {
          n += readFileSync(f, 'utf8').split('buildVoiceHeader({').length - 1
        }
      }
    }
    for (const r of ['lib', 'app', 'components']) walk(join(__dirname, '..', '..', '..', r))
    expect(n, 'the walk found no call sites, so the arm above proves nothing')
      .toBeGreaterThanOrEqual(10)
  })
})
