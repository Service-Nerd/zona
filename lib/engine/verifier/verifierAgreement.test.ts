// ADR027-B3-VERIFIER — each ported rule agrees with `validatePlan`, finding for finding.
//
// 🔑 TWO POPULATIONS, because one cannot show agreement on its own:
//   · VALID plans from the golden corpus (the wizard's own answer space). An engine plan is meant to be
//     silent, so this proves the verifier raises nothing the old checker does not (no false positives).
//   · BROKEN plans: the liveness battery's mutations applied to those plans. This is where the rules FIRE,
//     so this proves the verifier catches what the old checker catches.
// The comparison is a multiset of (rule, week, day, severity). An arm also asserts each ported rule fired
// at least once, because two checkers that both say nothing agree perfectly and prove nothing.
//
// ⚠️ The work runs in `beforeAll`, not at import, so its cost is billed to a test and `check:slow` sees it.
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { goldenSample, GOLDEN_AS_OF } from '@/lib/corpus/goldenCorpus'
import { runEngine } from '@/lib/plan/engine'
import { validatePlan } from '@/lib/plan/invariants'
import { MUTATIONS } from '@/lib/plan/invariantLiveness'
import type { Plan, GeneratorInput, Session } from '@/types/plan'
import { isLongRun, isStructuredSession, isTimeTrial, isVo2maxSession, isQualitySession, classifyStimulus } from '@/lib/plan/sessionRole'
import { V1_SESSION_CATALOGUE } from '@/lib/plan/sessionCatalogueData'
import { isEffortGovernedRow } from '@/lib/plan/hrBand'
import { goalPaceShapeWord, workAnchorsOf } from '@/lib/plan/sessionStructureV2'
import { racePaceMinPerKm } from '@/lib/plan/aerobicEstimate'
import { sessionKmSelfPaced } from '@/lib/plan/sessionDistance'
import { FUELLING_PRACTICE_NOTE, ULTRA_FUELLING_PREFIX } from '@/lib/plan/fuellingNotes'
import { GENERATION_CONFIG, raceDistanceKey } from '@/lib/plan/generationConfig'
import { hasInjuryKeyword, VOLUME_CAPPED_INJURY_KEYWORDS } from '@/lib/plan/injuryScope'
import { BENCHMARK_VDOT_MAX } from '@/lib/plan/benchmarkCheck'
import { RULES } from '@/lib/engine/catalogue/rules'
import { verifyPlan, PORTED_RULES, DELIVERED_ROUNDING_TOLERANCE_PCT } from './verifyPlan'
import { buildRunnerProfile, factsFromInput } from '@/lib/engine/profile/buildRunnerProfile'

const clone = (p: Plan): Plan => JSON.parse(JSON.stringify(p))
const key = (rule: string, week: number, day: string | null | undefined, sev: string) => `${rule}|${week}|${day ?? '-'}|${sev}`

/** Breakages the shared liveness battery does not make, added for ported rules it cannot wake or whose
 *  line it never reaches. Kept here, not in `invariantLiveness.ts`, so the liveness baseline does not move.
 *  Each returns whether it changed a session the rule actually checks; `hits` counts them, and an arm
 *  asserts every one landed somewhere, so a mutation that silently does nothing fails the file. */
const governedWeek = (w: Plan['weeks'][number]) =>
  w.phase !== 'maintenance_restoration' && w.phase !== 'maintenance_base' && w.phase !== 'base_build'
const checkedEasy = (s: Session | undefined) =>
  !!s && s.type === 'easy' && !isLongRun(s) && !isStructuredSession(s) && !s.floor_protected && !!s.duration_mins
const EXTRA_MUTATIONS: { name: string; apply: (p: Plan, input: GeneratorInput) => boolean; targets?: string[] }[] = [
  { name: 'duration-anchored session loses its minutes', apply: p => {
    for (const w of p.weeks.filter(governedWeek)) for (const s of Object.values(w.sessions ?? {})) {
      if (s && s.type === 'easy') { s.duration_anchored = true; s.duration_mins = undefined; return true }
    }
    return false
  } },
  // The weekday-time boundary: one minute over the runner's own limit. Without it a check loosened by a
  // minute stayed green, because no battery mutation lands near the line (falsified 2026-11-21).
  ...([false, true] as const).map(foundation => ({
    name: `a ${foundation ? 'foundation' : 'main'}-week weekday easy run one minute over its limit`,
    apply: (p: Plan, input: GeneratorInput) => {
      for (const w of p.weeks.filter(x => governedWeek(x) && (foundation ? x.n <= 0 : x.n > 0))) {
        for (const d of ['mon', 'tue', 'wed', 'thu', 'fri'] as const) {
          const cap = input.day_budgets?.[d] ?? input.max_weekday_mins
          const s = w.sessions?.[d]
          if (cap == null || !checkedEasy(s)) continue
          s!.duration_mins = cap + 1
          return true
        }
      }
      return false
    },
  })),
  // An INPUT breakage: the wizard cannot send a longest run above the weekly total, so no plan or plan
  // mutation reaches INV-INPUT-LONGEST-LE-WEEKLY. This one changes what both checkers are handed.
  { name: 'stated longest run above the stated week', apply: (_p, input) => {
    if (!(input.current_weekly_km && input.current_weekly_km > 0)) return false
    input.longest_recent_run_km = input.current_weekly_km + 1
    return true
  } },
  // §87: a deload on the FIRST week of a phase (the 'opens a phase' arm, which nothing else wakes).
  { name: 'a deload opens the build phase', apply: p => {
    const i = p.weeks.findIndex((w, k) => k > 0 && w.n > 1 && w.phase === 'build' && p.weeks[k - 1].phase === 'base')
    if (i < 0 || p.weeks[i].type === 'deload') return false
    p.weeks[i].type = 'deload'
    return true
  } },
  // §23's length gate: a plan one main week under PEAK_OVERLOAD_MIN_PLAN_WEEKS with a flat peak. The old
  // checker is silent below the gate; a verifier without it would raise PEAK-OVER-BASE.
  { name: 'a short plan with a flat peak', apply: p => {
    const main = p.weeks.filter(w => w.n > 0)
    const keep = GENERATION_CONFIG.PEAK_OVERLOAD_MIN_PLAN_WEEKS - 1
    if (main.length <= keep) return false
    const kept = new Set(main.slice(0, keep))
    p.weeks = p.weeks.filter(w => w.n <= 0 || kept.has(w))
    const last = main[keep - 1], first = main[0]
    last.phase = 'peak'; last.weekly_km = first.weekly_km
    return true
  } },
  // §46's line: a time-targeted long race whose peak sits half a kilometre under its floor.
  { name: 'a long-race peak half a kilometre under its floor', apply: (p, input) => {
    const d = input.race_distance_km
    if (input.goal !== 'time_target' || !input.target_time || d < 40) return false
    const floor = d <= 43 ? d * GENERATION_CONFIG.MARATHON_PEAK_VOLUME_FLOOR_RATIO
      : d <= 55 ? d * GENERATION_CONFIG.ULTRA_50K_PEAK_VOLUME_FLOOR_RATIO
      : Math.min(d * GENERATION_CONFIG.ULTRA_LONG_PEAK_VOLUME_FLOOR_RATIO, GENERATION_CONFIG.ULTRA_PEAK_VOLUME_FLOOR_CAP_KM)
    const peaks = p.weeks.filter(w => w.phase === 'peak')
    if (!peaks.length || p.meta.volume_profile === 'maintenance') return false
    for (const w of peaks) w.weekly_km = Math.round((floor - 0.5) * 10) / 10
    return true
  } },
  // §9's minute line: a main-week long run one minute over its (injury-lowered) cap.
  { name: 'a long run one minute over its minute cap', apply: (p, input) => {
    const caps = Object.entries(GENERATION_CONFIG.LONG_RUN_CAP_MINUTES_BY_INJURY)
      .filter(([k]) => hasInjuryKeyword(input.injury_history ?? [], k)).map(([, m]) => m as number)
    const cap = Math.min(GENERATION_CONFIG.LONG_RUN_CAP_MINUTES[raceDistanceKey(input.race_distance_km)], ...caps)
    for (const w of p.weeks.filter(x => x.n > 0 && governedWeek(x))) for (const s of Object.values(w.sessions ?? {})) {
      if (s && isLongRun(s)) { s.duration_mins = cap + 1; return true }
    }
    return false
  } },
  // §55 Am. 1's line: a VDOT half a point above the human ceiling.
  { name: 'a vdot half a point over the human ceiling', apply: p => {
    (p.meta as { vdot?: number }).vdot = BENCHMARK_VDOT_MAX + 0.5
    return true
  } },
  // The plan's statements about itself (§44, §50, §78): one breakage per check, so each arm is woken.
  ...([
    ['prep warned without its warning', (p: Plan) => { p.meta.prep_time_status = 'warned'; delete p.meta.prep_time_warning; return true }],
    ['prep warned with a warning but no alternatives', (p: Plan) => {
      p.meta.prep_time_status = 'warned'; p.meta.prep_time_warning = 'tight'; delete p.meta.prep_time_alternatives; return true
    }],
    ['warned plan reading demanding', (p: Plan) => { p.meta.prep_time_status = 'warned'; p.meta.difficulty_band = 'demanding'; return true }],
    // Short of target too, so COMPRESSION-CLASSIFICATION's ordered checks reach the third on every plan.
    ['constrained plan reading comfortable', (p: Plan) => {
      p.meta.compression_classification = 'constrained_by_inputs'; p.meta.difficulty_band = 'comfortable'; p.meta.time_compressed = true; return true
    }],
    ...(['long_run_shortfall_note', 'peak_shortfall_note', 'volume_shortfall_note'] as const).map(note =>
      [`${note} declared, reading comfortable`, (p: Plan) => {
        for (const k of ['long_run_shortfall_note', 'peak_shortfall_note', 'volume_shortfall_note'] as const) delete p.meta[k]
        p.meta[note] = 'short'; p.meta.difficulty_band = 'comfortable'; return true
      }] as const),
    ['no HR method', (p: Plan) => { delete p.meta.hr_zone_method; return true }],
    // Batch 8: the plan's declarations about its own limits.
    ['no compression class', (p: Plan) => { delete p.meta.compression_classification; return true }],
    // Batch 21: the two remaining conditional rules, each severity branch.
    ...(['build', 'maintenance'] as const).map(profile => [`a session just over the share of its week (${profile} profile)`, (p: Plan) => {
      const w = p.weeks.find(x => x.n >= 1 && x.type !== 'race' && x.type !== 'deload' && x.weekly_km > 0)
      const s = w && Object.values(w.sessions ?? {}).find(x => x && isLongRun(x))
      if (!w || !s) return false
      s.distance_km = Math.round(w.weekly_km * (GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY / 100 + 0.02) * 10) / 10; delete s.duration_mins
      p.meta.volume_profile = profile; if (profile === 'maintenance') p.meta.volume_constraint_note ??= 'Held at maintenance.'
      return true
    }] as const),
    // Batch 20.
    ['a progressive week just past the detraining decline', (p: Plan) => {
      const prog = p.weeks.filter(w => w.n >= 1 && w.phase !== 'taper' && w.type !== 'deload' && w.badge !== 'deload' && w.type !== 'race'
        && !Object.values(w.sessions ?? {}).some(s => s?.type === 'race'))
      if (prog.length < 3 || !(prog[0].weekly_km > 0)) return false
      prog[2].weekly_km = Math.round(prog[0].weekly_km * (1 - GENERATION_CONFIG.MAX_DELIVERED_DECLINE_PCT / 100) * 10) / 10 - 0.5; return true
    }],
    ...(['build', 'maintenance'] as const).map(profile => [`a non-peak week above the peak phase (${profile} profile)`, (p: Plan) => {
      const peak = p.weeks.filter(w => w.n > 0 && w.phase === 'peak' && w.type !== 'deload' && w.type !== 'race')
      const other = p.weeks.find(w => w.n > 0 && w.phase === 'build' && w.type !== 'deload' && w.type !== 'race')
      if (!peak.length || !other) return false
      other.weekly_km = Math.max(...peak.map(w => w.weekly_km)) * 1.5; p.meta.volume_profile = profile
      if (profile === 'maintenance') p.meta.volume_constraint_note ??= 'Held at maintenance.'   // a shape the engine produces
      return true
    }] as const),
    // Batch 19.
    ['every main-week easy run turned into quality', (p: Plan) => {
      let n = 0
      if (p.meta.volume_profile === 'maintenance') return false   // exempt profile: change sessions only where the rule applies
      for (const w of p.weeks.filter(x => x.n >= 1)) for (const s of Object.values(w.sessions ?? {})) if (s?.type === 'easy' && !isLongRun(s)) { s.type = 'quality'; n++ }
      return n > 0
    }],
    ['segment long runs three main weeks in a row', (p: Plan) => {
      const main = p.weeks.filter(w => w.n >= 1)
      for (let k = 0; k + 2 < main.length; k++) {
        const ls = main.slice(k, k + 3).map(w => Object.values(w.sessions ?? {}).find(x => x && isLongRun(x)))
        if (ls.every(Boolean)) { for (const s of ls) s!.lr_segment_pace = '5:00/km'; return true }
      }
      return false
    }],
    ['a segment long run at the start of the build', (p: Plan) => {
      const b = (p.phases ?? []).find(x => x.name === 'build')
      const w = b && p.weeks.find(x => x.n === b.start_week && x.phase === 'build')
      const s = w && Object.values(w.sessions ?? {}).find(x => x && isLongRun(x))
      if (!s || !b || (b.end_week - b.start_week) < GENERATION_CONFIG.RACE_PACE_LR_BUILD_WEEKS + 1) return false
      s.lr_segment_pace = '5:00/km'; return true
    }],
    // Batch 18: run-walk and the shortfall cause.
    ['a run-walk plan whose biggest session sits just under the floor', (p: Plan) => {
      const ss = p.weeks.filter(w => w.n > 0 && w.type !== 'race' && w.type !== 'deload').flatMap(w => Object.values(w.sessions ?? {}))
        .filter(x => x && x.type !== 'rest' && x.type !== 'strength')
      if (!ss.length) return false
      p.meta.finish_goal_run_walk = true as never
      for (const s of ss) { s!.distance_km = Math.min(s!.distance_km ?? 99, GENERATION_CONFIG.FINISH_GOAL_RUNWALK_MIN_PEAK_LR_KM - 0.5); delete s!.duration_mins }
      return true
    }],
    ['run-walk with a volume-capped injury stamped', (p: Plan) => {
      p.meta.finish_goal_run_walk = true as never
      p.meta.injury_history = [VOLUME_CAPPED_INJURY_KEYWORDS[0]]; return true
    }],
    ['a volume-blaming shortfall note on an injury-capped plan', (p: Plan) => {
      p.meta.long_run_shortfall_note = 'Your long run stays short: your weekly volume is what limits it.'
      p.meta.injury_history = [VOLUME_CAPPED_INJURY_KEYWORDS[0]]; return true
    }],
    ['a volume-blaming shortfall note with the long run at its minute cap', (p: Plan) => {
      const km = p.meta.race_distance_km
      const s = p.weeks.filter(w => w.n >= 1 && w.type !== 'race').flatMap(w => Object.values(w.sessions ?? {})).find(x => x && isLongRun(x))
      if (typeof km !== 'number' || !s) return false
      p.meta.injury_history = []
      p.meta.long_run_shortfall_note = 'Your long run stays short: your weekly volume is what limits it.'
      s.duration_mins = GENERATION_CONFIG.LONG_RUN_CAP_MINUTES[raceDistanceKey(km)] - GENERATION_CONFIG.LONG_RUN_AT_CAP_TOLERANCE_MINS; return true
    }],
    // Batch 17.
    ['a long run with no axis', (p: Plan) => {
      const s = p.weeks.flatMap(w => Object.values(w.sessions ?? {})).find(x => x && isLongRun(x))
      if (!s) return false
      s.distance_km = 0; delete s.duration_mins; return true
    }],
    ['a race-pace long run one point past the segment band', (p: Plan) => {
      const s = p.weeks.flatMap(w => Object.values(w.sessions ?? {})).find(x => x && isLongRun(x))
      if (!s) return false
      s.lr_segment_pace = '5:00/km'
      s.coach_notes = [...(s.coach_notes ?? []).filter(n => !/^Final \d+% at /.test(n ?? '')), `Final ${GENERATION_CONFIG.LR_RACE_SEGMENT_PCT_MAX + 1}% at goal pace.`] as unknown as typeof s.coach_notes
      return true
    }],
    ['a build week with its quality removed', (p: Plan) => {
      const w = p.weeks.find(x => (x.phase === 'build' || x.phase === 'peak') && x.type !== 'deload' && x.type !== 'race' && !x.quality_downgraded
        && Object.values(x.sessions ?? {}).some(s => s?.type === 'quality'))
      if (!w) return false
      for (const s of Object.values(w.sessions ?? {})) if (s?.type === 'quality') s.type = 'easy'
      return true
    }],
    // Batch 16.
    ['a quality session with no pace and no effort', (p: Plan) => {
      const s = p.weeks.flatMap(w => Object.values(w.sessions ?? {})).find(x => x && isQualitySession(x))
      if (!s) return false
      delete s.pace_target; delete s.rpe_target; return true
    }],
    ['a quality session with a blank pace and no effort', (p: Plan) => {
      const s = p.weeks.flatMap(w => Object.values(w.sessions ?? {})).find(x => x && isQualitySession(x))
      if (!s) return false
      s.pace_target = '  '; delete s.rpe_target; return true
    }],
    ['a quality session with no pace and an effort of 0', (p: Plan) => {
      const s = p.weeks.flatMap(w => Object.values(w.sessions ?? {})).find(x => x && isQualitySession(x))
      if (!s) return false
      delete s.pace_target; s.rpe_target = 0; return true
    }],
    ['an anchored work step with its pace removed', (p: Plan) => {
      for (const w of p.weeks) for (const s of Object.values(w.sessions ?? {})) {
        const st = (s?.derived_set?.blocks ?? []).flatMap(b => b.steps ?? []).find(x => x.role === 'work' && x.pace_mode !== undefined)
        if (st) { (st as unknown as Record<string, unknown>).pace = undefined; return true }
      }
      return false
    }],
    ['a progression step given a flat pace', (p: Plan) => {
      for (const w of p.weeks) for (const s of Object.values(w.sessions ?? {})) {
        const st = (s?.derived_set?.blocks ?? []).flatMap(b => b.steps ?? []).find(x => x.role === 'work' && x.pace_mode === undefined && typeof x.zone === 'string' && x.zone)
        if (st) { (st as unknown as Record<string, unknown>).pace = '5:00/km'; return true }
      }
      return false
    }],
    ['an easy run labelled Zone 3', (p: Plan) => {
      const s = p.weeks.flatMap(w => Object.values(w.sessions ?? {})).find(x => x && x.type === 'easy' && !isLongRun(x))
      if (!s) return false
      s.zone = 'Zone 3'; return true
    }],
    // Batch 15.
    ['a withheld anchor reading comfortable', (p: Plan) => { p.meta.hm_goal_anchor_withheld = true; p.meta.difficulty_band = 'comfortable'; return true }],
    ['a withheld anchor with no note', (p: Plan) => { p.meta.hm_goal_anchor_withheld = true; p.meta.difficulty_band = 'demanding'; delete p.meta.difficulty_note; return true }],
    ['a race week a kilometre and a bit over the peak', (p: Plan) => {
      const peaks = p.weeks.filter(w => w.phase === 'peak' && w.type !== 'deload').map(w => w.weekly_km ?? 0)
      // A race week that is not itself a peak week, or raising it would only raise the peak.
      const r = p.weeks.find(w => w.phase !== 'peak' && Object.values(w.sessions ?? {}).some(s => s?.type === 'race'))
      if (!peaks.length || !r) return false
      r.weekly_km = Math.max(...peaks) + 1.1; return true
    }],
    ['a discount off the staleness ladder', (p: Plan) => {
      p.meta.vdot_discount_applied_pct = GENERATION_CONFIG.VDOT_CONSERVATIVE_DISCOUNT_PCT + GENERATION_CONFIG.VDOT_STALENESS_PER_4WK_PCT / 2; return true
    }],
    // Batch 14: copy and overrun declarations.
    ['a note naming the wrong taper length', (p: Plan) => {
      const n = p.weeks.filter(w => w.phase === 'taper').length
      const s = p.weeks.flatMap(w => Object.values(w.sessions ?? {})).find(x => x && x.type === 'easy')
      if (!n || !s) return false
      s.coach_notes = [...(s.coach_notes ?? []), `A ${n + 1}-week taper starts soon.`] as typeof s.coach_notes; return true
    }],
    ['goal below easy, no note', (p: Plan) => {
      const m = p.meta as { goal_below_easy_ceiling?: boolean; goal_below_easy_ceiling_note?: string }
      m.goal_below_easy_ceiling = true; delete m.goal_below_easy_ceiling_note; return true
    }],
    ['goal below easy, WITH its note', (p: Plan) => {
      const m = p.meta as { goal_below_easy_ceiling?: boolean; goal_below_easy_ceiling_note?: string }
      m.goal_below_easy_ceiling = true; m.goal_below_easy_ceiling_note = 'below easy'; return true
    }],
    // Batch 13: re-entry window.
    ['a re-entry window over every quality week', (p: Plan) => {
      if (!p.weeks.some(w => w.n >= 1 && Object.values(w.sessions ?? {}).some(s => s && s.type === 'quality' && V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id)?.category === 'vo2max'))) return false
      p.meta.intensity_reentry_active = true; p.meta.intensity_reentry_weeks = 99; return true
    }],
    // Batch 12: soft week rules.
    ['a deload after one loading week', (p: Plan) => { const m = p.weeks.filter(w => w.n >= 1); if (m.length < 3) return false; m[1].type = 'deload'; return true }],
    ['a deload above the week before', (p: Plan) => {
      const i = p.weeks.findIndex((w, k) => k > 0 && (w.type === 'deload' || w.badge === 'deload') && !(p.weeks[k - 1].type === 'deload' || p.weeks[k - 1].badge === 'deload'))
      if (i < 1) return false
      p.weeks[i].weekly_km = p.weeks[i - 1].weekly_km + 1; return true
    }],
    ['a deload in build week 2', (p: Plan) => {
      const b = p.weeks.filter(w => w.n >= 1 && w.phase === 'build')
      if (b.length < 2) return false
      b[1].type = 'deload'; return true
    }],
    ['the two largest sessions on adjacent days', (p: Plan) => {
      const w = p.weeks.find(x => x.n > 0 && x.type !== 'deload' && x.type !== 'race')
      if (!w) return false
      // Larger than any session's ranking value (km OR minutes, as the rule ranks), so this pair IS the top two.
      const top = Math.max(0, ...Object.values(w.sessions ?? {}).map(s => (s ? (s.distance_km ?? s.duration_mins ?? 0) : 0)))
      w.sessions.mon = { type: 'easy', label: 'Big', distance_km: top + 2 } as never
      w.sessions.tue = { type: 'easy', label: 'Big', distance_km: top + 1 } as never
      return true
    }],
    ['the longest long run moved into base', (p: Plan) => {
      const w = p.weeks.find(x => x.n > 0 && x.phase === 'base' && x.type !== 'deload')
      const s = w && Object.values(w.sessions ?? {}).find(x => x && isLongRun(x))
      const later = p.weeks.some(x => x.n > 0 && ['build', 'peak', 'taper'].includes(x.phase ?? '') && x.type !== 'deload' && x.type !== 'race'
        && Object.values(x.sessions ?? {}).some(y => y && isLongRun(y)))
      if (!s || !later) return false
      s.distance_km = 60; return true
    }],
    // Batch 11: notes and copy.
    // Lands only when the peak's longest long session is over the fuelling line (the session the rule reads).
    ['the peak long session stripped of its fuelling note', (p: Plan) => {
      let best: Session | null = null
      for (const w of p.weeks.filter(x => x.phase === 'peak')) for (const s of Object.values(w.sessions ?? {}))
        if (s?.role === 'long_run' && (s.duration_mins ?? 0) > (best?.duration_mins ?? 0)) best = s
      if (!best || (best.duration_mins ?? 0) < GENERATION_CONFIG.FUELLING_PRACTICE_MIN_SESSION_MINS || !best.coach_notes) return false
      const b = best
      b.coach_notes = (b.coach_notes ?? []).filter(x => !!x && x !== FUELLING_PRACTICE_NOTE && !x.startsWith(ULTRA_FUELLING_PREFIX)) as typeof b.coach_notes
      return true
    }],
    ['a peak long session at exactly the fuelling line, no note', (p: Plan) => {
      const ws = p.weeks.filter(x => x.phase === 'peak'); let n = 0
      for (const w of ws) for (const s of Object.values(w.sessions ?? {})) if (s?.role === 'long_run') {
        s.duration_mins = GENERATION_CONFIG.FUELLING_PRACTICE_MIN_SESSION_MINS; delete s.coach_notes; n++
      }
      return n > 0
    }],
    ['effort terrain with no note', (p: Plan) => { p.meta.terrain = GENERATION_CONFIG.TERRAIN_EFFORT_GOVERNS[0] as never; delete p.meta.terrain_effort_note; return true }],
    ['a returning plan with no note', (p: Plan) => { p.meta.fresh_return_active = true; delete p.meta.returning_runner_note; return true }],
    ['an unresolved token in a week label', (p: Plan) => { const w = p.weeks.find(x => x.n > 0); if (!w) return false; w.label = 'Week {{n}}'; return true }],
    ['a placeholder word in the intro', (p: Plan) => { p.meta.coach_intro = 'Ready for Target Race?'; return true }],
    ['a re-entry note with no cause', (p: Plan) => { p.meta.intensity_reentry_omission_note = 'held back'; delete p.meta.intensity_reentry_cause; return true }],
    ['coming-back wording for a non-returning cause', (p: Plan) => {
      p.meta.intensity_reentry_omission_note = 'Coming back carefully'; p.meta.intensity_reentry_cause = 'early_onset'; return true
    }],
    ['a race opening note just past its tolerance', (p: Plan) => {
      for (const w of p.weeks) for (const s of Object.values(w.sessions ?? {})) if (s?.type === 'race') {
        const km = s.distance_km ?? p.meta.race_distance_km
        if (!km) continue
        s.coach_notes = [`First ${Math.round((km * GENERATION_CONFIG.RACE_OPENING_FRACTION + 0.6) * 10) / 10} km steady`]; return true
      }
      return false
    }],
    // Batch 10.
    ['a Zone 2-3 build or peak long run with no segment pace', (p: Plan) => {
      for (const w of p.weeks.filter(x => (x.phase === 'build' || x.phase === 'peak') && x.type !== 'deload'))
        for (const s of Object.values(w.sessions ?? {})) if (s && isLongRun(s)) { s.zone = 'Zone 2\u20133'; delete s.lr_segment_pace; return true }
      return false
    }],
    ['a segment pace on every long run', (p: Plan) => {
      let n = 0
      for (const w of p.weeks) for (const s of Object.values(w.sessions ?? {})) if (s && isLongRun(s)) { s.lr_segment_pace = '5:00/km'; n++ }
      return n > 0
    }],
    ['no tune-up callout', (p: Plan) => { for (const w of p.weeks) delete w.tune_up_callout; return true }],
    ['exactly the tune-up minimum of main weeks, no callout', (p: Plan) => {
      const main = p.weeks.filter(w => w.n >= 1)
      if (main.length < GENERATION_CONFIG.TUNE_UP_MIN_PLAN_WEEKS) return false
      const keep = new Set(main.slice(0, GENERATION_CONFIG.TUNE_UP_MIN_PLAN_WEEKS))
      p.weeks = p.weeks.filter(w => w.n < 1 || keep.has(w))
      for (const w of p.weeks) delete w.tune_up_callout
      return true
    }],
    ['a taper long run just over the peak', (p: Plan) => {
      const peak = Math.max(0, ...p.weeks.filter(w => w.n > 0 && w.phase === 'peak' && w.type !== 'race' && w.type !== 'deload').map(w => {
        const s = Object.values(w.sessions ?? {}).find(x => x && isLongRun(x)); return s ? sessionKmSelfPaced(s) ?? 0 : 0 }))
      const w = p.weeks.find(x => x.phase === 'taper' && x.type !== 'race' && x.type !== 'deload')
      const s = w && Object.values(w.sessions ?? {}).find(x => x && isLongRun(x))
      if (!(peak > 0) || !s) return false
      s.distance_km = Math.round((peak + GENERATION_CONFIG.TAPER_LR_VS_PEAK_TOLERANCE_KM + 0.1) * 10) / 10; return true
    }],
    // Batch 9.
    ['a short block stamped, no note', (p: Plan) => { p.meta.short_opening_block_weeks = [3]; delete p.meta.short_opening_block_note; return true }],
    ['a short-block note, no stamp', (p: Plan) => { delete p.meta.short_opening_block_weeks; p.meta.short_opening_block_note = 'short'; return true }],
    ['re-entry with no VO2 and no note', (p: Plan) => {
      p.meta.intensity_reentry_active = true; delete p.meta.intensity_reentry_omission_note
      for (const w of p.weeks) for (const s of Object.values(w.sessions ?? {})) if (s && s.type === 'quality') s.type = 'easy'
      return true
    }],
    ['a long-run note whose floor is BELOW its peak (no miss)', (p: Plan) => {
      p.meta.volume_constraint_note = 'Peak long run 20 km is below the 19.9 km floor'; return true
    }],
    ['re-entry WITH a VO2 session, note removed', (p: Plan) => {
      const has = p.weeks.some(w => w.n >= 1 && Object.values(w.sessions ?? {}).some(s => s && s.type === 'quality' && isVo2maxSession(s, V1_SESSION_CATALOGUE)))
      if (!has) return false
      p.meta.intensity_reentry_active = true; delete p.meta.intensity_reentry_omission_note; return true
    }],
    ['a long-run floor miss half a rounding step, declared', (p: Plan) => {
      const step = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
      p.meta.volume_constraint_note = `Peak long run 20 km is below the ${20 + step / 2} km floor`; return true
    }],
    ['on-ramp one week under the floor', (p: Plan) => {
      const base = p.weeks.filter(w => w.n >= 1 && w.phase === 'base')
      const need = GENERATION_CONFIG.MIN_BASE_WEEKS_FLOOR - 1 - (p.meta.foundation_weeks_planned ?? 0)
      if (p.meta.early_quality_onset || base.length <= need || need < 0) return false
      for (const w of base.slice(need)) w.phase = 'build'
      return true
    }],
    ['optimal class on a compressed plan', (p: Plan) => { p.meta.compression_classification = 'optimal'; p.meta.time_compressed = true; return true }],
    ['split flags missing (time)', (p: Plan) => { delete p.meta.time_compressed; return true }],
    ['split flags missing (volume)', (p: Plan) => { delete p.meta.volume_constrained; return true }],
    ['a non-optimal class on a plan that reached its target', (p: Plan) => {
      p.meta.compression_classification = 'constrained_by_inputs'; p.meta.time_compressed = false; p.meta.volume_constrained = false; return true
    }],
    ['compressed disagreeing with the split', (p: Plan) => {
      p.meta.time_compressed = false; p.meta.volume_constrained = false; p.meta.compressed = true; return true
    }],
    ['fresh return flipped', (p: Plan) => { p.meta.fresh_return_active = !p.meta.fresh_return_active; return true }],
    ['uncovered runway at the note line, no note', (p: Plan) => {
      p.meta.uncovered_runway_weeks = GENERATION_CONFIG.FOUNDATION_UNCOVERED_WEEKS_NOTE_THRESHOLD; delete p.meta.uncovered_runway_note; return true
    }],
    ['floor-held weeks at the line, undeclared', (p: Plan) => {
      // Clear any existing holds first, so the count is EXACTLY the line on every plan.
      for (const w of p.weeks) for (const s of Object.values(w.sessions ?? {})) if (s) delete s.floor_protected
      const weeks = p.weeks.filter(w => Object.values(w.sessions ?? {}).some(s => s?.type === 'easy'))
      if (weeks.length < GENERATION_CONFIG.EASY_RUN_FLOOR_PROTECTION_MAINTENANCE_WEEKS) return false
      for (const w of weeks.slice(0, GENERATION_CONFIG.EASY_RUN_FLOOR_PROTECTION_MAINTENANCE_WEEKS)) {
        const s = Object.values(w.sessions ?? {}).find(x => x?.type === 'easy'); if (s) s.floor_protected = true
      }
      p.meta.volume_profile = 'build'; return true
    }],
    ['a max HR one beat under the age estimate, unconfirmed', (p: Plan) => {
      if (typeof p.meta.hr_estimated_max !== 'number') return false
      p.meta.hr_derived_max = p.meta.hr_estimated_max - 1; p.meta.hr_max_source = 'observed'; return true
    }],
    ['a non-Karvonen method with no note', (p: Plan) => { p.meta.hr_zone_method = 'percent_of_max'; delete p.meta.hr_assumption_note; return true }],
    ['a recalibration week that does not exist', (p: Plan) => { p.meta.recalibration_weeks = [999]; return true }],
    ['a recalibration week with no time trial', (p: Plan) => {
      const w = p.weeks.find(x => x.n > 0 && !Object.values(x.sessions ?? {}).some(s => s && isTimeTrial(s)))
      if (!w) return false
      p.meta.recalibration_weeks = [w.n]; return true
    }],
  ] as const).map(([name, f]) => ({ name, apply: (p: Plan) => f(p) })),
  ...([
    // §40c's two lines at once: runs pinned at `cap - 1` (the tolerance), and EXACTLY the pinned share of
    // weekday easy runs pinned, the rest well under. Returns whether it changed a run.
    ['a weekday cap binding at exactly its share and tolerance, no shortfall note', (p: Plan, i: GeneratorInput) => {
      if (!i.max_weekday_mins) return false
      const runs: { s: Session; cap: number }[] = []
      for (const w of p.weeks.filter(x => x.type !== 'deload' && x.type !== 'race' && x.badge !== 'deload')) {
        for (const d of ['mon', 'tue', 'wed', 'thu', 'fri'] as const) {
          const s = w.sessions?.[d]; if (s?.type === 'easy') runs.push({ s, cap: i.day_budgets?.[d] ?? i.max_weekday_mins })
        }
      }
      if (!runs.length) return false
      const need = Math.ceil(runs.length * GENERATION_CONFIG.VOLUME_SHORTFALL_PINNED_SHARE)
      runs.forEach((r, k) => { r.s.duration_mins = k < need ? r.cap - 1 : Math.max(1, r.cap - 10) })
      p.meta.volume_shortfall_pct = GENERATION_CONFIG.VOLUME_SHORTFALL_NOTE_THRESHOLD_PCT; delete p.meta.volume_shortfall_note; return true
    }],
    // §29 and §37 separately, with the plan's flag left as built, so each arm of the gate can disagree alone.
    ['the explicit fresh-return input alone', (p: Plan, i: GeneratorInput) => {
      i.weeks_at_current_volume = GENERATION_CONFIG.FRESH_RETURN_WEEKS_THRESHOLD - 1; i.training_age = '<6mo'; return true
    }],
    ['the fresh-return heuristic alone', (p: Plan, i: GeneratorInput) => {
      delete (i as { weeks_at_current_volume?: number }).weeks_at_current_volume
      i.training_age = '5yr+'
      i.current_weekly_km = GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_WEEKLY_KM - 1
      i.longest_recent_run_km = GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_LONG_RUN_KM - 1
      return true
    }],
    // EARLY-ONSET-GATED: each readiness condition failing ALONE, on a plan that claims early onset.
    ...([
      ['an injury', (i: GeneratorInput) => { i.injury_history = ['knee'] }],
      ['irregular recent quality', (i: GeneratorInput) => { i.recent_quality_training = 'none' as GeneratorInput['recent_quality_training'] }],
      ['a shallow training age', (i: GeneratorInput) => { i.training_age = '6-18mo' }],
    ] as const).map(([why, f]) => [`early onset with ${why}`, (p: Plan, i: GeneratorInput) => {
      i.injury_history = []; i.recent_quality_training = 'regular'; i.training_age = '5yr+'; f(i)
      p.meta.early_quality_onset = true; return true
    }] as const),
    // …and the fourth condition: a BEGINNER who is otherwise ready (only rows whose level stays beginner).
    ['early onset for an otherwise-ready beginner', (p: Plan, i: GeneratorInput) => {
      i.injury_history = []; i.recent_quality_training = 'regular'; i.training_age = '5yr+'
      const lvl = buildRunnerProfile(factsFromInput(i), { asOf: GOLDEN_AS_OF, timezone: null }).levels.intensity.value
      // A beginner plan leaves fitness_intensity_level unset; validatePlan falls back to fitness_level (measured: 8 of 8).
      if (lvl !== 'beginner' || (p.meta.fitness_intensity_level ?? p.meta.fitness_level) !== 'beginner') return false
      delete (i as { user_declared_level?: string }).user_declared_level
      p.meta.early_quality_onset = true; return true
    }],
    // The case the review named: DECLARED experienced, assessed beginner, otherwise ready. Both checkers read the
    // declaration and stay silent (the raised safety hole); a verifier reading the profile level would fire.
    ['early onset for a beginner who declared experienced', (p: Plan, i: GeneratorInput) => {
      if ((p.meta.fitness_intensity_level ?? p.meta.fitness_level) !== 'beginner' || p.meta.fitness_intensity_level) return false
      i.injury_history = []; i.recent_quality_training = 'regular'; i.training_age = '5yr+'
      i.user_declared_level = 'experienced'; p.meta.early_quality_onset = true; return true
    }],
    ['early onset for an overdo runner', (p: Plan, i: GeneratorInput) => {
      i.hard_session_relationship = 'overdo'; p.meta.early_quality_onset = true; return true
    }],
    // EXACTLY at the gated floor, which sits below the plain floor: silent under the gated rule, a finding under the
    // plain one. One week under would breach both, which is why the first cut of this stayed green when dropped.
    ['a gated short-distance on-ramp exactly at its (lower) floor', (p: Plan, i: GeneratorInput) => {
      if (!(GENERATION_CONFIG.ONSET_SHORT_ONRAMP_DISTANCES as readonly string[]).includes(raceDistanceKey(i.race_distance_km))) return false
      p.meta.early_quality_onset = true
      const base = p.weeks.filter(w => w.n >= 1 && w.phase === 'base')
      const keep = GENERATION_CONFIG.MIN_ONRAMP_WEEKS_GATED - (p.meta.foundation_weeks_planned ?? 0)
      if (keep < 0 || base.length <= keep) return false
      for (const w of base.slice(keep)) w.phase = 'build'
      return true
    }],
    ['a delivered peak just under the start floor', (p: Plan, i: GeneratorInput) => {
      if (!(i.current_weekly_km && i.current_weekly_km > 0)) return false
      const floor = i.current_weekly_km * GENERATION_CONFIG.PEAK_FLOOR_VS_START_RATIO
      for (const w of p.weeks) if (w.phase !== 'foundation') w.weekly_km = Math.round((floor - 0.6) * 10) / 10
      return true
    }],
    ['a raw VDOT just below its anchor, with a benchmark', (p: Plan, i: GeneratorInput) => {
      if (!i.benchmark || p.meta.vdot_training_anchor === undefined) return false
      p.meta.vdot = p.meta.vdot_training_anchor - 0.1; return true
    }],
    // Lands only on a governed week whose running days EQUAL the declared floor, so one fewer breaches it.
    ['a normal week one running day short', (p: Plan, i: GeneratorInput) => {
      const declared = Math.min(i.days_available ?? GENERATION_CONFIG.MAX_TRAINING_DAYS_PER_WEEK, GENERATION_CONFIG.MAX_TRAINING_DAYS_PER_WEEK, GENERATION_CONFIG.MIN_TRAINING_DAYS_VOLUME_FLOOR)
      const runs = (w: Plan['weeks'][number]) => Object.values(w.sessions ?? {}).filter(s => s && s.type !== 'rest' && s.type !== 'strength').length
      const w = p.weeks.find(x => governedWeek(x) && x.n >= 1 && x.type !== 'race' && x.type !== 'deload' && x.badge !== 'deload' && x.phase !== 'foundation' && runs(x) === declared)
      const d = w && (Object.keys(w.sessions) as (keyof typeof w.sessions)[]).find(k => { const s = w.sessions[k]; return s && s.type === 'easy' && !isLongRun(s) })
      if (!w || !d) return false
      w.sessions[d] = { type: 'rest', label: 'Rest' } as never; return true
    }],
    // Batch 15: dateless benchmarks.
    ['a dateless benchmark with a discount applied', (p: Plan, i: GeneratorInput) => {
      if (!i.benchmark) return false
      delete (i.benchmark as { benchmark_date?: string }).benchmark_date
      p.meta.vdot_discount_applied_pct = GENERATION_CONFIG.VDOT_CONSERVATIVE_DISCOUNT_PCT + GENERATION_CONFIG.VDOT_STALENESS_PER_4WK_PCT; return true
    }],
    // Batch 14: weekday overruns against the runner's own budgets.
    ['a structured weekday session just over its overrun limit, undeclared', (p: Plan, i: GeneratorInput) => {
      for (const w of p.weeks.filter(x => x.type !== 'race')) for (const d of ['mon', 'tue', 'wed', 'thu', 'fri'] as const) {
        const s = w.sessions?.[d]; const c = i.day_budgets?.[d] ?? i.max_weekday_mins
        if (!s || c == null || isLongRun(s) || !isStructuredSession(s)) continue
        s.duration_mins = Math.floor(c * (1 + GENERATION_CONFIG.LONG_RUN_WEEKDAY_OVERRUN_MAINTENANCE_PCT / 100)) + 1; delete s.weekday_overrun_note; return true
      }
      return false
    }],
    ['an easy weekday run one minute over budget, no note', (p: Plan, i: GeneratorInput) => {
      for (const w of p.weeks.filter(x => x.type !== 'race' && x.badge !== 'race')) for (const d of ['mon', 'tue', 'wed', 'thu', 'fri'] as const) {
        const s = w.sessions?.[d]; const c = i.day_budgets?.[d] ?? i.max_weekday_mins
        if (!s || c == null || s.type !== 'easy' || isLongRun(s)) continue
        s.duration_mins = c + 1; delete s.weekday_overrun_note; return true
      }
      return false
    }],
    ['an overrun note on a run within budget', (p: Plan, i: GeneratorInput) => {
      for (const w of p.weeks.filter(x => x.type !== 'race' && x.badge !== 'race')) for (const d of ['mon', 'tue', 'wed', 'thu', 'fri'] as const) {
        const s = w.sessions?.[d]; const c = i.day_budgets?.[d] ?? i.max_weekday_mins
        if (!s || c == null || s.type !== 'easy' || !s.duration_mins || s.duration_mins > c) continue
        s.weekday_overrun_note = 'over today'; return true
      }
      return false
    }],
    // Batch 13: the delivered-cap injury rules, on a runner given a delivered-cap injury.
    ['a knee injury with a bounce-back above the pre-deload week', (p: Plan, i: GeneratorInput) => {
      const dl = (w: Plan['weeks'][number]) => w.type === 'deload' || w.badge === 'deload'
      const k = p.weeks.findIndex((w, j) => j >= 2 && dl(p.weeks[j - 1]) && !dl(w) && !dl(p.weeks[j - 2]) && w.phase !== 'taper')
      if (k < 2) return false
      i.injury_history = [GENERATION_CONFIG.DELIVERED_CAP_INJURIES[0]]
      p.weeks[k].weekly_km = p.weeks[k - 2].weekly_km + 1; return true
    }],
    ['a knee injury with non-long volume just over the cap', (p: Plan, i: GeneratorInput) => {
      const dl = (w: Plan['weeks'][number]) => w.type === 'deload' || w.badge === 'deload'
      const k = p.weeks.findIndex((w, j) => j >= 1 && !dl(w) && !dl(p.weeks[j - 1]) && w.phase !== 'taper' && p.weeks[j - 1].weekly_km > 0)
      if (k < 1) return false
      i.injury_history = [GENERATION_CONFIG.DELIVERED_CAP_INJURIES[0]]
      const lk = (w: Plan['weeks'][number]) => { const l = Object.values(w.sessions ?? {}).find(s => s && isLongRun(s)); return sessionKmSelfPaced(l) ?? 0 }
      const before = p.weeks[k - 1].weekly_km - lk(p.weeks[k - 1])
      if (before <= 0) return false
      const pct = GENERATION_CONFIG.INJURY_WEEKLY_INCREASE_CAP_PCT + DELIVERED_ROUNDING_TOLERANCE_PCT + 1
      const rise = Math.max(before * pct / 100, GENERATION_CONFIG.DELIVERED_ABSOLUTE_FLOOR_KM + 0.5)
      p.weeks[k].weekly_km = Math.round((before + rise + lk(p.weeks[k])) * 10) / 10; return true
    }],
    ...(['error', 'warn'] as const).map(branch => [`a climbing peak step-back week (${branch} branch)`, (p: Plan, i: GeneratorInput) => {
      i.injury_history = []
      const k = p.weeks.findIndex((w, j) => j > 0 && w.phase === 'peak' && w.type !== 'deload' && p.weeks[j - 1].type !== 'deload')
      if (k < 1) return false
      const w = p.weeks[k], prev = p.weeks[k - 1]
      const lr = Object.values(w.sessions ?? {}).find(x => x && isLongRun(x))
      const easy = Object.values(w.sessions ?? {}).find(x => x && x.type === 'easy' && x.role !== 'long_run')
      if (!lr || !easy) return false
      w.peak_stepback = true
      w.weekly_km = prev.weekly_km + 5
      easy.distance_km = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy + 2
      // warn: the long run's share floor sits above the previous week; error: it does not.
      lr.distance_km = branch === 'warn' ? Math.ceil(prev.weekly_km * (GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY / 100) + 2) : 4
      return true
    }] as const),
    // Batch 22: the two rules no corpus plan reaches at their line.
    ...([['one week past', 1], ['exactly at', 0]] as const).map(([at, over]) => [`an onset yield ${at} its bound`, (p: Plan) => {
      p.meta.onset_yield = { rungs: 1, bound: 2, effective: 2 + over }; return true
    }] as const),
    ...([['the week after halfway', 1], ['the halfway week itself', 0]] as const).map(([at, after]) => [`a continuous goal-pace step over the cap in ${at} (5K time goal)`, (p: Plan, i: GeneratorInput) => {
      // Only plans already in scope: widening the request would also expose the plan's own goal-pace work.
      if (raceDistanceKey(i.race_distance_km) !== '5K' || i.goal !== 'time_target') return false
      const half = Math.ceil(p.weeks.filter(w => w.n >= 1).length / 2)
      const w = p.weeks.find(x => x.n === half + after && (x.phase === 'build' || x.phase === 'peak'))
      const s = w && Object.values(w.sessions ?? {}).find(x => x && x.type === 'quality')
      if (!s) return false
      s.stimulus = 'race_pace'
      s.derived_set = { blocks: [{ label: 'main', repeat: 1, steps: [{ role: 'work', pace_mode: 'target', length: `${GENERATION_CONFIG.GOAL_PACE_CONTINUOUS_MAX_MINS + 2} min` }] }] } as unknown as Session['derived_set']
      return true
    }] as const),
    // An ultra-specific row counts as peak specificity: restamped to one, silent; to a threshold row, it fires.
    ...([['an ultra-specific', 'ultra_race_sim'], ['a threshold', 'tempo_continuous']] as const).map(([what, id]) => [`every peak key session restamped to ${what} row`, (p: Plan, i: GeneratorInput) => {
      if (i.goal !== 'time_target' || !(p.meta.race_distance_km && p.meta.race_distance_km > 6)) return false
      let n = 0
      for (const w of p.weeks.filter(x => x.n >= 1 && x.phase === 'peak' && x.type !== 'deload' && x.type !== 'race')) {
        for (const s of Object.values(w.sessions ?? {})) {
          if (!s) continue
          if (s.type === 'quality') { s.catalogue_id = id; n++ }
          else if (isLongRun(s)) delete s.catalogue_id
        }
      }
      return n > 0
    }] as const),
    // Batch 23: a run-walk plan's quality session carrying the interval (every other run carries it, so only that arm can fire).
    ['a run-walk plan with the interval on a quality session', (p: Plan) => {
      let q = 0
      for (const w of p.weeks) for (const s of Object.values(w.sessions ?? {})) {
        if (!s || s.type === 'rest' || s.type === 'cross-train' || s.type === 'strength') continue
        if (isQualitySession(s)) { if (q++ === 0) s.run_walk_strategy = 'Run 4 min, walk 1 min'; else delete s.run_walk_strategy }
        else s.run_walk_strategy = 'Run 4 min, walk 1 min'
      }
      p.meta.run_walk_prescribed = true
      return q > 0
    }],
    // Batch 24: paced VO2max work just over its dose band (no corpus plan reaches the upper edge).
    ['paced VO2max work just over the dose band', (p: Plan) => {
      for (const w of p.weeks) for (const s of Object.values(w.sessions ?? {})) {
        if (!s || !isQualitySession(s) || classifyStimulus(s) !== 'vo2max' || !s.pace_target) continue
        const row = V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id)
        const len = (row?.main_set_structure as { blocks?: { steps?: { role?: string; length?: { kind?: string; secs?: number } }[] }[] } | undefined)
          ?.blocks?.[0]?.steps?.find(x => x.role === 'work')?.length
        const first = (s.derived_set as { blocks?: { repeat?: number }[] } | undefined)?.blocks?.[0]
        if (len?.kind !== 'duration' || typeof len.secs !== 'number' || !first || typeof first.repeat !== 'number') continue
        const over = GENERATION_CONFIG.VO2MAX_WORK_MAX_MINS + GENERATION_CONFIG.MAIN_SET_ORDERING_TOLERANCE_MINS
        first.repeat = Math.floor(over / (len.secs / 60)) + 1
        return true
      }
      return false
    }],
    // Batch 25: an effort-governed session with no pace but a goal-pace NAME (only that arm can fire).
    ['an effort-governed session named as goal-pace work', (p: Plan) => {
      // No corpus plan carries one, so a quality session is restamped onto the first effort-governed row.
      const row = V1_SESSION_CATALOGUE.find(r => isEffortGovernedRow(r))
      const s = p.weeks.flatMap(w => Object.values(w.sessions ?? {})).find(x => x && x.type === 'quality')
      if (!row || !s) return false
      s.catalogue_id = row.id; delete s.pace_target; s.label = 'Goal-pace hill reps'; return true
    }],
    // A label ending in a word no row produces stays silent; the same label with a wrong shape word fires. ⚠️ This does
    // NOT pin the purpose-word skip: "sharpener" is not a shape word, so the known-word check silences it on its own (code
    // review, batch 24–25). The skip is an equivalent mutant while no row produces that word.
    ...([['a purpose word', 'sharpener'], ['the wrong shape word', 'WRONG']] as const).map(([what, word]) => [`a renamed goal-pace label ending in ${what}`, (p: Plan) => {
      const words = Array.from(new Set(V1_SESSION_CATALOGUE.map(r => goalPaceShapeWord(r)).filter((x): x is string => !!x)))
      for (const w of p.weeks) for (const s of Object.values(w.sessions ?? {})) {
        const row = s?.catalogue_id ? V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id) : undefined
        if (!s || !row) continue
        const actual = (s.derived_set?.blocks?.length ? goalPaceShapeWord({ main_set_structure: { version: 2, blocks: s.derived_set.blocks } }) : null) ?? goalPaceShapeWord(row)
        const wrong = words.find(x => x !== actual && x !== 'intervals' && x !== 'sharpener')
        if (!actual || !wrong) continue
        s.label = `Goal-pace ${word === 'WRONG' ? wrong : word}`; return true
      }
      return false
    }] as const),
    // Batch 26: a plan with every quality session removed. Loud as it stands; silent when the open days cannot space
    // quality from the long run, or (time goal) when no week carries enough volume for quality.
    ...(['loud', 'no spaced day', 'too little volume'] as const).map(how => [`every quality session removed (${how})`, (p: Plan, i: GeneratorInput) => {
      let n = 0
      for (const w of p.weeks) for (const d of Object.keys(w.sessions ?? {}) as (keyof typeof w.sessions)[]) {
        if (w.sessions[d]?.type === 'quality') { delete w.sessions[d]; n++ }
      }
      if (n === 0) return false
      if (how === 'no spaced day') {
        const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
        const ld = p.weeks.filter(w => w.n >= 1).flatMap(w => Object.entries(w.sessions ?? {})).find(([, x]) => x && isLongRun(x))?.[0]
        if (!ld) return false
        const min = Math.ceil(GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY_AND_LONG / 24)
        const gap = (a: string) => { const x = Math.abs(DAYS.indexOf(a as never) - DAYS.indexOf(ld as never)); return Math.min(x, 7 - x) }
        i.days_cannot_train = DAYS.filter(d => d !== ld && gap(d) >= min)
      }
      if (how === 'too little volume') for (const w of p.weeks) w.weekly_km = GENERATION_CONFIG.BEGINNER_QUALITY_MIN_WEEKLY_KM - 1
      return true
    }] as const),
    // Batch 27: two consecutive peak-level long runs on a half or full marathon; silent once for an eligible runner.
    ...(['an ineligible', 'an eligible'] as const).map(who => [`two peak-level long runs in a row for ${who} runner`, (p: Plan, i: GeneratorInput) => {
      if (raceDistanceKey(i.race_distance_km) !== 'HM' && raceDistanceKey(i.race_distance_km) !== 'MARATHON') return false
      const peak = p.weeks.filter(w => w.phase === 'peak' && w.type !== 'deload')
      const lrs = peak.map(w => Object.values(w.sessions ?? {}).find(x => x && isLongRun(x)))
      if (peak.length < 2 || lrs.some(x => !x)) return false
      lrs.forEach((lr, k) => {
        lr!.distance_km = k < 2 ? 30 : 5; delete lr!.duration_mins
        if (k < 2) lr!.lr_segment_pace = '5:00'; else { delete lr!.lr_segment_pace; lr!.label = 'Long run' }
      })
      if (who === 'an eligible') { i.hard_session_relationship = 'love'; i.injury_history = []; i.training_age = '5yr+' }
      else i.hard_session_relationship = 'avoid'
      return true
    }] as const),
    // A time trial whose notes say measurement but not to log the result; a VO2 session with an aerobic cue.
    ['a time trial that never says to log the result', (p: Plan) => {
      const s = p.weeks.filter(w => w.n >= 1 && w.phase !== 'base_build').flatMap(w => Object.values(w.sessions ?? {})).find(x => x && x.type === 'quality')
      if (!s) return false
      s.type = 'hard'; s.coach_notes = ['A measurement, run it honestly.']; return true
    }],
    ['a VO2max session with an aerobic cue', (p: Plan) => {
      const s = p.weeks.filter(w => w.n >= 1).flatMap(w => Object.values(w.sessions ?? {})).find(x => x && x.type === 'quality')
      if (!s) return false
      s.label = 'VO2max intervals'; s.coach_notes = ['Boring is the point.']; return true
    }],
    // Batch 28: foundation strides without the readiness gate, and with an injury history (gate passed).
    ...(['without the readiness gate', 'with injury history'] as const).map(how => [`foundation strides ${how}`, (p: Plan, i: GeneratorInput) => {
      const s = p.weeks.filter(w => w.phase === 'foundation').flatMap(w => Object.values(w.sessions ?? {})).find(x => x && x.type === 'easy')
      if (!s) return false
      s.coach_notes = ['Finish with 4 strides.']
      if (how === 'with injury history') { p.meta.early_quality_onset = true as never; i.injury_history = ['knee'] }
      else { delete p.meta.early_quality_onset; i.injury_history = [] }
      return true
    }] as const),
    // A foundation week ramping just over the week-to-week ceiling; silent when that week is a deload.
    ...(['a normal', 'a deload'] as const).map(kind => [`a foundation week ramping just over the ceiling onto ${kind} week`, (p: Plan, i: GeneratorInput) => {
      const f = p.weeks.filter(w => w.phase === 'foundation')
      const k = f.findIndex((w, j) => j > 0 && f[j - 1].weekly_km > 0 && w.type !== 'deload' && w.badge !== 'deload' && f[j - 1].type !== 'deload' && f[j - 1].badge !== 'deload')
      if (k < 1) return false
      i.current_weekly_km = 1000   // keep the stated-volume ceiling out of reach
      f[k].weekly_km = Math.round((f[k - 1].weekly_km * 1.1 + 0.5) * 10) / 10
      if (kind === 'a deload') f[k].type = 'deload'
      return true
    }] as const),
    // Second-half quality restamped onto a CV-anchored row (skipped by the ratio) or a threshold row (counted, off goal pace).
    ...(['a CV-anchored', 'a threshold', 'an effort-governed', 'a displaced threshold'] as const).map(kind => [`second-half quality restamped to ${kind} row off goal pace`, (p: Plan) => {
      const cv = V1_SESSION_CATALOGUE.find(r => { const a = workAnchorsOf(r).filter(x => x !== 'E'); return a.length > 0 && a.every(x => x === 'CV') })
      const id = kind === 'a CV-anchored' ? cv?.id : kind === 'an effort-governed' ? V1_SESSION_CATALOGUE.find(r => isEffortGovernedRow(r) && r.category !== 'vo2max')?.id   // a VO2 row is skipped earlier, masking this arm
         : 'tempo_continuous'
      if (!id || !p.meta.goal_pace_per_km) return false
      const half = Math.ceil(p.weeks.filter(w => w.n > 0).length / 2)
      let n = 0
      for (const w of p.weeks) {
        if (w.n < half || (w.phase !== 'build' && w.phase !== 'peak') || w.type === 'deload') continue
        for (const s of Object.values(w.sessions ?? {})) if (s && s.type === 'quality') { s.catalogue_id = id; s.pace_target = '9:00'; delete s.stimulus; if (kind === 'a displaced threshold') s.displaced_by_adaptation_window = true; n++ }
      }
      return n > 0
    }] as const),
    // Batch 30 (and the batch 26-28 review): the arms no corpus plan reached.
    ['a goal-pace session with an aerobic cue', (p: Plan) => {
      const s = p.weeks.filter(w => w.n >= 1).flatMap(w => Object.values(w.sessions ?? {})).find(x => x && x.type === 'quality')
      if (!s) return false
      s.label = '10K-pace intervals'; s.coach_notes = ['Boring is the point.']; return true
    }],
    ['a quality session labelled as aerobic work on a hard zone', (p: Plan) => {
      const s = p.weeks.filter(w => w.n >= 1).flatMap(w => Object.values(w.sessions ?? {})).find(x => x && x.type === 'quality')
      if (!s) return false
      s.label = 'Aerobic intervals'; s.zone = 'Zone 4–5'; return true
    }],
    ['an over-under 4% faster than T pace', (p: Plan) => {
      const vdot = p.meta.vdot_training_anchor ?? p.meta.vdot
      const s = p.weeks.filter(w => w.n >= 1).flatMap(w => Object.values(w.sessions ?? {})).find(x => x && x.type === 'quality')
      if (!vdot || !s) return false
      // The old checker's Daniels inverse at 0.855 of VO2max.
      const a = 0.000104, b = 0.182258, c = -4.60 - 0.855 * vdot
      const t = 1000 / ((-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a))
      const mid = t * 0.96, mm = Math.floor(mid), ss = Math.round((mid - mm) * 60)
      s.catalogue_id = 'tempo_over_under'; s.pace_target = `${mm}:${String(ss).padStart(2, '0')}`; return true
    }],
    // A lopsided foundation week: its long-run share arm needs three runs, so two runs stay silent.
    ...(['three', 'two'] as const).map(n => [`a foundation week with ${n} runs, one of them most of the week`, (p: Plan) => {
      const w = p.weeks.find(x => x.phase === 'foundation' && Object.values(x.sessions ?? {}).filter(y => y && y.type !== 'rest' && y.type !== 'cross-train').length >= 3 && x.weekly_km > 0)
      if (!w) return false
      const keys = (Object.keys(w.sessions) as (keyof typeof w.sessions)[]).filter(k => { const y = w.sessions[k]; return y && y.type !== 'rest' && y.type !== 'cross-train' })
      keys.slice(n === 'two' ? 2 : 3).forEach(k => delete w.sessions[k])
      const first = w.sessions[keys[0]]!
      first.distance_km = Math.round(w.weekly_km * 0.9 * 10) / 10; delete first.duration_mins
      return true
    }] as const),
    // Batch 31: a race-week shakeout over its RPE; a fast-float VO2 session with no float, a target float, a jogged float.
    ['a race-week shakeout over its RPE', (p: Plan) => {
      const last = Math.max(0, ...p.weeks.map(w => w.n))
      const s = Object.values(p.weeks.find(w => w.n === last)?.sessions ?? {}).find(x => x && x.role === 'shakeout')
      if (!s) return false
      s.rpe_target = 6; return true
    }],
    ...(['no float', 'a target float', 'a jogged float'] as const).map(kind => [`a rolling VO2 session with ${kind}`, (p: Plan) => {
      const s = p.weeks.filter(w => w.n >= 1).flatMap(w => Object.values(w.sessions ?? {})).find(x => x && x.type === 'quality')
      if (!s) return false
      const work = { role: 'work', length: '1 min', pace: '4:00', pace_mode: 'target' }
      const float = { role: 'recovery', length: '1 min', pace: '5:00', pace_mode: kind === 'a target float' ? 'target' : 'ceiling', modality: kind === 'a jogged float' ? 'jog' : 'run' }
      s.catalogue_id = 'intervals_rolling'
      s.derived_set = { blocks: [{ label: 'main', repeat: 6, steps: kind === 'no float' ? [work] : [work, float] }] } as unknown as Session['derived_set']
      return true
    }] as const),
    // Batch 32: the goal-pace decision's three arms no corpus plan reached.
    ['a goal-pace decision recorded with no benchmark', (p: Plan, i: GeneratorInput) => {
      if (!p.meta.goal_pace_reach || !i.benchmark) return false
      delete i.benchmark; return true
    }],
    ['goal pace withheld inside the line', (p: Plan) => {
      if (!p.meta.goal_pace_reach || p.meta.goal_pace_withheld) return false
      p.meta.goal_pace_withheld = { gap_pct: 1 }; return true
    }],
    ['goal pace withheld with no decision record', (p: Plan) => {
      if (!p.meta.goal_pace_reach) return false
      delete p.meta.goal_pace_reach; p.meta.goal_pace_withheld = { gap_pct: 12 }; return true
    }],
    // Goal-pace reach AT its lines: the goal one point past the stretch line, not withheld; and a withheld plan whose
    // race-pace long run finishes half a tolerance off current race pace.
    ['a goal one point past the stretch line, not withheld', (p: Plan, i: GeneratorInput) => {
      const r = p.meta.goal_pace_reach
      if (!r || !(i.race_distance_km > 0)) return false
      const past = GENERATION_CONFIG.GOAL_PACE_MAX_STRETCH_PCT + GENERATION_CONFIG.INTENSITY_ORDERING_TOLERANCE_PCT + 1
      const goal = racePaceMinPerKm(r.vdot, i.race_distance_km) * (1 - past / 100)
      const mm = Math.floor(goal), ss = Math.round((goal - mm) * 60)
      p.meta.goal_pace_per_km = ss === 60 ? `${mm + 1}:00` : `${mm}:${String(ss).padStart(2, '0')}`
      delete p.meta.goal_pace_withheld; return true
    }],
    ['a withheld plan whose race-pace long run finishes just off race pace', (p: Plan, i: GeneratorInput) => {
      const r = p.meta.goal_pace_reach
      const lr = p.weeks.filter(w => w.n >= (r?.from_week ?? 1)).flatMap(w => Object.values(w.sessions ?? {})).find(x => x && isLongRun(x))
      if (!r || !lr || !(i.race_distance_km > 0)) return false
      const pace = racePaceMinPerKm(r.vdot, i.race_distance_km) * (1 + 1.5 * GENERATION_CONFIG.GOAL_PACE_REHEARSAL_TOLERANCE_PCT / 100)
      const mm = Math.floor(pace), ss = Math.round((pace - mm) * 60)
      p.meta.goal_pace_withheld = { gap_pct: 12 }
      lr.catalogue_id = 'mp_long_run'; lr.lr_segment_pace = ss === 60 ? `${mm + 1}:00` : `${mm}:${String(ss).padStart(2, '0')}`
      return true
    }],
    ['meta age differing from the input', (p: Plan, i: GeneratorInput) => {
      if (typeof i.age !== 'number') return false
      ;(p.meta as unknown as Record<string, unknown>).age = i.age + 1; return true
    }],
    ['meta age with no input age', (p: Plan, i: GeneratorInput) => {
      delete (i as { age?: number }).age; (p.meta as unknown as Record<string, unknown>).age = 40; return true
    }],
    ['no age and no assumption note', (p: Plan, i: GeneratorInput) => {
      delete (i as { age?: number }).age; delete p.meta.hr_assumption_note; return true
    }],
  ] as const).map(([name, f]) => ({ name, apply: (p: Plan, i: GeneratorInput) => f(p, i) })),
  // §49's line: exactly one taper week over the cap (relabel the weeks before the taper).
  { name: 'one taper week over the cap', apply: (p, input) => {
    const cap = GENERATION_CONFIG.MAX_TAPER_PHASE_WEEKS[raceDistanceKey(input.race_distance_km) as keyof typeof GENERATION_CONFIG.MAX_TAPER_PHASE_WEEKS]
    let n = p.weeks.filter(w => w.phase === 'taper').length
    if (n >= cap + 1) return false                       // already over: this mutation would change nothing
    const first = p.weeks.findIndex(w => w.phase === 'taper')
    for (let i = first - 1; i >= 0 && n < cap + 1; i--) {
      const w = p.weeks[i]
      if (w.n < 1 || w.type === 'race' || w.type === 'deload') return false
      w.phase = 'taper'; n++
    }
    return first > 0 && n === cap + 1
  } },
  // §39 Am. 1's line: a session inside the protected days, one minute over the shakeout cap.
  { name: 'a pre-race session one minute over the shakeout cap', apply: p => {
    for (const w of p.weeks) {
      const keys = Object.keys(w.sessions ?? {})
      const raceDay = keys.find(d => w.sessions[d as 'mon']?.type === 'race')
      if (!raceDay) continue
      const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
      const prior = days[days.indexOf(raceDay) - 1] as 'mon' | undefined
      const s = prior ? w.sessions[prior] : undefined
      if (!s || s.type === 'rest') continue
      s.duration_mins = GENERATION_CONFIG.RACE_WEEK_SHAKEOUT_MAX_MINS + 1
      raceEveDays.set(p, `${w.n}|${prior}`)
      return true
    }
    return false
  } },
  // The race date leaves the final week: COVERS-RACE-DATE fires and RACE-ON-RACE-DAY must still be checked.
  // Eight days, not seven: seven keeps the weekday, so no wrong-day finding exists to disagree about.
  { name: 'race date eight days after the plan ends', apply: p => {
    if (!p.meta.race_date) return false
    const [y, m, d] = p.meta.race_date.split('-').map(Number)
    const next = new Date(y, m - 1, d + 8)
    p.meta.race_date = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
    return true
  } },
]
/** Breakages whose landing must be on a NAMED rule: they also wake neighbouring cap rules, so "the old report
 *  changed" would pass without the target being reached (code review, batch 14). */
const TARGETS: Record<string, string[]> = {
  'a goal one point past the stretch line, not withheld': ['INV-PLAN-GOAL-PACE-REACHABLE'],
  'a withheld plan whose race-pace long run finishes just off race pace': ['INV-PLAN-GOAL-PACE-REACHABLE'],
  'a goal-pace decision recorded with no benchmark': ['INV-PLAN-GOAL-PACE-REACHABLE'],
  'goal pace withheld inside the line': ['INV-PLAN-GOAL-PACE-REACHABLE'],
  'goal pace withheld with no decision record': ['INV-PLAN-GOAL-PACE-REACHABLE'],
  'a race-week shakeout over its RPE': ['INV-PLAN-RACE-WEEK-SHAKEOUT-CAP'],
  'a rolling VO2 session with no float': ['INV-PLAN-VO2MAX-FLOAT-IS-A-CEILING'],
  'a rolling VO2 session with a target float': ['INV-PLAN-VO2MAX-FLOAT-IS-A-CEILING'],
  'a rolling VO2 session with a jogged float': ['INV-PLAN-VO2MAX-FLOAT-IS-A-CEILING'],
  'a goal-pace session with an aerobic cue': ['INV-PLAN-COACH-NOTES-MATCH-INTENT'],
  'a quality session labelled as aerobic work on a hard zone': ['INV-PLAN-LABEL-MATCHES-PACE'],
  'an over-under 4% faster than T pace': ['INV-PLAN-OVER-UNDER-MEAN-NEAR-THRESHOLD'],
  'foundation strides without the readiness gate': ['INV-PLAN-FOUNDATION-BLOCK'],
  'foundation strides with injury history': ['INV-PLAN-FOUNDATION-BLOCK'],
  'a time trial that never says to log the result': ['INV-PLAN-COACH-NOTES-MATCH-INTENT'],
  'a VO2max session with an aerobic cue': ['INV-PLAN-COACH-NOTES-MATCH-INTENT'],
  'an effort-governed session named as goal-pace work': ['INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED'],
  'paced VO2max work just over the dose band': ['INV-PLAN-VO2MAX-MAIN-SET-CAP'],
  'a run-walk plan with the interval on a quality session': ['INV-PLAN-RUNWALK-PRESCRIBED'],
  'a structured weekday session just over its overrun limit, undeclared': ['INV-PLAN-STRUCTURED-OVERRUN-DECLARED'],
  'an easy weekday run one minute over budget, no note': ['INV-PLAN-WEEKDAY-OVERRUN-DECLARED'],
  'a race week a kilometre and a bit over the peak': ['INV-PLAN-RACE-NOT-VOLUME'],
  'a discount off the staleness ladder': ['INV-PLAN-VDOT-STALENESS-LADDER'],
  'a dateless benchmark with a discount applied': ['INV-PLAN-VDOT-DISCOUNT-DATELESS'],
  'a quality session with no pace and no effort': ['INV-PLAN-EFFORT-OR-PACE'],
  'a quality session with a blank pace and no effort': ['INV-PLAN-EFFORT-OR-PACE'],
  'a quality session with no pace and an effort of 0': ['INV-PLAN-EFFORT-OR-PACE'],
  'a build week with its quality removed': ['INV-PLAN-QUALITY-EXPECTED'],
  'a run-walk plan whose biggest session sits just under the floor': ['INV-PLAN-RUNWALK-ADEQUATE'],
  'every main-week easy run turned into quality': ['INV-PLAN-INTENSITY-DISTRIBUTION'],
  'a segment long run at the start of the build': ['INV-PLAN-RACE-PACE-LR-BUILD-WINDOW'],
  'segment long runs three main weeks in a row': ['INV-PLAN-RACE-PACE-LR-BUILD-WINDOW'],
  'a progressive week just past the detraining decline': ['INV-PLAN-NOT-DETRAINING'],
  'a non-peak week above the peak phase (build profile)': ['INV-PLAN-PEAK-IN-PEAK-PHASE'],
  'a non-peak week above the peak phase (maintenance profile)': ['INV-PLAN-PEAK-IN-PEAK-PHASE'],
  'run-walk with a volume-capped injury stamped': ['INV-PLAN-RUNWALK-CAP-NOT-REDUCED'],
  'a volume-blaming shortfall note on an injury-capped plan': ['INV-PLAN-LR-SHORTFALL-CAUSE'],
  'a volume-blaming shortfall note with the long run at its minute cap': ['INV-PLAN-LR-SHORTFALL-CAUSE'],
  'a race-pace long run one point past the segment band': ['INV-PLAN-LR-RACE-SEGMENT-PCT'],
}
/** Rules that read only module data (the catalogue, the signatures), never the plan. */
const STATIC_RULES = new Set<string>(['INV-PLAN-PHASE-FOCUS-REACHABLE'])
/** Each: why it may be ported, and the severities the predicate must be SEEN to produce (both branches of a real
 *  condition), so a CONDITIONAL_PORTED line cannot stand in for logic the predicate does not have. */
const CONDITIONAL_PORTED: Record<string, { why: string; branches: ('warn' | 'error')[] }> = {
  'INV-PLAN-NOT-DETRAINING': { why: 'not conditional: always warn; the note is a planned promotion', branches: ['warn'] },
  'INV-PLAN-PEAK-IN-PEAK-PHASE': { why: 'warn on a maintenance profile, error otherwise (set in the predicate)', branches: ['warn', 'error'] },
  'INV-PLAN-LR-MAX-WEEKLY-PCT': { why: 'warn on a maintenance profile, error otherwise (set in the predicate)', branches: ['warn', 'error'] },
  'INV-PLAN-HEADER-PACE-MATCHES-WORK': { why: 'warn when the header reads the goal pace, error otherwise', branches: ['warn', 'error'] },
  'INV-PLAN-PEAK-STEPBACK-VOLUME': { why: 'warn when the §52 share floor sits above the previous week, error otherwise', branches: ['warn', 'error'] },
}
const hits = new Map<string, number>()
/** Breakages that sit exactly where a rule must STAY silent, so they change nothing the old checker reports. */
const SILENT: Record<string, { rule: string; twin: string }> = {
  // each: the rule it must leave silent in BOTH checkers, and a loud twin breakage that does fire that rule
  'a gated short-distance on-ramp exactly at its (lower) floor': { rule: 'INV-PLAN-ONRAMP-FLOOR', twin: 'on-ramp one week under the floor' },
  'early onset for a beginner who declared experienced': { rule: 'INV-PLAN-EARLY-ONSET-GATED', twin: 'early onset for an otherwise-ready beginner' },
  'a long-run note whose floor is BELOW its peak (no miss)': { rule: 'INV-PLAN-LR-FLOOR-NOT-ROUNDING', twin: 'a long-run floor miss half a rounding step, declared' },
  're-entry WITH a VO2 session, note removed': { rule: 'INV-PLAN-REENTRY-OMISSION-DECLARED', twin: 're-entry with no VO2 and no note' },
  'goal below easy, WITH its note': { rule: 'INV-PLAN-GOAL-BELOW-EASY-DECLARED', twin: 'goal below easy, no note' },
  'every peak key session restamped to an ultra-specific row': { rule: 'INV-PLAN-PEAK-SPECIFICITY', twin: 'every peak key session restamped to a threshold row' },
  'a renamed goal-pace label ending in a purpose word': { rule: 'INV-PLAN-LABEL-MATCHES-STRUCTURE', twin: 'a renamed goal-pace label ending in the wrong shape word' },
  'every quality session removed (no spaced day)': { rule: 'INV-PLAN-QUALITY-NOT-ZERO', twin: 'every quality session removed (loud)' },
  'every quality session removed (too little volume)': { rule: 'INV-PLAN-TIME-TARGET-QUALITY-FLOOR', twin: 'every quality session removed (loud)' },
  'two peak-level long runs in a row for an eligible runner': { rule: 'INV-PLAN-PEAK-LR-ALTERNATION', twin: 'two peak-level long runs in a row for an ineligible runner' },
  'a foundation week ramping just over the ceiling onto a deload week': { rule: 'INV-PLAN-FOUNDATION-BLOCK', twin: 'a foundation week ramping just over the ceiling onto a normal week' },
  'second-half quality restamped to an effort-governed row off goal pace': { rule: 'INV-PLAN-RACE-SPECIFIC-EXPOSURE', twin: 'second-half quality restamped to a threshold row off goal pace' },
  'second-half quality restamped to a displaced threshold row off goal pace': { rule: 'INV-PLAN-RACE-SPECIFIC-EXPOSURE', twin: 'second-half quality restamped to a threshold row off goal pace' },
  'second-half quality restamped to a CV-anchored row off goal pace': { rule: 'INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO', twin: 'second-half quality restamped to a threshold row off goal pace' },
  'a foundation week with two runs, one of them most of the week': { rule: 'INV-PLAN-FOUNDATION-BLOCK', twin: 'a foundation week with three runs, one of them most of the week' },
  'an onset yield exactly at its bound': { rule: 'INV-PLAN-ONSET-YIELD-BOUNDED', twin: 'an onset yield one week past its bound' },
  'a continuous goal-pace step over the cap in the halfway week itself (5K time goal)': { rule: 'INV-PLAN-GOAL-PACE-SHAPE', twin: 'a continuous goal-pace step over the cap in the week after halfway (5K time goal)' },
}
const SILENT_BY_DESIGN = new Set(Object.keys(SILENT))
const GOAL_CASE = 'rebuilt as time target with no time, plus a quality session'
/** QUALITY-EXPECTED's downgrade exemption, as a PAIR on the same week (code review, batch 17): the unflagged twin must
 *  fire the rule there, and the flagged one must leave both checkers silent there. Taper weeks included. */
const downgradePairs: { label: string; week: number; unflagged: string[]; flagged: { old: string[]; new: string[] } }[] = []
/** Where the race-eve mutation put its over-cap session, so the verifier's day can be checked against it. */
const raceEveDays = new WeakMap<Plan, string>()
/** Rules that make more than one independent check: each detail prefix must fire on its own. */
const ARMS: Record<string, string[]> = {
  'INV-PLAN-GOAL-PACE-REACHABLE': ['a decision with no benchmark', 'not withheld past the line', 'withheld inside the line', 'withheld with no decision record', 'still rehearses goal pace', 'long-run finish off race pace', 'race day opening', 'the gap not named'],
  'INV-PLAN-DISPLAY-ZONE-MATCHES-WORK': ['no zone', 'note names another zone', 'label against the HR target'],
  'INV-PLAN-RACE-WEEK-SHAKEOUT-CAP': ['shakeout over its minutes', 'shakeout over its RPE'],
  'INV-PLAN-VO2MAX-FLOAT-IS-A-CEILING': ['no float step', 'float not a ceiling', 'float not run'],
  // Batches 22-30's multi-arm rules (code review): each arm must fire on its own, so one going quiet is caught.
  'INV-PLAN-COACH-NOTES-MATCH-INTENT': ['time trial lost its instruction', 'aerobic cue', 'goal-paced step called threshold'],
  'INV-PLAN-FOUNDATION-BLOCK': ['forbidden ', 'strides without the readiness gate', 'strides with injury history', 'over the stated-volume ceiling', 'long run over its share', 'ramps over the week-to-week ceiling'],
  'INV-PLAN-LABEL-MATCHES-PACE': ['VO2 label, not VO2 work', 'threshold label, no threshold zone', 'easy label on a quality zone', 'VO2 pace off vVO2max', 'threshold pace off T'],
  'INV-PLAN-EFFORT-GOVERNED-NO-INVENTED-BAND': ['zone ', 'an HR target'],
  'INV-PLAN-VO2MAX-MAIN-SET-CAP': ['over the legacy ceiling', 'outside the work band'],
  'INV-PLAN-RUNWALK-PRESCRIBED': ['interval on a quality session', 'no interval'],
  'INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED': ['a pace target', 'a goal-pace name'],
  'INV-PLAN-DELOAD-PLACEMENT': ['deload opens a phase', 'cadence:'],
  'INV-PLAN-PHASE-STRUCTURE': ['phase returns', 'phases out of order'],
  'INV-PLAN-PREP-TIME-STATUS-ANNOTATED': ['no prep_time_status', 'warned without its warning', 'warned without its alternatives'],
  'INV-PLAN-DIFFICULTY-NEVER-FRONTS-UNSAFE': ['warned plan not very demanding', 'constrained plan reads comfortable', 'shortfall declared'],
  'INV-PLAN-NO-INVENTED-AGE': ['meta age differs', 'meta age with no input age', 'no age and no assumption note'],
  'INV-PLAN-HR-ASSUMPTIONS-SURFACED': ['no hr_zone_method', 'no assumption note for'],
  'INV-PLAN-RECALIBRATION-HAS-SESSION': ['listed week does not exist', 'no time trial'],
  'INV-PLAN-COMPRESSION-CLASSIFICATION': ['no compression_classification', 'class disagrees', 'constrained class reads comfortable'],
  'INV-PLAN-COMPRESSION-SPLIT': ['split flags not both stated', 'compressed is not the OR'],
  'INV-PLAN-SHORT-OPENING-BLOCK-DECLARED': ['stamped short block with no note', 'note with no stamp'],
  'INV-PLAN-NO-PLACEHOLDER-COPY': ['token in', 'placeholder in'],
  'INV-PLAN-REENTRY-NOTE-MATCHES-CAUSE': ['note with no cause', 'coming-back wording'],
  'INV-PLAN-WEEKDAY-OVERRUN-DECLARED': ['over budget, no note', 'note on a run within budget'],
  'INV-PLAN-GOAL-PAST-CV-DECLARED': ['withheld anchor reads comfortable', 'withheld anchor with no note'],
  'INV-PLAN-VDOT-STALENESS-LADDER': ['off the ladder:', 'dateless benchmark off the base rung'],
  'INV-PLAN-LR-SHORTFALL-CAUSE': ['blames volume for an injury cap', 'blames volume at the minute cap'],
  'INV-PLAN-RACE-PACE-LR-BUILD-WINDOW': ['segment long run outside the build window', 'three segment long runs in a row'],
}

const tally = { rows: 0, threw: [] as string[], refused: 0, base: 0, foundation: 0, foundationCapped: 0 }
let runs: { label: string; eve: string | null; extra: string | null; old: { rule: string; k: string }[]; new: { rule: string; k: string; detail: string }[] }[] = []

beforeAll(() => {
  // ONE CLOCK (code review): the engine prices a benchmark at the real clock (§10's staleness ramp) and
  // stamps the level into meta, while the verifier's profile is built at the row's asOf. Without this the
  // comparison drifts as the calendar moves, the GOALPACE-5K-CLOCK-01 class. Date only; timers stay real.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${GOLDEN_AS_OF}T12:00:00`))
  try { build() } finally { vi.useRealTimers() }
}, 120_000)

function build() {
  const cases: { label: string; plan: Plan; input: GeneratorInput; asOf: string; planStart: string; extra?: string; base?: string }[] = []
  for (const row of goldenSample({ perGroup: 8 })) {
    tally.rows++
    let o: ReturnType<typeof runEngine>
    // Under test the engine throws on its own error-severity violations. Counted, never hidden.
    try {
      o = runEngine({ input: row.input, tier: row.tier, displayUnits: 'km', planStart: row.planStart, today: row.asOf })
    } catch { tally.threw.push(row.id); continue }
    if (o.kind !== 'plan') { tally.refused++; continue }
    tally.base++
    if (o.plan.weeks.some(w => w.n <= 0)) {
      tally.foundation++
      if (row.input.day_budgets || row.input.max_weekday_mins != null) tally.foundationCapped++
    }
    cases.push({ label: row.id, plan: o.plan, input: row.input, asOf: row.asOf, planStart: row.planStart })
    for (const m of MUTATIONS) {
      const p = clone(o.plan)
      try { m.apply(p) } catch { continue }
      cases.push({ label: `${row.id} / ${m.name}`, plan: p, input: row.input, asOf: row.asOf, planStart: row.planStart })
    }
    // The NORMALISED goal, on a CONSISTENT plan: rebuild from a time target with no time (the engine plans it
    // as a finish goal), then add one quality session. Mutating the request without rebuilding made the two
    // checkers read different runners, which tested nothing (found 2026-11-21).
    if (row.input.goal === 'time_target' || row.input.target_time) {
      const noTime = { ...row.input, goal: 'time_target' } as GeneratorInput
      delete (noTime as { target_time?: string }).target_time
      try {
        const r = runEngine({ input: noTime, tier: row.tier, displayUnits: 'km', planStart: row.planStart, today: row.asOf })
        if (r.kind === 'plan') {
          const p = clone(r.plan)
          const easy = p.weeks.filter(x => x.n > 0 && governedWeek(x)).flatMap(w => Object.values(w.sessions ?? {}))
            .find(x => x && x.type === 'easy' && !isLongRun(x))
          // The rounding rule on the SAME rebuilt plan: validatePlan's time-target flag is computed from the
          // normalised goal (invariants.ts, one function scope), so both checkers must stay silent here.
          const noted = clone(r.plan)
          noted.meta.volume_constraint_note = `Peak long run 20 km is below the ${20 + GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM / 2} km floor`
          cases.push({ label: `${row.id} / no-time rebuild with a rounding note`, plan: noted, input: noTime, asOf: row.asOf, planStart: row.planStart })
          if (easy) {
            easy.type = 'quality'
            // Only a BEGINNER's ceiling depends on the goal, so only a beginner case proves the goal arm.
            const lvl = buildRunnerProfile(factsFromInput(noTime), { asOf: row.asOf, timezone: null, planStart: row.planStart }).levels.intensity.value
            if (lvl === 'beginner') hits.set(GOAL_CASE, (hits.get(GOAL_CASE) ?? 0) + 1)
            cases.push({ label: `${row.id} / ${GOAL_CASE}`, plan: p, input: noTime, asOf: row.asOf, planStart: row.planStart })
          }
        }
      } catch { /* the engine refusing this variant is not a comparison */ }
    }
    // The downgrade pair: same build/peak/taper week, quality removed, with and without the exemption flag.
    {
      const pick = o.plan.weeks.find(x => (x.phase === 'build' || x.phase === 'peak' || x.phase === 'taper') && x.type !== 'deload'
        && x.type !== 'race' && !x.quality_downgraded && Object.values(x.sessions ?? {}).some(s => s?.type === 'quality'))
      if (pick) {
        const strip = (pl: Plan) => { const w = pl.weeks.find(x => x.n === pick.n)!; for (const s of Object.values(w.sessions ?? {})) if (s?.type === 'quality') s.type = 'easy'; return w }
        const un = clone(o.plan); strip(un)
        const fl = clone(o.plan); strip(fl).quality_downgraded = { trigger: 'readiness_signal', at: '2026-11-16' }
        const prof = buildRunnerProfile(factsFromInput(row.input), { asOf: row.asOf, timezone: null, planStart: row.planStart })
        const at = (xs: { code?: string; rule_id?: string; week: number }[]) => xs.filter(x => (x.code ?? x.rule_id) === 'INV-PLAN-QUALITY-EXPECTED' && x.week === pick.n).map(x => String(x.week))
        try {
          downgradePairs.push({ label: row.id, week: pick.n,
            unflagged: at(validatePlan(un, row.input)),
            flagged: { old: at(validatePlan(fl, row.input)), new: at(verifyPlan(fl, { input: row.input, profile: prof })) } })
        } catch { /* a plan the old checker cannot read is not a comparison */ }
      }
    }
    let baseList: string[] = []
    try { baseList = validatePlan(o.plan, row.input).map(v => key(v.code, v.week, v.day, v.severity)) } catch { baseList = ['<threw>'] }
    for (const m of EXTRA_MUTATIONS) {
      const p = clone(o.plan)
      const input = JSON.parse(JSON.stringify(row.input)) as GeneratorInput
      if (!m.apply(p, input)) continue
      const t = TARGETS[m.name]
      const base = baseList.filter(k => !t || t.some(r => k.startsWith(r + '|'))).sort().join(',')
      cases.push({ label: `${row.id} / ${m.name}`, plan: p, input, asOf: row.asOf, planStart: row.planStart, extra: m.name, base })
    }
  }
  runs = cases.flatMap(c => {
    let old: ReturnType<typeof validatePlan>
    // Only the OLD checker may be excused: a mutation it cannot read is not a comparison. A verifier throw
    // is not caught here, so it fails the file.
    try { old = validatePlan(c.plan, c.input) } catch { return [] }
    // A mutation LANDS only when it changes what the old checker reports for that plan (code review, batch 13):
    // being compared is not enough, since a breakage that reaches no rule is compared too. Breakages built to
    // stay silent at a line (SILENT_BY_DESIGN) land when compared.
    if (c.extra) {
      const t = TARGETS[c.extra]
      const now = old.map(v => key(v.code, v.week, v.day, v.severity)).filter(k => !t || t.some(r => k.startsWith(r + '|'))).sort().join(',')
      if (SILENT_BY_DESIGN.has(c.extra) || now !== c.base) hits.set(c.extra, (hits.get(c.extra) ?? 0) + 1)
    }
    return [{ label: c.label,
      old: old.map(v => ({ rule: v.code, k: key(v.code, v.week, v.day, v.severity) })),
      eve: raceEveDays.get(c.plan) ?? null,
      extra: c.extra ?? null,
      new: verifyPlan(c.plan, { input: c.input, profile: buildRunnerProfile(factsFromInput(c.input), { asOf: c.asOf, timezone: null, planStart: c.planStart }) }).map(f => ({ rule: f.rule_id as string, k: key(f.rule_id, f.week, f.day, f.severity), detail: f.detail })) }]
  })
}

/** Rules where `validatePlan` names no day but the verifier does. The same finding at finer grain: compared
 *  without the day, and listed so the exemption is a decision, not a drift. */
const OLD_OMITS_DAY = new Set<string>([
  'INV-PLAN-NO-RACE-EVE-SESSION',   // the old push carries week only; the verifier names the offending day
])
const dropDay = (k: string) => k.replace(/^([^|]+\|[^|]+)\|[^|]+\|/, '$1|-|')

function compare(rule: string) {
  const fired = { old: 0, new: 0 }
  const diffs: string[] = []
  for (const c of runs) {
    const oldKeys = c.old.filter(x => x.rule === rule).map(x => x.k)
    const newKeys = c.new.filter(x => x.rule === rule).map(x => (OLD_OMITS_DAY.has(rule) ? dropDay(x.k) : x.k))
    fired.old += oldKeys.length; fired.new += newKeys.length
    const a = [...oldKeys].sort().join(','), b = [...newKeys].sort().join(',')
    if (a !== b) diffs.push(`${c.label}: old [${a}] new [${b}]`)
  }
  return { fired, diffs }
}

describe('ADR027-B3-VERIFIER — agreement with validatePlan, per ported rule', () => {
  it('the corpus produced enough REAL plans to compare, and every row is accounted for', () => {
    // Measured 2026-11-21: perGroup 2 gave 8 plans and NONE with foundation weeks, so the foundation rules
    // were compared on broken plans only. perGroup 8 gives 37 plans, 5 with foundation weeks. The floors are
    // on BASE plans, because ~100 mutations of a single plan would satisfy a floor on total cases.
    expect(tally.base, `rows ${tally.rows}, refused ${tally.refused}, threw ${tally.threw.length}`).toBeGreaterThanOrEqual(30)
    expect(tally.foundation, 'valid plans with foundation weeks, which the foundation rules need').toBeGreaterThanOrEqual(3)
    // FOUNDATION-WEEKDAY-WITHIN-BUDGET runs only when the input carries a weekday limit (code review).
    expect(tally.foundationCapped, 'foundation plans whose input has a weekday limit').toBeGreaterThanOrEqual(2)
  })

  it('🔴 every extra mutation changed what the old checker reports, in at least one plan', () => {
    expect(EXTRA_MUTATIONS.filter(m => !(hits.get(m.name) ?? 0)).map(m => m.name)).toEqual([])
    expect(hits.get(GOAL_CASE) ?? 0, GOAL_CASE).toBeGreaterThan(0)
    expect(tally.base + tally.refused + tally.threw.length).toBe(tally.rows)
    expect(tally.threw.length, tally.threw.slice(0, 3).join(', ')).toBeLessThanOrEqual(Math.ceil(tally.rows / 10))
  })

  it('the day exemption is used only where the old checker really omits the day', () => {
    for (const rule of Array.from(OLD_OMITS_DAY)) {
      const old = runs.flatMap(c => c.old.filter(x => x.rule === rule))
      expect(old.length, `${rule} never fired, so its exemption is unproven`).toBeGreaterThan(0)
      expect(old.every(x => x.k.split('|')[2] === '-'), `${rule}: the old checker names a day after all`).toBe(true)
    }
  })

  it('🔴 the race-eve finding names the day the over-cap session is on, not just the week', () => {
    let checked = 0
    for (const c of runs) {
      if (!c.eve) continue
      const [wk, day] = c.eve.split('|')
      const found = c.new.filter(x => x.rule === 'INV-PLAN-NO-RACE-EVE-SESSION' && x.k.startsWith(`INV-PLAN-NO-RACE-EVE-SESSION|${wk}|`))
      expect(found.map(x => x.k.split('|')[2]), c.label).toContain(day)
      checked++
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('🔴 every arm of a multi-check rule fires on its own', () => {
    for (const [rule, prefixes] of Object.entries(ARMS)) {
      if (!(PORTED_RULES as string[]).includes(rule)) continue
      for (const pre of prefixes) {
        const n = runs.reduce((t, c) => t + c.new.filter(x => x.rule === rule && x.detail.startsWith(pre)).length, 0)
        expect(n, `${rule}: "${pre}" never fires`).toBeGreaterThan(0)
      }
    }
  })

  it('STATIC_RULES are static by the liveness harness\'s own register, and none fires on a plan', async () => {
    const { readFileSync } = await import('node:fs')
    const reg = JSON.parse(readFileSync('lib/plan/__fixtures__/invariantLivenessBaseline.json', 'utf8')) as { unproven: Record<string, string> }
    for (const r of Array.from(STATIC_RULES)) {
      expect(reg.unproven[r], `${r} is not 'static' in invariantLivenessBaseline.json`).toBe('static')
      expect(compare(r).fired.old, `${r} fired on a plan, so it is not static`).toBe(0)
    }
  })

  it('🔴 QUALITY-EXPECTED\'s downgrade exemption: the unflagged twin fires, the flagged week is silent in BOTH checkers', () => {
    const meaningful = downgradePairs.filter(p => p.unflagged.length > 0)
    expect(meaningful.length, 'no pair where the rule would have fired, so the exemption is untested').toBeGreaterThan(0)
    for (const p of meaningful) expect({ old: p.flagged.old, new: p.flagged.new }, `${p.label} week ${p.week}`).toEqual({ old: [], new: [] })
  })

  it('🔴 every silent-by-design breakage is silent on its rule in BOTH checkers, and its loud twin fires that rule', () => {
    const bad: string[] = []
    for (const [name, { rule, twin }] of Object.entries(SILENT)) {
      for (const c of runs.filter(r => r.extra === name)) {
        if (c.old.some(x => x.rule === rule) || c.new.some(x => x.rule === rule)) bad.push(`${name}: ${rule} fired on ${c.label}`)
      }
      if (!runs.some(r => r.extra === twin && r.old.some(x => x.rule === rule))) bad.push(`${name}: its twin "${twin}" never fired ${rule}`)
    }
    expect(bad).toEqual([])
  })

  it('🔴 no rule with a conditional severity is ported before its condition is a predicate', () => {
    // A conditional rule may be ported only once its condition is IN the predicate (it sets `severity`), named here
    // with the condition, and the agreement key includes severity so the condition is compared.
    const conditional = new Set(RULES.filter(r => r.severity_note).map(r => r.id))
    expect(PORTED_RULES.filter(r => conditional.has(r) && !CONDITIONAL_PORTED[r])).toEqual([])
    const bad: string[] = []
    for (const [r, { branches }] of Object.entries(CONDITIONAL_PORTED)) {
      if (!(PORTED_RULES as string[]).includes(r) || !conditional.has(r)) bad.push(`${r}: stale entry (not ported, or not conditional)`)
      for (const sev of branches) if (!runs.some(c => c.new.some(x => x.rule === r && x.k.endsWith(`|${sev}`)))) bad.push(`${r}: never produced ${sev}`)
    }
    expect(bad).toEqual([])
  })

  for (const rule of PORTED_RULES) {
    it(`🔴 ${rule}: same findings and severity on every valid and broken plan, and it fires`, () => {
      const { fired, diffs } = compare(rule)
      expect(diffs.slice(0, 5), `${diffs.length} disagreements`).toEqual([])
      // A STATIC rule reads rule data, not the plan, so no plan breakage can wake it (the liveness harness's class).
      if (!STATIC_RULES.has(rule)) expect(fired.old, 'nothing in the battery wakes this rule, so agreement proves nothing').toBeGreaterThan(0)
    })
  }
})
