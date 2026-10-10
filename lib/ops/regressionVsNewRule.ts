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
  /**
   * 🔴 THE CODE GUARDS THE RUNNER'S OWN STATED INPUT, SO REPLAY CANNOT SAY ANYTHING
   * ABOUT THE ENGINE. `AUDIT-FOUNDATION-MISCOUNT-01`, 2026-10-09.
   *
   * `INV-INPUT-*` reads `input.current_weekly_km` / `input.longest_recent_run_km` and
   * nothing else. The input is STORED, so regenerating from it necessarily reproduces the
   * breach — which meant an input-level code could only ever come back
   * `engine_regression`, the one verdict that means "act on the engine".
   *
   * ⚠️ MEASURED CONSEQUENCE, 2026-10-08: the daily digest escalated
   * `INV-INPUT-LONGEST-LE-WEEKLY` as a live engine regression and recommended
   * *"stop the generator setting an early/foundation long run above weekly volume"*. The
   * generator was doing nothing of the kind. The runner had stated a 5 km week with a 6 km
   * longest run, which is impossible as entered, and the plan was fine.
   *
   * **Not clean, and must not be read as clean** — the same caveat `undecidable` carries.
   * It is a REAL breach that needs the runner's input corrected, not an engine change.
   */
  | 'input_breach'

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

/**
 * Does this code guard the runner's stated INPUT rather than the generated plan?
 *
 * The `INV-INPUT-` prefix is the declaration, and it is deliberately the prefix rather
 * than `week === 0`: **64 invariants use `week: 0`** as the plan-wide sentinel, so that
 * number cannot distinguish an input-level code from a plan-wide one, and it is the
 * collision this whole item exists to undo.
 */
export const isInputLevelCode = (code: string) => code.startsWith('INV-INPUT-')

/**
 * Violations that genuinely fall in a FOUNDATION week, i.e. one the plan actually carries
 * at `n <= 0` (ADR-020).
 *
 * 🔴 WHY THIS IS A FUNCTION AND NOT `(v.week ?? 1) <= 0`, WHICH IS WHAT IT REPLACED.
 * Two conventions collide on one sentinel:
 *   · ADR-020  — a foundation week has `n <= 0`
 *   · invariants.ts:1013 — `week: 0` means "input-level, plan-wide, NO specific week"
 * **64 invariants use `week: 0`.** So the old expression counted every plan-wide violation
 * as a foundation-week violation.
 *
 * ⚠️ MEASURED ACROSS ALL 32 STORED PLANS, 2026-10-09: the audit reported
 * `foundation_week_violations > 0` on **19** plans; the true count was **0 on every one of
 * them**, across **15 distinct codes**. **100% of the reports were wrong**, and the field's
 * own comment says it exists so *"triage starts in the right place"*.
 */
export function foundationWeekViolations(
  plan: Plan,
  violations: ReadonlyArray<{ week?: number | null }>,
): number {
  const ns = new Set(foundationWeeks(plan).map(w => w.n))
  // Membership in the plan's OWN foundation week numbers. A plan with no foundation block
  // has an empty set, so nothing can be counted against it — which is the case that was
  // being misreported.
  return violations.filter(v => v.week != null && ns.has(v.week)).length
}
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
    // `isInputLevelCode` FIRST: an input-level code reproduces by construction, so asking
    // `freshCodes.has(c)` about it is asking a question whose answer is always yes.
    verdicts: Object.fromEntries(codes.map(c =>
      [c, isInputLevelCode(c) ? 'input_breach'
        : freshCodes.has(c) ? 'engine_regression'
        : 'rule_newer_than_plan'])) as Record<string, CodeVerdict>,
    note: shape.why,
    comparable: true,
  }
}

/**
 * The verdict as a sentence, written into the ops_event's `reason` field.
 *
 * ⚠️ WHY `reason` AND NOT A NEW FIELD. The daily digest already selects
 * `detail->>'reason'` and already prints it. Writing here means the EXISTING consumer
 * reports the verdict tomorrow morning with no change to the digest at all — and a
 * mechanism that works with the consumer as it is beats one that needs a second edit
 * somewhere I cannot test. The structured `verdicts` map stays beside it for triage.
 *
 * This is the lesson from `run_walk_strategy` and `LoadShape.ariaLabel` applied in
 * advance: a value whose only consumer is a change someone still has to make is a value
 * nothing reads.
 */
/**
 * The note the audit route passes when a stored plan carries no
 * `meta.generator_input`. Exported so the route and this module cannot drift
 * apart on the string that decides the branch below — the `deloadCadence` /
 * `TIER-OWNER-01` lesson applied to a sentence.
 */
export const NO_INPUT_NOTE = 'not classified: stored plan carries no generator_input'

export function verdictReason(verdicts: Record<string, CodeVerdict>, note: string): string | null {
  const codes = Object.keys(verdicts)
  // 🔴 AN EMPTY VERDICT MAP USED TO RETURN `null`, AND THAT IS HOW NINE LIVE
  // PLANS BECAME SILENT (`BASEBUILD-AUDIT-BLIND-01`, 2026-10-10).
  //
  // `classifyCodes` returns no verdicts when the stored plan carries no
  // `meta.generator_input` — there is nothing to regenerate from, so the absence
  // is CORRECT and permanent for those rows. But the route only records
  // `verdict_note` when verdicts exist, so the one sentence explaining why
  // ("not classified: stored plan carries no generator_input") was **computed
  // and then thrown away**, and the daily digest's Q4 — which selects
  // `detail->>'reason'` — printed nothing at all.
  //
  // ⚠️ MEASURED: 9 of 34 live plans carry no stamp (2 base_build, 7 race plans
  // from April–June 2026 that predate the field). Their violations were counted
  // as invalid and their CAUSE was never reported, which is precisely the state
  // this module's own `UNDECIDABLE` branch exists to prevent — *"could not tell"
  // is not "fine"*. The rule was written; one case escaped it.
  //
  // So an empty map is no longer silence. It is only silence when there is also
  // nothing to say, i.e. no note.
  if (!codes.length) {
    if (note === NO_INPUT_NOTE) {
      return 'NOT CLASSIFIABLE — this plan carries no stored `generator_input`, so it cannot be '
        + 'regenerated and its violations cannot be attributed to a cause. Permanent for this '
        + 'row, not a transient failure. Treat as actionable: the violations are real and '
        + 'unexplained. Remediation is founder-gated under the live-plan policy '
        + '(BASEBUILD-GENINPUT-REMEDIATION-01, BASEBUILD-AUDIT-BLIND-01).'
    }
    return note ? `NO VERDICT — ${note}. "Could not tell" is not "fine".` : null
  }
  const regressions = codes.filter(c => verdicts[c] === 'engine_regression')
  const undecided = codes.filter(c => verdicts[c] === 'undecidable')
  const inputs = codes.filter(c => verdicts[c] === 'input_breach')
  // 🔴 INPUT BREACHES ARE REPORTED FIRST AND NAMED AS WHAT THEY ARE. On 2026-10-08 one
  // of these reached the digest as "ENGINE REGRESSION ... escalate it", and the
  // recommended fix was aimed at a generator doing nothing wrong. The sentence has to
  // say whose number is wrong, because the reader acts on the sentence.
  if (inputs.length && !regressions.length && !undecided.length) {
    return `INPUT BREACH — ${inputs.join(', ')} guards the runner's own STATED input, so `
      + `regenerating from the stored input reproduces it by construction and says nothing `
      + `about the engine. Not an engine defect and NOT clean: the runner's figures need `
      + `correcting, most often two fields entered on different bases.`
  }
  if (regressions.length) {
    return `ENGINE REGRESSION — today's engine reproduces ${regressions.join(', ')} from the same inputs. `
      + `This is a live defect, escalate it.`
      // ⚠️ Appended rather than dropped: a co-occurring input breach is still a real
      // finding, and the escalation sentence must not be the only thing the reader sees.
      + (inputs.length ? ` Also an INPUT BREACH on ${inputs.join(', ')} (the runner's stated figures, not the engine).` : '')
  }
  if (undecided.length) {
    return `UNDECIDABLE for ${undecided.join(', ')} — the plan could not be regenerated into a comparable `
      + `shape (${note}), so there is no verdict. Treat as actionable: "could not tell" is not "fine".`
  }
  return `NOT A DEFECT — the rule post-dates the plan. Today's engine does not reproduce `
    + `${codes.join(', ')} from the same inputs, so this is an older plan meeting a newer rule. `
    + `Remediation queue, not an alert.`
}

/** Roll per-plan verdicts into the one line a daily report should lead with. */
export function summariseVerdicts(all: Array<Record<string, CodeVerdict>>) {
  // ⚠️ `Record<CodeVerdict, number>`, not a literal — the compiler then forces every new
  // verdict to be handled here. It caught `input_breach` the moment it was added, which is
  // the only reason this tally and the union cannot drift.
  const counts: Record<CodeVerdict, number> = {
    engine_regression: 0, rule_newer_than_plan: 0, undecidable: 0, input_breach: 0,
  }
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
    /**
     * The only field that should ever page anyone.
     *
     * ⚠️ `input_breach` is DELIBERATELY NOT actionable-as-an-engine-alert: nothing in the
     * engine needs changing, the runner's stated input does. It is still not CLEAN, and
     * `verdictReason` says so in prose, but waking someone for it would be the same noise
     * that made this field unread in the first place (NOISE-GATE-01).
     */
    actionable: counts.engine_regression > 0 || counts.undecidable > 0,
    /** Separate, so a real input breach is visible without paging. */
    inputBreaches: counts.input_breach,
  }
}
