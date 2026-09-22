// BRAND-EMDASH-APP-01 — the em-dash rule, in the app.
//
// The rule is `brand.md`'s and it is SITE-WIDE; the existing guard
// (`noEmDash.test.ts`) only covered marketing surfaces, and `CLAUDE.md` asserted
// an "app-side exception" that does not exist in that section. The founder
// settled the scope on 2026-09-22:
//
//   "no EMDASH in test or spoken word. In descriptions for sessions it's ok.
//    I just don't want it in sentences."
//
// So this guards SENTENCES the runner reads or hears, and nothing else.
//
// ⚠️ THE RAW COUNT WAS 544 AND QUOTING IT WOULD HAVE BEEN MISLEADING. Most of it
// is invariant messages, AI prompt text and dev logging, none of which a runner
// ever sees. The runner-facing subset was **48 sentences across 13 files**, plus
// 27 bare `—` placeholders which are typography, not prose. Measure the subset
// that matters before reporting a number.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const EM = '—'

/** Runner-facing by construction. Guarded WHOLESALE rather than by a file list:
 *  a hand-maintained list of guarded files is blind to the file nobody added to
 *  it, which this repo has recorded as a class of its own. */
const SURFACES = ['components', 'app/dashboard']

/** Not a sentence the runner reads, so out of scope by the founder's own words.
 *  Each entry names WHY, because an exemption without a reason becomes a place
 *  to hide the next one. */
const EXEMPT = [
  { match: /^\s*—+\s*$/,          why: 'bare placeholder / divider — typography, not prose' },
  { match: /^\[[a-z-]+\]/i,            why: 'console log, prefixed [tag] — developer-facing' },
  { match: /You are a .*coach reviewing/i, why: 'AI prompt text — model input, never rendered' },
  { match: /\?\?\s*'\u2014'/,              why: "the `?? '—'` no-value fallback inside a template — typography" },
  { match: /^APNs |timed out \u2014 push/,   why: 'console log; the tag is a bare word, not a [prefix]' },
]

function files(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) files(p, out)
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

/** Comments are exempt by the rule itself, so they are blanked (not removed —
 *  blanking preserves offsets, which keeps reported line numbers honest). */
const blankComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))
   .replace(/\{\/\*[\s\S]*?\*\/\}/g, m => ' '.repeat(m.length))
   .replace(/^\s*\/\/.*$/gm, m => ' '.repeat(m.length))

const LIT = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g

function offenders(): string[] {
  const bad: string[] = []
  for (const root of SURFACES) {
    for (const f of files(join(process.cwd(), root))) {
      const raw = readFileSync(f, 'utf8')
      if (!raw.includes(EM)) continue
      const src = blankComments(raw)
      LIT.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = LIT.exec(src)) !== null) {
        const t = m[1] ?? m[2] ?? m[3] ?? ''
        if (!t.includes(EM)) continue
        if (EXEMPT.some(e => e.match.test(t.trim()))) continue
        const line = raw.slice(0, m.index).split('\n').length
        bad.push(`${f.replace(process.cwd() + '/', '')}:${line}  ${t.trim().slice(0, 70)}`)
      }
    }
  }
  return bad
}

describe('BRAND-EMDASH-APP-01 — no em dash in a sentence the runner reads', () => {
  it('scans a real corpus — an empty sweep is not a pass', () => {
    const n = SURFACES.reduce((a, r) => a + files(join(process.cwd(), r)).length, 0)
    expect(n, 'files scanned').toBeGreaterThan(50)
  })

  it('🔴 no em dash in any runner-facing string', () => {
    expect(offenders(), 'em dash in runner-facing copy — use a colon, comma, semicolon or full stop').toEqual([])
  })

  it('en dashes in RANGES are correct and must survive', () => {
    // brand.md is explicit: `6:30–7:30 /km`, `Zone 4–5`, `RPE 1–10`. A guard that
    // swept both would do more damage than the thing it prevents.
    const zones = readFileSync(join(process.cwd(), 'app/dashboard/DashboardClient.tsx'), 'utf8')
    expect(zones).toContain('–')
  })
})
