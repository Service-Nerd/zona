/**
 * The "never worse" comparison (ARCH-ENG-008). The single owner of whether a scorecard line got
 * worse; `scripts/scorecard.ts` and `scorecard.test.ts` both call it, neither re-inlines it.
 *
 * ⚠️ Unverified is never a pass: a line that could not be measured, a line the baseline has and
 * today does not, and a line today has and the baseline does not, all FAIL. A new predicate is
 * baselined deliberately with `--write --reason`, never by being absent.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { FAILING, type BaselineLine, type Line, type Row, type Verdict } from './types'

export const BASELINE_PATH = join(__dirname, '..', 'plan', '__fixtures__', 'scorecardBaseline.json')

export interface ScorecardBaseline {
  /** Why this baseline was written. Required: re-baselining is a statement, never a way to go green. */
  reason: string
  written_at: string
  git_head: string
  /** `full` / `fast` for the existing corpora; `full:<provider>` / `fast:<provider>` for another. */
  modes: Record<string, Record<string, BaselineLine>>
}

export function verdictFor(line: Line, base: BaselineLine | undefined): Verdict {
  if (line.value == null || !Number.isFinite(line.value)) return 'NOT MEASURED'
  if (!base) return 'NEW'
  const v = line.value, b = base.value, tol = line.tol ?? base.tol ?? 0
  switch (line.better) {
    case 'zero': return v > 0 ? 'WORSE' : 'OK'
    case 'pass': return v === 1 ? 'OK' : 'WORSE'
    case 'lower': return v > b + tol ? 'WORSE' : v < b ? 'BETTER' : 'OK'
    case 'higher': return v < b - tol ? 'WORSE' : v > b ? 'BETTER' : 'OK'
    case 'stable': return Math.abs(v - b) > tol + 1e-9 ? 'MOVED' : 'OK'
  }
}

export function compare(lines: readonly Line[], base: Record<string, BaselineLine> | undefined): Row[] {
  const rows: Row[] = lines.map(l => {
    const b = base?.[l.id]
    const verdict = verdictFor(l, b)
    return {
      id: l.id, today: l.value, baseline: b?.value ?? null,
      delta: l.value != null && b ? Math.round((l.value - b.value) * 100) / 100 : null,
      verdict, headline: !!l.headline,
    }
  })
  const seen = new Set(lines.map(l => l.id))
  for (const [id, b] of Object.entries(base ?? {}))
    if (!seen.has(id)) rows.push({ id, today: null, baseline: b.value, delta: null, verdict: 'MISSING', headline: true })
  return rows
}

export const failing = (rows: readonly Row[]): Row[] => rows.filter(r => FAILING.has(r.verdict))

export function readBaseline(path = BASELINE_PATH): ScorecardBaseline | null {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as ScorecardBaseline : null
}

export function toBaselineLines(lines: readonly Line[]): Record<string, BaselineLine> {
  const out: Record<string, BaselineLine> = {}
  for (const l of lines) {
    if (l.value == null) throw new Error(`refusing to baseline "${l.id}": it was not measured`)
    out[l.id] = { value: l.value, better: l.better, ...(l.tol ? { tol: l.tol } : {}) }
  }
  return out
}

export function writeBaseline(b: ScorecardBaseline, path = BASELINE_PATH): void {
  if (!b.reason || b.reason.trim().length < 10) throw new Error('a re-baseline needs --reason "<why>" (10+ characters)')
  writeFileSync(path, JSON.stringify(b, null, 1) + '\n')
}

const fmt = (n: number | null) => (n == null ? '—' : Number.isInteger(n) ? String(n) : n.toFixed(2))
/** The one table: line, today, baseline, delta, verdict. Detail rows print only when not OK. */
export function renderTable(rows: readonly Row[], { all = false } = {}): string {
  const shown = rows.filter(r => all || r.headline || r.verdict !== 'OK')
  const w = Math.max(30, ...shown.map(r => r.id.length))
  const out = [`${'LINE'.padEnd(w)}  ${'TODAY'.padStart(9)}  ${'BASELINE'.padStart(9)}  ${'DELTA'.padStart(8)}  VERDICT`]
  out.push('─'.repeat(w + 46))
  for (const r of shown) {
    const d = r.delta == null ? '—' : (r.delta > 0 ? '+' : '') + fmt(r.delta)
    out.push(`${r.id.padEnd(w)}  ${fmt(r.today).padStart(9)}  ${fmt(r.baseline).padStart(9)}  ${d.padStart(8)}  ${r.verdict}`)
  }
  const hidden = rows.length - shown.length
  if (hidden) out.push(`(${hidden} detail lines OK and not shown; --all prints them)`)
  return out.join('\n')
}
