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
    // 246 -> 242 on 2026-10-09 (WEEK-THEME-DEAD-01). FOUR uses went, and the
    // reason is a DELETION, not a conversion: `PlanCoachingCard` (72 lines, 0
    // render sites), `IconStrava`, `IconMore` and `Card` were removed from
    // `DashboardClient.tsx`. No size was converted to a declared one, so the
    // ratio is unchanged in spirit — the denominator shrank with the numerator.
    // Declared here because a ratchet must never move without a measurement.
    // 242 -> 214 on 2026-10-14 (ADJUST-JOURNEY-TYPE-01). TWENTY-EIGHT uses converted,
    // not deleted: the plan-adjustment journey migrated 13px -> 14px Body and
    // 11px -> MICRO_LABELS.eyebrow after the Design Board ruled 13px is NOT a
    // level. Six of the seven journey files are now fully on-scale.
    // 214 -> 213 on 2026-10-14 (FOUNDER-TYPE-18PX-01). ONE use converted, not deleted:
    // the founder-note pull-line went 18px -> 20px after the board refused 18 as a level
    // (17 -> 18 is 1.059x). The other EIGHT sites of the same headline species keep 18px
    // as declared debt; see the 18px arm below for why they were not swept.
    const UNDECLARED_USES_BASELINE = 210  // 211 → 210 measured STAGED: EMPTY-STATE-OWNER-01 moved Me → Plan history's hand-typed 16px/14px empty state onto EmptyState
    let n = 0
    for (const [size, count] of Array.from(sizes())) if (!DECLARED.has(size)) n += count
    expect(n,
      n > UNDECLARED_USES_BASELINE
        ? `undeclared-size usage grew (${n} vs ${UNDECLARED_USES_BASELINE}).`
        : `debt PAID: ${n} vs ${UNDECLARED_USES_BASELINE} — lower the baseline.`,
    ).toBe(UNDECLARED_USES_BASELINE)
  })

  it('⛔ 18px is NOT a level, and the count may only fall', () => {
    // FOUNDER-TYPE-18PX-01 (Design Board, 2026-10-14) — refused permanently on the
    // board's own arithmetic: 17 -> 18 is 1.059x, BELOW the 1.077x that killed 13px the
    // day before.
    //
    // 📐 The measurement found a role, not a stray: NINE of the twenty 18px uses are one
    // species (`--font-brand`, weight 500/600, negative tracking) across six surfaces.
    // 🎪 Collins' standing dissent that the scale is thin at the TOP is SUPPORTED by that
    // and still did not win a new level; the role is named on the 20px row instead.
    //
    // ⚠️ FIVE of the twenty are `IconButton` GLYPH sizing, which is a box dimension and
    // not type at all. They are inside this count because `sizes()` reads every
    // `fontSize`, and that is deliberate: excluding them would need the scanner to know
    // what an element IS, which it cannot. The ratchet is still correct — the number may
    // only fall — but do not read it as "20 type violations".
    //
    // 20 (2026-10-14, before) -> 19 (after the founder-note pull-line converged).
    const EIGHTEEN_BASELINE = 19
    const n = sizes().get('18') ?? 0
    expect(n,
      n > EIGHTEEN_BASELINE
        ? `18px grew (${n} vs ${EIGHTEEN_BASELINE}). It is not a level — a short declarative `
          + `headline above body copy is the 20px row at weight 700.`
        : `debt PAID: ${n} vs ${EIGHTEEN_BASELINE} — lower EIGHTEEN_BASELINE and say which site went.`,
    ).toBe(EIGHTEEN_BASELINE)

    const doc = readFileSync('docs/canonical/ui-patterns.md', 'utf8')
    expect(doc.includes('18px is NOT a level'),
      'ui-patterns.md must carry the ruling that refuses 18px, or this arm enforces nothing',
    ).toBe(true)
    // The role has to have somewhere to GO, or the ratchet is just a prohibition.
    // ⚠️ ASSERT THE ROW, NOT A SUBSTRING. The first cut was
    // `doc.includes('section headline')` and went red on the real doc purely because the
    // row is capitalised — a bare phrase matched against prose is the hollow shape
    // `hollowTestShapes.test.ts` exists to refuse, and it would also have passed on the
    // words appearing in a comment. Match the TABLE ROW, with its weight.
    expect(doc,
      'the type scale must carry a 20px/700 headline row — without it the 18px ratchet is a '
      + 'prohibition with nowhere to send the nine sites',
    ).toMatch(/\|\s*\*\*Section headline \/ pull-line\*\*\s*\|[^|]*\|\s*\*\*700\*\*\s*\|\s*20px/)
    // ...and the class that row names must actually exist, or the doc is describing nothing.
    expect(readFileSync('app/globals.css', 'utf8'),
      '.section-headline is documented but not defined',
    ).toMatch(/\.section-headline\s*\{[^}]*font-size:\s*20px[^}]*\}/)
  })

  it('🔴 13px is CONVERGING, and the count may only fall', () => {
    // 🔑 THIS ARM ASKED A QUESTION AND THE BOARD ANSWERED IT — the other way.
    // It used to read "13px is still the most-used size, and still undeclared —
    // the doc is what is wrong", and it was written to go GREEN the day the
    // Design Board ADDED 13px to the scale. On 2026-10-14 the board declined:
    // 12 -> 13 is 1.083x and 13 -> 14 is 1.077x, and Silvanto has refused that
    // step twice already. Three levels inside two pixels is not a scale, so the
    // answer is convergence, not adoption (ADJUST-JOURNEY-TYPE-01).
    //
    // ⚠️ The arm is kept, inverted, rather than deleted: an accusation that was
    // answered still needs a ratchet, or 13px simply grows back.
    // 169 (2026-10-05) -> 137 (2026-10-14). 12px is now the most-used size.
    const THIRTEEN_BASELINE = 135  // 136 → 135 measured STAGED: the Adjust sheet's 13px --warn error became the 14px --danger-strong error line (PLAN-CHANGE-FAIL-VISIBLE-01)
    const n = sizes().get('13') ?? 0
    expect(n,
      n > THIRTEEN_BASELINE
        ? `13px grew (${n} vs ${THIRTEEN_BASELINE}). It is not a level — use Body 14/400 or Card secondary 12/400.`
        : `debt PAID: ${n} vs ${THIRTEEN_BASELINE} — lower THIRTEEN_BASELINE.`,
    ).toBe(THIRTEEN_BASELINE)

    const doc = readFileSync('docs/canonical/ui-patterns.md', 'utf8')
    expect(doc.includes('13px is NOT a level'),
      'ui-patterns.md must carry the ruling that refuses 13px, or this arm is enforcing nothing',
    ).toBe(true)
  })

  it('a WEIGHT off the scale cannot grow either', () => {
    // The scale names four weights; nothing had ever checked them. Measured
    // 2026-10-14: `fontWeight: 500` x85 and one 300, none of them declared.
    // 500 is the big one and it is almost always an un-decided default rather
    // than a choice -- SectionLabel's inherited 400 was ruled "an accident, not
    // a decision" (MICRO-LABEL-DRIFT-01) and this is the same shape.
    const DECLARED_WEIGHTS = new Set([400, 600, 700, 800])
    // 86 -> 84 on 2026-10-14 (FOUNDER-TYPE-18PX-01). TWO uses converted: the founder
    // note's caption and mailto went 12/500 -> 12/400. The table declares 12px at weight
    // 400 only, and no 500 was authored at that size.
    const WEIGHT_BASELINE = 84
    let n = 0
    for (const f of FILES) {
      const re = /fontWeight:\s*'?(\d+)'?/g
      const src = strip(readFileSync(f, 'utf8'))
      let m: RegExpExecArray | null
      while ((m = re.exec(src)) !== null) if (!DECLARED_WEIGHTS.has(Number(m[1]))) n++
    }
    expect(n,
      n > WEIGHT_BASELINE
        ? `an undeclared font weight landed (${n} vs ${WEIGHT_BASELINE}). The scale names 400/600/700/800.`
        : `debt PAID: ${n} vs ${WEIGHT_BASELINE} — lower WEIGHT_BASELINE.`,
    ).toBe(WEIGHT_BASELINE)
  })

  it('a size reached through a --fs-* var is checked too', () => {
    // ⚠️ TWO PATHS IN, AND A GATE THAT READS ONE IS A HOLE WRITTEN ON PURPOSE.
    // Every arm above reads px literals. A size also arrives via `--fs-*`, the
    // MARKETING scale, which names `--fs-sm: 13px` — the exact value the board
    // just refused for the app. Measured today the app side uses only
    // --fs-body 14, --fs-caption 12 and --fs-micro 10, all on-scale.
    const css = readFileSync('app/globals.css', 'utf8')
    const tok: Record<string, number> = {}
    const tre = /--(fs-[a-z0-9-]+):\s*(\d+)px\s*;/g
    let t: RegExpExecArray | null
    while ((t = tre.exec(css)) !== null) tok[t[1]] = Number(t[2])
    expect(Object.keys(tok).length, 'the token map came back empty — the regex stopped matching').toBeGreaterThan(5)
    expect(tok['fs-sm']).toBe(13)

    const DECLARED = new Set([10, 11, 12, 14, 15, 17, 20, 26, 44, 56])
    const offenders: string[] = []
    for (const f of FILES) {
      const isAppSurface = (f.startsWith('components/') && !f.startsWith('components/marketing/'))
        || f.startsWith('app/dashboard/')
      if (!isAppSurface) continue
      const re = /fontSize:\s*'var\(--(fs-[a-z0-9-]+)\)'/g
      const src = strip(readFileSync(f, 'utf8'))
      let m: RegExpExecArray | null
      while ((m = re.exec(src)) !== null) {
        const px = tok[m[1]]
        if (px !== undefined && !DECLARED.has(px)) offenders.push(`${f}: --${m[1]} (${px}px)`)
      }
    }
    expect(offenders, offenders.length ? `an APP surface reached an undeclared size through a token:\n${offenders.join('\n')}` : 'ok').toEqual([])
  })
})
