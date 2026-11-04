import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { RUN_ANALYSIS_CARD_FIELDS, RUN_ANALYSIS_CARD_COLUMNS, numericField } from './runAnalysisColumns'
import { compareLoad } from './loadComparison'
import { formatDistance } from '@/lib/format'
import { TABLE_COLUMNS } from '@/lib/contracts/tableColumns'

/**
 * RUN-ANALYSIS-SELECT-01 — the card read 12 fields, the SELECT fetched 9, and the 3
 * missing ones were the only inputs `compareLoad` has. Measured on 100 live rows:
 * 87 comparable in the table, 0 on the screen.
 *
 * 🔑 BOTH SIDES ARE DERIVED FROM SOURCE. A hand-written list of "fields the card
 * needs" would be a fourth copy of the thing that broke.
 */
const CLIENT = join(process.cwd(), 'app/dashboard/DashboardClient.tsx')
const src = readFileSync(CLIENT, 'utf8')

/** The body of `buildScoreExplanations`, bounded on its own signature. */
function cardBody(): string {
  const i = src.indexOf('function buildScoreExplanations(')
  expect(i, 'buildScoreExplanations not found — this gate is pointed at nothing').toBeGreaterThan(-1)
  const j = src.indexOf('\n}', i)
  return src.slice(i, j)
}

/** Every `analysis.<field>` the card reads, minus anything inside a comment. */
function fieldsTheCardReads(): string[] {
  const body = cardBody()
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
  // ⚠️ exec loop, NOT `matchAll`, and NOT a Set spread. This tsconfig does not set
  // `downlevelIteration`, so both are TS2802 — `hollowTestShapes.test.ts` carries that
  // warning in a comment and admits to writing `matchAll` anyway. So did I.
  const seen: Record<string, true> = {}
  const re = /analysis\.([a-z_0-9]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) seen[m[1]!] = true
  return Object.keys(seen).sort()
}

describe('RUN-ANALYSIS-SELECT-01 — the card cannot read a field the query never fetched', () => {
  it('every field the card reads is in the shared column list', () => {
    const reads = fieldsTheCardReads()
    expect(reads.length, 'parsed no fields — the extractor has stopped matching').toBeGreaterThan(8)
    const fetched = new Set<string>(RUN_ANALYSIS_CARD_FIELDS)
    expect(reads.filter(f => !fetched.has(f))).toEqual([])
  })

  it('no read of run_analysis that feeds the card types its own column list', () => {
    // The population is DERIVED from the file, not hand-picked — three card selects
    // existed and all three were wrong, in three different ways.
    //
    // ⚠️ IT IS NOT "every run_analysis select". The first cut of this arm was, and it
    // flagged the ceiling-history query at :2258 (`… session_type, hr_above_ceiling_pct,
    // superseded_at`), which correctly fetches six columns because it answers "how many
    // of your last five easy runs went over?" and never touches the card. Forcing it onto
    // the card's 22 columns would be a worse query for no reason. A check that cannot
    // tell those apart is the "population excludes/includes the wrong cases" class.
    //
    // The discriminator is `total_score`: it is the card's own headline number (85/100
    // in the screenshot) and no other consumer asks for it.
    const args: string[] = []
    const re = /\.from\(['"]run_analysis['"]\)\s*\n?\s*\.select\(([^)]*)\)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src)) !== null) args.push(m[1]!.trim())
    expect(args.length, 'found no run_analysis selects — the pattern has drifted').toBeGreaterThan(2)
    //
    // ⚠️ AND THE DISCRIMINATOR MUST COVER BOTH FORMS. Keying it on the literal
    // `total_score` worked against the BROKEN file and found zero once the selects
    // moved onto the constant — an arm that passes because it is looking at nothing.
    // The floor below is what caught that, and it stays.
    const onConstant = args.filter(a => a.includes('RUN_ANALYSIS_CARD_COLUMNS'))
    const handTypedCard = args.filter(a => (a.startsWith("'") || a.startsWith('"')) && a.includes('total_score'))
    expect(onConstant.length, 'no card select uses the shared list — this arm is pointed at nothing').toBeGreaterThan(0)
    expect(handTypedCard, 'a card select is typing its own columns again').toEqual([])
  })

  it('every column in the list is a real column', () => {
    const real = new Set(TABLE_COLUMNS.run_analysis)
    expect(RUN_ANALYSIS_CARD_FIELDS.filter(f => !real.has(f))).toEqual([])
  })

  it('the list is a valid PostgREST select string', () => {
    expect(RUN_ANALYSIS_CARD_COLUMNS).not.toMatch(/,,|^\s|\s$/)
    expect(RUN_ANALYSIS_CARD_COLUMNS.split(', ').length).toBe(RUN_ANALYSIS_CARD_FIELDS.length)
  })
})

/**
 * The behavioural half. The arms above prove the columns are FETCHED; these prove
 * that fetching them is what makes the line appear — which is the runner's symptom.
 */
describe('RUN-ANALYSIS-SELECT-01 — Duncan, week 7 Tuesday, from the live rows', () => {
  const ROW = { plannedKm: 7.00, actualKm: 6.71, plannedMins: 43, actualMins: 42.92 }

  it('with the columns fetched, the card speaks', () => {
    expect(compareLoad(ROW, 'distance').axis).toBe('distance')
    expect(compareLoad(ROW, 'duration').axis).toBe('duration')
  })

  it('with the three omitted, it says "No distance data." — the defect, pinned', () => {
    const asTheSelectDelivered = { plannedKm: undefined, actualKm: 6.71, plannedMins: undefined, actualMins: undefined }
    expect(compareLoad(asTheSelectDelivered, 'distance')).toEqual({ axis: 'none', onTarget: false, short: null })
  })

  it('"Short." was unreachable too, not just the numbers', () => {
    // 6.71 vs 7.00 is inside the 0.3 km band, so this runner is not short — and before
    // the fix the verdict could not be computed AT ALL, on any row, for anyone.
    expect(compareLoad(ROW, 'distance').short).toBe(false)
    // Short on BOTH axes — the only shape that may assert it.
    expect(compareLoad({ plannedKm: 7, actualKm: 6.0, plannedMins: 43, actualMins: 38 }, 'distance').short).toBe(true)
    // ⚠️ AND THE THIRD STATE IS REAL, which my own first expectation got wrong: short on
    // distance (6.0 of 7.0) but on time (42.92 of 43) they held the clock. The axes
    // contradict, so §66 withholds the word rather than picking one. That is
    // `compareLoad`'s documented design, not a gap — and it was equally unreachable.
    expect(compareLoad({ ...ROW, actualKm: 6.0 }, 'distance').short).toBeNull()
  })
})

/**
 * 🔴 THE HALF THAT WOULD HAVE SHIPPED A WORSE BUG. `planned_load_km` and its siblings are
 * `numeric`, so PostgREST returns them QUOTED — the live rows read `"7.00"`. `compareLoad`
 * coerces happily on `-` and `>`, so every arm above passes on strings; `formatDistance`
 * does not, and the card would have read "Planned null, ran null."
 */
describe('RUN-ANALYSIS-SELECT-01 — the row arrives as strings', () => {
  it('formatDistance REJECTS the raw string — this is the trap, pinned', () => {
    expect(formatDistance('6.71' as unknown as number, 'km', { exact: true })).toBeNull()
  })

  it('numericField converts it, so the card can format it', () => {
    expect(numericField('6.71')).toBe(6.71)
    expect(formatDistance(numericField('6.71')!, 'km', { exact: true })).toBe('6.7km')
    expect(formatDistance(numericField('6.71')!, 'mi', { exact: true })).toBe('4.2mi')  // the screenshot
  })

  it('compareLoad agrees on strings and numbers — which is WHY the trap is invisible', () => {
    const asStrings  = { plannedKm: '7.00', actualKm: '6.71', plannedMins: '43', actualMins: '42.92' }
    const asNumbers  = { plannedKm: 7, actualKm: 6.71, plannedMins: 43, actualMins: 42.92 }
    expect(compareLoad(asStrings as never, 'distance')).toEqual(compareLoad(asNumbers, 'distance'))
  })

  it('absence and nonsense become null, never 0 — a stored 0 means UNMEASURED', () => {
    for (const v of [null, undefined, '', 'n/a', NaN]) expect(numericField(v as never)).toBeNull()
    expect(numericField(0)).toBe(0)   // a real measured zero still passes through
  })

  it('the card converts rather than casts', () => {
    const body = cardBody()
    expect(body).toMatch(/numericField\(analysis\.planned_load_km\)/)
    expect(body).toMatch(/numericField\(analysis\.actual_load_km\)/)
    expect(body).not.toMatch(/analysis\.(planned|actual)_load_(km|mins) as number/)
  })
})
