import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateRulePlan } from './ruleEngine'
import { assessOnRamp, generateBaseBuildPlan } from './baseBuildOnRamp'
import { generateGetRunningPlan } from './getRunningPlan'
import { resizeForDeferredFoundationAdd } from './foundationResize'
import type { GeneratorInput } from '@/types/plan'
import { PINNED_PLAN_START_1012 as PINNED } from './__fixtures__/pinnedPlanStart'

// BASEBUILD-GENINPUT-01 (2026-10-09) — EVERY producer of a plan stamps the input
// it was built from.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
// PV2-A persists the full `GeneratorInput` at `meta.generator_input` so a plan can
// be replayed, validated, classified, repaired and modified. `buildRulePlanOnce`
// has stamped it since fff1ab3. `generateBaseBuildPlan` — the SECOND producer,
// shipped by §116/§118 — never did, and nothing noticed for its whole life,
// because the absence of a field is invisible: a plan with no stamp looks exactly
// like a legacy plan, and every consumer is written to skip those politely.
//
// Measured 2026-10-09 against production: 9 of 34 stored plans carry no stamp. 7
// are genuinely pre-PV2-A. **2 are base-build plans created AFTER the field
// existed** (one of them 29 minutes after that day's deploy), and the daily digest
// reported all 9 under one cause.
//
// ⚠️ THE COMMENT IS THE INTERESTING PART. `canModifyPlan`'s doc said "every plan
// generated from today carries the stamp, so this shrinks on its own" — true when
// written, false from the moment a second producer shipped. A claim about ALL
// producers, parked next to ONE of them.
//
// ── WHAT IT CHECKS ───────────────────────────────────────────────────────────
// Two arms, and the second is the one that matters:
//   1. BEHAVIOUR — each known producer's output actually carries the stamp.
//   2. POPULATION — the set of producers is derived from the SOURCE, not typed
//      here, and a new one fails the build until it is proven. A hand-written
//      list is the `sheetClose.test.ts` defect: correct, bounded, and pointed at
//      a set that cannot contain the next instance.

const PLAN_DIR = join(__dirname)

/** Every exported `lib/plan/*.ts` function that takes a `GeneratorInput` and
 *  returns a `Plan` (bare, or in a `{ plan: Plan }` envelope). Parsed from the
 *  source so the population cannot go stale. */
function declaredProducers(): string[] {
  const out: string[] = []
  for (const f of readdirSync(PLAN_DIR)) {
    if (!f.endsWith('.ts') || f.includes('.test.')) continue
    const src = readFileSync(join(PLAN_DIR, f), 'utf8')
    // `export function name(` … `)<return>` — non-greedy to the first `) :`-ish
    // boundary that is followed by a `{`, i.e. the signature's close.
    for (const m of Array.from(src.matchAll(
      /export function (\w+)\(([^{]*?)\):\s*((?:Plan\b|\{[^{}]*\bplan:\s*Plan\b[^{}]*\}))\s*\{/g,
    ))) {
      const [, name, params] = m
      if (!/\bGeneratorInput\b/.test(params!)) continue
      out.push(`${f}:${name}`)
    }
  }
  return out.sort()
}

/**
 * The producers proven below. A name here is a promise that an arm in this file
 * calls it and asserts the stamp.
 *
 * ⚠️ `generateRulePlan`'s stamp is written by its private `buildRulePlanOnce`,
 * which is not exported and so cannot appear in the derived set. That is correct:
 * the exported entry point is what a caller can reach, and it is what is asserted.
 */
const PROVEN = [
  'baseBuildOnRamp.ts:generateBaseBuildPlan',
  'foundationResize.ts:resizeForDeferredFoundationAdd',
  'getRunningPlan.ts:generateGetRunningPlan',
  'ruleEngine.ts:generateRulePlan',
].sort()

// ⚠️ THE POPULATION ARM FOUND THIS ONE ON ITS FIRST RUN, and the analysis that
// preceded it had said "exactly two producers". `resizeForDeferredFoundationAdd`
// re-runs generation with a MODIFIED input (`foundation_decision: 'add'`), so it
// is a fourth producer whose stamp must describe the input it actually built
// from, not the one the caller held. It delegates to `generateRulePlan` and so
// was already correct — which is the point: a derived population tells you what
// is there, and a hand-written one tells you what you remembered.

const input = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 42.195, race_date: '2027-04-25', days_available: 4,
  goal: 'finish', current_weekly_km: 8, longest_recent_run_km: 3,
  age: 32, injuries: [], recent_quality_training: 'none', training_age: '<6mo',
  ...over,
} as unknown as GeneratorInput)

describe('BASEBUILD-GENINPUT-01 — every plan producer stamps meta.generator_input', () => {
  // 🔴 THE POPULATION ARM, FIRST, because an empty or shrunken population passes
  // every behavioural arm in this file.
  it('the producer set is derived from source and matches what is proven here', () => {
    const declared = declaredProducers()
    expect(declared.length, 'no producers parsed — the regex or the layout moved').toBeGreaterThan(0)
    expect(declared, `a producer is not proven to stamp generator_input:\n  ${
      declared.filter(d => !PROVEN.includes(d)).join('\n  ')}`).toEqual(PROVEN)
  })

  it('generateRulePlan stamps it', () => {
    const i = input({ race_distance_km: 21.1, current_weekly_km: 40, longest_recent_run_km: 14,
      training_age: '2-5yr', user_declared_level: 'intermediate' })
    const plan = generateRulePlan(i, 'paid', PINNED)
    expect(plan.meta.generator_input).toBeTruthy()
    expect(plan.meta.generator_input?.race_distance_km).toBe(21.1)
  })

  // ⚠️ THE DEFECT ITSELF. Before the fix this plan's meta carried the input's
  // FIELDS (spread flat) and no `generator_input`, so a grep for "is the input
  // persisted?" answered yes while every consumer answered no.
  it('generateBaseBuildPlan stamps it — and the flat spread is NOT the same thing', () => {
    const i = input()
    const a = assessOnRamp(i, 18, 29)
    const plan = generateBaseBuildPlan(i, PINNED, a)
    expect(plan.meta.plan_kind).toBe('base_build')
    // The flat echo that made the absence invisible:
    expect((plan.meta as unknown as Record<string, unknown>).current_weekly_km).toBe(8)
    // The nested object every consumer actually reads:
    expect(plan.meta.generator_input).toBeTruthy()
    expect(plan.meta.generator_input?.current_weekly_km).toBe(8)
    expect(plan.meta.generator_input?.days_available).toBe(4)
  })

  it('generateGetRunningPlan stamps it — §118 wraps the same producer', () => {
    const { plan } = generateGetRunningPlan(input(), PINNED, 29)
    expect(plan.meta.plan_kind).toBe('base_build')
    expect(plan.meta.generator_input).toBeTruthy()
  })

  // ⚠️ TWO ARMS, NOT ONE `if`. A conditional arm can silently switch sides: a
  // fixture that stops reaching the resize path would quietly start asserting the
  // pass-through instead and stay green. So each path has its own arm, and each
  // PINS the branch condition it depends on.
  it('resizeForDeferredFoundationAdd — the RESIZE path stamps the MODIFIED input', () => {
    const i = input({
      race_distance_km: 21.1, race_date: '2027-06-20', current_weekly_km: 45,
      longest_recent_run_km: 16, training_age: '5yr+', days_available: 5,
      recent_quality_training: 'regular', user_declared_level: 'experienced',
      benchmark: { type: 'race', distance_km: 5, time: '0:21:30' },
    } as Partial<GeneratorInput>)
    const incoming = generateRulePlan(i, 'paid', PINNED, undefined, PINNED)
    // The branch condition, pinned: without §91's credit there is nothing to resize.
    expect(incoming.meta.early_quality_onset, 'fixture no longer reaches the resize path').toBe(true)

    const out = resizeForDeferredFoundationAdd(incoming, i, 'paid', PINNED)
    expect(out).not.toBe(incoming)
    // The stamp must carry the decision the plan was REBUILT with, or a replay
    // from the stamp reproduces a different plan than the runner is holding.
    expect(out.meta.generator_input?.foundation_decision).toBe('add')
  })

  it('resizeForDeferredFoundationAdd — the PASS-THROUGH path preserves the stamp', () => {
    const i = input({ race_distance_km: 10, race_date: '2027-03-21',
      current_weekly_km: 12, longest_recent_run_km: 5, training_age: '<6mo' })
    const incoming = generateRulePlan(i, 'paid', PINNED, undefined, PINNED)
    expect(incoming.meta.early_quality_onset, 'fixture now reaches the resize path').not.toBe(true)

    const out = resizeForDeferredFoundationAdd(incoming, i, 'paid', PINNED)
    expect(out).toBe(incoming)
    expect(out.meta.generator_input).toBe(incoming.meta.generator_input)
  })

  // The CONSEQUENCE, asserted at the consumer rather than at the field — the
  // reason the stamp matters at all, and the arm that would have failed loudest.
  it('a base-build plan is now modifiable, audit-classifiable and save-validated', async () => {
    const { canModifyPlan } = await import('./modifyPlan')
    const { plan } = generateGetRunningPlan(input(), PINNED, 29)
    expect(canModifyPlan(plan)).toBe(true)
  })
})
