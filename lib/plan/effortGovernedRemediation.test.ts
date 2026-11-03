/**
 * §40b Am.4 remediation — the patch that unfreezes the plans the invariant froze.
 *
 * 🔴 WHY THIS TEST EXISTS, SAID PLAINLY. `INV-PLAN-EFFORT-GOVERNED-NO-INVENTED-BAND` shipped
 * 2026-11-02 verified against `verify:parity`, `measure:fitness` and `review:coaching` — all of
 * which generate NEW plans. Nothing asked what it does to the 39 STORED ones. It fires on 3 and
 * is the ONLY error on 2, and because `validateReshapedPlan` returns every error in the plan, a
 * single error anywhere makes `/api/adjust-plan` refuse. **Adjustable plans went 21 → 19 and two
 * runners silently lost plan adjustment.** The founder asks for regression testing every time;
 * this is the half that was missing.
 *
 * The script is a one-off, but the PATCH is a pure function, so it is tested rather than trusted.
 */
import { describe, it, expect } from 'vitest'
import { remediate } from '../../scripts/remediate-effort-governed-band'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { isEffortGovernedRow } from './hrBand'
import { zoneStringFromZoneKeys } from '@/lib/coaching/zoneRules'
import type { Plan, Session } from '@/types/plan'

const EFFORT_ROWS = V1_SESSION_CATALOGUE.filter(isEffortGovernedRow)

/** A stored plan shaped like the real ones: one effort-governed session carrying the interval
 *  band, exactly as measured in production (`hr_target: "146–170 bpm"`, zone Zone 4–5). */
const storedPlan = (overrides: Partial<Session> = {}): Plan => ({
  meta: { generator_input: {} },
  weeks: [{
    n: 8, date: '2026-11-02', phase: 'build', weekly_km: 40,
    sessions: {
      wed: {
        id: 'w8-wed', type: 'quality', label: 'Hill reps — 45s',
        catalogue_id: 'hill_reps', zone: 'Zone 4–5', hr_target: '146–170 bpm',
        rpe_target: 8, duration_mins: 54,
        coach_notes: ['Short and sharp. Walk down.'],
        ...overrides,
      } as unknown as Session,
    },
  }],
} as unknown as Plan)

describe('remediate — what it changes', () => {
  it('removes the HR band from an effort-governed session', () => {
    const { next, touched } = remediate(storedPlan())
    const s = (next.weeks[0].sessions as Record<string, Session>).wed
    expect(s.hr_target).toBeUndefined()
    expect(touched).toHaveLength(1)
    expect(touched[0].hadHr).toBe('146–170 bpm')
  })

  it('DELETES hr_target rather than blanking it', () => {
    // Load-bearing: `hrBandFor` reads a non-string as "never had a band, do not give it one",
    // so '' would let `applyHrToPlan` put the interval band straight back on the next
    // HR recalculation. The key must be absent, not empty.
    const { next } = remediate(storedPlan())
    const s = (next.weeks[0].sessions as Record<string, Session>).wed
    expect('hr_target' in (s as object)).toBe(false)
  })

  it('sets the zone from the ROW, which for hill_reps means it does not move', () => {
    // Measured: all three affected production plans are Z4/Z5 rows, so the only visible
    // change is the removed band. Asserted so "no zone moved" is a fact, not a hope.
    const { next, touched } = remediate(storedPlan())
    const s = (next.weeks[0].sessions as Record<string, Session>).wed
    const declared = zoneStringFromZoneKeys(EFFORT_ROWS.find(r => r.id === 'hill_reps')!.intensity_zones)
    expect(s.zone).toBe(declared)
    expect(touched[0].from).toBe(touched[0].to)
  })

  it('leaves copy, structure and keys alone', () => {
    const before = storedPlan()
    const { next } = remediate(before)
    const b = (before.weeks[0].sessions as Record<string, Session>).wed
    const a = (next.weeks[0].sessions as Record<string, Session>).wed
    expect(a.label).toBe(b.label)
    expect(a.coach_notes).toEqual(b.coach_notes)
    expect(a.rpe_target).toBe(b.rpe_target)       // the RPE IS the prescription (§40b)
    expect(a.duration_mins).toBe(b.duration_mins)
    expect(a.catalogue_id).toBe(b.catalogue_id)
    expect(a.id).toBe(b.id)                        // week_n/day keys survive: completions,
    expect(next.weeks[0].n).toBe(before.weeks[0].n) // run links and overrides keep pointing
  })

  it('does not mutate the plan it was given', () => {
    // The script validates BEFORE and AFTER and compares; an in-place mutation would make
    // that comparison compare a plan with itself and always pass.
    const before = storedPlan()
    remediate(before)
    expect((before.weeks[0].sessions as Record<string, Session>).wed.hr_target).toBe('146–170 bpm')
  })
})

describe('remediate — what it leaves alone', () => {
  it('is a no-op on a session that is already correct', () => {
    const { touched } = remediate(storedPlan({ hr_target: undefined } as Partial<Session>))
    expect(touched).toEqual([])
  })

  it('is a no-op on a session that is NOT effort-governed', () => {
    // A threshold row legitimately carries an HR band. Keying on the row (not on "has a band")
    // is what keeps this patch from stripping every quality session in the plan.
    const plan = storedPlan({ catalogue_id: 'tempo_cruise', label: 'Cruise intervals' } as Partial<Session>)
    const { touched } = remediate(plan)
    expect(touched).toEqual([])
    expect((plan.weeks[0].sessions as Record<string, Session>).wed.hr_target).toBe('146–170 bpm')
  })

  it('is a no-op on a session with no catalogue identity', () => {
    // A pre-SC-08a plan may carry no stamp. `catalogueRowFor` returns null and the session must
    // be left exactly as the generator left it — guessing is what hrBand.ts exists to stop.
    const plan = storedPlan({ catalogue_id: undefined } as Partial<Session>)
    expect(remediate(plan).touched).toEqual([])
  })
})
