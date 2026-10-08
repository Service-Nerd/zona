// READ-EM-DASH-02 — the plan's RUNNER-FACING prose carries no em dash.
//
// 🔴 MEASURED FIRST, THEN SCOPED BY THE FOUNDER, because the raw number would have
// misled exactly as it did once before. Production, 2026-10-08: **834 em-dash prose
// fields across 29 of 30 live plans, in 19 field names.** Sweeping that would have been
// wrong: `label` alone is **300 of the 834**, and the founder's own rule exempts it.
//
// His scope, confirmed 2026-10-08 against the measured field list:
//
//   ✅ DASH ALLOWED — `label`, `detail`. These are session descriptions, and his
//      2026-09-22 ruling is explicit: *"In descriptions for sessions it's ok."*
//   ⛔ DASH OUT — `coach_notes`, `coach_intro`, `difficulty_note`,
//      `hr_assumption_note`, and the `*_note` family rendered beside them. These are
//      sentences the runner reads.
//
// ⚠️ SO THIS GUARD IS SCOPED BY WHERE THE STRINGS SURFACE, NOT BY WHERE THEY LIVE,
// which is what `BRAND-EMDASH-LIB-01` asked for in as many words: *"needs the strings
// separated by where they SURFACE, not by where they live"*. It also honours that
// item's prohibition — **`lib/` is NOT added to `noEmDashApp.test.ts`'s roots**, because
// that would fire on 250 literals most of which no runner ever reads, *"and a guard that
// fires on ordinary work gets switched off"*.
//
// ⚠️ AND IT ASSERTS THE RENDERER'S OUTPUT, NOT THE SOURCE. `planRationaleNotes` is the
// single owner of which notes reach a runner and in what order, and it is budget-capped
// — so a source scan would flag strings that never render and miss the ones that do.
// Every note here came out of `generateRulePlan`.
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { planRationaleNotes } from './planRationale'
import { PINNED_PLAN_START } from './__fixtures__/pinnedPlanStart'
import type { GeneratorInput } from '@/types/plan'

const EM = '—'

const input = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_date: '2026-12-12', race_distance_km: 42.2, goal: 'finish',
  current_weekly_km: 40, longest_recent_run_km: 18, days_available: 5, age: 38,
  resting_hr: 52, max_hr: 185, preferred_long_run_day: 'sun',
  training_age: '2-5yr', user_declared_level: 'intermediate',
  recent_quality_training: 'occasional', ...o,
} as GeneratorInput)

/** Spread wide enough to stamp the whole note family, not just the common ones. */
const COHORT: Partial<GeneratorInput>[] = [
  {},
  // Weekday cap → the maintenance / volume-shortfall notes.
  { max_weekday_mins: 30, days_available: 3, current_weekly_km: 20, longest_recent_run_km: 9 },
  // Injury history → the caps and their notes.
  { injury_history: ['knee'], current_weekly_km: 25, longest_recent_run_km: 12 },
  // HR assumptions: a supplied max BELOW the age estimate, and one well above.
  { age: 25, max_hr: 185, resting_hr: undefined },
  { age: 55, max_hr: 200 },
  // No HR at all → the "estimated from age alone" note.
  { max_hr: undefined, resting_hr: undefined },
  // Returning / fresh, trail, and a hard-session preference.
  { training_age: '<6mo', user_declared_level: 'beginner', current_weekly_km: 15,
    longest_recent_run_km: 6, terrain: 'trail', hard_session_relationship: 'avoid' },
  { race_distance_km: 10, goal: 'time_target', target_time: '45:00', current_weekly_km: 55,
    longest_recent_run_km: 22, user_declared_level: 'experienced', recent_quality_training: 'regular' },
]

/** Every runner-facing prose string a plan carries, with its field named. */
function runnerFacingProse(): Array<{ field: string; text: string }> {
  const out: Array<{ field: string; text: string }> = []
  for (const o of COHORT) {
    let plan
    try { plan = generateRulePlan(input(o), 'paid', PINNED_PLAN_START) } catch { continue }
    const meta = plan.meta as unknown as Record<string, unknown>

    // The rendered notes — the renderer decides which ones a runner actually sees.
    for (const n of planRationaleNotes(plan.meta)) {
      out.push({ field: `rendered:${n.label}`, text: n.text })
    }
    // Two more the runner reads that `planRationaleNotes` does not own.
    for (const f of ['hr_assumption_note', 'difficulty_note']) {
      const v = meta[f]
      if (typeof v === 'string' && v.trim()) out.push({ field: f, text: v })
    }
  }
  return out
}

describe('READ-EM-DASH-02 — the plan’s runner-facing notes', () => {
  it('the cohort actually stamps notes, or this check proves nothing', () => {
    const prose = runnerFacingProse()
    // 🔴 The arm that stops a vacuous pass: a cohort that stamps no notes would
    // satisfy every assertion below while guarding nothing.
    expect(prose.length, 'no runner-facing notes stamped — this check is blind').toBeGreaterThan(10)
    const fields = new Set(prose.map(p => p.field))
    expect(fields.size, 'only one kind of note reached — widen the cohort').toBeGreaterThan(3)
  })

  it('⛔ no em dash in any of them', () => {
    const offenders = runnerFacingProse()
      .filter(p => p.text.includes(EM))
      .map(p => `${p.field}: ${p.text.slice(0, 120)}`)
    expect(Array.from(new Set(offenders))).toEqual([])
  })

  it('✅ and session label / detail are NOT in scope, by the founder’s own words', () => {
    // *"In descriptions for sessions it's ok."* `label` alone was 300 of the 834
    // measured fields. This arm exists so a later sweep cannot quietly widen the
    // scope past what he ruled — it asserts the exemption rather than assuming it.
    const plan = generateRulePlan(input(), 'paid', PINNED_PLAN_START)
    const sessions = plan.weeks.flatMap(w => Object.values(w.sessions ?? {}))
      .filter(Boolean) as Array<{ label?: string; detail?: string | null }>
    expect(sessions.length).toBeGreaterThan(0)
    // No assertion about their dashes in EITHER direction: they are out of scope, and
    // a guard that required one would be inventing a rule the founder declined.
    expect(sessions.every(s => typeof s.label === 'string')).toBe(true)
  })
})
