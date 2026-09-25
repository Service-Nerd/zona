/**
 * CONTRACT-INJURY-VALUES-01 — a contract's enumerated values are CHECKED against
 * the validator's own table, never hand-maintained beside it.
 *
 * 🔴 WHY. `docs/contracts/api/generate-plan.md` documented `injury_history` as
 * `('achilles' | 'knee' | 'back' | 'shin_splints' | 'hip_flexor' |
 * 'plantar_fasciitis')[]`. `GeneratePlanScreen` sends `'Achilles'`, `'Knee'`,
 * `'Back'`, `'Hip'`, `'Shin splints'`, `'Plantar fasciitis'` — so **three of the
 * six documented values could never arrive and the other three were the wrong
 * case.** The contract described an API no client calls. It was the FOURTH
 * surface of the same root (after the invariant predicate, the parity grid and
 * the blocked-day cast) and the only one no test could have caught, because
 * **nothing reads a contract** — which is exactly how it rotted.
 *
 * The same document also declared `motivation_type` and `training_style`
 * "ignored if sent" while both were validated, persisted, and — for
 * `training_style` — interpolated into the AI enrichment prompt.
 *
 * ⚠️ `lib/plan/inputs.ts → INPUT_ENUMS` is the authority, because it is what the
 * request validator actually enforces. Its own header records this class for a
 * different field: two measurement grids passed `'occasionally'` and
 * `'regularly'`, neither of which exists, and every plan generated cleanly.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { INPUT_ENUMS } from './inputs'

const CONTRACT = 'docs/contracts/api/generate-plan.md'
const SRC = readFileSync(CONTRACT, 'utf8')

/**
 * The union the contract documents for `field`, or null if it documents none.
 *
 * ⚠️ THE COMMENT IS STRIPPED FIRST, and that is not fussiness — the first cut
 * read the whole line and failed on `preferred_long_run_day?: 'sat' | 'sun'
 * // ... default 'sun'`, harvesting the comment's `'sun'` as a third value. A
 * gate whose first red is its own parser teaches everyone to distrust it.
 */
function documentedUnion(field: string): string[] | null {
  const line = SRC.split('\n').find(l => new RegExp(`^\\s*${field}\\??:`).test(l))
  if (!line) return null
  const declaration = line.split('//')[0]
  const quoted = Array.from(declaration.matchAll(/'([^']+)'/g)).map(m => m[1])
  return quoted.length ? Array.from(new Set(quoted)) : null
}

describe('every enum in generate-plan.md matches what the validator accepts', () => {
  it('documents the contract file it reads, so a rename fails loudly', () => {
    expect(SRC.length, `${CONTRACT} is empty or missing`).toBeGreaterThan(500)
  })

  // Fields the contract deliberately does not enumerate inline are listed with
  // the reason, so an omission is a decision rather than an oversight.
  const NOT_INLINE: Record<string, string> = {
    fitness_intensity_level: 'engine-derived, never a request field',
    max_hr_source: 'documented in the profile section, not the request block',
  }

  for (const [field, allowed] of Object.entries(INPUT_ENUMS)) {
    it(`${field}`, () => {
      const documented = documentedUnion(field)
      if (documented === null) {
        expect(NOT_INLINE[field],
          `${CONTRACT} documents no values for '${field}', and it is not in NOT_INLINE. `
          + `The validator accepts: ${allowed.join(' | ')}`,
        ).toBeTruthy()
        return
      }
      expect(documented.slice().sort(),
        `${CONTRACT} and lib/plan/inputs.ts disagree on '${field}'.\n`
        + `  contract : ${documented.join(' | ')}\n`
        + `  validator: ${allowed.join(' | ')}`,
      ).toEqual(allowed.slice().sort())
    })
  }
})

describe('injury_history is documented as the free-form list it is', () => {
  // ⚠️ It is deliberately NOT in INPUT_ENUMS — the engine keyword-matches, so
  // there is no closed set. A union here would reject the wizard's own strings.
  it('is absent from the validator table, by design', () => {
    expect(INPUT_ENUMS).not.toHaveProperty('injury_history')
  })

  it('the contract no longer types it as a closed snake_case union', () => {
    const line = SRC.split('\n').find(l => /^\s*injury_history\??:/.test(l)) ?? ''
    expect(line, 'a closed union here describes an API no client calls').not.toMatch(/'[a-z_]+'\s*\|/)
    expect(line).toContain('string[]')
  })

  it("names the WIZARD's own labels, so the next client sends values that match", () => {
    const block = SRC.slice(SRC.indexOf('injury_history'), SRC.indexOf('injury_history') + 900)
    for (const label of ['Achilles', 'Knee', 'Back', 'Hip', 'Shin splints', 'Plantar fasciitis']) {
      expect(block, `the contract does not name the wizard's '${label}'`).toContain(`'${label}'`)
    }
  })
})
