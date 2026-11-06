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
 * 🔴 AND THE BOARD-TAG BULLET IS A FOURTH SHAPE THIS COULD NOT SEE EITHER
 * (`BACKLOG-BULLET-BLIND-01`, 2026-11-06). The `SITE-CURRENCY-FOLLOWONS-01` wave
 * filed eleven items as plain list bullets led by the filing rule's board tag —
 * `- ⚙️ **NO BOARD** \`ID\` — …`. The bolded arm wants `**` immediately before
 * the id and here the `**` wraps the TAG; the heading arm wants hashes. So a
 * promise pointing at any of those eleven would have read as dangling, and
 * `audit-docs.sh`'s three open-item arms were blind to the identical shape on the
 * same day, for the same reason: **both registers key on a STATUS and a board tag
 * is not one.** Found while fixing the shell arms; fixed here in the same commit,
 * because the thing that costs this repo most is a remedy applied to one twin.
 *
 * ⚠️ THE HEADING ARM WAS BLIND TO THE BACKLOG'S OWN DOMINANT CONVENTION.
 * It required the id to follow the hashes immediately, and **measured
 * 2026-09-22 it matched 15 headings while missing 50** — because the filing
 * rule added a board-tag emoji (`### 🏃 \`ITEM-01\``) and every entry written
 * since carries one. So a promise whose entry existed, with a heading, in the
 * right file, still read as dangling. A short bounded prefix is allowed now;
 * bounded, so a sentence-shaped heading still cannot qualify as a definition.
 */
/**
 * The filing rule's board tags (backlog.md § FILING RULE, standing 2026-09-22).
 * ✅ is deliberately absent: it is how this shape says CLOSED, and the arm below
 * must not read a closed item as an open filing.
 */
const BOARD_TAGS = ['\u{1F3C3}', '\u{1F9ED}', '\u{1F4BC}', '\u{1F464}', '\u2699\uFE0F'] as const

const definitionSite = (id: string) => new RegExp(
  `\\*\\*~*\`?${esc(id)}\\b`
  + `|~~\\*\\*\`?${esc(id)}\\b`
  + `|^>?\\s*\\|\\s*[^|]{0,12}?\`?${esc(id)}\`?[~\\s]*\\|`
  + `|^#{2,4} +[^|\\n]{0,8}?[~\`]*${esc(id)}\\b`
  // The board-tag bullet: `- <tag> **<BOARD>** \`ID\` — …`.
  //
  // 🔴 THE TAG IS REQUIRED, AND THE FIRST CUT OF THIS LINE DID NOT REQUIRE IT.
  // It allowed 0–4 characters before the bold run, so `- **MEASURED** \`ID-01\``
  // — ordinary bold prose in a bullet — read as a FILING, which re-opens the
  // false negative this whole check exists to prevent. Code review found it.
  //
  // ⚠️ AND THE BOLD RUN IS `[^*]`, NOT `[A-Z —-]`, FOR THE SAME REASON THE ARM
  // EXISTS: the first cut could not see `**DESIGN BOARD, blocked**` (a qualifier
  // style already live in the file), while `audit-docs.sh` could — so the two
  // registers would have disagreed about what an item IS, which is the exact
  // divergence this commit set out to remove.
  + `|^- +(?:${BOARD_TAGS.join('|')}) +\\*\\*[^*\\n]{2,40}\\*\\* +\`?${esc(id)}\\b`,
  'm',
)

/** The shell's copy of the tag set, read from the script rather than restated.
 *  Two registers read these same two files and each kept its own idea of what an
 *  item looks like; that is how one blind spot landed in both. */
const AUDIT_SH = 'scripts/audit-docs.sh'

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

  it('recognises all four filing shapes, including the board-tag bullet', () => {
    // ⚠️ FIXTURES, NOT THE LIVE FILE. Every other arm here measures what the
    // backlog currently holds, and a live measurement cannot prove a pattern:
    // the board-tag shape went unseen by BOTH registers precisely because no
    // promise happened to point at one of the eleven items written in it. A
    // fixture arm is independent of that luck and cannot rot as items close.
    const SHAPES: Array<[string, string]> = [
      ['bolded', '> \u{1F532} **`FIXTURE-AA-01`** — the quoted-bullet filing. *(P2, filed 2026-11-06)*'],
      ['table cell', '| `FIXTURE-BB-01` | open | a row in the LATER table |'],
      ['heading', '### \u{1F3C3} `FIXTURE-CC-01` — the heading filing.'],
      ['board-tag bullet', '- \u{2699}\u{FE0F} **NO BOARD** `FIXTURE-DD-01` — the filing-rule bullet.'],
    ]
    for (const [shape, line] of SHAPES) {
      const id = line.match(/FIXTURE-[A-Z]+-01/)![0]
      expect(definitionSite(id).test(line), `the ${shape} shape is not recognised as a filing`).toBe(true)
    }
    // 🔴 AND THE NEGATIVES, BECAUSE THE FIRST CUT OF THIS ARM EXERCISED NONE OF
    // THE NEW BRANCH. Its only negative had no leading `- ` and no bold run, so
    // loosening the bullet alternative to accept arbitrary bold prose left all
    // three tests green — a self-test that cannot go red on the thing it was
    // written for. Code review found that; each line below is a real loosening.
    const NOT_FILINGS: Array<[string, string]> = [
      ['a bare cross-reference', 'see `FIXTURE-EE-01` for the measured figure'],
      ['a bullet with bold prose but NO board tag', '- **MEASURED** `FIXTURE-EE-01` — bold is not a tag.'],
      ['a bullet with a tag and no bold run at all', '- ⚙️ `FIXTURE-EE-01` — the tag alone is not a filing.'],
      ['a ✅-closed bullet', '- ✅ **SHIPPED 2026-11-06** `FIXTURE-EE-01` — closed.'],
      ['a sentence that merely bolds something first', 'the **point** is that `FIXTURE-EE-01` is only mentioned.'],
    ]
    // ⚠️ NOT IN THE LIST, AND IT WAS, UNTIL THIS FIXTURE FAILED: a board tag
    // followed by a LOWER-CASE bold run (`- ⚙️ **measured again** \`ID\` — …`) IS
    // accepted. My instinct was to reject it and the instinct was wrong — the
    // discriminator is the TAG, which is a deliberate filing marker, not the
    // casing of the words beside it. Rejecting it here while `audit-docs.sh`
    // accepts it would re-create the twin divergence in the opposite direction.
    for (const [what, line] of NOT_FILINGS) {
      expect(definitionSite('FIXTURE-EE-01').test(line), `${what} must not count as a definition`).toBe(false)
    }
  })

  it('agrees with audit-docs.sh about which tags make a bullet an open item', () => {
    // ⚠️ TWO REGISTERS READ THESE SAME TWO FILES. `audit-docs.sh` asks "is this
    // item still open?" and this file asks "was it ever filed?", and they must
    // mean the same thing by "filed" or a promise can dangle here while the audit
    // prints ok. They cannot share a regex — one is sed, one is JS — so this reads
    // the shell's tag set out of the script instead of restating it.
    const sh = readFileSync(join(process.cwd(), AUDIT_SH), 'utf8')
    const fn = sh.match(/board_tag_bullet_ids\(\) \{[\s\S]*?\n\}/)
    expect(fn, `${AUDIT_SH} no longer defines board_tag_bullet_ids`).not.toBeNull()
    const alt = fn![0].match(/\(([^)]*\|[^)]*)\)/)
    expect(alt, 'the extractor no longer carries a tag alternation').not.toBeNull()
    expect(alt![1].split('|'), 'the two registers disagree about the board tags')
      .toEqual([...BOARD_TAGS])
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
