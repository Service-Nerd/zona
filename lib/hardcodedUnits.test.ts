import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'
import DEBT from './__fixtures__/hardcodedUnitsDebt.json'

// PREF-SWEEP-01 — the mechanical half of "a unit preference must be honoured
// EVERYWHERE".
//
// ADR-015 makes `lib/format.ts` the sole owner of every distance and duration
// string a runner reads, and INV-PREF-001 says the runner's own km/miles choice
// reaches all of them. Both were doctrine with no check, and the drift they
// permit is invisible by construction: a `km` welded to an interpolated value
// renders perfectly, passes tsc, and is only wrong for the subset of users who
// chose miles — who are exactly the users least likely to be the one testing.
//
// ⚠️ WHAT THIS DETECTS, AND WHY IT IS THE SHAPE IT IS. It fires on a unit glyph
// written immediately after a template interpolation — `${km}km`, `${v} min`.
// That is deliberately narrow. It is the shape of every live site the
// PREF-SWEEP-01 inventory actually found, and a broader rule ("any string
// containing km") drowns in `distance_km` field names, config keys and prose —
// and a check that cries wolf gets deleted, which this repo has already
// recorded as equal to having no check at all.
//
// ⚠️ WHAT IT CANNOT SEE, stated because green here is not "no hardcoded units":
//   - a fixed label with no interpolation: `<span>km</span>`, 'Distance (km)'
//   - a unit chosen by a ternary the preference never reaches
//   - a unit inside a string the SERVER builds and the client only renders
//   - anything outside app/ components/ lib/plan/ lib/coaching/
// Those are found by reading, not by this regex. This gate stops the class it
// names from GROWING; it does not certify the class is empty.

// ⚠️ THE OPTIONAL SLASH IS PACE-UNITS-01, AND IT IS WHY THIS GATE MISSED A
// FIVE-MONTH DEFECT WHILE REPORTING CLEAN.
//
// A DISTANCE unit is written `${x}km`. A PACE unit is always written `${x}/km`,
// and the original pattern had no `/`, so it matched the first and could not
// see the second. Verified: it CAUGHT `${raceDistanceKm}km race` and MISSED
// `${formatPace(eFast)}–${formatPace(eSlow)} /km` — the actual line that baked
// km into 674 of 888 stored sessions.
//
// PREF-SWEEP-01 scanned `lib/plan/**`, which contains that line, and passed.
// **A census is only as wide as its pattern** — the same shape as the
// svg-bounded back-arrow scan that could not see `← Back` as a literal.
const UNIT_AFTER_INTERPOLATION = /\}\s*\/?\s*(km|mi|miles|mins?|hrs?|hours?|minutes?)\b/

/**
 * Known sites, each with the reason it is not a defect. Same debt-register
 * pattern as SWEEP-BASELINE-01: visible, non-growing, and a stale entry fails
 * just as loudly as a new violation.
 *
 * ⚠️ A REASON IS NOT A FIX. Two of these are unreachable code rather than
 * correct code, and nothing here schedules their removal.
 */
const BASELINE: ReadonlyArray<{ file: string; snippet: string; reason: string }> = [
  {
    file: 'app/dashboard/DashboardClient.tsx',
    snippet: '${raceDistanceKm}km race',
    reason:
      'UNREACHABLE — the quit tracker. `activeSection` has a `quit` branch and nothing in the ' +
      'codebase ever sets it (CLAUDE.md: "Smoke tracker — removed from all UI surfaces"). ' +
      'Editing dead code to satisfy a linter is churn; deleting the screen is its own decision.',
  },
  {
    file: 'components/training/PlanChart.tsx',
    snippet: '${w.long_run_hrs}hr',
    reason:
      'UNREACHABLE — PlanChart is imported by DashboardClient and never rendered. That import is ' +
      'the only reference to it in the whole tree.',
  },
  {
    file: 'components/marketing/PlanPage.tsx',
    snippet: '${s.distance_km} km',
    reason:
      'NO VIEWER — a public marketing page has no signed-in user and therefore no unit ' +
      'preference to honour. The sample plan is authored in km deliberately.',
  },
  {
    file: 'components/strava/StravaPanel.tsx',
    snippet: '${raceDistanceKm}km',
    reason:
      'ADMIN-ONLY — the Strava screen has no nav entry and is reachable by URL only (CLAUDE.md ' +
      'Active scope). Not a runner-facing surface.',
  },
  {
    file: 'components/strava/StravaPanel.tsx',
    snippet: '${(run.distance/1000).toFixed(2)}km',
    reason:
      'ADMIN-ONLY, and the value is raw Strava API metres shown as metres. Converting it would ' +
      "hide what the API actually returned, which is that screen's whole job.",
  },
  {
    file: 'lib/coaching/diff/validateAiSummary.ts',
    snippet: '${km}km session is stable',
    reason:
      'DEVELOPER-FACING — a validator rejection reason, read in logs and never rendered. Same ' +
      'class as the 58 invariants.ts violation messages the PREF-SWEEP-01 inventory separated out.',
  },
]

/**
 * DEVELOPER-FACING BY WHOLE FILE, not by line.
 *
 * Every string in these files is a violation message, an audit objection or a
 * harness label. They are read in logs, ops rows and test output and are never
 * rendered to a runner, so a unit preference has nothing to honour in them.
 * The PREF-SWEEP-01 inventory already separated 58 of `invariants.ts`'s out for
 * exactly this reason, and BASELINE carries an entry citing that ruling.
 *
 * ⚠️ VERIFIED BY READING, NOT BY FILENAME. Each was opened and its hits read
 * on 2026-09-23 — 25 of them, all of the form `message:` / `actual:` /
 * `expected:` / `detail:` on an objection record, plus one grid label. Listing
 * them individually would bury the entries that matter.
 *
 * ⚠️ THE COST IS NAMED: if a violation message ever becomes runner-facing, this
 * gate will not see it. That is a real hole, and it is preferred to a baseline
 * nobody can read.
 */
const DEVELOPER_FACING_FILES: ReadonlySet<string> = new Set([
  'lib/plan/invariants.ts',          // ~90 validatePlan() violation messages
  'lib/plan/planShapeInvariants.ts', // 11 — plan-arc invariant messages
  'lib/plan/baseBuildValidate.ts',   //  7 — §116 base-build validator messages
  'lib/plan/planQuality.ts',         //  6 — audit objection `detail` strings
  'lib/plan/useCaseEnvelope.ts',     //  1 — the measurement grid's case label
])

function scan(): Array<{ file: string; line: number; code: string }> {
  // 🔴 `**/` DOES NOT MATCH A FILE DIRECTLY INSIDE THE DIRECTORY, and this gate
  // spent its whole life reporting clean on files it had never opened.
  //
  // MEASURED 2026-09-23: `git ls-files 'lib/plan/**/*.ts'` returns **ZERO**
  // files — `lib/plan` is flat, so every one of its **271** files, including
  // `ruleEngine.ts` where the `/km` bake lives, was outside the scan.
  // `lib/coaching/**/*.ts` returned 24 (its subdirectories) while missing
  // **122** at the top level. **393 files the header claimed to cover.**
  //
  // The flat and nested forms are BOTH listed now. `git ls-files` de-duplicates
  // across pathspecs, so the overlap costs nothing.
  //
  // ⚠️ This is the same class as the regex fix above and they compounded: the
  // pattern could not see a pace unit, AND the file list could not see the file
  // that wrote one. Either alone would have hidden PACE-UNITS-01.
  const files = execSync(
    "git ls-files 'app/*.ts' 'app/*.tsx' 'app/**/*.ts' 'app/**/*.tsx' " +
      "'components/*.ts' 'components/*.tsx' 'components/**/*.ts' 'components/**/*.tsx' " +
      "'lib/plan/*.ts' 'lib/plan/**/*.ts' 'lib/coaching/*.ts' 'lib/coaching/**/*.ts'",
    { encoding: 'utf8', cwd: process.cwd() },
  )
    .trim()
    .split('\n')
    .filter(f => f && !/\.test\.tsx?$/.test(f))
    // ⚠️ DEVELOPER-FACING BY WHOLE FILE, not by line. `invariants.ts` is 100%
    // violation messages read in logs and ops rows and never rendered to a
    // runner — the PREF-SWEEP-01 inventory already separated 58 of them out for
    // exactly this reason, and BASELINE carries one entry citing that ruling.
    // Listing ~90 of them individually would bury the entries that matter.
    //
    // ⚠️ THE COST IS NAMED: if a violation message ever becomes runner-facing,
    // this gate will not see it. That is a real hole and it is preferred to a
    // baseline nobody can read.
    .filter(f => !DEVELOPER_FACING_FILES.has(f))

  const hits: Array<{ file: string; line: number; code: string }> = []
  for (const file of files) {
    // ⚠️ Block-comment state, added 2026-09-21. The line check below skips
    // `//`, `*` and `/*` openers, which covers JSDoc and single-line comments
    // but NOT the CONTINUATION lines of a JSX `{/* ... */}` block, whose
    // middle lines start with ordinary prose.
    //
    // It caught a comment in `SameWeekTwice.tsx` that was explaining THIS RULE,
    // quoting the banned pattern in order to describe it. A guard that fires on
    // its own documentation is the same comment-read-as-code class this repo
    // hit four times in one day from the other direction, and the cost is
    // worse than a false negative: it teaches you to write around the guard.
    let inBlockComment = false
    readFileSync(file, 'utf8').split('\n').forEach((raw, i) => {
      const trimmed = raw.trim()
      const opens = /\{?\/\*/.test(raw) && !/\*\/\}?/.test(raw.slice(raw.search(/\{?\/\*/) + 2))
      if (inBlockComment) {
        if (/\*\/\}?/.test(raw)) inBlockComment = false
        return
      }
      if (opens) { inBlockComment = true; return }
      // A comment EXPLAINING the rule is not a second copy of it.
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
      const m = raw.match(UNIT_AFTER_INTERPOLATION)
      if (!m) return
      // `hours={h} mins={m}` is a JSX attribute list, not a unit glyph.
      const after = raw.slice((m.index ?? 0) + m[0].length)
      if (/^\s*=\{/.test(after)) return
      hits.push({ file, line: i + 1, code: trimmed })
    })
  }
  return hits
}

describe('PREF-SWEEP-01 — a unit glyph may not be welded to an interpolated value', () => {
  const hits = scan()

  it('🔴 no NEW hardcoded unit reaches a runner-facing surface', () => {
    const unexplained = hits.filter(
      h => !BASELINE.some(b => b.file === h.file && h.code.includes(b.snippet))
        && !DEBT.entries.some(d => d.file === h.file && d.code === h.code),
    )
    expect(
      unexplained.map(h => `${h.file}:${h.line}  ${h.code}`),
      "Render this through lib/format.ts (formatDistance / formatDuration) with the reader's " +
        'units, or — if it genuinely cannot reach a runner — add it to BASELINE with the reason. ' +
        'Do NOT add it to the UNITS-PROSE-01 debt register: that register is closed to new ' +
        'entries by design, and a debt that can grow is not a debt, it is a habit.',
    ).toEqual([])
  })

  // ── UNITS-PROSE-01, the debt register ────────────────────────────────────
  //
  // 62 producer-side sites that bake a unit into a string at GENERATION or
  // ANALYSIS time, where the reader's preference is not in scope. This is the
  // same architectural fact that made PACE-UNITS-01 unfixable at its producer:
  // by the time the app renders, there is no number left to convert.
  //
  // ⚠️ MEASURED, NOT ASSUMED: 19 stored plans carry ZERO prose km anywhere in
  // the document while 17 of 19 carry `/km` pace. So the class is REAL and
  // currently UNREALISED in production. **"Zero in the corpus" is not "cannot
  // fire"** — this repo recorded that exact lesson when §80's note named its
  // cap 0 times in 5,264 plans and was reachable all along.
  //
  // ⚠️ A DECLARED REASON IS NOT A FIXED PROBLEM. This register makes the debt
  // visible and stops it growing. Nothing here schedules its removal, and the
  // entry date is in the fixture so the age is always one line away.
  describe('UNITS-PROSE-01 debt register', () => {
    it('is CLOSED — it may shrink by fixing, never grow', () => {
      expect(DEBT.entries.length).toBeLessThanOrEqual(DEBT.count)
    })

    it('every registered site still exists — a stale reason is its own defect', () => {
      const gone = DEBT.entries.filter(d => !hits.some(h => h.file === d.file && h.code === d.code))
      expect(
        gone.map(d => `${d.file}  ${d.code}`),
        'This site no longer matches. If it was fixed, delete the entry from ' +
          'lib/__fixtures__/hardcodedUnitsDebt.json and lower `count` in the same commit.',
      ).toEqual([])
    })
  })

  it('every baselined entry still exists — a stale reason is its own defect', () => {
    // The register must shrink by FIXING, never by drifting out of date.
    const missing = BASELINE.filter(
      b => !hits.some(h => h.file === b.file && h.code.includes(b.snippet)),
    )
    expect(
      missing.map(b => `${b.file}  ${b.snippet}`),
      'This site no longer matches. If it was fixed, delete the BASELINE entry in the same commit.',
    ).toEqual([])
  })

  it('the scanner actually reaches the tree it claims to', () => {
    // Guards the failure mode where a bad glob returns nothing and the gate
    // reports a clean zero from an EMPTY scan (2026-09-04: a regression
    // comparison ran on two empty files and reported success).
    expect(hits.length).toBeGreaterThanOrEqual(BASELINE.length)
  })
})
