/**
 * PROMPT-UNITS-ADJUST-01 — the plan-adjustment prompt speaks the runner's units.
 *
 * 🔴 WHAT WAS WRONG. `buildAdjustmentExplanationPrompt` took no `units` and its
 * only caller never read `getUserDisplayPrefs`, so a MILES runner was sent a
 * km-voiced explanation of their own plan change — and `summariseDiff`'s every
 * line runs through `labelSession`, which formats a distance, so the structural
 * diff handed to the model was in kilometres too.
 *
 * ADR-015 Amendment: **the AI layer is a display surface.** A number handed to the
 * model becomes user-facing the moment the model repeats it.
 *
 * ⚠️ `units` IS REQUIRED AND SITS SECOND, ahead of the optional arguments, because
 * TypeScript will not accept a required parameter after an optional one. That is
 * deliberate: a default is what let this defect exist, and the compiler is what
 * makes the next caller answer.
 */
import { describe, it, expect } from 'vitest'
import { buildAdjustmentExplanationPrompt } from './planAdjustment'
import { summariseDiff, computeSessionDiff } from '../diff/sessionDiff'
import type { ProposedAdjustment } from '../planAdjustment'

const adjustment = {
  trigger: 'missed_sessions',
  adjustmentType: 'volume_trim',
  summary: 'Trimmed the week after two missed runs.',
  // ⚠️ ARRAYS INDEXED BY DAY ORDER (mon..sun), not a day-keyed object.
  // `computeSessionDiff` reads `before[idx]`, so an object fixture yields seven
  // `unchanged/null` entries and an EMPTY diff — which is how the first version of
  // this test "passed" its way to three red assertions instead of finding a bug.
  sessionsBefore: [null, null, { type: 'easy', distance_km: 8.5 }, null, null, null, { type: 'long', distance_km: 24 }],
  sessionsAfter:  [null, null, { type: 'easy', distance_km: 8.5 }, null, null, null, { type: 'long', distance_km: 19.3 }],
} as unknown as ProposedAdjustment

describe('PROMPT-UNITS-ADJUST-01', () => {
  it('a miles runner gets MILES in the prompt, and no kilometres', () => {
    const mi = buildAdjustmentExplanationPrompt(adjustment, 'mi')
    // ⚠️ `/\bmi\b/` does NOT match "15mi" — digit-to-letter is not a word boundary,
    // and my first assertion failed on correct output for that reason alone.
    expect(mi).toMatch(/\d+\s*mi\b/)
    // The long run is 24 km -> 15 mi. If the diff still said "24km" the model would
    // repeat it to a runner who thinks in miles.
    expect(mi).not.toMatch(/\d+\s*km/)
  })

  it('a km runner is unchanged', () => {
    const km = buildAdjustmentExplanationPrompt(adjustment, 'km')
    expect(km).toMatch(/\d+\s*km/)
  })

  it('the VOICE HEADER tells the model which word to write — the other half of the fix', () => {
    // 🔴 THIS ARM EXISTS BECAUSE THE FALSIFICATION DID NOT GO RED WITHOUT IT.
    // Hardcoding the header back to `units: 'km'` left all the other arms green,
    // because they assert on the DIFF lines, which are threaded separately through
    // `summariseDiff`. The fix has two halves and the test covered one.
    // `buildVoiceHeader` emits: "The runner measures distance in MILES. Write
    // 'mile' in prose and never the other unit."
    const mi = buildAdjustmentExplanationPrompt(adjustment, 'mi')
    const km = buildAdjustmentExplanationPrompt(adjustment, 'km')
    expect(mi).toMatch(/measures distance in MILES/)
    expect(mi).not.toMatch(/measures distance in KILOMETRES/)
    expect(km).toMatch(/measures distance in KILOMETRES/)
    expect(km).not.toMatch(/measures distance in MILES/)
  })

  it('the two prompts actually DIFFER — the parameter is wired, not decorative', () => {
    // A declared-but-unread parameter is this repo's most-recorded defect class.
    expect(buildAdjustmentExplanationPrompt(adjustment, 'mi'))
      .not.toEqual(buildAdjustmentExplanationPrompt(adjustment, 'km'))
  })

  it('summariseDiff carries units into every labelSession line', () => {
    const diff = computeSessionDiff(adjustment.sessionsBefore, adjustment.sessionsAfter)
    const mi = summariseDiff(diff, { units: 'mi' }).join(' ')
    const km = summariseDiff(diff, { units: 'km' }).join(' ')
    expect(mi).toMatch(/mi/)
    expect(mi).not.toMatch(/\d+\s*km/)
    expect(mi).not.toEqual(km)
  })
})
