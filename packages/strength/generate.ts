// STRENGTH-ENGINE-01 — the engine's single entry point (ADR-024).
//
// `generateStrengthPlan(profile, runContext | null, opts)`. With a RunContext the
// plan is placed around the run plan; with `null` it is a standalone programme,
// which is the standalone-app path (ADR-024 §1). Pure: no clock, no I/O, no AI.

import { STRENGTH_CONFIG as C } from './config'
import { placeWeek, splitFor, type Timeline } from './placement'
import { buildMobilitySession, buildSession } from './session'
import type {
  Day, EquipmentTag, InjuryTag, RunContext, RunDay, RunWeek, StrengthNote, StrengthPlan, StrengthProfile, StrengthWeek,
} from './types'

const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const LOAD_TAGS: EquipmentTag[] = ['dumbbells', 'kettlebell', 'barbell', 'machines', 'cable']

export interface GenerateOptions {
  /** Standalone only: ISO date of the first Monday. Required when `ctx` is null. */
  standaloneStart?: string
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** A run-free calendar for the standalone path (S12). */
export function standaloneContext(start: string): RunContext {
  const days: RunDay[] = []
  const weeks: RunWeek[] = []
  for (let w = 0; w < C.STANDALONE_WEEKS; w++) {
    weeks.push({ n: w + 1, phase: w < C.STANDALONE_BASE_WEEKS ? 'base' : 'build' })
    for (let k = 0; k < 7; k++) days.push({ date: addDays(start, w * 7 + k), day: DAYS[k], week_n: w + 1, role: 'rest' })
  }
  return { version: 1, days, weeks, race_date: null, injury_tags: [], masters: false }
}

export function generateStrengthPlan(profile: StrengthProfile, ctx: RunContext | null, opts: GenerateOptions = {}): StrengthPlan {
  const standalone = ctx == null
  if (standalone && !opts.standaloneStart) throw new Error('standaloneStart is required without a run plan')
  const run = ctx ?? standaloneContext(opts.standaloneStart!)
  const injuries = Array.from(new Set<InjuryTag>([...(run.injury_tags ?? []), ...(profile.injury_tags ?? [])]))
  const timeline: Timeline = { days: run.days, raceDate: run.race_date, unavailable: new Set(profile.unavailable_days ?? []) }
  const notes = new Set<StrengthNote>()
  if (!profile.equipment.some(t => LOAD_TAGS.includes(t))) notes.add('bodyweight_ceiling')
  if (!standalone) notes.add('split_is_inference')

  const weeks: StrengthWeek[] = []
  let prevHeavy: number | null = null
  run.weeks.forEach((wk, weekIndex) => {
    const idx = run.days.map((d, i) => (d.week_n === wk.n ? i : -1)).filter(i => i >= 0)
    const { placed, legsLimited, fewer } = placeWeek(timeline, idx, wk.phase, profile, run.masters, prevHeavy)
    if (legsLimited) notes.add('legs_limited_by_run_week')
    if (fewer && wk.phase !== 'taper' && wk.phase !== 'race_week') notes.add('fewer_sessions_than_asked')
    const sel = { profile, injuries, weekIndex, preferUnilateral: profile.focus === 'running' }
    const dose = { profile, phase: wk.phase, weekIndex }
    const plyoMin = profile.experience === 'new' ? C.PLYO_MIN_WEEKS_NEW : C.PLYO_MIN_WEEKS
    const plyoAllowed = profile.focus === 'running' && weekIndex >= plyoMin
      && wk.phase !== 'taper' && wk.phase !== 'race_week' && !profile.bone_health_flag
    const sessions = placed.map(p => {
      const d = run.days[p.index]
      const built = p.kind === 'mobility' ? buildMobilitySession(sel) : buildSession(p.kind, sel, dose, plyoAllowed)
      built.notes.forEach(n => notes.add(n))
      if (built.heavy_legs) prevHeavy = p.index
      return {
        date: d.date,
        day: d.day,
        week_n: wk.n,
        kind: built.kind,
        heavy_legs: built.heavy_legs,
        after_quality_run: d.role === 'quality',
        estimated_minutes: built.estimated_minutes,
        blocks: built.blocks,
      }
    })
    weeks.push({ n: wk.n, phase: wk.phase, sessions })
  })

  return {
    version: 1,
    standalone,
    split: standalone ? 'standalone' : splitFor(profile.sessions_per_week).split,
    profile,
    weeks,
    notes: Array.from(notes),
  }
}
