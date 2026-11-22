// ADR027-B3-VERIFIER — the base-build and staged rules agree with the base-build validators, finding for finding.
//
// These rules' population is base-build plans, which the race harness (verifierAgreement.test.ts) never builds: there
// both checkers are silent on them, so agreement there proves nothing. Here the corpus is every get-running plan the
// golden rows produce when the runner accepts the base-build offer, plus the named rows that produce a walk-run start
// and a staged plan, and the old checker is what production runs on a base-build plan: validateBaseBuildBlock with the
// plan's own records, then validateStagedRace (`validateStoredPlan.ts`'s baseBuildErrors).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Plan, GeneratorInput, Session } from '@/types/plan'
import { goldenSample, GOLDEN_AS_OF } from '@/lib/corpus/goldenCorpus'
import { runEngine } from '@/lib/plan/engine'
import { validateBaseBuildBlock, validateStagedRace, volumeCappedRampOf } from '@/lib/plan/baseBuildValidate'
import { buildRunnerProfile, factsFromInput } from '@/lib/engine/profile/buildRunnerProfile'
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
import { sessionKmSelfPaced } from '@/lib/plan/sessionDistance'
import { verifyPlan, BASE_BUILD_RULES } from './verifyPlan'
import { validatePlan } from '@/lib/plan/invariants'

/** The 24-per-group rows that yield a walk-run start or a staged plan (none of the 8-per-group rows do). */
const EXTRA_ROWS = new Set([
  'w:free:5:set:2039667517701386258379', 'w:free:21.1:none:4721355949554803', 'w:paid:42.2:set:34074445589834923375269',
])

type Case = { label: string; plan: Plan; input: GeneratorInput; asOf: string; planStart: string }
type W = Plan['weeks'][number]
const ramp = (p: Plan) => p.weeks.filter(w => w.phase === 'base_build')
const dl = (w: W) => w.type === 'deload' || w.badge === 'deload'
const runsOf = (w: W) => Object.values(w.sessions ?? {}).filter((s): s is Session => !!s && s.type !== 'rest' && s.type !== 'cross-train')
const meta = (p: Plan) => p.meta as unknown as Record<string, unknown>

/** Breakages, each aimed at one arm. Each returns whether it changed the plan. */
const BREAKS: [string, (p: Plan) => boolean][] = [
  ['a quality session in the ramp', p => { const s = ramp(p).flatMap(runsOf)[0]; if (!s) return false; s.type = 'quality'; return true }],
  ['a build week level with the one before', p => {
    const b = ramp(p).filter(w => !dl(w)); if (b.length < 3) return false
    b[2].weekly_km = b[1].weekly_km; return true
  }],
  ['the ramp ends on a deload', p => { const r = ramp(p); if (!r.length) return false; r[r.length - 1].type = 'deload'; return true }],
  ['a capped ramp week just over the injury cap', p => {
    if (!volumeCappedRampOf(p)) return false
    const r = ramp(p), j = r.findIndex((w, k) => k > 0 && !dl(w) && !dl(r[k - 1]))
    if (j < 1) return false
    r[j].weekly_km = Math.round((r[j - 1].weekly_km * (1 + GENERATION_CONFIG.INJURY_WEEKLY_INCREASE_CAP_PCT / 100) + 0.3) * 10) / 10
    return true
  }],
  ['a capped ramp returning from a deload above where it left', p => {
    if (!volumeCappedRampOf(p)) return false
    const r = ramp(p), j = r.findIndex((w, k) => k >= 2 && !dl(w) && dl(r[k - 1]))
    if (j < 2) return false
    r[j].weekly_km = r[j - 2].weekly_km + 0.5; return true
  }],
  ['a capped ramp whose cycle does not gain', p => {
    if (!volumeCappedRampOf(p)) return false
    const r = ramp(p), pre = r.filter((w, k) => k + 1 < r.length && dl(r[k + 1]) && !dl(w))
    if (pre.length < 2) return false
    pre[1].weekly_km = pre[0].weekly_km; return true
  }],
  ['a build week whose longest run doubles', p => {
    const r = ramp(p), j = r.findIndex((w, k) => k > 0 && !dl(w) && !dl(r[k - 1]))
    if (j < 1) return false
    const prev = Math.max(0, ...runsOf(r[j - 1]).map(s => sessionKmSelfPaced(s) ?? 0)), s = runsOf(r[j])[0]
    if (!(prev > 0) || !s) return false
    s.distance_km = Math.round(prev * 2 * 10) / 10; delete s.duration_mins; return true
  }],
  ['a spaced ramp deload holding a longer run', p => {
    if (meta(p).onramp_spaced !== true) return false
    const r = ramp(p), j = r.findIndex((w, k) => k > 0 && dl(w) && !dl(r[k - 1]))
    if (j < 1) return false
    const prev = Math.max(0, ...runsOf(r[j - 1]).map(s => sessionKmSelfPaced(s) ?? 0)), s = runsOf(r[j])[0]
    if (!s) return false
    s.distance_km = Math.round((prev + 1) * 10) / 10; delete s.duration_mins; return true
  }],
  ['a spaced ramp week run on three days in a row', p => {
    if (meta(p).onramp_spaced !== true) return false
    const w = ramp(p).find(x => runsOf(x).length >= 2 && runsOf(x).length <= 3)
    if (!w) return false
    const runs = runsOf(w)
    w.sessions = {} as W['sessions']
    ;(['mon', 'tue', 'wed'] as const).slice(0, runs.length).forEach((d, k) => { (w.sessions as Record<string, Session>)[d] = runs[k] })
    return true
  }],
  // At the lines: level straight after a deload (allowed only on a knee/shin ramp); a longest run one point over the
  // step cap; a staged race block exactly the distance's weeks, for a returning runner whose block is longer.
  ['a build week straight after a deload, level with the last build week', p => {
    const r = ramp(p), j = r.findIndex((w, k) => k >= 2 && !dl(w) && dl(r[k - 1]) && !dl(r[k - 2]))
    if (j < 2) return false
    r[j].weekly_km = r[j - 2].weekly_km; return true
  }],
  ['a build week whose longest run steps one point over the cap', p => {
    const r = ramp(p), j = r.findIndex((w, k) => k > 0 && !dl(w) && !dl(r[k - 1]))
    if (j < 1) return false
    const prev = Math.max(0, ...runsOf(r[j - 1]).map(s => sessionKmSelfPaced(s) ?? 0))
    if (!(prev > 0)) return false
    for (const s of runsOf(r[j])) { s.distance_km = Math.min(sessionKmSelfPaced(s) ?? 0, prev); delete s.duration_mins }
    const s = runsOf(r[j])[0]
    s.distance_km = prev * (1 + (GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_PCT + 1.5) / 100); return true
  }],
  ['a staged race block of exactly the distance\'s weeks, for a returning runner', p => {
    const gi = meta(p).generator_input as GeneratorInput | undefined
    if (!ramp(p).length || !gi) return false
    gi.weeks_at_current_volume = GENERATION_CONFIG.FRESH_RETURN_WEEKS_THRESHOLD - 1
    const block = GENERATION_CONFIG.PREP_TIME_THRESHOLDS['HM'].block
    gi.race_distance_km = 21.1
    meta(p).staged_race = { door_km: 30, checkpoint_week: p.weeks.length, race_weeks: block, race_distance_km: 21.1, target_found: false }
    return true
  }],
  // The walk-run start: the route (a short declared longest run given continuous running: warn; staged: error), then one
  // breakage per arm on a plan that has a walk-run block.
  ...(['unratified', 'staged'] as const).map(how => [`a short longest run given continuous running (${how})`, (p: Plan) => {
    const gi = meta(p).generator_input as GeneratorInput | undefined
    if (!gi || p.weeks.some(w => w.phase === 'walk_run_start') || !ramp(p).length || meta(p).walk_run_carried) return false
    gi.longest_recent_run_km = GENERATION_CONFIG.WALK_RUN_START_MIN_LONGEST_RUN_KM - 1
    if (how === 'staged') meta(p).staged_race = { door_km: 30, checkpoint_week: p.weeks.length, race_weeks: 30, race_distance_km: 21.1, target_found: false }
    return true
  }] as [string, (p: Plan) => boolean]),
  ...([
    ['a walk-run week one session short', (wr: W[]) => { const k = Object.keys(wr[0].sessions).find(d => (wr[0].sessions as Record<string, Session | undefined>)[d]?.walk_run_level); if (!k) return false; delete (wr[0].sessions as Record<string, unknown>)[k]; return true }],
    ['a walk-run session without its level', (wr: W[]) => { const s = runsOf(wr[0])[0]; if (!s) return false; delete s.walk_run_level; return true }],
    ['a walk-run week mixing levels', (wr: W[]) => { const ss = runsOf(wr[0]); if (ss.length < 2 || !ss[1].walk_run_level) return false; ss[1].walk_run_level = { ...ss[1].walk_run_level, run_mins: ss[1].walk_run_level.run_mins + 1 }; return true }],
    ['a walk-run start at the wrong first level', (wr: W[]) => { for (const s of runsOf(wr[0])) if (s.walk_run_level) s.walk_run_level = { ...s.walk_run_level, run_mins: s.walk_run_level.run_mins + 1 }; return true }],
    ['a walk-run week two levels up', (wr: W[]) => {
      const k = wr.findIndex((w, j) => j > 0 && !dl(w)); if (k < 1) return false
      const base = runsOf(wr[k - 1])[0]?.walk_run_level; if (!base) return false
      for (const s of runsOf(wr[k])) s.walk_run_level = { run_mins: base.run_mins + 2, walk_mins: GENERATION_CONFIG.WALK_RUN_START_WALK_MINS }
      return true
    }],
    ['a walk-run week stepping down', (wr: W[]) => {
      const k = wr.findIndex((w, j) => j > 0 && !dl(w) && (runsOf(w)[0]?.walk_run_level?.run_mins ?? 0) > (runsOf(wr[0])[0]?.walk_run_level?.run_mins ?? 0))
      if (k < 1) return false
      const prev = runsOf(wr[k - 1])[0]?.walk_run_level; if (!prev) return false
      for (const s of runsOf(wr[k])) s.walk_run_level = { run_mins: Math.max(0, prev.run_mins - 1), walk_mins: prev.walk_mins }
      return true
    }],
    ['a walk-run deload that changes the level', (wr: W[]) => {
      if (wr.length < 2) return false
      const w = wr[1], prev = runsOf(wr[0])[0]?.walk_run_level; if (!prev) return false
      w.type = 'deload'; for (const s of runsOf(w)) s.walk_run_level = { run_mins: prev.run_mins + 1, walk_mins: prev.walk_mins }
      return true
    }],
    ['a walk-run start ending below the run-walk level', (wr: W[]) => {
      const first = runsOf(wr[0])[0]?.walk_run_level; if (!first || wr.length < 2) return false
      for (const s of runsOf(wr[wr.length - 1])) s.walk_run_level = { ...first }
      return true
    }],
  ] as [string, (wr: W[]) => boolean][]).map(([name, f]) => [name, (p: Plan) => { const wr = p.weeks.filter(w => w.phase === 'walk_run_start'); return wr.length > 0 && f(wr) }] as [string, (p: Plan) => boolean]),
  ['a running week after a walk-run start dropping the pattern', p => {
    if (!p.weeks.some(w => w.phase === 'walk_run_start')) return false
    const s = ramp(p).flatMap(runsOf).find(x => x.run_walk_strategy); if (!s) return false
    delete s.run_walk_strategy; return true
  }],
  ['a running week before the walk-run start ends', p => {
    const i = p.weeks.findIndex(w => w.phase === 'walk_run_start'); const j = p.weeks.findIndex((w, k) => k > i && w.phase === 'walk_run_start')
    if (i < 0 || j < 0) return false
    p.weeks[i].phase = 'base_build'; return true
  }],
  ['a base-build zone label with its HR target removed', p => {
    if (meta(p).plan_kind !== 'base_build' || meta(p).hr_derived_max == null) return false
    const s = ramp(p).flatMap(runsOf).find(x => x.zone && x.hr_target); if (!s) return false
    delete s.hr_target; return true
  }],
  ['a block that ends past the build-ratio ceiling', p => {
    const start = Number(meta(p).base_build_start_km ?? 0), r = ramp(p)
    if (!(start > 0) || !r.length) return false
    r[r.length - 1].weekly_km = Math.round(start * (GENERATION_CONFIG.MAX_BASE_BUILD_RATIO + 0.1) * 10) / 10; return true
  }],
  ['a staged record on a plan whose weeks do not end at the checkpoint, with too short a race block', p => {
    if (!ramp(p).length) return false
    meta(p).staged_race = { door_km: 30, checkpoint_week: p.weeks.length + 2, race_weeks: 1, race_distance_km: 21.1, target_found: false }
    return true
  }],
  ['a staged plan with a race week in it', p => {
    if (!ramp(p).length) return false
    meta(p).staged_race = { door_km: 30, checkpoint_week: p.weeks.length, race_weeks: 30, race_distance_km: 21.1, target_found: false }
    p.weeks[p.weeks.length - 1].phase = 'peak'; return true
  }],
]

/** The arms, by the verifier's detail prefix: each must fire somewhere in the corpus or its breakages. */
const ARMS: Record<string, string[]> = {
  'INV-PLAN-WALKRUN-START-PROGRESSION': ['routed to a walk-run start', 'a running week before', 'session count', 'a session without', 'mixed levels', 'starts at the wrong level', 'a deload that does not hold', 'steps down', 'steps more than one level', 'ends below', 'a running week that drops'],
  'INV-PLAN-ONRAMP-CURVE-CLIMBS': ['does not climb', 'ends on a deload', 'over the injury cap', 'returns above its pre-deload week', 'a cycle that does not gain'],
  'INV-PLAN-ONRAMP-PER-RUN-STEP': ['longest run steps too far', 'a deload holding a longer run'],
  'INV-PLAN-STAGED-NO-RACE-BLOCK': ['a ', 'does not end at the checkpoint', 'race block too short'],
}

const cases: Case[] = []
const key = (rule: string, week: number | null | undefined, sev: string) => `${rule}|${week ?? 0}|${sev}`

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${GOLDEN_AS_OF}T12:00:00`))
  const rows = [...goldenSample({ perGroup: 8 }), ...goldenSample({ perGroup: 24 }).filter(r => EXTRA_ROWS.has(r.id))]
  for (const row of rows) for (const accept of [false, true]) {
    let o: { kind: string; plan?: Plan }
    try { o = runEngine({ input: row.input, tier: row.tier, displayUnits: 'km', planStart: row.planStart, today: row.asOf, acceptBaseBuild: accept } as never) as never } catch { continue }
    if (o.kind !== 'base_build' || !o.plan) continue
    const base = { input: row.input, asOf: row.asOf, planStart: row.planStart }
    cases.push({ ...base, label: `${row.id}${accept ? ' (accepted)' : ''}`, plan: o.plan })
    for (const [name, f] of BREAKS) { const p = structuredClone(o.plan); if (f(p)) cases.push({ ...base, label: `${row.id} / ${name}`, plan: p }) }
  }
})
afterAll(() => { vi.useRealTimers() })

function oldFindings(p: Plan) {
  const m = meta(p) as { base_build_start_km?: number; onramp_spaced?: boolean; generator_input?: GeneratorInput }
  return [
    ...validateBaseBuildBlock(p.weeks, Number(m.base_build_start_km ?? 0), { spaced: m.onramp_spaced === true, blocked: m.generator_input?.days_cannot_train ?? [], volumeCappedInjury: volumeCappedRampOf(p) }),
    ...validateStagedRace(p),
    // The one base-build rule that lives in validatePlan, behind its plan_kind gate.
    ...(() => { try { return validatePlan(p, meta(p).generator_input as GeneratorInput).filter(v => v.code === 'INV-PLAN-ZONE-LABEL-HAS-PRESCRIPTION') } catch { return [] } })(),
  ]
}

describe('ADR027-B3-VERIFIER — base-build and staged plans', () => {
  it('the corpus holds get-running, walk-run and staged plans', () => {
    expect(cases.filter(c => !c.label.includes(' / ')).length).toBeGreaterThan(40)
    expect(cases.some(c => c.plan.weeks.some(w => w.phase === 'walk_run_start'))).toBe(true)
    expect(cases.some(c => !c.label.includes(' / ') && meta(c.plan).staged_race)).toBe(true)
  })

  it('every breakage landed on at least one plan', () => {
    for (const [name] of BREAKS) expect(cases.some(c => c.label.endsWith(` / ${name}`)), name).toBe(true)
  })

  for (const rule of BASE_BUILD_RULES) {
    it(`🔴 ${rule}: same findings on every base-build plan and breakage, and it fires`, () => {
      const diffs: string[] = []
      let fired = 0
      for (const c of cases) {
        const old = oldFindings(c.plan).filter(v => v.code === rule).map(v => key(v.code, v.week, v.severity)).sort()
        const profile = buildRunnerProfile(factsFromInput(c.input), { asOf: c.asOf, timezone: null, planStart: c.planStart })
        const neu = verifyPlan(c.plan, { input: c.input, profile }).filter(f => f.rule_id === rule).map(f => key(f.rule_id, f.week, f.severity)).sort()
        fired += old.length
        if (JSON.stringify(old) !== JSON.stringify(neu)) diffs.push(`${c.label}: old [${old}] new [${neu}]`)
      }
      expect(diffs.slice(0, 5), `${diffs.length} disagreements`).toEqual([])
      expect(fired, 'nothing here wakes this rule').toBeGreaterThan(0)
    })
  }

  it('🔴 a conditional base-build rule produces each of its severities', () => {
    for (const [rule, branches] of [['INV-PLAN-WALKRUN-START-PROGRESSION', ['warn', 'error']]] as const) for (const sev of branches) {
      const seen = cases.some(c => {
        const profile = buildRunnerProfile(factsFromInput(c.input), { asOf: c.asOf, timezone: null, planStart: c.planStart })
        return verifyPlan(c.plan, { input: c.input, profile }).some(f => f.rule_id === rule && f.severity === sev)
      })
      expect(seen, `${rule} never produced ${sev}`).toBe(true)
    }
  })

  it('🔴 every arm of a multi-check rule fires on its own', () => {
    for (const [rule, prefixes] of Object.entries(ARMS)) for (const pre of prefixes) {
      const n = cases.reduce((t, c) => {
        const profile = buildRunnerProfile(factsFromInput(c.input), { asOf: c.asOf, timezone: null, planStart: c.planStart })
        return t + verifyPlan(c.plan, { input: c.input, profile }).filter(f => f.rule_id === rule && f.detail.startsWith(pre)).length
      }, 0)
      expect(n, `${rule}: "${pre}" never fires`).toBeGreaterThan(0)
    }
  })
})
