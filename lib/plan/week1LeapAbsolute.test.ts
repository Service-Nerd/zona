import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { auditPlanQuality } from './planQuality'
import { effectiveStartKm } from './startVolume'
import { isDesignedRefusal } from './designedRefusal'
import { distanceEnvelope } from './useCaseEnvelope'

/**
 * WEEK1-LEAP-ABS-01 — a percentage rule needs an absolute floor.
 *
 * ⚠️ MEASURED: 17% of everything WEEK1-LEAP flagged was an increase of 2 km or
 * less. The worst read "start 4 km, week 1 = 5 km" — one extra short run,
 * scored as a 43% leap. It fired on 58% of runners under 20 km/week and 0%
 * over 40: the signature of an artefact, not a hazard.
 *
 * ⚠️ SAME CLASS AS `LONG-RUN-SHORT` ON ULTRAS, found the same day. Two of the
 * seven quality predicates applied a proportional rule where the absolute
 * magnitude made it meaningless.
 *
 * ⚠️ NO PRESCRIPTION CHANGED. This is a measurement fix. The engine-side
 * question — a 7 km/week runner handed an 18 km week 1 — is real, still open,
 * and filed; case 3 pins that it is NOT suppressed by this change.
 */

describe('WEEK1-LEAP-ABS-01', () => {
  it('1. a tiny absolute increase is no longer flagged', () => {
    const tiny = {
      athlete_name: 'A', age: 38, race_name: 'T', primary_metric: 'distance',
      race_distance_km: 5, race_date: '2027-01-04', plan_start: '2026-11-02',
      goal: 'finish', fitness_level: 'intermediate', training_age: '2-5yr',
      resting_hr: 55, max_hr: 184, current_weekly_km: 5, longest_recent_run_km: 2,
      days_available: 3, injury_history: [], hard_session_relationship: 'neutral',
      recent_quality_training: 'occasional',
    } as never
    const plan = generateRulePlan(tiny, 'paid')
    const start = effectiveStartKm(tiny)
    const w1 = plan.weeks.find(w => w.n === 1)?.weekly_km ?? 0
    expect(w1 - start, 'fixture must actually be a SMALL absolute jump').toBeLessThanOrEqual(2)
    expect(auditPlanQuality(plan, tiny).map(o => o.code)).not.toContain('WEEK1-LEAP')
  })

  it('2. a LARGE absolute jump is still flagged — the floor removes noise, not the rule', () => {
    // Reconstructed from the measured worst case: 10 km/wk declared, scaled to
    // ~7 by §29, handed an 18 km week 1.
    const big = {
      athlete_name: 'A', age: 38, race_name: 'T', primary_metric: 'distance',
      race_distance_km: 21.1, race_date: '2027-02-22', plan_start: '2026-11-02',
      goal: 'finish', fitness_level: 'intermediate', training_age: '2-5yr',
      resting_hr: 55, max_hr: 184, current_weekly_km: 10, longest_recent_run_km: 5,
      days_available: 4, injury_history: [], hard_session_relationship: 'neutral',
      recent_quality_training: 'occasional',
    } as never
    const plan = generateRulePlan(big, 'paid')
    const start = effectiveStartKm(big)
    const w1 = plan.weeks.find(w => w.n === 1)?.weekly_km ?? 0
    expect(w1 - start, 'fixture must be a LARGE absolute jump').toBeGreaterThan(2)
    expect(auditPlanQuality(plan, big).map(o => o.code)).toContain('WEEK1-LEAP')
  })

  it('3. the residual is NOT suppressed — large leaps still exist and are still counted', () => {
    let flagged = 0, biggest = 0
    // HM only, and a wide stride: the >10 km leaps measured 50 at HM against
    // 12 at marathon and 0 at 5K/10K, so sweeping four distances cost 1.7 s of
    // the duration budget to re-prove what one distance shows.
    for (const d of [21.1]) {
      for (const c of distanceEnvelope(d).filter((_, i) => i % 149 === 0)) {
        let plan
        try { plan = generateRulePlan(c.input, 'paid') }
        catch (e) { if (isDesignedRefusal(e)) continue; throw e }
        if (!auditPlanQuality(plan, c.input).some(o => o.code === 'WEEK1-LEAP')) continue
        flagged++
        const start = effectiveStartKm(c.input)
        const w1 = plan.weeks.find(w => w.n === 1)?.weekly_km ?? 0
        biggest = Math.max(biggest, w1 - start)
      }
    }
    expect(flagged, 'the predicate must still fire on real jumps').toBeGreaterThan(0)
    expect(biggest, 'and the large ones must still be visible').toBeGreaterThan(5)
  })
})

describe('ULTRA-LR-BAR-01 — the long-run bar is a MARATHON bar', () => {
  const mk = (km: number, cwk: number) => ({
    athlete_name: 'A', age: 40, race_name: 'T', primary_metric: 'distance',
    race_distance_km: km, race_date: '2027-06-06', plan_start: '2026-11-02',
    goal: 'finish', fitness_level: 'experienced', training_age: '5yr+',
    resting_hr: 52, max_hr: 182, current_weekly_km: cwk,
    longest_recent_run_km: Math.round(cwk * 0.45), days_available: 5,
    injury_history: [], hard_session_relationship: 'neutral',
    recent_quality_training: 'regular',
  }) as never

  it('4. a 100K plan is NOT flagged for a long run under 55km', () => {
    // 55% of 100 km is a 55 km training long run. Nobody prescribes that;
    // §24e prescribes back-to-backs. It fired on 46 of 48 sampled 100K plans.
    const input = mk(100, 65)
    const plan = generateRulePlan(input, 'paid')
    expect(auditPlanQuality(plan, input).map(o => o.code)).not.toContain('LONG-RUN-SHORT')
  })

  it('5. a MARATHON plan with a genuinely short long run IS still flagged', () => {
    // The bar must not have been switched off, only scoped.
    let flagged = false
    for (const c of distanceEnvelope(42.2).filter((_, i) => i % 149 === 0)) {
      let plan
      try { plan = generateRulePlan(c.input, 'paid') }
      catch (e) { if (isDesignedRefusal(e)) continue; throw e }
      if (auditPlanQuality(plan, c.input).some(o => o.code === 'LONG-RUN-SHORT')) { flagged = true; break }
    }
    expect(flagged, 'LONG-RUN-SHORT must still fire somewhere at the marathon').toBe(true)
  })

  it('6. the gap is HONEST, not filled with an invented number', () => {
    // Ultras now have NO long-run adequacy check. That is recorded rather than
    // papered over: picking a 50K/100K bar is a coaching judgement (§24e makes
    // a single longest run the wrong unit), and inventing one here to keep a
    // column populated is how a decorative check is born.
    const input = mk(50, 60)
    const plan = generateRulePlan(input, 'paid')
    const codes = auditPlanQuality(plan, input).map(o => o.code)
    expect(codes).not.toContain('LONG-RUN-SHORT')
  })
})
