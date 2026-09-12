import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// TREND-PACE-CLAIM-01 — a mechanical guard on the trend card's PROSE.
//
// The SLT flagged the gap: `raceProjectionHonesty.test.ts` polices the race
// copy tree and nothing polices this one, which is where the wrong claim
// lived. Prose about a method drifts from the method and nothing fails when it
// does — the homepage's "four answers" survived five wizard changes.
//
// This is a source grep, deliberately. The strings are inline JSX, so there is
// no copy tree to walk, and centralising them purely to make them testable
// would be a bigger change than the claim is worth.

const SRC = readFileSync(join(process.cwd(), 'components/shared/TrendCard.tsx'), 'utf8')

/**
 * Claims the cohort cannot support. `buildHrTrendSeries` matches on DISTANCE
 * (±COHORT_SIMILARITY.DISTANCE_TOLERANCE_PCT) and a date window. It does not
 * control for pace, effort, terrain, temperature or route.
 */
const UNSUPPORTED = /\b(at the same (pace|effort|speed)|same[- ]pace|like[- ]for[- ]like runs)\b/i

describe('trend card copy states only what the cohort controls for', () => {
  it('makes no "at the same pace" or "same effort" claim', () => {
    const hit = SRC.match(UNSUPPORTED)
    expect(
      hit?.[0] ?? null,
      'The trend cohort is matched on DISTANCE only — pace and effort are free ' +
      'to move inside it. Claiming otherwise told a runner who simply eased off ' +
      'that their aerobic base was growing (TREND-PACE-CLAIM-01).',
    ).toBeNull()
  })

  it('FALSIFICATION — the matcher catches the exact sentence that shipped', () => {
    // Verbatim from the card before 2026-09-12. If this stops matching, the
    // guard above has quietly stopped guarding.
    const shipped = 'Your average heart rate on long runs at the same pace, compared across the last 6 months.'
    expect(UNSUPPORTED.test(shipped)).toBe(true)
  })

  it('FALSIFICATION — it does not fire on the honest replacement', () => {
    const now = 'Your average heart rate on easy runs of a similar distance, compared across the last 6 months. ' +
                'When HR drops and your pace holds, your aerobic base is growing.'
    expect(UNSUPPORTED.test(now)).toBe(false)
  })

  it('still tells the runner what IS held constant', () => {
    // Removing the false claim must not leave the method unstated.
    expect(SRC).toMatch(/similar distance/i)
  })

  it('names pace as uncontrolled rather than quietly omitting it', () => {
    expect(SRC).toMatch(/Pace is not held fixed/i)
  })
})
