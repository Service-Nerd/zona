// STRENGTH-ENGINE-01 — validateStrengthPlan(): the strength constitution, checked.
//
// 🔴 DELIBERATELY DOES NOT CALL THE PRODUCER'S PREDICATES. `placement.ts` decides
// where heavy legs may go; this file re-derives the rule from the RunContext on
// its own. A checker that shares the producer's predicate cannot catch the
// producer being wrong (DELOAD-OWNER-01). Each code maps to a StrengthPrinciples
// section and is falsified in validate.test.ts.

import { CATALOGUE_BY_ID, PATTERN_REGION } from './catalogue'
import { STRENGTH_CONFIG as C } from './config'
import type { InjuryTag, Prescription, RunContext, StrengthPlan, StrengthSession } from './types'

export interface StrengthViolation { code: string; week: number; day?: string; detail: string }

const HARD = new Set(['quality', 'long', 'race'])
const LEG_PATTERNS = new Set(['squat', 'hinge', 'single_leg', 'calf', 'plyometric'])

function diff(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000)
}

export function validateStrengthPlan(plan: StrengthPlan, ctx: RunContext | null): StrengthViolation[] {
  const v: StrengthViolation[] = []
  const p = plan.profile
  const injuries = new Set<InjuryTag>([...(ctx?.injury_tags ?? []), ...(p.injury_tags ?? [])])
  const kit = new Set([...p.equipment, 'bodyweight'])
  const byDate = new Map((ctx?.days ?? []).map(d => [d.date, d]))
  const roleOn = (date: string, offset: number) => {
    const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + offset)
    return byDate.get(d.toISOString().slice(0, 10))?.role ?? 'rest'
  }
  let lastHeavy: string | null = null
  // 🔴 STRENGTH-START-WEEK-01 — the week index this file used to read was the RUN plan's
  // (`forEach((w, wi)`), the same convention the producer got wrong, so the check could not
  // see it. Strength weeks count from the week holding `start_date`, derived here from the
  // calendar, never from the producer's own index.
  const start = plan.start_date
  const startIdx = ctx && start ? Math.max(0, plan.weeks.findIndex(w => ctx.days.some(d => d.week_n === w.n && d.date >= start))) : 0
  let firstPlyoSeen = false

  plan.weeks.forEach((w, runWi) => {
    const wi = runWi - startIdx
    const heavy = w.sessions.filter(s => s.heavy_legs)
    if (heavy.length > C.MAX_HEAVY_LEG_SESSIONS_PER_WEEK) v.push({ code: 'S-LEGS-MAX', week: w.n, detail: `${heavy.length} heavy-leg sessions` })
    const days = new Set<string>()
    let coreExposures = 0

    for (const s of w.sessions) {
      const where = s.date ?? s.day
      // S6 Am.1 — two or more main lower lifts are never all hinges: one knee-dominant, one hip.
      const lowerMains = s.blocks.filter(b => b.role === 'main').flatMap(b => b.items)
        .map(i => CATALOGUE_BY_ID.get(i.exercise_id)).filter(e => e && ['squat', 'hinge', 'single_leg'].includes(e.pattern))
      if (lowerMains.length >= 2 && lowerMains.every(e => e!.pattern === 'hinge')) {
        v.push({ code: 'S-LOWER-BALANCE', week: w.n, day: where, detail: lowerMains.map(e => e!.id).join(' + ') })
      }
      if (start && s.date && s.date < start) v.push({ code: 'S-BEFORE-START', week: w.n, day: where, detail: `placed before strength started (${start})` })
      if (days.has(where)) v.push({ code: 'S-ONE-PER-DAY', week: w.n, day: where, detail: 'two strength sessions on one day' })
      days.add(where)
      if (p.unavailable_days?.includes(s.day)) v.push({ code: 'S-UNAVAILABLE-DAY', week: w.n, day: s.day, detail: 'runner cannot train this day' })
      if (s.date && (byDate.get(s.date)?.runs ?? 0) >= 2) v.push({ code: 'S-NO-STRENGTH-ON-DOUBLE', week: w.n, day: where, detail: 'strength on a day with two runs' })

      const items = s.blocks.flatMap(b => b.items.map(it => ({ it, role: b.role, ex: CATALOGUE_BY_ID.get(it.exercise_id) })))
      const hasLegWork = items.some(x => x.ex && LEG_PATTERNS.has(x.ex.pattern) && x.role !== 'warmup')
      if (hasLegWork !== s.heavy_legs) v.push({ code: 'S-HEAVY-FLAG', week: w.n, day: where, detail: 'heavy_legs does not match the exercises' })
      if (s.blocks.some(b => b.role === 'core')) coreExposures++

      // Run-week placement (S2, S5) — re-derived from the RunContext.
      if (ctx && s.date) {
        const role = byDate.get(s.date)?.role ?? 'rest'
        if (ctx.race_date) {
          const until = diff(s.date, ctx.race_date)
          if (until >= 0 && until <= C.NO_STRENGTH_DAYS_BEFORE_RACE) v.push({ code: 'S-RACE-EVE', week: w.n, day: s.date, detail: 'strength on race day or the day before' })
          if (until >= 0 && until < C.RACE_WEEK_DAYS && s.kind !== 'mobility') v.push({ code: 'S-RACE-WEEK', week: w.n, day: s.date, detail: 'race week is mobility only' })
          if (s.heavy_legs && until >= 0 && until < C.HEAVY_LEGS_CUTOFF_DAYS_BEFORE_RACE) v.push({ code: 'S-TAPER-CUTOFF', week: w.n, day: s.date, detail: `heavy legs ${until} days before the race` })
        }
        if (s.heavy_legs) {
          if (role === 'long' || role === 'race') v.push({ code: 'S-LEGS-ON-LONG', week: w.n, day: s.date, detail: `heavy legs on a ${role} day` })
          if (HARD.has(roleOn(s.date, 1))) v.push({ code: 'S-LEGS-BEFORE-HARD', week: w.n, day: s.date, detail: `next day is ${roleOn(s.date, 1)}` })
          if (role !== 'quality') {
            if (HARD.has(roleOn(s.date, -1))) v.push({ code: 'S-LEGS-AFTER-HARD', week: w.n, day: s.date, detail: 'two hard days in a row (§7)' })
            for (let k = 2; k <= C.HEAVY_LEGS_CLEAR_DAYS_AFTER; k++) {
              if (HARD.has(roleOn(s.date, k))) v.push({ code: 'S-LEGS-48H', week: w.n, day: s.date, detail: `hard run ${k} days later` })
            }
          }
          if (lastHeavy && diff(lastHeavy, s.date) < C.MIN_DAYS_BETWEEN_HEAVY_LEGS) v.push({ code: 'S-LEGS-SPACING', week: w.n, day: s.date, detail: 'heavy legs inside 48 h of the last' })
          lastHeavy = s.date
        }
        if (s.after_quality_run !== (role === 'quality')) v.push({ code: 'S-STACK-FLAG', week: w.n, day: s.date, detail: 'after_quality_run does not match the run day' })
      }

      // Session shape (S10).
      if (s.kind !== 'mobility') {
        if (s.blocks[0]?.role !== 'warmup' || s.blocks[0].items.length === 0) v.push({ code: 'S-WARMUP', week: w.n, day: where, detail: 'no warm-up first' })
        if (s.estimated_minutes > p.session_minutes) v.push({ code: 'S-TIME-OVER', week: w.n, day: where, detail: `${s.estimated_minutes} > ${p.session_minutes} min` })
        if (w.phase !== 'taper' && w.phase !== 'deload' && s.estimated_minutes < p.session_minutes * C.MIN_BUDGET_USE) v.push({ code: 'S-TIME-UNDER', week: w.n, day: where, detail: `${s.estimated_minutes} min of ${p.session_minutes}` })
        if (!s.blocks.some(b => b.role === 'main')) v.push({ code: 'S-NO-MAIN', week: w.n, day: where, detail: 'no main lift' })
      } else if (s.estimated_minutes > C.MOBILITY_SESSION_MINUTES) {
        v.push({ code: 'S-TIME-OVER', week: w.n, day: where, detail: 'mobility session too long' })
      }

      // S10 Am. — a warm-up never repeats a training exercise in lighter form.
      const trained = new Set(items.filter(x => x.role !== 'warmup').map(x => x.it.exercise_id))
      for (const { it, role, ex } of items) {
        if (role === 'warmup' && ex?.same_as && trained.has(ex.same_as)) v.push({ code: 'S-WARMUP-REPEAT', week: w.n, day: where, detail: `${it.exercise_id} repeats ${ex.same_as}` })
      }

      // Every exercise (S7–S9).
      const seen = new Set<string>()
      for (const { it, role, ex } of items) {
        if (!ex) { v.push({ code: 'S-UNKNOWN-EXERCISE', week: w.n, day: where, detail: it.exercise_id }); continue }
        if (role !== 'warmup' && seen.has(ex.id)) v.push({ code: 'S-DUPLICATE', week: w.n, day: where, detail: ex.id })
        seen.add(ex.id)
        if (!ex.equipment.some(o => o.every(t => kit.has(t)))) v.push({ code: 'S-EQUIPMENT', week: w.n, day: where, detail: ex.id })
        if (role === 'main' && ex.not_main) v.push({ code: 'S-MAIN-ELIGIBLE', week: w.n, day: where, detail: ex.id })
        if (ex.avoid_with.some(t => injuries.has(t))) v.push({ code: 'S-INJURY-AVOID', week: w.n, day: where, detail: ex.id })
        if (p.bone_health_flag && (ex.impact === 'high' || ex.spinal_flexion_loaded)) v.push({ code: 'S-BONE', week: w.n, day: where, detail: ex.id })
        if (ex.impact === 'high') {
          const minWeeks = p.experience === 'new' ? C.PLYO_MIN_WEEKS_NEW : C.PLYO_MIN_WEEKS
          if (wi < minWeeks) v.push({ code: 'S-PLYO-TOO-SOON', week: w.n, day: where, detail: ex.id })
          if (Array.from(injuries).some(t => C.PLYO_RESTRICTING_INJURIES.includes(t))) v.push({ code: 'S-PLYO-INJURY', week: w.n, day: where, detail: ex.id })
          if (w.phase === 'taper' || w.phase === 'race_week') v.push({ code: 'S-PLYO-TAPER', week: w.n, day: where, detail: ex.id })
          if ((it.contacts ?? 0) * it.sets > C.PLYO_CONTACTS_MAX) v.push({ code: 'S-PLYO-CONTACTS', week: w.n, day: where, detail: `${(it.contacts ?? 0) * it.sets} contacts` })
          // The board's direction: the FIRST jump a runner meets is the easiest one.
          if (!firstPlyoSeen && ex.level !== 1) v.push({ code: 'S-PLYO-START-LEVEL', week: w.n, day: where, detail: `${ex.id} is level ${ex.level}` })
          firstPlyoSeen = true
        }
        if (it.rir != null) {
          if (it.rir < C.RIR_FLOOR) v.push({ code: 'S-RIR-FLOOR', week: w.n, day: where, detail: `${ex.id} RIR ${it.rir}` })
          if (role === 'main' && LEG_PATTERNS.has(ex.pattern) && it.rir < C.RIR_FLOOR_LOWER_HEAVY) v.push({ code: 'S-RIR-FLOOR', week: w.n, day: where, detail: `${ex.id} RIR ${it.rir}` })
        }
        if ((role === 'main' || role === 'accessory') && it.reps != null && wi < C.NOVICE_BLOCK_WEEKS[p.experience] && it.reps < 8) {
          v.push({ code: 'S-NOVICE-REPS', week: w.n, day: where, detail: `${ex.id} ${it.reps} reps in the technique block` })
        }
        if (w.phase === 'peak' && role === 'main' && it.sets > C.MAIN_SETS - C.PEAK_MAIN_SET_REDUCTION) {
          v.push({ code: 'S-PEAK-SETS', week: w.n, day: where, detail: `${ex.id} ${it.sets} sets in a peak week` })
        }
        if (w.phase === 'deload' && role === 'main' && it.sets > Math.max(1, Math.round(C.MAIN_SETS * C.DELOAD_SET_FACTOR))) {
          v.push({ code: 'S-DELOAD-SETS', week: w.n, day: where, detail: `${ex.id} ${it.sets} sets in a deload week` })
        }
      }
    }
    const trainingSessions = w.sessions.filter(s => s.kind !== 'mobility').length
    // 🔴 STRENGTH-PLYO-BUDGET-01 — S8 PROMISES jumps once the gate is open and nothing checked
    // they arrived, so a plan with one week of jumps in sixteen passed clean.
    const jumpsDue = p.focus === 'running' && wi >= (p.experience === 'new' ? C.PLYO_MIN_WEEKS_NEW : C.PLYO_MIN_WEEKS)
      && w.phase !== 'taper' && w.phase !== 'race_week' && !p.bone_health_flag
      && !Array.from(injuries).some(t => C.PLYO_RESTRICTING_INJURIES.includes(t))
      && w.sessions.some(s => s.heavy_legs)
    if (jumpsDue && !w.sessions.some(s => s.blocks.some(b => b.role === 'plyo' && b.items.length))) {
      v.push({ code: 'S-PLYO-MISSING', week: w.n, detail: 'jumps are due this week and none were placed' })
    }
    if (trainingSessions >= 2 && coreExposures < 2) v.push({ code: 'S-CORE-DOSE', week: w.n, detail: `${coreExposures} core exposures` })
    if (trainingSessions > p.sessions_per_week) v.push({ code: 'S-TOO-MANY', week: w.n, detail: `${trainingSessions} > ${p.sessions_per_week}` })
  })
  return v
}

/**
 * S-RECOVERY-SUBTRACT-ONLY (S13) — an eased session only ever takes away. Re-derived from the two sessions'
 * fields on its own: it does not call `easeForRecovery`, so it can catch that function being wrong.
 */
export function recoveryEaseViolations(original: StrengthSession, eased: StrengthSession): StrengthViolation[] {
  const v: StrengthViolation[] = []
  const at = (detail: string) => v.push({ code: 'S-RECOVERY-SUBTRACT-ONLY', week: original.week_n, day: original.date ?? original.day, detail })
  const before = new Map<string, Prescription>()
  for (const b of original.blocks) for (const it of b.items) before.set(`${b.role}:${it.exercise_id}`, it)
  for (const b of eased.blocks) for (const it of b.items) {
    const was = before.get(`${b.role}:${it.exercise_id}`)
    const ex = CATALOGUE_BY_ID.get(it.exercise_id)
    if (!was) { at(`added ${it.exercise_id}`); continue }
    for (const k of ['sets', 'reps', 'seconds', 'contacts'] as const) if ((it[k] ?? 0) > (was[k] ?? 0)) at(`${it.exercise_id} ${k} rose`)
    if (b.role === 'plyo' || ex?.pattern === 'plyometric') at(`plyometric ${it.exercise_id}`)
    if (['main', 'accessory', 'core'].includes(b.role) && it.sets > Math.max(1, Math.round(was.sets * C.RECOVERY_SET_FACTOR))) at(`${it.exercise_id} not cut to the recovery dose`)
    if (original.heavy_legs && b.role !== 'warmup' && b.role !== 'mobility' && ex && PATTERN_REGION[ex.pattern] === 'lower' && ex.pattern !== 'calf') at(`lower lift kept ${it.exercise_id}`)
  }
  const kept = new Set(eased.blocks.flatMap(b => b.items.map(it => it.exercise_id)))
  for (const b of original.blocks) for (const it of b.items) {
    if (CATALOGUE_BY_ID.get(it.exercise_id)?.pattern === 'calf' && b.role !== 'warmup' && !kept.has(it.exercise_id)) at(`calf work dropped to zero ${it.exercise_id}`)
  }
  if (eased.eased_for !== 'recovery') at('not stamped eased_for')
  return v
}

/**
 * S-PROGRESSION-BOUNDED (S14) — a load suggestion never jumps. Re-derived from the logs on its own: it does not
 * call `suggestLoad`. Never more than one step above the last logged load; never up in a no-step session or after
 * "hard"; extra reps within REP_PROGRESSION_MAX; never up twice inside LOAD_STEP_MIN_DAYS.
 */
export function progressionViolations(
  history: readonly { date: string; exercise_id: string; load_kg: number | null; feel: string; counts: boolean }[],
  exerciseId: string, today: string, noStep: boolean,
  s: { kind: string; load_kg: number | null; extra_reps: number },
): StrengthViolation[] {
  const v: StrengthViolation[] = []
  const at = (detail: string) => v.push({ code: 'S-PROGRESSION-BOUNDED', week: 0, day: today, detail })
  const logs = history.filter(l => l.exercise_id === exerciseId && l.counts && l.date < today && (l.load_kg ?? 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (s.extra_reps > C.REP_PROGRESSION_MAX) at('extra reps over the cap')
  if (!logs.length || s.load_kg == null) return v
  const last = logs[logs.length - 1]
  const ex = CATALOGUE_BY_ID.get(exerciseId)
  const step = ex && PATTERN_REGION[ex.pattern] === 'lower' ? C.LOAD_STEP_KG_LOWER : C.LOAD_STEP_KG_UPPER
  const up = s.load_kg > last.load_kg! + 1e-9
  if (s.load_kg > last.load_kg! + step + C.LOAD_ROUND_KG / 2 + 1e-9) at('more than one step')
  if (up && noStep) at('up in a no-step session')
  if (up && last.feel === 'hard') at('up after hard')
  if (noStep && s.extra_reps > 0) at('extra reps in a no-step session')
  // Never two rises inside the window: the current load, if it was itself a rise, must be old enough to step again.
  if (up) {
    let i = logs.length - 1
    while (i > 0 && logs[i - 1].load_kg === last.load_kg) i--
    if (i > 0 && logs[i - 1].load_kg! < last.load_kg!) {
      const d = Math.round((Date.parse(last.date + 'T00:00:00Z') - Date.parse(logs[i].date + 'T00:00:00Z')) / 86_400_000)
      if (d < C.LOAD_STEP_MIN_DAYS) at('two rises inside the step window')
    }
  }
  return v
}
