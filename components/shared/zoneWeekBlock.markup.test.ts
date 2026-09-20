import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P-04 — the zone-compliance block on the Plan screen.
 *
 * The derivation is unit-tested in `lib/coaching/zoneWeekStatement.test.ts`.
 * This pins the WIRING, which is where this feature can silently become wrong
 * without any sentence changing.
 */
const BLOCK_RAW = readFileSync(join(process.cwd(), 'components/shared/ZoneWeekBlock.tsx'), 'utf8')
/**
 * ⚠️ COMMENTS STRIPPED. The first cut asserted against the raw file and three
 * assertions failed on the component's OWN COMMENTARY — the words "drifted"
 * and "AIMark" appear in comments explaining why they must not appear in
 * output, and em dashes are explicitly exempt in code comments
 * (BRAND-EMDASH-01). THIRD time today a substring check read a comment as
 * code. A guard with a false positive gets loosened, and a loosened guard is
 * how the real thing gets through.
 */
const BLOCK = BLOCK_RAW
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
const DASH  = readFileSync(join(process.cwd(), 'app/dashboard/DashboardClient.tsx'), 'utf8')

describe('P-04 — the block is wired to the right week and the right meaning', () => {
  it('reads real files', () => {
    expect(BLOCK).toContain('export default function ZoneWeekBlock')
    expect(BLOCK.length).toBeGreaterThan(400)
    expect(DASH).toContain('<ZoneWeekBlock')
  })

  it('⚠️ keys this week by week.n, NEVER by array position', () => {
    // ADR-013: on a standalone maintenance plan the array restarts at 0 while
    // week.n continues at 26+, and both maps are keyed by week.n. Using the
    // ordinal reads ANOTHER PLAN'S WEEK — the PLAN-WEEK-COLLISION-01 shape,
    // which put a 94%-pre-completed plan in front of a real runner.
    expect(DASH).toContain('const comps    = allCompletions[weekNum] ?? {}')
    expect(DASH).toContain('const analysed = runAnalysisMap[weekNum] ?? {}')
    expect(DASH).not.toContain('allCompletions[weekOrdinal]')
    expect(DASH).not.toContain('runAnalysisMap[weekOrdinal]')
  })

  it('counts only COMPLETED runs', () => {
    expect(DASH).toContain("c?.status === 'complete'")
  })

  it('an unanalysed completed run goes through classifyRun, not a falsy check', () => {
    // `classifyRun` returns 'unknown' for null/undefined/NaN. A truthiness
    // test here would read a missing measurement as a failure, which is the
    // false statement the board's second ruling exists to prevent.
    expect(DASH).toContain('classifyRun(analysed[day]?.hr_above_ceiling_pct)')
  })

  it('the component renders the owner’s sentences and writes none of its own', () => {
    expect(BLOCK).toContain('zoneWeekStatement(outcomes)')
    // Rendered from the ternary's else-branch, not a bare {s.line}: the
    // locked state substitutes its own copy in the same slot.
    expect(BLOCK).toContain(': s.line}')
    expect(BLOCK).toContain('{s.gapLine}')
    // The statement module owns the copy; the component must not restate it.
    // ⚠️ Asserted on SENTENCES, not on the word 'drifted' alone — that is the
    // tone discriminant in `s.tone === 'drifted'`, i.e. legitimate code. A
    // ban on the bare word failed on the component reading its own union type.
    expect(BLOCK).not.toContain('held the zone')
    expect(BLOCK).not.toContain('had no heart rate')
    expect(BLOCK).not.toContain('next easy one')
  })

  it('uses P-01s semantic pair from tokens, as a rail not a fill', () => {
    // Warm Slate accent-only rule: type accent, never a coloured card.
    expect(BLOCK).toContain("'var(--moss)'")
    expect(BLOCK).toContain("'var(--warn)'")
    expect(BLOCK).toMatch(/width: '3px'/)
    expect(BLOCK).not.toMatch(/background: locked \? 'var\(--warn/)
  })

  it('carries NO AIMark — this is rule-engine output', () => {
    expect(BLOCK).not.toContain('AIMark')
  })

  it('the free tier is DESIGNED, not blank', () => {
    // Run analysis is activity_intelligence (PAID), so a free runner can see
    // the ceiling and never learn whether they held it. The locked state names
    // what the score is and what unlocks it, following RestraintCard.
    expect(BLOCK).toContain('locked')
    expect(BLOCK).toContain("'var(--bg-soft)'")
    expect(BLOCK).toContain('Connect a heart rate source and upgrade')
    expect(DASH).toContain('locked={!hasPaidAccess}')
  })

  it('no hardcoded hex, no hardcoded font stack', () => {
    expect(BLOCK).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(BLOCK).toContain('var(--font-ui)')
  })

  it('no em dash in any user-facing string', () => {
    const strings = BLOCK.match(/'[^']{12,}'/g) ?? []
    for (const s of strings) expect(s).not.toContain('—')
  })
})
