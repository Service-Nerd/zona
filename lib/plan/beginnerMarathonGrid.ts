import type { GeneratorInput } from '@/types/plan'

/**
 * The beginner-marathon corpus — priority one of `audit:plans` (PLAN-QUALITY-AUDIT).
 *
 * Moved here verbatim from `scripts/audit-plan-quality.ts` (ADR027-B0-SCORECARD) so
 * `npm run scorecard` reads the SAME rows rather than a copy. Two copies of a grid
 * drift, and a ratchet comparing against a drifted copy is measuring something else.
 *
 * Deliberately reaches BELOW what the other grids can express: a 0 km/week runner is
 * accepted by §55 and is exactly the "never run before" case.
 *
 * ⚠️ Known production-shape gap (final plan read, 2026-11-20): half the rows set
 * `weeks_at_current_volume`, which the wizard never sends. Left as is so the
 * `audit:plans` baseline stays comparable; the golden corpus (ADR-027 B0) replaces it.
 */
export const BEGINNER_MARATHON_PLAN_START = '2026-10-05'      // a Monday

export function beginnerMarathonGrid(): GeneratorInput[] {
  const out: GeneratorInput[] = []
  for (const cwk of [0, 5, 8, 10, 12, 15, 20, 25, 30])
    for (const longest of [0, 2, 3, 5, 8, 12])
      for (const days of [3, 4, 5])
        for (const raceWeeks of [16, 20, 24, 29])       // Oct -> Apr is ~29
          for (const age of [28, 42, 58])
            for (const injury of [[], ['Knee']] as string[][])
              for (const freshReturn of [undefined, 4]) {
                if (longest > cwk) continue             // incoherent input
                const race = new Date(BEGINNER_MARATHON_PLAN_START)
                race.setDate(race.getDate() + raceWeeks * 7 - 1)
                out.push({
                  athlete_name: 'Athlete', age, race_name: 'London',
                  race_distance_km: 42.2, race_date: race.toISOString().slice(0, 10),
                  goal: 'finish', current_weekly_km: cwk, longest_recent_run_km: longest,
                  days_available: days, training_age: '<6mo',
                  recent_quality_training: 'none', hard_session_relationship: 'neutral',
                  injury_history: injury, max_hr: 184,
                  ...(freshReturn !== undefined ? { weeks_at_current_volume: freshReturn } : {}),
                } as unknown as GeneratorInput)
              }
  return out
}
