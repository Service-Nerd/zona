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
  // FOUNDATION_MAX_WEEKS left this register 2026-09-15 — §57's
  // FOUNDATION-LONG-RUNWAY-01 amendment explains the 3, and why raising it was
  // vetoed on measurement (the ×1.10 ceiling binds from week 2).
  'FOUNDATION_GAP_NUDGE_DAYS', 'FOUNDATION_GAP_AUTO_DAYS',
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

/**
 * 🔴 RESHAPE-CONFIG-GATE-01 (2026-10-08) — THE SAME BYPASS, A THIRD TIME, AND THIS CHECK
 * WAS THE THING THAT WAS SUPPOSED TO HAVE ENDED IT.
 *
 * The comment above says, correctly, that "widening the check is the only fix that does not
 * depend on someone remembering". It was then widened to **two named exports** —
 * `SCORE_WEIGHTS` and `VERDICT_BANDS` — and stopped. **A hand-written surface list is the
 * same hole one file deeper**, which is this repo's `A checker sharing the producer's LIST
 * is blind to that list` class.
 *
 * What it could not see: the whole **reshape engine**. Measured 2026-10-08,
 * `lib/coaching/constants.ts` exports 41 constants and **12 had no principle**, including
 * `SHADOW_LOAD_THRESHOLD_PCT`, `EF_DECLINE_THRESHOLD_PCT` and `MAX_ADJUSTMENTS_PER_WEEK` —
 * three numbers that decide whether a real runner's plan is rewritten, with no written
 * reason anywhere. The founder asked whether the reshape rules had been ruled and documented;
 * for those three the answer was no, and nothing in the repo could have told him.
 *
 * ⚠️ SO THE LIST IS DERIVED FROM THE FILE, NOT TYPED HERE. Every `export const NAME` in
 * `lib/coaching/constants.ts` is covered the day it is written. The two objects above keep
 * their explicit nested treatment because a principle must name the LEAF, not the group.
 */
const CONSTANTS_SRC = readFileSync(
  join(process.cwd(), 'lib/coaching/constants.ts'), 'utf8',
)
// ⚠️ `Array.from`, not a spread. `[...x.matchAll(...)]` fails this tsconfig with TS2802,
// the same family as the `[...seen]` on a `Set<string>` that CLAUDE.md already records.
// It passes under vitest (esbuild does not care) and fails under `tsc`, so the spread
// version would have shipped green locally and broken the build.
const CONSTANTS_EXPORTS = Array.from(
  CONSTANTS_SRC.matchAll(/^export const ([A-Z][A-Z0-9_]*)\s*[:=]/gm),
).map(m => m[1]!)

const keys = [
  ...Object.keys(GENERATION_CONFIG),
  // Nested one level: the principle must name the WEIGHT, not just the group —
  // "SCORE_WEIGHTS" appearing once would otherwise document four numbers with
  // one word, which is how a table ends up explained by its own title.
  ...Object.entries(COACHING_CONSTANTS).flatMap(([group, v]) =>
    typeof v === 'object' && v !== null ? Object.keys(v).map(k => `${group}.${k}`) : [group]),
  // …and every other top-level constant in that file, the group names above excluded
  // so they are not demanded twice under two different rules.
  ...CONSTANTS_EXPORTS.filter(n => !(n in COACHING_CONSTANTS)),
]

/** `SCORE_WEIGHTS.hr_discipline` is documented by a section naming both parts. */
const documented = (k: string): boolean => {
  if (!k.includes('.')) return PRINCIPLES.includes(k)
  const [group, leaf] = k.split('.')
  return PRINCIPLES.includes(group!) && PRINCIPLES.includes(leaf!)
}

// 🔻 RESHAPE-CONFIG-GATE-01's debt register. Each entry carries WHY and WHEN, because
// CLAUDE.md's own warning applies to the pattern I am using here: "a declared reason is
// not a fixed problem … nothing in this repo schedules it." A dated entry at least makes
// the age visible to the next reader.
//
// FACT = not a coaching choice, exempt under CLAUDE.md's tunability test ("if a coach
//        could reasonably want to tune it → config; if it's a fact → inline").
// DEBT = a real coaching choice with no written reason. Owned by
//        `RESHAPE-PRINCIPLE-DEBT-01` (🏃 Coaching Board).
const CONSTANTS_DEBT: Record<string, string> = {
  COACHING_RULE_ENGINE_VERSION:    'FACT 2026-10-08 — a version string, not a coaching value',
  RUN_HR_PLAUSIBLE:                'FACT 2026-10-08 — a physiological plausibility bound for rejecting junk data, not a prescription',
  HR_ZONE_TOLERANCE_BPM:           'FACT 2026-10-08 — measurement tolerance on a device reading',
  ZONE_BLOCK_VERDICT_MIN_RUNS:     'DEBT 2026-10-08 — how many runs before we will judge a block',
  ZONE_DISCIPLINE_BANDS:           'DEBT 2026-10-08 — and its only reader `classifyZoneDiscipline` has NO call sites (see configConsumer limits)',
  SHADOW_LOAD_THRESHOLD_PCT:       'DEBT 2026-10-08 — 15% over plan triggers a reflection. Is this ADR-012\'s 15% or a coincidence?',
  EF_DECLINE_THRESHOLD_PCT:        'DEBT 2026-10-08 — why -8% and not -5 or -12? Reshapes a real plan',
  EF_BASELINE_WINDOW:              'DEBT 2026-10-08 — the window the decline is measured against',
  MAX_ADJUSTMENTS_PER_WEEK:        'DEBT 2026-10-08 — 2. A coaching limit or a politeness limit? Nobody has said',
  MIN_QUALITY_GAP_HOURS:           'DEBT 2026-10-08 — spacing between quality sessions; adjacent to §12 and not joined to it',
  MAX_VOLUME_INCREASE_PCT:         'DEBT 2026-10-08 — overlaps GENERATION_CONFIG\'s own increase caps; which binds?',
  TREND_PACE_CONFOUND_SEC_PER_KM:  'DEBT 2026-10-08 — the trend card\'s noise floor',
}

const missing = keys.filter(k => !documented(k))

describe('Configuration Singularity — every numeric points back to a principle', () => {
  it('no NEW config key ships without a principle section', () => {
    // RESHAPE-CONFIG-GATE-01: a key declared in CONSTANTS_DEBT with a FACT/DEBT reason
    // is accounted for by its own arms below, not ignored.
    const undocumented = missing.filter(k => !KNOWN_MISSING.has(k) && !(k in CONSTANTS_DEBT))
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
    expect(missing.length).toBeLessThanOrEqual(KNOWN_MISSING.size + Object.keys(CONSTANTS_DEBT).length)
  })

  it('🔴 every undocumented coaching constant carries a REASON, not just a pass', () => {
    // The arm that makes the widening honest. A baseline without reasons is a list of
    // numbers nobody has to defend — which is how `KNOWN_MISSING` above grew to 27.
    const undeclared = CONSTANTS_EXPORTS
      .filter(n => !(n in COACHING_CONSTANTS))
      .filter(n => !PRINCIPLES.includes(n))
      .filter(n => !(n in CONSTANTS_DEBT))
    expect(
      undeclared,
      `A new coaching constant in lib/coaching/constants.ts has no principle AND no ` +
      `declared reason. Write the principle, or add it to CONSTANTS_DEBT with FACT/DEBT ` +
      `and a date: ${undeclared.join(', ')}`,
    ).toEqual([])
  })

  it('the constants debt register does not go stale either', () => {
    const resolved = Object.keys(CONSTANTS_DEBT).filter(k => PRINCIPLES.includes(k))
    expect(
      resolved,
      `These now have a principle — remove them from CONSTANTS_DEBT: ${resolved.join(', ')}`,
    ).toEqual([])
  })

  it('…and names every entry FACT or DEBT, so the two never blur', () => {
    // ⚠️ A reason that says neither is the thing this arm exists to prevent: "exempt" and
    // "not done yet" are different states and only one of them should ever shrink.
    for (const [k, why] of Object.entries(CONSTANTS_DEBT)) {
      expect(why, `${k}'s reason must start FACT or DEBT`).toMatch(/^(FACT|DEBT) \d{4}-\d{2}-\d{2} — /)
    }
  })

  it('🔴 the RESHAPE thresholds are really inside the derived population', () => {
    // The falsification target. If the regex or the path ever stops matching, these three
    // vanish and every arm above passes on an empty set — this repo's `an empty population
    // renders as a clean result` class, recorded earlier the same day.
    for (const k of ['SHADOW_LOAD_THRESHOLD_PCT', 'EF_DECLINE_THRESHOLD_PCT', 'MAX_ADJUSTMENTS_PER_WEEK']) {
      expect(CONSTANTS_EXPORTS).toContain(k)
      expect(keys).toContain(k)
    }
    // And the file really was read: 41 exports measured 2026-10-08, so a parse returning a
    // handful means the regex broke, not that the file shrank.
    expect(CONSTANTS_EXPORTS.length).toBeGreaterThan(30)
  })

  it('the check can actually fail — it is not vacuous', () => {
    // A parser that silently found nothing would make all three assertions above
    // pass forever. Prove the source is real and the matching works.
    expect(keys.length).toBeGreaterThan(100)
    expect(PRINCIPLES.length).toBeGreaterThan(50_000)
    expect(PRINCIPLES).toMatch(/\bEFFORT_GOVERNED_RECOVERY_SECS\b/)   // added today, documented
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
