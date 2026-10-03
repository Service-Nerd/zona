// OPS-DIGEST-STORED-PLAN-DEBT-01 (2026-10-04) — did this plan's violation appear
// because the ENGINE REGRESSED, or because WE ADDED THE RULE?
//
// 🔴 THE GAP THIS CLOSES, STATED PRECISELY, BECAUSE THE BACKLOG ITEM FIRST GOT IT WRONG.
// `/api/ops/plan-audit` already alerts on a TRANSITION rather than on state, and its own
// header explains why: *"a probe that alerts on 'is this plan invalid?' would fire on
// every row every day, forever, and train us to ignore it."* That works. So the problem
// was never permanent daily noise — it fires once per change, then goes quiet.
//
// The problem is that ONE alert is ambiguous, and the ambiguity is expensive. A violation
// code set changes for two completely different reasons:
//
//   (a) the engine started producing bad plans          → urgent, wake someone
//   (b) we shipped a new invariant that judges old data → information, queue a remediation
//
// Both present identically: "a new violation class appeared". On 2026-10-03 the morning
// digest reported two §-violations as defects; **a full day went to proving that neither
// was one** — §82's exemption was missing from a checker, and §121's invariant was
// enforcing a proxy. Both were (b). Nothing in the report could say so.
//
// ── HOW IT DECIDES ───────────────────────────────────────────────────────────
// Regenerate the plan from its own stored `generator_input` with TODAY's engine and
// re-validate. If the violation comes back, the engine produces it now — (a). If it does
// not, the rule is newer than the plan — (b). No date bookkeeping, no table of "when did
// each invariant ship", nothing to go stale.
//
// ⚠️ AND THE PART THAT WAS EARNED BY FALSIFYING THE FIRST VERSION. A violation that
// disappears on regeneration may have disappeared because the regenerated plan NO LONGER
// CONTAINS THE THING THE RULE IS ABOUT — in which case the rule could not have fired and
// the "it's fixed" reading is vacuous. Measured: the first cut called `generateRulePlan`
// alone, which does NOT compose the foundation block (that is
// `composePlanWithFoundation`, ADR-020). All four plans regenerated with **0 foundation
// weeks**, so `INV-PLAN-FOUNDATION-WEEKDAY-HAS-DURATION` structurally could not fire, and
// every one would have been labelled "rule is newer" — including, had it been real, a
// genuine engine regression. **An allow-by-default arm is not a check.**
//
// So this runs the FULL pipeline and then refuses to answer unless the regenerated plan is
// SHAPE-COMPARABLE to the stored one. When it is not, the verdict is `undecidable` — never
// the reassuring one. Failing safe here means failing loud.
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { composePlanWithFoundation } from '@/lib/plan/foundationCompose'
import { validatePlan } from '@/lib/plan/invariants'
import type { GeneratorInput, Plan, Week } from '@/types/plan'

export type CodeVerdict =
  /** The engine produces this violation TODAY from the same inputs. Act on it. */
  | 'engine_regression'
  /** The rule post-dates the plan: today's engine does not produce it. Remediation queue. */
  | 'rule_newer_than_plan'
  /** Regeneration could not produce a comparable plan, so no honest verdict exists. */
  | 'undecidable'

export interface ClassifyResult {
  verdicts: Record<string, CodeVerdict>
  /** Why, in one line, for the report. Never silently empty. */
  note: string
  /** True when a regenerated, shape-comparable plan was obtained. */
  comparable: boolean
}

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const
const countSessions = (weeks: Week[]) =>
  weeks.reduce((n, w) => n + Object.values(w.sessions ?? {}).filter(Boolean).length, 0)
const foundationWeeks = (p: Plan) => p.weeks.filter(w => w.n <= 0)
const foundationWeekdaySessions = (p: Plan) =>
  foundationWeeks(p).reduce((n, w) => n + WEEKDAYS.filter(d => w.sessions?.[d]).length, 0)

/**
 * Is the regenerated plan close enough in SHAPE that "the violation is gone" means
 * something? Deliberately coarse and deliberately strict: it only has to catch the case
 * where a structural element vanished, which is what makes a zero vacuous.
 */
function shapeComparable(stored: Plan, fresh: Plan): { ok: boolean; why: string } {
  if (fresh.weeks.length !== stored.weeks.length) {
    return { ok: false, why: `week count ${stored.weeks.length} → ${fresh.weeks.length}` }
  }
  const sf = foundationWeeks(stored).length, ff = foundationWeeks(fresh).length
  if (sf !== ff) return { ok: false, why: `foundation weeks ${sf} → ${ff}` }
  const sfw = foundationWeekdaySessions(stored), ffw = foundationWeekdaySessions(fresh)
  if (sfw !== ffw) return { ok: false, why: `foundation weekday sessions ${sfw} → ${ffw}` }
  const ss = countSessions(stored.weeks), fs = countSessions(fresh.weeks)
  // A few sessions of drift is ordinary engine evolution; a collapse is not.
  if (ss > 0 && Math.abs(ss - fs) / ss > 0.25) return { ok: false, why: `session count ${ss} → ${fs}` }
  return { ok: true, why: `shape matches (${fresh.weeks.length}w, ${ff} foundation, ${fs} sessions)` }
}

/**
 * Classify each of `codes` for one stored plan.
 *
 * `codes` is normally the set the audit just flagged, not every code in the registry —
 * regeneration is expensive and only the changed set is in question.
 */
export function classifyCodes(
  stored: Plan,
  input: GeneratorInput,
  codes: readonly string[],
): ClassifyResult {
  const unresolved = (why: string): ClassifyResult => ({
    verdicts: Object.fromEntries(codes.map(c => [c, 'undecidable' as CodeVerdict])),
    note: why,
    comparable: false,
  })
  if (!codes.length) return { verdicts: {}, note: 'no codes to classify', comparable: false }

  const meta = stored.meta as unknown as Record<string, unknown>
  const tier = (meta.tier as 'free' | 'trial' | 'paid' | undefined) ?? 'paid'
  const planStart = meta.plan_start as string | undefined
  // The runway gap is a function of the date the plan was MADE, so composition has to be
  // asked the same question it was asked originally or the block comes out a different
  // size — or absent, which is the vacuity trap above.
  const madeOn = typeof meta.generated_at === 'string' ? meta.generated_at.slice(0, 10) : undefined
  if (!planStart) return unresolved('stored plan has no plan_start; cannot regenerate')

  let fresh: Plan
  try {
    fresh = generateRulePlan(input, tier, planStart)
  } catch (e) {
    // A designed refusal is a legitimate outcome and not a verdict.
    return unresolved(`regeneration refused: ${(e as Error).message?.slice(0, 120) ?? 'threw'}`)
  }

  // ADR-020: the route composes the foundation block AFTER generation, so a classifier
  // that stops at generateRulePlan is judging a different artifact from the one stored.
  if (foundationWeeks(stored).length > 0) {
    if (!madeOn) return unresolved('stored plan has foundation weeks but no generated_at to date the runway')
    try {
      fresh = composePlanWithFoundation(fresh, input, madeOn, 'add').plan
    } catch (e) {
      return unresolved(`foundation composition failed: ${(e as Error).message?.slice(0, 120) ?? 'threw'}`)
    }
  }

  const shape = shapeComparable(stored, fresh)
  if (!shape.ok) return unresolved(`not shape-comparable: ${shape.why}`)

  let freshCodes: Set<string>
  try {
    freshCodes = new Set(validatePlan(fresh, input).filter(v => v.severity === 'error').map(v => v.code))
  } catch (e) {
    // validatePlan throws on error severity under NODE_ENV=test/development. A throw means
    // the regenerated plan DOES violate something; it is not evidence of innocence.
    return unresolved(`re-validation threw (it violates something): ${(e as Error).message?.slice(0, 120)}`)
  }

  return {
    verdicts: Object.fromEntries(codes.map(c =>
      [c, freshCodes.has(c) ? 'engine_regression' : 'rule_newer_than_plan'])) as Record<string, CodeVerdict>,
    note: shape.why,
    comparable: true,
  }
}

/** Roll per-plan verdicts into the one line a daily report should lead with. */
export function summariseVerdicts(all: Array<Record<string, CodeVerdict>>) {
  const counts = { engine_regression: 0, rule_newer_than_plan: 0, undecidable: 0 }
  const regressionCodes = new Set<string>()
  for (const v of all) {
    for (const [code, verdict] of Object.entries(v)) {
      counts[verdict]++
      if (verdict === 'engine_regression') regressionCodes.add(code)
    }
  }
  return {
    ...counts,
    regressionCodes: Array.from(regressionCodes).sort(),
    /** The only field that should ever page anyone. */
    actionable: counts.engine_regression > 0 || counts.undecidable > 0,
  }
}
