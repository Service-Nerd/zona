import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// DASHBOARD-SCREEN-EXTRACT-03 — the single owner of "where does dashboard UI live".
//
// 🔴 WHY THIS EXISTS. Across three extraction phases, TWENTY-TWO guard failures had one
// cause: a test with `app/dashboard/DashboardClient.tsx` hardcoded as its entire
// population, watching for code that had moved to `components/dashboard/`. Every one of
// those guards was correct on the day it was written. After a move, a single-file read is
// a VACUOUS GREEN — no hits, because the subject left, and nothing goes red to say so.
//
// Six were widened by hand in phase 2 and eight more went red in phase 3. Fixing them
// individually a third time would be the "remedy applied to one twin" failure this repo
// has recorded nine times. So the population gets ONE owner, derived from git rather than
// typed, and the next extraction phase moves code without silently blinding a guard.
//
// ⚠️ A guard that uses this must still assert the population is NON-EMPTY. An empty list
// passes every assertion layered on top of it, which is the failure mode this module is
// meant to remove rather than relocate.

/** Every file that holds dashboard UI: the hub plus everything lifted out of it. */
export function dashboardFiles(): string[] {
  const files = execSync(
    "git ls-files 'app/dashboard/DashboardClient.tsx' " +
      "'components/dashboard/*.ts' 'components/dashboard/*.tsx'",
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .filter(f => f && !f.includes('.test.'))
  // 🔴 Derived, and therefore capable of coming back empty if the glob or the layout
  // changes. That is exactly how a check stops checking, so it is an error here rather
  // than a quiet zero.
  if (files.length === 0) {
    throw new Error('dashboardFiles(): empty population — the glob no longer matches anything')
  }
  return files
}

/** The concatenated source, for guards that scan text rather than per-file. */
export function dashboardSource(): string {
  return dashboardFiles().map(f => readFileSync(f, 'utf8')).join('\n')
}

/** Per-file, for guards that need to report WHICH file offended. */
export function dashboardEntries(): Array<{ file: string; src: string }> {
  return dashboardFiles().map(f => ({ file: f, src: readFileSync(f, 'utf8') }))
}
