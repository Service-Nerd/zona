import { describe, it, expect } from 'vitest'
import { mergePlan } from './enrich'
import { FUELLING_PRACTICE_NOTE } from './fuellingNotes'
import type { Plan } from '@/types/plan'

/**
 * ENRICH-NOTE-FIDELITY-01 — **the enricher may add VOICE; it may not add or
 * remove PRESCRIPTION.**
 *
 * 📐 Measured on 33 `plan_enrich_failed` events since 2026-09-02, not inferred:
 *   · `INV-PLAN-STRIDES-PRESENT`            32 of 33 — a strides instruction INVENTED
 *   · `INV-PLAN-LONG-SESSION-FUELLING-NOTE` 20 of 33 — the fuelling note DELETED
 *
 * ⚠️ `preserveStrideNote` already enforced ONE half of the rule for ONE note.
 * `FUELLING_PRACTICE_NOTE` is engine-authored in exactly the same way
 * (`ruleEngine:7354`) and had no preservation at all — the eighth "remedy applied
 * to one twin" in this repo's record.
 */
const STRIDE = 'Add 6 × 20s strides at the end.'
const VOICE  = 'Keep it honest today.'

function planWith(notes: string[]): Plan {
  return {
    meta: {} as never,
    weeks: [{
      n: 1, phase: 'build', type: 'normal', label: 'W1', theme: 't',
      sessions: { mon: { id: 'w1-mon', type: 'easy', label: 'Easy run', detail: null, coach_notes: notes } },
    }],
  } as unknown as Plan
}
const enrichedWith = (notes: string[]) => ({
  meta: {},   // mergePlan reads `enriched.meta.notes` unconditionally
  weeks: [{ n: 1, label: 'W1', theme: 't', sessions: { mon: { coach_notes: notes } } }],
}) as never

const notesOf = (p: Plan) => (p.weeks[0]!.sessions as never as Record<string, { coach_notes?: string[] }>)
  .mon!.coach_notes ?? []

describe('ENRICH-NOTE-FIDELITY-01 — prescription survives the merge', () => {
  it('🔴 the fuelling note is restored when the enricher deletes it', () => {
    // 20 of 33. Before this, the note vanished, the invariant fired, and the
    // week reverted to rule copy — costing the runner that week's voice.
    const plan = planWith([VOICE, FUELLING_PRACTICE_NOTE])
    const out = mergePlan(plan, enrichedWith(['Long one today. Settle in.']), 'paid')
    expect(notesOf(out)).toContain(FUELLING_PRACTICE_NOTE)
    expect(notesOf(out), 'the enriched voice must survive too').toContain('Long one today. Settle in.')
  })

  it('🔴 an INVENTED strides instruction is removed where the engine placed none', () => {
    // 32 of 33. The engine placed strides on one run; the enricher's prose put a
    // second in front of the runner, breaching §28's "ONE easy run". As READ, the
    // plan prescribed strides twice — the invariant was right to fire.
    const plan = planWith([VOICE])                       // engine: no strides here
    const out = mergePlan(plan, enrichedWith(['Nice and easy.', 'Throw in some strides.']), 'paid')
    expect(notesOf(out).some(n => /strides/i.test(n)),
      'the enricher may not prescribe strides the engine did not place').toBe(false)
    expect(notesOf(out), 'the rest of the voice is kept').toContain('Nice and easy.')
  })

  it('🔴 a genuine engine stride line is still preserved (the original half)', () => {
    const plan = planWith([STRIDE])
    const out = mergePlan(plan, enrichedWith(['Easy does it.']), 'paid')
    expect(notesOf(out)).toContain(STRIDE)
  })

  it('⚠️ falls back to engine notes rather than leaving the card empty', () => {
    // If EVERY enriched note mentioned strides there is no voice left to keep.
    const plan = planWith([VOICE])
    const out = mergePlan(plan, enrichedWith(['Strides at the end.', 'More strides.']), 'paid')
    expect(notesOf(out).length, 'never hand the runner an empty card').toBeGreaterThan(0)
    expect(notesOf(out).some(n => /strides/i.test(n))).toBe(false)
  })

  it('⚠️ an untouched session is passed through unchanged', () => {
    const plan = planWith([VOICE])
    const out = mergePlan(plan, enrichedWith(['Just voice.']), 'paid')
    expect(notesOf(out)).toEqual(['Just voice.'])
  })
})
