import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { generateStrengthPlan, standaloneContext, withChosenDays, type StrengthPlan, type StrengthProfile } from '@/packages/strength'
import { runContextSig } from './runContext'
import { regenerateStored, storedPlanReach } from './planReach'
import { strengthProfileGrid } from './profileGrid'
import { parseStrengthProfile } from '@/packages/strength'

/**
 * 🔴 STRENGTH-ENGINE-REACH-01 — an engine fix must reach a stored strength plan. Before, `GET /api/strength/plan`
 * rebuilt only on a run-week change, and the one live plan kept the no-leg weeks fixed the day after it was built.
 */
const base: StrengthProfile = { focus: 'general', session_minutes: 45, sessions_per_week: 2, equipment: ['dumbbells', 'bench'], experience: 'some' }
const ctx = standaloneContext('2026-11-02')
// A Saturday long run makes Friday and Sunday illegal for heavy legs, so this plan carries the engine's newer stamps.
const longSat = { ...ctx, days: ctx.days.map(d => (d.day === 'sat' ? { ...d, role: 'long' as const } : d)) }
const profile = withChosenDays(base, ['fri', 'sun'])
const start = longSat.days[0].date
const today = generateStrengthPlan(profile, longSat, { startDate: start })
const stored = (plan: StrengthPlan) => ({ plan, sig: runContextSig(longSat) })
// jsonb hands objects back with its own key order; reversing every object's keys is the same document.
const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reorder(x)])) : v

describe('storedPlanReach', () => {
  it('a plan the engine would build today is left alone, whatever order jsonb returns its keys in', () => {
    expect(storedPlanReach(stored(reorder(today) as StrengthPlan), profile, longSat, start)).toBeNull()
  })
  it('🔴 a plan built by an older engine is rebuilt (here: before the legs-day stamp and the light leg work)', () => {
    const old = JSON.parse(JSON.stringify(today)) as StrengthPlan
    expect(old.legs_day_suggestion, 'the fixture must carry the newer stamp').toBeDefined()
    delete old.legs_day_suggestion
    expect(storedPlanReach(stored(old), profile, longSat, start)).toBe('engine_changed')
    for (const w of old.weeks) for (const s of w.sessions) for (const b of s.blocks) b.items = b.items.filter(i => !i.light)
    expect(storedPlanReach(stored(old), profile, longSat, start)).toBe('engine_changed')
  })
  it('🔴 never a rebuild loop: a just-saved plan reads back as current across the profile grid', () => {
    // The route saves the parsed profile and the plan built from it; if regeneration were not deterministic, or parsing
    // not idempotent, every read would rebuild and save.
    const grid = strengthProfileGrid().filter((_, i) => i % 7 === 0)
    expect(grid.length).toBeGreaterThan(20)
    for (const raw of grid) {
      const r = parseStrengthProfile(raw); if (!r.ok) continue
      const saved = generateStrengthPlan(r.profile, longSat, { startDate: start })
      const again = parseStrengthProfile(JSON.parse(JSON.stringify(r.profile)))
      expect(again.ok && storedPlanReach(stored(reorder(saved) as StrengthPlan), again.profile, longSat, start)).toBeNull()
    }
  })
  it('a changed run week is still its own reason', () => {
    expect(storedPlanReach({ plan: today, sig: 'other' }, profile, longSat, start)).toBe('run_week_changed')
  })
  it('a standalone plan is compared on its own start, so it does not rebuild every week as "next Monday" moves', () => {
    const solo = generateStrengthPlan(base, null, { standaloneStart: '2026-09-07' })
    expect(regenerateStored(base, null, solo.start_date).start_date).toBe('2026-09-07')
    expect(storedPlanReach({ plan: solo, sig: null }, base, null, solo.start_date)).toBeNull()
  })
  it('the route asks it, and records an engine rebuild', () => {
    const src = readFileSync('app/api/strength/plan/route.ts', 'utf8')
    expect(src).toContain('storedPlanReach({ plan, sig: data.run_context_sig }')
    expect(src).toContain("recordOpsEvent('strength_plan_engine_rebuilt'")
  })
})
