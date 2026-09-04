import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GENERATION_CONFIG } from './generationConfig'

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
  'INJURY_WEEKLY_INCREASE_CAP_PCT', 'MIN_HOURS_BETWEEN_LARGEST_SESSIONS',
  'RACE_PACE_DISTINCT_FROM_INTERVAL_PACE', 'MAX_HR_FORMULA',
  'FOUNDATION_GAP_NUDGE_DAYS', 'FOUNDATION_GAP_AUTO_DAYS', 'FOUNDATION_MAX_WEEKS',
  'FOUNDATION_WEEKLY_INCREASE_PCT', 'FRESH_RETURN_EFFECTIVE_BASELINE_FRACTION',
  'STIMULUS_RANK', 'LR_MAX_CONSECUTIVE_REPEATS', 'LR_REPEAT_INCREMENT_KM',
  'LR_RACE_DISTANCE_MULT_SHORT', 'LR_RACE_DISTANCE_MULT_LONG',
  'PRE_PLAN_BUFFER_WEEKS_THRESHOLD', 'DAYS_AVAILABILITY_THRESHOLDS',
  'DAYS_AVAILABILITY_RETURNING_RUNNER_SHIFT', 'V1_VOLUME_QUALITY_SPLIT_THRESHOLD_PCT',
])

const keys = Object.keys(GENERATION_CONFIG)
const missing = keys.filter(k => !PRINCIPLES.includes(k))

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
})
