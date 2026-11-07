import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
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
const CALLERS = ['scripts/audit-docs.sh', 'scripts/backlog-open.sh'] as const
const OWNED = ['heading_open_ids', 'board_tag_bullet_ids', '_CLOSED_STAMPS', '_CLOSED_PROSE'] as const

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
        const defines = new RegExp(`(^|\\n)\\s*(${name}\\(\\)\\s*\\{|${name}=)`).test(src)
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
