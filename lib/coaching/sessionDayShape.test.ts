import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * SHARE-WEEK-CARD-SOURCE-01 (2026-10-31) — `session_day` is the BARE day (`tue`), everywhere.
 *
 * 🔴 THE SAME DEFECT, THE THIRD TIME, BECAUSE ITS GUARD WATCHED ONE FILE. `ADJUST-SESSIONDAY-PREFIX-01`
 * (2026-10-15) found `startsWith(`week_${weekN}_`)` matching nothing in `adjustmentEngine.ts` and wrote
 * `adjustmentSessionDayAxis.test.ts`, whose arm reads ONLY that file. Sixteen days later the founder's
 * Share button was failing on every press: `/api/og/weekly-zone-card` selected `.like('session_day',
 * 'week_N_%')` (404 for every runner since 2026-05-24; 4 presses, 4 errors in production), and the
 * race-week debrief in `/api/weekly-report` looked for `week_N_<day>` (its race analysis always null).
 * Measured: 0 of 165 `run_analysis` rows and 0 of 306 `session_completions` rows carry a prefix.
 *
 * So this walks every source file. A STRIP (`.replace(`week_${n}_`, '')`) is allowed: it is a harmless
 * no-op kept for any legacy row, and is not a reader that depends on the prefix.
 */
const ROOTS = ['app', 'lib', 'components']

function files(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) files(p, out)
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

/** A template literal that builds a `week_<n>_` session_day key, outside a `.replace(` strip. */
const PREFIX = /`week_\$\{[^}]+\}_/

export function prefixedSessionDayReaders(src: string): number[] {
  const lines = src.split('\n')
  const hits: number[] = []
  lines.forEach((raw, i) => {
    const l = raw.replace(/\/\/.*$/, '')
    if (!PREFIX.test(l)) return
    if (/\.replace\(\s*`week_\$\{/.test(l)) return
    hits.push(i + 1)
  })
  return hits
}

describe('session_day is never read as `week_N_<day>`', () => {
  it('🔴 no source file builds a prefixed session_day key to match against', () => {
    const offenders: string[] = []
    for (const root of ROOTS) for (const f of files(join(process.cwd(), root))) {
      for (const n of prefixedSessionDayReaders(readFileSync(f, 'utf8'))) offenders.push(`${f.replace(process.cwd() + '/', '')}:${n}`)
    }
    expect(offenders, 'session_day holds the bare day; select the week with .eq(\'week_n\', n)').toEqual([])
  })

  it('the detector sees the three shapes that shipped, and lets a strip through', () => {
    expect(prefixedSessionDayReaders("q.like('session_day', `week_${weekN}_%`)")).toEqual([1])
    expect(prefixedSessionDayReaders('a.session_day === `week_${weekN}_${day}`')).toEqual([1])
    expect(prefixedSessionDayReaders("(a.session_day ?? '').startsWith(`week_${weekN}_`)")).toEqual([1])
    expect(prefixedSessionDayReaders("session_day.replace(`week_${week_n}_`, '')")).toEqual([])
  })

  it('the weekly card selects its week on week_n', () => {
    const src = readFileSync('app/api/og/weekly-zone-card/route.tsx', 'utf8').replace(/\/\/.*$/gm, '')
    expect(src).toMatch(/\.from\('run_analysis'\)[\s\S]{0,300}\.eq\('week_n', weekN\)/)
  })
})
