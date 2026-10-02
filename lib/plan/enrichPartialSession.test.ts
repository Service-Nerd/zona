// ENRICH-PARTIAL-02 — one bad coach note costs ONE SESSION, not a whole week.
//
// 🔴 WHAT THIS NARROWS, AND WHY IT IS NOT A RELAXATION. `ENRICH-PARTIAL-01` reverts
// an offending WEEK; its own comment says *"only containing the blast radius does"*.
// Measured on live traffic 2026-10-02: a single mis-named zone in ONE coach note
// cost a runner week 20's copy entirely, and another lost weeks 10, 12-16 and 18 —
// five sessions each, four of which were fine.
//
// ⚠️ THE CAUSES ARE MODEL ERRORS, NOT FALSE POSITIVES. The enrich prompt carries
// "NEVER NAME A ZONE OTHER THAN THE SESSION'S OWN" (ENRICH-ZONE-01) and "never add
// a stride note to a session that has NO strides field". So no check is loosened
// here; only the amount of copy one instructed-rule breach destroys.
//
// 🔴 AND THE PROVENANCE ARM IS THE POINT OF THE WHOLE FILE. AI-PROVENANCE-01 was
// measured at 12,972 of 31,517 sessions wrongly carrying Kit's byline, and the rule
// it set is asymmetric: crediting a model for engine copy is a FALSE CLAIM, failing
// to credit it is modesty. A session reverted inside an enriched week is exactly the
// case a week-level flag cannot express, so a session-level revert WITHOUT the
// session flag would re-create that defect on a narrower, less visible population.
import { describe, it, expect } from 'vitest'
import {
  attributableSessions, revertSessionsToRuleCopy, sessionKey,
} from './enrichPartialRevert'
import { sessionNotesAreAiAuthored } from './notesProvenance'
import { SessionSchema } from './schema'
import type { Plan } from '@/types/plan'
import type { Violation as InvViolation } from './invariants'

const sn = (label: string, notes: string[]) => ({
  type: 'easy' as const, label, coach_notes: notes,
  distance_km: 8, duration_mins: 48, zone: 'Zone 2', primary_metric: 'distance' as const,
})

const rule = {
  weeks: [{
    n: 4, phase: 'build', type: 'normal', weekly_km: 30, label: 'Build', theme: 'engine words',
    sessions: { tue: sn('Easy run — Zone 2', ['Engine note tue.']), thu: sn('Easy run — Zone 2', ['Engine note thu.']) },
  }],
  meta: { enrichment: 'applied_partial' },
} as unknown as Plan

const enriched = {
  weeks: [{
    n: 4, phase: 'build', type: 'normal', weekly_km: 30, label: 'Build — settling in', theme: 'Kit week words',
    sessions: { tue: sn('Easy — nothing to prove', ['Kit note tue.']), thu: sn('Easy — float it', ['Kit note thu.']) },
  }],
  meta: { enrichment: 'applied_partial' },
} as unknown as Plan

const v = (week: number, day?: string): InvViolation => ({
  code: 'INV-PLAN-DISPLAY-ZONE-MATCHES-WORK', principle_ref: '§84', severity: 'error',
  week, day, message: 'm', actual: 'a', expected: 'e',
})

describe('ENRICH-PARTIAL-02', () => {
  it('1. attributes a violation carrying week AND day to one session', () => {
    const { sessions, allAttributable } = attributableSessions([v(4, 'tue')], enriched)
    expect(allAttributable).toBe(true)
    expect(Array.from(sessions)).toEqual([sessionKey(4, 'tue')])
  })

  it('2. refuses to attribute a WEEK-level violation — the caller must fall back', () => {
    // No day. Guessing a session here would revert the wrong copy and look like a fix.
    expect(attributableSessions([v(4)], enriched).allAttributable).toBe(false)
    // A day the week does not contain is equally not attributable.
    expect(attributableSessions([v(4, 'sat')], enriched).allAttributable).toBe(false)
  })

  it('3. reverts ONLY the named session and leaves its siblings enriched', () => {
    const out = revertSessionsToRuleCopy(enriched, rule, new Set([sessionKey(4, 'tue')]))
    const w = out.weeks[0]!
    expect(w.sessions.tue!.coach_notes).toEqual(['Engine note tue.'])
    expect(w.sessions.tue!.label).toBe('Easy run — Zone 2')
    // 🔴 The sibling and the WEEK keep the model's words — the whole point.
    expect(w.sessions.thu!.coach_notes).toEqual(['Kit note thu.'])
    expect(w.label).toBe('Build — settling in')
    expect(w.theme).toBe('Kit week words')
    expect(w.enrichment_reverted, 'the week is still enriched and must not be marked').toBeFalsy()
  })

  it('4. 🔴 the reverted session is NOT credited to Kit, and its sibling still is', () => {
    const out = revertSessionsToRuleCopy(enriched, rule, new Set([sessionKey(4, 'tue')]))
    const w = out.weeks[0]!
    expect(sessionNotesAreAiAuthored(w.sessions.tue!, out.meta, w),
      'AI-PROVENANCE-01: this copy is the engine\'s and must not carry the AIMark').toBe(false)
    expect(sessionNotesAreAiAuthored(w.sessions.thu!, out.meta, w),
      'the sibling is still the model\'s — failing to credit it is a different defect').toBe(true)
  })

  it('5. 🔴 the flag survives the Zod schema — a field absent there is STRIPPED on save', () => {
    // Without this, provenance would be right in memory and wrong by the time a
    // screen asked, with nothing to show it had been dropped.
    const out = revertSessionsToRuleCopy(enriched, rule, new Set([sessionKey(4, 'tue')]))
    // `detail` is required by the schema and the fixtures above omit it (they are
    // shaped for the revert logic, not for persistence), so it is supplied here
    // rather than widened into every fixture.
    const parsed = SessionSchema.parse({ ...out.weeks[0]!.sessions.tue, detail: null })
    expect(parsed.enrichment_reverted, 'SessionSchema strips the provenance flag').toBe(true)

    // And the other direction: a session that was NOT reverted must not acquire it.
    const untouched = SessionSchema.parse({ ...out.weeks[0]!.sessions.thu, detail: null })
    expect(untouched.enrichment_reverted).toBeUndefined()
  })

  it('6. no keys is a no-op, and an unknown week is left alone', () => {
    expect(revertSessionsToRuleCopy(enriched, rule, new Set())).toBe(enriched)
    const out = revertSessionsToRuleCopy(enriched, rule, new Set([sessionKey(99, 'tue')]))
    expect(out.weeks[0]!.sessions.tue!.coach_notes).toEqual(['Kit note tue.'])
  })

  it('7. every numeric is untouched — the enricher cannot write one and nor can this', () => {
    const out = revertSessionsToRuleCopy(enriched, rule, new Set([sessionKey(4, 'tue')]))
    const s = out.weeks[0]!.sessions.tue!
    expect(s.distance_km).toBe(8)
    expect(s.duration_mins).toBe(48)
    expect(s.zone).toBe('Zone 2')
    expect(out.weeks[0]!.weekly_km).toBe(30)
  })
})
