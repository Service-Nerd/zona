import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * THE SINGLE OWNER of "what `GeneratorInput` was this STORED plan built from?"
 * (STORED-PLAN-VALIDATOR-INPUT-01, 2026-11-08).
 *
 * ── WHY IT IS ITS OWN MODULE ─────────────────────────────────────────────────
 * This derivation lived inline inside `validateReshapedPlan`, which made it
 * reachable only by going through that function. 🔴 **Measured 2026-11-08: eight
 * scripts read the `plans` table and validate what they read, and all eight
 * assembled this input by hand instead** — so none of them got the meta-first
 * level merge below, which is `RUNWALK-ASSESSED-LEVEL-01` in a repair script.
 *
 * 🔴 AND FOUR OF THE EIGHT PASSED THE PLAN'S `meta` AS THE INPUT, CAST THROUGH
 * `as never` SO THE COMPILER COULD NOT OBJECT. `(meta.generator_input ?? meta)`
 * and `{ ...meta }` are not a `GeneratorInput`: `current_weekly_km`,
 * `longest_recent_run_km`, `days_available` and `days_cannot_train` are simply
 * absent, where the legacy branch here sets them to `0` / `7` / `[]` on purpose.
 * An invariant that does arithmetic on `undefined` gets `NaN`, every comparison
 * against which is false, so it **passes silently** — the worst available
 * outcome for a checker and indistinguishable from a clean plan.
 *
 * ── THE MERGE IS THE WHOLE POINT, AND IT IS NOT A SPREAD ─────────────────────
 * The raw runner constraints come from the persisted input (PV2-A), but
 * `fitness_level` / `fitness_intensity_level` / `user_declared_level` must come
 * from **meta**: those are what the engine DERIVED and built the plan with, and
 * the input's own `fitness_level` is frequently absent (the assessed path, §79),
 * which would re-derive the quality ceiling from the wrong level.
 */
export function storedPlanInput(plan: Plan, overlay?: Partial<GeneratorInput>): GeneratorInput {
  const m = plan.meta
  const persisted = m.generator_input
  const base: GeneratorInput = persisted
    ? {
        ...persisted,
        fitness_level:           m.fitness_level ?? persisted.fitness_level,
        fitness_intensity_level: m.fitness_intensity_level ?? persisted.fitness_intensity_level,
        user_declared_level:     m.fitness_level_declared ?? persisted.user_declared_level,
      }
    : {
        // Legacy plans generated before PV2-A carry no persisted input. Reconstruct
        // as before; the three zeroed fields self-skip their dependent invariants.
        race_date:             m.race_date,
        race_distance_km:      m.race_distance_km,
        goal:                  m.goal ?? 'finish',
        current_weekly_km:     0,   // absent on legacy meta — dependent invariants self-skip on 0
        longest_recent_run_km: 0,   // absent on legacy meta — dependent invariants self-skip on 0
        days_available:        m.days_available ?? 7,
        age:                   m.age ?? 40,
        fitness_level:         m.fitness_level,
        // §79 (2026-09-02) — carry the intensity level across the meta→input
        // round-trip. Without it the quality-per-week ceiling re-derives from
        // the structural level and a legitimately elevated-intensity plan fails
        // validation on every reshape.
        fitness_intensity_level: m.fitness_intensity_level,
        user_declared_level:   m.fitness_level_declared,
        training_age:          m.training_age,
        injury_history:        m.injury_history,
        hard_session_relationship: m.hard_session_relationship,
        benchmark:             m.benchmark,
        days_cannot_train:     [], // absent on legacy meta — blocked-days invariant skipped
      }
  if (!overlay) return base
  // ⚠️ DEFINED KEYS ONLY, NEVER A BARE SPREAD. `{ ...base, ...overlay }` lets an
  // overlay key that is present-and-`undefined` ERASE a value the merge above just
  // established — and a caller building `{ max_hr: row?.max_hr }` from a missing
  // profile row produces exactly that shape. Absence must not be written as a value.
  const out: GeneratorInput = { ...base }
  const bag = out as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(overlay)) if (v !== undefined) bag[k] = v
  return out
}
