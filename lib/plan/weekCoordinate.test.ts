import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * ADJUST-WEEK-COORD-01 / ARCH-ENG-015 — a week KEY is `week.n`, never an array position.
 *
 * `app/api/adjust-plan/route.ts` keyed the adjustment on `getCurrentWeekIndex(plan.weeks) + 1`.
 * The engine read that position and wrote the week whose `n` equalled it, so on a plan with
 * foundation weeks (n = -3..0) every adjustment landed later than the runner's week: all four
 * on the seven shifted live plans, three weeks late. The same expression keyed the taper
 * entry check, the missed-session prompt and the widget's overrides.
 *
 * The owner is `lib/plan/weekResolution.ts` (`weekNAt`, `getCurrentWeekN`, `findWeekByN`,
 * `weekIndexOfN`; `getCurrentWeekOrdinal` for display). This fails on the four shapes a
 * position-as-key takes, anywhere else under app/ lib/ components/:
 *
 *   R1  `getCurrentWeekIndex(…) + 1`
 *   R2  `weeks[<…week_n / weekN…> - 1]`             a key used as a position
 *   R3  `<x> + 1` where `<x>` was assigned from `getCurrentWeekIndex(` / `getWeekIndexForDate(`
 *       in the same file, unless the line names the result an ORDINAL (a display number)
 *   R4  `<…Idx / Index…> = <…week_n / weekN…> - 1`  an index derived from a key
 *
 * ⚠️ WHAT IT DOES NOT SEE: a position reaching a key through a helper, a prop, or a property
 * (`plan.currentWeekIndex + 1`), and a key used positionally under another name. Comments are
 * stripped by the shared stripper first, so prose about the old line does not fire.
 */

const ROOT = process.cwd()
const OWNER = 'lib/plan/weekResolution.ts'
const KEY = String.raw`(?:week_n|weekN|WeekN)`

function findPositionKeys(lines: readonly string[]): { line: number; rule: string; text: string }[] {
  const hits: { line: number; rule: string; text: string }[] = []
  const positionVars = new Set<string>()
  for (const l of lines) {
    const m = l.match(/(?:const|let|var)\s+(\w+)\s*=\s*\(?\s*(?:getCurrentWeekIndex|getWeekIndexForDate)\(/)
    if (m) positionVars.add(m[1]!)
  }
  lines.forEach((l, i) => {
    const push = (rule: string) => hits.push({ line: i + 1, rule, text: l.trim() })
    if (/getCurrentWeekIndex\((?:[^()]|\([^()]*\))*\)\s*\)?\s*\+\s*1\b/.test(l)) push('R1')
    if (new RegExp(String.raw`weeks\[\s*\(?\s*[\w.]*${KEY}\b[^\]]*-\s*1\s*\]`).test(l)) push('R2')
    if (new RegExp(String.raw`\w*(?:Idx|Index)\w*\s*=\s*[\w.]*${KEY}\s*-\s*1\b`).test(l)) push('R4')
    const assigned = l.match(/(?:const|let|var)?\s*(\w+)\s*[:=]/)?.[1] ?? ''
    if (/ordinal/i.test(assigned)) return
    for (const v of Array.from(positionVars)) {
      if (new RegExp(String.raw`(?<![.\w])${v}\s*\+\s*1\b`).test(l)) { push('R3'); break }
    }
  })
  return hits
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { out.push(...walk(p)); continue }
    if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(p)
  }
  return out
}

/** The shared stripper in `--stream` mode (see `lib/coachNameSwept.test.ts` for why). */
function strippedByFile(files: string[]): Map<string, string[]> {
  const byFile = new Map<string, string[]>()
  for (let i = 0; i < files.length; i += 200) {
    const out = execFileSync('python3', ['-I', join(ROOT, 'scripts/lib/strip-comments.py'), '--stream', ...files.slice(i, i + 200)],
      { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    for (const row of out.split('\n')) {
      const m = row.match(/^(.*?):(\d+):(.*)$/)
      if (!m) continue
      const arr = byFile.get(m[1]!) ?? []
      arr[Number(m[2]) - 1] = m[3]!
      byFile.set(m[1]!, arr)
    }
  }
  for (const arr of Array.from(byFile.values())) for (let i = 0; i < arr.length; i++) arr[i] ??= ''
  return byFile
}

describe('ADJUST-WEEK-COORD-01 — the detector', () => {
  it('fires on each of the four shapes, including the exact defect lines', () => {
    expect(findPositionKeys(['  const weekN = getCurrentWeekIndex(plan.weeks) + 1']).map(h => h.rule)).toEqual(['R1'])
    expect(findPositionKeys(['const t = (getCurrentWeekIndex(loadedPlan.weeks)) + 1']).map(h => h.rule)).toEqual(['R1'])
    expect(findPositionKeys(['  const week = plan.weeks[weekN - 1]']).map(h => h.rule)).toEqual(['R2'])
    expect(findPositionKeys(['const w = plan.weeks[(c.week_n as number) - 1] as any']).map(h => h.rule)).toEqual(['R2'])
    expect(findPositionKeys(['const weekIndex = getCurrentWeekIndex(plan.weeks)', 'const currentWeekN = weekIndex + 1']).map(h => h.rule)).toEqual(['R3'])
    expect(findPositionKeys(['const wIdx = getCurrentWeekIndex(w)', 'const wN = wIdx + 1']).map(h => h.rule)).toEqual(['R3'])
    expect(findPositionKeys(['const currentWeekIdx = weekN - 1']).map(h => h.rule)).toEqual(['R4'])
  })

  it('stays silent on the owner calls, display ordinals and adjacent-week arithmetic', () => {
    expect(findPositionKeys([
      'const weekN = getCurrentWeekN(plan.weeks)',
      'const weekIndex = getCurrentWeekIndex(plan.weeks)',
      'const weekOrdinal = weekIndex + 1',
      'const prev = plan.weeks[i - 1]',
      ".eq('week_n', weekN - 1)",
      'const week = findWeekByN(plan.weeks, weekN)',
      'const weekIndex = getCurrentWeekIndex(plan.weeks)',
      '? { weekN: plan.currentWeekIndex + 1 }',   // a property, not the local
    ])).toEqual([])
  })
})

describe('ADJUST-WEEK-COORD-01 — no position is written as a week key', () => {
  it('app/ lib/ components/ carry no position-derived week key outside the owner', () => {
    const files = ['app', 'lib', 'components'].flatMap(d => walk(join(ROOT, d)))
      .filter(f => relative(ROOT, f) !== OWNER)
    expect(files.length, 'empty population: unverified is never a pass').toBeGreaterThan(300)
    const stripped = strippedByFile(files)
    expect(stripped.size, 'the stripper returned nothing: unverified is never a pass').toBeGreaterThan(300)
    const offenders: string[] = []
    for (const [file, lines] of Array.from(stripped)) {
      for (const h of findPositionKeys(lines)) offenders.push(`${relative(ROOT, file)}:${h.line} ${h.rule} ${h.text}`)
    }
    expect(offenders, 'a week key derived from an array position; use weekNAt / getCurrentWeekN / findWeekByN').toEqual([])
  })
})
