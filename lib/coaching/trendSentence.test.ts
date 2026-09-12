// The regression case, made binding by the Coaching Board (UX-COACH-01).
//
// McMillan's condition on the Coach redesign: "a surface that can only speak
// when the arrow is up is marketing". Designing that case first is what found
// this — the sentence was not silent on regression, it was CONFIDENTLY WRONG.
//
// The old line was hardcoded to improvement and guarded only by the presence of
// a model gloss. The gloss is produced whenever `hrIsTrending`, which is
// `Math.abs(hrDeltaBpm) >= MIN_HR_DELTA_BPM` — absolute value, so it fires in
// BOTH directions. A runner whose easy HR had risen from 147 to 152 was told
// "Easy is easier than it was — 147 down to 152", a claim contradicted by the
// two numbers inside it.
import { describe, it, expect } from 'vitest'
import { trendSentence } from './trendSentence'

const say = (earlierHr: number, nowHr: number, sessionLabel: 'easy running' | 'your long runs' = 'easy running') =>
  trendSentence({ earlierHr, nowHr, earlierMonth: 'Jun', sessionLabel })

describe('trendSentence — improvement', () => {
  it('reads as easier when the heart rate fell', () => {
    expect(say(152, 147)).toBe('Easy is easier than it was — 152 down to 147 since Jun.')
  })

  it('treats a flat trend as the better news, not as a cost', () => {
    // "held steady" is honest and is the kinder of the two readings.
    expect(say(150, 150)).toContain('easier than it was')
  })
})

describe('trendSentence — REGRESSION (the case that was wrong)', () => {
  it('never claims "easier" when the heart rate ROSE', () => {
    const s = say(147, 152)
    expect(s).not.toContain('easier')
    expect(s).not.toContain('down to')
  })

  it('says what actually happened, in the right direction', () => {
    expect(say(147, 152)).toContain('147 up to 152')
  })

  it('gives the benign reading before the caveat — no alarm register', () => {
    const s = say(147, 152)
    expect(s).toContain('common mid-build')
    // Never catastrophise: a rising easy HR mid-build is usually load.
    expect(s.toLowerCase()).not.toMatch(/\b(worse|declin|losing fitness|problem|warning)\b/)
  })

  it('FALSIFICATION — the OLD hardcoded line really was self-contradicting', () => {
    // Reproduces exactly what shipped, so this file fails loudly if anyone
    // reinstates the template. The numbers rise while the words say "down to".
    const earlierHr = 147, nowHr = 152
    const old = `Easy is easier than it was — ${earlierHr} down to ${nowHr} since Jun.`
    expect(nowHr).toBeGreaterThan(earlierHr)
    expect(old).toContain('down to')          // the sentence claims a fall
    expect(old).toContain('easier')           // ...and an improvement
    expect(say(earlierHr, nowHr)).not.toBe(old)
  })

  it('the threshold that produces the gloss is direction-blind — the root cause', () => {
    // `hrIsTrending = Math.abs(hrDeltaBpm) >= 4`. Pinned here because the whole
    // defect follows from that Math.abs, and a future reader should not have to
    // rediscover why a one-directional sentence was wrong.
    const MIN_HR_DELTA_BPM = 4
    expect(Math.abs(147 - 152)).toBeGreaterThanOrEqual(MIN_HR_DELTA_BPM)
    expect(Math.abs(152 - 147)).toBeGreaterThanOrEqual(MIN_HR_DELTA_BPM)
  })

  it('NAMES THE SESSION TYPE — it was claiming "easy" from long-run data', () => {
    // The read said "Easy is easier than it was" while fed `trendCardData`
    // (`session_type: 'long'`), with a card labelled "Easy run trend" directly
    // below it fed from a different cohort. Two numbers, one name.
    expect(say(152, 147, 'easy running')).toContain('Easy is easier')
    expect(say(152, 147, 'your long runs')).toContain('Your long runs are easier')
    expect(say(152, 147, 'your long runs')).not.toContain('Easy is')
  })

  it('keeps subject, verb and pronoun in agreement in BOTH directions', () => {
    // Singular vs plural travel together in one table rather than being
    // derived at the point of use — deriving it is how "they was" happens.
    expect(say(152, 147, 'your long runs')).toContain('they were')
    expect(say(147, 152, 'your long runs')).toContain('they did')
    expect(say(152, 147, 'easy running')).toContain('it was')
    expect(say(147, 152, 'easy running')).toContain('it did')
    for (const s of [say(152,147,'your long runs'), say(147,152,'your long runs')]) {
      expect(s).not.toMatch(/they was|it were|runs is |Easy are /)
    }
  })
})
