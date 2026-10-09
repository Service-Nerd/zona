import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { alignDerivedToStructure, recoverStepAnchors } from './derivedSetAnchors'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { PACE_ANCHORS } from './sessionStructureV2'
import { PINNED_PLAN_START_0907 } from './__fixtures__/pinnedPlanStart'
import type { GeneratorInput, Plan, Session } from '@/types/plan'
import type { SessionCatalogueRow } from './sessionCatalogueData'

/**
 * RECAL-PACE-TWO-WRITER-01 Stage 0 — THE PRECONDITION, PINNED BEFORE IT IS USED.
 *
 * Stage 2 re-prices a recalibrated session by walking its stored derived steps
 * alongside the catalogue structure that produced them, to recover each step's
 * ANCHOR (a resolved step keeps only its outcome). The walk is sound only while
 * the resolver preserves shape 1:1 — one derived block per structural block,
 * one derived step per structural step.
 *
 * ⚠️ THAT IS AN ASSUMPTION ABOUT CODE THIS FILE DOES NOT OWN. `resolveMainSet`
 * is free to expand a block tomorrow, and if it does, the walk starts pairing a
 * step with the wrong anchor and re-prices it to the wrong band — silently,
 * because every pairing still produces a plausible pace string. So this is a
 * gate and not a comment: a catalogue row or resolver change that breaks the
 * alignment fails the build here, where the assumption is stated, rather than
 * in a runner's plan.
 */

const base = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_date: '2027-03-21', race_distance_km: 21.1, goal: 'finish',
  benchmark: { type: 'race', distance_km: 5, time: '0:22:00' },
  current_weekly_km: 40, longest_recent_run_km: 14, days_available: 4, age: 35,
  preferred_long_run_day: 'sun', training_age: '2-5yr',
  user_declared_level: 'intermediate', recent_quality_training: 'regular',
  terrain: 'road', injury_history: [], hard_session_relationship: 'neutral',
  ...o,
} as GeneratorInput)

/**
 * ⚠️ THE POPULATION IS DERIVED, NEVER TYPED OUT. A hand-written list of
 * sessions is a list of the cases somebody thought of, and this repo has
 * shipped four checks whose population could not contain the defect they were
 * written for. These plans come from the real producer.
 */
const GRID: GeneratorInput[] = (() => {
  const out: GeneratorInput[] = []
  for (const [km, date] of [[5, '2027-01-10'], [10, '2027-02-14'], [21.1, '2027-03-21'], [42.2, '2027-06-06']] as const)
    for (const weekly of [20, 40, 70])
      for (const days of [3, 4, 5])
        out.push(base({
          race_distance_km: km, race_date: date, current_weekly_km: weekly,
          longest_recent_run_km: Math.max(4, Math.round(weekly * 0.35)),
          days_available: days,
        }))
  return out
})()

const qualitySessions = (): { session: Session; rowId: string }[] => {
  const out: { session: Session; rowId: string }[] = []
  for (const input of GRID) {
    let plan: Plan
    try { plan = generateRulePlan(input, 'paid', PINNED_PLAN_START_0907) } catch { continue }
    for (const week of plan.weeks) {
      for (const session of Object.values(week.sessions)) {
        const s = session as Session & { derived_set?: unknown; catalogue_id?: string }
        if (!s || s.type !== 'quality' || !s.derived_set) continue
        out.push({ session: s, rowId: s.catalogue_id ?? '(unstamped)' })
      }
    }
  }
  return out
}

const POPULATION = qualitySessions()

describe('alignDerivedToStructure — the population', () => {
  // ⚠️ AN EMPTY POPULATION PASSES EVERY OTHER ARM IN THIS FILE. Measured when
  // written: 297 sessions over 12 distinct catalogue rows. The floors are
  // deliberately below the measurement and deliberately above zero — a grid
  // that stops generating, or a §44 gate that starts refusing it, fails HERE
  // with a count rather than silently reporting success on nothing.
  it('reaches enough real sessions, over enough distinct rows, to mean anything', () => {
    const rows = new Set(POPULATION.map(p => p.rowId))
    expect(POPULATION.length).toBeGreaterThanOrEqual(200)
    expect(rows.size).toBeGreaterThanOrEqual(6)
    expect(rows.has('(unstamped)')).toBe(false)
  })
})

describe('alignDerivedToStructure — the precondition', () => {
  it('every generated quality session aligns 1:1 with its catalogue structure', () => {
    const failed = POPULATION
      .filter(p => alignDerivedToStructure(p.session as never) == null)
      .map(p => p.rowId)
    expect(Array.from(new Set(failed))).toEqual([])
  })

  it('recovers a declared anchor for every pace-anchored step, and never invents one', () => {
    const declared = new Set<string>(PACE_ANCHORS)
    const recovered = new Set<string>()
    for (const p of POPULATION) {
      const anchors = recoverStepAnchors(p.session as never)
      expect(anchors).not.toBeNull()
      for (const a of anchors!) {
        if (a == null) continue              // effort-governed / zoned — §24b, legitimate
        expect(declared.has(a)).toBe(true)
        recovered.add(a)
      }
    }
    // Recovering nothing but nulls would satisfy the loop above and be useless.
    expect(recovered.size).toBeGreaterThanOrEqual(2)
  })
})

describe('alignDerivedToStructure — FALSIFICATION', () => {
  // ⚠️ ONE CAST, STATED ONCE. These arms build DELIBERATELY MALFORMED sessions,
  // which by construction cannot satisfy the owner's parameter type — so the
  // cast is the point of the test, not a convenience. `tsc` runs over this file
  // (vitest's esbuild does not typecheck), and scattering `as never` through
  // nine call sites is how a real type error hides among the intentional ones.
  type Loose = Parameters<typeof alignDerivedToStructure>[0]
  const align = (s: unknown, catalogue?: SessionCatalogueRow[]) =>
    catalogue ? alignDerivedToStructure(s as Loose, catalogue) : alignDerivedToStructure(s as Loose)
  const realRow = (): SessionCatalogueRow =>
    V1_SESSION_CATALOGUE.find(r => r.id === POPULATION[0].rowId)!
  const subject = () => POPULATION[0].session

  it('baseline — the subject aligns before anything is broken', () => {
    expect(align(subject())).not.toBeNull()
  })

  it('refuses when the derived set has an EXTRA BLOCK', () => {
    const s = JSON.parse(JSON.stringify(subject()))
    s.derived_set.blocks.push({ repeat: 1, steps: [{ role: 'work', modality: 'run', length: '1 min', pace: '5:00 /km', advance: 'auto' }] })
    expect(align(s)).toBeNull()
  })

  it('refuses when a block has an EXTRA STEP', () => {
    const s = JSON.parse(JSON.stringify(subject()))
    s.derived_set.blocks[0].steps.push({ role: 'recovery', modality: 'jog', length: '1 min', pace: '7:00 /km', advance: 'auto' })
    expect(align(s)).toBeNull()
  })

  it('refuses when a block has a MISSING STEP', () => {
    const s = JSON.parse(JSON.stringify(subject()))
    s.derived_set.blocks[0].steps.pop()
    expect(align(s)).toBeNull()
  })

  // ⚠️ THE CATALOGUE IS THE THING THAT DISAGREES IN BOTH ARMS BELOW — the
  // session is untouched. That is the shape of a future row edit, and it is the
  // case no runner-side test can reach.
  //
  // ⚠️ THE *SHRINK* ARM IS THE ONE THAT EARNS ITS PLACE, AND THE GROW ARM IS
  // NOT ITS TWIN. Mutating the two count comparisons out of the owner left the
  // grow arm GREEN: with an extra structural block the walk runs off the end of
  // `derived.blocks`, and the `Array.isArray` guard catches it for an unrelated
  // reason. A shorter structure has no such accident — the walk pairs the blocks
  // it can and returns a PARTIAL alignment, which is exactly the silent
  // wrong-anchor outcome this module exists to prevent. Checked both ways.
  it('refuses when the CATALOGUE row grows a block the stored session cannot have', () => {
    const row = JSON.parse(JSON.stringify(realRow())) as SessionCatalogueRow
    const st = row.main_set_structure as { blocks: unknown[] }
    st.blocks.push({ repeat: 1, steps: [{ role: 'work', modality: 'run', length: { kind: 'duration', secs: 60 }, target: { kind: 'pace', anchor: 'T', mode: 'target' }, advance: 'auto' }] })
    expect(align(subject(), [row])).toBeNull()
    // and the UNMODIFIED row still aligns, so the arm above is not passing for
    // the trivial reason that a one-row catalogue never matches.
    expect(align(subject(), [realRow()])).not.toBeNull()
  })

  it('refuses when the CATALOGUE row SHEDS a block — the partial-walk case', () => {
    const row = JSON.parse(JSON.stringify(realRow())) as SessionCatalogueRow
    const st = row.main_set_structure as { blocks: unknown[] }
    if (st.blocks.length < 2) {
      // The chosen subject is single-block; shed a STEP instead, which is the
      // same hazard one level down. Stated rather than skipped, because a
      // conditional that quietly does nothing is not a test.
      const b0 = st.blocks[0] as { steps: unknown[] }
      expect(b0.steps.length).toBeGreaterThanOrEqual(1)
      b0.steps.pop()
    } else {
      st.blocks.pop()
    }
    expect(align(subject(), [row])).toBeNull()
    expect(align(subject(), [realRow()])).not.toBeNull()
  })

  it('refuses a session it cannot identify at all', () => {
    const s = JSON.parse(JSON.stringify(subject()))
    delete s.catalogue_id
    s.label = 'Not a catalogue session'
    expect(align(s)).toBeNull()
  })

  it('refuses a session with no derived set', () => {
    expect(align({ catalogue_id: POPULATION[0].rowId })).toBeNull()
    expect(align(null)).toBeNull()
    expect(align(undefined)).toBeNull()
  })
})
