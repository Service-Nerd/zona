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
import { judgeEnrichHealth, enrichmentStateOf, hasAiCopy, NOT_RECORDED, type EnrichStateRow } from './enrichHealth'

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
    const dir = join(__dirname, '..', '..', 'scripts')
    const writers = readdirSync(dir).filter(n => /\.tsx?$/.test(n)).map(n => join(dir, n))
      .filter(f => {
        const s = readFileSync(f, 'utf8')
        return /generateRulePlan\(|regenerateFromStored\(/.test(s)
          && (/savePlanForUser\(/.test(s) || /from\('plans'\)\s*\.\s*(upsert|update)\(/.test(s))
      })
    expect(writers.length, 'population: the five known rebuild scripts').toBeGreaterThanOrEqual(5)
    const unguarded = writers.filter(f => !/hasAiCopy\(/.test(readFileSync(f, 'utf8'))).map(f => f.split('/').pop())
    expect(unguarded).toEqual([])
  })
})
