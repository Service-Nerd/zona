// The constitution must not have two sections with the same number.
//
// WHY THIS EXISTS. On 2026-09-11 §55, §81 and §82 each appeared TWICE in
// `CoachingPrinciples.md`. It was found the hard way: a Coaching Board conflict
// scan for the weekday cap read "§81" and landed on "`compressed` means two
// different things", an unrelated section, and the brief that went to the board
// asserted §81 said something it does not say.
//
// That is the exact failure the conflict scan exists to prevent. With 100+
// sections, "does this contradict an existing principle?" is answered by
// LOOKING THE NUMBER UP, and a duplicate number makes the lookup silently
// return the wrong law. Code comments across `ruleEngine`, `invariants` and
// `generationConfig` cite these numbers as if they were unique identifiers.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DOC = join(process.cwd(), 'docs', 'canonical', 'CoachingPrinciples.md')
const src = readFileSync(DOC, 'utf8')

/** `## <n>. <title>` — the section heading form used throughout. */
const headings = src
  .split('\n')
  .map((line, i) => ({ line, n: i + 1 }))
  .map(({ line, n }) => {
    const m = /^##\s+(\d+)\.\s+(.*)$/.exec(line)
    return m ? { num: Number(m[1]), title: m[2], line: n } : null
  })
  .filter((x): x is { num: number; title: string; line: number } => x !== null)

describe('CoachingPrinciples section numbering', () => {
  it('finds the sections at all (guards the guard)', () => {
    // A parse that silently matches nothing would make every assertion below
    // pass vacuously — the dead-check class this repo keeps hitting.
    expect(headings.length).toBeGreaterThan(50)
  })

  it('has no duplicate section numbers', () => {
    const seen = new Map<number, { title: string; line: number }[]>()
    for (const h of headings) {
      if (!seen.has(h.num)) seen.set(h.num, [])
      seen.get(h.num)!.push({ title: h.title, line: h.line })
    }
    const dupes = Array.from(seen.entries())
      .filter(([, v]) => v.length > 1)
      .map(([num, v]) =>
        `  §${num} appears ${v.length} times:\n` +
        v.map(x => `      L${x.line}  ${x.title.slice(0, 70)}`).join('\n'))

    expect(
      dupes,
      `Duplicate section numbers in the constitution:\n${dupes.join('\n')}\n\n` +
      `A § number is an identifier: code comments, invariants and the Coaching ` +
      `Board's conflict scan all resolve principles by it. Give the NEW section ` +
      `the next free number — the existing one keeps its number, because code ` +
      `already cites it.`,
    ).toEqual([])
  })

  // Not strictly required, but a gap is usually a section deleted without a
  // tombstone, and a silently-vanished principle is worth seeing.
  it('reports any gaps in the sequence for a human to confirm', () => {
    const nums = Array.from(new Set(headings.map(h => h.num))).sort((a, b) => a - b)
    const gaps: number[] = []
    for (let i = nums[0]; i < nums[nums.length - 1]; i++) {
      if (!nums.includes(i)) gaps.push(i)
    }
    // Informational: gaps are allowed (sections get superseded), so this only
    // fails if the document has become mostly holes.
    expect(gaps.length).toBeLessThan(nums.length / 2)
  })
})
