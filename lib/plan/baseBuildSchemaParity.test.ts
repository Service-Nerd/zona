// BASEBUILD-SCHEMA-CEREMONY-01 — a base-build plan must satisfy its own schema.
//
// 🔴 THE DEFECT, MEASURED ON LIVE DATA (2026-10-10). Two runners held a
// `plan_kind: 'base_build'` plan — one of them PAID — and the daily audit reported
// both as schema-invalid on `meta.athlete`, `charity`, `handle`, `notes`,
// `quit_date`, `version`. Race plans passed only because `ruleEngine` satisfies the
// dead fields with EMPTY STRINGS (`handle: ''`, `charity: ''`, `quit_date: ''`),
// which `generateBaseBuildPlan` does not do.
//
// ⚠️ THE ANSWER WAS SPLIT, NOT "THE CHECKER IS BROKEN". Five fields had ZERO live
// readers and are now `.optional()`; `athlete` has SEVEN and is now written by the
// producer. A fix in either direction alone would have been wrong.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PlanSchema, PlanMetaSchema } from './schema'
import { generateGetRunningPlan } from './getRunningPlan'
import type { GeneratorInput } from '@/types/plan'

const PINNED = '2026-10-12'

/** A runner the base build is FOR: low volume, a marathon too far away to build to. */
const input = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 42.2,
  race_date: '2027-04-24',
  current_weekly_km: 10,
  longest_recent_run_km: 8,
  days_available: 4,
  training_age: '6-18mo',
  goal: 'finish',
  user_declared_level: 'beginner',
  ...over,
} as GeneratorInput)

describe('BASEBUILD-SCHEMA-CEREMONY-01', () => {
  it('1. 🔴 a generated base-build plan PARSES — the whole defect, pinned', () => {
    const { plan } = generateGetRunningPlan(input(), PINNED, 29)
    const r = PlanSchema.safeParse(plan)
    expect(r.success,
      r.success ? '' : `base-build plan still fails its schema: ${JSON.stringify(
        r.error.issues.map(i => i.path.join('.')))}`).toBe(true)
  })

  it('2. the producer writes `meta.athlete`, because SEVEN live readers want it', () => {
    const { plan } = generateGetRunningPlan(input({ athlete_name: 'Sheena' }), PINNED, 29)
    expect(plan.meta.athlete).toBe('Sheena')
    // ...and the no-name case is the empty string, exactly as `ruleEngine` writes it,
    // never `undefined` — `profileInitials` then falls through to the email initial.
    const { plan: anon } = generateGetRunningPlan(input(), PINNED, 29)
    expect(anon.meta.athlete).toBe('')
  })

  it('3. the five reader-less fields are OPTIONAL, not required', () => {
    // ⚠️ Asserted against the schema itself, so the next person to re-tighten one
    // fails here rather than at 14:00 in the daily audit.
    for (const k of ['handle', 'charity', 'quit_date', 'version', 'notes'] as const) {
      const shape = (PlanMetaSchema as unknown as { shape: Record<string, { isOptional(): boolean }> }).shape
      expect(shape[k]?.isOptional(), `meta.${k} has no live reader and must not be required`).toBe(true)
    }
  })

  it('4. HR fields are optional, because a runner may genuinely have no HR data', () => {
    // Measured: base-build plan 812e7e2e carries neither max_hr nor resting_hr.
    const shape = (PlanMetaSchema as unknown as { shape: Record<string, { isOptional(): boolean }> }).shape
    for (const k of ['max_hr', 'resting_hr', 'zone2_ceiling'] as const) {
      expect(shape[k]?.isOptional(), `meta.${k} must tolerate a runner with no HR data`).toBe(true)
    }
  })

  // ── THE DURABLE HALF ──────────────────────────────────────────────────────
  // 🔴 TWO FIELDS OF ONE PAIR WERE WIDENED IN THE TS UNION AND NOT IN THE ZOD
  // TWIN. `plan_kind` was fixed on 2026-10-09 (BASEBUILD-SCHEMA-KIND-01) and
  // `week.phase` was still broken on 2026-10-10 — thirty lines apart in the same
  // file. A hand-written list on each side with a human in between is the
  // `deloadCadence` / `tierResolution` class, so it gets a mechanism.
  //
  // ⚠️ BOTH SIDES ARE PARSED FROM THE SOURCE, never typed here. A list typed into
  // this test would be a THIRD copy to drift.
  // ── BASEBUILD-ENRICH-VISIBILITY-01 ───────────────────────────────────────
  // 🔴 The fleet metric reported "every eligible plan has its AI coaching copy,
  // 0 of 23 missing" on a morning when a PAID runner held a base-build plan with
  // no voice. True, and it excluded the one runner it was about: `meta.enrichment`
  // was ABSENT, and absent is outside `enrichment is not null`.
  it('8. 🔴 a base-build plan SAYS it has no AI voice, and says WHY', () => {
    const { plan } = generateGetRunningPlan(input(), PINNED, 29)
    expect(plan.meta.enrichment,
      'absent is how a paid runner with no voice became invisible to the fleet metric',
    ).toBe('skipped_plan_kind')
  })

  it("9. the value is NOT 'skipped' — that one means free tier and is filtered OUT", () => {
    const { plan } = generateGetRunningPlan(input(), PINNED, 29)
    // The metric's own predicate: eligible = not null AND <> 'skipped'. This value
    // must land INSIDE that set, or the runner is invisible with a tidier field.
    const e = plan.meta.enrichment as string
    expect(e).not.toBe('skipped')
    expect(e != null && e !== 'skipped', 'must be countable as eligible-but-without-voice').toBe(true)
    // ...and it must not be mistaken for a success state.
    expect(['applied', 'applied_partial']).not.toContain(e)
  })

  it('10. the enum accepts it, so a stamped plan still parses', () => {
    const { plan } = generateGetRunningPlan(input(), PINNED, 29)
    expect(PlanSchema.safeParse(plan).success).toBe(true)
  })

  it('6. 🔴 every `Week.phase` the TS union allows is accepted by the Zod twin', () => {
    const types = readFileSync(join(__dirname, '..', '..', 'types', 'plan.ts'), 'utf8')
    const decl = /phase\?:\s*((?:'[a-z_]+'\s*\|\s*)+'[a-z_]+')/.exec(types)
    expect(decl, 'could not find Week.phase in types/plan.ts — the parse, not the rule, is broken').toBeTruthy()
    const tsPhases = Array.from(decl![1].matchAll(/'([a-z_]+)'/g)).map(m => m[1]).sort()
    expect(tsPhases.length, 'parsed an implausibly short TS union').toBeGreaterThan(4)

    const schemaSrc = readFileSync(join(__dirname, 'schema.ts'), 'utf8')
    const zodDecl = /phase:\s*z\.enum\(\[([^\]]+)\]\)/.exec(schemaSrc)
    expect(zodDecl, 'could not find the week phase z.enum in schema.ts').toBeTruthy()
    const zodPhases = Array.from(zodDecl![1].matchAll(/'([a-z_]+)'/g)).map(m => m[1]).sort()

    const missing = tsPhases.filter(x => !zodPhases.includes(x))
    expect(missing,
      `the TS union allows a week phase the schema rejects, so every plan carrying it fails: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('7. and `base_build` specifically is on BOTH sides — the measured defect', () => {
    const schemaSrc = readFileSync(join(__dirname, 'schema.ts'), 'utf8')
    const zodDecl = /phase:\s*z\.enum\(\[([^\]]+)\]\)/.exec(schemaSrc)!
    expect(zodDecl[1]).toContain("'base_build'")
    const { plan } = generateGetRunningPlan(input(), PINNED, 29)
    expect(plan.weeks.length).toBeGreaterThan(0)
    expect(new Set(plan.weeks.map(w => w.phase))).toEqual(new Set(['base_build']))
  })

  it('5. `athlete` is still REQUIRED — the half the schema got right', () => {
    const shape = (PlanMetaSchema as unknown as { shape: Record<string, { isOptional(): boolean }> }).shape
    expect(shape.athlete?.isOptional(),
      'athlete has 7 live readers; loosening it would hide the producer gap instead of fixing it').toBe(false)
  })
})
