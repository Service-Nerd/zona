// PLAN-SAVE-TWO-WRITER-01 — the modify sheet must not overwrite the server's enriched plan.
//
// 🔴 THE DEFECT. `runModifyPreview` read the stream until `rule_plan` and then `break`ed out
// of a `for await`, which CANCELS the reader (`readPlanStream`'s own doc: "a consumer that
// `break`s gets the reader cancelled for it"). The route's `waitUntil` carried on enriching
// and wrote the ENRICHED plan to `plans`. `acceptModify` then saved the RULE plan to the
// same row. **Two writers, one row, whichever lands last wins** — so a runner who accepted
// after enrichment landed silently overwrote their own AI coaching with the bare rule plan.
//
// ⚠️ THE TEST THAT MATTERS IS THE ORDERING, NOT THE PLAN. "It yields the rule plan first" is
// true of the BROKEN version too — that is the lesson `PLAN-STREAM-OWNER-01` recorded when
// its own gate had to compare TIME rather than content. So these assert what happens to the
// stream AFTER the preview, and what the save does with each arrival order.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createEnrichSaveCoordinator } from './enrichSaveCoordinator'
import type { Plan } from '@/types/plan'

const RULE     = { meta: { kind: 'rule' } } as unknown as Plan
const ENRICHED = { meta: { kind: 'enriched' } } as unknown as Plan

describe('the three orderings, through the real coordinator', () => {
  it('🔴 enrichment AFTER the save is PATCHED, not dropped', () => {
    // The live defect: the runner accepts, then enrichment lands. Pre-fix the client never
    // saw it at all and whichever write landed last won.
    const c = createEnrichSaveCoordinator<Plan>()
    c.beginSave()
    c.saveCompleted()
    expect(c.enrichmentArrived(ENRICHED)).toBe('patch')
  })

  it('enrichment DURING the save is QUEUED and handed back on completion', () => {
    // Patching here would be the same bug as a race: the in-flight save lands afterwards
    // and overwrites the enrichment with the rule plan.
    const c = createEnrichSaveCoordinator<Plan>()
    c.beginSave()
    expect(c.enrichmentArrived(ENRICHED)).toBe('queue')
    expect(c.saveCompleted()).toBe(ENRICHED)
  })

  it('enrichment BEFORE any save is IGNORED, and the caller must carry it', () => {
    // ⚠️ 'ignore' only means "the pending save will carry it" IF the caller writes the
    // enriched plan where the save reads from. That is the one line in the drain that makes
    // the difference between this and the original defect.
    const c = createEnrichSaveCoordinator<Plan>()
    expect(c.enrichmentArrived(ENRICHED)).toBe('ignore')
    expect(c.saveCompleted()).toBeNull()
  })

  it('a FAILED save drops the queued plan, so a retry cannot write a stale one', () => {
    const c = createEnrichSaveCoordinator<Plan>()
    c.beginSave()
    c.enrichmentArrived(ENRICHED)
    c.saveFailed()
    expect(c.saveCompleted()).toBeNull()
  })
})

describe('the stream is DRAINED, not cancelled', () => {
  // Behavioural on the real generator, because this is the half the coordinator cannot
  // express: the sheet has to still be reading when `final_plan` arrives.
  const ndjson = (...lines: unknown[]) => new Response(
    lines.map(l => JSON.stringify(l) + '\n').join(''),
    { headers: { 'content-type': 'application/x-ndjson' } },
  )

  it('🔴 `for await` + break CANCELS the stream — the pre-fix shape, proven', async () => {
    const { readPlanStream } = await import('@/lib/planStream')
    const res = ndjson({ type: 'rule_plan', plan: RULE }, { type: 'final_plan', plan: ENRICHED })
    const it = readPlanStream(res)
    // Exactly what the old code did.
    for await (const m of it) { if (m.type === 'rule_plan') break }
    // The generator is closed: the enriched plan is unreachable forever.
    const after = await it.next()
    expect(after.done).toBe(true)
    expect(after.value).toBeUndefined()
  })

  it('✅ manual `it.next()` leaves the stream OPEN, so final_plan still arrives', async () => {
    const { readPlanStream } = await import('@/lib/planStream')
    const res = ndjson({ type: 'rule_plan', plan: RULE }, { type: 'final_plan', plan: ENRICHED })
    const it = readPlanStream(res)
    let rule: Plan | null = null
    for (;;) {
      const { value, done } = await it.next()
      if (done || !value) break
      if (value.type === 'rule_plan') { rule = value.plan; break }
    }
    expect(rule).toEqual(RULE)
    // The whole fix, as one assertion.
    const after = await it.next()
    expect(after.done).toBe(false)
    expect(after.value?.type).toBe('final_plan')
    expect(after.value?.plan).toEqual(ENRICHED)
  })
})

describe('the sheet is wired to both halves', () => {
  const SRC = readFileSync(join(process.cwd(), 'app/dashboard/DashboardClient.tsx'), 'utf8')
  const CODE = SRC.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n')

  it('🔴 the cancelling shape is GONE from the modify path', () => {
    // The exact pre-fix expression. Comments are stripped first because the fix QUOTES it
    // for the next reader — the recorded `arm matching its own comment` class.
    expect(CODE).not.toMatch(/for await \(const msg of readPlanStream\(res\)\)/)
  })

  it('it drives the iterator by hand and hands the rest to the drain', () => {
    expect(CODE).toContain('const it = readPlanStream(res)')
    expect(CODE).toContain('drainModifyEnrichment(it)')
  })

  it('the drain uses the coordinator, and patches/ignores correctly', () => {
    expect(CODE).toContain('modifyCoordRef.current.enrichmentArrived(enriched)')
    expect(CODE).toMatch(/action === 'patch'/)
    // The line that makes 'ignore' mean "carried" rather than "discarded".
    expect(CODE).toMatch(/modifyPreviewRef\.current = \{ \.\.\.modifyPreviewRef\.current, next: enriched \}/)
  })

  it('🔴 beginSave happens BEFORE the first await, or mid-save arrivals patch too early', () => {
    const accept = CODE.slice(CODE.indexOf('async function acceptModify'))
    const begin  = accept.indexOf('beginSave()')
    const await1 = accept.indexOf('await ')
    expect(begin).toBeGreaterThan(-1)
    expect(begin).toBeLessThan(await1)
  })

  it('the save drains the queue after it lands', () => {
    expect(CODE).toContain('const queued = modifyCoordRef.current.saveCompleted()')
    expect(CODE).toContain('modifyCoordRef.current.saveFailed()')
  })

  it('⚠️ a new modify flow gets a FRESH coordinator', () => {
    // A stale 'saved' state would make the NEXT modification's enrichment patch over an
    // unrelated save. `clearModify` is the only place a flow is dropped (MODIFY-CONFIRM-01).
    const clear = CODE.slice(CODE.indexOf('function clearModify'), CODE.indexOf('function clearModify') + 600)
    expect(clear).toContain('createEnrichSaveCoordinator<Plan>()')
    expect(clear).toContain('modifyPreviewRef.current = null')
  })

  it('⚠️ and the sheet still does NOT wait for enrichment (ADR-006)', () => {
    // `PLAN-STREAM-OWNER-01` removed a measured 38,924 ms hold. The drain must be detached.
    expect(CODE).toMatch(/function drainModifyEnrichment/)
    expect(CODE).toMatch(/void \(async \(\) => \{/)
    // And nothing awaits it.
    expect(CODE).not.toMatch(/await drainModifyEnrichment/)
  })
})
