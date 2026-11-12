import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import type { GeneratorInput } from '@/types/plan'
import { PLAN_PERSONAS, charityInput, CHARITY_PLAN_START } from './charityCohort'
import { catalogueRowFor } from './catalogueLink'

/**
 * SC-02 / CD-15 — an aerobic catalogue row prescribed at threshold pace kept
 * its aerobic name. §19 breach, live in production until 2026-08-20.
 *
 * No threshold row is eligible for 5K/10K (SC-04), so the selector falls back
 * to an aerobic row for the whole build phase — and the engine then prescribes
 * it at T-pace in Zone 3–4. The session's NAME said easy, its PRESCRIPTION said
 * threshold, and nothing caught it: INV-PLAN-LABEL-MATCHES-PACE only asked
 * "label claims hard → is the pace hard?", never the inverse. "Steady aerobic"
 * contains none of vo2max/tempo/cruise/threshold, so it raised nothing.
 *
 * McMillan: "whatever else you decide, that runner is being poorly served
 * today." The board ruled the labelling fix ships unconditionally, without
 * waiting for the eligibility fix.
 *
 * Two halves, both asserted here:
 *   (a) engine  — rename the repurposed row and replace the borrowed voice (§33)
 *   (b) invariant — catch an easy-implying label on a non-easy zone, so the
 *       same fallback cannot recur silently wherever the catalogue thins out
 *
 * Ruling: docs/decisions/coaching-board-2026-08-19-session-catalogue.md
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

// The audit's Task B profile. fitness_level is deliberately left unset — the
// 'experienced' variant is entangled with SC-01/§23 and is blocked; this is
// the same defect on the path that is shippable today.
const INPUT: GeneratorInput = {
  race_date: '2026-11-29', race_distance_km: 10, goal: 'time_target', target_time: '0:44:59',
  days_available: 4, age: 43, current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
  injury_history: ['Left knee, posterior, recurring'],
}

const EASY_WORDS = ['easy', 'steady', 'aerobic', 'recovery']

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('SC-02 — aerobic row repurposed as a quality session', () => {
  const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
  const quality = plan.weeks.flatMap(w =>
    Object.values(w.sessions).filter(s => s?.type === 'quality').map(s => ({ w: w.n, s: s! })))

  it('the profile still reaches the aerobic fallback (premise guard)', () => {
    // If SC-04 later makes a real threshold row eligible for 10K, the fallback
    // stops firing and this test measures nothing. It should then be re-pointed
    // at a distance/phase that still falls back, not quietly left passing.
    expect(quality.length).toBeGreaterThan(0)
    const buildWeeks = plan.weeks.filter(w => w.phase === 'build')
    expect(buildWeeks.length).toBeGreaterThan(0)
  })

  it('no quality session is labelled as easy or aerobic work', () => {
    for (const { w, s } of quality) {
      const label = (s.label ?? '').toLowerCase()
      for (const word of EASY_WORDS) {
        expect(label, `week ${w}: quality session labelled "${s.label}" at ${s.zone}`)
          .not.toContain(word)
      }
    }
  })

  it('no quality session carries a borrowed aerobic coach voice', () => {
    // §33 — the repurposed row's own note describes a Zone 2 run and is simply
    // false on a session prescribed at T-pace.
    const aerobicVoices = V1_SESSION_CATALOGUE
      .filter(r => r.category === 'aerobic' && r.coach_voice_notes)
      .map(r => r.coach_voice_notes as string)
    expect(aerobicVoices.length).toBeGreaterThan(0)

    for (const { w, s } of quality) {
      for (const note of s.coach_notes ?? []) {
        expect(aerobicVoices, `week ${w}: "${s.label}" carries an aerobic row's voice`)
          .not.toContain(note)
      }
    }
  })

  it('validatePlan raises no label-integrity violation', () => {
    const found = validatePlan(plan, INPUT).filter(v => v.code === 'INV-PLAN-LABEL-MATCHES-PACE')
    expect(found, found.map(v => v.message).join('\n')).toHaveLength(0)
  })

  it('the invariant catches the inverse case it previously missed', () => {
    // Directly exercise (b): hand-build the exact shape that shipped — an
    // easy-sounding label on a Zone 3–4 quality session — and assert it is now
    // rejected. Without this, the engine fix alone would leave the hole open
    // for any other path that produces the same mismatch.
    const poisoned = structuredClone(plan)
    const week = poisoned.weeks.find(w => Object.values(w.sessions).some(s => s?.type === 'quality'))!
    const entry = Object.entries(week.sessions).find(([, s]) => s?.type === 'quality')!
    entry[1]!.label = 'Steady aerobic'

    const found = validatePlan(poisoned, INPUT).filter(v => v.code === 'INV-PLAN-LABEL-MATCHES-PACE')
    expect(found.length).toBeGreaterThan(0)
    expect(found[0].message).toContain('Steady aerobic')
  })
})

/**
 * `ULTRA-VOICE-REPURPOSED-01` (2026-11-12) — §33's SAME DEFECT, ON THE ULTRA ROWS.
 *
 * Found by the Coaching Board's read of the 2026-11-02 sample packet, which is the review step no
 * harness performs: `review:coaching`'s objection count is identical either side of the fix, because
 * nothing in it reads a NOTE against the session actually delivered.
 *
 * Re-measured on E6 as generated 2026-11-12, through `charityInput` (the owner the round calls — a
 * hand-built race date gave a different plan entirely, and a fixture must use the product's values):
 *   · `Ultra race simulation` · 78 min · Zone 3 · 4:45–5:20 /km · RPE 7 · *"Eat on the clock. Hunger
 *     is too late."* You do not fuel a 78-minute tempo, and the row exists to rehearse the fuelling
 *     it is too short to do (Sims, `CAT-ULTRA-FUELLING-01`).
 *   · `Back-to-back long` · same prescription · *"Sunday is meant to feel heavy. That's the
 *     adaptation."* The Sunday two days later is a normal Zone 2 long run. **The note narrates a
 *     weekend that is not prescribed.**
 *
 * ⚠️ THE PRESCRIPTION IS UNCHANGED AND THAT IS WHAT MAKES THIS A DEFECT FIX, not a board question:
 * 78 min, Zone 3, the same pace band and the same RPE, before and after. Only the name and the voice
 * move, which is precisely what §33 ratified ("replace it rather than carry it through").
 */
describe('ULTRA-VOICE-REPURPOSED-01 — a paced ultra row does not keep its own voice', () => {
  const persona = PLAN_PERSONAS.find(p => p.id.startsWith('E6'))!
  const input = charityInput(persona)
  const plan = generateRulePlan(input, 'paid', CHARITY_PLAN_START)

  /** Every session whose catalogue row is one of the ultra rows, with its row id. */
  const ultraSessions = () => plan.weeks.flatMap(w =>
    Object.values(w.sessions ?? {})
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map(s => ({ week: w.n, session: s, row: catalogueRowFor(s) }))
      .filter(x => x.row?.category === 'ultra_specific'))

  it('the population is not empty — E6 really does carry ultra rows', () => {
    // Without this the arms below pass by looking at nothing, which is how a green tick ends up with
    // nothing behind it. Measured: 3 rows, 6 sessions.
    const rows = new Set(ultraSessions().map(x => x.row!.id))
    // ⚠️ `Array.from`, NOT `[...rows]` — CLAUDE.md § TypeScript documents that spread on a
    // `Set<string>` fails this target (TS2802). vitest was green; `tsc` was not.
    expect(rows.size, `rows found: ${Array.from(rows).join(', ')}`).toBeGreaterThanOrEqual(3)
    expect(rows).toContain('ultra_race_sim')
    expect(rows).toContain('back_to_back_long')
    expect(rows).toContain('vert_hike_repeats')
  })

  it('🔴 a PACED ultra row ships neither its own name nor its own voice', () => {
    const paced = ultraSessions().filter(x => x.row!.id !== 'vert_hike_repeats')
    expect(paced.length, 'E6 must deliver at least one paced ultra row').toBeGreaterThan(0)
    for (const { week, session, row } of paced) {
      expect(session.label, `wk${week}: row ${row!.id} kept its own name on a Zone 3 session`)
        .not.toBe(row!.name)
      const notes = (session.coach_notes ?? []).join(' ')
      if (row!.coach_voice_notes) {
        expect(notes, `wk${week}: row ${row!.id} kept its borrowed voice`)
          .not.toContain(row!.coach_voice_notes)
      }
      expect(notes, `wk${week}: §33's replacement voice is missing`).toContain('Threshold work')
    }
  })

  it('⚠️ and an EFFORT-GOVERNED ultra row keeps both, because its voice is true', () => {
    // §40b Am. 4 delivers `vert_hike_repeats` correctly — 86 min at Zone 2, RPE 6, no HR band — so
    // catching it would replace a true sentence with a false one. The category alone cannot tell
    // them apart: all four ultra rows share `category: 'ultra_specific'`.
    const hike = ultraSessions().filter(x => x.row!.id === 'vert_hike_repeats')
    expect(hike.length, 'E6 must deliver the climb row').toBeGreaterThan(0)
    for (const { week, session, row } of hike) {
      expect(session.label, `wk${week}: the climb row must keep its own name`).toContain('Climb repeats')
      expect((session.coach_notes ?? []).join(' '), `wk${week}: the climb row's voice is true`)
        .toContain(row!.coach_voice_notes!.slice(0, 40))
      expect(session.hr_target, `wk${week}: effort-governed, so no HR band (§40b Am. 4)`).toBeUndefined()
    }
  })

  it('and the PRESCRIPTION did not move — this is a name and a sentence, nothing else', () => {
    const paced = ultraSessions().filter(x => x.row!.id !== 'vert_hike_repeats')
    for (const { week, session } of paced) {
      expect(session.zone, `wk${week}`).toBe('Zone 3')
      expect(session.duration_mins, `wk${week}`).toBe(78)
      // ⚠️ NOT `session.rpe` — there is no such field. The `RPE 7` in the round's markdown is
      // DERIVED by the renderer, and asserting it here would have been asserting `undefined`
      // against a number, which is what the first cut did. Pace is the third prescribed field.
      expect(session.pace_target, `wk${week}`).toBe('4:45–5:20 /km')
    }
  })
})
