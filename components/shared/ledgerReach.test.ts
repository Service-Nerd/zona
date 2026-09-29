import { describe, it, expect } from 'vitest'
import { dashboardSource } from '@/lib/testing/dashboardSources'
import { readFileSync } from 'node:fs'
import { computeLedger } from '@/lib/coaching/disciplineLedger'

// LEDGER-REACH-01 (2026-09-29) — a FREE feature must be reachable by a FREE user.
//
// 🔴 THE DEFECT THIS HOLDS SHUT, and it was live for FOUR MONTHS. `computeLedger` has an
// explicit FREE branch — ≥75% of planned sessions complete, no Heavy/Wrecked, no skipped
// quality, and crucially NO HR REQUIRED — and its only render site was inside
// `{screen === 'coach' && (hasPaidAccess ? … : <upgrade>)}`. So the free branch computed a
// real answer, `/api/discipline-ledger` served it on every tier, and no free runner could
// ever see it. CLAUDE.md: "Gate richness, never access."
//
// ⚠️ NOTHING CAUGHT IT BECAUSE NOTHING CONNECTS A FEATURE'S TIER TAG TO THE GATE OF THE
// SCREEN IT RENDERS ON. The placement decision (`353cbbad`) and the tier gate live ~8,000
// lines apart in the same file, and the move's own commit message says "No change to data
// or computation" — true, and precisely the blind spot: it was a change to REACH.
// New catalogue class in `/zona-debug`: **A RELOCATION ACROSS A GATE.**

// 🔴 DASHBOARD-SCREEN-EXTRACT-03 — `LedgerCard` and `MeScreen` both left the hub, so a
// single-file read here would have gone vacuously green on the very guard written to
// prove the ledger is reachable. Population from the single owner.
const SRC = () => dashboardSource()

/** The Me index render — everything after the last `activeSection` early return. */
const ME_INDEX = () => {
  const src = SRC()
  const start = src.indexOf('function MeScreen({')
  expect(start, 'MeScreen moved — re-anchor this gate').toBeGreaterThan(-1)
  const fn = src.slice(start)
  const body = fn.slice(0, fn.search(/\nfunction [A-Z]/))
  const at = body.indexOf('const hasPlan = !!(plan?.meta?.race_name)')
  expect(at, 'the index anchor moved').toBeGreaterThan(-1)
  return body.slice(at)
}

describe('LEDGER-REACH-01 — the free branch has a render path', () => {
  // 🔴 THE ARM THAT IS THE WHOLE POINT. Two facts together prove free reach: the card
  // renders on Me, and Me is not paid-gated. Either alone proves nothing.
  it('the ledger renders on the Me index, UNGATED', () => {
    const idx = ME_INDEX()
    const at = idx.search(/<LedgerCard\b/)
    expect(at, 'LedgerCard is not on the Me index — the free branch is unreachable again')
      .toBeGreaterThan(-1)

    // 🔴 THIS SECOND HALF IS THE ARM. The first version asserted only that the card
    // APPEARS, and falsification proved it hollow: wrapping the render site in
    // `{hasPaidAccess && <LedgerCard surface="me" />}` — THE EXACT ORIGINAL DEFECT —
    // left it green. "Present" and "reachable by a free user" are different claims, and
    // only the second one is what four months of this bug was about.
    //
    // Bound the enclosing JSX expression rather than grepping the region: the Me index
    // legitimately mentions `hasPaidAccess` elsewhere (the Plan adjustments door is
    // paid-gated by design), so a region-wide grep would fire on correct code.
    const open = idx.lastIndexOf('{', at)
    const enclosing = open === -1 ? '' : idx.slice(open, at)
    expect(enclosing, 'the ledger was re-gated on payment — that is the original defect')
      .not.toMatch(/hasPaidAccess|tier\s*[!=]==?\s*'free'|isPaid/)
  })

  it('and the Me screen is not gated on payment', () => {
    const src = SRC()
    const at = src.indexOf("{screen === 'me'")
    expect(at, "the Me route moved — re-anchor this gate").toBeGreaterThan(-1)
    // The route line itself must not branch on paid access the way Coach does.
    const route = src.slice(at, at + 120)
    expect(route, 'Me became paid-gated, which re-strands the free ledger')
      .not.toMatch(/hasPaidAccess\s*\n?\s*\?/)
  })

  // ⚠️ AND THE CONTRAST THAT MAKES THE ARM ABOVE MEAN SOMETHING. If Coach were not gated,
  // the first two arms would pass for the wrong reason and this file would be decorative.
  it('Coach IS paid-gated — the contrast the defect rested on', () => {
    const src = SRC()
    const at = src.indexOf("{screen === 'coach'")
    expect(at).toBeGreaterThan(-1)
    expect(src.slice(at, at + 120)).toMatch(/hasPaidAccess/)
  })

  // ⚠️ THE FREE BRANCH IS REAL AND NEEDS NO HR. Proved against the pure function, because
  // the rendered card sits behind auth and cannot be reached from here.
  it('a free runner with no HR data can still advance the counter', () => {
    const weeks = Array.from({ length: 2 }, (_, i) => ({ n: i + 1, sessions: [
      { day: 'Mon', type: 'easy' }, { day: 'Wed', type: 'easy' }, { day: 'Sat', type: 'easy' },
    ] }))
    const completions = weeks.flatMap(w => w.sessions.map(s => ({
      week_n: w.n, session_day: s.day, status: 'complete', fatigue_tag: 'Fine',
    })))
    const out = computeLedger({
      plan: { weeks, meta: {} } as never,
      completions,
      analyses: [],                    // ← no HR at all
      tier: 'free',
      asOfDate: new Date('2026-09-29T00:00:00Z'),
    })
    expect(out.weeksWithinLines, 'the free branch cannot advance without HR — that would make it a paid feature')
      .toBeGreaterThan(0)
  })
})

describe('LEDGER-REACH-01 — two surfaces, one owner, and they are distinguishable', () => {
  // 🔴 WITHOUT THIS THE FIX MAKES THE DATA WORSE. `OPS-ARTIFACT-PLACEMENT-01` is a parked
  // SLT decision blocked on WHERE the artifact gets seen. A second render site that fires
  // the same undifferentiated event destroys the only signal that decision needs.
  it('ledger_view is fired in exactly one place', () => {
    const n = (SRC().match(/useTrackOnce\('ledger_view'/g) ?? []).length
    expect(n, `ledger_view fired from ${n} places — two copies of a ref-guarded effect drift`).toBe(1)
  })

  it('and it carries the surface it was seen on', () => {
    const src = SRC()
    const at = src.indexOf("useTrackOnce('ledger_view'")
    expect(src.slice(at, at + 140)).toContain('{ surface }')
  })

  // ⚠️ REQUIRED, NOT DEFAULTED. A default is how the second caller ships mislabelled.
  it('surface is a required prop on LedgerCard', () => {
    const src = SRC()
    const at = src.indexOf('function LedgerCard(')
    expect(at).toBeGreaterThan(-1)
    // Bound the signature properly: from `function LedgerCard(` to the end of its
    // destructured type, not a guessed brace. A guessed region is how a check reads the
    // wrong text and reports on a smaller world.
    const sig = src.slice(at, src.indexOf(') {', at) + 3)
    expect(sig, 'surface must be required').toMatch(/surface:\s*'me'\s*\|\s*'coach'/)
    expect(sig, 'surface must not have a default').not.toMatch(/surface\s*=/)
  })

  it('both render sites declare a surface', () => {
    const re = /<LedgerCard\b[^/>]*/g
    const sites: string[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(SRC())) !== null) sites.push(m[0])
    expect(sites.length, 'expected two render sites').toBe(2)
    for (const s of sites) expect(s, `a LedgerCard render site has no surface: ${s}`).toMatch(/surface=/)
    expect(sites.join(' ')).toContain('surface="me"')
    expect(sites.join(' ')).toContain('surface="coach"')
  })
})
