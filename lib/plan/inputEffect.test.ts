import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { generateRulePlan } from './ruleEngine'
import { generatorInputFields, assertParsedShape } from './sweepInputCoverage'
import type { GeneratorInput, Plan } from '../../types/plan'

/**
 * INPUT-EFFECT-01 — every `GeneratorInput` field must DO something.
 *
 * THE SIBLING GAP, one more time. Three checks already stand guard over
 * configuration and each proves a different half of the same claim:
 *
 *   configPrincipleSync  — every GENERATION_CONFIG key has a PRINCIPLE
 *   configConsumer       — every GENERATION_CONFIG key has a CONSUMER
 *   sweepInputCoverage   — every GeneratorInput field is VARIED by the grid
 *
 * None of them proves a field MATTERS. The sweep can vary `terrain` across
 * thousands of plans, every plan can pass every invariant, and the field can be
 * read by nothing — the run reports the same number either way. That is the gap
 * this file closes: it varies each field off a baseline and asserts the
 * delivered plan actually changes.
 *
 * WHY THIS IS PRODUCT WORK, NOT HYGIENE. "Do the wizard's answers mean anything?"
 * is the paid proposition (CAT-DEPTH-01). Asked by hand it is an afternoon of
 * measurement that goes stale the next week; asked here it is a number that can
 * only improve, checked on every commit.
 *
 * WHAT IT FOUND ON ITS FIRST RUN (2026-09-08), none of which was known:
 *   • `terrain`  — a PAID wizard step ("Where do you run?", subtitled "Affects
 *     pace targets") echoed into meta and read by NOTHING. The UI states an
 *     effect the engine does not deliver.
 *   • `zone2_ceiling` — a declared input no caller sends and no code reads. The
 *     engine overwrites meta.zone2_ceiling with its own computed value.
 *   • `foundation_decision` and `acknowledged_prep_warning` both looked inert
 *     until the fixture was corrected — see THE FIXTURE TRAP below.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FIXTURE TRAP — read this before adding or debugging a spec.
 *
 * A field reported INERT is far more often a fixture that cannot reach its gate
 * than an engine that ignores it. This cost a wrong filing once already
 * (HSR-INERT-01's first version) and was hit three separate times while writing
 * this file:
 *
 *   `acknowledged_prep_warning` read inert under `goal: 'finish'` — inputs.ts:137
 *      treats the warn zone as ok for finish goals, so the gate never armed.
 *   `foundation_decision` read inert with the race 14 weeks out — the gap must
 *      exceed FOUNDATION_GAP_AUTO_DAYS (28) before the choice exists at all.
 *   `hard_session_relationship` read inert on a `2-5yr` fixture — §47's branch
 *      requires `5yr+`.
 *
 * So every spec whose field is gated carries a `baseline` that arms the gate,
 * and a `note` saying what the gate is. When a field starts reporting inert,
 * suspect the fixture first.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TODAY = '2026-09-08'
const raceDate = (weeks: number) => {
  const d = new Date(`${TODAY}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

/**
 * A deliberately CAPABLE baseline: experienced, 5yr+, quality-regular, 5 days,
 * real HR. Chosen because most gates in this engine open upward — a beginner
 * baseline leaves §47, §89 and the whole intensity ladder unreachable, and every
 * field behind them would read inert.
 */
const BASE: GeneratorInput = {
  race_distance_km: 10,
  race_date: raceDate(14),
  goal: 'time_target',
  target_time: '0:45:00',
  days_available: 5,
  age: 40,
  current_weekly_km: 45,
  longest_recent_run_km: 12,
  resting_hr: 50,
  max_hr: 186,
  preferred_long_run_day: 'sun',
  training_age: '5yr+',
  user_declared_level: 'experienced',
  recent_quality_training: 'regular',
  weeks_at_current_volume: 20,
} as GeneratorInput

/**
 * Engine DECISIONS. `meta.generator_input` and the raw echo fields
 * (`meta.terrain`, `meta.motivation_type`, …) are excluded deliberately: an
 * input copied into meta and rendered back has not changed what the engine
 * PRESCRIBED. Including the echo would make every field look consumed, which is
 * precisely the false pass this check exists to prevent — and would have hidden
 * both live findings above.
 */
const DERIVED_META = [
  'peak_km_target', 'volume_profile', 'volume_constrained', 'volume_constraint_note',
  'difficulty_band', 'difficulty_note', 'early_quality_onset', 'foundation_weeks_planned',
  'goal_pace_per_km', 'prep_time_status', 'prep_time_weeks_available', 'compressed',
  'compression_classification', 'intensity_reentry_active', 'intensity_reentry_weeks',
  'quality_pool_sizes', 'fitness_level', 'fitness_intensity_level', 'hr_derived_max',
  'hr_estimated_max', 'hr_zone_method', 'notes', 'days_available_status', 'time_compressed',
  'goal_beyond_measured_fitness', 'primary_metric', 'zone2_ceiling', 'plan_start',
  'days_required_ok', 'prep_time_weeks_required_ok',
] as const

/** Everything the runner is prescribed, as one comparable string. */
function prescription(p: Plan): string {
  const meta = (p.meta ?? {}) as unknown as Record<string, unknown>
  return JSON.stringify({
    weeks: p.weeks.map(w => ({
      n: w.n, km: w.weekly_km, type: w.type, phase: w.phase,
      label: w.label, theme: w.theme, lr: w.long_run_hrs,
      s: Object.entries(w.sessions).map(([day, s]) => {
        const sess = s as unknown as Record<string, unknown> | undefined
        return [day, sess?.type, sess?.label, sess?.detail, sess?.zone, sess?.hr_target,
          sess?.pace_target, sess?.distance_km, sess?.duration_mins, sess?.rpe_target,
          sess?.role, sess?.catalogue_id, sess?.coach_notes]
      }),
    })),
    meta: Object.fromEntries(DERIVED_META.map(k => [k, meta[k]])),
  })
}

interface Spec {
  /** Values to vary. `undefined` means "field absent" — absence is a value. */
  values: unknown[]
  /** Overrides that ARM this field's gate. See THE FIXTURE TRAP. */
  baseline?: Partial<GeneratorInput>
  /** What the gate is, for whoever debugs this next. */
  note?: string
  /**
   * Values excluded from measurement because they currently trip a TRACKED
   * engine defect, keyed to its backlog id. Not an escape hatch: the value is
   * dropped entirely rather than counted as an effect, and
   * `blockedValues only shrink` fails the moment one starts generating cleanly,
   * so a fixed defect cannot leave a stale exclusion behind. Same idiom as the
   * sweep's SWEEP-BASELINE-01 debt register.
   */
  blockedValues?: { value: unknown; defect: string }[]
}

const SPECS: Record<string, Spec> = {
  race_date:               { values: [raceDate(12), raceDate(14), raceDate(20)] },
  race_distance_km:        { values: [5, 10, 21.1], baseline: { goal: 'finish', target_time: undefined } },
  goal:                    { values: ['finish', 'time_target'] },
  current_weekly_km:       { values: [20, 45, 70] },
  longest_recent_run_km:   { values: [6, 12, 18] },
  days_available:          { values: [3, 5, 6],
                             blockedValues: [{ value: 3, defect: 'INTENSITY-3DAY-01' }],
                             note: 'days_available=3 is excluded pending INTENSITY-3DAY-01 — see the ' +
                                   'register below. 5 vs 6 still proves the field has an effect.' },
  age:                     { values: [25, 40, 60], baseline: { max_hr: undefined } },
  fitness_level:           { values: [undefined, 'beginner', 'experienced'] },
  user_declared_level:     { values: [undefined, 'beginner', 'experienced'],
                             baseline: { fitness_level: 'intermediate' },
                             note: '§79 — upward raises intensity only, downward binds both' },
  fitness_intensity_level: { values: [undefined, 'beginner', 'experienced'] },
  resting_hr:              { values: [undefined, 45, 70] },
  max_hr:                  { values: [undefined, 165, 195] },
  max_hr_source:           { values: [undefined, 'observed', 'user_confirmed'],
                             baseline: { max_hr: 165, age: 40 },
                             note: '§50 asymmetry only bites on a SUB-ESTIMATE max (Tanaka@40 = 180)' },
  training_age:            { values: ['<6mo', '2-5yr', '5yr+'] },
  recent_quality_training: { values: ['none', 'occasional', 'regular'],
                             note: '§89 — needs experienced intensity + 5yr+ + no injury, all in BASE' },
  weeks_at_current_volume: { values: [2, 20], note: '§29 fresh-return threshold is 8 weeks' },
  acknowledged_prep_warning: {
    values: [undefined, true],
    baseline: { race_distance_km: 42.2, race_date: raceDate(13), current_weekly_km: 30,
                longest_recent_run_km: 16, goal: 'time_target', target_time: '4:15:00' },
    note: 'warn requires goal=time_target — inputs.ts:137 treats warn as ok for finish goals. ' +
          'Its effect is REFUSAL, not a different plan.' },
  preferred_long_run_day:  { values: ['sat', 'sun'] },
  benchmark:               { values: [undefined,
                                      { type: 'race', distance_km: 5, time: '22:00' },
                                      { type: 'race', distance_km: 5, time: '28:00' }] },
  race_name:               { values: [undefined, 'Autumn 10K'] },
  target_time:             { values: ['0:40:00', '0:45:00', '0:55:00'] },
  zone2_ceiling:           { values: [undefined, 140, 155] },
  days_cannot_train:       { values: [[], ['mon', 'tue'], ['wed']] },
  max_weekday_mins:        { values: [undefined, 30, 90] },
  training_style:          { values: ['predictable', 'variety', 'minimalist', 'structured'] },
  hard_session_relationship: { values: ['avoid', 'neutral', 'love', 'overdo'],
                             note: '§47 needs 5yr+ and no injury history; §96 made `overdo` a brake' },
  motivation_type:         { values: ['identity', 'achievement', 'health', 'social'] },
  injury_history:          { values: [[], ['knee'], ['shin', 'knee']] },
  terrain:                 { values: ['road', 'trail', 'mixed'] },
  athlete_name:            { values: [undefined, 'Alex'] },
  foundation_decision:     { values: [undefined, 'add', 'skip', 'start_now'],
                             baseline: { race_date: raceDate(26) },
                             note: 'the choice only exists when the gap exceeds ' +
                                   'FOUNDATION_GAP_AUTO_DAYS (28); a near race never arms it' },
}

/**
 * INERT BY DESIGN — permanent, legitimate non-effects.
 *
 * The bar: the field is consumed SOMEWHERE real, just not by the rule engine's
 * prescription. An entry here must say where. "Nothing reads it" is never a
 * reason to be on this list — that is debt, below.
 */
const INERT_BY_DESIGN: Record<string, string> = {
  fitness_intensity_level:
    'Not a generation input. §79 — the engine DERIVES it, and validateReshapedPlan feeds it back ' +
    'in from plan meta (invariants.ts:4289) so a reshape is checked against the level the plan was ' +
    'actually built at. A caller supplying it on a fresh generation is correctly ignored.',
  athlete_name:
    'Personalisation copy, not prescription. Consumed by freeIntro.ts:40 (first-name greeting) and ' +
    'the enricher prompt (enrich.ts:315). It should not move a single session.',
  training_style:
    'Consumed by the ENRICHER (enrich.ts:324), not the engine — it colours AI voice, not the plan. ' +
    'docs/contracts/api/generate-plan.md:93 records it as removed from engine use in the R23 rebuild.',
  motivation_type:
    'Deliberately ignored by the engine. docs/contracts/api/generate-plan.md:93 — "Removed in R23 ' +
    'rebuild — motivation_type, training_style. Server ignores these fields if sent." Echoed to meta ' +
    'for the record only. Unlike training_style it does not reach the enricher either; if it is to ' +
    'stay, that is a product decision, not an engine one.',
}

/**
 * INERT DEBT — these SHOULD change the plan and do not. Removing one is progress.
 *
 * Precedent for how these get closed: MAX-WEEKEND-MINS-01 (2026-09-04) DELETED
 * the field rather than wiring it, on the reasoning that "a field that silently
 * does nothing is worse than an absent one, because a caller can reasonably
 * believe it works". Either resolution closes the entry; leaving it does not.
 */
const INERT_DEBT: Record<string, string> = {
  terrain:
    'THE SHARP ONE. A PAID wizard step — GeneratePlanScreen.tsx:167 asks "Where do you run?" and ' +
    'subtitles it "Affects pace targets." It affects nothing: ruleEngine.ts:5649 echoes it into meta ' +
    'and no code reads meta.terrain. The runner is told the answer matters and it does not. Same ' +
    'class as HSR-INERT-01, and worse, because the UI states the effect.',
  zone2_ceiling:
    'A declared input no caller sends (absent from the wizard AND from ' +
    'docs/contracts/api/generate-plan.md) and no code reads. ruleEngine.ts:5584 OVERWRITES ' +
    'meta.zone2_ceiling with the engine\'s own computed zones.zone2Ceiling, so supplying it is ' +
    'silently discarded. Strongest candidate for the MAX-WEEKEND-MINS-01 treatment: delete it.',
}

/** Refusals that are a legitimate, designed effect of a field. Anything else that
 *  throws is a broken fixture or a real defect, and must surface rather than be
 *  quietly counted as "this field did something". */
const REFUSAL_ERRORS = ['PrepTimeError', 'DaysAvailableError']

/**
 * ENGINE DEFECTS THIS CHECK FOUND, tracked rather than hidden.
 *
 * A value listed in a spec's `blockedValues` names one of these. The entry
 * exists so the exclusion carries its reason at the point of exclusion — a
 * fixture that quietly stops testing a value is the failure this file is
 * otherwise built to catch.
 */
const TRACKED_DEFECTS: Record<string, string> = {
  'INTENSITY-3DAY-01':
    'Found by INPUT-EFFECT-01 on its first run, 2026-09-08. A 3-day/week runner who declares ' +
    '`user_declared_level: "experienced"` receives a plan breaching INV-PLAN-INTENSITY-DISTRIBUTION ' +
    '(§1): 26.8% quality on a 10K (11/41), 28.6% on a 5K (10/35), against a 25% ceiling. Reproduces ' +
    'on 5K and 10K, both goals, at 2-5yr and 5yr+; `intermediate` is clean and HM is clean. §79 ' +
    'raises the intensity allowance on an upward declaration, and on a 3-day week the denominator ' +
    'is small enough that the allowance breaches the plan-wide ceiling. In production this LOGS AND ' +
    'SHIPS (enforceViolations only throws in dev/test), so real 3-day runners are being prescribed ' +
    'more than a quarter hard — the precise failure Zonna exists to prevent.',
}

interface Outcome { distinct: number; refusals: string[]; unexpected: string[]; blocked: string[] }

function measure(field: string, spec: Spec): Outcome {
  const seen = new Set<string>()
  const refusals: string[] = []
  const unexpected: string[] = []
  const blocked: string[] = []
  const isBlocked = (v: unknown) =>
    spec.blockedValues?.find(b => JSON.stringify(b.value) === JSON.stringify(v))

  for (const value of spec.values) {
    const block = isBlocked(value)
    const input = { ...BASE, ...(spec.baseline ?? {}), [field]: value } as GeneratorInput
    if (value === undefined) delete (input as unknown as Record<string, unknown>)[field]
    try {
      const p = prescription(generateRulePlan(input, 'paid'))
      // A blocked value that now generates cleanly means the defect is fixed.
      // Recorded, not silently absorbed — `blockedValues only shrink` reads this.
      if (block) blocked.push(`${JSON.stringify(value)} NOW GENERATES (${block.defect})`)
      else seen.add(p)
    } catch (err) {
      const name = (err as Error).constructor.name
      if (block) continue                       // tracked defect — excluded, not counted
      if (REFUSAL_ERRORS.includes(name)) {
        const reason = (err as { reason?: string }).reason ?? ''
        seen.add(`REFUSED:${name}:${reason}`)
        refusals.push(`${JSON.stringify(value)} → ${name}:${reason}`)
      } else {
        unexpected.push(`${JSON.stringify(value)} → ${name}: ${(err as Error).message.slice(0, 120)}`)
      }
    }
  }
  return { distinct: seen.size, refusals, unexpected, blocked }
}

describe('INPUT-EFFECT-01 — every GeneratorInput field changes the delivered plan', () => {
  const declared = generatorInputFields(readFileSync('types/plan.ts', 'utf8'))
  assertParsedShape(declared)

  const results = new Map<string, Outcome>()
  for (const field of declared) {
    const spec = SPECS[field]
    if (spec) results.set(field, measure(field, spec))
  }

  it('the baseline itself generates — otherwise every result below is meaningless', () => {
    expect(() => generateRulePlan(BASE, 'paid')).not.toThrow()
  })

  it('every declared field has a spec', () => {
    // Without this, adding a field to GeneratorInput and forgetting it here would
    // leave it unmeasured and invisible — the same shape as the four fields the
    // sweep coverage gate was built for.
    const missing = declared.filter(f => !(f in SPECS))
    expect(missing, [
      'These GeneratorInput fields are declared but this check never varies them,',
      'so nothing proves they do anything. Add a spec to SPECS (and read THE FIXTURE',
      'TRAP first — a gated field needs a baseline that arms its gate).',
    ].join('\n')).toEqual([])
  })

  it('no spec names a field that no longer exists', () => {
    const stale = Object.keys(SPECS).filter(f => !declared.includes(f))
    expect(stale, 'these specs describe removed fields — delete them').toEqual([])
  })

  it('no spec value crashes the engine for an unexpected reason', () => {
    // A throw that is not a designed refusal would otherwise be COUNTED as a
    // distinct outcome, so a field could "pass" purely by breaking. It is also
    // how a fixture silently stops testing what it claims to.
    const broken = Array.from(results.entries())
      .filter(([, r]) => r.unexpected.length > 0)
      .map(([f, r]) => `${f}: ${r.unexpected.join(' | ')}`)
    expect(broken, [
      'Generation threw for a reason that is not a designed refusal.',
      'Either the spec value is invalid (fix the fixture) or this is a real defect',
      '— it must not be silently counted as "the field had an effect".',
    ].join('\n')).toEqual([])
  })

  it('every field either changes the plan or is registered, with a reason', () => {
    const inert = Array.from(results.entries())
      .filter(([f, r]) => r.distinct < 2 && !(f in INERT_BY_DESIGN) && !(f in INERT_DEBT))
      .map(([f]) => f)

    expect(inert, [
      'Varying these fields produced an IDENTICAL plan every time, so a runner',
      'answering the question differently receives exactly the same thing.',
      '',
      'Before registering one as inert, re-read THE FIXTURE TRAP at the top of this',
      'file: three fields here looked inert only because the baseline could not reach',
      'their gate. Suspect the fixture first.',
      '',
      'If it really is inert: wire it, delete it (see MAX-WEEKEND-MINS-01), or add it',
      'to INERT_BY_DESIGN naming where it IS consumed.',
    ].join('\n')).toEqual([])
  })

  it('the INERT_BY_DESIGN register stays honest', () => {
    // A stale exemption is how a register becomes a lie — same rule configConsumer
    // applies to its own.
    const nowEffective = Object.keys(INERT_BY_DESIGN)
      .filter(f => (results.get(f)?.distinct ?? 0) >= 2)
    expect(nowEffective, 'these now change the plan — remove them from INERT_BY_DESIGN').toEqual([])

    const gone = Object.keys(INERT_BY_DESIGN).filter(f => !declared.includes(f))
    expect(gone, 'these fields no longer exist — remove them from INERT_BY_DESIGN').toEqual([])
  })

  it('the INERT_DEBT register only shrinks', () => {
    const fixed = Object.keys(INERT_DEBT).filter(f => (results.get(f)?.distinct ?? 0) >= 2)
    expect(fixed, 'these now have an effect — delete them from INERT_DEBT, that is progress').toEqual([])

    const gone = Object.keys(INERT_DEBT).filter(f => !declared.includes(f))
    expect(gone, 'these fields were removed — delete them from INERT_DEBT too').toEqual([])
  })

  it('every blocked value names a tracked defect', () => {
    const orphans = Object.entries(SPECS).flatMap(([field, spec]) =>
      (spec.blockedValues ?? [])
        .filter(b => !(b.defect in TRACKED_DEFECTS))
        .map(b => `${field}=${JSON.stringify(b.value)} → unknown defect "${b.defect}"`))
    expect(orphans, 'add the defect to TRACKED_DEFECTS with what it is').toEqual([])
  })

  it('blocked values only shrink — a fixed defect must not leave a stale exclusion', () => {
    const nowClean = Array.from(results.entries())
      .flatMap(([f, r]) => r.blocked.map(b => `${f}: ${b}`))
    expect(nowClean, [
      'These values were excluded because they tripped a tracked engine defect,',
      'and they now generate cleanly. Remove the blockedValues entry (and the',
      'TRACKED_DEFECTS record if nothing else references it) — that is progress.',
    ].join('\n')).toEqual([])
  })

  it('reports the effect surface, so the number is visible rather than inferred', () => {
    const effective = Array.from(results.values()).filter(r => r.distinct >= 2).length
    const total = results.size
    // Not a threshold to game — a printed fact. CAT-DEPTH-01 asks "do the wizard's
    // answers mean anything?"; this is that question with a number attached.
    console.log(
      `[INPUT-EFFECT-01] ${effective}/${total} GeneratorInput fields change the delivered plan; ` +
      `${Object.keys(INERT_BY_DESIGN).length} inert by design, ` +
      `${Object.keys(INERT_DEBT).length} debt (${Object.keys(INERT_DEBT).join(', ')})`)
    expect(effective + Object.keys(INERT_BY_DESIGN).length + Object.keys(INERT_DEBT).length)
      .toBe(total)
  })
})
