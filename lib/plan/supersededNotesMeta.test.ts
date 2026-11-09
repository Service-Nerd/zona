import { describe, it, expect } from 'vitest'
import { currentMetaNote } from './supersededNotes'
import { planRationaleNotes } from './planRationale'
import type { Plan } from '@/types/plan'

/**
 * 🔴 EMDASH-LIB-COPY-01, THE HALF CODE REVIEW CAUGHT (2026-11-09).
 *
 * The engine was repunctuated and `noEmDashApp.test.ts` went green — while **12 of 41 stored
 * plans kept their em dash**, because a `meta.*_note` is stamped into `plan_json` at
 * generation. `currentNote` repairs STEP notes and has exactly one caller
 * (`sessionSteps.ts:422`), so it could never reach these.
 *
 * ⚠️ This is the third time this module's own header records the class: *"when a fix lands in
 * the engine, ask what an existing plan will do."* A FIX TO THE ENGINE REACHES NO EXISTING PLAN.
 */
const STORED = {
  hard_pref:  'You said you like hard sessions. The plan earns longer peak runs and more intensity as your training history deepens — not before your legs have proven they will take it.',
  difficulty: 'Very demanding on 15 weeks — below the 16-week mark for this race. It can be run; the timeline is the constraint, not your effort.',
  level:      "Your current volume reads like a beginner's, but your training history says you're not one — you're a runner coming back, not starting out.",
  returning:  'Fresh-from-layoff start: week 1 begins at 70% of your stated current weekly volume (14 km vs 20 km stated). Returning to running needs caution, not faster ramp — the engine prefers a small base to rebuild from.',
}

describe('currentMetaNote — the read-time repair for stored meta notes', () => {
  it('🔴 repairs all four superseded sentences, and leaves no em dash behind', () => {
    for (const [k, v] of Object.entries(STORED)) {
      const out = currentMetaNote(v)
      expect(out, `${k} still carries an em dash`).not.toContain('—')
      // 🔑 THE WORDS MUST NOT CHANGE — the founder's rule is punctuation only, and this arm is
      // what makes "no word changes" checkable rather than asserted. Strip the SAME mark set
      // from both sides and collapse whitespace: `" — "` becomes `", "`, one space fewer.
      const words = (x: string) => x.replace(/[—:;,]/g, ' ').replace(/\s+/g, ' ').trim()
      expect(words(out), `${k}: a WORD changed, not just punctuation`).toBe(words(v))
    }
  })

  it('a note with no superseded phrase is returned byte-identical', () => {
    const clean = 'Your easy runs are capped at the top of Zone 2. Hold the zone.'
    expect(currentMetaNote(clean)).toBe(clean)
  })

  it('an EN dash in a range survives — it is correct punctuation', () => {
    const range = 'Target 6:30–7:30 /km on the long run.'
    expect(currentMetaNote(range)).toBe(range)
  })

  it('🔴 and the repair is reached through planRationaleNotes, not only exported', () => {
    // The composition, not the halves: a repair nothing calls is the defect it fixes.
    const meta = { hard_pref_note: STORED.hard_pref } as unknown as Plan['meta']
    const notes = planRationaleNotes(meta, 'km')
    const hard = notes.find(n => n.label === 'Hard sessions')
    expect(hard, 'the note must render at all').toBeTruthy()
    expect(hard!.text).not.toContain('—')
    expect(hard!.text).toContain('deepens, not before')
  })
})
