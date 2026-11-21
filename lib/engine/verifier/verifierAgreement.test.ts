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
import { isLongRun, isStructuredSession, isTimeTrial, isVo2maxSession, isQualitySession } from '@/lib/plan/sessionRole'
import { V1_SESSION_CATALOGUE } from '@/lib/plan/sessionCatalogueData'
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
    // Batch 19.
    ['every main-week easy run turned into quality', (p: Plan) => {
      let n = 0
      for (const w of p.weeks.filter(x => x.n >= 1)) for (const s of Object.values(w.sessions ?? {})) if (s?.type === 'easy' && !isLongRun(s)) { s.type = 'quality'; n++ }
      p.meta.volume_profile = 'build'; return n > 0
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
  'run-walk with a volume-capped injury stamped': ['INV-PLAN-RUNWALK-CAP-NOT-REDUCED'],
  'a volume-blaming shortfall note on an injury-capped plan': ['INV-PLAN-LR-SHORTFALL-CAUSE'],
  'a volume-blaming shortfall note with the long run at its minute cap': ['INV-PLAN-LR-SHORTFALL-CAUSE'],
  'a race-pace long run one point past the segment band': ['INV-PLAN-LR-RACE-SEGMENT-PCT'],
}
/** Rules that read only module data (the catalogue, the signatures), never the plan. */
const STATIC_RULES = new Set<string>(['INV-PLAN-PHASE-FOCUS-REACHABLE'])
const hits = new Map<string, number>()
/** Breakages that sit exactly where a rule must STAY silent, so they change nothing the old checker reports. */
const SILENT: Record<string, { rule: string; twin: string }> = {
  // each: the rule it must leave silent in BOTH checkers, and a loud twin breakage that does fire that rule
  'a gated short-distance on-ramp exactly at its (lower) floor': { rule: 'INV-PLAN-ONRAMP-FLOOR', twin: 'on-ramp one week under the floor' },
  'early onset for a beginner who declared experienced': { rule: 'INV-PLAN-EARLY-ONSET-GATED', twin: 'early onset for an otherwise-ready beginner' },
  'a long-run note whose floor is BELOW its peak (no miss)': { rule: 'INV-PLAN-LR-FLOOR-NOT-ROUNDING', twin: 'a long-run floor miss half a rounding step, declared' },
  're-entry WITH a VO2 session, note removed': { rule: 'INV-PLAN-REENTRY-OMISSION-DECLARED', twin: 're-entry with no VO2 and no note' },
  'goal below easy, WITH its note': { rule: 'INV-PLAN-GOAL-BELOW-EASY-DECLARED', twin: 'goal below easy, no note' },
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
    const conditional = new Set(RULES.filter(r => r.severity_note).map(r => r.id))
    expect(PORTED_RULES.filter(r => conditional.has(r))).toEqual([])
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
