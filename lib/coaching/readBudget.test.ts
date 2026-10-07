import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  POST_RUN_READ_MAX_WORDS, countWords, isWithinReadBudget, readBudgetInstruction,
} from './readBudget'

// POSTRUN-JOURNEY-01 — the read's budget is in WORDS.
//
// THE DEFECT: the budget was in SENTENCES. The founder's own read was three
// sentences and 76 words and broke no rule. Measured across all 83 live rows: mean
// 12 words, 77 of 83 at or under 20, exactly ONE breaking the sentence cap. The
// sentence rule holds almost perfectly and governs nothing that matters.

/** His actual read, verbatim from production. 76 words, 3 sentences. */
const FOUNDERS_READ =
  "You ran 1.4km longer than planned and spent most of it above the zone, which means " +
  "the session drifted from tempo into steady-state effort. HR climbed 13 bpm in the back " +
  "third, the limiter looks like aerobic capacity, not leg speed, so hold the zone next " +
  "time: if you're creeping above 158, ease back rather than push through. This suggests " +
  "you need more patience on the build phase; quality tempo only counts when it stays in the band."

describe('POSTRUN-JOURNEY-01 — the read budget counts words', () => {
  it('THE DEFECT: the real read is 3 sentences and far over the word budget', () => {
    const sentences = FOUNDERS_READ.split(/[.!?]\s/).length
    expect(sentences).toBe(3)                       // compliant with the OLD rule
    expect(countWords(FOUNDERS_READ)).toBeGreaterThan(70)
    expect(isWithinReadBudget(FOUNDERS_READ)).toBe(false)   // caught by the new one
  })

  it('the budget is the founder\'s number', () => {
    expect(POST_RUN_READ_MAX_WORDS).toBe(40)
  })

  it('a typical read passes — the corpus mean is 12 words', () => {
    const typical = 'HR climbed 13 bpm in the back third, so the limiter was aerobic, not leg speed.'
    expect(countWords(typical)).toBeLessThan(20)
    expect(isWithinReadBudget(typical)).toBe(true)
  })

  it('the boundary is inclusive and exact', () => {
    const exactly40 = Array.from({ length: 40 }, () => 'word').join(' ')
    expect(countWords(exactly40)).toBe(40)
    expect(isWithinReadBudget(exactly40)).toBe(true)
    expect(isWithinReadBudget(exactly40 + ' more')).toBe(false)
  })

  it('counts the way a reader would, not by splitting on single spaces', () => {
    expect(countWords('one  two\n\nthree\tfour')).toBe(4)
    expect(countWords('   ')).toBe(0)
    expect(countWords('')).toBe(0)
  })

  it('the PROMPT and the CHECK share one number — they cannot drift', () => {
    expect(readBudgetInstruction()).toContain(String(POST_RUN_READ_MAX_WORDS))
  })

  it('the prompt actually uses the owner, not its own sentence', () => {
    const src = readFileSync('lib/coaching/prompts/sessionFeedback.ts', 'utf8')
    expect(src).toContain('outputConstraint: readBudgetInstruction()')
    // The old sentence-only rule must be gone, or two budgets exist at once.
    expect(src).not.toContain("'One paragraph only. TWO sentences, three at the absolute most. Never more.'")
  })

  it('🔴 the boundary RECORDS, it never TRUNCATES', () => {
    // A sentence sliced at word 40 is worse than a long one, and silent repair
    // would hide the rate. The route must not cut the text.
    const route = readFileSync('app/api/analyse-run/route.ts', 'utf8')
    expect(route).toContain('isWithinReadBudget(feedbackText)')
    expect(route).toContain("'read_over_budget'")
    expect(route).not.toMatch(/feedbackText\s*=\s*feedbackText\.(slice|substring)/)
  })
})
