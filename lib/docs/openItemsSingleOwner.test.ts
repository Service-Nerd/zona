import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

/**
 * BACKLOG-PARENT-HEADING-BLIND-01 — "which backlog items are open?" has ONE owner.
 *
 * 🔴 WHY. The founder asked whether `FIRSTRUN-MARATHON-01` was built. It was: every touchpoint
 * shipped between 2026-09-18 and 2026-10-05, all of it in production. It read as the open P0 for
 * 33 days because its PARENT heading (`## 🥇 P0 — FIRSTRUN-MARATHON-01`) carried no stamp and
 * **no arm in `audit-docs.sh` had ever read a `##` heading** — so the largest item in the file was
 * outside every open-item population in both directions. Measured when found: 26 `##` headings
 * name an item, 22 have a shipped registry row, 18 of those were unstamped.
 *
 * The derivation now lives in `scripts/lib/open-items.sh` and BOTH callers source it. This test
 * exists because a second copy is this repo's most expensive recurring defect — `deloadCadence`,
 * `tierResolution`, `supersedeCoverage`, `OPS-AI-OWNER-01`, `SESSION-KM-01` — and here it would
 * fail the worst way: the gate calling an item closed while the report a human reads calls it
 * open, or the reverse.
 */

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const LIB = 'scripts/lib/open-items.sh'
const CALLERS = ['scripts/audit-docs.sh', 'scripts/backlog-open.sh', 'scripts/backlog-verify.mjs'] as const
const OWNED = [
  'heading_open_ids', 'heading_open_sites',
  'board_tag_bullet_ids', 'board_tag_bullet_sites',
  // 🔴 ADDED 2026-11-09. `status_bullet_open_*` is the THIRD filing format `backlog.md` names
  // and the owner did not cover, so the first consumer to ask "is this id a live item?" was
  // wrong about 23 of them. ⚠️ The list was also the reason a duplicate extraction went
  // ungated: a `heading_all_sites` shipped as a verbatim second copy of `heading_open_sites`,
  // under a comment claiming it shared the extraction, and this file could not see it because
  // it enumerates NAMES. The duplicate was deleted rather than refactored; the names are here
  // so the next one is caught.
  'status_bullet_open_ids', 'status_bullet_open_sites',
  // 🔴 ADDED 2026-11-08 (BACKLOG-TAG-IN-HEADING-01). `backlog-open.sh` held the board
  // derivation and `backlog-verify.mjs` needed the same answer to GATE the filing rule. Two
  // copies would disagree about which board owns an item, which is the one thing it says.
  'open_item_boards',
  // 🔴 ADDED 2026-11-10 (BACKLOG-DUPLICATE-HEADING-01). `heading_sites_with_status` is the
  // OWNER now and `heading_open_sites` is a one-line filter over it, because a second heading
  // needs THREE states and not two: a SHIPPED stamp and this file's archive convention
  // (*"the original filing, for the record"*) both read as closed and mean opposite things.
  // ⚠️ **THIS EXTRACTION HAS BEEN ATTEMPTED ONCE AND REVERTED** — the note above records a
  // `heading_all_sites` that shipped as a VERBATIM second copy of `heading_open_sites` under a
  // comment claiming it shared the extraction. It was deleted rather than refactored, so the
  // refactor was still owed. This time `heading_open_sites` holds no awk of its own, and arm 6
  // asserts that rather than trusting the comment.
  'heading_sites_with_status', 'duplicate_filing_ids',
  '_CLOSED_STAMPS', '_CLOSED_PROSE',
] as const

describe('BACKLOG-PARENT-HEADING-BLIND-01 — one owner of "what is open"', () => {
  it('1. the owner exists and defines every name', () => {
    expect(existsSync(join(ROOT, LIB)), `${LIB} is the single owner and must exist`).toBe(true)
    const lib = read(LIB)
    for (const name of OWNED) {
      const defines = new RegExp(`(^|\\n)\\s*(${name}\\(\\)|${name}=)`).test(lib)
      expect(defines, `${LIB} must define ${name}`).toBe(true)
    }
  })

  it('2. NO caller defines any of them itself — a second copy is the defect', () => {
    for (const caller of CALLERS) {
      const src = read(caller)
      for (const name of OWNED) {
        // ⚠️ A JS CALLER REDEFINES DIFFERENTLY, and the first cut of this arm could not see it.
        // `scripts/backlog-verify.mjs` joined CALLERS on 2026-11-08; `function name() {…}` and
        // `const name = …` both put a keyword BEFORE the name, so a pattern anchored at the line
        // start missed them. Falsified by appending a stub to that file and watching this arm
        // stay GREEN — the same class as every other "the checker's population excludes the
        // cases at risk" entry in this repo, arriving because the population gained a language.
        const defines = new RegExp(
          `(^|\\n)\\s*((function|const|let|var)\\s+)?${name}\\s*(\\(\\)\\s*\\{|=)`,
        ).test(src)
        expect(defines, `${caller} defines its own ${name}; it must source ${LIB}`).toBe(false)
      }
      expect(src.includes('scripts/lib/open-items.sh'), `${caller} must source ${LIB}`).toBe(true)
    }
  })

  it('3. a `##` PARENT heading is in the population — the case that caused this', () => {
    const lib = read(LIB)
    // The arm must reach `##`, not only `###`: that single character is the whole defect.
    expect(lib, 'the matcher must reach a ## heading').toMatch(/\/\^##\//)
    // And it must still exclude the FILING-SESSION convention, which is what keeps it at
    // ZERO false positives (measured: excluding it leaves exactly 2, both genuine).
    expect(lib).toMatch(/FILED\|SHIPPING/)
  })

  it('4. the closed test must NOT read the id — the spelling-not-the-claim bug, caught once already', () => {
    const lib = read(LIB)
    // Backticked spans are blanked before the stamp test, or `*-DEAD-01` items exclude themselves.
    expect(lib, 'backticked spans must be blanked before the closed-word test')
      .toMatch(/gsub\(\/`\[\^`\]\*`\/, *"@@", *bare\)/)
    const stampLine = lib.split('\n').find(l => l.startsWith('_CLOSED_STAMPS='))!
    expect(stampLine, 'DEAD is a stamp word, so the blanking above is load-bearing').toContain('DEAD')
  })

  it('5. FIRSTRUN-MARATHON-01 is recorded as complete, with its deployment evidence', () => {
    const bl = read('docs/releases/backlog.md')
    const heading = bl.split('\n').find(l => l.startsWith('## ') && l.includes('FIRSTRUN-MARATHON-01'))
    expect(heading, 'the parent heading must exist').toBeTruthy()
    expect(heading!, 'it must carry a closed stamp — it was unstamped for 33 days').toMatch(/✅/)
    // ⚠️ The stamp alone is not the point: the claim has to carry what was checked.
    expect(bl).toContain('VERIFIED BUILT AND IN PRODUCTION')
    expect(bl, 'a push is not a deploy — the evidence names the deployed SHA')
      .toMatch(/ancestors of the deployed production SHA/)
  })
})

/**
 * 🔴 BACKLOG-DUPLICATE-HEADING-01 (2026-11-10) — the status owner, and the duplicate gate.
 *
 * `heading_sites_with_status` exists because `heading_open_sites` collapsed closed into one
 * bucket, and a second heading needs three states: a SHIPPED **STAMP**, this file's **ARCHIVE**
 * convention, or **OPEN**. Both of the first two read as "closed" and they mean opposite things
 * about whether the second heading is legitimate.
 *
 * ⚠️ **AND THIS EXTRACTION WAS ATTEMPTED ONCE AND REVERTED.** The `OWNED` note above records a
 * `heading_all_sites` that shipped as a verbatim second copy of `heading_open_sites`, under a
 * comment claiming it shared the extraction, invisible to this file because it enumerates
 * NAMES. Arm 6 below checks the SHAPE instead: the filter must hold no awk program of its own.
 */
describe('BACKLOG-DUPLICATE-HEADING-01 — three states, one extraction, and the duplicate gate', () => {
  const lib = read(LIB)
  const fn = (name: string) => {
    const i = lib.indexOf(`${name}() {`)
    expect(i, `${name} must be defined in ${LIB}`).toBeGreaterThan(-1)
    // Brace-match from the opening `{`, rather than slicing to the next `}` at column 0 —
    // guessing where a region ends is a defect this repo paid for twice this week.
    let depth = 0, j = lib.indexOf('{', i)
    for (let k = j; k < lib.length; k++) {
      if (lib[k] === '{') depth++
      else if (lib[k] === '}') { depth--; if (depth === 0) return lib.slice(i, k + 1) }
    }
    throw new Error(`${name} is unbalanced`)
  }

  it('6. 🔴 `heading_open_sites` is a FILTER, not a second copy of the extraction', () => {
    const open = fn('heading_open_sites')
    expect(open, 'it must call the owner').toContain('heading_sites_with_status')
    // The extraction is the `/^##/` awk program. A filter has no business holding one.
    expect(open, 'the filter must not re-extract headings').not.toContain('/^##/')
    expect(open, 'nor re-derive the backtick id convention').not.toContain('RSTART')
    // …and the owner must still hold exactly one.
    const owner = fn('heading_sites_with_status')
    expect((owner.match(/\/\^##\//g) ?? []).length, 'exactly one extraction').toBe(1)
    expect((lib.match(/match\(line, \/`\[A-Z\]/g) ?? []).length,
      'the backtick-id convention appears in ONE place in the whole owner').toBe(1)
  })

  it('7. the three states are decided in one place, and ARCHIVE is distinct from STAMPED', () => {
    const owner = fn('heading_sites_with_status')
    expect(owner).toContain('STAMPED')
    expect(owner).toContain('ARCHIVED')
    // 🔴 The distinction is the whole point: a prose marker must NOT set `stamped`. If it did,
    // `duplicate_filing_ids` could never tell a legitimate archive pair from a real duplicate.
    expect(owner, 'the prose vocabulary sets ARCHIVED').toMatch(/prose[\s\S]{0,200}archived = 1/)
    expect(owner, 'the stamp vocabulary sets STAMPED').toMatch(/stamps[\s\S]{0,200}stamped = 1/)
  })

  it('8. 🔴 the duplicate gate fires on an UNMARKED second filing and not on an archive pair', () => {
    const run = (body: string) => {
      const f = join(tmpdir(), `dup-${Math.random().toString(36).slice(2)}.md`)
      writeFileSync(f, body)
      try {
        return execFileSync('bash',
          ['-c', `. ${JSON.stringify(join(ROOT, LIB))}; duplicate_filing_ids ${JSON.stringify(f)}`],
          { encoding: 'utf8', cwd: ROOT }).split('\n').filter(Boolean).map(l => l.split('\t')[0])
      } finally { unlinkSync(f) }
    }
    const H = (extra: string) => `### 🔲 \`THING-01\`${extra}\n\nbody\n`

    // The incident shape: the same id filed twice, both open, neither marked.
    expect(run(H(' — first filing') + H(' — second filing')),
      'two live headings, no archive marker').toEqual(['THING-01'])

    // The convention: a live heading beside the archived original. 43 of these exist.
    expect(run(H(' — live status') + H(' — the original filing, for the record')),
      'an archive pair is legitimate and must stay silent').toEqual([])

    // Both resolved. Nothing misleading, so nothing to say.
    expect(run(H(' — ✅ SHIPPED') + H(' — ✅ SHIPPED, a second filing')),
      'both stamped').toEqual([])

    // One heading only.
    expect(run(H(' — the only filing')), 'a single heading is never a duplicate').toEqual([])

    // 🔴 The shape the ITEM asked for, which is NOT this gate: a stamped heading beside an
    // open one, with no archive marker. It is still a duplicate by this rule, and should be —
    // that is the half-closed state the incident ended in.
    expect(run(H(' — ✅ SHIPPED') + H(' — second filing, still open')),
      'half-closed is a duplicate too').toEqual(['THING-01'])
  })
})
