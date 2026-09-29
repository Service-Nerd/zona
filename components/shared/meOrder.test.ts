import { describe, it, expect } from 'vitest'
// 🔴 DASHBOARD-SCREEN-EXTRACT-03 — the subject of this guard moved into
// `components/dashboard/`. A single-file read is a vacuous green after a move: no hits,
// because the code left. Population from the single owner, which throws on an empty set.
import { dashboardSource } from '@/lib/testing/dashboardSources'
import { readFileSync } from 'node:fs'
import {
  ME_SECTION_ORDER, MIN_ITEMS_PER_HEADING,
  CONNECTIONS_TITLE, connectionsSubtitle,
} from './meDoors'

// ME-ORDER-01 (Design Board, 2026-09-28) — the Me index's order and categories.
//
// 🔴 WHY A GATE ON ORDER AT ALL. Section membership on this screen is POSITIONAL: a card
// belongs to the last `SectionLabel` above it. So a heading removed, or a card inserted,
// silently re-parents everything after it — and nothing renders differently enough to
// notice. It has now happened TWICE in one day:
//
//   • `Plan adjustments` inherited `Connections` when its duplicate title was removed.
//   • `Preferences` + `Connections`, built deliberately as an UNLABELLED pair, rendered
//     as part of `Your training`. That was my design call and the render disproved it.
//
// ⚠️ Both passed tsc and the full suite. Positional structure has no type.

const SRC = () => dashboardSource()

/** The index render only — everything after the last `activeSection` early return. */
const INDEX = () => {
  const src = SRC()
  const start = src.indexOf('function MeScreen({')
  expect(start, 'MeScreen moved — re-anchor this gate').toBeGreaterThan(-1)
  const fn = src.slice(start)
  const end = fn.search(/\nfunction [A-Z]/)
  expect(end).toBeGreaterThan(-1)
  const body = fn.slice(0, end)
  const at = body.indexOf('const hasPlan = !!(plan?.meta?.race_name)')
  expect(at, 'the index anchor moved').toBeGreaterThan(-1)
  // Strip comments: this file's comments quote headings and would be counted as headings.
  return body.slice(at)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')
}

const LABEL_RE = /<SectionLabel>([^<]+)<\/SectionLabel>/g
const allLabels = (idx: string) => {
  const out: { name: string; at: number }[] = []
  const re = new RegExp(LABEL_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(idx)) !== null) out.push({ name: m[1], at: m.index })
  return out
}
const headings = (idx: string) => allLabels(idx).map(l => l.name)

describe('ME-ORDER-01 — the index order is the constant', () => {
  it('renders exactly the declared sections, in the declared order', () => {
    expect(headings(INDEX())).toEqual(ME_SECTION_ORDER)
  })

  // 🔴 THE ARM FOR THE DEFECT THAT HAPPENED TWICE. A heading governs everything between it
  // and the next one, so an item's section is decided by where it SITS.
  it('Plan adjustments sits under Your training, not Connections', () => {
    const idx = INDEX()
    const training = idx.indexOf('<SectionLabel>Your training</SectionLabel>')
    const setup    = idx.indexOf('<SectionLabel>Setup</SectionLabel>')
    const adj      = idx.indexOf('PLAN_ADJUSTMENTS_TITLE')
    expect(training).toBeGreaterThan(-1)
    expect(setup).toBeGreaterThan(-1)
    expect(adj, 'the Plan adjustments door is missing').toBeGreaterThan(-1)
    expect(adj, 'Plan adjustments fell out of Your training').toBeGreaterThan(training)
    expect(adj, 'Plan adjustments drifted past Setup').toBeLessThan(setup)
  })

  it('both Setup doors are under Setup', () => {
    const idx = INDEX()
    const setup = idx.indexOf('<SectionLabel>Setup</SectionLabel>')
    const subs  = idx.indexOf('<SectionLabel>Subscription</SectionLabel>')
    for (const door of ['PREFERENCES_TITLE', 'CONNECTIONS_TITLE']) {
      const at = idx.indexOf(door)
      expect(at, `${door} is missing from the index`).toBeGreaterThan(-1)
      expect(at, `${door} is not under Setup`).toBeGreaterThan(setup)
      expect(at, `${door} drifted past Subscription`).toBeLessThan(subs)
    }
  })

  // ⚠️ "A heading that governs one row is not a heading" (Collins) — a category pretending
  // to be content. `Account` was a heading over one read-only email row.
  it('no heading governs fewer than two items', () => {
    const idx = INDEX()
    const marks = allLabels(idx)
    const thin: string[] = []
    for (let i = 0; i < marks.length; i++) {
      const from = marks[i].at + marks[i].name.length
      const to = i + 1 < marks.length ? marks[i + 1].at : idx.length
      const body = idx.slice(from, to)
      // An "item" is a tappable row or a rendered card, not a <div>.
      // ⚠️ BOTH CASES. The first version counted `<button` only and reported `Careful Now`
      // as holding ONE item, because Sign out and Delete account are `<Button>` — the
      // design-system component. **The predicate was right and the population was short**,
      // in a check written minutes earlier. Same class as every other one in this repo.
      const items =
        (body.match(/<ActionRow\b/g) ?? []).length +
        (body.match(/<[Bb]utton\b/g) ?? []).length +
        (body.match(/<(MePlanCard|RedeemCodeLink|AppleHealthConnectionRow|StravaConnectionRow|ExternalLink)\b/g) ?? []).length
      if (items < MIN_ITEMS_PER_HEADING) thin.push(`${marks[i].name}: ${items} item(s)`)
    }
    expect(thin, 'a heading governing one item is a category pretending to be content:\n' + thin.join('\n')).toEqual([])
  })

  // 🔴 ME-BENCHMARK-DUP-01 (founder, 2026-09-29): *"it appears twice in the me screen as
  // Benchmark and Race benchmark."* Two rows, one destination. Nothing was wrong on either
  // row and nothing rendered oddly - a duplicate door is invisible unless you count.
  //
  // ⚠️ COUNTED ON THE INDEX, NOT ON THE FILE. `onOpenBenchmark` also appears in the props
  // list and the prop type, so a file-wide count is 3 when the screen is correct and 4 when
  // it is not, which is exactly the kind of number nobody notices moving.
  it('exactly one index entry routes to the benchmark screen', () => {
    const hits = (INDEX().match(/onOpenBenchmark/g) ?? []).length
    expect(hits,
      'the benchmark screen has more than one door on Me. The `Benchmark` status row in ' +
      '"What Kit knows about you" is the entry: it carries the age and the staleness ' +
      'warning, which a plain door cannot (ZONES-SURFACE-01).').toBe(1)
  })

  it('and it is the status row that carries it, not a bare door', () => {
    // If the surviving entry ever became a plain `ActionRow`, the count above would still
    // be 1 and the staleness signal would be gone. The row's value and its amber warning
    // are the reason this one won.
    const idx = INDEX()
    const at = idx.indexOf('onOpenBenchmark')
    expect(at, 'the benchmark entry left the index').toBeGreaterThan(-1)
    // Walk back to the `row(` call that owns it - the status-row helper, not a door.
    const region = idx.slice(Math.max(0, at - 700), at)
    expect(region, 'the benchmark entry is no longer a status row').toContain("'Benchmark',")
    expect(region, 'the staleness warning went with it').toContain('Re-benchmark when you can')
  })

  it('the identity region carries no heading', () => {
    const idx = INDEX()
    const firstLabel = idx.indexOf('<SectionLabel>')
    const identity = idx.indexOf('<IdentityCard')
    const email = idx.indexOf('{profileEmail}')
    expect(identity).toBeGreaterThan(-1)
    expect(email, 'the email row is missing').toBeGreaterThan(-1)
    expect(identity, 'the identity card fell below a heading').toBeLessThan(firstLabel)
    expect(email, 'the email row was re-parented under a heading').toBeLessThan(firstLabel)
  })
})

describe('ME-ORDER-01 — the Connections subtitle carries state, and never lies', () => {
  // 🔴 THE ARM THAT MATTERS. `healthkitConnectedAt` was `string | null` initialised to
  // null and only ever SET when truthy, so "not connected" and "not loaded" were the same
  // value. A subtitle asserting "No sources connected" would flash a FALSE NEGATIVE on
  // every open. Unknown must say nothing.
  it('says NOTHING while the profile is still loading', () => {
    expect(connectionsSubtitle(undefined, false)).toBeNull()
    expect(connectionsSubtitle(undefined, true)).toBeNull()
  })

  it('names what is connected', () => {
    expect(connectionsSubtitle('2026-09-01T00:00:00Z', false)).toBe('Apple Health connected')
    expect(connectionsSubtitle(null, true)).toBe('Strava connected')
    expect(connectionsSubtitle('2026-09-01T00:00:00Z', true)).toBe('Apple Health and Strava')
  })

  it('states the consequence when nothing is connected, and does not judge', () => {
    const s = connectionsSubtitle(null, false)
    expect(s).toBe('Not connected, so runs are added by hand')
    expect(s).not.toMatch(/should|need to|must|why not|missing/i)
  })

  it('no em dash in any subtitle (noEmDashApp covers literals, not returns)', () => {
    for (const v of [
      connectionsSubtitle('x', false), connectionsSubtitle(null, true),
      connectionsSubtitle('x', true), connectionsSubtitle(null, false),
    ]) expect(v ?? '').not.toContain('—')
  })

  it('the row reaches the real function, not a literal', () => {
    const idx = INDEX()
    expect(idx, 'the subtitle was hardcoded instead of computed')
      .toContain('subtitle={connectionsSubtitle(healthkitConnectedAt, !!stravaConnected)}')
    expect(idx).toContain('title={CONNECTIONS_TITLE}')
    expect(CONNECTIONS_TITLE).toBe('Connections')
  })
})

describe('ME-ORDER-01 — what pointed at the old locations', () => {
  // §5b.3 — `onConnect` had TWO callers (Coach empty state and ZoneRings), both landing
  // on the Me index where the rows used to be.
  it('onConnect opens the Connections door', () => {
    const src = SRC()
    const at = src.indexOf('onConnect={() =>')
    expect(at, 'onConnect moved — re-anchor this gate').toBeGreaterThan(-1)
    expect(src.slice(at, at + 160)).toContain("setMeOpenSection('connections')")
  })

  // §5b.4 — a door makes the word "below" false. This is the THIRD instance; the first
  // two were the HR nudge and the Apple Health error.
  it('no runner-facing string points "below" at something behind a door', () => {
    const src = SRC()
    const bad = src.split('\n')
      .map((l, i) => [i + 1, l] as const)
      .filter(([, l]) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .filter(([, l]) => /'[^']*\b(RHR|Max HR|Connections)\b[^']*\bbelow\b[^']*'/.test(l))
      .map(([n, l]) => `${n}: ${l.trim().slice(0, 90)}`)
    expect(bad, 'a door makes "below" false:\n' + bad.join('\n')).toEqual([])
  })
})
