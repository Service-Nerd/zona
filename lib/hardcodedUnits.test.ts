import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'

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

const UNIT_AFTER_INTERPOLATION = /\}\s*(km|mi|miles|mins?|hrs?|hours?|minutes?)\b/

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

function scan(): Array<{ file: string; line: number; code: string }> {
  const files = execSync(
    "git ls-files 'app/**/*.ts' 'app/**/*.tsx' 'components/**/*.ts' 'components/**/*.tsx' " +
      "'lib/plan/**/*.ts' 'lib/coaching/**/*.ts'",
    { encoding: 'utf8', cwd: process.cwd() },
  )
    .trim()
    .split('\n')
    .filter(f => f && !/\.test\.tsx?$/.test(f))

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
      h => !BASELINE.some(b => b.file === h.file && h.code.includes(b.snippet)),
    )
    expect(
      unexplained.map(h => `${h.file}:${h.line}  ${h.code}`),
      "Render this through lib/format.ts (formatDistance / formatDuration) with the reader's " +
        'units, or — if it genuinely cannot reach a runner — add it to BASELINE with the reason.',
    ).toEqual([])
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
