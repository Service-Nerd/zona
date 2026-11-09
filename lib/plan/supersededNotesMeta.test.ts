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
}

/**
 * 🔴 SUPERSEDED BY A RULING, NOT BY PUNCTUATION (2026-11-09, `NOTE-SURFACE-INERT-01`).
 *
 * These are a DIFFERENT CLASS from the four above and are asserted differently. The Design
 * Board refused this copy under `ui-patterns.md` §18 rule 2 — *"consequence, then cause, then
 * the one lever. No thresholds, no ratios"* — so the repair changes WORDS, which the arm below
 * forbids for the punctuation family and must forbid, because silently rewriting stored copy is
 * how a runner's plan says something nobody approved.
 *
 * ⚠️ THE STRING IS WHAT PRODUCTION ACTUALLY STAMPED, read off the `plans` table. The previous
 * fixture for this note was hand-truncated — it stopped at *"rebuild from."* and dropped the
 * real final sentence — so a repair anchored on the real text mangled the fixture and the
 * fixture was what was wrong. **Fixtures must use the product's values.**
 */
const RULING_SUPERSEDED = {
  freshReturn: 'Fresh-from-layoff start: week 1 begins at 70% of your stated current weekly volume (14 km vs 20 km stated). Returning to running needs caution, not faster ramp \u2014 the engine prefers a small base to rebuild from. Volume grows at the standard 10% per week.',
  allowance: 'Returning-runner allowance active: weeks 1-3 grow at 15% per week (vs the standard 10%). Your training history allows a faster rebuild because the aerobic and structural base is still there.',
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

describe('currentMetaNote — copy superseded by a RULING, not by punctuation', () => {
  it('🔴 the refused prose never reaches a runner, and the repair is EXACT', () => {
    // The whole point: `returning_runner_note` started rendering on 2026-11-09 for the first
    // time. Without these entries the one stored carrier would have shown exactly the copy the
    // board refused — worse than the nothing it showed before.
    expect(currentMetaNote(RULING_SUPERSEDED.freshReturn))
      .toBe('Week 1 starts at 14 km rather than the 20 km you are running now, because you are coming back from a break. It climbs from there.')
    expect(currentMetaNote(RULING_SUPERSEDED.allowance))
      .toBe('Your first 3 weeks climb faster than they would for someone starting from scratch, because you have run before and that base is still there. After that it settles to the normal rate.')
  })

  it('🔴 and what the RULING forbids is gone from the output', () => {
    // Asserted as the rule, not as a string match on the replacement — so a future rewrite that
    // reintroduces a ratio fails here even if it is not the wording above.
    for (const [k, v] of Object.entries(RULING_SUPERSEDED)) {
      const out = currentMetaNote(v)
      expect(out, `${k}: a ratio reached the runner (§18 rule 2)`).not.toMatch(/\d+%/)
      expect(out, `${k}: engine register reached the runner`).not.toContain('allowance active')
      expect(out, `${k}: engine register reached the runner`).not.toContain('the engine prefers')
      expect(out, `${k}: an em dash survived`).not.toContain('\u2014')
      expect(out, `${k}: the stored copy was shown unrepaired`).not.toBe(v)
    }
  })

  it('⚠️ WORDS CHANGE HERE AND THAT IS THE DIFFERENCE — the punctuation arm must still refuse it', () => {
    // This is the guard on the guard. The four notes above may only be REPUNCTUATED; these two
    // are rewritten. If the two classes were ever merged, the punctuation arm would stop
    // meaning anything — so this arm proves they are genuinely different, by showing the
    // punctuation test FAILS on a ruling-superseded string.
    const words = (x: string) => x.replace(/[\u2014:;,]/g, ' ').replace(/\s+/g, ' ').trim()
    for (const v of Object.values(RULING_SUPERSEDED)) {
      expect(words(currentMetaNote(v)), 'a ruling repair that changes no words is not a ruling repair')
        .not.toBe(words(v))
    }
  })
})
