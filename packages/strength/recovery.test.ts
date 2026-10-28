import { describe, it, expect } from 'vitest'
import { generateStrengthPlan } from './generate'
import { easeForRecovery } from './recovery'
import { recoveryEaseViolations } from './validate'
import { CATALOGUE_BY_ID, PATTERN_REGION } from './catalogue'
import type { Day, RunContext, RunRole, StrengthProfile, StrengthSession } from './types'

/**
 * 🔴 STRENGTH-RECOVERY-01 (S13, re-sat 2026-10-17) — an accepted recovery ease only subtracts.
 * The sweep eases EVERY generated session across the profile grid and asserts S-RECOVERY-SUBTRACT-ONLY
 * holds; the arms below pin the two cases the re-sitting was about.
 */
const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
function ctx(week: RunRole[], phases: RunContext['weeks'][number]['phase'][], injury_tags: RunContext['injury_tags'] = []): RunContext {
  const days = phases.flatMap((_, w) => week.map((role, k) => ({
    date: new Date(Date.UTC(2026, 10, 2 + w * 7 + k)).toISOString().slice(0, 10), day: DAYS[k], week_n: w + 1, role,
  })))
  return { version: 1, days, weeks: phases.map((phase, i) => ({ n: i + 1, phase })), race_date: null, injury_tags, masters: false }
}
const OPEN: RunRole[] = ['rest', 'easy', 'rest', 'easy', 'rest', 'easy', 'rest']
const PHASES = ['base', 'build', 'build', 'peak', 'deload', 'build', 'build', 'build', 'peak', 'taper'] as const
const region = (id: string) => PATTERN_REGION[CATALOGUE_BY_ID.get(id)!.pattern]
const pattern = (id: string) => CATALOGUE_BY_ID.get(id)!.pattern
const items = (s: StrengthSession, roles = ['main', 'accessory', 'core']) => s.blocks.filter(b => roles.includes(b.role)).flatMap(b => b.items)

function sessions(): StrengthSession[] {
  const out: StrengthSession[] = []
  for (const sessions_per_week of [1, 2, 3, 4] as const)
    for (const experience of ['new', 'some', 'regular'] as const)
      for (const focus of ['running', 'general'] as const)
        for (const equipment of [['bodyweight'], ['dumbbells', 'bench', 'bands', 'box'], ['barbell', 'rack', 'bench', 'dumbbells', 'machines']] as const)
          for (const injury of [[], ['achilles']] as const) {
            const p: StrengthProfile = { focus, session_minutes: 45, sessions_per_week, equipment: [...equipment], experience }
            out.push(...generateStrengthPlan(p, ctx(OPEN, [...PHASES], [...injury])).weeks.flatMap(w => w.sessions))
          }
  return out
}
const ALL = sessions()

describe('S-RECOVERY-SUBTRACT-ONLY across the grid', () => {
  it('every generated session, eased, only subtracts', () => {
    expect(ALL.length).toBeGreaterThan(1000)
    const bad = ALL.flatMap(s => recoveryEaseViolations(s, easeForRecovery(s)))
    expect(bad).toEqual([])
  })
  it('the grid reaches the cases the ruling names (heavy legs with calf work, plyometrics, lower + core)', () => {
    expect(ALL.some(s => s.heavy_legs && items(s).some(it => pattern(it.exercise_id) === 'calf'))).toBe(true)
    expect(ALL.some(s => s.blocks.some(b => b.role === 'plyo'))).toBe(true)
    expect(ALL.some(s => s.kind === 'lower_core' && s.heavy_legs)).toBe(true)
  })
})

describe('the two cases the re-sitting ruled', () => {
  it('heavy full body → upper + core + calf: lower lifts go, calf stays, nothing added', () => {
    const s = ALL.find(x => x.kind === 'full_body' && x.heavy_legs && items(x).some(it => region(it.exercise_id) === 'upper') && items(x).some(it => pattern(it.exercise_id) === 'calf'))!
    const e = easeForRecovery(s)
    const ids = items(e).map(it => it.exercise_id)
    expect(ids.some(id => region(id) === 'lower' && pattern(id) !== 'calf')).toBe(false)
    expect(ids.some(id => region(id) === 'upper')).toBe(true)
    expect(ids.some(id => pattern(id) === 'calf')).toBe(true)
  })
  it('🔴 heavy lower + core → core + calf, never an upper session built in its place', () => {
    const s = ALL.find(x => x.kind === 'lower_core' && x.heavy_legs)!
    const e = easeForRecovery(s)
    expect(items(e).some(it => region(it.exercise_id) === 'upper')).toBe(false)
    expect(items(e).length).toBeGreaterThan(0)
  })
  it('no plyometrics, stamped, never longer', () => {
    const s = ALL.find(x => x.blocks.some(b => b.role === 'plyo'))!
    const e = easeForRecovery(s)
    expect(e.blocks.some(b => b.role === 'plyo')).toBe(false)
    expect(e.eased_for).toBe('recovery')
    expect(e.estimated_minutes).toBeLessThanOrEqual(s.estimated_minutes)
  })
})

describe('the invariant can fail', () => {
  const s = ALL.find(x => x.kind === 'full_body' && x.heavy_legs)!
  const ok = easeForRecovery(s)
  it('an added exercise', () => {
    const held = new Set(s.blocks.flatMap(b => b.items.map(i => i.exercise_id)))
    const extra = Array.from(CATALOGUE_BY_ID.keys()).find(id => !held.has(id) && region(id) === 'upper')!
    const bad = { ...ok, blocks: [...ok.blocks, { role: 'main' as const, items: [{ exercise_id: extra, sets: 1, reps: 8, rir: 3, rest_s: 90, per_side: false }] }] }
    expect(recoveryEaseViolations(s, bad).some(v => v.detail === `added ${extra}`)).toBe(true)
  })
  it('🔴 calf work dropped to zero (Willy)', () => {
    const c = ALL.find(x => x.heavy_legs && items(x).some(it => pattern(it.exercise_id) === 'calf'))!
    const e = easeForRecovery(c)
    const noCalf = { ...e, blocks: e.blocks.map(b => ({ ...b, items: b.items.filter(it => pattern(it.exercise_id) !== 'calf') })) }
    expect(recoveryEaseViolations(c, noCalf).some(v => v.detail.startsWith('calf work dropped'))).toBe(true)
  })
  it('reps that rose on a kept exercise', () => {
    // The first kept item counted in reps, wherever it sits (a heavy day's mains are mostly lower, so gone).
    const target = ok.blocks.flatMap(b => b.items).find(it => it.reps != null)!
    expect(target).toBeDefined()
    const blocks = ok.blocks.map(b => ({ ...b, items: b.items.map(it => it === target ? { ...it, reps: it.reps! + 2 } : it) }))
    expect(recoveryEaseViolations(s, { ...ok, blocks }).some(v => v.detail === `${target.exercise_id} reps rose`)).toBe(true)
  })
  it('plyometrics kept', () => {
    const p = ALL.find(x => x.blocks.some(b => b.role === 'plyo'))!
    expect(recoveryEaseViolations(p, { ...p, eased_for: 'recovery' }).some(v => v.detail.startsWith('plyometric'))).toBe(true)
  })
  it('a set count that was not cut', () => {
    expect(recoveryEaseViolations(s, { ...s, eased_for: 'recovery' }).some(v => v.detail.includes('recovery dose'))).toBe(true)
  })
  it('a kept lower lift on a heavy day', () => {
    expect(recoveryEaseViolations(s, { ...s, eased_for: 'recovery' }).some(v => v.detail.startsWith('lower lift kept'))).toBe(true)
  })
})

describe('S10 Am.5 × S13 — an eased session leaves no half of a pair behind', () => {
  it('heavy-legs general full body: the lower mains go, and the upper main they were paired with is a single lift again', () => {
    const profile: StrengthProfile = { focus: 'general', session_minutes: 45, sessions_per_week: 2, equipment: ['dumbbells', 'bench', 'bands'], experience: 'regular' }
    const plan = generateStrengthPlan(profile, ctx(OPEN, [...PHASES]))
    const heavy = plan.weeks.flatMap(w => w.sessions).filter(s => s.heavy_legs && items(s, ['main']).some(i => i.superset))
    expect(heavy.length).toBeGreaterThan(0)
    for (const s of heavy) {
      const eased = easeForRecovery(s)
      const tags = items(eased, ['main', 'accessory', 'core']).map(i => i.superset).filter(Boolean)
      for (const t of Array.from(new Set(tags))) expect(tags.filter(x => x === t)).toHaveLength(2)
      expect(items(eased, ['main']).every(i => region(i.exercise_id) === 'upper')).toBe(true)
    }
  })
})

