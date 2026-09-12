import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GENERATION_CONFIG } from './generationConfig'
import { SCORE_WEIGHTS, VERDICT_BANDS } from '@/lib/coaching/constants'

/**
 * CLAUDE.md's Configuration Singularity states a backstop that nothing enforced:
 *
 *   "Every entry in GENERATION_CONFIG has a corresponding section in
 *    docs/canonical/CoachingPrinciples.md explaining the principle behind the
 *    value. A numeric without a principle is a defect."
 *
 * It was doctrine with no mechanical check — the same shape as every other
 * failure this repo keeps finding: a rule that holds only while someone
 * remembers. Docs kept falling behind until the founder asked, which is the
 * symptom of exactly that.
 *
 * BASELINED, NOT RETROFITTED. 27 of 145 keys pre-date this check. Demanding 27
 * principle sections in one sitting is how a gate gets deleted instead of
 * satisfied — the property sweep's own debt register makes the same trade
 * ("a baseline is a debt register, not an amnesty"). What matters is that the
 * number cannot GROW: a new numeric without a principle now fails the build.
 *
 * Every entry below is a debt. Removing one is progress; adding one needs a
 * reason in the commit message.
 */

const PRINCIPLES = readFileSync(join(process.cwd(), 'docs/canonical/CoachingPrinciples.md'), 'utf8')

/** Keys that pre-date this check and carry no principle reference yet. */
const KNOWN_MISSING = new Set([
  'LOW_VOLUME_TAPER_THRESHOLD_KM', 'LOW_VOLUME_TAPER_REDUCTION_FACTOR_PCT',
  'RACE_WEEK_VOLUME_PCT', 'STRENGTH_ENABLED', 'QUALITY_PROGRESSION_RANGE_PCT',
  'RETURNING_RUNNER_VOLUME_THRESHOLD_PCT', 'PEAK_REACHED_THRESHOLD_PCT',
  'LONG_RUN_STEPBACK_CADENCE_N', 'LONG_RUN_STEPBACK_PCT',
  'MIN_HOURS_BETWEEN_LARGEST_SESSIONS',
  'RACE_PACE_DISTINCT_FROM_INTERVAL_PACE', 'MAX_HR_FORMULA',
  'FOUNDATION_GAP_NUDGE_DAYS', 'FOUNDATION_GAP_AUTO_DAYS', 'FOUNDATION_MAX_WEEKS',
  'FOUNDATION_WEEKLY_INCREASE_PCT', 'FRESH_RETURN_EFFECTIVE_BASELINE_FRACTION',
  'STIMULUS_RANK', 'LR_MAX_CONSECUTIVE_REPEATS', 'LR_REPEAT_INCREMENT_KM',
  'LR_RACE_DISTANCE_MULT_SHORT', 'LR_RACE_DISTANCE_MULT_LONG',
  'PRE_PLAN_BUFFER_WEEKS_THRESHOLD', 'DAYS_AVAILABILITY_THRESHOLDS',
  'DAYS_AVAILABILITY_RETURNING_RUNNER_SHIFT', 'V1_VOLUME_QUALITY_SPLIT_THRESHOLD_PCT',
])

/**
 * §108 / UX-POSTRUN-01 (2026-09-12) — THE SINGULARITY WAS BYPASSED BY A FILE
 * PATH, FOR THE SECOND TIME.
 *
 * This check read `GENERATION_CONFIG` and nothing else, so any coaching numeric
 * that lived in a different file was invisible to it. `SCORE_WEIGHTS`
 * (hr_discipline 0.50 / distance 0.25 / pace 0.15 / ef 0.10) and `VERDICT_BANDS`
 * (80 / 60 / 40) sat in `lib/coaching/constants.ts` with no principle and no
 * check — and they decide whether a runner is told their run was "nailed" or
 * "concerning".
 *
 * That is `peakKmByLevel` verbatim, which CLAUDE.md already records: "every
 * governance layer this project has, bypassed by a table being in the wrong
 * place." Widening the check is the only fix that does not depend on someone
 * remembering.
 */
const COACHING_CONSTANTS = { SCORE_WEIGHTS, VERDICT_BANDS } as const

const keys = [
  ...Object.keys(GENERATION_CONFIG),
  // Nested one level: the principle must name the WEIGHT, not just the group —
  // "SCORE_WEIGHTS" appearing once would otherwise document four numbers with
  // one word, which is how a table ends up explained by its own title.
  ...Object.entries(COACHING_CONSTANTS).flatMap(([group, v]) =>
    typeof v === 'object' && v !== null ? Object.keys(v).map(k => `${group}.${k}`) : [group]),
]

/** `SCORE_WEIGHTS.hr_discipline` is documented by a section naming both parts. */
const documented = (k: string): boolean => {
  if (!k.includes('.')) return PRINCIPLES.includes(k)
  const [group, leaf] = k.split('.')
  return PRINCIPLES.includes(group!) && PRINCIPLES.includes(leaf!)
}

const missing = keys.filter(k => !documented(k))

describe('Configuration Singularity — every numeric points back to a principle', () => {
  it('no NEW config key ships without a principle section', () => {
    const undocumented = missing.filter(k => !KNOWN_MISSING.has(k))
    expect(
      undocumented,
      `Add a section to docs/canonical/CoachingPrinciples.md explaining these, or ` +
      `state in the commit why the value is a FACT rather than a coaching choice ` +
      `(CLAUDE.md's tunability test: "if a coach could reasonably want to tune it → ` +
      `config; if it's a fact → inline"): ${undocumented.join(', ')}`,
    ).toEqual([])
  })

  it('the debt register does not go stale', () => {
    // A key that has since GAINED a principle must leave the list, or the list
    // slowly becomes a place to hide new debt. Same discipline as the sweep's
    // stale-exemption arm, which caught its own dead entry the day it shipped.
    const resolved = Array.from(KNOWN_MISSING).filter(k => !missing.includes(k))
    expect(
      resolved,
      `These now have a principle — remove them from KNOWN_MISSING to lock the ` +
      `progress in: ${resolved.join(', ')}`,
    ).toEqual([])
  })

  it('the debt is only ever paid down, never grown', () => {
    // The number itself, pinned. Lower it when you fix one.
    expect(missing.length).toBeLessThanOrEqual(KNOWN_MISSING.size)
  })

  it('the check can actually fail — it is not vacuous', () => {
    // A parser that silently found nothing would make all three assertions above
    // pass forever. Prove the source is real and the matching works.
    expect(keys.length).toBeGreaterThan(100)
    expect(PRINCIPLES.length).toBeGreaterThan(50_000)
    expect(PRINCIPLES).toContain('EFFORT_GOVERNED_RECOVERY_SECS')   // added today, documented
    expect(PRINCIPLES).not.toContain('A_KEY_THAT_DOES_NOT_EXIST')
  })

  it('§108 — the score weights sum to 1.0', () => {
    // A weighting that does not sum to 1 silently rescales every run's score and
    // moves every verdict band with it, without changing a single band value.
    const total = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1.0, 6)
  })

  it('§108 — the verdict bands descend and stay inside the 0-100 scale', () => {
    const { nailed, close, off_target } = VERDICT_BANDS
    expect(nailed).toBeGreaterThan(close)
    expect(close).toBeGreaterThan(off_target)
    expect(off_target).toBeGreaterThan(0)
    expect(nailed).toBeLessThanOrEqual(100)
  })

  it('the widened check can fail — coaching constants are really being read', () => {
    // Without this, pointing the check at an empty object would pass silently.
    expect(keys).toContain('SCORE_WEIGHTS.hr_discipline')
    expect(keys).toContain('VERDICT_BANDS.nailed')
  })
})
