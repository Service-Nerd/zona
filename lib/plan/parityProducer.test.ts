import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * PARITY-STAGED-BLIND-01 (2026-11-10) — THE PARITY GRID ASKS ONE QUESTION, THROUGH ONE
 * PRODUCER, AND THE QUESTION IS *WHAT THE RUNNER RECEIVES*.
 *
 * `scripts/verify-parity.ts` had SIX row-emitting blocks and TWO producers: five called
 * `generateRulePlan` and one (`LOWVOL_EXTRA`) called `runEngine`. That is two different
 * questions in one file — *what does the engine GENERATE* against *what does the runner
 * RECEIVE* — and it is the parallel-semantics failure this repo has paid for in
 * `TIER-OWNER-01`, `DELOAD-OWNER-01` and `SESSION-KM-01/02`.
 *
 * 📐 WHY IT MATTERED, MEASURED 2026-11-10. `generateRulePlan` THROWS on a designed refusal,
 * so a refused row stored the exception message, TRUNCATED TO 140 CHARACTERS. **1,648 of
 * 6,210 rows (26.5%) were refusals.** Under `runEngine` those rows are
 * `kind: 'refusal'` with the whole body — the `error` string (211 chars on the marathon
 * days-warning case, so 71 were being dropped), `reason`, three `alternatives` and four
 * numeric fields — and **46 of them are not refusals at all**: they are `base_build`
 * staged plans (ultras at 15 km/week), which is what the runner actually gets.
 *
 * ✅ FALSIFIED, AND THE DISCRIMINATING MUTATION WAS THE THIRD ONE TRIED.
 * `BASE_BUILD_ONRAMP_MIN_START_KM` 6 → 7 and `BASE_BUILD_ONRAMP_DELOAD_FREQUENCY` 4 → 5 both
 * moved exactly the same rows under both producers (60 and 69) — *a falsification aimed at the
 * wrong population*, because `LOWVOL_EXTRA` already covered them.
 * `MAX_WEEKLY_VOLUME_INCREASE_PCT` 10 → 15: **old producer 3,990 rows, new producer 4,012 —
 * 22 rows (16 × 50 km, 6 × 100 km, all at 15 km/week) that the old grid could not see.**
 * ⚠️ And the honest nuance: the old grid caught **24** refused rows on that mutation, because
 * their refusal MESSAGE quotes the volume it recommends. It was partly sighted on refusals,
 * never fully blind — the 22 are the rows whose staged plan moved while their message did not.
 *
 * ⚠️ THIS TEST READS SOURCE, SO IT STRIPS COMMENTS FIRST. The docblock above names
 * `generateRulePlan` six times, and a guard that greps the whole file would fail on the
 * explanation of why it exists — `HOOK-RGBA-COMMENTS-01` exactly.
 */

// Resolved from THIS file, never from `process.cwd()`. A cwd-relative read turns all six
// arms into one collection error the moment vitest is invoked from anywhere but the repo
// root, and a guard that disappears is worse than one that fails (`/code-review`, 2026-11-10).
const PATH = resolve(__dirname, '..', '..', 'scripts', 'verify-parity.ts')
const RAW = readFileSync(PATH, 'utf8')

/**
 * Blank comment text while keeping code intact.
 *
 * ⚠️ IT TRACKS STRING STATE, AND THE FIRST CUT DID NOT. A `//` is only a comment opener
 * OUTSIDE a string literal: `(?<!:)//` handles `https://` and then fails on the very next
 * slash in `"https://x//y"`. That is the sibling of `HOOK-RGBA-COMMENTS-01` — *a hex inside a
 * STRING is code, not prose* — and it was caught by this file's own both-directions arm
 * rather than by review. Quote state is tracked PER LINE, because a line comment cannot span
 * lines (the same reasoning the colour guard settled on).
 */
export const stripComments = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => {
      const t = line.trimStart()
      if (t.startsWith('//') || t.startsWith('*')) return ''
      let quote: string | null = null
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '\\') { i++; continue }
        if (quote) { if (ch === quote) quote = null; continue }
        if (ch === '\'' || ch === '"' || ch === '`') { quote = ch; continue }
        if (ch === '/' && line[i + 1] === '/') return line.slice(0, i)
      }
      return line
    })
    .join('\n')

const CODE = stripComments(RAW)

describe('verify-parity.ts has exactly one producer, and it is runEngine', () => {
  it('strips comment text but keeps code (the guard that would fail on its own docblock)', () => {
    // Both directions, because a stripper that blanks everything passes arm 2 for free.
    expect(stripComments('// const plan = generateRulePlan(x)')).not.toContain('generateRulePlan')
    expect(stripComments('const u = "https://x//y"')).toContain('https://x//y')
    expect(stripComments('const s = "a // b"; generateRulePlan(1)')).toContain('generateRulePlan(1)')
    expect(stripComments('const s = \'a // b\' // generateRulePlan')).not.toContain('generateRulePlan')
    expect(stripComments('emit(key, input, tier, PLAN_START) // generateRulePlan')).toContain('emit(key, input, tier, PLAN_START)')
    expect(stripComments('emit(key, input, tier, PLAN_START) // generateRulePlan')).not.toContain('generateRulePlan')
    expect(stripComments('/* generateRulePlan */ const a = 1')).toContain('const a = 1')
  })

  it('calls generateRulePlan nowhere in code', () => {
    expect(CODE).not.toContain('generateRulePlan')
  })

  it('calls runEngine from exactly one place', () => {
    expect((CODE.match(/runEngine\(/g) ?? []).length).toBe(1)
  })

  it('emits every row through the single `emit` owner', () => {
    // ⚠️ THE SIX BLOCKS, NAMED FROM THE FILE AND NOT FROM MEMORY: the main cartesian,
    // HSR_EXTRA, INJURY_EXTRA, LOWVOL_EXTRA, BENCHMARK_EXTRA and the DST block. The first
    // cut of this comment named a `GOALS_EXTRA` that does not exist and omitted
    // INJURY_EXTRA, which is one of the six (`/code-review`, 2026-11-10) — the count was
    // right and the explanation was not, which is the harder of the two to notice.
    // A new block that writes its own producer fails the two arms above; one that forgets
    // `emit` fails this count.
    expect((CODE.match(/\bemit\(key,/g) ?? []).length).toBe(6)
  })

  it('pins `today` to the block\'s planStart inside emit, never the wall clock', () => {
    // `runEngine` defaults `today` to `new Date()`. 36 low-volume rows carry
    // `meta.uncovered_runway_weeks` derived from it, so an unpinned clock turns two probes
    // either side of midnight into false CHANGED rows.
    expect(CODE).toMatch(/runEngine\(\{[^}]*planStart,\s*today:\s*planStart/)
    expect(CODE).not.toMatch(/today:\s*new Date\(\)/)
  })

  it('pushes a row on the engine THROWING, so a crash is comparable rather than fatal', () => {
    // `runEngine` throws only on a genuine fault. Letting it escape would abort the probe
    // and the orchestrator would compare two partial row sets.
    expect(CODE).toMatch(/catch[\s\S]{0,200}THREW/)
  })
})
