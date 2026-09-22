// AI-COMPLETION-COLUMN-01 — the type comes from the plan, and a failed read is
// never a confident zero.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { withSessionType } from './completionSessionType'
import type { Plan } from '@/types/plan'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
const PHASE = read('app/api/phase-summary/route.ts')
const RACE  = read('app/api/race-readiness/route.ts')

const plan = {
  weeks: [
    { n: 4, sessions: {
      mon: { type: 'easy', label: 'Easy run' },
      wed: { type: 'quality', label: 'Cruise intervals' },
      sun: { type: 'easy', label: 'Long run', role: 'long_run' },
    } },
  ],
} as unknown as Plan

describe('withSessionType — the join the missing column should always have been', () => {
  it('resolves through the single owner, so a long run reads as long', () => {
    // coachingSessionType is INV-CLASS's owner: a long run is typed `easy` by
    // the generator and must NOT read as easy here.
    const out = withSessionType([
      { week_n: 4, session_day: 'mon' },
      { week_n: 4, session_day: 'wed' },
      { week_n: 4, session_day: 'sun' },
    ], plan)
    expect(out.map(r => r.session_type)).toEqual(['easy', 'quality', 'long'])
  })

  it('🔴 an unresolvable session gets NULL, never a guess', () => {
    // A completion outlives the session it referred to when a reshape moves or
    // removes it. Inventing 'easy' there would put the same class of false
    // value back into the prompt by a different door.
    const out = withSessionType([
      { week_n: 4, session_day: 'fri' },   // no session that day
      { week_n: 99, session_day: 'mon' },  // week not in the plan
      { week_n: null, session_day: null },
    ], plan)
    expect(out.map(r => r.session_type)).toEqual([null, null, null])
  })

  it('survives a plan that is missing entirely', () => {
    expect(withSessionType([{ week_n: 4, session_day: 'mon' }], null)[0].session_type).toBeNull()
  })
})

describe('🔴 a failed completions read is UNKNOWN, not zero', () => {
  it('phase-summary nulls completionRate when the query failed', () => {
    // It was `completed / totalSessions` on an always-empty array — so the model
    // was told the runner completed 0% of the phase, as a NUMBER, and wrote them
    // a coaching note on that basis. A null is honest; a zero is a false
    // statement with a decimal point on it.
    expect(PHASE).toContain('const completionsFailed = !!completionsRes.error')
    const i = PHASE.indexOf('const completionRate =')
    expect(PHASE.slice(i, i + 160)).toMatch(/completionsFailed[\s\S]*\?\s*null/)
  })

  it('neither route names the column that never existed', () => {
    for (const [name, src] of [['phase-summary', PHASE], ['race-readiness', RACE]] as const) {
      expect(src, `${name} still selects session_type`).not.toMatch(/select\([^)]*session_type/)
      expect(src, `${name} must select session_day to do the join`).toMatch(/select\('week_n, session_day,/)
    }
  })

  it('race-readiness filters the TYPED rows, not the raw ones', () => {
    // Filtering the untyped array would compile, pass tsc, and match nothing —
    // which is exactly the state it was already in.
    const i = RACE.indexOf('recentEasyRpeSamples')
    expect(RACE.slice(i, i + 120)).toContain('typed')
  })
})
