// SESSION-DIST-UNITS-01 — a distance is never a raw number plus a unit suffix
// (reported by a real user, 2026-09-27).
//
// 🔴 WHAT HE SAW. His post-run card read **"Run (Runna) · 11.4mi"**. He had run
// 7.1 miles. The activity is 11.44 **km** — the code printed the KILOMETRE
// value and appended "mi":
//
//     `${displayActivity.km.toFixed(1)}${preferredUnits === 'mi' ? 'mi' : 'km'}`
//
// 🔴 AND THE REAL COST WAS NOT THE NUMBER. Kit's read directly beneath it said
// *"cutting the run 0.4 miles short"*, which was **correct** — prescribed 12 km
// (7.46 mi), ran 11.44 km (7.11 mi), short by 0.35. The AI prompt path converts
// properly. So one unconverted display string made an accurate coaching read
// look broken to the person it was written for. **A wrong number next to a
// right one discredits the right one.**
//
// ⚠️ IT WAS FIVE SITES, NOT ONE — the post-run card, the session screen's
// auto-match subline, the manual log's "Planned" card, Today's missing-RPE
// nudges, and the week voice. Every one wrong for every miles user, and
// **2 of 19 production users are on miles**, so it was invisible here.
//
// `lib/format.ts` is the SOLE owner of every distance string (ADR-015 /
// INV-FMT-001) and it converts: `formatDistance(11.44, 'mi') === '7mi'`.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { formatDistance } from './format'

const ROOT = path.resolve(__dirname, '..')
const blank = (m: string) => m.replace(/[^\n]/g, '')
const strip = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
  .replace(/^[ \t]*\/\/.*$/gm, '')

/**
 * A `${…km-ish…}` interpolation followed by a unit suffix inside one template.
 * Deliberately narrow: it wants a KM-NAMED value, because that is what makes
 * the suffix a lie. A value already in the reader's units is fine.
 */
const RAW_SUFFIX =
  /`[^`]*\$\{[^}]*(?:[Kk]m|distKm|trackedKm)[^}]*\}\s*(?:\$\{[^}]*(?:preferredUnits|units)[^}]*\}|(?:mi|km)\b)/g

/**
 * ⚠️ EXCLUDED BY NAME, WITH THE REASON — not silently, and not "fixed" either.
 *
 * `QuitTab`'s `a ${raceDistanceKm}km race` would read "a 21.1km race" to a miles
 * user. It is left alone because **the smoke tracker is retired** — CLAUDE.md:
 * *"Smoke tracker — Removed from all UI surfaces"* — and the component takes no
 * `preferredUnits` at all. Plumbing a units prop into dead code to satisfy a
 * gate is waste, and deleting the component is `SMOKE-PLUMBING-01`'s job, not
 * this defect's.
 *
 * 🔴 If the quit tracker is ever revived, this exclusion is a bug waiting.
 */
const EXCLUDED = [
  { match: 'raceDistanceKm}km', why: 'QuitTab — retired surface, no units prop (SMOKE-PLUMBING-01)' },
]

export function findRawSuffixes(src: string): string[] {
  return Array.from(strip(src).matchAll(RAW_SUFFIX))
    .map(m => m[0].replace(/\s+/g, ' ').slice(0, 120))
    .filter(hit => !EXCLUDED.some(e => hit.includes(e.match)))
}

/**
 * ⚠️ THE AUTHENTICATED SURFACES ONLY, AND THAT IS THE RULE NOT A CONVENIENCE.
 *
 * This gate is about honouring a READER'S unit preference. A marketing page has
 * no reader: `components/marketing/PlanPage.tsx` renders the engine's plan as
 * crawlable HTML for anonymous visitors, where km is the canonical unit and
 * there is no `preferredUnits` to consult. Sweeping it would fire on correct
 * work, and a gate that cries wolf gets switched off — recorded twice here.
 *
 * 🔴 The population is asserted NON-EMPTY below. A scope that quietly shrinks to
 * nothing passes every other arm in this file, which is the exact failure this
 * repo recorded four times in one day.
 */
const ROOTS = ['app/dashboard', 'app/auth', 'components/shared', 'components/training', 'components/ui']

function files(): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    if (!fs.existsSync(path.join(ROOT, d))) return
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel) }
      else if (/\.tsx?$/.test(e.name) && !e.name.includes('.test.')) out.push(rel)
    }
  }
  for (const r of ROOTS) walk(r)
  return out
}

describe('SESSION-DIST-UNITS-01', () => {
  it('🔴 the owner converts — this is the whole reason the bypass was a bug', () => {
    expect(formatDistance(11.44, 'mi')).toBe('7mi')
    expect(formatDistance(11.44, 'km')).toBe('11km')
  })

  it('🔴 the swept population is real — an empty scope passes everything', () => {
    const f = files()
    expect(f.length).toBeGreaterThan(40)
    expect(f, 'the file the user reported must be in scope').toContain('app/dashboard/DashboardClient.tsx')
  })

  it('🔴 no surface prints a km value with a unit suffix', () => {
    const offenders: string[] = []
    for (const rel of files()) {
      for (const hit of findRawSuffixes(fs.readFileSync(path.join(ROOT, rel), 'utf8'))) {
        offenders.push(`${rel}: ${hit}\n    -> a km value with a unit suffix is WRONG for every miles ` +
          `user. Use formatDistance(km, units) — it converts.`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('🔴 fires on the exact line the user reported', () => {
    // Falsified against the incident, not an invented case.
    expect(findRawSuffixes(
      "const d = `${displayActivity.km.toFixed(1)}${preferredUnits === 'mi' ? 'mi' : 'km'}`"
    )).toHaveLength(1)
    expect(findRawSuffixes("`${nudge.distKm.toFixed(1)}${preferredUnits === 'mi' ? 'mi' : 'K'}`")).toHaveLength(1)
    expect(findRawSuffixes("`${trackedKm.toFixed(1)}${units} done`")).toHaveLength(1)
  })

  it('🔴 the named exclusion is exactly ONE line, and it is the retired one', () => {
    // A named-exclusion list is how this gate stays honest; a growing one is how
    // it stops being a gate. Asserted so the next addition is deliberate.
    expect(EXCLUDED).toHaveLength(1)
    expect(findRawSuffixes("const raceCtx = `a ${raceDistanceKm}km race`")).toEqual([])
    // ...but the same shape ANYWHERE ELSE still fires.
    expect(findRawSuffixes("const x = `a ${sessionDistanceKm}km race`")).toHaveLength(1)
  })

  it('does NOT fire on the owner, or on a value already in the reader units', () => {
    expect(findRawSuffixes("`${formatDistance(km, preferredUnits) ?? ''}`")).toEqual([])
    // `distanceStr` is what the runner typed, in their own units — converting
    // it again would be the opposite bug.
    expect(findRawSuffixes("`Manual log · ${distanceStr}${preferredUnits}`")).toEqual([])
  })
})
