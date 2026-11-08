import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mergePlan, type WeekCopyRejection } from './enrich'
import { validatePlan } from './invariants'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * ENRICH-RISK-TOKEN-01 (2026-11-08) — THE FIELD NOBODY ADDED TO THE LIST, TWICE OVER.
 *
 * The item was filed as one latent token in `meta.confidence_risks`. Re-measuring found the
 * shape rather than the instance: the enricher writes SEVEN prose surfaces, and the merge's
 * token rejector is a hand-kept list of FIVE.
 *
 * 🔑 THE REASON WAS ALREADY WRITTEN DOWN, ONE MODULE AWAY. `runnerProse.ts` chose a deep walk
 * over a field list for the em-dash rule and said why: *"The enriched plan's prose fields are
 * `coach_notes`, `coach_intro`, `theme`, `confidence_risks` TODAY. A hand-kept list is blind
 * to the field nobody adds to it."* This is that field, and `session.label` is the second.
 *
 * 📐 MEASURED 2026-11-08, production:
 *   · `meta.confidence_risks` tokens — **0 of 42 live items**, 2 in `plan_archive`: the same
 *     runner, the same sentence, snapshots on 10-28 and 11-04, so it WAS his live plan for at
 *     least a week. `ConfidenceBadge` (the one render site, on the plan reveal) has no token
 *     pass, so it would have shown literally.
 *   · `session.label` tokens — **0 live, 0 archived.** Preventive, stated as such.
 *   · `plan_enrich_week_copy_rejected` — **34 events in 11 days**, including on
 *     `meta.coach_intro`. The model emits tokens in plan-level prose routinely; these two
 *     fields simply had nothing to catch them.
 *
 * 🔴 AND THE INVARIANT WAS BLIND TO ONE OF THEM BY CONSTRUCTION.
 * `INV-PLAN-NO-PLACEHOLDER-COPY`'s `expected` string reads *"only session.coach_notes may
 * carry a token"* — a claim about every user-facing field — while its meta scan was
 * `typeof m[k] === 'string'`. `confidence_risks` is a `string[]`, so it could not enter the
 * population even had its key been in the filter, which it also was not. `session.label` WAS
 * scanned and merely unguarded at the boundary; `confidence_risks` was invisible to the
 * boundary AND the constitution at once.
 */

const ENGINE_LABEL = 'Easy run'

function basePlan(): Plan {
  return {
    meta: { notes: 'engine notes', coach_intro: 'engine intro', zone2_ceiling: 137 } as never,
    weeks: [{
      n: 1, phase: 'build', type: 'normal', label: 'Week 1', theme: 'Settle in.',
      sessions: { mon: { id: 'w1-mon', type: 'easy', label: ENGINE_LABEL, detail: null, coach_notes: [] } },
    }],
  } as unknown as Plan
}

function merge(
  meta: Record<string, unknown>,
  weekOver: Record<string, unknown> = {},
  tier: 'free' | 'trial' | 'paid' = 'paid',
): { plan: Plan; rejected: WeekCopyRejection[] } {
  const rejected: WeekCopyRejection[] = []
  const plan = mergePlan(
    basePlan(),
    { meta, weeks: [{ n: 1, label: 'Week 1', theme: 'Settle in.', sessions: {}, ...weekOver }] } as never,
    tier, r => rejected.push(r),
  )
  return { plan, rejected }
}

const RISK_CLEAN_A = 'Current base volume is low for a 14-week plan.'
const RISK_CLEAN_B = 'Three days a week is tight for this distance.'
/** The LIVE sentence, verbatim from `plan_archive` (user 2bce83cd, 10-28 and 11-04). */
const RISK_LIVE_TOKEN = 'Athlete reports overdo tendency with hard sessions; Zone 3 discipline ({{session_hr}}) is non-negotiable.'

describe('ENRICH-RISK-TOKEN-01 — confidence_risks is token-checked at the merge', () => {
  it('clean risks are accepted, so this is a guard and not a wall', () => {
    // The vacuity arm. Without it "reject everything" passes every arm below.
    const { plan, rejected } = merge({ confidence_score: 7, confidence_risks: [RISK_CLEAN_A, RISK_CLEAN_B] })
    expect(plan.meta.confidence_risks).toEqual([RISK_CLEAN_A, RISK_CLEAN_B])
    expect(rejected).toEqual([])
  })

  it('🔴 the LIVE tokenised sentence is dropped, and it is attributed', () => {
    const { plan, rejected } = merge({ confidence_score: 6, confidence_risks: [RISK_LIVE_TOKEN] })
    expect(plan.meta.confidence_risks, 'an emptied array is not set at all').toBeUndefined()
    expect(rejected).toEqual([{ weekN: null, field: 'confidence_risks', token: '{{session_hr}}' }])
  })

  it('🔴 PER ITEM, not per field — the two complete sentences survive the broken one', () => {
    // The decision that differs from the week path, where the field IS the unit of prose.
    // There is no engine copy to fall back to (the rule engine writes no risks), so rejecting
    // the array would leave the runner nothing where it can leave them two true sentences.
    const { plan, rejected } = merge({
      confidence_score: 5,
      confidence_risks: [RISK_CLEAN_A, RISK_LIVE_TOKEN, RISK_CLEAN_B],
    })
    expect(plan.meta.confidence_risks).toEqual([RISK_CLEAN_A, RISK_CLEAN_B])
    expect(rejected).toHaveLength(1)
    expect(rejected[0].field).toBe('confidence_risks')
  })

  it('every item is judged, so a second token is not shadowed by the first', () => {
    const { plan, rejected } = merge({
      confidence_score: 4,
      confidence_risks: ['Base is low: {{weekly_km}}.', RISK_CLEAN_A, 'Hold {{session_zone}}.'],
    })
    expect(plan.meta.confidence_risks).toEqual([RISK_CLEAN_A])
    expect(rejected.map(r => r.token)).toEqual(['{{weekly_km}}', '{{session_zone}}'])
  })

  it('a FREE tier never gets risks at all, token or not (INV-PLAN-008)', () => {
    const { plan, rejected } = merge({ confidence_score: 7, confidence_risks: [RISK_CLEAN_A] }, {}, 'free')
    expect(plan.meta.confidence_risks).toBeUndefined()
    expect(rejected, 'a tier block is not a token rejection').toEqual([])
  })

  it('the score is unaffected — a dropped sentence does not change the number', () => {
    // `confidence_score` is a number and cannot carry a token. It must not be collateral.
    const { plan } = merge({ confidence_score: 6, confidence_risks: [RISK_LIVE_TOKEN] })
    expect(plan.meta.confidence_score).toBe(6)
  })
})

describe('ENRICH-RISK-TOKEN-01 — session.label is token-checked too (0 instances, preventive)', () => {
  it('a clean rename is accepted', () => {
    const { plan, rejected } = merge({}, { sessions: { mon: { label: 'Easy — settle in' } } })
    expect(plan.weeks[0].sessions.mon!.label).not.toBe(undefined)
    expect(rejected).toEqual([])
  })

  it('🔴 a tokenised session label is refused and the engine label kept', () => {
    // The raw-render field: Today, Plan and Session Detail all print it with no prose owner,
    // so this is the worst exposure of the seven and had no boundary at all.
    const { plan, rejected } = merge({}, { sessions: { mon: { label: 'Hard: {{session_zone}}' } } })
    expect(plan.weeks[0].sessions.mon!.label).toBe(ENGINE_LABEL)
    expect(rejected).toEqual([{ weekN: 1, field: 'session_label', token: '{{session_zone}}' }])
  })

  it('a refused label does not refuse the session notes beside it', () => {
    const { plan, rejected } = merge({}, {
      sessions: { mon: { label: '{{session_distance}} km easy', coach_notes: ['Keep it under the ceiling.'] } },
    })
    expect(plan.weeks[0].sessions.mon!.label).toBe(ENGINE_LABEL)
    expect(plan.weeks[0].sessions.mon!.coach_notes).toEqual(['Keep it under the ceiling.'])
    expect(rejected.map(r => r.field)).toEqual(['session_label'])
  })
})

describe('ENRICH-RISK-TOKEN-01 — the invariant can now SEE an array-valued prose field', () => {
  const input = {} as GeneratorInput

  /** A plan that validates far enough for the placeholder block to run over its meta. */
  const planWithRisks = (risks: unknown): Plan => {
    const p = basePlan()
    ;(p.meta as unknown as Record<string, unknown>).confidence_risks = risks
    return p
  }
  const placeholderViolations = (p: Plan) =>
    validatePlan(p, input).filter(v => v.code === 'INV-PLAN-NO-PLACEHOLDER-COPY')

  it('🔴 a token in confidence_risks is now a violation, and it names WHICH sentence', () => {
    const v = placeholderViolations(planWithRisks([RISK_CLEAN_A, RISK_LIVE_TOKEN]))
    expect(v.map(x => x.message).join(' | ')).toContain('meta.confidence_risks[1]')
    expect(v.some(x => x.actual === '{{session_hr}}')).toBe(true)
  })

  it('clean risks produce NO violation — the scan is not firing on correct copy', () => {
    // The arm that makes the widening honest: 42 live risk items are clean and this check is
    // `warn`-severity on a surface the daily audit reads. A guard that fires on correct work
    // gets switched off, which this repo has recorded four times.
    expect(placeholderViolations(planWithRisks([RISK_CLEAN_A, RISK_CLEAN_B]))).toEqual([])
  })

  it('a non-string element cannot crash or be scanned as prose', () => {
    expect(() => placeholderViolations(planWithRisks([RISK_CLEAN_A, 7, null]))).not.toThrow()
    expect(placeholderViolations(planWithRisks([RISK_CLEAN_A, 7, null]))).toEqual([])
  })
})

describe('ENRICH-RISK-TOKEN-01 — the POPULATION, because a list is blind to what is not on it', () => {
  const ENRICH_SRC = readFileSync(join(process.cwd(), 'lib/plan/enrich.ts'), 'utf8')

  /**
   * 🔴 THE ARM THE PREVIOUS TWO INSTANCES OF THIS CLASS BOTH NEEDED AND NEITHER HAD.
   * `WEEK-THEME-TOKEN-ENRICH-01` guarded two of seven fields and left five; `ENRICH-META-TOKEN-01`
   * guarded two more and left two. Each shipped green. The thing that cannot be left out is the
   * COUNT: the prompt's `RETURN SCHEMA` is the enricher's contract, so the prose surfaces it
   * declares are the population, derived from the source rather than retyped here.
   */
  const schema = ENRICH_SRC.slice(
    ENRICH_SRC.indexOf('RETURN SCHEMA:'),
    ENRICH_SRC.indexOf('CONFIDENCE SCORE'),
  )

  it('the RETURN SCHEMA really was read — not an empty slice passing every arm below', () => {
    expect(schema.length).toBeGreaterThan(200)
    expect(schema).toContain('"confidence_risks"')
  })

  it('🔴 every prose surface the enricher may return is either guarded or named as the carrier', () => {
    // Declared by NAME with a reason, not pattern-matched: the one legitimate carrier is
    // `session.coach_notes` (1,115 live tokens, resolved at render by `renderGuidance`), and
    // `week.n` / `confidence_score` are numbers. Anything else the schema declares must appear
    // in `WeekCopyRejection`'s field union, which is what the merge can actually report.
    const PROSE = ['notes', 'coach_intro', 'confidence_risks', 'label', 'theme']
    const union = ENRICH_SRC.slice(ENRICH_SRC.indexOf('  field:'), ENRICH_SRC.indexOf('  /** The offending placeholder'))
    for (const f of PROSE) {
      expect(schema, `${f} must be in the enricher's RETURN SCHEMA for this arm to mean anything`)
        .toContain(`"${f}"`)
      expect(union, `${f} is a prose surface the enricher returns and the merge cannot report it`)
        .toContain(`'${f}'`)
    }
    // `session.label` is reported under its own name so a rejection cannot be mistaken for a
    // week label's — the two render in different places and only one has a prose owner.
    expect(union).toContain("'session_label'")
    // The carrier, named so its absence from the guards is a decision and not an oversight.
    expect(schema).toContain('"coach_notes"')
  })

  it('🔴 the merge guards each of them — the check that the list is not short again', () => {
    // Bounded to `mergePlan`, never the whole file: a token check mentioned in a comment is
    // not a token check. (`HOOK-RGBA-COMMENTS-01`, and three more on 2026-10-01.)
    const from = ENRICH_SRC.indexOf('export function mergePlan(')
    const body = ENRICH_SRC.slice(from).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    // One `firstPlaceholder` call per guarded surface: meta text loop (notes + coach_intro),
    // confidence_risks, week label/theme loop, session label.
    expect((body.match(/firstPlaceholder\(/g) ?? []).length).toBeGreaterThanOrEqual(4)
    for (const field of ["'confidence_risks'", "'session_label'"]) {
      expect(body, `${field} must be rejected in mergePlan's CODE, not its comments`).toContain(field)
    }
  })
})
