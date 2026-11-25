// ADR027-B3-VERIFIER — the post-race maintenance rules agree with validateMaintenanceBlock, finding for finding.
//
// A maintenance block is its own plan object (ADR-013), built by its own generator and judged by its own validator
// against three facts it recorded (`validateStoredPlan.ts`'s maintenanceErrors). The race harness never builds one, so
// this corpus is the generator run over a spread of runners, each wrapped as the stored plan the route writes.
import { describe, it, expect, beforeAll } from 'vitest'
import type { Plan, Session } from '@/types/plan'
import { generateMaintenanceBlock } from '@/lib/plan/maintenance'
import { validateMaintenanceBlock } from '@/lib/plan/invariants'
import { validateStoredPlan } from '@/lib/plan/validateStoredPlan'
import { goldenSample, GOLDEN_AS_OF } from '@/lib/corpus/goldenCorpus'
import { runEngine } from '@/lib/plan/engine'
import { vi, afterAll } from 'vitest'
import { buildRunnerProfile, factsFromInput } from '@/lib/engine/profile/buildRunnerProfile'
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
import { verifyPlan, MAINTENANCE_RULES } from './verifyPlan'

type W = Plan['weeks'][number]
const RACE_WEEK = { n: 12, date: '2026-07-07', label: 'Race week', theme: 'Race day.', type: 'race', phase: 'taper', weekly_km: 30, long_run_hrs: null, sessions: {} } as unknown as W
const RUNNERS = [10, 21.1, 42.2].flatMap(distKm => [18, 30, 45, 70].flatMap(baseKm => [2, 3, 4, 5].flatMap(days => [false, true].flatMap(injured =>
  (['rest', 'tick_over', 'stay_sharp'] as const).map(intent => ({ distKm, baseKm, days, injured, intent }))))))

const placed = (w: W) => Object.values(w.sessions ?? {}).filter((s): s is Session => !!s)
const p2 = (p: Plan) => p.weeks.filter(w => w.phase === 'maintenance_base')
const p1 = (p: Plan) => p.weeks.filter(w => w.phase === 'maintenance_restoration')

/** One breakage per arm; each returns whether it changed the plan. */
const BREAKS: [string, (p: Plan) => boolean][] = [
  ['a week with no rest day', p => {
    const w = p.weeks[0]; const s = placed(w).find(x => x.type !== 'rest'); if (!s) return false
    w.sessions = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => [d, { ...s }])) as W['sessions']; return true
  }],
  ['a quality session in a restoration week', p => { const s = p1(p).flatMap(placed).find(x => x.type === 'easy'); if (!s) return false; s.type = 'quality'; return true }],
  ['a phase 2 week one quality session over the cap', p => {
    const w = p2(p)[0]; if (!w) return false
    const easies = placed(w).filter(x => x.type === 'easy'), have = placed(w).filter(x => x.type === 'quality').length
    const need = GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK.PHASE2_QUALITY_PER_WEEK + 1 - have
    if (easies.length < need) return false
    easies.slice(0, need).forEach(x => { x.type = 'quality' }); return true
  }],
  ['a week just over the volume ceiling', p => {
    const base = p.meta.source_base_weekly_km!; p.weeks[0].weekly_km = Math.round((base * (GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK.VOLUME_CEILING_PCT_OF_BASE / 100) + 0.3) * 10) / 10; return true
  }],
  ['a week with one run day more than the source cadence', p => {
    const w = p.weeks.find(x => Object.values(x.sessions ?? {}).filter(s => s && s.type !== 'rest' && s.type !== 'cross-train').length === p.meta.source_run_days_per_week)
    const free = w && (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).find(d => !w.sessions[d] || w.sessions[d]!.type === 'rest')
    if (!w || !free) return false
    w.sessions[free] = { type: 'easy', label: 'Easy run', distance_km: 4 } as Session; return true
  }],
  ['strides for an injured runner', p => { if (!p.meta.source_injured) return false; const s = p.weeks.flatMap(placed).find(x => x.type === 'easy'); if (!s) return false; s.label = 'Easy run + strides'; return true }],
  ['a race-specific session', p => { const s = p.weeks.flatMap(placed).find(x => x.type !== 'rest'); if (!s) return false; (s as unknown as { category: string }).category = 'race_specific'; return true }],
  ['an unresolved token in a week label', p => { p.weeks[0].label = 'Week {{n}}'; return true }],
  ['a phase 2 week outside the window marked for re-engagement', p => { const w = p2(p)[0]; if (!w || w.reengagement) return false; w.reengagement = true; return true }],
  ['a window week left unmarked', p => { const w = p2(p)[p2(p).length - 1]; if (!w || !w.reengagement) return false; w.reengagement = false; return true }],
  ['a restoration week marked for re-engagement', p => { const w = p1(p)[0]; if (!w) return false; w.reengagement = true; return true }],
  ['a maintenance plan with no recorded base volume (not judged)', p => { delete p.meta.source_base_weekly_km; p.weeks[0].label = 'Week {{n}}'; return true }],
]

const ARMS: Record<string, string[]> = { 'INV-MAINT-REENGAGEMENT-WINDOW': ['an unmarked window week', 'a marked week outside the window', 'a marked restoration week'] }

const cases: { label: string; plan: Plan }[] = []
const INPUT = { race_distance_km: 42.2, race_date: '2026-07-12', goal: 'finish', current_weekly_km: 40, longest_recent_run_km: 20, days_available: 4, training_age: '2-5yr', age: 35, injury_history: [] } as never
const PROFILE = buildRunnerProfile(factsFromInput(INPUT), { asOf: '2026-07-13', timezone: null, planStart: '2026-07-13' })

beforeAll(() => {
  for (const r of RUNNERS) {
    let weeks: W[]
    try {
      weeks = generateMaintenanceBlock({
        raceResult: { finish_time: '3:45:00', distance_km: r.distKm, date: '2026-07-12', rpe: 7, outcome: 'on_target' } as never,
        lastRaceWeek: RACE_WEEK, baseWeeklyKm: r.baseKm, raceDistanceKm: r.distKm, daysAvailable: r.days, intent: r.intent,
        ...(r.injured ? { injuryHistory: ['Knee'] } : {}),
      })
    } catch { continue }
    const plan = { meta: { plan_kind: 'maintenance', source_base_weekly_km: r.baseKm, source_injured: r.injured, source_run_days_per_week: r.days }, weeks } as unknown as Plan
    const id = `${r.distKm}k/${r.baseKm}km/${r.days}d/${r.injured ? 'inj' : 'ok'}/${r.intent}`
    cases.push({ label: id, plan })
    for (const [name, f] of BREAKS) { const p = structuredClone(plan); if (f(p)) cases.push({ label: `${id} / ${name}`, plan: p }) }
  }
  // Code review: a stored maintenance plan carries the RACE plan's meta too (the route spreads it), so race rules must not
  // judge it. Wrap real race plans' meta around maintenance weeks, as the route does.
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(`${GOLDEN_AS_OF}T12:00:00`))
  for (const row of goldenSample({ perGroup: 2 })) {
    let race: Plan
    try { race = (runEngine({ input: row.input, tier: row.tier, displayUnits: 'km', planStart: row.planStart, today: row.asOf } as never) as { plan: Plan }).plan } catch { continue }
    if (!race?.weeks?.length) continue
    const base = row.input.current_weekly_km || 30
    let weeks: W[]
    try { weeks = generateMaintenanceBlock({ raceResult: { finish_time: '3:45:00', distance_km: row.input.race_distance_km, date: '2026-07-12', rpe: 7, outcome: 'on_target' } as never, lastRaceWeek: RACE_WEEK, baseWeeklyKm: base, raceDistanceKm: row.input.race_distance_km, daysAvailable: 4 }) } catch { continue }
    cases.push({ label: `race-meta ${row.id}`, plan: { ...race, meta: { ...race.meta, plan_kind: 'maintenance', source_base_weekly_km: base, source_injured: false, source_run_days_per_week: 4 }, weeks } as Plan })
  }
  vi.useRealTimers()
})
afterAll(() => { vi.useRealTimers() })

const key = (rule: string, week: number | null | undefined, day: string | null | undefined, sev: string) => `${rule}|${week ?? 0}|${day ?? '-'}|${sev}`
function oldFindings(p: Plan) {
  const m = p.meta
  if (!(typeof m.source_base_weekly_km === 'number' && m.source_base_weekly_km > 0)) return []
  return validateMaintenanceBlock(p.weeks, m.source_base_weekly_km, m.source_injured ?? false, m.source_run_days_per_week ?? null)
}

describe('ADR027-B3-VERIFIER — post-race maintenance plans', () => {
  it('the corpus holds maintenance blocks, and every breakage landed', () => {
    expect(cases.filter(c => !c.label.includes(' / ')).length).toBeGreaterThan(100)
    for (const [name] of BREAKS) expect(cases.some(c => c.label.endsWith(` / ${name}`)), name).toBe(true)
  })

  for (const rule of MAINTENANCE_RULES) {
    it(`🔴 ${rule}: same findings on every maintenance block and breakage, and it fires`, () => {
      const diffs: string[] = []
      let fired = 0
      for (const c of cases) {
        const old = oldFindings(c.plan).filter(v => v.code === rule).map(v => key(v.code, v.week, v.day, v.severity)).sort()
        const neu = verifyPlan(c.plan, { input: INPUT, profile: PROFILE }, 'saved').filter(f => f.rule_id === rule).map(f => key(f.rule_id, f.week, f.day, f.severity)).sort()
        fired += old.length
        if (JSON.stringify(old) !== JSON.stringify(neu)) diffs.push(`${c.label}: old [${old}] new [${neu}]`)
      }
      expect(diffs.slice(0, 5), `${diffs.length} disagreements`).toEqual([])
      expect(fired, 'nothing here wakes this rule').toBeGreaterThan(0)
    })
  }

  it('🔴 the WHOLE output agrees with what production runs on a stamped maintenance plan (no race rule leaks in)', () => {
    const stamped = cases.filter(c => typeof c.plan.meta.source_base_weekly_km === 'number' && c.plan.meta.source_base_weekly_km > 0)
    expect(stamped.some(c => c.label.startsWith('race-meta')), 'no maintenance plan carrying race meta').toBe(true)
    const diffs = stamped.flatMap(c => {
      const old = validateStoredPlan(c.plan).map(v => key(v.code, v.week, v.day, v.severity)).sort()
      const neu = verifyPlan(c.plan, { input: INPUT, profile: PROFILE }, 'saved').map(f => key(f.rule_id, f.week, f.day, f.severity)).sort()
      return JSON.stringify(old) === JSON.stringify(neu) ? [] : [`${c.label}: old [${old.slice(0, 4)}] new [${neu.slice(0, 4)}]`]
    })
    expect(diffs.slice(0, 5), `${diffs.length} disagreements`).toEqual([])
  })

  it('🔴 every arm of a multi-check rule fires on its own', () => {
    for (const [rule, prefixes] of Object.entries(ARMS)) for (const pre of prefixes) {
      const n = cases.reduce((t, c) => t + verifyPlan(c.plan, { input: INPUT, profile: PROFILE }, 'saved').filter(f => f.rule_id === rule && f.detail.startsWith(pre)).length, 0)
      expect(n, `${rule}: "${pre}" never fires`).toBeGreaterThan(0)
    }
  })
})
