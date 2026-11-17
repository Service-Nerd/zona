// ANCHOR-BAND-FLIP-01 — the gate for ADR-026 R1/R2/R4 as WIRED.
//
// `anchorBand.test.ts` proves the owner computes the right band. This proves the ENGINE asks it,
// which is a different claim and the one B1 could not make: B1 shipped the owner with 27 passing
// cases and `verify:parity` IDENTICAL, because nothing called it.
//
// ⚠️ EVERY ARM GENERATES A REAL PLAN. A fixture asserting "the band is 160–167" would pass with
// the generator still writing the zone table, which is exactly the state B1 shipped in.

import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { applyHrToPlan, computeZones } from './zones'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { catalogueRowFor } from './catalogueLink'
import { bandForAnchors, anchorsForQualityPrescription } from './anchorBand'
import { zoneKeyForZoneString } from '@/lib/coaching/zoneRules'
import { ZONE_COPY, zoneCopyByNumber } from '@/lib/coaching/zoneCopy'
import type { Session } from '@/types/plan'

/**
 * ⚠️ AN ODD STRIDE. `cohortGrid` is 41,472 rows = 2^9 × 81, so a power-of-two stride aliases
 * against its axes: stride 32 returns plans of which ZERO carry a VDOT, and a probe run that way
 * reported "0 of 7,185 sessions changed" while the band was working perfectly. Same class as the
 * liveness harness's coprime stride.
 */
function sample(n: number) {
  const grid = cohortGrid()
  const step = Math.max(1, Math.floor(grid.length / n) | 1)
  const out: typeof grid = []
  for (let i = 0; i < grid.length && out.length < n; i += step) out.push(grid[i])
  return out
}

function plansWithBands(n: number) {
  const out: { plan: ReturnType<typeof generateRulePlan>; input: ReturnType<typeof cohortGrid>[number] }[] = []
  for (const input of sample(n)) {
    let plan
    try { plan = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
    if (typeof plan.meta.vdot_training_anchor !== 'number') continue
    out.push({ plan, input })
  }
  return out
}

describe('ANCHOR-BAND-FLIP-01 — the engine prescribes the anchor-derived band', () => {
  it('a threshold session reads its ANCHOR band, not the zone table', () => {
    const cases = plansWithBands(400)
    expect(cases.length, 'no benchmarked plan in the sample — the band cannot be reached, so this arm proves nothing').toBeGreaterThan(5)

    let derived = 0, onZoneTable = 0
    for (const { plan } of cases) {
      const z = computeZones(plan.meta.max_hr as number, (plan.meta.resting_hr as number) || undefined)
      for (const w of plan.weeks) {
        for (const sn of Object.values(w.sessions) as (Session | undefined)[]) {
          if (!sn || sn.type !== 'quality' || typeof sn.hr_target !== 'string') continue
          const row = catalogueRowFor(sn)
          if (row?.category !== 'threshold') continue
          const band = bandForAnchors(anchorsForQualityPrescription(row), {
            maxHr: plan.meta.max_hr as number,
            restingHr: plan.meta.resting_hr as number,
            vdot: plan.meta.vdot_training_anchor as number,
          })
          if (!band) continue
          if (sn.hr_target === z.qualityHR && sn.zone === z.qualityZone) { onZoneTable++; continue }
          derived++
          // The pair, from the one expression (§84 Am. 1), with the band from the anchor (Am. 2).
          expect(sn.hr_target).toBe(band.hr)
          expect(sn.zone).toBe(band.zone)
        }
      }
    }
    expect(derived, 'no threshold session took a derived band — the flip is not wired').toBeGreaterThan(20)
    expect(onZoneTable, 'a session with a derivable band kept the zone table, so the two paths disagree').toBe(0)
  })

  it('the GENERATOR writes the derived interval band, floored on the CV ceiling', () => {
    // 🔴 THIS ARM EXISTS BECAUSE A MUTATION STAYED GREEN. Unwiring the generator's vo2max
    // branch — which reopens the 9-bpm threshold/interval overlap ADR-026 §5 closes, the whole
    // reason the floor move ships in this release — failed NOTHING. The arm below tests
    // `bandForAnchors` (the owner), and the applyHrToPlan arm's sample contained no
    // interval-band session at all: vo2max rows are catalogue-eligible only for races ≤ 12 km.
    // A population that cannot reach the case is not a check, and `expect(seen)` is what says so.
    let seen = 0
    for (const input of sample(1200)) {
      if ((input.race_distance_km ?? 0) > 12) continue      // vo2max eligibility (§22/catalogue)
      let plan
      try { plan = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
      if (typeof plan.meta.vdot_training_anchor !== 'number') continue
      const band = bandForAnchors(['I'], {
        maxHr: plan.meta.max_hr as number,
        restingHr: plan.meta.resting_hr as number,
        vdot: plan.meta.vdot_training_anchor as number,
      })
      if (!band) continue
      for (const w of plan.weeks) {
        for (const sn of Object.values(w.sessions) as (Session | undefined)[]) {
          if (!sn || typeof sn.hr_target !== 'string') continue
          if (catalogueRowFor(sn)?.category !== 'vo2max') continue
          seen++
          expect(sn.hr_target, `${sn.label}: the interval band is not the derived one`).toBe(band.hr)
          expect(sn.zone).toBe(band.zone)
        }
      }
    }
    expect(seen, 'no interval-band session reached — this arm cannot see the floor move, which is how a mutation that reopened the overlap stayed green').toBeGreaterThan(5)
  })

  it('the interval FLOOR sits on the CV ceiling, so T · CV · I cannot overlap', () => {
    // ADR-026 §5 — the overlap was 9 bpm at VDOT 41, WIDER than the 7-bpm threshold band itself.
    // Closing it by construction rather than by a chosen number is the whole argument.
    for (const [maxHr, restingHr, vdot] of [[185, 48, 41.0], [190, 50, 44.6], [191, 60, 20.2], [190, 65, 16.2]] as const) {
      const r = { maxHr, restingHr, vdot }
      const T = bandForAnchors(['T'], r)!, CV = bandForAnchors(['CV'], r)!, I = bandForAnchors(['I'], r)!
      expect(T.hi).toBe(CV.lo)
      expect(CV.hi).toBe(I.lo)
      expect(I.hi).toBe(maxHr)
      // Hutchinson's floor objection: clear of the easy ceiling, not sitting on it.
      expect(T.lo).toBeGreaterThan(computeZones(maxHr, restingHr).zone2Ceiling)
    }
  })

  it('INV-PLAN-HR-MATCHES-PACE is silent on real plans and SILENT where no band can be derived', () => {
    let withBand = 0, withoutBand = 0
    for (const input of sample(300)) {
      let plan
      try { plan = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
      if (typeof plan.meta.vdot_training_anchor === 'number') withBand++; else withoutBand++
      const fired = validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-HR-MATCHES-PACE')
      expect(fired.map(v => v.message), 'the coherence invariant fired on a plan the engine itself built').toEqual([])
    }
    // Both populations must be present or the arm is only testing one of them — and the one with
    // no derivable band is 65.3% of sessions, the case the invariant must NOT fire on.
    expect(withBand, 'no benchmarked plan sampled').toBeGreaterThan(5)
    expect(withoutBand, 'no plan WITHOUT a derivable band sampled — the silence condition is untested').toBeGreaterThan(5)
  })

  it('a plan with NO band stamp is NOT migrated by an HR correction (ADR-026 §8, forward-only)', () => {
    // 🔑 THE MIGRATION IS PROMPTED, NEVER SILENT, and `applyHrToPlan` is the path that would
    // break that: it runs on an unrelated HR correction and would hand a pre-release plan a band
    // 16 bpm higher with no notice. ADR-012 cannot see it — a band moves no day, swaps no session
    // and changes no volume — so the stamp is the only thing standing between a live runner and a
    // silent +16 bpm.
    const cases = plansWithBands(200)
    expect(cases.length).toBeGreaterThan(5)
    let compared = 0, derivedSomewhere = 0
    for (const { plan } of cases) {
      const restingHr = plan.meta.resting_hr as number, maxHr = plan.meta.max_hr as number
      if (!restingHr || !maxHr) continue
      const z = computeZones(maxHr, restingHr)
      // Strip the stamp, exactly as a plan generated before the release has none.
      const legacy = JSON.parse(JSON.stringify(plan)) as typeof plan
      delete (legacy.meta as unknown as Record<string, unknown>).hr_band_source
      const after = applyHrToPlan(legacy as never, restingHr, maxHr) as unknown as typeof plan
      for (const w of after.weeks) {
        for (const sn of Object.values(w.sessions) as (Session | undefined)[]) {
          if (!sn || sn.type !== 'quality' || typeof sn.hr_target !== 'string') continue
          compared++
          expect([z.qualityHR, z.intervalsHR], `${sn.label}: an unstamped plan was migrated silently`).toContain(sn.hr_target)
        }
      }
      // The same plan WITH its stamp must derive, or this arm would pass on a flip that never works.
      const kept = applyHrToPlan(plan as never, restingHr, maxHr) as unknown as typeof plan
      for (const w of kept.weeks) {
        for (const sn of Object.values(w.sessions) as (Session | undefined)[]) {
          if (sn?.type === 'quality' && typeof sn.hr_target === 'string'
            && sn.hr_target !== z.qualityHR && sn.hr_target !== z.intervalsHR) derivedSomewhere++
        }
      }
    }
    expect(compared, 'no quality session compared').toBeGreaterThan(20)
    expect(derivedSomewhere, 'the stamped plan derived nothing either, so the arm cannot tell the stamp from a dead flip').toBeGreaterThan(0)
  })

  it('applyHrToPlan agrees with the generator — an HR correction must not undo the release', () => {
    // 🔴 THE DEFECT THIS PREVENTS IS `hrBand.ts`'s OWN HEADER. A recalculation path that
    // disagreed with the generator rewrote a live runner's VO2max session to the threshold band.
    // Here the risk is the reverse: putting the zone-table band back on every quality session.
    let compared = 0
    for (const { plan } of plansWithBands(200)) {
      const restingHr = plan.meta.resting_hr as number
      const maxHr = plan.meta.max_hr as number
      if (!restingHr || !maxHr) continue
      const after = applyHrToPlan(plan as never, restingHr, maxHr)
      for (let wi = 0; wi < plan.weeks.length; wi++) {
        const before = plan.weeks[wi].sessions as Record<string, Session | undefined>
        const now = (after as unknown as typeof plan).weeks[wi].sessions as Record<string, Session | undefined>
        for (const day of Object.keys(before)) {
          const b = before[day], a = now[day]
          if (!b || !a || b.type !== 'quality' || typeof b.hr_target !== 'string') continue
          compared++
          expect(a.hr_target, `${b.label}: recalculation changed the band`).toBe(b.hr_target)
          expect(a.zone, `${b.label}: recalculation changed the zone`).toBe(b.zone)
        }
      }
    }
    expect(compared, 'no quality session compared — the arm proves nothing').toBeGreaterThan(20)
  })

  it('every zone string the engine can EMIT resolves to copy describing that work', () => {
    // 🔑 THE DESIGN BOARD'S BLOCKING AMENDMENT (ADR-026 §9, Sierra). `zoneCopyByNumber(4)`
    // returned the `Z4-5` entry — "Genuinely hard. Intervals, hill reps, fast finishes. You
    // can't talk." — so a runner on a 20-minute tempo now labelled `Zone 4` would have tapped it
    // and learned something false about their own training.
    const emitted = new Set<string>()
    for (const { plan } of plansWithBands(400)) {
      for (const w of plan.weeks) {
        for (const sn of Object.values(w.sessions) as (Session | undefined)[]) {
          if (sn?.zone) emitted.add(sn.zone)
        }
      }
    }
    expect(emitted.size, 'no zone strings collected').toBeGreaterThan(3)
    // The strings the flip introduces must actually be in the population, or this arm is
    // asserting resolution for a set that no longer contains the new cases.
    expect(Array.from(emitted), 'the flip did not emit Zone 4 — the sample cannot see the change').toContain('Zone 4')

    for (const zone of Array.from(emitted)) {
      const key = zoneKeyForZoneString(zone)
      expect(key, `"${zone}" resolves to no education copy at all`).not.toBeNull()
      const copy = ZONE_COPY[key as keyof typeof ZONE_COPY]
      expect(copy, `"${zone}" resolves to key ${key}, which has no entry`).toBeTruthy()
      // THE RULE, asserted as itself: a span is named by the HARDEST work in it, so the copy's
      // top zone must equal the zone string's top zone. `Zone 2–3` reading as the Zone 3
      // explainer is correct; `Zone 4` reading as the Zone 4–5 one is the defect.
      const top = (str: string) => Math.max(...(str.match(/[1-5]/g) ?? ['0']).map(Number))
      expect(top(copy.label), `"${zone}" resolves to copy labelled "${copy.label}" — a span must be named by its hardest work`).toBe(top(zone))
    }
  })

  it('a tempo labelled Zone 4 does NOT read the intervals explainer', () => {
    // The specific false lesson, asserted as itself rather than via the loop above.
    expect(zoneCopyByNumber(4).name).toBe('Threshold')
    expect(zoneCopyByNumber(4).what).not.toMatch(/interval/i)
    expect(zoneKeyForZoneString('Zone 4')).toBe('Z4')
    // A span into Z5 is still the hard-work explainer; Z5 alone is interval work.
    expect(zoneKeyForZoneString('Zone 4–5')).toBe('Z4-5')
    expect(zoneKeyForZoneString('Zone 5')).toBe('Z5')
    expect(ZONE_COPY['Z5'].what).toMatch(/rep/i)
    // Zone 3–4 is a T band on a less-trained runner, so it reads as threshold, not as tempo:
    // a span is named by the hardest work in it.
    expect(zoneKeyForZoneString('Zone 3–4')).toBe('Z4')
  })
})
