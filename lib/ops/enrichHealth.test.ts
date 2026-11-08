// OPS-ENRICH-HEALTH-01 — the judgement, and the denominator that makes it honest.
//
// 🔴 THIS FILE EXISTS BECAUSE I GOT THE DENOMINATOR WRONG AND REPORTED IT. I
// computed a failure rate from ops_events as `failed / (failed + server_saved)`
// and told the founder **67%** — in two commit messages, a registry row and the
// build log. `plan_enrich_server_saved` fires only when the server's backstop had
// to write, so it is a SUBSET of successes, not a success counter. Measured
// against the plans table instead: 18 eligible, 16 with voice, **2 without — 11%.**
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { judgeEnrichHealth, enrichmentStateOf, hasAiCopy, NOT_RECORDED, NOT_ELIGIBLE, type EnrichStateRow } from './enrichHealth'
import { REBUILT, stampRebuilt } from '@/lib/plan/enrichmentState'
import { PlanMetaSchema } from '@/lib/plan/schema'
import type { PlanMeta } from '@/types/plan'

/** The minimum PlanMetaSchema accepts, so the enum arm below tests the ENUM and nothing else. */
const META_FIXTURE = {
  athlete: 'A', race_name: 'X', race_date: '2027-04-01',
  race_distance_km: 42.2, plan_start: '2026-12-01', last_updated: '2026-11-08',
}

const row = (enrichment: string | null, user = 'u', at = '2026-10-02T10:00:00Z'): EnrichStateRow =>
  ({ user_id: user, created_at: at, enrichment })

describe('OPS-ENRICH-HEALTH-01', () => {
  it('1. free-tier `skipped` is NOT a failure and must not enter the denominator', () => {
    // A free plan is never enriched BY DESIGN. Counting it would deflate the rate
    // and make a real problem look smaller — the direction nobody questions.
    const v = judgeEnrichHealth([row('skipped'), row('skipped'), row('applied')])
    expect(v.eligible).toBe(1)
    expect(v.withoutVoice).toBe(0)
    expect(v.alert).toBe(false)
  })

  it('2. a LEGACY plan with no field is excluded — absent is not failed', () => {
    const v = judgeEnrichHealth([row(null), row(null), row('applied')])
    expect(v.eligible).toBe(1)
    expect(v.withVoice).toBe(1)
  })

  it('3. `applied_partial` HAS voice — it is the containment working, not a failure', () => {
    // 38 of 43 recorded failures were partial reverts. Treating them as failures is
    // how I first reported 43 users harmed when the real number was 2.
    const v = judgeEnrichHealth([row('applied_partial'), row('applied_partial'), row('applied')])
    expect(v.withVoice).toBe(3)
    expect(v.withoutVoice).toBe(0)
    expect(v.alert).toBe(false)
  })

  it('4. 🔴 a failed state is a runner with NO voice, and ANY of them alerts', () => {
    const v = judgeEnrichHealth([
      row('applied'), row('applied_partial'),
      row('failed_invalid_copy', 'a8263c02', '2026-09-26T07:08:00Z'),
      row('failed_unparseable', 'a2bd36da', '2026-10-02T14:46:00Z'),
    ])
    expect(v.eligible).toBe(4)
    expect(v.withoutVoice).toBe(2)
    expect(v.withoutVoicePct).toBe(50)
    expect(v.alert).toBe(true)
    // The affected list IS the remediation target, oldest first.
    expect(v.affected.map(a => a.user_id)).toEqual(['a8263c02', 'a2bd36da'])
  })

  it('5. a stuck `pending` runner has no voice either and is not quietly excluded', () => {
    // ENRICH-SAVE-01: `pending` is expected transiently. A runner still holding it
    // has no model copy, so excluding it would hide exactly the persistent case
    // that doc calls a defect.
    const v = judgeEnrichHealth([row('pending')])
    expect(v.withoutVoice).toBe(1)
    expect(v.alert).toBe(true)
  })

  it('6. an empty fleet is not a clean bill of health, and divides by nothing', () => {
    const v = judgeEnrichHealth([])
    expect(v.eligible).toBe(0)
    expect(v.withoutVoicePct, 'must not be 0% — there is nothing to divide').toBeNull()
    expect(v.alert).toBe(false)
  })

  it('7. enrichmentStateOf reads the self-describing field, null for legacy', () => {
    expect(enrichmentStateOf({ meta: { enrichment: 'applied' } } as never)).toBe('applied')
    expect(enrichmentStateOf({ meta: {} } as never)).toBeNull()
    expect(enrichmentStateOf(null)).toBeNull()
  })

  // ── REBUILD-VOICE-LOSS-01 (2026-10-28) ──────────────────────────────────────
  // Seven paid plans lost their AI copy to script rebuilds (3 on 28 Oct, 4 on 9–10 Oct)
  // and this check reported 1 of 17 without voice, because a rebuilt plan carries no
  // `enrichment` field and `null` meant "legacy" unconditionally.
  it('8. a plan with generator_input and no state is NOT legacy: it is without voice', () => {
    const gi = { race_distance_km: 42.2 }
    expect(enrichmentStateOf({ meta: { tier: 'paid', generator_input: gi } } as never)).toBe(NOT_RECORDED)
    expect(enrichmentStateOf({ meta: { tier: 'trial', generator_input: gi } } as never)).toBe(NOT_RECORDED)
    expect(enrichmentStateOf({ meta: { generator_input: gi, plan_kind: 'race' } } as never)).toBe(NOT_RECORDED)
    // Never enriched by design: stays out of the denominator.
    expect(enrichmentStateOf({ meta: { tier: 'free', generator_input: gi } } as never)).toBeNull()
    expect(enrichmentStateOf({ meta: { generator_input: gi, plan_kind: 'base_build' } } as never)).toBeNull()
    expect(enrichmentStateOf({ meta: { generator_input: gi, plan_kind: 'maintenance' } } as never)).toBeNull()
    // A recorded state always wins.
    expect(enrichmentStateOf({ meta: { tier: 'free', generator_input: gi, enrichment: 'skipped' } } as never)).toBe('skipped')

    const v = judgeEnrichHealth([row(NOT_RECORDED, 'a'), row('applied', 'b')])
    expect(v.eligible).toBe(2)
    expect(v.withoutVoice).toBe(1)
    expect(v.affected.map(a => a.user_id)).toEqual(['a'])
  })

  it('8b. a staged or get-running plan (`skipped_plan_kind`) is never eligible', () => {
    const v = judgeEnrichHealth([row('skipped_plan_kind'), row('applied')])
    expect(v.eligible).toBe(1)
    expect(v.withoutVoice).toBe(0)
  })

  it('9. hasAiCopy is true for BOTH enriched states, the one the rebuild guard missed', () => {
    expect(hasAiCopy({ enrichment: 'applied' })).toBe(true)
    expect(hasAiCopy({ enrichment: 'applied_partial' })).toBe(true)
    for (const s of [undefined, 'skipped', 'pending', 'failed_invalid_copy', 'skipped_plan_kind', NOT_RECORDED]) {
      expect(hasAiCopy({ enrichment: s } as never), String(s)).toBe(false)
    }
    expect(hasAiCopy(null)).toBe(false)
  })

  // The defect was a guard comparing `enrichment` with ONE of the two enriched states.
  // Every such comparison now goes through `hasAiCopy`; this fails on a new one.
  it('10. no source file compares enrichment with the bare literal \'applied\'', () => {
    const root = join(__dirname, '..', '..')
    const files: string[] = []
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        if (n === 'node_modules' || n.startsWith('.')) continue
        const f = join(d, n)
        if (statSync(f).isDirectory()) walk(f)
        else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) files.push(f)
      }
    }
    for (const d of ['app', 'lib', 'scripts', 'components']) walk(join(root, d))
    expect(files.length, 'population').toBeGreaterThan(200)
    // Both orders, strict and loose equality. A renamed variable (`s === 'applied'`) is
    // not caught here; test 11 holds the scripts that actually rewrite plans.
    const bare = /enrichment\s*[!=]==?\s*'applied'(?!_)|'applied'\s*[!=]==?\s*\S*enrichment/
    const bad = files.filter(f => bare.test(readFileSync(f, 'utf8')))
      .map(f => f.slice(root.length + 1))
    expect(bad).toEqual([])
  })

  // The four scripts the 28 Oct review found unguarded. Any script that REGENERATES a
  // plan and WRITES it to `plans` must consult `hasAiCopy`, directly or through
  // `regenRefusalReason` (whose `hasAiCopy` field is required).
  it('11. every script that regenerates and writes a live plan consults hasAiCopy', () => {
    const writers = rebuildWriters()
    expect(writers.length, 'population: the five known rebuild scripts').toBeGreaterThanOrEqual(5)
    const unguarded = writers.filter(f => !/hasAiCopy\(/.test(readFileSync(f, 'utf8'))).map(f => f.split('/').pop())
    expect(unguarded).toEqual([])
  })
})

/**
 * The scripts that REGENERATE a plan and WRITE it. Shared by test 11 (does it refuse to
 * destroy a working voice?) and the REBUILD-STAMP arm below (does it record what it left?).
 *
 * ⚠️ ONE DERIVATION, DELIBERATELY. Two arms asking different questions of the same
 * population used to hold two copies of this filter, and a copy is how a population silently
 * stops matching the thing at risk — the `deloadCadence` shape, in a test file.
 */
function rebuildWriters(): string[] {
  const dir = join(__dirname, '..', '..', 'scripts')
  return readdirSync(dir).filter(n => /\.tsx?$/.test(n)).map(n => join(dir, n))
    .filter(f => {
      const s = readFileSync(f, 'utf8')
      return /generateRulePlan\(|regenerateFromStored\(/.test(s)
        && (/savePlanForUser\(/.test(s) || /from\('plans'\)\s*\.\s*(upsert|update)\(/.test(s))
    })
}

/**
 * REBUILD-STAMP-ENRICHMENT-01 (2026-11-08) — a rebuild states its own enrichment state.
 *
 * 🔑 WHAT VIOLATION CLASS CAN THESE FIND? A new rebuild script that writes
 * `candidate = fresh` and leaves `meta.enrichment` ABSENT — which is what all five did until
 * today, and the reason `enrichmentStateOf` carries an inference duplicated in a
 * hand-mirrored SQL copy in the digest runbook. Also: the value being quietly added to
 * NOT_ELIGIBLE, which would make a rebuilt PAID runner invisible to the health check with a
 * tidier-looking field — the exact mistake `skipped_plan_kind`'s own comment records.
 *
 * ⚠️ WHAT IT DOES NOT PROVE. It does not prove any stored plan carries the stamp: nothing
 * backfills, by live-plan policy, and 13 of 41 stored plans were unstamped when this shipped.
 * It also cannot prove a rebuild script was RUN.
 */
describe('REBUILD-STAMP-ENRICHMENT-01', () => {
  it('every rebuild writer stamps the state, directly or through the regeneration owner', () => {
    const writers = rebuildWriters()
    expect(writers.length, 'population: the five known rebuild scripts').toBeGreaterThanOrEqual(5)
    const unstamped = writers.filter(f => {
      const s = readFileSync(f, 'utf8')
      // `regenerateFromStored` stamps its own output, so a caller of it needs nothing more.
      return !/stampRebuilt\(/.test(s) && !/regenerateFromStored\(/.test(s)
    }).map(f => f.split('/').pop())
    expect(
      unstamped,
      'Call `stampRebuilt` on the plan being WRITTEN (lib/plan/enrichmentState.ts), or build it '
      + 'with `regenerateFromStored`, which stamps. Leaving `meta.enrichment` absent makes the '
      + "health check INFER the state from generator_input + tier + plan_kind:\n" + unstamped.join('\n'),
    ).toEqual([])
  })

  it('the regeneration owner stamps its own output, so its callers cannot forget', () => {
    const src = readFileSync(join(__dirname, '..', 'plan', 'storedPlanRegen.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
    expect(src).toMatch(/stampRebuilt\(/)
  })

  it('stampRebuilt writes the state and touches nothing else', () => {
    const plan = { meta: { enrichment: 'failed_api_error', tier: 'paid', race_name: 'X' } as unknown as PlanMeta }
    const out = stampRebuilt(plan)
    expect(out.meta.enrichment).toBe(REBUILT)
    expect(out.meta).toEqual({ enrichment: REBUILT, tier: 'paid', race_name: 'X' })
  })

  // 🔴 THE ARM CODE REVIEW ASKED FOR, AND THE DEFECT WAS LIVE FOR AN HOUR.
  // The first cut of `stampRebuilt` wrote `skipped_rebuild` UNCONDITIONALLY, so a plan that
  // was never eligible for voice became eligible-and-without-voice the moment a repair
  // script touched it — and `fleet-invalid-debt-01-regen.ts` regenerates free-tier and
  // base-build plans. The digest's unwindowed count would have gained a permanent false
  // line reading "a runner has no AI coaching". Measured by review: `eligible: 1,
  // withoutVoice: 1, alert: true` where the honest answer is ineligible.
  it('🔴 a rebuild does NOT make an ineligible plan eligible', () => {
    const stamp = (meta: Record<string, unknown>) =>
      stampRebuilt({ meta: meta as unknown as PlanMeta }).meta.enrichment
    // Free tier was never going to be enriched: `skipped` is that reason, and it is filtered
    // out of the denominator.
    expect(stamp({ tier: 'free' })).toBe('skipped')
    // Not a race block: a DIFFERENT reason, which is why the two values exist separately.
    expect(stamp({ tier: 'paid', plan_kind: 'base_build' })).toBe('skipped_plan_kind')
    expect(stamp({ tier: 'free', plan_kind: 'base_build' })).toBe('skipped_plan_kind')
    expect(stamp({ tier: 'paid', plan_kind: 'maintenance' })).toBe('skipped_plan_kind')
    // A paid or trial RACE plan is the only case the new value describes.
    expect(stamp({ tier: 'paid' })).toBe(REBUILT)
    expect(stamp({ tier: 'trial' })).toBe(REBUILT)
    // And the judgement follows: an ineligible stamp stays out of the denominator.
    const v = judgeEnrichHealth([row('applied', 'a'), row('skipped', 'b'), row('skipped_plan_kind', 'c')])
    expect(v.eligible).toBe(1)
    expect(v.withoutVoice).toBe(0)
    expect(v.alert).toBe(false)
  })

  it('…and ONE owner decides it — `enrichmentStateOf` and `stampRebuilt` cannot disagree', () => {
    const src = readFileSync(join(__dirname, 'enrichHealth.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
    expect(src).toMatch(/neverEnrichedByDesign\(/)
    // The predicate must not be written out a second time here — the shape this whole
    // commit was about.
    expect(src).not.toMatch(/tier === 'free' \|\|/)
  })

  it('\u{1F534} the stamp is ELIGIBLE and reads as WITHOUT VOICE — a rebuilt paid runner has none', () => {
    // `skipped_plan_kind`'s comment makes the argument in full: stamping a value that lands in
    // NOT_ELIGIBLE keeps the runner invisible with a tidier field.
    expect(NOT_ELIGIBLE as readonly string[]).not.toContain(REBUILT)
    const v = judgeEnrichHealth([row('applied', 'a'), row(REBUILT, 'b')])
    expect(v.eligible).toBe(2)
    expect(v.withoutVoice).toBe(1)
    expect(v.affected.map(r => r.enrichment)).toEqual([REBUILT])
    expect(v.alert).toBe(true)
  })

  it('a stamped plan is read verbatim, never through the inference', () => {
    const gi = { race_distance_km: 42.2 }
    expect(enrichmentStateOf({ meta: { enrichment: REBUILT, tier: 'paid', generator_input: gi } } as never)).toBe(REBUILT)
    // The inference stays for the 13 of 41 stored plans that carry no stamp.
    expect(enrichmentStateOf({ meta: { tier: 'paid', generator_input: gi } } as never)).toBe(NOT_RECORDED)
  })

  // 🔴 MY FIRST CUT OF THIS ARM WAS HOLLOW AND THE MUTATION FOUND IT. It read
  // `expect(schema).toContain("'skipped_rebuild'")` against the raw source — so deleting the
  // enum entry left the arm GREEN, because the string still sits in the explanatory comment
  // I had written directly above it. **A source assertion passes on a comment**
  // (HOOK-RGBA-COMMENTS-01), and this is the fourth time in two days I have asserted against
  // prose I had just typed. So it PARSES the schema instead: a value that is not in the enum
  // cannot be stamped onto a plan that still validates, which is the property that matters.
  it('a stamped plan PARSES — the value is in the enum, not merely in a comment', () => {
    const ok = PlanMetaSchema.safeParse({ ...META_FIXTURE, enrichment: REBUILT })
    expect(ok.success, ok.success ? '' : JSON.stringify(ok.error.issues.slice(0, 3))).toBe(true)
    // The negative half: an undeclared value must be REFUSED, or the arm above proves nothing.
    expect(PlanMetaSchema.safeParse({ ...META_FIXTURE, enrichment: 'skipped_invented' }).success).toBe(false)
  })
})
