import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { RUN_EVENTS, TRIGGER_EVALUATION_EVENTS, RUN_UNMATCHED_REASON_KEYS, type RunEventName } from './events'
import { RUN_UNMATCHED_REASONS } from './runOutcome'
import { RUN_UNMATCHED_REASONS as REEXPORTED } from '@/lib/coaching/autoAnalyse'
import { MIN_AUTO_LINK_CONFIDENCE } from '@/lib/coaching/sessionMatch'

/**
 * ADR-027 B3 step 4a — the run event vocabulary and `docs/canonical/engine-truths.md`.
 *
 * ── WHAT THIS GATE IS FOR ───────────────────────────────────────────────────────────────────────
 * ARCH-ENG-002 named the registry and nobody created it for weeks, so it was cited as though it
 * constrained something. A registry nothing checks is prose; these arms make it a record that has
 * to stay true. Same shape as `heldRules.test.ts`: the document is compared against the code, and
 * an unparseable document FAILS rather than comparing against nothing.
 *
 * 🔻 WHAT IT DOES NOT CHECK, stated rather than discovered later. It does not verify that the
 * matcher's SCORE WEIGHTS in the registry still match `scoreMatch` — those are private to that
 * module and reading them would mean parsing its source, which is the "grep the file" shape this
 * repo keeps paying for. The weights are re-derived by hand when the row is touched; the arm below
 * pins the two things that ARE mechanically checkable: the gate CONSTANT and the owner's existence.
 */

const DOC = join(process.cwd(), 'docs/canonical/engine-truths.md')

describe('ADR-027 step 4a — the run event vocabulary', () => {
  it('🔴 is exactly the three events ARCH-ENG-022 names, and only two evaluate triggers', () => {
    // The names are the trigger catalogue's vocabulary (4b), so a fourth appearing silently would
    // give the catalogue an event nothing raises. Asserted as a set, in order of a run's passage.
    expect(RUN_EVENTS.map(e => e.name)).toEqual<RunEventName[]>(['run_arrived', 'run_logged', 'run_analysed'])
    expect(TRIGGER_EVALUATION_EVENTS).toEqual(['run_logged', 'run_analysed'])
  })

  it('🔴 `run_arrived` does NOT evaluate triggers — giving it one reverses §124 Am. 1', () => {
    // Asserted on its own rather than only through the list above, because this is the ruling and
    // the list could be "right" while the flag that encodes it is wrong.
    const arrived = RUN_EVENTS.find(e => e.name === 'run_arrived')!
    expect(arrived.evaluates_triggers, 'the evaluation event is run_analysed, never raw ingest').toBe(false)
    // ⚠️ Matched on the SITTING DATE, not on "§124 Am. 1". ADR-027 cites that amendment and
    // **it does not exist in CoachingPrinciples.md** (verified 2026-11-26, filed as
    // S124-AMENDMENT-MISSING-01). Asserting a citation to a section that was never written would
    // make this gate enforce the fiction.
    expect(arrived.ruling).toMatch(/2026-11-21/)
  })

  it('every event states the ruling it comes from, so the flag is never a bare preference', () => {
    for (const e of RUN_EVENTS) expect(e.ruling.length, `${e.name} has no ruling`).toBeGreaterThan(20)
  })

  it('🔴 the unmatched-reason vocabulary has ONE definition, and its old home re-exports it', () => {
    // It moved to `./runOutcome` so the contract need not import a server module to learn six
    // strings (ARCH-ENG-001). `autoAnalyse` re-exports, so this is a move and not a copy — and
    // identity, not deep equality, is what proves that: two separate objects can be equal.
    expect(REEXPORTED, 'autoAnalyse must re-export the SAME object, not a copy').toBe(RUN_UNMATCHED_REASONS)
    expect(RUN_UNMATCHED_REASON_KEYS.sort()).toEqual(Object.keys(RUN_UNMATCHED_REASONS).sort())
  })
})

describe('ADR-027 ARCH-ENG-002 — the canonical truth registry', () => {
  it('🔴 exists at the path ADR-027 names, or every citation of it is fiction', () => {
    expect(existsSync(DOC), 'ARCH-ENG-002 names docs/canonical/engine-truths.md').toBe(true)
  })

  const src = existsSync(DOC) ? readFileSync(DOC, 'utf8') : ''

  it('🔴 names a live owner for every truth it claims one for', () => {
    // The registry's whole value is "one owner per truth". A row naming a module that no longer
    // exists is worse than no row: it answers the question wrongly and confidently.
    const owners = Array.from(src.matchAll(/\(`(lib\/[^`]+\.ts)`\)/g), m => m[1])
    expect(owners.length, 'no owner paths found — the table format changed and this arm is blind').toBeGreaterThan(3)
    expect(owners.filter(p => !existsSync(join(process.cwd(), p))), 'registry names a file that does not exist').toEqual([])
  })

  it('🔴 declares the truths that have NO owner yet, rather than omitting them', () => {
    // An incomplete gate must say it is incomplete. L3/L4 are unbuilt; a row quietly missing reads
    // identically to a truth nobody has considered, which is the failure this registry exists against.
    expect(src).toMatch(/— not built —/)
    for (const truth of ['The delivered plan', 'Decisions', 'Explanations']) {
      expect(src, `${truth} has no row`).toContain(truth)
    }
  })

  it('🔴 the matcher row\'s auto-link gate is the CONSTANT, not a number someone typed', () => {
    // The row states the server gate as `high`. If POST-RUN-01 is ever revisited and the constant
    // moves, this fails rather than leaving the registry asserting the old ruling.
    expect(MIN_AUTO_LINK_CONFIDENCE).toBe('high')
    expect(src).toMatch(/MIN_AUTO_LINK_CONFIDENCE/)
    expect(src).toMatch(/POST-RUN-01/)
    expect(src, 'the client gate and its ruling must both be named').toMatch(/AUTO-MATCH-02/)
  })
})
