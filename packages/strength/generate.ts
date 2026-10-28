// STRENGTH-ENGINE-01 — the engine's single entry point (ADR-024).
//
// `generateStrengthPlan(profile, runContext | null, opts)`. With a RunContext the
// plan is placed around the run plan; with `null` it is a standalone programme,
// which is the standalone-app path (ADR-024 §1). Pure: no clock, no I/O, no AI.

import { STRENGTH_CONFIG as C } from './config'
import { heavyLegsLegal, placeWeek, splitFor, type Timeline } from './placement'
import { buildMobilitySession, buildSession, trainingSignature, type BuiltSession, type VariantScope } from './session'
import { CATALOGUE_BY_ID, LOAD_KIT } from './catalogue'
import type {
  Day, EquipmentTag, InjuryTag, RunContext, RunDay, RunRole, RunWeek, StrengthNote, StrengthPlan, StrengthProfile, StrengthWeek,
} from './types'

const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export interface GenerateOptions {
  /** Standalone only: ISO date of the first Monday. Required when `ctx` is null. */
  standaloneStart?: string
  /** STRENGTH-START-WEEK-01 — when this runner's strength started (ISO). Defaults to the first
   *  day of the calendar, which is right for a plan built at the start of a run plan and wrong
   *  for one built mid-plan, so the route always passes it. */
  startDate?: string
}

/** Index of the run week containing `date` (the first week with a day on or after it). */
export function strengthStartWeek(run: RunContext, date: string): number {
  const i = run.weeks.findIndex(wk => run.days.some(d => d.week_n === wk.n && d.date >= date))
  return i < 0 ? run.weeks.length : i
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
  if (!profile.equipment.some(t => LOAD_KIT.includes(t))) notes.add('bodyweight_ceiling')
  if (!standalone) notes.add('split_is_inference')

  const startDate = opts.startDate ?? run.days[0]?.date ?? opts.standaloneStart ?? ''
  const startWeek = strengthStartWeek(run, startDate)
  const weeks: StrengthWeek[] = []
  let prevHeavy: number | null = null
  let plyoFirstWeek: number | undefined
  run.weeks.forEach((wk, runWeekIndex) => {
    // Before strength started: the week exists (so week numbers stay aligned with the run
    // plan) and holds nothing. A session dated before the runner set strength up is one
    // they never had the chance to do.
    if (runWeekIndex < startWeek) { weeks.push({ n: wk.n, phase: wk.phase, sessions: [] }); return }
    const weekIndex = runWeekIndex - startWeek
    const idx = run.days.map((d, i) => (d.week_n === wk.n && d.date >= startDate ? i : -1)).filter(i => i >= 0)
    const { placed, legsLimited, fewer } = placeWeek(timeline, idx, wk.phase, profile, run.masters, prevHeavy)
    if (legsLimited) notes.add('legs_limited_by_run_week')
    // The start week can be partial; fewer sessions there is the calendar, not the run week.
    if (fewer && weekIndex > 0 && wk.phase !== 'taper' && wk.phase !== 'race_week') notes.add('fewer_sessions_than_asked')
    const sel = { profile, injuries, weekIndex, preferUnilateral: profile.focus === 'running', plyoFirstWeek }
    const dose = { profile, phase: wk.phase, weekIndex }
    const plyoMin = profile.experience === 'new' ? C.PLYO_MIN_WEEKS_NEW : C.PLYO_MIN_WEEKS
    const plyoAllowed = profile.focus === 'running' && weekIndex >= plyoMin
      && wk.phase !== 'taper' && wk.phase !== 'race_week' && !profile.bone_health_flag
    const builtThisWeek: string[] = []
    const sessions = placed.map(p => {
      const d = run.days[p.index]
      let built: BuiltSession | undefined
      if (p.kind === 'mobility') built = buildMobilitySession(sel)
      else {
        // S1 Am.3 (STRENGTH-AB-SESSIONS-01) — the second session of a kind in a week is a B, the third a C, in calendar
        // order, varying every slot. Two ways that can fail, each with a fallback, tried in order until a session both
        // differs from the week's others and fits the clock (S10):
        //   · a small pool (bodyweight, injuries) rotates a C back to its A: count among sessions of the same shape
        //     (with or without light legs), then the next rotations;
        //   · the full swap stacks per-side lifts past a short clock: vary the main lifts only, then the rest only.
        const earlier = placed.filter(q => q.kind === p.kind && q.index < p.index)
        const byKind = earlier.length
        const counts = Array.from(new Set([byKind, earlier.filter(q => !!q.lightLower === !!p.lightLower).length, byKind + 1, byKind + 2, byKind + 3]))
        const build = (variant: number, variantScope: VariantScope) =>
          buildSession(p.kind as Exclude<typeof p.kind, 'mobility'>, { ...sel, variant }, dose, plyoAllowed, { lightLower: !!p.lightLower, variantScope })
        const tries = (['all', 'main', 'support'] as const).flatMap(scope => counts.filter(v => v > 0 || scope === 'all').map(v => [v, scope] as const))
        let firstFresh: BuiltSession | undefined
        for (const [v, scope] of tries) {
          const b = build(v, scope)
          if (builtThisWeek.includes(trainingSignature(b.blocks))) continue
          firstFresh ??= b
          if (b.estimated_minutes <= profile.session_minutes) { built = b; break }
        }
        built ??= firstFresh ?? build(counts[0], 'all')
        builtThisWeek.push(trainingSignature(built.blocks))
      }
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
    if (plyoFirstWeek === undefined && sessions.some(s => s.blocks.some(b => b.items.some(i => CATALOGUE_BY_ID.get(i.exercise_id)?.impact === 'high')))) plyoFirstWeek = weekIndex
    weeks.push({ n: wk.n, phase: wk.phase, sessions })
  })

  // STRENGTH-LEGS-DAY-01 (Design Board 2026-10-19) — name the day, never move one. Counted with placement's own S2
  // predicate on a timeline without the chosen-days restriction, so it answers "if you lifted here instead".
  const legsDay = (() => {
    const chosen = profile.available_days
    // The legs-limited gate is the ruling's scope AND it decides (STRENGTH-LEGS-DAY-GATE-01, 2026-10-21): when the legs
    // are already served, a chosen day can still be one that never takes them (the split's upper day), and the day
    // comparison below would then name a swap that gains nothing. Without it: 8 of 350 three-day picks on real run plans.
    if (standalone || !chosen?.length || !notes.has('legs_limited_by_run_week')) return undefined
    const open: Timeline = { ...timeline, unavailable: new Set() }
    const ordinary = run.weeks.filter(w => ['base', 'build', 'peak', 'deload'].includes(w.phase)).map(w => w.n)
    const legalWeeks = (day: Day) => ordinary.filter(n => run.days.some((d, i) => d.week_n === n && d.day === day && d.date >= startDate && heavyLegsLegal(open, i))).length
    const best = DAYS.filter(d => !chosen.includes(d)).map(d => ({ d, n: legalWeeks(d) })).sort((a, b) => b.n - a.n)[0]
    const worst = chosen.map(d => ({ d, n: legalWeeks(d) })).sort((a, b) => a.n - b.n)[0]
    if (!best || !worst || best.n <= worst.n) return undefined
    const roles = run.days.filter(x => x.day === best.d && ordinary.includes(x.week_n)).map(x => x.role)
    const usual = (['quality', 'easy', 'long'] as RunRole[]).map(r => ({ r, n: roles.filter(x => x === r).length })).sort((a, b) => b.n - a.n)[0]
    return { day: best.d, replaces: worst.d, run: usual && usual.n > 0 ? usual.r : null, weeks: best.n }
  })()

  return {
    version: 1,
    standalone,
    split: standalone ? 'standalone' : splitFor(profile.sessions_per_week).split,
    profile,
    weeks,
    notes: Array.from(notes),
    start_date: startDate,
    injury_tags: injuries,
    ...(legsDay ? { legs_day_suggestion: legsDay } : {}),
  }
}
