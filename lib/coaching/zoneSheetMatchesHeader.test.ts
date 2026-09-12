// ZONE-SHEET-01 — the zone you are TAUGHT must be the zone you were SHOWN.
//
// §84 settled that every zone surface derives from the prescribed `session.zone`
// and never from the coarse `session.type` slot, because the type slot collapses
// every quality session to a flat Z3. The header, eyebrow and ZoneBar were moved
// onto `session.zone`. The zone EDUCATION SHEET — the thing you open by tapping
// that header — was not, and went on calling `zoneForSessionType`.
//
// Measured 2026-09-12 over the 621-plan cohort before the fix: the two disagreed
// on 837 of 35,832 sessions (2.3%).
//   · 549 quality sessions: header "Zone 4–5", sheet taught ZONE 3 — and showed
//     the Zone 3 HR band, which is LOWER than the work prescribed. A runner
//     tapping a VO2max session to learn what it is was told it was threshold.
//   · 288 segmented long runs: header "Zone 2–3", sheet "Zone 2".
//
// §84's own Why names this harm: "disguising genuinely hard work as moderate is
// exactly how a runner is marched into overreaching without a warning sign".
//
// The first test is the CLAIM — over real generated plans, the sheet's zone and
// the header's peak zone agree everywhere. The second is the FALSIFICATION: the
// old type-derived path must still be demonstrably wrong on that population, so
// this file fails loudly if anyone routes the sheet back through it.
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { zoneKeyForZoneString, zoneForSessionType, zonesFromZoneString } from './zoneRules'
import type { GeneratorInput, Session } from '@/types/plan'

const input = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_date: '2026-12-12', race_distance_km: 10, goal: 'time_target',
  target_time: '0:45:00', current_weekly_km: 40, longest_recent_run_km: 14,
  days_available: 5, age: 38, resting_hr: 52, max_hr: 185,
  preferred_long_run_day: 'sun', fitness_level: 'intermediate',
  recent_quality_training: 'regular', ...o,
} as unknown as GeneratorInput)

const sessionsOf = (i: GeneratorInput): Session[] =>
  generateRulePlan(i, 'paid').weeks
    .flatMap(w => Object.values(w.sessions ?? {}) as (Session | undefined)[])
    .filter((s): s is Session => !!s && s.type !== 'rest')

/** The peak zone the header renders, per §84's displayZonesForSession. */
const headerPeak = (s: Session): number | null => {
  const zs = zonesFromZoneString(s.zone)
  return zs.length ? Math.max(...zs) : null
}

/** The peak zone the sheet now teaches. */
const sheetPeak = (s: Session): number | null => {
  const k = zoneKeyForZoneString(s.zone)
  if (!k) return null
  return k === 'Z4-5' ? 5 : k === 'Z3' ? 3 : k === 'Z2' ? 2 : 1
}

describe('ZONE-SHEET-01 — the sheet agrees with the header', () => {
  const all = [
    ...sessionsOf(input()),
    // §44 refuses a 12-week time-targeted marathon (16-week minimum), so this
    // fixture gets a real build window rather than an acknowledged warning.
    ...sessionsOf(input({ race_distance_km: 42.2, target_time: '3:30:00', race_date: '2027-02-20' } as Partial<GeneratorInput>)),
  ]

  it('the fixture actually contains zone-bearing sessions', () => {
    expect(all.filter(s => s.zone).length).toBeGreaterThan(0)
  })

  it('THE CLAIM — sheet zone and header peak agree on every zone-bearing session', () => {
    const mismatches = all
      .filter(s => s.zone)
      .map(s => ({ label: s.label, zone: s.zone, header: headerPeak(s), sheet: sheetPeak(s) }))
      // Z4 and Z5 share one sheet key ('Z4-5'), so a header peak of 4 or 5 both
      // map to 5. Anything else must match exactly.
      .filter(m => (m.header === 4 || m.header === 5 ? m.sheet !== 5 : m.header !== m.sheet))
    expect(mismatches).toEqual([])
  })

  it('FALSIFICATION — the OLD type-derived path is still demonstrably wrong here', () => {
    // If this ever goes green, the defect has been "fixed" by the population
    // disappearing rather than by the sheet reading the right field — which
    // would make the test above vacuous.
    const wrong = all.filter(s => {
      if (!s.zone) return false
      const old = zoneForSessionType(s.type)
      if (!old) return false
      const oldPeak = old.zone === 'Z4-5' ? 5 : old.zone === 'Z3' ? 3 : old.zone === 'Z2' ? 2 : 1
      const hp = headerPeak(s)
      if (hp == null) return false
      return (hp === 4 || hp === 5) ? oldPeak !== 5 : oldPeak !== hp
    })
    expect(wrong.length, 'the type-derived path must still disagree with the header').toBeGreaterThan(0)
  })

  it('a legacy session with no session.zone yields no key, so the caller can fall back', () => {
    expect(zoneKeyForZoneString(undefined)).toBeNull()
    expect(zoneKeyForZoneString('')).toBeNull()
    expect(zoneKeyForZoneString('no digits here')).toBeNull()
  })

  it('maps a range to its PEAK — the hardest part is what needs explaining', () => {
    expect(zoneKeyForZoneString('Zone 4–5')).toBe('Z4-5')
    expect(zoneKeyForZoneString('Zone 2–3')).toBe('Z3')
    expect(zoneKeyForZoneString('Zone 3–4')).toBe('Z4-5')
    expect(zoneKeyForZoneString('Zone 2')).toBe('Z2')
    expect(zoneKeyForZoneString('Zone 1')).toBe('Z1')
  })
})
