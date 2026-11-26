import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
import { TRIGGER_RULES, triggersFor } from './triggers'
import { TRIGGER_TYPES, DETECTED_TRIGGER_TYPES, type TriggerType } from '@/lib/engine/contracts/triggers'
import { TRIGGER_EVALUATION_EVENTS, type RunEventName } from '@/lib/engine/contracts/events'
import * as CONSTANTS from '@/lib/coaching/constants'

/**
 * ADR-027 B3 step 4b — the trigger catalogue (ARCH-ENG-018).
 *
 * ── WHAT THESE ARMS ARE FOR ─────────────────────────────────────────────────────────────────────
 * The catalogue is DATA about rules whose predicates live elsewhere, so the risk is not that a
 * condition is wrong — it is that a row points at something that no longer exists, or that the set
 * of rows and the set of trigger types drift apart. Both are silent: a row naming a deleted constant
 * reads exactly like a row naming a live one.
 *
 * 🔻 WHAT THEY DO NOT CHECK, stated rather than discovered later:
 *  · **Nothing proves a row's `evaluates_on` matches what the code does, because nothing evaluates
 *    on an event yet.** The events are a vocabulary (4a) that no path raises. These arms prove the
 *    catalogue is internally consistent with the ruling; proving the RUNTIME obeys it is
 *    `TRIGGERS-ON-DATA-ARRIVAL-01`, and there is nothing to assert against until then.
 *  · They do not check PRIORITY. `triggerInputs.test.ts` observes the detector's order by peeling,
 *    and the catalogue deliberately holds no copy of it.
 *  · They do not check a threshold's VALUE. `configPrincipleSync` / `configConsumer` own that
 *    question for `GENERATION_CONFIG`; these constants are `lib/coaching/constants.ts`'s.
 */

const byId = new Map(TRIGGER_RULES.map(r => [r.id, r]))

describe('ADR-027 step 4b — the trigger catalogue', () => {
  it('🔴 has exactly one row per TriggerType, and no row for anything else', () => {
    // Both directions. A missing row is a trigger outside the catalogue's reach; an extra row is a
    // catalogue entry for a trigger the detector cannot raise. The vocabulary is the population.
    expect(Array.from(byId.keys()).sort()).toEqual([...TRIGGER_TYPES].sort())
    expect(TRIGGER_RULES.length, 'duplicate row for a trigger type').toBe(TRIGGER_TYPES.length)
  })

  it('🔴 every threshold it names RESOLVES to a live exported constant', () => {
    // This is the arm that earns the file. The rows name SYMBOLS rather than copying numbers
    // (ARCH-ENG-003), which is only safer than a copy while the symbol exists — a renamed constant
    // leaves the row pointing at nothing and reads identically to a correct row.
    const missing: string[] = []
    for (const r of TRIGGER_RULES) {
      for (const k of r.threshold_keys) {
        if (!(k in CONSTANTS)) missing.push(`${r.id} → ${k}`)
      }
    }
    expect(missing, 'row names a constant lib/coaching/constants.ts does not export').toEqual([])
    // 🔴 AND PER ROW, NOT IN AGGREGATE. This was `flatMap(...).length > 8` — one fat row satisfied
    // the count for all ten, and `readiness_signal` named NO threshold at all while `READINESS`
    // governs it. **An aggregate non-emptiness check cannot see a missing member** (the
    // `threshold-cannot-see-a-missing-member` shape, again). Every row we claim to DETECT must name
    // at least one symbol; the two user-initiated rows are exempt because the runner tells us.
    const bare = TRIGGER_RULES.filter(r => r.detected && r.threshold_keys.length === 0).map(r => r.id)
    expect(bare, 'a detected trigger with no named threshold is a row that explains nothing').toEqual([])
  })

  it('🔴 no row evaluates on `run_arrived` — that would reverse the 2026-11-21 ruling', () => {
    // The ruling is "the evaluation event is run_analysed, never raw ingest". Asserted against the
    // DERIVED list from `events.ts`, not a literal, so flipping `evaluates_triggers` there fails here
    // too rather than quietly legalising a row.
    const illegal: string[] = []
    for (const r of TRIGGER_RULES) {
      // ⚠️ `Array.isArray`, not `!== 'never_on_arrival'`: the second form was written when there
      // was one non-array value, and `week_close` arriving made it iterate a STRING character by
      // character. Narrow on the SHAPE, never on one of its members.
      if (!Array.isArray(r.evaluates_on.on)) continue
      for (const e of r.evaluates_on.on) {
        if (!TRIGGER_EVALUATION_EVENTS.includes(e)) illegal.push(`${r.id} → ${e}`)
      }
    }
    expect(illegal, 'a trigger may only evaluate on an event flagged evaluates_triggers').toEqual([])
  })

  it('🔴 `shadow_load` is the ONLY trigger a free or manual-log runner evaluates', () => {
    // Ruled in as many words: "free/manual: run_logged, shadow_load only". The expensive way to get
    // this wrong is to widen it, which silently starts adjusting plans for runners with no analysis.
    expect(triggersFor('run_logged')).toEqual<TriggerType[]>(['shadow_load'])
    expect(triggersFor('run_analysed')).toContain('shadow_load')
  })

  it('a trigger that is not detected raises nothing, and vice versa', () => {
    // `skip_with_reason` and `session_reorder` are the runner telling us. Keeping the two fields in
    // step means the catalogue cannot describe a trigger we both watch for and never act on.
    for (const r of TRIGGER_RULES) {
      expect(r.detected, `${r.id}`).toBe(r.raises !== null)
    }
    expect(TRIGGER_RULES.filter(r => r.detected).map(r => r.id).sort())
      .toEqual([...DETECTED_TRIGGER_TYPES].sort())
  })

  it('every row NOT evaluated on an arriving run says WHY, so absence is never bare', () => {
    // A trigger excluded from arrival evaluation is a RULED exclusion, not a gap nobody has reached.
    // Without the note the two are indistinguishable, which is the absence-as-a-value shape.
    // ⚠️ Keyed on `!Array.isArray`, so `week_close` is covered too — keyed on the one member name it
    // would have let a `week_close` row ship with an empty note.
    const nonArrival = TRIGGER_RULES.filter(r => !Array.isArray(r.evaluates_on.on))
    for (const r of nonArrival) {
      expect(r.evaluates_on.note!.length, `${r.id} is excluded with no reason`).toBeGreaterThan(20)
    }
    expect(nonArrival.length, 'no non-arrival rows — this arm is over an empty population').toBeGreaterThan(0)
  })

  it('🔴 the ruling\'s two MIN_RUNS gates do not exist yet, and this arm is the reminder', () => {
    // The 2026-11-21 ruling requires `ZONE_DRIFT_MIN_RUNS` (2) and `EF_DECLINE_MIN_RUNS` (2) before
    // either trigger may fire on an arriving run. **Neither constant exists**, which is correct today
    // — nothing evaluates on arrival — and would be a silent hole the moment something did.
    // ⚠️ This arm FAILS when someone adds them, on purpose: it is the one place that says "now wire
    // them into the row's threshold_keys". A note in a comment would not have said it.
    // ⚠️ BOTH HOMES, not just `constants.ts`. The ruling's own words are "literals move into
    // `GENERATION_CONFIG.ADJUSTMENT_TRIGGERS`", so that is the likelier place for them to appear —
    // and watching only `constants.ts` would have left this reminder green on exactly the commit it
    // exists to catch. Found by code review.
    const cfg = JSON.stringify(GENERATION_CONFIG)
    for (const k of ['ZONE_DRIFT_MIN_RUNS', 'EF_DECLINE_MIN_RUNS']) {
      const where = k in CONSTANTS ? 'lib/coaching/constants.ts' : /"ADJUSTMENT_TRIGGERS"/.test(cfg) && new RegExp(`"${k}"`).test(cfg) ? 'GENERATION_CONFIG' : null
      expect(where, `${k} now exists in ${where} — add it to its row's threshold_keys and delete this arm`).toBe(null)
    }
    // And the rows that will need them are the two the ruling names, recorded so the reminder knows
    // where to point.
    expect(byId.get('zone_drift')!.evaluates_on.note).toMatch(/ZONE_DRIFT_MIN_RUNS/)
    expect(byId.get('ef_decline')!.evaluates_on.note).toMatch(/EF_DECLINE_MIN_RUNS/)
  })

  it('🔴 `ef_decline` evaluates at week close and is NOT returned for an arriving run', () => {
    // 🔴 The first cut had `on: ['run_analysed']` with a note saying week close. The note was right;
    // the only machine-readable field was wrong; every arm was green. 4c reads `triggersFor`, so EF
    // would have been evaluated on every arrival — the thing the 2026-11-21 ruling forbids.
    expect(byId.get('ef_decline')!.evaluates_on.on).toBe('week_close')
    expect(triggersFor('run_analysed')).not.toContain('ef_decline')
    expect(triggersFor('run_logged')).not.toContain('ef_decline')
  })
})

describe('ADR-027 step 4b — the vocabulary moved, it was not copied', () => {
  it('🔴 `planAdjustment` re-exports the SAME arrays, not equal copies', async () => {
    // Identity, not deep equality — two separate arrays can be equal. Same arm shape as 4a's
    // `RUN_UNMATCHED_REASONS` check, and for the same reason: the type list moved into L2 so the
    // catalogue need not import a module that drags `invariants` and the plan engine with it
    // (ARCH-ENG-001), and `planAdjustment` keeps exporting it so no consumer changed.
    const pa = await import('@/lib/coaching/planAdjustment')
    expect(pa.TRIGGER_TYPES).toBe(TRIGGER_TYPES)
    expect(pa.DETECTED_TRIGGER_TYPES).toBe(DETECTED_TRIGGER_TYPES)
    // `RPE_DISCONNECT_THRESHOLD` was the one genuine inline literal in `planAdjustment`; it moved to
    // its ten siblings in `constants.ts`. `triggerInputs.ts` imports it FROM `planAdjustment`
    // deliberately, so the re-export is load-bearing, not politeness.
    expect(pa.RPE_DISCONNECT_THRESHOLD).toBe(CONSTANTS.RPE_DISCONNECT_THRESHOLD)
    expect(CONSTANTS.RPE_DISCONNECT_THRESHOLD, 'value unchanged by the move').toBe(8)
  })

  it('🔴 L2 imports nothing from L3+ — ARCH-ENG-001 is the whole reason the vocabulary moved', () => {
    // 🔴 THIS ARM USED TO ASSERT A LENGTH EQUALITY UNDER AN IMPORT-BOUNDARY TITLE, so it could not
    // fail on an import and the title was the only thing claiming it could — an allow-by-default arm
    // wearing a real arm's name. Found by code review. It reads the import statements now.
    //
    // ARCH-ENG-001: layers depend DOWNWARD only. L2 (contracts, catalogue) may not reach into
    // `lib/coaching/` or `lib/plan/`, which is precisely why `TRIGGER_TYPES` moved out of
    // `planAdjustment.ts` instead of being imported from it.
    const offenders: string[] = []
    for (const f of ['lib/engine/contracts/triggers.ts', 'lib/engine/catalogue/triggers.ts']) {
      const src = readFileSync(join(process.cwd(), f), 'utf8')
      for (const m of Array.from(src.matchAll(/^\s*import[^;]*?from\s+'([^']+)'/gm))) {
        if (/^(@\/)?lib\/(coaching|plan)\//.test(m[1])) offenders.push(`${f} → ${m[1]}`)
      }
    }
    expect(offenders, 'L2 must not import L3+ (ARCH-ENG-001)').toEqual([])
    // The population must be non-empty or the loop proves nothing: both files do import something.
    expect(readFileSync(join(process.cwd(), 'lib/engine/catalogue/triggers.ts'), 'utf8'))
      .toMatch(/^import/m)
  })
})

describe('ADR-027 step 4b — triggersFor', () => {
  it('returns [] for an event no trigger listens to', () => {
    expect(triggersFor('run_arrived' as RunEventName)).toEqual([])
  })
})
