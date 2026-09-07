import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { GENERATION_CONFIG } from './generationConfig'
import { PLAN_SIGNATURES } from './planSignatures'

/**
 * THE SIBLING GAP. `configPrincipleSync.test.ts` proves every GENERATION_CONFIG
 * key has a PRINCIPLE. Nothing proved any key has a CONSUMER.
 *
 * So a key could be authored, ratified by the Coaching Board, documented in
 * CoachingPrinciples.md, pass the sync test — and be read by nothing. That is
 * not hypothetical; it is the single most expensive failure class in this repo's
 * history, and it has now landed three times:
 *
 *   §1  INTENSITY_DISTRIBUTION  — declared in MINUTES, engine counted SESSIONS.
 *       Wrong for four months. CD-19: "the table was read by an offline script
 *       and by no engine code, and no invariant referenced it. The value being
 *       wrong was downstream of it never being exercised."
 *   §17 quality_categories_focus — the 10K signature declared ['vo2max',
 *       'threshold'] while the engine hardcoded 'threshold'. Half the declared
 *       focus was unreachable (SC-07/CD-16).
 *   §5  SPECIFICITY_BY_PHASE    — declared peak 60% specific since R23, read by
 *       NOTHING. 10K peak delivered 0%, the exact inverse, invisibly, until it
 *       was measured by hand on 2026-09-07 (§93).
 *
 * Each was found by a human noticing. This test is the mechanism that means the
 * fourth one is found by CI.
 *
 * A constant nothing reads is not configuration. It is a comment with a type
 * annotation — and it is worse than a comment, because it implies a switch that
 * does not exist. Changing MAX_HR_FORMULA to 'fox' would do precisely nothing.
 */

const ROOTS = ['lib', 'app', 'components', 'scripts']
const SELF = ['generationConfig.ts', 'planSignatures.ts']

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (!/node_modules|\.next|\.git/.test(p)) sourceFiles(p, out)
    } else if (/\.(ts|tsx|mjs)$/.test(e.name)) {
      out.push(p)
    }
  }
  return out
}

/**
 * DECLARATIVE — permanent, legitimate non-consumers.
 *
 * These record a decision that is implemented STRUCTURALLY rather than read at
 * runtime. They are not debt and will never be wired; the entry exists so a
 * reader can tell "deliberately declarative" from "quietly dead", which is the
 * whole distinction this file was written to make visible.
 *
 * The bar for adding one: flipping the value could not change behaviour even in
 * principle, because the behaviour is expressed in code shape rather than in a
 * branch on this value. If flipping it SHOULD change behaviour, it is debt.
 */
const DECLARATIVE: Record<string, string> = {
  MAX_HR_FORMULA:
    "§14 — Tanaka is implemented directly in maxHrGuard.ts. There is no second formula to select between, so this names the choice rather than making it.",
  USE_PACE_RANGES_NOT_POINTS:
    "§11 — every pace is produced by paceBandStr, which returns a band. A points mode does not exist to switch to.",
  EASY_RUN_ZONE_CAP:
    "§12 — the easy ceiling IS the Z2 top by construction (zones.zone2Ceiling). The string names that relationship; it does not choose it.",
  DISPLAY_ZONE_SOURCE:
    "§84 — display reads session.zone, enforced by INV-PLAN-DISPLAY-ZONE-MATCHES-WORK. The alternative (a type→zone map) is the defect §84 removed, not a supported mode.",
  DELOAD_PLACEMENT:
    "§87 — the four sub-rules are implemented in deloadCadence.ts's re-anchoring walk, which cannot express them as independent toggles (§87 records that rules 1 and 3 are jointly unsatisfiable by a naive shift). Kept as the board's ratified record of WHY that walk has its shape.",
}

/**
 * UNWIRED — debt, not amnesty. Each of these SHOULD have a consumer and does not.
 * Removing one is progress. Adding one needs a reason in the commit message.
 */
const UNWIRED: Record<string, string> = {
  // Empty, and worth keeping empty. The one entry this register opened with —
  // LR_BUILD_Z2_CEILING_SEGMENT_PCT — was resolved the same day by deleting the
  // numeric and correcting §24c to describe the whole-run cue that actually
  // ships, rather than inventing a 10% segment to justify a constant.
}

describe('Configuration Singularity — every numeric has a consumer, not just a principle', () => {
  const keys = Object.keys(GENERATION_CONFIG)
  const files = ROOTS.flatMap(r => sourceFiles(r))
    .filter(f => !SELF.some(x => f.endsWith(x)))
    .map(f => ({ f, text: readFileSync(f, 'utf8') }))

  // A consumer is a reference from code that actually runs in the product.
  // Tests and one-off scripts do not count: a key read only by its own test is
  // exactly the shape §5 had, and calling that "consumed" would defeat the check.
  const isProductCode = (f: string) =>
    !/\.test\.|\.spec\.|^scripts\//.test(f) && !f.includes('/__')

  // Substring match, deliberately crude and deliberately BIASED TOWARD PASSING:
  // a key named in a comment counts as consumed. That is the right bias for a
  // gate — it cannot produce a false accusation, only miss a real orphan — and
  // it is the same trade configPrincipleSync makes. Every orphan it DID report
  // was verified by hand before being wired, deleted or registered.
  const consumersOf = (key: string) =>
    files.filter(({ f, text }) => isProductCode(f) && text.includes(key)).map(({ f }) => f)

  it('no NEW config key ships without a consumer', () => {
    const orphans = keys.filter(k =>
      !(k in DECLARATIVE) && !(k in UNWIRED) && consumersOf(k).length === 0)

    expect(orphans, [
      'These GENERATION_CONFIG keys are read by no product code.',
      'A key nothing reads cannot affect a runner, however carefully it was ratified —',
      'and it will read as load-bearing to the next person who finds it.',
      'Wire it, delete it, or add it to DECLARATIVE with the reason it can never be wired.',
    ].join('\n')).toEqual([])
  })

  it('the DECLARATIVE list stays honest — nothing on it has quietly gained a consumer', () => {
    // A stale exemption is how a register becomes a lie. Same rule the principle
    // sync test applies to its own debt: entries must be removed once satisfied.
    const nowWired = Object.keys(DECLARATIVE).filter(k => consumersOf(k).length > 0)
    expect(nowWired, 'these are wired now — remove them from DECLARATIVE').toEqual([])
  })

  it('the UNWIRED debt register only shrinks', () => {
    const stillUnwired = Object.keys(UNWIRED).filter(k => consumersOf(k).length === 0)
    expect(stillUnwired.length, 'debt must not grow').toBeLessThanOrEqual(Object.keys(UNWIRED).length)

    const fixed = Object.keys(UNWIRED).filter(k => consumersOf(k).length > 0)
    expect(fixed, 'these now have consumers — delete them from UNWIRED').toEqual([])
  })

  /**
   * PLAN_SIGNATURES — the same check, and it found the worse half.
   *
   * §17 names this table as the authority for per-distance plan shape. Scanned
   * 2026-09-07: **12 of 14 fields had no product consumer.** Only `min_weeks` and
   * `quality_categories_focus` were read. The table that supposedly makes a 5K
   * plan differ from a 100K plan was 86% decorative — and §24b/SC-07's history
   * shows exactly how that survives, because a declared-and-unread field looks
   * identical to a working one.
   *
   * The cause is not carelessness: PLAN_SIGNATURES is largely a v1 design
   * document that the R23 rebuild superseded with GENERATION_CONFIG, and only
   * half of it was deleted. §17 kept pointing at all of it.
   */
  const SIG_SUPERSEDED: Record<string, string> = {
    long_run_cap_minutes:
      'Superseded by GENERATION_CONFIG.LONG_RUN_CAP_MINUTES, which is wired and enforced by INV-PLAN-LONG-CAP-MINS.',
    taper_final_session:
      'Superseded by GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK, which drives both taper length and its session sequence.',
    sessions_per_week_default:
      'Superseded by the runner\'s own WeekGrid answer (days_available). A per-distance default would override a stated constraint, which §18 forbids.',
    ideal_weeks:
      'Superseded by DISTANCE_CONFIGS.idealWeeks in length.ts, which is what calcPlanLength actually reads. Its sibling `max_weeks` WAS listed here and is now live (§97) — calcPlanLength reads it for a §89-gated runner, which is what stopped their surplus weeks becoming a §57 foundation block. Removing it from this register is the register working.',
  }

  const SIG_UNBUILT: Record<string, string> = {
    peak_includes_race_pace:
      'HM peak DOES carry race pace, but via preferredQualityCategory\'s hardcoded distance branch, not this flag. Anyone reasoning from the flag is reasoning about nothing.',
    peak_includes_mp_long_runs:
      'Same shape as above for MARATHON.',
    mp_long_run_frequency_weeks:
      'Marathon-pace long-run cadence: declared every 2 weeks, never scheduled on that cadence.',
    back_to_back_from_phase:
      'The back_to_back_long catalogue row exists; the declared PHASE it should start in is not read.',
    back_to_back_frequency_weeks:
      'Ditto the declared cadence — ultras get back-to-backs only if the ordinary rotation happens to pick them.',
    fuelling_practice_from_week:
      'No implementation. Fuelling appears inside the time_on_feet row\'s structure, but the declared "from week 8" cadence does not exist.',
    time_on_feet_sessions_in_peak:
      'The time_on_feet row exists; the declared count of 2 in peak is not enforced.',
    night_run_optional:
      'No implementation of any kind.',
  }

  it('PLAN_SIGNATURES — no field is silently dead', () => {
    const sigFields = Array.from(new Set<string>(
      Object.values(PLAN_SIGNATURES).flatMap(sig => Object.keys(sig))))
    const orphans = sigFields.filter(k =>
      !(k in SIG_SUPERSEDED) && !(k in SIG_UNBUILT) && consumersOf(k).length === 0)

    expect(orphans, [
      'These PLAN_SIGNATURES fields are read by no product code.',
      '§17 names this table as the authority for per-distance plan shape, so a dead',
      'field here reads as a shipped behavioural difference that does not exist.',
    ].join('\n')).toEqual([])
  })

  it('PLAN_SIGNATURES — the superseded and unbuilt registers only shrink', () => {
    const revived = [...Object.keys(SIG_SUPERSEDED), ...Object.keys(SIG_UNBUILT)]
      .filter(k => consumersOf(k).length > 0)
    expect(revived, 'these now have consumers — remove them from their register').toEqual([])
  })

  it('the distance paywall reads the signature, not a second hardcoded list', () => {
    // free_tier_available used to be duplicated as a `paid:` boolean in
    // GeneratePlanScreen. They agreed, so nothing was broken — but the screen was
    // the real authority for who pays while §17 claimed the signature was.
    // Changing the documented source of truth would not have moved the paywall.
    expect(consumersOf('free_tier_available').some(f => f.includes('GeneratePlanScreen')))
      .toBe(true)
    // And the derivation must still produce the commercial split we intend.
    expect(PLAN_SIGNATURES['5K'].free_tier_available).toBe(true)
    expect(PLAN_SIGNATURES['10K'].free_tier_available).toBe(true)
    expect(PLAN_SIGNATURES['HM'].free_tier_available).toBe(true)
    expect(PLAN_SIGNATURES['MARATHON'].free_tier_available).toBe(false)
    expect(PLAN_SIGNATURES['50K'].free_tier_available).toBe(false)
    expect(PLAN_SIGNATURES['100K'].free_tier_available).toBe(false)
  })

  it('FALSIFICATION — the check can actually go red', () => {
    // A gate nobody has watched fail is a gate nobody can trust. Prove the
    // detector finds an orphan by asking it about a key that cannot exist.
    const invented = 'ZZZ_KEY_THAT_NOTHING_READS'
    expect(consumersOf(invented)).toEqual([])
    // ...and prove it does NOT report a false orphan for a key that is plainly used.
    expect(consumersOf('MAX_WEEKLY_VOLUME_INCREASE_PCT').length).toBeGreaterThan(0)
  })
})
