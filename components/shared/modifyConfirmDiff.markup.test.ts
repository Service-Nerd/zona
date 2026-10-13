/**
 * Design Board `MODIFY-CONFIRM-DIFF-01` (2026-10-13) — the mechanical check.
 *
 * ⚠️ The board required this be FALSIFIED before it is trusted: "this board has
 * shipped a hollow check before" (`--section-gap`, a `flexShrink` that could
 * never fire, two inert gates, a hollow inset-border check). Each arm below
 * states what breaking it looks like.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const CONFIRM = readFileSync('components/shared/ModifyPlanConfirm.tsx', 'utf8')
const DIFF    = readFileSync('components/shared/AdjustmentDiff.tsx', 'utf8')
const strip = (s: string) =>
  s.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('{/*')).join('\n')

describe('AMENDMENT 1 — the week header names the FILTER, not the week', () => {
  it('the day-row scale label says what changes, because only changed days render', () => {
    // Falsify: revert to <ScaleLabel>This week{weekLabel}</ScaleLabel> -> red.
    expect(strip(CONFIRM), 'the day rows are a DIFF; a bare "This week" promises a week and delivers a filter')
      .toMatch(/<ScaleLabel>What changes this week\{weekLabel\}<\/ScaleLabel>/)
  })

  it('the whole-plan scale label is unchanged — the two scales stay named (shipped clause)', () => {
    expect(strip(CONFIRM)).toMatch(/<ScaleLabel>Your whole plan<\/ScaleLabel>/)
  })
})

describe('AMENDMENT 2 — the ACCEPTED value outranks the one it replaces', () => {
  it('the struck-through old value is set smaller than the row default', () => {
    // Falsify: delete the fontSize line, or set it to 13px -> red.
    const before = DIFF.slice(DIFF.indexOf('textDecoration'))
    expect(DIFF, 'the replaced value is context, not a choice; it must not sit at parity')
      .toMatch(/fontSize:\s*'12px',[\s\S]{0,120}textDecoration:\s*'line-through'/)
    expect(before.length).toBeGreaterThan(0)
  })

  it('12px is a DECLARED size — 13 is not (TYPESCALE-APP-GATE-01)', () => {
    const DECLARED = new Set(['10', '11', '12', '14', '15', '17', '20', '26', '44', '56'])
    const m = DIFF.match(/fontSize:\s*'(\d+)px',[\s\S]{0,120}textDecoration:\s*'line-through'/)
    expect(m, 'could not read the struck-through size').toBeTruthy()
    expect(DECLARED.has(m![1]), `${m![1]}px is not in the app type scale`).toBe(true)
  })
})

describe('AMENDMENT 3 — the sentence is rendered, and owned', () => {
  it('ModifyPlanConfirm renders it through the owner, never a literal', () => {
    expect(strip(CONFIRM)).toMatch(/explainPlanDelta\(/)
    expect(strip(CONFIRM)).toMatch(/\{deltaWhy\}/)
  })

  it('🔴 the sentence is NOT hand-written in the component', () => {
    // Falsify: paste the string into the JSX -> red. The owner carries the
    // no-claims test; a literal here would escape it entirely.
    expect(strip(CONFIRM), 'the sentence belongs to planDeltaExplain, which is where the no-claims arm guards it')
      .not.toMatch(/fewer weeks? of training/)
  })
})

describe('AMENDMENT 4 — the diff labels a long run by its ROLE', () => {
  it('labelSession reads isLongRun, not session.type alone', () => {
    const src = readFileSync('lib/coaching/diff/sessionDiff.ts', 'utf8')
    // Falsify: revert to `const type = String(s.type ?? 'session')` -> red.
    expect(strip(src), 'INV-CLASS: sessionRole.ts is the single owner of session classification')
      .toMatch(/isLongRun\([^)]*\)\s*\?\s*'long run'/)
  })
})
