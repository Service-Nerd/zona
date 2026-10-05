// TYPESCALE-APP-GATE-01 (2026-10-05) — the APP's type scale, which nothing held.
//
// 🔴 WHY THIS EXISTS. `lib/marketing/typeScale.test.ts` is `describe('marketing
// type scale')` over a `SURFACES` list of marketing pages. `ui-patterns.md`
// § Typography Scale governs the APP too, and nothing held that half. Found by
// `UI-PATTERNS-ENFORCEMENT-01`'s measurement; the website precedent is why it
// matters — that audit found NO type scale at all, 170 hand-typed sizes and an
// H1:H2 step of 1.02x, neither visible by looking.
//
// 📐 MEASURED FIRST, and the headline is not what the item expected:
//   649 inline `fontSize` uses across 123 app files, 22 distinct sizes.
//   The doc declares TEN: 10 11 12 14 15 17 20 26 44 56.
//   So TWELVE sizes are undeclared — 246 uses, **37.9% of all app type**.
//
// 🔴 AND THE BIGGEST IS THE DOC'S FAULT, NOT THE CODE'S: **13px has 169 uses,
// the single most-used size in the app, and it is not in the scale.** A scale
// that omits the most common size in the product is not being violated by the
// code; it is failing to describe it. That is a doctrine fix, not a sweep, and
// it is deliberately NOT made here — changing the published scale is the Design
// Board's, and this gate's job is to stop the set growing while that is decided.
//
// ⚠️ THE MARKETING APPROACH DOES NOT TRANSFER, which the item predicted. That
// gate asserts every size is a `--fs-*` token in `globals.css`. The app is
// inline-style-heavy and uses raw px, so an identical check would fail 649 times
// on day one and be deleted rather than satisfied.
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// ⚠️ `Array.from(...)`, never a spread. `CLAUDE.md` § TypeScript records that a
// spread over a Set/Map/iterator fails this project's target, and tsc caught it
// here on the first run of this file.

// Marketing has its own gate; preview harnesses are not product surfaces.
const FILES = execSync("git ls-files 'app/**/*.tsx' 'components/**/*.tsx'", { encoding: 'utf8' })
  .trim().split('\n')
  .filter(f => f && !f.includes('.test.') && !f.startsWith('components/marketing/') && !f.includes('-preview/'))

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

function sizes() {
  const counts = new Map<string, number>()
  for (const f of FILES) {
    for (const m of Array.from(strip(readFileSync(f, 'utf8')).matchAll(/fontSize:\s*'(\d+)px'/g))) {
      counts.set(m[1], (counts.get(m[1]) ?? 0) + 1)
    }
  }
  return counts
}

describe('TYPESCALE-APP-GATE-01 — the app type scale is a closed set', () => {
  it('the population is real', () => {
    // A gate over nothing is not a gate — the marketing sibling's own first arm.
    expect(FILES.length, 'the git glob stopped matching app surfaces').toBeGreaterThan(80)
  })

  // ⚠️ A FALLING REGISTER OF DISTINCT SIZES, not a per-call-site sweep. 649 uses
  // is its own project; what matters is that the SET cannot grow, so the next
  // screen reaches for a size that already exists instead of inventing a 23rd.
  it('🔴 no NEW font size enters the app', () => {
    const DISTINCT_BASELINE = 22
    const n = sizes().size
    expect(n,
      n > DISTINCT_BASELINE
        ? `a NEW font size landed (${n} distinct vs ${DISTINCT_BASELINE}). Use one of the sizes already in the scale.`
        : `debt PAID: ${n} vs ${DISTINCT_BASELINE} — lower DISTINCT_BASELINE and say which size went.`,
    ).toBe(DISTINCT_BASELINE)
  })

  it('undeclared usage does not grow', () => {
    // 🔴 THE DOC DECLARES TEN SIZES AND THE APP USES TWENTY-TWO. This arm holds
    // the gap where it is rather than pretending it is zero — the debt-register
    // pattern, because a gate demanding 0 here would be deleted on day one.
    const DECLARED = new Set(['10', '11', '12', '14', '15', '17', '20', '26', '44', '56'])
    const UNDECLARED_USES_BASELINE = 246
    let n = 0
    for (const [size, count] of Array.from(sizes())) if (!DECLARED.has(size)) n += count
    expect(n,
      n > UNDECLARED_USES_BASELINE
        ? `undeclared-size usage grew (${n} vs ${UNDECLARED_USES_BASELINE}).`
        : `debt PAID: ${n} vs ${UNDECLARED_USES_BASELINE} — lower the baseline.`,
    ).toBe(UNDECLARED_USES_BASELINE)
  })

  it('🔴 13px is still the most-used size, and still undeclared — the doc is what is wrong', () => {
    // This arm is a STANDING ACCUSATION AGAINST THE DOCUMENT, not the code, and
    // it is here so the finding cannot be quietly forgotten: a scale that omits
    // the product's most common size is failing to describe it.
    // It goes GREEN the day the Design Board adds 13px to § Typography Scale —
    // which is the outcome this is asking for, not a regression.
    const counts = sizes()
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]
    expect(top[0], 'the most-used size changed — re-measure before trusting the baselines above').toBe('13')
    const doc = readFileSync('docs/canonical/ui-patterns.md', 'utf8')
    const i = doc.indexOf('## Typography Scale')
    const sec = doc.slice(i, doc.indexOf('\n## ', i + 5))
    const declared = new Set(Array.from(sec.matchAll(/\|\s*(\d+)px/g)).map(m => m[1]))
    expect(declared.has('13'),
      '✅ 13px is now DECLARED — delete this arm, it has done its job.').toBe(false)
  })
})
