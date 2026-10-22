import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { generateRulePlan } from './ruleEngine'
import { cohortGrid, targetedGrid, COHORT_PLAN_START } from './cohortGrid'
import { composeSession } from './sessionComposer'
import { displayDerivedSet, runWalkSet, RUN_WALK_SHAPES } from './runWalkPlan'
import { parseLength, buildSessionRows } from './sessionSteps'
import { resolveDisplayFigures } from './sessionSteps'
import { GENERATION_CONFIG } from './generationConfig'
import { getSessionColor } from '@/lib/session-types'
import SessionSteps from '@/components/shared/SessionSteps'
import type { DerivedSet } from './resolveMainSet'

/**
 * 🔴 RUNWALK-STEPS-01 (§117 Am.6 + addendum, Coaching Board; §21b Am.4c, Design Board; wording by the founder,
 * 2026-10-22). A run-walk session walks a 5 min warm-up, then n × (Run / Walk) from the first rep, the remainder as one
 * final run outside the repeat, then the cool-down. The parts sum to the session; the steps sum to the main set.
 *
 * ⚠️ NOT a `validatePlan()` invariant: the steps are derived at READ time (like `backfillLegacyRamp`) so they reach
 * existing plans; a plan-level check would have to call this same producer. This cohort test is the guarantee.
 */
;(globalThis as { React?: unknown }).React = React
const RUN = GENERATION_CONFIG.FINISH_GOAL_RUNWALK_RUN_MINS, WALK = GENERATION_CONFIG.FINISH_GOAL_RUNWALK_WALK_MINS
const WU = GENERATION_CONFIG.RUNWALK_WARMUP_WALK_MINS
const mins = (len: string) => { const p = parseLength(len); return p.kind === 'duration' ? p.secs / 60 : NaN }

const sessions: any[] = []
for (const grid of [targetedGrid(), cohortGrid()]) {
  for (const input of grid as any[]) {
    if (sessions.length >= 400) break
    if (!(input.race_distance_km >= 42)) continue
    let p: any
    try { p = generateRulePlan(input, 'paid', COHORT_PLAN_START) } catch { continue }
    for (const w of p.weeks) for (const s of Object.values(w.sessions ?? {}) as any[]) if (s?.run_walk_strategy) sessions.push(s)
  }
}

describe('run-walk is drawn as steps', () => {
  it('the population is real (run-walk sessions were generated)', () => {
    expect(sessions.length).toBeGreaterThan(100)
  })

  it('🔴 every drawable run-walk session: walk warm-up, parts sum to the session, steps sum to the main set', () => {
    let drawn = 0
    for (const s of sessions) {
      const st = composeSession({ session: s, catalogueRow: null, goalPace: null } as never)
      if (!st || !RUN_WALK_SHAPES.has(st.shape)) continue
      drawn++
      expect(st.warmup.walk, s.label).toBe(true)
      expect(st.warmup.duration_mins).toBe(Math.min(WU, st.total_duration_mins - st.cooldown.duration_mins))
      expect(st.warmup.duration_mins + st.main.duration_mins + st.cooldown.duration_mins).toBe(st.total_duration_mins)
      const set = displayDerivedSet(s, st) as DerivedSet
      const total = set.blocks.reduce((a, b) => a + b.repeat * b.steps.reduce((x, y) => x + mins(y.length), 0), 0)
      expect(total, `${s.label} ${st.main.duration_mins}`).toBe(st.main.duration_mins)
      expect(set.blocks[0].steps[0].modality).toBe('run')
    }
    expect(drawn).toBeGreaterThan(100)
  })

  it('🔴 the block alternates run then walk, and the remainder is one run under 7 min OUTSIDE the repeat', () => {
    for (const m of [7, 23, 35, 40, 95, 204]) {
      const set = runWalkSet(m, '7:00 /km')!
      const [rep, rest] = set.blocks
      expect(rep.repeat).toBe(Math.floor(m / (RUN + WALK)))
      expect(rep.steps.map(x => x.modality)).toEqual(['run', 'walk'])
      const rem = m % (RUN + WALK)
      if (rem) { expect(rest.repeat).toBe(1); expect(rest.steps).toHaveLength(1); expect(mins(rest.steps[0].length)).toBe(rem) }
      else expect(rest).toBeUndefined()
    }
  })

  it('a session with no run-walk stamp is untouched', () => {
    const s = { ...sessions[0] }; delete s.run_walk_strategy
    const st = composeSession({ session: s, catalogueRow: null, goalPace: null } as never)!
    expect(st.warmup.walk).toBeUndefined()
    expect(displayDerivedSet(s, st)).toBeNull()
  })

  it('🔴 the rows: walk says the founder\'s words, glyphs on run/walk only, "then" before the remainder', () => {
    const s = sessions.find(x => { const st = composeSession({ session: x, catalogueRow: null, goalPace: null } as never); return st && RUN_WALK_SHAPES.has(st.shape) && st.main.duration_mins % (RUN + WALK) !== 0 })
    const st = composeSession({ session: s, catalogueRow: null, goalPace: null } as never)!
    const figures = resolveDisplayFigures(st, { metric: 'duration', units: 'km', sessionDistanceKm: null })
    const rows = buildSessionRows(st, displayDerivedSet(s, st), { metric: 'duration', units: 'km', formatDist: () => '', figures, raceSegmentTarget: '', raceSegmentSecondary: '' } as never)
    const walks = rows.filter(r => r.row.role === 'Walk')
    expect(walks.length).toBeGreaterThanOrEqual(2)
    expect(walks.every(r => r.row.target === 'Brisk walk' && r.row.glyph === 'walk')).toBe(true)
    expect(walks.find(r => r.section === 'main')!.row.note).toBe('Take it even if you feel fine.')
    expect(rows.filter(r => r.section === 'main' && r.row.role === 'Run').every(r => r.row.glyph === 'run')).toBe(true)
    expect(rows.some(r => r.repeatLabel === 'then')).toBe(true)
    expect(rows.filter(r => r.section === 'cooldown').every(r => !r.row.glyph)).toBe(true)
  })

  it('🔴 rendered: the glyphs and the "then" bar appear, and the main set takes the session hue', () => {
    const s = sessions.find(x => { const st = composeSession({ session: x, catalogueRow: null, goalPace: null } as never); return st && RUN_WALK_SHAPES.has(st.shape) && st.main.duration_mins % (RUN + WALK) !== 0 })
    const st = composeSession({ session: s, catalogueRow: null, goalPace: null } as never)!
    const html = renderToStaticMarkup(React.createElement(SessionSteps, {
      structure: st, derivedSet: displayDerivedSet(s, st) as DerivedSet, sessionType: s.type, displayZones: [2], zoneRangeLabel: 'Zone 2',
      metric: 'duration', preferredUnits: 'km', sessionDistanceKm: null, easyPaceStr: '7:00 /km', silhouetteColour: getSessionColor(s),
    }))
    expect(html).toContain('data-step-glyph="run"')
    expect(html).toContain('data-step-glyph="walk"')
    expect(html).toContain('data-then')
    expect(html).not.toContain('var(--s-quality)')
    // A walked warm-up carries no running pace in its header: only the cool-down shows the easy band.
    expect(html.split('7:00 /km').length - 1, 'easy band shown in headers').toBeLessThanOrEqual(1)
  })

})
