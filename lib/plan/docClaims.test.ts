import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

/**
 * DOC-CLAIM-01 — a principle that quotes a string the engine EMITS must match the code.
 *
 * The gap this closes: `configPrincipleSync` proves a config key has a PRINCIPLE,
 * `configConsumer` proves it has a CONSUMER, `INPUT-EFFECT-01` proves an input MATTERS
 * — and nothing proved *principle → behaviour*. §24c quoted a coach cue
 * ("Zone 2 ceiling — if HR exceeds this, walk 30 seconds") that had drifted from what
 * the engine actually emits ("…if HR starts climbing, back off to a walk for 30 seconds
 * before resuming"), and searching the doc's words concluded the feature was MISSING when
 * it had shipped in April. It also described a "middle 10% of the run" segment that never
 * existed.
 *
 * WHY A CONVENTION, NOT A SCAN. Measured (2026-09-09): the doc has 56 `*"…"*` quotes; a
 * naive "every quoted string must exist in code" check is unbuildable-clean — the quotes
 * are an indistinguishable mix of genuinely-emitted cues, HYPOTHETICAL runner speech
 * ("I can't run more than 45 minutes on a weekday"), PARAPHRASES ("a weather forecast,
 * not a target"), and HISTORICAL drift-descriptions (a "Corrected" note quoting the old
 * wrong text on purpose). No heuristic separates them. So the check is OPT-IN and has
 * ZERO false positives: only a claim explicitly marked as verbatim engine copy is
 * verified.
 *
 * THE CONVENTION (documented in CoachingPrinciples.md § "Verifiable engine-copy claims"):
 *   **Engine copy:** `exact string the engine emits`   → VERIFIED against lib/ here.
 *   **Example copy:** `illustrative / paraphrased text`  → NOT checked (author's escape hatch).
 * Backticks delimit (cues contain quotes and em-dashes); the label makes the intent explicit.
 *
 * LIMITATION, STATED: coverage is the set of MARKED claims, so a new emitted-copy claim
 * written without the label is not checked. That is the price of zero false positives on a
 * corpus with no structural signal — and every marked claim is protected forever. The
 * check itself is autonomous (this test, in `npm run verify`); what it covers grows as
 * authors mark claims.
 */

const DOC = readFileSync(join(process.cwd(), 'docs/canonical/CoachingPrinciples.md'), 'utf8')

/** The marker is the BOLD label `**Engine copy:**` followed by a single-line backtick
 *  span. Bold is REQUIRED so a prose reference to the convention (which writes the label
 *  in backticks, `Engine copy:`, or plain) is not mistaken for a real claim — that
 *  ambiguity is exactly what made the first cut match its own documentation.
 *  `[^`\n]+` does not cross a newline: a claim is one line, and an unterminated backtick
 *  must not swallow the rest of the document. */
const ENGINE_COPY = /\*\*Engine copy:\*\*\s*`([^`\n]+)`/g

function existsInLib(s: string): boolean {
  try {
    // -F fixed-string (the cue contains regex-special chars), -q quiet, -r recursive.
    execSync(`grep -rqF ${JSON.stringify(s)} lib`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

describe('DOC-CLAIM-01 — every marked engine-copy claim exists verbatim in the code', () => {
  const claims = Array.from(DOC.matchAll(ENGINE_COPY)).map(m => m[1])

  it('the convention is actually in use (a check with nothing to check is a false pass)', () => {
    // Guards against the SWEEP-VACUOUS-01 shape: a green check that verifies nothing.
    // If this fails, the marker was renamed or the seeds were removed — fix the parse,
    // do not delete the assertion.
    expect(claims.length, 'no **Engine copy:** claims found — did the marker change?')
      .toBeGreaterThan(0)
  })

  it('no marked engine-copy string has drifted from what the code emits', () => {
    const drifted = claims.filter(c => !existsInLib(c))
    expect(
      drifted,
      `These strings are marked **Engine copy:** in CoachingPrinciples.md but appear ` +
      `nowhere in lib/ — either the doc drifted from the code (fix the doc to the shipped ` +
      `string) or the copy was removed/renamed (a real regression). If the quote is ` +
      `illustrative rather than verbatim, relabel it **Example copy:**:\n  ` +
      drifted.map(d => `"${d}"`).join('\n  '),
    ).toEqual([])
  })
})
