// METRIC-TILE-01 — a CSS variable cannot take a hex alpha suffix (2026-09-27).
//
// 🔴 THE DEFECT, AND IT HAD NEVER ONCE RENDERED.
// `SESSION_COLORS` values are CSS VARIABLES — `'var(--session-long)'`, not hex.
// The session card's distance tile did this:
//
//     background: `${config.color}10`          -> "var(--session-long)10"
//     border: `1px solid ${config.color}30`    -> "1px solid var(--session-long)30"
//
// Both are strings the browser cannot parse, so it drops them. **The tile was
// designed with a session-tinted fill and a coloured border and had neither, on
// every session, for as long as the code has existed.** The founder reported the
// symptom — *"one side is bigger than the other"*, the pace tile having a real
// hairline and this one nothing — and the cause was invisible by looking,
// because nothing errors: the element renders, just bare.
//
// ⚠️ THE CORRECT IDIOM WAS ALREADY IN THE SAME FILE, TEN TIMES, including FOUR
// LINES ABOVE one of the three broken sites: `color-mix(in srgb, X 18%,
// transparent)`. Two ways to tint a token lived side by side and only one
// worked. That is what makes this worth a gate rather than a fix: nothing
// distinguished them at the call site.
//
// ⚠️ COMMENTS ARE STRIPPED FIRST. The first cut of this scan reported the
// explanatory comment ABOVE the fix as a live offender — the "guard fires on
// prose describing the bug it guards" class, recorded in this repo already.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const blank = (m: string) => m.replace(/[^\n]/g, '')
const strip = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
  .replace(/^[ \t]*\/\/.*$/gm, '')

/** `${anythingColourish}` immediately followed by two hex digits. */
const ALPHA_SUFFIX = /\$\{([A-Za-z_][\w.?[\]'"]*(?:[Cc]olor|colour|[Aa]ccent)[\w.?[\]'"]*)\}([0-9a-fA-F]{2})\b/g

function tsxFiles(): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel) }
      else if (/\.tsx$/.test(e.name) && !e.name.includes('.test.')) out.push(rel)
    }
  }
  walk('app'); walk('components')
  return out
}

export function findAlphaSuffixes(src: string): string[] {
  return Array.from(strip(src).matchAll(ALPHA_SUFFIX)).map(m => m[0])
}

describe('METRIC-TILE-01 — no hex alpha appended to a token', () => {
  it('🔴 nothing appends a hex alpha to an interpolated colour', () => {
    const offenders: string[] = []
    for (const rel of tsxFiles()) {
      for (const hit of findAlphaSuffixes(fs.readFileSync(path.join(ROOT, rel), 'utf8'))) {
        offenders.push(`${rel}: \`${hit}\` — that token is a CSS variable, so this is an ` +
          `unparseable string and paints NOTHING. Use color-mix(in srgb, X N%, transparent).`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('🔴 fires on the three real sites, verbatim', () => {
    // Falsified against the incident, not an invented case.
    expect(findAlphaSuffixes("<div style={{ background: `${config.color}10` }} />")).toHaveLength(1)
    expect(findAlphaSuffixes("border: `1px solid ${config.color}30`")).toHaveLength(1)
    expect(findAlphaSuffixes("background: isActive ? `${tagColor}18` : 'none'")).toHaveLength(1)
  })

  it('🔴 does NOT fire on the prose that explains the defect', () => {
    // The first cut reported the fix's own comment. A gate that fires on its
    // own documentation gets switched off, which this repo records as equal to
    // having no gate.
    expect(findAlphaSuffixes("// so `${config.color}10` produced an invalid string")).toEqual([])
    expect(findAlphaSuffixes("/* background: `${config.color}10` was the bug */")).toEqual([])
  })

  it('does NOT fire on the correct idiom, or on a token used whole', () => {
    expect(findAlphaSuffixes("background: `color-mix(in srgb, ${config.color} 6%, transparent)`")).toEqual([])
    expect(findAlphaSuffixes("borderLeft: `3px solid ${config.color}`")).toEqual([])
    // Concatenation rather than interpolation: also wrong, but not this gate's
    // shape, and claiming it here would overstate what the regex proves.
    expect(findAlphaSuffixes("background: config.color + '30'")).toEqual([])
  })

  // ⚠️ The literal-hex negative case this arm ALSO wanted is absent on purpose:
  // the pre-commit hook blocks a hardcoded hex anywhere under `components/`,
  // including in a test asserting it is ignored. The gate's regex requires a
  // `${...}` interpolation before the digits, so a bare hex cannot match it by
  // construction — asserting that would have tested the regex, not the rule.
})
