// §108 + Amendment 1 — what a run scores, and when it scores nothing.
//
// ⚠️ This file did not exist before 2026-09-13. `scoreSession` decides whether a
// runner is told "nailed" or "concerning" and had ZERO tests, which is how the
// defect below shipped and survived a board sitting that ratified its weights.
//
// THE DEFECT. When HR was unmeasured the function substituted **75** for the axis
// carrying **half** the weight, so 37.5 points of every no-HR score were invented.
// Measured in production: 12 of 126 scored runs (9.5%) had no HR at all, and
// SEVEN of those were told "nailed" — a verdict about intensity discipline on a
// run where intensity was never observed. §108 gives that axis 0.50 precisely
// "because it is the only axis that speaks to intensity distribution, which is
// the product's entire thesis".
//
// It also inverted the incentive: the same run scored worse WITH a monitor than
// without one, while the coach note told the runner to wear it.
import { describe, it, expect } from 'vitest'
import { scoreSession, type SessionScoreInput } from './sessionScore'
import { SCORE_WEIGHTS } from './constants'
import type { Session } from '@/types/plan'

const easySession = (o: Partial<Session> = {}): Session => ({
  id: 'w34-sun',
  type: 'easy',
  label: 'Easy with strides',
  detail: null,
  distance_km: 9,
  duration_mins: 60,
  primary_metric: 'distance',
  zone: 'Zone 2',
  hr_target: '< 148 bpm',
  pace_target: '7:00–7:45 /km',
  rpe_target: 4,
  ...o,
} as Session)

const base = (o: Partial<SessionScoreInput> = {}): SessionScoreInput => ({
  session: easySession(),
  actualDistKm: 12,
  actualAvgHr: null,
  actualAvgSpeedMs: 1000 / (7 * 60 + 33),  // 7:33 /km
  hrInZonePct: null,
  efValue: null,
  efBaseline: null,
  ...o,
})

describe('§108 Amendment 1 — no composite when HR is unmeasured', () => {
  it("the founder's own run: no HR, so no score and no verdict", () => {
    // The screenshot that opened this: SUN week 34, "Easy with strides",
    // 12 km logged from Apple Health against a 9 km plan, HR column showing "—",
    // and a confident **69/100 · Close. Bit of fine-tuning to do.** across the top.
    // 37.5 of those 69 points were a default for an axis nothing measured.
    const r = scoreSession(base())
    expect(r.hrDisciplineScore, 'HR genuinely has no data').toBeNull()
    expect(r.totalScore, 'so there is no composite to show').toBeNull()
    expect(r.verdict, 'and no verdict to claim').toBeNull()
  })

  it('the measured axes survive — withholding the total is not withholding everything', () => {
    const r = scoreSession(base())
    expect(r.distanceScore).toBeGreaterThan(0)
    expect(r.paceScore).toBeGreaterThan(0)
    expect(typeof r.efScore).toBe('number')
  })

  it('FALSIFICATION — the 75-substitution is exactly the 69 the runner saw', () => {
    // Uses the axis scores PRINTED ON THE SCREENSHOT (distance 50, pace 75,
    // efficiency 75) rather than this fixture's, because the session's exact
    // pace band is not recoverable from an image and guessing it would make the
    // arithmetic look reproduced when it was tuned. These three are observed
    // facts; the 69 falls out of them and the old 75 default.
    const SEEN = { distance: 50, pace: 75, ef: 75 }
    const oldTotal = Math.round(
      75 * SCORE_WEIGHTS.hr_discipline +
      SEEN.distance * SCORE_WEIGHTS.distance +
      SEEN.pace * SCORE_WEIGHTS.pace +
      SEEN.ef * SCORE_WEIGHTS.ef,
    )
    expect(oldTotal, 'the 69/100 on screen was 37.5 points of default').toBe(69)

    // Over half of it came from the axis nothing measured.
    const fabricated = 75 * SCORE_WEIGHTS.hr_discipline
    expect(fabricated / oldTotal).toBeGreaterThan(0.5)

    // And the fixture's own measured axes match the two that are unambiguous.
    const r = scoreSession(base())
    expect(r.distanceScore).toBe(SEEN.distance)
    expect(r.efScore).toBe(SEEN.ef)
    expect(r.totalScore, 'no number is shown now').toBeNull()
  })

  it('a run WITH heart rate still scores normally', () => {
    const r = scoreSession(base({ hrInZonePct: 92 }))
    expect(r.hrDisciplineScore).toBe(92)
    expect(r.totalScore).not.toBeNull()
    expect(r.verdict).not.toBeNull()
  })

  it('THE INVERTED INCENTIVE IS GONE — not measuring can no longer beat measuring', () => {
    // Before: identical run scored 41 ("off target") with a monitor showing poor
    // discipline, and 69 ("close") with no monitor at all. Leaving the strap at
    // home was worth 28 points, while Kit told the runner to wear it.
    //
    // The incentive cannot exist now, because the unmeasured run yields no number
    // to compare against. That is the property under test, not a threshold.
    const poorHr = scoreSession(base({ hrInZonePct: 20 }))
    const noHr   = scoreSession(base())
    expect(poorHr.totalScore, 'a measured bad run still scores').not.toBeNull()
    expect(noHr.totalScore, 'an unmeasured run scores nothing at all').toBeNull()
  })

  it('a bad HR run is scored honestly rather than softened', () => {
    const r = scoreSession(base({ hrInZonePct: 20 }))
    expect(r.totalScore!).toBeLessThan(50)
    expect(r.verdict).toBe('off_target')
  })

  it('the HR axis really does carry half the weight (§108)', () => {
    // Guards the claim the amendment rests on: if this weight ever drops below
    // half, "withhold the whole composite" stops being proportionate and the
    // amendment needs revisiting rather than silently over-applying.
    expect(SCORE_WEIGHTS.hr_discipline).toBe(0.5)
    const sum = SCORE_WEIGHTS.hr_discipline + SCORE_WEIGHTS.distance
      + SCORE_WEIGHTS.pace + SCORE_WEIGHTS.ef
    expect(sum).toBeCloseTo(1, 10)
  })

  it('a single avg HR still counts as measured — this is not an Apple-Watch-only rule', () => {
    // The fallback path (avg HR vs the ceiling parsed from hr_target) is a real
    // measurement, coarser than a stream but observed. Withholding there too
    // would punish chest-strap and older-device runners for the engine's
    // preference for streams.
    const r = scoreSession(base({ actualAvgHr: 140 }))
    expect(r.hrDisciplineScore).not.toBeNull()
    expect(r.totalScore).not.toBeNull()
  })
})
