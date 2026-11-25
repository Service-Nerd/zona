import type { Plan } from '@/types/plan'
import { RESHAPE_SKIP_INVARIANTS, type Violation } from '@/lib/plan/invariants'
import { verifyPlan, rulesFor, type VerifyContext } from '@/lib/engine/verifier/verifyPlan'
import { buildRunnerProfile, factsFromInput } from '@/lib/engine/profile/buildRunnerProfile'
import { storedPlanInput } from '@/lib/plan/storedPlanInput'

/**
 * ADR-027 B3 step 3 — THE VERIFIER OVER LIVE PLANS, OBSERVE-ONLY.
 *
 * The number the cut-over needs. B3 ported 221 rules and the sitting held 14 of them at a
 * STRICTER reading than `validatePlan`'s; McMillan's order was that the fleet's exposure to
 * those readings is measured and reported to the founder BEFORE the verifier becomes the live
 * checker. `verifierAgreement.test.ts` answers it for a corpus of ~100 deliberately-broken
 * fixtures. **It cannot answer it for the plans people are actually running**, which is the
 * population the ruling is about, and the two have never agreed about anything yet.
 *
 * ── OBSERVE-ONLY IS STRUCTURAL HERE, NOT A PROMISE ──────────────────────────────────────────
 * This module is pure and returns only its own fields. It never writes, never touches the
 * per-user code set `/api/ops/plan-audit` alerts on, and its summary is recorded under its own
 * event `source`, which neither the per-user dedupe (`source === 'plan-audit'`) nor the fleet
 * step (`source === 'plan-audit-summary'`) reads. A strict reading cannot reach the digest, so
 * it cannot wake anyone before the founder has ruled.
 *
 * ── AS OF THE PLAN'S GENERATION DATE, OR NOT AT ALL ─────────────────────────────────────────
 * ⚠️ §10's staleness ramp moves a runner's level with the clock, so a profile built "now" is
 * not the profile the plan was built against — `GOALPACE-5K-CLOCK-01` is this exact arithmetic
 * taking a fixture from 4.66% to 5.44% across a 5% line with no commit in between. `VerifyContext`
 * says so in writing. So the as-of is `meta.generated_at`, falling back to the row's
 * `created_at` (the row was inserted at generation).
 *
 * 🔑 **AND WHEN BOTH ARE ABSENT THE PLAN IS NOT ASSESSED.** Reaching for `new Date()` there
 * would write absence as a value — the class that gave this repo two invented ages and a
 * `distance_km ?? 0` — and it would do it in the measurement a cut-over decision rests on. An
 * unassessed plan is counted and named, never folded into the clean total.
 *
 * ── THE JOIN IS BY RULE ID, AND THAT IS THE ALERT-RELEVANT GRAIN ────────────────────────────
 * `storedPlanCodes` produces a set of CODE strings, and the audit's transition alert compares
 * those sets. So "would this plan gain a finding?" is a question about rule ids, not about
 * (rule, week, day) — a rule both checkers fire on different weeks changes no code set and
 * wakes nobody. ⚠️ Totals are reported beside the rule sets so a within-rule change is still
 * visible rather than invisible.
 *
 * Both sides are filtered to `rulesFor(plan)` — the rules the verifier actually judges for THIS
 * plan's kind. Without that filter every unported invariant would read as a finding the verifier
 * LOST, which says nothing about the 14 held readings and would bury the number that matters.
 *
 * 🔴 AND THE BASELINE IS THE RESHAPE VARIANT, WHICH DROPS TWO RULES ON PURPOSE. `validateStoredPlan`
 * — what `/api/ops/plan-audit` actually calls — is `validateReshapedPlan`, which filters
 * `RESHAPE_SKIP_INVARIANTS` because `INV-PLAN-COVERS-RACE-DATE` and `INV-PLAN-RACE-ON-RACE-DAY`
 * fire on every legacy plan that ends short of race day (the F2 defect) and a reshape neither
 * caused that nor can fix it. **The verifier has no such policy, so the first measured run read
 * 8 plans flagged and 6 of them were this artefact** — the comparison asking a harsher question
 * than its baseline, not a strict reading biting. Those findings are reported in their own
 * bucket: visible, because the port still owes the verifier a strict-vs-reshape policy, and out
 * of `strict_only`, because they are not what the B3 sitting ruled on.
 *
 * 🔴 AND A SECOND ARTEFACT, WHICH THE FIRST MEASURED RUN READ AS THE ONE REMAINING STRICT HIT.
 * `storedPlanInput` takes the levels from `meta` on purpose, so the old validator judges a plan
 * at the level it was BUILT at. But `fitnessAssessment.ts:201` reads `input.fitness_level` as
 * the API structural override and lets it win the INTENSITY band too
 * (`assessedIntensity = input.fitness_level ?? assessed.intensity`), while nothing reads
 * `input.fitness_intensity_level` at all. So a §79-elevated plan — `fitness_level: 'beginner'`
 * with `fitness_intensity_level: 'intermediate'` — re-derives as a beginner, and
 * `INV-PLAN-QUALITY-PER-WEEK` judges it against a ceiling of 0 for seven weeks.
 * `COHORT-GRID-UNSET-LEVEL-01` from the other side: there a corpus SET the field the product
 * never sends; here a stored plan's own derived level is read back as that override.
 *
 * ⚠️ NOT PATCHED HERE. The level the planner reads is B4's subject, and silently composing a
 * different profile inside an ops probe would make this measurement agree with itself. The plan
 * is flagged `level_mismatch` instead, so a level-dependent finding is attributable rather than
 * counted as a strict reading. `(Verified: identical as of today, so §10's ramp is not the cause.)`
 */

/** Why a plan could not be assessed. Each one is counted and named; none is a pass. */
export type ShadowSkip = 'no_generation_date' | 'context_failed' | 'verifier_threw'

export type ShadowRow =
  | {
      assessed: true
      /** Rules the verifier fires that the old checker does not — THE cut-over number. */
      strict_only: string[]
      /** Fired by the verifier, but dropped by the baseline's OWN policy (`RESHAPE_SKIP_INVARIANTS`).
       *  Not a strict reading: a port gap, reported so it is neither counted nor hidden. */
      reshape_exempt: string[]
      /** Rules both fire, where the verifier is the harsher severity. */
      escalated: string[]
      /** Rules the old checker fires that the verifier does not. A cut-over must not lose these silently. */
      lost: string[]
      /** Finding counts, so a change WITHIN a rule is not invisible to the rule-id join. */
      new_findings: number
      old_findings: number
      /** A rule that could not evaluate. Never a pass (the verifier reports it as a finding). */
      unverified: number
      /** The profile's re-derived intensity disagrees with the level the plan was BUILT at, so a
       *  level-dependent finding on this plan measures the derivation, not the rule. */
      level_mismatch: boolean
      /** Per-rule INSTANCE counts, both sides, for rules either side fires. The rule-id join
       *  above answers "would the code set change"; this answers "did the rule's reach change",
       *  which the join cannot see and the totals can cancel out. */
      instances: Record<string, [newCount: number, oldCount: number]>
    }
  | { assessed: false; reason: ShadowSkip }

/**
 * The as-of date for a stored plan, or `null` when the plan cannot say when it was generated.
 * `null` is the honest answer and the caller must not substitute today for it.
 */
export function shadowAsOf(plan: Plan, createdAt: string | null): string | null {
  const generated = (plan.meta as unknown as { generated_at?: unknown }).generated_at
  const iso = typeof generated === 'string' && generated.length >= 10 ? generated
    : typeof createdAt === 'string' && createdAt.length >= 10 ? createdAt
    : null
  return iso ? iso.slice(0, 10) : null
}

/**
 * The verifier's context for a STORED plan, as of `asOf`.
 *
 * The composition `factsFromInput` → `buildRunnerProfile` is written out in six test files, each
 * pinning its own fixture's date. This owns the one case none of them covers and the one the
 * ruling names: a plan already in the field, judged as of the day it was built.
 */
export function verifierContextFor(plan: Plan, asOf: string): VerifyContext {
  const input = storedPlanInput(plan)
  return {
    input,
    profile: buildRunnerProfile(factsFromInput(input), {
      asOf,
      timezone: null,
      planStart: plan.meta?.plan_start,
    }),
  }
}

/** Worst severity per rule id, over the rules the verifier judges for this plan. */
function worstByRule(
  xs: Array<{ rule: string; severity: string }>,
  judged: Set<string>,
): Map<string, 'error' | 'warn'> {
  const out = new Map<string, 'error' | 'warn'>()
  for (const x of xs) {
    if (!judged.has(x.rule)) continue
    const sev = x.severity === 'error' ? 'error' : 'warn'
    if (sev === 'error' || !out.has(x.rule)) out.set(x.rule, sev)
  }
  return out
}

/**
 * Run the verifier beside the old checker for one stored plan.
 *
 * `oldViolations` is the FULL list from `validateStoredPlan` — every severity, not the
 * error-only slice the audit alerts on. Comparing error-only findings against the verifier's
 * error-and-warn output would report every pre-existing warn as a new strict reading.
 *
 * Never throws: an ops probe that can fail the run it observes is worse than no probe.
 */
export function shadowVerifyPlan(
  plan: Plan,
  oldViolations: Violation[],
  createdAt: string | null,
): ShadowRow {
  const asOf = shadowAsOf(plan, createdAt)
  if (!asOf) return { assessed: false, reason: 'no_generation_date' }

  let ctx: VerifyContext
  try { ctx = verifierContextFor(plan, asOf) } catch { return { assessed: false, reason: 'context_failed' } }

  let findings
  try { findings = verifyPlan(plan, ctx) } catch { return { assessed: false, reason: 'verifier_threw' } }

  const judged = new Set<string>(rulesFor(plan) as unknown as string[])
  // Materialised once: the totals, the per-rule counts and the rule-id join must all read the
  // SAME filtered population, or the three numbers describe three different things.
  const judgedFindings = findings
    .filter(f => judged.has(f.rule_id as string))
    .map(f => ({ rule: f.rule_id as string, severity: f.severity }))
  const judgedOld = oldViolations
    .filter(v => judged.has(v.code))
    .map(v => ({ rule: v.code, severity: v.severity as string }))
  const next = worstByRule(judgedFindings, judged)
  const prev = worstByRule(judgedOld, judged)

  const strict_only: string[] = []
  const escalated: string[] = []
  const reshape_exempt: string[] = []
  for (const [rule, sev] of Array.from(next)) {
    const was = prev.get(rule)
    // The baseline cannot report this rule at all, so its silence is not agreement and the
    // verifier firing is not a strict reading. Read from the owner's set, never a local copy.
    if (RESHAPE_SKIP_INVARIANTS.has(rule)) { reshape_exempt.push(rule); continue }
    if (!was) strict_only.push(rule)
    else if (was === 'warn' && sev === 'error') escalated.push(rule)
  }
  const lost = Array.from(prev.keys()).filter(r => !next.has(r))

  return {
    assessed: true,
    strict_only: strict_only.sort(),
    reshape_exempt: reshape_exempt.sort(),
    escalated: escalated.sort(),
    lost: lost.sort(),
    new_findings: judgedFindings.length,
    old_findings: judgedOld.length,
    unverified: findings.filter(f => f.detail.startsWith('unverified:')).length,
    level_mismatch: levelMismatch(plan, ctx),
    instances: instanceCounts(judgedFindings, judgedOld),
  }
}

/**
 * Per-rule instance counts, new against old.
 *
 * 🔴 WHY THIS IS NOT COVERED BY THE TOTALS. The first live run reported 489 new findings against
 * 487 old and that `+2` was the sum of **+8 on one plan's `INV-PLAN-LARGEST-SESSIONS-SPACED`**
 * (B3's ranking fix, genuinely reaching the fleet) and **−24 on one plan's
 * `INV-PLAN-NO-INVENTED-AGE`** (reported plan-wide by the verifier, per-week by the old checker)
 * nearly cancelling. Neither changes a code set, so the rule-id join is silent on both, and a
 * single total made a doubling and a 25-to-1 look like noise. Measured: 51 rules fired, 46 with
 * identical counts, 5 differing.
 */
function instanceCounts(
  next: Array<{ rule: string }>, prev: Array<{ rule: string }>,
): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {}
  for (const x of next) (out[x.rule] ??= [0, 0])[0]++
  for (const x of prev) (out[x.rule] ??= [0, 0])[1]++
  return out
}

/**
 * Does the profile's intensity differ from the level the plan was built at?
 *
 * Read from `meta.fitness_intensity_level` — §79's own result, persisted at generation — against
 * the profile's `intensity`. Absent meta means nothing to disagree with, so `false`: an absent
 * field is not a mismatch, and claiming one would be the same invention this flag exists to name.
 */
function levelMismatch(plan: Plan, ctx: VerifyContext): boolean {
  const built = (plan.meta as unknown as { fitness_intensity_level?: unknown }).fitness_intensity_level
  if (typeof built !== 'string') return false
  return ctx.profile.levels.intensity.value !== built
}

export interface VerifierShadowSummary {
  assessed: number
  /** Absent when every plan was assessed. Present-and-zero would read as "nothing to look at". */
  not_assessed?: Record<ShadowSkip, number>
  /** How many live plans would GAIN at least one code under the verifier. The cut-over figure. */
  plans_strict_only: number
  /** Plans flagged only by a rule the baseline's own policy drops. A port gap, not a divergence. */
  plans_reshape_exempt: number
  plans_escalated: number
  plans_lost: number
  /** Plans whose level-dependent findings are not comparable. See `levelMismatch`. */
  plans_level_mismatch: number
  /** Of the strict-only plans, how many are ONLY flagged by a level-dependent rule on a
   *  level-mismatched plan. The figure to subtract before reading `plans_strict_only`. */
  plans_strict_only_level_mismatch: number
  /** Which held readings actually bite, and on how many plans each. */
  strict_only_by_rule: Record<string, number>
  reshape_exempt_by_rule: Record<string, number>
  lost_by_rule: Record<string, number>
  /** Rules fired by either side, and how many have identical instance counts. */
  rules_fired: number
  rules_same_instances: number
  /** ONLY the rules whose instance counts differ: `rule -> [new, old]`. The identical ones are
   *  counted above rather than listed, so the payload says what moved and not what did not. */
  instance_delta_by_rule: Record<string, [number, number]>
  new_findings: number
  old_findings: number
  unverified: number
}

const tally = (xs: string[]): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const x of xs) out[x] = (out[x] ?? 0) + 1
  return out
}

/** Fleet-wide per-rule instance totals, reduced to the rules that actually differ. */
function instanceDelta(done: Array<Extract<ShadowRow, { assessed: true }>>): {
  rules_fired: number; rules_same_instances: number
  instance_delta_by_rule: Record<string, [number, number]>
} {
  const total: Record<string, [number, number]> = {}
  for (const r of done) {
    for (const [rule, [a, b]] of Object.entries(r.instances)) {
      const t = (total[rule] ??= [0, 0])
      t[0] += a; t[1] += b
    }
  }
  const entries = Object.entries(total)
  const differ = entries.filter(([, [a, b]]) => a !== b)
  return {
    rules_fired: entries.length,
    rules_same_instances: entries.length - differ.length,
    instance_delta_by_rule: Object.fromEntries(differ.sort(([a], [b]) => a.localeCompare(b))),
  }
}

/** The fleet's exposure to the 14 held readings, in one object a founder can read. */
export function summariseVerifierShadow(rows: ShadowRow[]): VerifierShadowSummary {
  const done = rows.filter((r): r is Extract<ShadowRow, { assessed: true }> => r.assessed)
  const skips = rows.filter((r): r is Extract<ShadowRow, { assessed: false }> => !r.assessed)
  const counts = tally(skips.map(s => s.reason)) as Record<ShadowSkip, number>
  return {
    assessed: done.length,
    ...(skips.length ? { not_assessed: counts } : {}),
    plans_strict_only: done.filter(r => r.strict_only.length).length,
    plans_reshape_exempt: done.filter(r => r.reshape_exempt.length).length,
    plans_escalated: done.filter(r => r.escalated.length).length,
    plans_lost: done.filter(r => r.lost.length).length,
    plans_level_mismatch: done.filter(r => r.level_mismatch).length,
    plans_strict_only_level_mismatch: done.filter(r => r.strict_only.length && r.level_mismatch).length,
    strict_only_by_rule: tally(done.flatMap(r => r.strict_only)),
    reshape_exempt_by_rule: tally(done.flatMap(r => r.reshape_exempt)),
    lost_by_rule: tally(done.flatMap(r => r.lost)),
    ...instanceDelta(done),
    new_findings: done.reduce((n, r) => n + r.new_findings, 0),
    old_findings: done.reduce((n, r) => n + r.old_findings, 0),
    unverified: done.reduce((n, r) => n + r.unverified, 0),
  }
}
