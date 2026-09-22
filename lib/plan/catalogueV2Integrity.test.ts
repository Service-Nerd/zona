import { describe, it, expect } from 'vitest'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { StructureV2Schema, isV2Structure, PACE_ANCHORS } from './sessionStructureV2'

/**
 * Catalogue-level integrity for v2 rows — INV-CAT-V2-NO-LITERAL-PACE and
 * INV-CAT-V2-WELL-FORMED.
 *
 * These belong here rather than in validatePlan(): they are properties of the
 * CATALOGUE, not of a generated plan. A malformed row would otherwise only
 * surface as a silently-skipped structure at generation (resolveMainSet fails
 * soft by design, per ADR-006's posture), which is exactly the class of silent
 * failure this repo keeps finding.
 *
 * Runs in CI via `npm run test`, i.e. the verify gate.
 */

const v2Rows = () => V1_SESSION_CATALOGUE.filter(r => isV2Structure(r.main_set_structure))

// A pace looks like "4:30", "4:30 /km", "4:28–4:39 /km". An anchor never does.
const LOOKS_LIKE_A_PACE = /\d+\s*:\s*\d{2}/

describe('INV-CAT-V2-WELL-FORMED', () => {
  it('every v2 row parses against the schema', () => {
    for (const row of v2Rows()) {
      const r = StructureV2Schema.safeParse(row.main_set_structure)
      expect(r.success, `${row.id}: ${r.success ? '' : JSON.stringify(r.error.issues)}`).toBe(true)
    }
  })

  it('every `mirror` step has a preceding work step in its own block', () => {
    // "Jog back down" mirrors the climb in the SAME rep. A mirror with nothing
    // before it renders as a bare fallback, which is data rot, not a UI concern.
    for (const row of v2Rows()) {
      const parsed = StructureV2Schema.safeParse(row.main_set_structure)
      if (!parsed.success) continue
      // Index loops, not `.entries()` — the tsconfig target rejects array
      // iterators without --downlevelIteration (same family as the documented
      // `[...set]` gotcha in CLAUDE.md).
      for (let bi = 0; bi < parsed.data.blocks.length; bi++) {
        const block = parsed.data.blocks[bi]
        let seenWork = false
        for (let si = 0; si < block.steps.length; si++) {
          const step = block.steps[si]
          if (step.length.kind === 'mirror') {
            expect(seenWork, `${row.id} block ${bi} step ${si}: mirror with no preceding work step`).toBe(true)
          }
          if (step.role === 'work') seenWork = true
        }
      }
    }
  })
})

describe('INV-CAT-V2-NO-LITERAL-PACE', () => {
  it('no v2 row contains a literal pace anywhere', () => {
    // The rule the whole design rests on: a row is shared by every runner, so a
    // pace written into it is wrong for all but one of them. Checked against the
    // serialised row, so it catches a pace smuggled into a `note` or a `label`
    // as well as into a target.
    for (const row of v2Rows()) {
      const serialised = JSON.stringify(row.main_set_structure)
      expect(LOOKS_LIKE_A_PACE.test(serialised),
        `${row.id} contains what looks like a literal pace: ${serialised}`).toBe(false)
    }
  })

  it('every pace target names a known anchor', () => {
    for (const row of v2Rows()) {
      const parsed = StructureV2Schema.safeParse(row.main_set_structure)
      if (!parsed.success) continue
      for (const block of parsed.data.blocks) {
        for (const step of block.steps) {
          if (step.target.kind !== 'pace') continue
          expect(PACE_ANCHORS as readonly string[]).toContain(step.target.anchor)
        }
      }
    }
  })

  it('the guard itself works — a literal pace would be caught', () => {
    // Guards the guard. Without this, the two tests above pass vacuously while
    // there are no v2 rows, which is exactly the SWEEP-VACUOUS-01 failure mode.
    expect(LOOKS_LIKE_A_PACE.test('{"anchor":"4:30 /km"}')).toBe(true)
    expect(LOOKS_LIKE_A_PACE.test('{"anchor":"I"}')).toBe(false)
    // Phase 1 (ADR-019) shipped with this asserting ZERO — the checks were armed
    // but unexercised, and a vacuous pass would have looked identical to a real
    // one. SC-09 added `hill_reps`, the first v2 row, and that assertion fired
    // on cue. It now asserts the opposite: the checks above are exercised.
    expect(v2Rows().length, 'the v2 checks must run against at least one real row').toBeGreaterThan(0)
  })

  /**
   * INV-CAT-HM-ANCHOR-IS-HM-ONLY — §120.
   *
   * `resolveAnchorPace`'s `HM` arm reads the PLAN's goal pace, which is the
   * runner's half-marathon goal only because every row carrying an `HM` work
   * anchor is eligible for the half and nothing else. That was true when §120
   * shipped and would stop being true, silently and with no error, the first
   * time a marathon row wanted an HM-paced step: the marathon goal pace would be
   * handed to it.
   *
   * The alternative was threading a second "hm goal pace" parameter through
   * three functions and their call sites. This holds the same property with one
   * assertion, and it can be made to go red by widening one row's
   * `distance_eligibility` — which is exactly the edit that would break it.
   */
  it('an HM work anchor may only appear on a half-marathon-only row', () => {
    const offenders: string[] = []
    let rowsChecked = 0
    for (const row of v2Rows()) {
      const parsed = StructureV2Schema.safeParse(row.main_set_structure)
      if (!parsed.success) continue
      const usesHm = parsed.data.blocks.some(b => b.steps.some(
        st => st.role === 'work' && st.target.kind === 'pace' && st.target.anchor === 'HM'))
      if (!usesHm) continue
      rowsChecked++
      const elig = row.distance_eligibility
      if (elig.length !== 1 || elig[0] !== 'HM') {
        offenders.push(`${row.id} is eligible for [${elig.join(', ')}]`)
      }
    }
    expect(offenders,
      'an HM-anchored row outside HM plans would resolve the WRONG race\'s goal pace (§120)')
      .toEqual([])
    // Not vacuous: there is at least one such row, and if it ever disappears
    // this assertion says so rather than passing over an empty set.
    expect(rowsChecked, 'no row uses the HM anchor — has §120 been removed?').toBeGreaterThan(0)
  })
})
