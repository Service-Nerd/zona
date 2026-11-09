// violationReport.ts — the single owner of "render a validatePlan() verdict for a human".
//
// 🔴 WHY THIS EXISTS (COACHING-ROUND-WARNS-BLIND-01, filed 2026-10-11).
// `coaching-review/<date>/review.md` closes with "Warns are the board's to
// weigh" and NEITHER it nor `generated-plans.md` recorded a single warn code,
// severity, week or message — only the per-case COUNT, in a table.
// Measured on every round from 2026-10-11 to 2026-11-09:
// `grep -c "INV-PLAN" generated-plans.md` -> 0. So the protocol's closing
// instruction was a request nobody could satisfy without reading 25 generated
// plans by eye, and a board that signed it off had weighed a NUMBER, not a
// finding. Same shape as the decorative-config family: the artifact exists,
// says the right thing, and cannot be acted on.
//
// ⚠️ TWO ROUNDS, ONE DEFECT. `foundation-review-round.ts` had it too — its
// `codes` column was `errors.map(...)`, errors only, beside a warn column
// summing to 1,338 across 486 plans. Both rounds use this module, so the next
// round written cannot reinvent a third answer.
//
// ⚠️ THE TALLY IS DERIVED FROM THE VIOLATIONS, NEVER FROM THE ROW COUNTS.
// The item's own falsification is "remove one warn from one case and confirm
// the tally moves" — a count that cannot move is the thing being fixed. A
// tally computed from the same `warns: number` the table prints could not move
// independently and would be the same defect in a new costume. `tallyMatches`
// is the cross-check the rounds exit non-zero on.

import type { Violation } from './invariants'

/** A labelled case and the verdict it produced. */
export interface CaseViolations {
  readonly label: string
  readonly violations: readonly Violation[]
}

export interface TallyRow {
  readonly code: string
  readonly principle_ref: string
  readonly severity: Violation['severity']
  /** Total firings across every case. */
  readonly count: number
  /** How many distinct cases it fired in. */
  readonly cases: number
  /** The case with the most firings of this code, and how many. */
  readonly worst: { label: string; count: number }
}

/** One violation, as a line a coach can act on. `day` and the actual/expected
 *  pair are included when present — the message alone often does not carry the
 *  number the board is being asked to weigh. */
export function renderViolation(v: Violation): string {
  const parts = [
    `[${v.code}]`,
    v.severity,
    `wk${v.week ?? '—'}`,
    ...(v.day ? [v.day] : []),
  ]
  const nums = v.actual === undefined && v.expected === undefined
    ? ''
    : ` (actual ${String(v.actual)}, expected ${String(v.expected)})`
  const ref = v.principle_ref ? ` — ${v.principle_ref}` : ''
  return `${parts.join(' · ')} · ${v.message}${nums}${ref}`
}

/** A blockquote of every violation of one severity, or '' when there are none.
 *  Empty means the case was clean, which is a real answer, not a hollow one. */
export function violationBlock(heading: string, vs: readonly Violation[]): string {
  if (!vs.length) return ''
  return `\n> **${heading}**\n` + vs.map(v => `> - ${renderViolation(v)}`).join('\n') + '\n'
}

/** Code-frequency across every case, so a warn firing in six plans reads as ONE
 *  pattern rather than six separate counts. Sorted by count desc, then code. */
export function tallyByCode(
  cases: readonly CaseViolations[],
  severity: Violation['severity'],
): TallyRow[] {
  const byCode = new Map<string, { v: Violation; perCase: Map<string, number> }>()
  for (const c of cases) {
    for (const v of c.violations) {
      if (v.severity !== severity) continue
      let e = byCode.get(v.code)
      if (!e) { e = { v, perCase: new Map() }; byCode.set(v.code, e) }
      e.perCase.set(c.label, (e.perCase.get(c.label) ?? 0) + 1)
    }
  }
  const rows: TallyRow[] = []
  for (const [code, e] of Array.from(byCode.entries())) {
    let count = 0
    let worst = { label: '—', count: 0 }
    for (const [label, n] of Array.from(e.perCase.entries())) {
      count += n
      if (n > worst.count) worst = { label, count: n }
    }
    rows.push({
      code,
      principle_ref: e.v.principle_ref,
      severity,
      count,
      cases: e.perCase.size,
      worst,
    })
  }
  return rows.sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
}

/** The tally as markdown. Returns [] when nothing of that severity fired. */
export function renderTally(rows: readonly TallyRow[], heading: string): string[] {
  if (!rows.length) return []
  const total = rows.reduce((s, r) => s + r.count, 0)
  return [
    `## ${heading}`,
    '',
    `**${total}** firings · **${rows.length}** distinct codes. A code firing in several cases is ONE pattern.`,
    '',
    '| Code | § | Firings | Cases | Worst case |',
    '|---|---|---|---|---|',
    ...rows.map(r =>
      `| ${r.code} | ${r.principle_ref || '—'} | ${r.count} | ${r.cases} | ${r.worst.label} (${r.worst.count}) |`),
    '',
  ]
}

/** Does the tally account for every violation the per-case rows counted?
 *  A round calls this and FAILS on false: a tally that disagrees with the
 *  numbers printed beside it is unweighable in exactly the way this module
 *  exists to fix. */
export function tallyMatches(
  rows: readonly TallyRow[],
  countedPerCase: readonly number[],
): boolean {
  const tallied = rows.reduce((s, r) => s + r.count, 0)
  const counted = countedPerCase.reduce((s, n) => s + n, 0)
  return tallied === counted
}

/** Warn codes for a single case, deduped, in firing order — for a table cell
 *  where full detail would be noise (the foundation round: 1,338 warns). */
export function codesOf(vs: readonly Violation[], severity: Violation['severity']): string[] {
  return Array.from(new Set(vs.filter(v => v.severity === severity).map(v => v.code)))
}
