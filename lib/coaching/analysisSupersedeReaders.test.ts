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

interface Reader { file: string; filters: boolean }

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
    out.push({ file, filters: /superseded_at/.test(chain) })
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
const EXPECT_FILTERS: Record<string, boolean> = {
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
  'app/dashboard/DashboardClient.tsx': true,             // 🔴 the aerobic trend card — §71 Am. 1's second gap
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
    const declared = Object.entries(EXPECT_FILTERS).filter(([, f]) => !f).map(([k]) => k).sort()
    expect(unfiltered,
      'The unfiltered run_analysis readers changed. If a HISTORY reader now crosses a race ' +
      'boundary, that is §71 Am. 1 territory and needs the board; if an identity lookup was ' +
      'added, register it with the trace that shows nothing is re-attributed.',
    ).toEqual(declared)
  })

  it('no reader that the register says is plan-scoped has drifted to unfiltered', () => {
    const drifted = allReaders
      .filter(r => !r.filters && EXPECT_FILTERS[r.file] === true)
      .map(r => r.file)
    expect(Array.from(new Set(drifted))).toEqual([])
  })
})
