import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * XREF-DANGLE-01 — a backlog line that PROMISES an entry must deliver one.
 *
 * WHY THIS EXISTS, and why it is narrow on purpose.
 *
 * On 2026-09-17 `da96f3c` removed `LR-ABS-ALLOWANCE-01` as a duplicate. It
 * repointed FIVE files — CoachingPrinciples §94 Am.1, `plan-invariants.md`,
 * `feature-registry.md`, the decision record and `invariants.ts` — and missed
 * one back-reference in `backlog.md`, the very file it was editing. The line
 * went on saying "Filed as `LR-ABS-ALLOWANCE-01` below" with nothing below,
 * and survived every doc audit run since, including `audit-docs.sh` reporting
 * ALL CLEAN.
 *
 * This is the repo's recorded "flagged but unfiled" class — the same shape as
 * the `longest_recent_run_km` gate that sat in a code comment until the founder
 * asked why it was not on the list. A promise in prose is the weakest possible
 * filing: it reads as done, it is greppable, and nothing is obliged to honour it.
 *
 * ⚠️ IT SCANS PROMISES, NOT EVERY ID MENTION, AND THAT NARROWNESS IS THE DESIGN.
 * The obvious check — "every item ID referenced anywhere must resolve to a
 * definition" — was built first and measured: **156 hits**, overwhelmingly
 * historical references to closed work and capitalised prose (`DROP-OUT`,
 * `NO-OP`, `JSON-LD`). This repo has recorded three times that a check which
 * cries wolf gets switched off, which is the same as having no check. Tightening
 * to "the sentence says the entry is HERE" gave 5 promises and **2 unkept** — a
 * 40% hit rate with no false positives, and it found the second instance
 * (`GRID-COVERAGE-TRAINING-AGE-01`) on its own, which reading had not.
 *
 * Both unkept promises turned out to be the same story: the substance was
 * delivered under a DIFFERENT id (`LR-ABS-CAP-LOWVOL-01`, `GRID-COVERAGE-01`)
 * and the promise was never reconciled. So this does not catch abandoned work
 * so much as abandoned BOOKKEEPING — which is what makes an open list wrong.
 */

const FILES = ['docs/releases/backlog.md', 'docs/releases/roadmap.md'] as const

/**
 * An item id in this repo is `SCOPE-NN`, optionally with a letter suffix for a
 * sub-item (`FIRSTRUN-MOMENTS-01a`). The trailing two-digit ordinal is what
 * separates an id from ordinary hyphenated prose in caps.
 */
const ID = '[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\\d{2}[a-f]?'

/**
 * A PROMISE is prose asserting the id is written up IN THIS FILE — "filed as X
 * below", "tracked as X below", "full spec in X below". The locality word is
 * required: "see `SESSION-KM-01`" pointing at shipped work in the registry is a
 * normal cross-reference, not a promise, and must not be flagged.
 */
const PROMISE = new RegExp(
  '(?:filed as|tracked as|now tracked as|re-?filed as|split out as|see|spec(?:ced)? (?:in|as)|full spec(?:s)? in)'
  + `\\s+\\*{0,2}\`?(${ID})\`?\\*{0,2}[^.\\n]{0,40}?\\b(?:below|above|in this file)`,
  'gi',
)

const esc = (s: string) => s.replace(/-/g, '\\-')

/**
 * A DEFINITION SITE — the four shapes this backlog actually uses. Bolded
 * (`**ID` / `` **`ID` `` / `~~**ID`), a table's first cell (blockquoted rows
 * included — the 2026-09-18 index table is inside a `>` block), or a heading.
 * A bare mention in a sentence is deliberately NOT a definition.
 *
 * ⚠️ THE HEADING ARM WAS BLIND TO THE BACKLOG'S OWN DOMINANT CONVENTION.
 * It required the id to follow the hashes immediately, and **measured
 * 2026-09-22 it matched 15 headings while missing 50** — because the filing
 * rule added a board-tag emoji (`### 🏃 \`ITEM-01\``) and every entry written
 * since carries one. So a promise whose entry existed, with a heading, in the
 * right file, still read as dangling. A short bounded prefix is allowed now;
 * bounded, so a sentence-shaped heading still cannot qualify as a definition.
 */
const definitionSite = (id: string) => new RegExp(
  `\\*\\*~*\`?${esc(id)}\\b`
  + `|~~\\*\\*\`?${esc(id)}\\b`
  + `|^>?\\s*\\|\\s*[^|]{0,12}?\`?${esc(id)}\`?[~\\s]*\\|`
  + `|^#{2,4} +[^|\\n]{0,8}?[~\`]*${esc(id)}\\b`,
  'm',
)

describe('XREF-DANGLE-01 — promised backlog entries exist', () => {
  const sources = FILES.map(f => ({ file: f, text: readFileSync(join(process.cwd(), f), 'utf8') }))

  const promises = sources.flatMap(({ file, text }) =>
    Array.from(text.matchAll(PROMISE)).map(m => ({
      file,
      id: m[1],
      line: text.slice(0, m.index).split('\n').length,
      quote: m[0].replace(/\s+/g, ' ').slice(0, 90),
    })),
  )

  it('scans a non-empty set of promises', () => {
    // Guards the regex itself. If a rewording drops the promise count to zero
    // the test would pass vacuously and prove nothing — this repo has shipped a
    // regression comparison that ran on two EMPTY files and reported success.
    expect(promises.length).toBeGreaterThan(0)
  })

  it('every promised id has a definition site in the backlog or roadmap', () => {
    const unkept = promises.filter(p => !sources.some(s => definitionSite(p.id).test(s.text)))
    expect(
      unkept.map(p => `${p.file}:${p.line} promises "${p.id}" ("${p.quote}") — no entry defines it`),
      'A line promises an entry that does not exist. Either write the entry, or '
      + 'repoint the sentence at the id that actually carries the work.',
    ).toEqual([])
  })
})
