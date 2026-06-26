import { describe, it, expect } from 'vitest'
import { computeSessionDiff } from './sessionDiff'
import { validateSummaryAgainstDiff } from './validateAiSummary'

const rest = () => ({ type: 'rest', label: 'Rest', detail: null })
const easy = (km: number) => ({ type: 'easy', label: 'Easy', detail: null, distance_km: km })
const long = (km: number, mins: number) => ({
  type: 'long', label: 'Long run', detail: null, distance_km: km, duration_mins: mins,
})

describe('validateSummaryAgainstDiff', () => {
  it('REJECTS the exact 2026-06-26 incident summary', () => {
    // The summary the model produced for Row 2 of the incident:
    // "Moved your rest day from Tuesday to Thursday. The 24km run and
    //  hard-easy rhythm stay intact — this is just about sequence, not
    //  load."
    // The diff: tue and sun (where the 24km long run was) both changed
    // — the long run actually moved sun → tue, not "stayed intact."
    const before = [easy(10), rest(),       easy(5), long(24, 180), rest(), easy(8), rest()]
    const after  = [easy(10), long(24, 180), easy(5), rest(),        rest(), easy(8), rest()]
    const diff   = computeSessionDiff(before, after)

    const result = validateSummaryAgainstDiff(
      'Moved your rest day from Tuesday to Thursday. The 24km run and hard-easy rhythm stay intact — this is just about sequence, not load.',
      diff,
    )

    expect(result.ok).toBe(false)
    // Reason should reference the false stability claim — either via
    // session type ("long") or via the distance signature ("24km") the
    // model used to refer to the long run without naming the type.
    expect(result.reason).toMatch(/long|24km/i)
  })

  it('REJECTS day-stability claim that contradicts the diff', () => {
    const before = [easy(10), rest(),       easy(5), rest(),         rest(), easy(8), long(24, 180)]
    const after  = [easy(10), long(24, 180), easy(5), rest(),         rest(), easy(8), rest()]
    const diff   = computeSessionDiff(before, after)

    const r = validateSummaryAgainstDiff(
      "Sunday's long run stays as planned.",
      diff,
    )
    expect(r.ok).toBe(false)
    // Either pattern is acceptable — both correctly catch the contradiction.
    // In practice the type-name pattern ("long") fires before the day-name
    // pattern because the validator runs type checks first.
    expect(r.reason).toMatch(/long|sunday/)
  })

  it('REJECTS invented moves (move claim where neither day changed)', () => {
    // Diff: nothing changed.
    const before = [easy(10), rest(), easy(5), rest(), easy(8), easy(5), long(24, 180)]
    const diff   = computeSessionDiff(before, before)

    const r = validateSummaryAgainstDiff(
      'Moved the tempo from Wednesday to Friday.',
      diff,
    )
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/move/i)
  })

  it('ACCEPTS honest move prose that matches the diff', () => {
    const before = [easy(10), rest(),       easy(5), long(24, 180), rest(), easy(8), rest()]
    const after  = [easy(10), long(24, 180), easy(5), rest(),        rest(), easy(8), rest()]
    const diff   = computeSessionDiff(before, after)

    const r = validateSummaryAgainstDiff(
      "Moved the long run from Thursday to Tuesday. Your week now front-loads the volume.",
      diff,
    )
    expect(r.ok).toBe(true)
  })

  it('ACCEPTS prose that explains the why without making stability claims', () => {
    const before = [easy(10), rest(), easy(5), rest(), easy(8), easy(5), long(24, 180)]
    const after  = [easy(10), rest(), easy(5), rest(), easy(8), easy(5), long(20, 150)]
    const diff   = computeSessionDiff(before, after)

    const r = validateSummaryAgainstDiff(
      "Long runs have come in around 71% of plan two weeks running. Pulled this week's back to match where you're actually finishing — no point chasing a number that isn't landing.",
      diff,
    )
    expect(r.ok).toBe(true)
  })

  it('ACCEPTS prose when the diff is empty and the summary makes no structural claims', () => {
    const before = [easy(10), rest(), easy(5), rest(), easy(8), easy(5), long(24, 180)]
    const diff   = computeSessionDiff(before, before)

    const r = validateSummaryAgainstDiff(
      'No structural changes this week. Hold the zone.',
      diff,
    )
    expect(r.ok).toBe(true)
  })
})
