// The restraint rules have exactly ONE owner, and the copies stay pointers.
//
// Transferred from `brand.md` to the Design Board on 2026-09-22 by founder ruling
// (ADR-023, `docs/canonical/ownership-map.md`). The owner is
// `docs/canonical/ux-principles.md` § Screen Design Principles.
//
// WHY THIS TEST EXISTS. The six rules were written in FOUR places and had already
// diverged in three measurable ways:
//
//   · `CLAUDE.md` stated "No popups — all interactions navigate to full screens"
//     with NO exception, while brand.md and ux-principles.md both carried
//     "modals only for destructive confirmations". Read alone, CLAUDE.md banned
//     modals outright. That is the live defect this transfer fixed.
//   · "Empty means calm, not broken" existed in brand.md and was dropped by two
//     of the other three copies.
//   · "No red in the training UI" existed in brand.md ALONE.
//
// This is D-16 (no parallel semantics) and it is the same shape as the session
// colour map (ten copies, `--s-long` unreachable for every generated plan) and
// the `--surface-moss-wash` incident (the rule and the token in different files,
// never met). A rule that holds only while someone remembers is not a rule.
//
// ⚠️ This test does NOT check that the rules are CORRECT. It checks there is one
// owner and that the other documents point at it rather than restating it. The
// Design Board rules on the content; this guards the topology.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const OWNER = 'docs/canonical/ux-principles.md'
/** Every document that used to carry a copy and must now only reference one. */
const REFERENCERS = [
  'docs/canonical/brand.md',
  'docs/canonical/ui-patterns.md',
  'CLAUDE.md',
]

/**
 * The owner's section, bounded. Never grep the whole file: `ui-patterns.md` is
 * 2,750 lines and the word "restraint" appears in it 19 times, so an unbounded
 * match proves nothing. Third time this repo has recorded that class.
 */
function ownerSection(): string {
  const doc = read(OWNER)
  const start = doc.indexOf('## Screen Design Principles')
  expect(start, `${OWNER} has lost its § Screen Design Principles heading`).toBeGreaterThan(-1)
  const after = doc.indexOf('\n## ', start + 4)
  return doc.slice(start, after === -1 ? undefined : after)
}

/** The clauses that were actually lost in the wild, not a paraphrase of them. */
const LOST_CLAUSES = [
  { name: 'the destructive-confirmation exception', re: /destructive confirmation/i },
  { name: 'the empty-state clause', re: /empty means calm, not broken/i },
  { name: 'no red in the training UI', re: /no red in the training ui/i },
]

describe('restraint rules — single owner', () => {
  it('the owner section exists and is substantial', () => {
    const section = ownerSection()
    expect(section.length).toBeGreaterThan(500)
    expect(section).toMatch(/SINGLE OWNER/i)
  })

  it('the owner carries every clause that was lost while ownership was ambiguous', () => {
    const section = ownerSection()
    for (const { name, re } of LOST_CLAUSES) {
      expect(re.test(section), `the owner is missing ${name}`).toBe(true)
    }
  })

  it('every former copy now points at the owner', () => {
    for (const path of REFERENCERS) {
      const doc = read(path)
      expect(
        doc.includes('ux-principles.md'),
        `${path} must reference the owner (${OWNER}), not restate the rules`,
      ).toBe(true)
    }
  })

  it('no former copy restates the rules as its own doctrine', () => {
    // A former copy may MENTION a rule (a pointer, or a warning about the old
    // divergence). What it must not do is present the full set as a table of its
    // own — which is what a "| Rule | Detail |" header under a Visual/Core
    // Principles heading means.
    const brand = read('docs/canonical/brand.md')
    const visual = brand.indexOf('## Visual Principles')
    expect(visual).toBeGreaterThan(-1)
    const section = brand.slice(visual, brand.indexOf('\n## ', visual + 4))
    expect(
      /\|\s*Rule\s*\|\s*Detail\s*\|/.test(section),
      'brand.md § Visual Principles has a rules table again — it must point at the owner',
    ).toBe(false)
    expect(section).toMatch(/ux-principles\.md/)
  })

  it('CLAUDE.md never states "no popups" as a RULE without the exception', () => {
    // The exact live defect this transfer fixed.
    //
    // ⚠️ THE FIRST VERSION OF THIS CHECK WAS HOLLOW, and it is worth keeping the
    // reason. It did `doc.indexOf('no popups')` and tested that one line. But the
    // §UI Principles blockquote ABOVE the bullets quotes the old bare rule while
    // explaining the divergence — and that sentence also contains "destructive
    // confirmations". So the first match was prose about the defect, it passed,
    // and restoring the real defect to the real bullet did not turn it red.
    // Falsified 2026-09-22 and caught; fifth substring-bias miss in this repo.
    //
    // So: check EVERY line that states the rule as a RULE (a list bullet), not
    // the first line that mentions it. Prose is exempt by construction.
    const doc = read('CLAUDE.md')
    const bullets = doc
      .split('\n')
      .filter(l => /^\s*[-*]\s/.test(l) && /no popups/i.test(l))

    expect(
      bullets.length,
      'CLAUDE.md no longer states the popup rule as a bullet — if it moved, update this check',
    ).toBeGreaterThan(0)

    for (const bullet of bullets) {
      expect(
        /destructive confirmation/i.test(bullet),
        'CLAUDE.md states the popup rule without its destructive-confirmation ' +
          `exception — the exact 2026-09-22 divergence. Offending line: ${bullet.trim()}`,
      ).toBe(true)
    }
  })

  it('FALSIFICATION — the checks really go red', () => {
    // 1. A former copy that stops referencing the owner.
    const noRef = 'Some doc with no pointer at all.'
    expect(noRef.includes('ux-principles.md')).toBe(false)

    // 2. A bare popup rule, as CLAUDE.md actually had it — and the prose that
    //    defeated the first version of the check, proving the bullet filter is
    //    what does the work rather than a lucky first match.
    const bare = '- No popups — all interactions navigate to full screens'
    const prose = '> previously stated "No popups" while brand.md carried "destructive confirmations"'
    const isBullet = (l: string) => /^\s*[-*]\s/.test(l)
    expect(isBullet(bare)).toBe(true)
    expect(isBullet(prose)).toBe(false)
    expect(/destructive confirmation/i.test(bare)).toBe(false)
    expect(/destructive confirmation/i.test(prose)).toBe(true)

    // 3. brand.md carrying a rules table again.
    const tableAgain = '## Visual Principles\n\n| Rule | Detail |\n|---|---|\n| No popups | ... |'
    expect(/\|\s*Rule\s*\|\s*Detail\s*\|/.test(tableAgain)).toBe(true)

    // 4. An owner that has dropped a clause.
    const stripped = 'Whitespace, brevity and silence are features.'
    expect(/empty means calm, not broken/i.test(stripped)).toBe(false)
  })
})
