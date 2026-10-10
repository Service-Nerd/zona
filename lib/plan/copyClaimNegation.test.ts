// ENRICH-COPY-NEGATION-01 — "No quality work this week" is not a promise of quality.
//
// 🔴 THE DEFECT, MEASURED ON LIVE TRAFFIC (2026-10-02). `COPY_CLAIMS_INTENSITY_NAMED`
// is a bare keyword test, so copy saying there is NO quality matched `quality` and
// `INV-PLAN-COPY-MATCHES-SESSIONS` fired at `error` severity. Because that check runs
// POST-ENRICH, the whole enriched plan was discarded and the runner silently received
// the rule-engine copy instead — ADR-006 makes that fallback silent by design.
//
// 3 of the day's 9 enrichments, across 2 runners from the Make-A-Wish cohort, were
// thrown away for this. 26 violations of the code in the stored window.
//
// ⚠️ THE OTHER DIRECTION IS WHY THIS CHECK EXISTS AT ALL. The four-literal denylist it
// replaced let "One quality session. Everything else stays easy." and "Build — first
// quality session" through for FOURTEEN WEEKS (analysis F4/N4). Those must still fire,
// and they are asserted below. A negation fix that swallows them re-opens the original.
import { describe, it, expect } from 'vitest'
import { copyClaimsIntensity, withoutNonClaimClauses } from './invariants'

/** The three week themes that were actually discarded in production on 2026-10-02. */
const LIVE_HONEST_DELOADS: Array<[string, string]> = [
  ['Build — deload', 'Pull back to 21 km. No quality work this week. The Sunday run drops to 8.5 km. Recovery happens on weeks like this one.'],
  ['Build — deload', 'Drop to 22 km. No quality work. Both the long run and Wednesday ease back. Adaptation happens in recovery.'],
  ['Deload — recovery week', '33 km week. No quality work. Just four easy days and a slightly shorter long run. Absorb the last three.'],
]

/** Copy that genuinely lies about the week — the regression this check owns. */
const MUST_STILL_FIRE: Array<[string, string]> = [
  ['Build — first quality session', 'Three easy runs and the long run.'],
  ['Build', 'One quality session. Everything else stays easy.'],
  ['Peak — sustaining the work', 'This is where the fitness is built. It will feel hard.'],
  ['Build — volume peaks here', '36km week. Back to threshold work after the time trial.'],
  ['Peak', 'Sharpen for the race.'],
]

describe('ENRICH-COPY-NEGATION-01', () => {
  it('1. the three LIVE deload themes no longer read as claims', () => {
    for (const [label, theme] of LIVE_HONEST_DELOADS) {
      expect(copyClaimsIntensity(label, theme),
        `this copy was discarded in production and is honest: ${theme.slice(0, 60)}`).toBe(false)
    }
  })

  it('2. 🔴 copy that genuinely lies STILL fires — the fourteen-week regression', () => {
    for (const [label, theme] of MUST_STILL_FIRE) {
      expect(copyClaimsIntensity(label, theme),
        `a real claim stopped firing — the F4/N4 regression is re-opened: "${label}" / "${theme}"`).toBe(true)
    }
  })

  it('3. a negator only disarms what FOLLOWS it, not the whole week', () => {
    // The negation must not reach across a clause boundary and silence a real claim.
    expect(copyClaimsIntensity('Build', 'No easy days this week. One threshold session.')).toBe(true)
    // ...and must not be defeated by word order either way round.
    expect(copyClaimsIntensity('Build', 'Quality work, no excuses.')).toBe(true)
    expect(copyClaimsIntensity('Deload', 'No quality work.')).toBe(false)
  })

  it('4. "less" and "lighter" are NOT negators — a lighter quality session is still one', () => {
    expect(copyClaimsIntensity('Build', 'Less quality this week, but it is still there.')).toBe(true)
    expect(copyClaimsIntensity('Build', 'A lighter tempo than last week.')).toBe(true)
  })

  // ── COPY-CLAIM-CROSS-WEEK-01 (2026-10-10) ────────────────────────────────
  // The SAME defect in its other form, left alone for eight days after negation
  // was fixed. A paid runner's new 20-week London plan lost weeks 12 and 20.
  // ⚠️ The two rejections needed TWO different signals, so a fix for only the
  // absorption one would have been a third instance of the one-twin class.

  /** Verbatim from `plan_enrich_failed.detail.messages`, 2026-10-10 17:30, tier=paid. */
  const LIVE_CROSS_WEEK: Array<[string, string]> = [
    ['Build — recovery and consolidation',
     'Deload week. No quality work. Long run drops to 15.5 km. Your system absorbs the threshold work from weeks 10 and 11.'],
    ['Race — execute',
     'London Marathon. The work is done. You have built from 25 km/week to a 52 km peak. You have run 28 km long runs and held threshold pace for weeks. Go run your race.'],
  ]

  it('6. 🔴 the two LIVE cross-week rejections no longer read as claims', () => {
    for (const [label, theme] of LIVE_CROSS_WEEK) {
      expect(copyClaimsIntensity(label, theme),
        `discarded in production on 2026-10-10 and honest: "${label}"`).toBe(false)
    }
  })

  it('7. prior attribution disarms only what FOLLOWS it', () => {
    // The work belongs to another week → a mention.
    expect(copyClaimsIntensity('Deload', 'Your system absorbs the threshold work from weeks 10 and 11.')).toBe(false)
    // ...but the attribution must not reach into the next clause and silence a real claim.
    expect(copyClaimsIntensity('Build', 'Absorbs last week. One threshold session.')).toBe(true)
    // ...and a backward reference AFTER the keyword disarms nothing (arm 4's direction).
    expect(copyClaimsIntensity('Build', 'A lighter tempo than last week.')).toBe(true)
    expect(copyClaimsIntensity('Build', 'Back to threshold work after the time trial.')).toBe(true)
  })

  it('8. "you have" ALONE is not a disarmer — it needs a completion participle', () => {
    // 🔴 The narrowing that keeps this from swallowing a real claim. "You have X"
    // is the most natural way to STATE this week's content.
    expect(copyClaimsIntensity('Build', 'You have one quality session this week.')).toBe(true)
    expect(copyClaimsIntensity('Build', 'You have a threshold run on Wednesday.')).toBe(true)
    // ...while the retrospective form is a mention.
    expect(copyClaimsIntensity('Race', 'You have held threshold pace for weeks.')).toBe(false)
  })

  it('9. the prior-attribution class is not vacuous', () => {
    const stripped = withoutNonClaimClauses(
      'your system absorbs the threshold work from weeks 10 and 11. one tempo session.')
    expect(stripped, 'the attributed clause survived').not.toContain('absorbs')
    expect(stripped, 'the real claim was swallowed').toContain('tempo')
  })

  it('5. the stripper is not vacuous — it removes something and keeps something', () => {
    // An empty-population guard: if this ever returns the input unchanged, or
    // everything, the arms above pass for the wrong reason.
    const stripped = withoutNonClaimClauses('no quality work. one threshold session.')
    expect(stripped, 'the negated clause survived').not.toContain('quality')
    expect(stripped, 'the real claim was swallowed').toContain('threshold')
  })
})
