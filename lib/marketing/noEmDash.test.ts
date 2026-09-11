// House rule, enforced: no em dashes in marketing copy.
//
// Founder call 2026-09-11, extending the rule the comparison pages already had
// ("no em dashes in copy") to the whole website. A written rule is not a rule
// in this repo — the canonical-host default, the config-principle sync and the
// deload cadence all drifted while a doc said they shouldn't. So it is a test.
//
// SCOPE: renderable copy on public marketing surfaces only.
//   - Code COMMENTS are exempt. They are not copy, and the alternative is
//     mangling the explanatory prose that makes this codebase legible.
//   - EN dashes (–, U+2013) are CORRECT and must not be caught: they carry
//     ranges the product emits everywhere ("6:30–7:30 /km", "Zone 4–5",
//     "RPE 1–10"). Only the em dash (—, U+2014) and &mdash; are banned.
//   - The APP is out of scope. Engine session labels ("Easy run — Zone 2") and
//     coach notes still use em dashes; changing those is an app-wide copy
//     change with a live coupling (catalogueRowFor's legacy fallback matches
//     row.name against session.label), so it is a separate decision.
//
// If this fails: rewrite the sentence. A colon, a comma or a full stop almost
// always reads better anyway, which is the point of the rule.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

/** Public marketing surfaces. Add a file here when a new one ships. */
const SURFACES = [
  'app/layout.tsx',
  'app/page.tsx',
  'app/plans/page.tsx',
  'app/pricing/page.tsx',
  'app/plans/[slug]/page.tsx',
  'app/comparisons/page.tsx',
  'app/runna-alternatives/page.tsx',
  'app/charity-runners/page.tsx',
  'app/support/page.tsx',
  'app/privacy/page.tsx',
  'app/terms/page.tsx',
  'components/marketing/AppStoreBadge.tsx',
  'components/marketing/ComparisonPage.tsx',
  'components/marketing/PhoneFrame.tsx',
  'components/marketing/PlanPage.tsx',
  'components/marketing/SiteFooter.tsx',
  'components/marketing/SiteHeader.tsx',
  'components/marketing/WaitlistForm.tsx',
  'lib/marketing/comparisons.ts',
  'lib/marketing/plans.ts',
  'lib/marketing/pricing.ts',
]

const EM_DASH = '—'

/** Lines that are wholly a comment. Deliberately conservative: a line that both
 *  opens and closes a block comment, a `//` line, a continuation `*` line, or a
 *  self-contained JSX `{/* ... *\/}`. Anything else counts as copy. */
function renderableLines(src: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = []
  let inBlock = false
  src.split('\n').forEach((raw, i) => {
    const s = raw.trim()
    const wasInBlock = inBlock
    const opens = (s.match(/\/\*/g) ?? []).length
    const closes = (s.match(/\*\//g) ?? []).length
    if (opens > closes) inBlock = true
    else if (closes > 0 && closes >= opens) inBlock = false

    // A line OPENING a JSX comment (`{/*`) is a comment too, whether or not it
    // closes on the same line. Missing this was the first version's bug: every
    // multi-line `{/* ... */}` block reported its opening line as copy.
    const isComment =
      wasInBlock ||
      s.startsWith('//') ||
      s.startsWith('*') ||
      s.startsWith('/*') ||
      s.startsWith('{/*')

    if (!isComment) out.push({ line: i + 1, text: raw })
  })
  return out
}

describe('marketing copy contains no em dashes', () => {
  for (const rel of SURFACES) {
    it(rel, () => {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      const offenders = renderableLines(src)
        .filter(l => l.text.includes(EM_DASH) || l.text.includes('&mdash;'))
        .map(l => `  ${rel}:${l.line}  ${l.text.trim().slice(0, 120)}`)

      expect(
        offenders,
        `Em dash in marketing copy. Rewrite with a colon, comma or full stop:\n${offenders.join('\n')}`,
      ).toEqual([])
    })
  }

  // Guards the guard. If renderableLines() ever stops seeing copy — the exact
  // way three checks in this repo were silently dead on first write — every
  // file above passes vacuously and the rule quietly stops existing.
  it('detects an em dash in copy but ignores comments and en dashes', () => {
    const sample = [
      '// a comment — with an em dash, must be ignored',
      '/* block — also ignored */',
      '{/* jsx — ignored */}',
      'const range = "6:30–7:30 /km"   // en dash in a range, must be allowed',
      'const copy = "this is — copy"',
    ].join('\n')

    const hits = renderableLines(sample).filter(
      l => l.text.includes(EM_DASH) || l.text.includes('&mdash;'),
    )
    expect(hits).toHaveLength(1)
    expect(hits[0].text).toContain('this is')
  })
})
