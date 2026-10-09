import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderPlanProse, planProseContext, renderGuidance, guidanceContextFromSession } from './renderGuidance'
import { validatePlan } from './invariants'
import { generateRulePlan } from './ruleEngine'
import { PINNED_PLAN_START_1012 as PINNED } from './__fixtures__/pinnedPlanStart'
import type { GeneratorInput, Plan } from '@/types/plan'

// COACH-INTRO-TOKEN-01 (2026-10-09) — no unresolved `{{token}}` reaches a runner.
//
// ── THE DEFECT ───────────────────────────────────────────────────────────────
// `GeneratePlanScreen` rendered `meta.coach_intro` through `convertDistanceString`
// alone, so a token the enricher emitted reached the runner VERBATIM on the first
// screen after their plan was built.
//
// Measured across all 34 live plans, by field:
//   session.coach_notes  1,115 / 22 plans — REQUIRED by design, resolved by
//                        `renderGuidance`. Correct, and deliberately exempt.
//   week.theme              49 / 11 plans — no reachable render today, but
//                        `/api/post-race-reshape` can write an AI theme that
//                        `TodayScreen`'s maintenance line renders.
//   meta.coach_intro         1 /  1 plan  — RENDERED RAW. 🔴
//   meta.notes               1 /  1 plan  — no consumer at all.
//
// ⚠️ MY OWN TRIAGE SAID "1 runner-visible token" AND NAMED ONE FIELD. There are
// two plan-level fields carrying one; `meta.notes` has no reader, so the count was
// right and the reasoning was not. Asserted rather than checked.

const UNITS = (s: string) => s   // identity converter — unit conversion is ADR-015's own tests

const mk = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 21.1, race_date: '2027-03-21', days_available: 4, goal: 'finish',
  current_weekly_km: 30, longest_recent_run_km: 12, age: 35, injury_history: [],
  recent_quality_training: 'regular', training_age: '2-5yr', terrain: 'road',
  hard_session_relationship: 'neutral', preferred_long_run_day: 'sun',
  days_cannot_train: [],
  ...over,
} as unknown as GeneratorInput)

describe('renderPlanProse — plan-level prose never emits a brace', () => {
  it('substitutes a plan-level token from the plan meta', () => {
    const out = renderPlanProse(
      'Keep easy runs under {{zone2_ceiling}} bpm.',
      planProseContext({ zone2_ceiling: 142 }), UNITS)
    expect(out).toBe('Keep easy runs under 142 bpm.')
  })

  // 🔴 THE DEFECT, PINNED. Before the fix this string reached the runner intact.
  it('strips an unresolvable token rather than printing it', () => {
    const out = renderPlanProse(
      'Keep easy runs under {{zone2_ceiling}} bpm.',
      planProseContext({}), UNITS)
    expect(out).not.toContain('{{')
    expect(out).not.toContain('zone2_ceiling')
  })

  // A SESSION token in plan prose has no correct value — there is no session in
  // scope where these strings render. It must vanish, not print.
  it('emits no brace for a session-scoped token either', () => {
    for (const t of ['{{session_pace}}', '{{ session_hr }}', '{{nonsense}}', '{{session_distance|12 km}}']) {
      const out = renderPlanProse(`Target: ${t}.`, planProseContext({ zone2_ceiling: 140 }), UNITS)
      expect(out, t).not.toMatch(/\{\{|\}\}/)
    }
  })

  // 🔴 THE ARM THAT WAS MISSING, FOUND BY MUTATION. Removing `ORPHAN_RE` from
  // `renderGuidance` left every other arm in this file GREEN — because the arm
  // above uses WELL-FORMED tokens, which `TOKEN_RE` substitutes on its own.
  // `ORPHAN_RE` exists for the braces TOKEN_RE *cannot* parse, and nothing
  // exercised it. `renderGuidance`'s own header calls that strip
  // "belt-and-braces against raw `{{...}}` ever reaching the user"; this is the
  // test of that sentence.
  it('strips a MALFORMED brace, which the token regex cannot parse', () => {
    for (const t of ['{{session pace}}', '{{zone2-ceiling}}', '{{unclosed', '{{}}', '{{ }}']) {
      const out = renderPlanProse(`Target: ${t} today.`, planProseContext({ zone2_ceiling: 140 }), UNITS)
      expect(out, t).not.toContain('{{')
      expect(out, t).not.toContain('}}')
    }
  })

  it('applies the unit converter AFTER substitution, not before', () => {
    // A token that resolves to a distance has to exist before it can be converted.
    const calls: string[] = []
    const out = renderPlanProse('Run {{session_distance}} km.',
      { session_distance: 12 }, t => { calls.push(t); return t.replace('12 km', '7 mi') })
    expect(calls[0]).toBe('Run 12 km.')      // the converter saw the RESOLVED string
    expect(out).toBe('Run 7 mi.')
  })

  it('a null or empty string yields empty, never the word undefined', () => {
    expect(renderPlanProse(null, planProseContext({}), UNITS)).toBe('')
    expect(renderPlanProse(undefined, planProseContext({}), UNITS)).toBe('')
    expect(renderPlanProse('', planProseContext({}), UNITS)).toBe('')
  })

  // ⚠️ THE SOURCE DECISION, ASSERTED. `planProseContext` takes the PLAN's meta so
  // no call site can substitute a device-derived ceiling that contradicts the
  // plan's own HR targets.
  it('reads the ceiling from meta, and tolerates a meta that has none', () => {
    expect(planProseContext({ zone2_ceiling: 150 }).zone2_ceiling).toBe(150)
    expect(planProseContext(null).zone2_ceiling).toBeUndefined()
    expect(planProseContext({}).zone2_ceiling).toBeUndefined()
  })

  // The exempt carrier still works, so the fix cannot have broken the 1,115.
  it('session coach notes still resolve through renderGuidance', () => {
    const out = renderGuidance('Hold under {{session_hr}}.', guidanceContextFromSession({
      session: { hr_target: '< 141 bpm' }, zone2Ceiling: 141,
    }))
    expect(out).toBe('Hold under < 141 bpm.')
  })
})

describe('INV-PLAN-NO-PLACEHOLDER-COPY — the vocabulary and the population', () => {
  const plan = () => generateRulePlan(mk(), 'paid', PINNED)
  const codes = (p: Plan) => validatePlan(p, mk()).filter(v => v.code === 'INV-PLAN-NO-PLACEHOLDER-COPY')

  it('a clean generated plan reports none — so the arms below are not noise', () => {
    expect(codes(plan()).map(v => v.message)).toEqual([])
  })

  // 🔴 THE POPULATION HOLE: no `meta.*` prose field was scanned at all, and that
  // is exactly where the only runner-visible token lived.
  it('catches a token in meta.coach_intro — the field it could not see', () => {
    const p = plan() as Plan
    ;(p.meta as unknown as Record<string, unknown>).coach_intro = 'Easy under {{zone2_ceiling}} bpm.'
    const v = codes(p)
    expect(v.length).toBe(1)
    expect(v[0].message).toContain('meta.coach_intro')
    expect(v[0].message).toContain('{{zone2_ceiling}}')
  })

  it('catches one in meta.plan_intro and meta.notes too', () => {
    for (const field of ['plan_intro', 'notes']) {
      const p = plan() as Plan
      ;(p.meta as unknown as Record<string, unknown>)[field] = 'See {{max_hr}}.'
      expect(codes(p).map(v => v.message).join(' '), field).toContain(`meta.${field}`)
    }
  })

  // 🔴 THE VOCABULARY HOLE: four hand-typed strings, none of them `{{`.
  it('catches one in week.theme — 49 live tokens sat here', () => {
    const p = plan() as Plan
    p.weeks[2].theme = 'Hold under {{zone2_ceiling}}.'
    expect(codes(p).map(v => v.message).join(' ')).toContain('.theme')
  })

  // ⚠️ THE EXEMPTION, ASSERTED IN BOTH DIRECTIONS. A token in `coach_notes` is
  // required by design; firing on it would flag 22 of 34 live plans for being
  // correct, which is how a guard gets switched off.
  it('does NOT fire on a token in session.coach_notes', () => {
    const p = plan() as Plan
    const wk = p.weeks.find(w => w.n > 0)!
    const day = Object.keys(wk.sessions)[0] as keyof typeof wk.sessions
    const sess = wk.sessions[day]!
    sess.coach_notes = ['Hold under {{session_hr}} today.']
    expect(codes(p).map(v => v.message)).toEqual([])
  })

  // …but the ORIGINAL string vocabulary must still reach coach_notes, or this
  // change would have narrowed an existing check while widening it elsewhere.
  it('still catches a STRING placeholder in session.coach_notes', () => {
    const p = plan() as Plan
    const wk = p.weeks.find(w => w.n > 0)!
    const day = Object.keys(wk.sessions)[0] as keyof typeof wk.sessions
    wk.sessions[day]!.coach_notes = ['Race day: Target Race.']
    expect(codes(p).map(v => v.message).join(' ')).toContain('Target Race')
  })

  it('stays a WARN — the audit filters on error, so this reports without alerting', () => {
    const p = plan() as Plan
    ;(p.meta as unknown as Record<string, unknown>).coach_intro = '{{zone2_ceiling}}'
    expect(codes(p).every(v => v.severity === 'warn')).toBe(true)
  })
})

describe('every plan-prose render site goes through the owner', () => {
  // A call-site gate. The owner cannot help a surface that does not call it, and
  // this is the class where a FOURTH surface appears later and nobody notices.
  const SITES: Array<[string, string]> = [
    ['app/dashboard/GeneratePlanScreen.tsx', 'meta.coach_intro'],
    ['app/dashboard/GeneratePlanScreen.tsx', 'meta.plan_intro'],
    ['app/dashboard/DashboardClient.tsx',    'plan.meta.plan_intro'],
    ['components/dashboard/TodayScreen.tsx', 'maintThemeLine'],
  ]
  const src = (f: string) => readFileSync(join(__dirname, '..', '..', f), 'utf8')
  /** ⚠️ COMMENTS STRIPPED. The population arm below first flagged
   *  `PlanIntroCard.tsx`, which names `plan_intro` only in its DOC COMMENTS and
   *  renders nothing itself — it takes already-rendered text as a prop. That is the
   *  "an arm matching its own comment" class, and it is the THIRD instance today.
   *  A check that cannot tell prose from code is not a check. */
  const code = (f: string) => src(f)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')

  it('each known site renders through renderPlanProse, never convertDistanceString alone', () => {
    const bad: string[] = []
    for (const [file, expr] of SITES) {
      const s = src(file)
      // The old shape: the expression handed straight to the unit converter.
      const naked = new RegExp(`convertDistanceString\\(\\s*${expr.replace(/[.]/g, '\\.')}\\s*,`)
      if (naked.test(s)) bad.push(`${file}: ${expr} still goes to convertDistanceString directly`)
      if (!s.includes('renderPlanProse')) bad.push(`${file}: does not import/use renderPlanProse`)
    }
    expect(bad, bad.join('\n')).toEqual([])
  })

  // The population arm: a NEW surface rendering one of these fields must be
  // declared above. Derived by grepping the two dashboard trees, not listed.
  it('no undeclared surface renders coach_intro / plan_intro', () => {
    const roots = ['app/dashboard/GeneratePlanScreen.tsx', 'app/dashboard/DashboardClient.tsx',
                   'components/dashboard/TodayScreen.tsx', 'components/shared/PlanIntroCard.tsx']
    const declared = new Set(SITES.map(([f]) => f))
    const offenders: string[] = []
    for (const f of roots) {
      if (!/coach_intro|plan_intro/.test(code(f))) continue
      // PlanIntroCard takes already-rendered text as a prop; it names neither field.
      if (!declared.has(f)) offenders.push(f)
    }
    expect(offenders, 'a surface renders plan prose and is not in SITES').toEqual([])
  })
})
