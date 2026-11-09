// violationReport.test.ts — COACHING-ROUND-WARNS-BLIND-01.
//
// The item's own falsification is the centre of this file: "remove one warn from
// one case and confirm the tally moves — a count that cannot move is the thing
// being fixed." Every arm below was made to go red before it was trusted green.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  renderViolation, violationBlock, tallyByCode, renderTally, tallyMatches, codesOf,
  type CaseViolations,
} from './violationReport'
import type { Violation } from './invariants'

function v(p: Partial<Violation> & { code: string }): Violation {
  return {
    principle_ref: 'CoachingPrinciples §7',
    severity: 'warn',
    week: 3,
    message: 'the two largest sessions are 1 day apart',
    actual: '1 day',
    expected: '>= 2 days',
    ...p,
  }
}

const SPACED = 'INV-PLAN-LARGEST-SESSIONS-SPACED'
const RAMP = 'INV-PLAN-DELIVERED-RAMP'

/** Two cases: A fires SPACED twice and RAMP once, B fires SPACED once.
 *  Mutable `violations` so an arm can remove a firing and re-tally. */
function corpus(): { label: string; violations: Violation[] }[] {
  return [
    { label: 'A', violations: [v({ code: SPACED, week: 3 }), v({ code: SPACED, week: 5 }), v({ code: RAMP, week: 4, principle_ref: 'CoachingPrinciples §94' })] },
    { label: 'B', violations: [v({ code: SPACED, week: 2 })] },
  ]
}

describe('renderViolation — every field the board is asked to weigh', () => {
  it('carries code, severity, week, message, actual/expected and the §', () => {
    const line = renderViolation(v({ code: SPACED }))
    expect(line).toContain(SPACED)
    expect(line).toContain('warn')
    expect(line).toContain('wk3')
    expect(line).toContain('the two largest sessions are 1 day apart')
    expect(line).toContain('actual 1 day')
    expect(line).toContain('expected >= 2 days')
    expect(line).toContain('CoachingPrinciples §7')
  })

  it('includes `day` when the violation names one, and omits it when it does not', () => {
    expect(renderViolation(v({ code: SPACED, day: 'tue' }))).toContain('tue')
    expect(renderViolation(v({ code: SPACED }))).not.toMatch(/·\s(mon|tue|wed|thu|fri|sat|sun)\s/)
  })

  it('writes an absent week as a dash, never as a zero', () => {
    // ABSENCE MUST NOT BE WRITTEN AS A VALUE — `wk0` for "no week" would read
    // as a real week to anyone scanning the packet.
    expect(renderViolation(v({ code: SPACED, week: undefined as unknown as number }))).toContain('wk—')
  })
})

describe('violationBlock', () => {
  it('is empty for a clean case — empty means clean, not broken', () => {
    expect(violationBlock('WARNS', [])).toBe('')
  })

  it('writes one blockquote line per violation, not a count', () => {
    const block = violationBlock('WARNS', [v({ code: SPACED }), v({ code: RAMP })])
    expect(block.split('\n').filter(l => l.startsWith('> - ')).length).toBe(2)
    expect(block).toContain(SPACED)
    expect(block).toContain(RAMP)
  })
})

describe('tallyByCode — the pattern, not the count', () => {
  it('counts firings, distinct cases, and the worst case', () => {
    const rows = tallyByCode(corpus(), 'warn')
    const spaced = rows.find(r => r.code === SPACED)!
    expect(spaced.count).toBe(3)
    expect(spaced.cases).toBe(2)
    expect(spaced.worst).toEqual({ label: 'A', count: 2 })
  })

  it('sorts by firings descending so the pattern is the first row', () => {
    expect(tallyByCode(corpus(), 'warn').map(r => r.code)).toEqual([SPACED, RAMP])
  })

  it('carries each code\'s § through, so the board can read the principle', () => {
    expect(tallyByCode(corpus(), 'warn').find(r => r.code === RAMP)!.principle_ref)
      .toBe('CoachingPrinciples §94')
  })

  it('filters by severity — an error never lands in the warn tally', () => {
    const mixed: CaseViolations[] = [{ label: 'A', violations: [
      v({ code: SPACED, severity: 'warn' }),
      v({ code: 'INV-PLAN-SOMETHING', severity: 'error' }),
    ] }]
    expect(tallyByCode(mixed, 'warn').map(r => r.code)).toEqual([SPACED])
    expect(tallyByCode(mixed, 'error').map(r => r.code)).toEqual(['INV-PLAN-SOMETHING'])
  })

  it('is empty for a clean round', () => {
    expect(tallyByCode([{ label: 'A', violations: [] }], 'warn')).toEqual([])
  })

  // 🔴 THE ITEM'S OWN FALSIFICATION. A tally derived from the `warns: number`
  // column could not move independently of it; this is the arm that proves it is
  // derived from the violations themselves.
  it('MOVES when one warn is removed from one case', () => {
    const before = tallyByCode(corpus(), 'warn').find(r => r.code === SPACED)!
    const after = corpus()
    after[0].violations = after[0].violations.filter((_, i) => i !== 0)
    const row = tallyByCode(after, 'warn').find(r => r.code === SPACED)!
    expect(before.count).toBe(3)
    expect(row.count).toBe(2)
    expect(row.worst).toEqual({ label: 'A', count: 1 })
  })

  it('DROPS a code entirely when its last firing is removed', () => {
    const after = corpus()
    after[0].violations = after[0].violations.filter(x => x.code !== RAMP)
    expect(tallyByCode(after, 'warn').map(r => r.code)).toEqual([SPACED])
  })
})

describe('renderTally', () => {
  it('renders nothing when nothing fired — no empty table', () => {
    expect(renderTally([], 'Warn codes')).toEqual([])
  })

  // 🔴 CODE REVIEW, 2026-11-09. The first cut of the tally carried code / § /
  // counts and nothing a coach could weigh, while THREE places in the same
  // commit claimed "the full message lives in the tally". True for the coaching
  // packet (it has per-case blocks); FALSE for the foundation packet, which has
  // 1,338 firings and no blocks by design. Measured on the real output then:
  // `grep -c "largest sessions"` -> 0. So the tally carries one firing in full.
  it('🔴 carries one firing of each code IN FULL — week and message, not just a count', () => {
    const md = renderTally(tallyByCode(corpus(), 'warn'), 'Warn codes').join('\n')
    expect(md).toContain('the two largest sessions are 1 day apart')
    expect(md).toMatch(/wk\d/)
  })

  it('the exemplar is a REAL firing of that code, not the first violation seen', () => {
    const rows = tallyByCode([
      { label: 'A', violations: [v({ code: RAMP, week: 9, message: 'ramp rose 12%' })] },
      { label: 'B', violations: [v({ code: SPACED, week: 2, message: 'spacing is 1 day' })] },
    ], 'warn')
    expect(rows.find(r => r.code === RAMP)!.example)
      .toEqual({ week: 9, message: 'ramp rose 12%' })
    expect(rows.find(r => r.code === SPACED)!.example)
      .toEqual({ week: 2, message: 'spacing is 1 day' })
  })

  it('states the total and the distinct-code count', () => {
    const md = renderTally(tallyByCode(corpus(), 'warn'), 'Warn codes').join('\n')
    expect(md).toContain('**4** firings')
    expect(md).toContain('**2** distinct codes')
  })
})

describe('tallyMatches — the round fails rather than publishing a tally that disagrees', () => {
  it('is true when the tally accounts for every counted violation', () => {
    expect(tallyMatches(tallyByCode(corpus(), 'warn'), [3, 1])).toBe(true)
  })

  it('is false when a case\'s warns were counted and never tallied', () => {
    expect(tallyMatches(tallyByCode(corpus(), 'warn'), [3, 1, 5])).toBe(false)
  })

  it('is false when the tally claims more than was counted', () => {
    expect(tallyMatches(tallyByCode(corpus(), 'warn'), [3])).toBe(false)
  })

  it('is true for a clean round on both sides', () => {
    expect(tallyMatches([], [0, 0])).toBe(true)
  })
})

describe('codesOf', () => {
  it('dedups and filters by severity', () => {
    expect(codesOf(corpus()[0].violations, 'warn')).toEqual([SPACED, RAMP])
  })

  it('is empty for the wrong severity', () => {
    expect(codesOf(corpus()[0].violations, 'error')).toEqual([])
  })
})

// ── The rounds must USE the owner ────────────────────────────────────────────
// ⚠️ This is a SOURCE assertion and it is declared as one. It cannot prove the
// output is right — the behavioural arms above do that. What it prevents is the
// regression that caused this item: a round that computes `severity === 'warn'`
// and then writes only the number. Comments are stripped first, because a
// source assertion that a comment can satisfy is the hollow kind.
const ROUNDS = ['scripts/coaching-review-round.ts', 'scripts/foundation-review-round.ts']

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('both review rounds render their warns through the single owner', () => {
  it('has a non-empty population — refusing to select nothing', () => {
    expect(ROUNDS.length).toBeGreaterThan(1)
  })

  for (const rel of ROUNDS) {
    it(`${rel} filters warns AND imports violationReport`, () => {
      const src = stripComments(fs.readFileSync(path.resolve(__dirname, '..', '..', rel), 'utf8'))
      // Precondition: this round does count warns. If it stops, this arm is
      // vacuous and should fail rather than pass quietly.
      expect(src, `${rel} no longer filters warns — re-point this arm`)
        .toMatch(/severity\s*===\s*'warn'|codesOf\([^)]*'warn'\)/)
      expect(src, `${rel} counts warns without rendering them through the owner`)
        .toMatch(/from '\.\.\/lib\/plan\/violationReport'/)
      expect(src, `${rel} imports the owner but never builds a tally`)
        .toMatch(/tallyByCode\(/)
    })
  }
})
