import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { RUN_ANALYSIS_CARD_FIELDS, RUN_ANALYSIS_CARD_COLUMNS } from './runAnalysisColumns'
import { compareLoad } from './loadComparison'
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

/**
 * EVERY consumer of the row, not just one.
 *
 * ⚠️ The first cut parsed `buildScoreExplanations` alone, and `RunFeedbackCard` reads
 * seven more `analysis.*` fields directly in its own body — all fetched today, so no live
 * defect, but a new unfetched read there would have passed this gate green. Found by code
 * review. The list is a CONSTANT so adding a third consumer is a deliberate act.
 */
const CONSUMERS = ['function buildScoreExplanations(', 'export function RunFeedbackCard('] as const

/**
 * Brace-matched, NOT bounded on the next `\n}`.
 *
 * ⚠️ The `\n}` boundary captured **214 characters and zero fields** for
 * `RunFeedbackCard`, because a React component's props destructure closes with `}` at
 * column 0 long before the function does. So the "widened" gate was decorative, and a
 * mutation dropping `verdict` — a field ONLY that component reads — stayed green.
 * Caught by falsifying it, not by writing it.
 */
function bodyOf(sig: string): string {
  const i = src.indexOf(sig)
  expect(i, `${sig} not found — this gate is pointed at nothing`).toBeGreaterThan(-1)
  // A brace ALONE on its line closes the function. Two narrower boundaries failed first:
  //   `\n}`  — also matches `}: {` ending a React props destructure, which truncated
  //          RunFeedbackCard to 214 chars and ZERO fields;
  //   brace-matching from the first `{` — latches onto the inline RETURN TYPE literal
  //          `{ label: string; … }[]`, truncating buildScoreExplanations instead.
  // The length floor in the arms below is what catches the next variant of this.
  const j = src.indexOf('\n}\n', i)
  expect(j, `${sig} has no closing brace on its own line`).toBeGreaterThan(i)
  return src.slice(i, j)
}

function cardBody(): string {
  return CONSUMERS.map(bodyOf).join('\n')
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
    // 🔴 THE FLOOR THAT WOULD HAVE CAUGHT THE DEAD EXTRACTOR. `verdict` is read ONLY by
    // `RunFeedbackCard`; if its body is truncated again, this is the arm that notices,
    // and it is the one a green mutation exposed as missing.
    expect(reads, 'RunFeedbackCard contributed nothing — its body is not being parsed')
      .toContain('verdict')
    for (const sig of CONSUMERS) {
      expect(bodyOf(sig).length, `${sig} body looks truncated`).toBeGreaterThan(900)
    }
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
 * 🔴 THE REGRESSION THE FIX ITSELF INTRODUCED, pinned.
 *
 * The breakdown renders each row on `value !== undefined`. An earlier cut of this change
 * ran the four scores through a helper that mapped `null → undefined`, which REMOVED the
 * row instead of showing its "No X data." line — measured at **19 of 100 live rows**
 * carrying at least one null score (hr 19, distance/pace/ef 13 each). Same silent-display
 * class the change exists to fix, introduced by the fix, caught by code review.
 */
describe('RUN-ANALYSIS-SELECT-01 — a null score keeps its row', () => {
  it('the card returns null for a null score, never undefined', () => {
    const body = cardBody()
    // The four scores are returned straight off the row. Any wrapper here must be
    // checked against the render gate below before it is reintroduced.
    for (const f of ['hr_discipline_score', 'distance_score', 'pace_score', 'ef_score']) {
      // ⚠️ ANCHORED ON THE COMMA. The first cut matched `value: analysis.<f>` unanchored,
      // which is a PREFIX of `value: analysis.<f> ?? undefined` — so re-introducing the
      // exact regression kept it green. Substring bias, in the arm written to catch it.
      expect(body, `${f} must reach the row un-wrapped`).toMatch(new RegExp(`value:\\s+analysis\\.${f},`))
    }
  })

  it('the declared return type admits null, which is what keeps the row', () => {
    expect(src).toMatch(/value: number \| null \| undefined; line: string/)
  })

  it('the render gate is still the one that makes null meaningful', () => {
    // If this gate ever becomes a truthiness check, a 0 score vanishes too and the
    // arms above stop meaning anything.
    expect(src).toContain('value !== undefined')
  })
})
