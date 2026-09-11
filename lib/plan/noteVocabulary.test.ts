import { describe, it, expect } from 'vitest'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { cohortGrid, COHORT_PLAN_START } from '@/lib/plan/cohortGrid'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * MAINT-LABEL-01 — the engine's notes speak the runner's language.
 *
 * Two regressions this locks, both found by reading what the engine actually
 * emitted rather than what the copy pass claimed to have fixed:
 *
 *   1. "Plan maintains current fitness rather than building it." The founder
 *      objected to that sentence; the first pass rewrote ONE variant and this
 *      family kept shipping it, to beginners, on 5K through marathon.
 *   2. DATABASE FIELD NAMES in a remedy a runner is meant to act on — "increase
 *      days_available from 4 to 5", "raise max_weekday_mins from 30 to 90".
 *      Same defect class as UX-BEGINNER-01, fixed in `inputs.ts` and missed here.
 *
 * Field names are derived from the `GeneratorInput` declaration, never listed,
 * so a NEW input joins this guard the day it ships. That is the same technique
 * the sweep's input-coverage gate uses, for the same reason: a hand-maintained
 * list is a list that goes stale.
 */

const GENERATOR_INPUT_FIELDS: string[] = (() => {
  const src = require('node:fs').readFileSync('types/plan.ts', 'utf8') as string
  const i = src.indexOf('interface GeneratorInput')
  const body = src.slice(i, src.indexOf('\n}', i))
  const names = new Set<string>()
  for (const m of Array.from(body.matchAll(/^\s{2}(\w+)\??\s*:/gm))) names.add(m[1]!)
  // Only the ones that would read as jargon — a single lowercase word like
  // "age" or "terrain" is exactly what a person should be told.
  return Array.from(names).filter(n => n.includes('_'))
})()

/** Every runner-facing string the engine stamps onto a plan. */
function runnerFacingNotes(plan: Plan): string[] {
  const meta = plan.meta as unknown as Record<string, unknown>
  const out: string[] = []
  for (const [k, v] of Object.entries(meta)) {
    if (typeof v === 'string' && /note|message|summary|rationale|why/i.test(k)) out.push(v)
  }
  return out
}

const PLANS: Plan[] = (() => {
  const out: Plan[] = []
  for (const input of cohortGrid()) {
    try {
      out.push(generateRulePlan(input as GeneratorInput, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START))
    } catch { /* refusals are the engine working */ }
  }
  return out
})()

describe('engine notes — the runner\'s language, not the schema\'s', () => {
  it('derived the field list from the type, and generated a real corpus', () => {
    expect(GENERATOR_INPUT_FIELDS.length).toBeGreaterThan(8)
    expect(GENERATOR_INPUT_FIELDS).toContain('days_available')
    expect(GENERATOR_INPUT_FIELDS).toContain('max_weekday_mins')
    expect(PLANS.length).toBeGreaterThan(500)
    expect(PLANS.flatMap(runnerFacingNotes).length).toBeGreaterThan(200)
  })

  it('no note names a database field', () => {
    const offenders: string[] = []
    for (const plan of PLANS) {
      for (const note of runnerFacingNotes(plan)) {
        for (const f of GENERATOR_INPUT_FIELDS) {
          if (note.includes(f)) offenders.push(`${f} — "${note.slice(0, 110)}…"`)
        }
      }
    }
    expect(Array.from(new Set(offenders)), [
      'A note is telling the runner to change a column name.',
      'Say what they would DO: "run 5 days a week instead of 4", not',
      '"increase days_available from 4 to 5".',
    ].join('\n')).toEqual([])
  })

  it('no note tells a runner their plan will not build them', () => {
    // The exact sentence the founder objected to, and its near neighbours.
    const BANNED = /maintains current fitness rather than building it|maintenance-grade|Plan generated as maintenance/i
    const offenders = new Set<string>()
    for (const plan of PLANS) {
      for (const note of runnerFacingNotes(plan)) {
        if (BANNED.test(note)) offenders.add(note.slice(0, 110))
      }
    }
    expect(Array.from(offenders)).toEqual([])
  })
})
