import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'

/**
 * The catalogue documentation must list what the engine actually ships.
 *
 * `docs/canonical/session-catalogue.md` described the retired 14-row 2026-04-25
 * DB seed for four months. `goal_pace_sharpener` and `hm_pace_long_run` were
 * never added; `tempo_continuous`'s taper eligibility (CD-2) never reached it;
 * and the CD-15/CD-18 rows landed in code first. SC-00 corrected the document's
 * *authority line* but not its *contents* — the same divergence one layer down,
 * which is precisely how the original two-catalogue problem survived.
 *
 * §34's rule is "declared AND exercised". A canonical document that nothing
 * checks is a declaration nobody is obliged to honour — the failure mode this
 * entire wave exists to close. So the doc is now exercised.
 *
 * Deliberately narrow: it asserts every shipped row is DOCUMENTED and nothing
 * is documented that no longer ships. It does not diff prose, phases or
 * structure — that would fail on formatting and get deleted. Row identity is
 * the thing that silently drifted.
 */

const DOC = join(process.cwd(), 'docs/canonical/session-catalogue.md')

describe('catalogue doc ↔ code', () => {
  const doc = readFileSync(DOC, 'utf8')

  it('documents every session the engine can prescribe', () => {
    const missing = V1_SESSION_CATALOGUE
      .filter(r => !doc.includes(`\`${r.id}\``))
      .map(r => r.id)
    expect(missing, `Rows in code but absent from session-catalogue.md: ${missing.join(', ')}`)
      .toEqual([])
  })

  it('documents no session that no longer exists', () => {
    // Ids appear in the table as `backticked_snake_case`. Collect them and check
    // each resolves to a real row — catches a row renamed or removed in code
    // while the doc keeps advertising it.
    const documented = Array.from(doc.matchAll(/^\|\s*\d+\s*\|\s*`([a-z0-9_]+)`/gm)).map(m => m[1])
    expect(documented.length).toBeGreaterThan(0)   // guard: the table still parses

    const known = new Set(V1_SESSION_CATALOGUE.map(r => r.id))
    const stale = documented.filter(id => !known.has(id))
    expect(stale, `Documented in session-catalogue.md but not in code: ${stale.join(', ')}`)
      .toEqual([])
  })

  it('states the correct row count', () => {
    // The heading carried "14 sessions" long after the count changed. A stale
    // count is the cheapest possible tell that the table was not regenerated.
    expect(doc).toContain(`## V1 catalogue (${V1_SESSION_CATALOGUE.length} sessions)`)
  })
})
