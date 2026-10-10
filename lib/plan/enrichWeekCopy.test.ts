import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mergePlan, type WeekCopyRejection } from './enrich'
import { firstPlaceholder } from './renderGuidance'
import type { Plan } from '@/types/plan'

/**
 * WEEK-THEME-TOKEN-ENRICH-01 (2026-10-10) — **a rule stated only in a prompt is
 * a request.**
 *
 * `buildEnrichUserPrompt` says it in as many words: *"Week labels and themes do
 * NOT contain numerics — never put placeholders in them."* The model did it
 * anyway. 📐 Measured against production: **49 placeholders in `week.theme`
 * across 11 of 34 plans** — `{{session_zone}}` 37, `{{session_distance}}` 8
 * (both resolve to NOTHING at week level, because no session is in scope),
 * `{{zone2_ceiling}}` 4.
 *
 * 🔴 AND THE FIELD WITH *ZERO* TOKENS IS THE DANGEROUS ONE. `week.theme` has one
 * render and it goes through `renderPlanProse`, which strips an orphan — so the
 * failure is a GAP: *"Strides appear now on Wednesday and Sunday. Still all."*
 * **`week.label` renders RAW at four sites in `PlanCalendar` with no prose
 * owner**, so a token there puts a literal `{{session_zone}}` on the Plan
 * screen. Production carries 0 label tokens; that is luck, not a guarantee.
 *
 * Same family as the §78 time-trial branch in the same function, whose own
 * comment records the model writing **these two token names** into a live plan.
 */

const ENGINE_LABEL = 'Week 1'
const ENGINE_THEME = 'Settle in. Nothing clever this week.'

function planWithWeekCopy(): Plan {
  return {
    meta: {} as never,
    weeks: [{
      n: 1, phase: 'build', type: 'normal', label: ENGINE_LABEL, theme: ENGINE_THEME,
      sessions: { mon: { id: 'w1-mon', type: 'easy', label: 'Easy run', detail: null, coach_notes: [] } },
    }],
  } as unknown as Plan
}
const enrichedWeek = (over: Record<string, unknown>) => ({
  meta: {},
  weeks: [{ n: 1, label: ENGINE_LABEL, theme: ENGINE_THEME, sessions: {}, ...over }],
}) as never

/** Merge, collecting what the sink was told. */
function merge(over: Record<string, unknown>): { plan: Plan; rejected: WeekCopyRejection[] } {
  const rejected: WeekCopyRejection[] = []
  const plan = mergePlan(planWithWeekCopy(), enrichedWeek(over), 'paid', r => rejected.push(r))
  return { plan, rejected }
}

describe('WEEK-THEME-TOKEN-ENRICH-01 — the merge refuses week copy carrying a placeholder', () => {
  it('voice WITHOUT a placeholder is accepted, so this is a guard and not a wall', () => {
    // The vacuity arm. Without it, "reject everything" passes every arm below.
    const { plan, rejected } = merge({ label: 'Base 1', theme: 'HR discipline this week. Slower than feels right.' })
    expect(plan.weeks[0].label).toBe('Base 1')
    expect(plan.weeks[0].theme).toBe('HR discipline this week. Slower than feels right.')
    expect(rejected).toEqual([])
  })

  it('🔴 a THEME carrying a session placeholder is refused and the engine copy kept', () => {
    const { plan, rejected } = merge({ theme: 'Strides appear now. Still {{session_zone}}. These wake the legs.' })
    expect(plan.weeks[0].theme, 'the engine sentence survives').toBe(ENGINE_THEME)
    expect(rejected).toEqual([{ weekN: 1, field: 'theme', token: '{{session_zone}}' }])
  })

  it('🔴 a LABEL carrying one is refused too — the raw-render field, 0 live tokens', () => {
    const { plan, rejected } = merge({ label: 'Week {{session_distance}}' })
    expect(plan.weeks[0].label).toBe(ENGINE_LABEL)
    expect(rejected.map(r => r.field)).toEqual(['label'])
  })

  it('a PLAN-level placeholder is refused as well, and that is the decision', () => {
    // `{{zone2_ceiling}}` resolves correctly at week level (4 live instances), so
    // allowing it was a real option. It was REJECTED: that is choosing new intent
    // rather than restoring the prompt's, and it leaves a token in a field whose
    // only safe render is one call site — `COACH-INTRO-TOKEN-01`'s exact defect.
    // A week label and a week theme must be complete as written.
    const { plan, rejected } = merge({ theme: 'Easy under {{zone2_ceiling}} bpm.' })
    expect(plan.weeks[0].theme).toBe(ENGINE_THEME)
    expect(rejected[0].token).toBe('{{zone2_ceiling}}')
  })

  it('one field failing does not cost the other its voice', () => {
    const { plan, rejected } = merge({ label: 'Peak 2', theme: 'Hold {{session_zone}}.' })
    expect(plan.weeks[0].label, 'a clean label still lands').toBe('Peak 2')
    expect(plan.weeks[0].theme).toBe(ENGINE_THEME)
    expect(rejected).toHaveLength(1)
  })

  it('⚠️ a MALFORMED brace is refused — the mutation that stayed green last night', () => {
    // `TOKEN_RE` alone only matches a well-formed `{{word}}`. Removing `ORPHAN_RE`
    // left 16 arms green because every brace under test was well-formed, so the
    // boundary predicate must be the broader of the two.
    for (const bad of ['Hold {{session pace}} today.', 'Hold {{unclosed', 'Hold {{}} today.']) {
      const { plan, rejected } = merge({ theme: bad })
      expect(plan.weeks[0].theme, bad).toBe(ENGINE_THEME)
      expect(rejected, bad).toHaveLength(1)
    }
  })

  it('the sink is OPTIONAL, because `mergePlan` is pure and must stay pure', () => {
    // Its own header says "pure function of its inputs (no I/O)", which is why
    // `recordOpsEvent` is in `enrich()` and not here. Omitting the sink must not
    // throw, or every existing caller breaks.
    const plan = mergePlan(planWithWeekCopy(), enrichedWeek({ theme: 'Hold {{session_zone}}.' }), 'paid')
    expect(plan.weeks[0].theme).toBe(ENGINE_THEME)
  })
})

describe('WEEK-THEME-TOKEN-ENRICH-01 — the predicate has ONE owner, and the attribution is wired', () => {
  it('the boundary predicate is at least as strict as the invariant it backs up', () => {
    // 🔴 THE DANGEROUS DIRECTION IS A TOKEN THE INVARIANT FLAGS AND THE MERGE LET
    // THROUGH. `invariants.ts` keeps its own `TOKEN_RE` for
    // INV-PLAN-NO-PLACEHOLDER-COPY and is deliberately NOT rewired in this
    // commit — that would change a LIVE `warn` invariant's fire rate without a
    // measurement. This arm is the bridge, so the two cannot drift apart in the
    // direction that matters.
    const src = readFileSync(join(__dirname, 'invariants.ts'), 'utf8')
    const m = src.match(/const TOKEN_RE = (\/[^\n]*\/)/)
    expect(m, "the invariant's TOKEN_RE moved — re-check this bridge").not.toBeNull()
    const invariantRe = new RegExp(m![1].slice(1, -1))
    for (const s of ['a {{session_zone}} b', '{{zone2_ceiling}}', 'x {{ spaced }} y', '{{}}']) {
      if (invariantRe.test(s)) {
        expect(firstPlaceholder(s), `invariant flags ${JSON.stringify(s)}, merge must too`).not.toBeNull()
      }
    }
  })

  it('a rejection is ATTRIBUTED, not swallowed (ADR-006 / ENRICH-ATTRIB-01)', () => {
    const enrichSrc = readFileSync(join(__dirname, 'enrich.ts'), 'utf8')
    expect(enrichSrc).toMatch(/recordOpsEvent\(\s*'plan_enrich_week_copy_rejected'/)
    // And the kind exists in the closed vocabulary, or the call would not compile
    // — asserted anyway so deleting it is a red test and not a silent no-op.
    const opsSrc = readFileSync(join(__dirname, '..', 'ops', 'recordOpsEvent.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
    expect(opsSrc, 'the kind must be a UNION MEMBER, not a mention')
      .toMatch(/^\s*\|\s*'plan_enrich_week_copy_rejected'\s*$/m)
  })

  it("🔴 and the new kind HAS A READER — an ops kind with none is the inert-field class", () => {
    // `run_walk_strategy` had a writer, no reader, and a green invariant that
    // could not see a screen. Counted and reported, never alerting.
    // ⚠️ COMMENTS STRIPPED, AND ANCHORED. `hollowTestShapes.test.ts` caught the
    // first version of this arm: a bare `toContain` of an identifier against
    // source text also passes against `...rejectedX`, and would pass against the
    // name appearing only in a comment — which is the whole reason the route's
    // own explanatory block mentions it twice.
    const routeSrc = readFileSync(join(__dirname, '..', '..', 'app', 'api', 'ops', 'enrich-health', 'route.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
    expect(routeSrc, 'the route must QUERY the kind, not merely mention it')
      .toMatch(/\.eq\(\s*'kind'\s*,\s*'plan_enrich_week_copy_rejected'\s*\)/)
    expect(routeSrc).toMatch(/\bweekCopyRejected30d\b/)
    expect(routeSrc, 'a rejection is the guard working and must not move `healthy`')
      .toMatch(/healthy: !verdict\.alert/)
  })
})
