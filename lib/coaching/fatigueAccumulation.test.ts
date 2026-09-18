import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { assessFatigueWindow, fatigueSignalOf } from './fatigueAccumulation'
import {
  FATIGUE_ACCUMULATION_THRESHOLD,
  FATIGUE_COUNTING_SKIP_REASONS,
  FATIGUE_WINDOW_REQUIRES_LOGGED_SESSION,
} from './constants'

// CoachingPrinciples §112 — the ENFORCEMENT ARTIFACT for this principle.
//
// ⚠️ A NAMED TEST, NOT AN INVARIANT, AND THE REASON IS STRUCTURAL.
// `validatePlan()` validates a generated PLAN OBJECT. This mechanism runs at
// coaching time against `session_completions` and never appears in a plan, so
// no `Plan => Violation[]` can reach it by construction — the same `static`
// class the invariant-liveness baseline already records for rules that read
// module constants rather than the plan. Recorded rather than left as a gap.

const logged = (tag: string) => ({ fatigue_tag: tag, skip_reason: null })
const skipped = (reason: string) => ({ fatigue_tag: null, skip_reason: reason })
const nothing = { fatigue_tag: null, skip_reason: null }

describe('§112 — what counts as a report of cost', () => {
  it('a high fatigue tag on a session the runner RAN', () => {
    expect(fatigueSignalOf(logged('Heavy'))).toEqual({ kind: 'logged', tag: 'Heavy' })
    expect(fatigueSignalOf(logged('Wrecked'))?.kind).toBe('logged')
  })

  it('a LEGACY "Cooked" still counts — historical rows must not fall out', () => {
    expect(fatigueSignalOf(logged('Cooked'))?.kind).toBe('logged')
  })

  it('a low fatigue tag is not a report of cost', () => {
    expect(fatigueSignalOf(logged('Fresh'))).toBeNull()
    expect(fatigueSignalOf(logged('Fine'))).toBeNull()
  })

  it('🔴 a "Too tired" SKIP counts — the change §112 made', () => {
    // Willy: not starting is not a weaker signal than starting and feeling
    // heavy, it is a stronger one. Before §112 the trigger could not see it.
    expect(fatigueSignalOf(skipped('Too tired'))).toEqual({ kind: 'skipped', reason: 'Too tired' })
  })

  it('life is not load — the other skip reasons do not count', () => {
    // 'Life got busy' / 'Bad weather' already propose a make-up slot;
    // 'Injury / illness' has §21. None of them are fatigue.
    for (const reason of ['Life got busy', 'Bad weather', 'Injury / illness']) {
      expect(fatigueSignalOf(skipped(reason)), reason).toBeNull()
    }
  })

  it('a bare "done" tap reports nothing (RESHAPE-FIX-WAVE2B-AUDIT)', () => {
    expect(fatigueSignalOf(nothing)).toBeNull()
    expect(fatigueSignalOf(null)).toBeNull()
  })
})

describe('§112 — when the window fires', () => {
  it('fires on three consecutive logged high-fatigue sessions', () => {
    const v = assessFatigueWindow([logged('Heavy'), logged('Heavy'), logged('Wrecked')])
    expect(v.fires).toBe(true)
    expect(v.consecutive).toBe(FATIGUE_ACCUMULATION_THRESHOLD)
  })

  it('🔴 fires on the real production sequence that used to be invisible', () => {
    // MEASURED: one runner logged Injury / illness -> Too tired -> Too tired ->
    // Too tired and the plan never softened. With a logged session in the
    // window it now fires.
    const v = assessFatigueWindow([logged('Heavy'), skipped('Too tired'), skipped('Too tired')])
    expect(v.fires).toBe(true)
    expect(v.skipped).toBe(2)
    expect(v.logged).toBe(1)
  })

  it('🔴 does NOT fire on skips alone — McMillan\'s dissent, enforced', () => {
    // "Too tired on a Tuesday is often a bad night's sleep, a late meeting, a
    // toddler." A skip may CONTRIBUTE to the window but may not fill it alone.
    expect(FATIGUE_WINDOW_REQUIRES_LOGGED_SESSION).toBe(true)
    const v = assessFatigueWindow([skipped('Too tired'), skipped('Too tired'), skipped('Too tired')])
    expect(v.fires).toBe(false)
    expect(v.consecutive).toBe(3)   // the window IS full…
    expect(v.logged).toBe(0)        // …but nothing was actually run
  })

  it('one break in the chain stops it — consecutiveness is the whole rule', () => {
    expect(assessFatigueWindow([logged('Heavy'), logged('Fine'), logged('Heavy')]).fires).toBe(false)
    expect(assessFatigueWindow([logged('Heavy'), nothing, logged('Heavy')]).fires).toBe(false)
  })

  it('reads the TRAILING window, not the whole history', () => {
    // Three Heavys followed by a recovery week must not keep firing.
    const v = assessFatigueWindow([
      logged('Heavy'), logged('Heavy'), logged('Heavy'), logged('Fresh'), logged('Fine'),
    ])
    expect(v.fires).toBe(false)
  })

  it('too few completions cannot fire it', () => {
    expect(assessFatigueWindow([logged('Heavy'), logged('Heavy')]).fires).toBe(false)
    expect(assessFatigueWindow([]).fires).toBe(false)
  })

  it('the threshold is read from config, not written into the logic', () => {
    const win = Array.from({ length: FATIGUE_ACCUMULATION_THRESHOLD }, () => logged('Heavy'))
    expect(assessFatigueWindow(win).fires).toBe(true)
    expect(assessFatigueWindow(win.slice(1)).fires).toBe(false)
  })
})

describe('§112 — the query must be able to SEE a skip', () => {
  // The rule is only as good as the window handed to it. The trigger was blind
  // for a different reason than the column: `.eq('status','complete')` meant a
  // skipped row was never fetched at all.
  const route = readFileSync(join(process.cwd(), 'app/api/adjust-plan/route.ts'), 'utf8')

  it('fetches skipped completions, not only complete ones', () => {
    expect(route, 'the fatigue window must include status=skipped or a skip can never count')
      .toMatch(/\.in\('status',\s*\['complete',\s*'skipped'\]\)/)
  })

  it('still excludes a bare "done" tap with no data at all', () => {
    // The stub protection was a `.not('fatigue_tag','is',null)`; widening the
    // query must not drop it.
    expect(route).toMatch(/\.or\('fatigue_tag\.not\.is\.null,skip_reason\.not\.is\.null'\)/)
  })

  it('selects the column the reason now lives in', () => {
    expect(route).toMatch(/select\('week_n, session_day, fatigue_tag, skip_reason, status'\)/)
  })

  it('the counting reasons are config, not a literal in the route', () => {
    expect(FATIGUE_COUNTING_SKIP_REASONS).toContain('Too tired')
    // Comments stripped: a comment EXPLAINING the rule is not a second copy of
    // it. Same treatment as signOutOwner.test.ts — a guard that fires on prose
    // gets switched off, which this repo records as equal to having no guard.
    const code = route.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')
    expect(code, 'the reason list belongs in constants.ts, not inline here').not.toMatch(/'Too tired'/)
  })
})
