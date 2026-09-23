// PRESCRIBED-FIELD-REACH-01 — a field the ENGINE WRITES must have a UI READER.
//
// 🔴 THE DEFECT THIS EXISTS FOR. `run_walk_strategy` arrived 2026-05-12 as a
// SCHEMA-ONLY reserved field (AI-DEPTH-07), and the feature registry said so in
// terms: *"Engine does not populate these yet — AI-DEPTH-08 will … propose
// `fueling_protocol` / `run_walk_strategy`."* For four months "nothing reads
// this" was CORRECT. On 2026-09-20 §117 gave it a producer. Nobody added a
// reader, because the field's unread status had never been a defect before.
//
// Measured at the time of this test: `grep -riE 'run.?walk' app components`
// returned **0**, and `git log -S'run_walk' -- app components` returned **0
// commits, ever**. Meanwhile `INV-PLAN-RUNWALK-PRESCRIBED` was GREEN, because
// it asserts the stamp is in the plan JSON — it cannot see a screen.
//
// 🥇 NEW FAILURE CLASS: **a reserved field gains a producer.** It is the inverse
// of declared-but-inert (`LoadShape.ariaLabel`, the decorative-config family),
// where a field has readers and no writer. Here a field had no readers BY
// DESIGN, acquired a writer, and its inertness silently flipped from correct to
// broken. **The tell is a registry line or comment saying "not populated yet"
// that has quietly become false.**
//
// ⚠️ WHY THE INVARIANT COULD NOT CATCH IT. `validatePlan` reads the plan; the
// runner reads the app. A checker that shares neither source with the thing it
// guards is the *checker reads a different source from the producer* class,
// which this repo has recorded three times in one day before.

import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

/** Files a runner's eyes can actually reach. Marketing is excluded: it renders
 *  an authored sample plan, not the reader's own (see the PlanPage entry in
 *  `hardcodedUnits.test.ts`'s BASELINE for the same distinction). */
const UI_GLOBS =
  "git ls-files 'app/*.tsx' 'app/**/*.tsx' 'components/*.tsx' 'components/**/*.tsx'"

/**
 * 🔴 COMMENTS ARE STRIPPED, AND FALSIFYING IS THE ONLY REASON THIS IS HERE.
 * The first cut scanned raw source. Deleting the renderer left this test GREEN,
 * because the renderer's own COMMENT BLOCK — explaining that the field had been
 * written and never rendered — contains the string `run_walk_strategy`. **My
 * documentation satisfied my own gate.**
 *
 * That is the FIFTH recording of *bound the region, never grep the file*: the
 * coaching and design guards (heredoc bodies, interpreter write targets),
 * `hardcodedUnits.test.ts` (a comment explaining its own rule),
 * `rlsCoverage.test.ts` (a comment naming a table the route never touches), and
 * here. Conservative: only a `//` that OPENS a line is stripped, so a `https://`
 * inside a string literal survives.
 */
const stripComments = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(l => (/^\s*\/\//.test(l) ? '' : l))
    .join('\n')

const uiSource = (): string =>
  execSync(UI_GLOBS, { encoding: 'utf8' })
    .trim().split('\n')
    .filter(f => f && !/\.test\.tsx?$/.test(f))
    .map(f => stripComments(readFileSync(f, 'utf8')))
    .join('\n')

/** Session fields the ENGINE WRITES as an instruction to the runner. Each one
 *  must be read somewhere a runner can see it. */
const PRESCRIBED: ReadonlyArray<{ field: string; why: string }> = [
  { field: 'run_walk_strategy', why: '§117 Am.3 — the walk break is PRESCRIBED, not permitted' },
  { field: 'pace_target',       why: '§85 — the session header pace' },
  { field: 'hr_target',         why: '§14 — the zone the session is run in' },
  { field: 'coach_notes',       why: 'the why, per the card hierarchy' },
  { field: 'rpe_target',        why: 'effort-governed sessions (§44 pt 3) carry no pace' },
]

/** Fields that exist in the schema with NO producer. Reserved, by design.
 *
 *  ⚠️ THIS HALF IS THE ONE THAT WOULD HAVE CAUGHT THE DEFECT. A reserved field
 *  is only safe while nothing writes it. The moment the engine starts, it needs
 *  a reader — so this asserts the ABSENCE of a producer, and goes red when one
 *  appears, forcing the decision rather than discovering it on a runner. */
const RESERVED: ReadonlyArray<{ field: string; reservedFor: string }> = [
  { field: 'fueling_protocol', reservedFor: 'AI-DEPTH-08 (post-race reshape) — registry 2026-05-12' },
  { field: 'key_session',      reservedFor: 'AI-DEPTH-08 — registry 2026-05-12' },
]

/** Where the engine could write a session field. */
const ENGINE_GLOBS = "git ls-files 'lib/plan/*.ts' 'lib/plan/**/*.ts' 'lib/coaching/*.ts' 'lib/coaching/**/*.ts'"

const engineWriters = (field: string): string[] => {
  const files = execSync(ENGINE_GLOBS, { encoding: 'utf8' }).trim().split('\n')
    .filter(f => f && !/\.test\.tsx?$/.test(f) && !f.endsWith('/schema.ts'))
  const out: string[] = []
  for (const f of files) {
    for (const raw of readFileSync(f, 'utf8').split('\n')) {
      const t = raw.trim()
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue
      // An OBJECT-LITERAL write: `field:` or `field =`. A bare mention (a read,
      // a type annotation) is not a producer.
      if (!new RegExp(`\\b${field}\\s*[:=][^:=]`).test(t)) continue
      if (new RegExp(`\\.${field}\\b`).test(t)) continue
      // ⚠️ AN EXPLICIT CLEAR IS NOT A PRODUCER, and the first cut of this test
      // called two of them producers. `postRaceReshape.ts` builds a blank
      // session with `fueling_protocol: undefined` and `key_session: false` —
      // deliberately writing NOTHING, beside `run_walk_strategy: undefined` and
      // `pace_target: undefined` on the same lines. A reset is the opposite of
      // a prescription, and counting it as one would have made this gate cry
      // wolf on day one, which this repo records as equivalent to no gate.
      const value = t.slice(t.search(new RegExp(`\\b${field}\\s*[:=]`))).replace(new RegExp(`^\\b${field}\\s*[:=]\\s*`), '')
      if (/^(undefined|null|false|''|""|`\s*`)\s*[,;)]?\s*(\/\/.*)?$/.test(value)) continue
      out.push(`${f}: ${t.slice(0, 80)}`)
    }
  }
  return out
}

describe('PRESCRIBED-FIELD-REACH-01 — the runner can see what the engine prescribes', () => {
  const ui = uiSource()

  it('the scan reaches the UI at all (guards the guard)', () => {
    // A zero-length read would make every assertion below pass vacuously —
    // this repo has shipped that twice, and a regression comparison once ran on
    // two EMPTY files and reported success.
    expect(ui.length).toBeGreaterThan(100_000)
    expect(ui).toContain('coach_notes')
  })

  for (const { field, why } of PRESCRIBED) {
    it(`\`${field}\` is read by a surface the runner sees — ${why}`, () => {
      expect(
        ui.includes(field),
        `The engine writes \`${field}\` and NOTHING under app/ or components/ reads it. ` +
          `That is exactly how §117's run-walk prescription shipped invisible for three days ` +
          `while its invariant stayed green. Render it, or stop writing it.`,
      ).toBe(true)
    })
  }

  for (const { field, reservedFor } of RESERVED) {
    it(`🔴 \`${field}\` is still RESERVED — no producer has appeared`, () => {
      const writers = engineWriters(field)
      expect(
        writers,
        `\`${field}\` was reserved for ${reservedFor} and something now WRITES it. ` +
          `A reserved field is only safe while nothing produces it. Either give it a UI ` +
          `reader and move it to PRESCRIBED, or remove the producer. ` +
          `This is the assertion that would have caught run_walk_strategy on the day.`,
      ).toEqual([])
    })
  }
})
