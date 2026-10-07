// §71 Amendment 1 — ANALYSIS-SUPERSEDE-PATTERN-01 (Coaching Board, 2026-10-06).
//
// `lib/plan/supersede.ts` justifies MARKING rows rather than deleting them with a
// claim about the code: "the TIME-WINDOWED readers aggregate across plans — the
// aerobic trend card, the discipline ledger, the reframe cohort,
// v_coach_engagement". Measured 2026-10-06: **two of those four do not.** The
// reframe's previous-similar scan and the aerobic trend card both filter
// `superseded_at IS NULL`, and the discipline ledger is plan-scoped by design so
// the justification mis-classifies it.
//
// 🔴 THE COMMENT WAS THE DEFECT, and nothing could see it: a prose claim about
// which queries filter is exactly what no test in this repo was checking. The
// board could not order the build (nobody has measured whether a real runner has
// analyses on both sides of a race boundary — only four runners have any analysis
// at all), so the artifact it DID order is this: make the claim mechanical, so the
// comment and the code cannot drift apart again in silence.
//
// ⚠️ WHAT THIS DOES NOT PROVE. It does not prove any reader is CORRECT — the
// discipline ledger filters and should. It proves the inventory is accurate and
// fails when a reader changes sides without the register being updated.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')

/** Every file under app/ and lib/ that READS `run_analysis`, derived by walking
 *  the tree — never a hand-typed list. A hand-typed population is this repo's
 *  most-recorded gate failure (`sheetClose.test.ts`'s four paths missed the file
 *  rendering four of the app's nine sheets). */
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p)
  }
  return out
}

interface Reader { file: string; filters: boolean; fitnessFields: string[] }

/**
 * 🔴 §71 Am. 1's SPLIT, encoded. Seiler: a comparison may cross a race boundary for
 * DISCIPLINE fields, never for FITNESS-DENOMINATED ones, because the denominator
 * changed at the boundary and the comparison stops being like with like.
 *
 * So an unfiltered read is not judged by WHICH query it is — a name or a comment
 * token would be a label, and a label is not a mechanism — but by WHAT IT SELECTS.
 */
const FITNESS_DENOMINATED = [
  'ef_trend_pct', 'ef_value', 'ef_baseline', 'ef_score',
  'pace_score', 'distance_score', 'total_score',
]

/** A `.from('run_analysis')` query and whether its chain carries the
 *  `superseded_at` filter. Bounded to the statement, not the file — a file-level
 *  grep cannot tell which of several queries carries it, and this repo has paid
 *  for grepping a file where it should have bounded a region. */
function readersIn(src: string, file: string): Reader[] {
  const out: Reader[] = []
  const re = /\.from\(\s*['"]run_analysis['"]\s*\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    // The chain runs to the first terminator: a `)` closing the Promise.all
    // element, a `;`, or the next `.from(`. Take a generous window and stop at
    // the earliest.
    const rest = src.slice(m.index, m.index + 1200)
    const stop = Math.min(
      ...[/\n\s*\]\)/, /;\s*\n/, /\.from\(\s*['"](?!run_analysis)/]
        .map(r => { const x = r.exec(rest.slice(1)); return x ? x.index + 1 : rest.length }),
      rest.length,
    )
    const chain = rest.slice(0, stop)
    // A WRITE is not a read: insert/update/upsert/delete chains are not history
    // readers and the justification makes no claim about them.
    if (/\.(insert|update|upsert|delete)\(/.test(chain)) continue
    // 🔴 A FILTER, NOT A MENTION. This was `/superseded_at/.test(chain)`, and the
    // first query to SELECT the column as data — `ANALYSIS-SUPERSEDE-PATTERN-01`'s
    // deliberately cross-plan drift read — passed as "filtered" because the word
    // appeared in its `.select()`. The guard would have certified the exact query
    // §71 Am. 1 authorises as the opposite of what it is. Match the predicate.
    const filters = /\.(is|eq|not)\(\s*['"]superseded_at['"]/.test(chain)
    const sel = /\.select\(\s*(['"])([\s\S]*?)\1/.exec(chain)?.[2] ?? ''
    const fitnessFields = FITNESS_DENOMINATED.filter(f => sel.includes(f))
    out.push({ file, filters, fitnessFields })
  }
  return out
}

const allReaders: Reader[] = walk(join(ROOT, 'app'))
  .concat(walk(join(ROOT, 'lib')))
  .flatMap(f => readersIn(readFileSync(f, 'utf8'), f.slice(ROOT.length + 1)))

/**
 * THE REGISTER. Each entry is a file that reads `run_analysis`, and whether it
 * filters on `superseded_at` — i.e. whether it is plan-scoped or crosses plans.
 *
 * `crossesPlans: true` is currently claimed by NOTHING that reads
 * `run_analysis`, which is the finding. `v_coach_engagement` crosses plans but
 * reads `session_completions` in SQL, so it is outside this file's reach and
 * recorded in §71 Am. 1 instead.
 */
/**
 * ⚠️ `lib/coaching/fetchRunAnalysis.ts` (added 2026-10-07, POSTRUN-POLL-WEEK-BLIND-01)
 * is PLAN-SCOPED and the decision is deliberate, not inherited.
 *
 * It answers "what is the analysis for THIS session of THIS plan?" for the post-run
 * card, keyed `(user_id, week_n, session_day)`. A superseded row belongs to a plan the
 * runner is no longer on, and showing last block's verdict against this block's session
 * would be a straight misattribution — the §71 Am. 1 hazard, not an exception to it.
 *
 * It is the extraction of the poll that was querying `session_day` ALONE, where
 * `.maybeSingle()` errored on two rows and the caller discarded the error. Registering
 * it here is how this gate found it, which is the second time today a check written for
 * something else caught a new reader on the way in.
 */
/**
 * 🔴 `'mixed'` ADDED 2026-10-07 (ANALYSIS-SUPERSEDE-PATTERN-01). A file may now hold
 * BOTH a plan-scoped read and an authorised cross-plan one, and `boolean` could not
 * say so — it would have forced either a false "this file crosses" (hiding that its
 * other queries must keep filtering) or a false "it filters" (hiding the crossing the
 * board ruled on). `'mixed'` requires BOTH to be present, so deleting either one fails
 * the build: the cross-plan read cannot silently disappear, and the plan-scoped ones
 * cannot silently join it.
 */
type Expectation = boolean | 'mixed'

const EXPECT_FILTERS: Record<string, Expectation> = {
  'app/api/adjust-plan/route.ts': true,
  'app/api/analyse-run/route.ts': true,
  'app/api/daily-coach-note/route.ts': true,
  'app/api/discipline-ledger/route.ts': true,            // plan-scoped BY DESIGN — correct
  'app/api/email/send-trial/route.ts': true,
  'app/api/maintenance-block/route.ts': true,
  'app/api/og/session-complete-card/route.tsx': true,
  'app/api/og/weekly-zone-card/route.tsx': true,
  'app/api/ops/plan-audit/route.ts': true,
  'app/api/phase-summary/route.ts': true,
  'app/api/post-run-reframe/route.ts': true,             // 🔴 the reframe cohort — §71 Am. 1's genuine gap
  'app/api/push/send-trial-insight/route.ts': true,
  'app/api/race-readiness/route.ts': true,
  'app/api/recalibrate-hr/route.ts': true,
  'app/api/recalibrate-taper/route.ts': true,
  'app/api/weekly-report/route.ts': true,
  /**
   * 🔴 MIXED, and both halves are deliberate (ANALYSIS-SUPERSEDE-PATTERN-01,
   * Coaching Board 2026-10-07).
   *
   * FILTERED: the `runAnalysisMap` load, which feeds ZoneRings, the session cards and
   * the weekly discipline percentage. All plan-scoped, all indexed by `week_n` — and
   * old plans REUSE week numbers, so unfiltering it would ship `PLAN-WEEK-COLLISION-01`
   * again (a new plan arrived 94% pre-completed).
   *
   * UNFILTERED: the narrow zone-drift history query. §71 Am. 1 authorises crossing a
   * race boundary for DISCIPLINE fields, and that query selects
   * `hr_above_ceiling_pct` and nothing fitness-denominated — `ef_trend_pct` is
   * deliberately absent, because the denominator changed at the boundary.
   *
   * ⚠️ Still the home of §71 Am. 1's second gap, the aerobic trend card.
   */
  'app/dashboard/DashboardClient.tsx': 'mixed',
  'lib/coaching/fetchRunAnalysis.ts': true,              // POSTRUN-POLL-WEEK-BLIND-01 — see below
  'lib/coaching/healthkitConsolidate.ts': true,
  'lib/coaching/weeklyActualLoad.ts': true,

  /**
   * ⚠️ DELIBERATELY UNFILTERED, AND THIS GATE IS WHAT MADE IT AN EXPLICIT
   * DECISION RATHER THAN AN OVERSIGHT.
   *
   * Two reads, both IDENTITY LOOKUPS by `apple_health_uuid` — "does an analysis
   * already exist for this HealthKit workout?" — feeding `triggerHrRefreshAnalysis`
   * when HR arrives late (HR-LATE-RESCORE-01). They are not history scans.
   *
   * Traced before registering: `/api/analyse-run` upserts with
   * `onConflict: 'user_id,apple_health_uuid'`, NOT on week_n/session_day, so the
   * refresh lands back on the row the uuid lookup found and its week coordinates
   * are the ones read from it. Nothing is re-attributed.
   *
   * 🔴 SO ADDING THE FILTER HERE WOULD BE A DEFECT, not a fix: a runner whose
   * race changed would silently stop getting late HR applied to the old block's
   * runs. The first pass of this file assumed these were writes and excluded
   * them; they are SELECTs, and the gate is what corrected that.
   */
  'app/api/health/ingest/route.ts': false,
}

describe('§71 Am. 1 — the run_analysis reader register is accurate', () => {
  it('the population is derived and non-empty — an empty one passes every other arm', () => {
    expect(allReaders.length).toBeGreaterThan(15)
  })

  it('every reader found in the tree is in the register', () => {
    const unknown = Array.from(new Set(allReaders.map(r => r.file))).filter(f => !(f in EXPECT_FILTERS))
    expect(unknown,
      `New run_analysis reader(s) not in the register. Decide whether each is PLAN-SCOPED (filter ` +
      `superseded_at) or a HISTORY reader (do not), per §71 Am. 1 — discipline fields may cross a ` +
      `race boundary, fitness-denominated fields may not — then add it here: ${unknown.join(', ')}`,
    ).toEqual([])
  })

  it('every registered reader still filters the way the register says', () => {
    for (const [file, shouldFilter] of Object.entries(EXPECT_FILTERS)) {
      const found = allReaders.filter(r => r.file === file)
      if (!found.length) continue   // file may legitimately stop reading the table
      const anyUnfiltered = found.some(r => !r.filters)
      const anyFiltered   = found.some(r => r.filters)
      if (shouldFilter === 'mixed') {
        // Both must exist. Either one vanishing is a silent change to what crosses.
        expect(anyFiltered,   `${file}: register says mixed, found NO plan-scoped read`).toBe(true)
        expect(anyUnfiltered, `${file}: register says mixed, found NO cross-plan read`).toBe(true)
        continue
      }
      expect(!anyUnfiltered, `${file}: register says filters=${shouldFilter}, found an unfiltered read`)
        .toBe(shouldFilter)
    }
  })

  it('the set of UNFILTERED readers is exactly the registered ones — no silent new one', () => {
    // The sharp arm. Arm 3 checks each registered file still behaves; this one
    // checks nothing has JOINED the unfiltered set, which is where a history
    // reader crossing a race boundary would appear.
    //
    // §71 Am. 1: crossing is allowed for zone-discipline fields only, it must
    // NAME the boundary it crossed (McMillan), and the boundary must stay
    // visible (Willy). A new entry here is a board matter, not a tidy-up.
    const unfiltered = Array.from(new Set(allReaders.filter(r => !r.filters).map(r => r.file))).sort()
    const declared = Object.entries(EXPECT_FILTERS)
      .filter(([, f]) => f === false || f === 'mixed')
      .map(([k]) => k).sort()
    expect(unfiltered,
      'The unfiltered run_analysis readers changed. If a HISTORY reader now crosses a race ' +
      'boundary, that is §71 Am. 1 territory and needs the board; if an identity lookup was ' +
      'added, register it with the trace that shows nothing is re-attributed.',
    ).toEqual(declared)
  })

  it('🔴 an UNFILTERED read may select DISCIPLINE fields only — Seiler\'s split, enforced', () => {
    // The arm that makes `mixed` mean something. Requiring "one filtered and one
    // unfiltered" only counts queries; it cannot tell WHICH query crosses, so
    // unfiltering a plan-scoped map load stayed green while the drift query sat
    // beside it. Measured during the build: DashboardClient holds FOUR
    // `run_analysis` reads and two are map loads.
    //
    // §71 Am. 1 restricts the FIELD, not the window, so that is what is checked.
    const offenders = allReaders
      .filter(r => !r.filters && r.fitnessFields.length > 0)
      .map(r => `${r.file} selects ${r.fitnessFields.join(', ')}`)
    expect(offenders,
      'A cross-plan run_analysis read selects a FITNESS-DENOMINATED field. §71 Am. 1 forbids ' +
      'crossing a race boundary for those: the denominator changed, so the comparison is not ' +
      'of like with like. Either filter on superseded_at, or drop the field from the select.',
    ).toEqual([])
  })

  it('no reader that the register says is plan-scoped has drifted to unfiltered', () => {
    const drifted = allReaders
      .filter(r => !r.filters && EXPECT_FILTERS[r.file] === true)   // 'mixed' is exempt BY DECLARATION, not by accident
      .map(r => r.file)
    expect(Array.from(new Set(drifted))).toEqual([])
  })
})
