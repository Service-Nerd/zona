/**
 * Race-plan predicates — the delivered plan, read as a coach would (final plan read, causes 1 and 2:
 * rules enforced on an internal target, the delivered plan reshaped afterwards).
 *
 * Ported from the read's scratch batteries (`planread/{5k10k,hm,mar}/measure.ts`). Where two slices
 * measured the same objection with different thresholds, ONE predicate owns it here and its
 * threshold is the stricter slice's; the variants that were exploratory are not ported.
 */
import { GENERATION_CONFIG as G } from '@/lib/plan/generationConfig'
import { hasInjuryKeyword } from '@/lib/plan/injuryScope'
import { isLongRun, isQualitySession, isTimeTrial } from '@/lib/plan/sessionRole'
import {
  blockedDays, isDeloadWeek, isWeekend, km, loadingWeeks, longRunKm, longRunOf, metaFlag, peakLongRunKm,
  peakWeekKm, raceWeek, raceWeekIndex, runsOf, timeTrials, trainingWeeks,
} from '../metrics'
import type { PlanPredicate } from '../types'
import type { Plan, Week } from '@/types/plan'

const isMarathon = (d: number) => d >= 42 && d < 43
const isHalfOrLonger = (d: number) => d >= 21
/** Consecutive training-week pairs (prev, this) in week order. */
const pairs = (p: Plan): [Week, Week][] => {
  const t = trainingWeeks(p).sort((a, b) => a.n - b.n)
  return t.slice(1).map((w, k) => [t[k], w])
}
const firstTaper = (p: Plan) => trainingWeeks(p).filter(w => w.phase === 'taper').sort((a, b) => a.n - b.n)[0]
const nonTaperPeakLR = (p: Plan) => Math.max(0, ...trainingWeeks(p).filter(w => w.phase !== 'taper').map(longRunKm))

export const RACE_PLAN: PlanPredicate[] = [
  // ── Deloads (§3, §90) ───────────────────────────────────────────────────────
  {
    id: 'DELOAD-NOT-A-REDUCTION', section: '§3, §90', cls: 'NEW', source: 'read: 5K/10K, HM',
    description: 'A deload week carries more weekly km than the week before it',
    test: p => {
      const x = pairs(p).find(([a, b]) => isDeloadWeek(b) && !isDeloadWeek(a) && b.weekly_km > a.weekly_km + 0.5)
      return x ? `W${x[1].n} ${x[1].weekly_km} > W${x[0].n} ${x[0].weekly_km}` : null
    },
  },
  {
    id: 'DELOAD-SHALLOW', section: '§3', cls: 'NEW', source: 'read: HM (~1,060), marathon',
    description: 'A deload week cuts less than 10% from the loading week before it',
    test: p => {
      const x = pairs(p).find(([a, b]) => isDeloadWeek(b) && !isDeloadWeek(a) && b.weekly_km >= 0.9 * a.weekly_km && b.weekly_km <= a.weekly_km)
      return x ? `W${x[1].n} ${x[1].weekly_km} vs W${x[0].n} ${x[0].weekly_km}` : null
    },
  },
  {
    id: 'DELOAD-HARDER-THAN-PRIOR', section: '§3', cls: 'NEW', source: 'read: HM, marathon',
    description: 'A deload week holds a time trial and a long run at least as long as the week before, or places more runs',
    test: p => {
      for (const [a, b] of pairs(p)) {
        if (!isDeloadWeek(b) || isDeloadWeek(a)) continue
        const tt = runsOf(b).some(r => isTimeTrial(r.s))
        if (tt && longRunKm(a) > 0 && longRunKm(b) >= longRunKm(a)) return `W${b.n} TT + long run ${longRunKm(b)} ≥ ${longRunKm(a)}`
        if (runsOf(b).length > runsOf(a).length) return `W${b.n} ${runsOf(b).length} runs > ${runsOf(a).length}`
      }
      return null
    },
  },
  // ── Curve (§2, §94) ─────────────────────────────────────────────────────────
  {
    id: 'LOADING-WEEK-JUMP-30', section: '§2, §94', cls: 'NEW', source: 'read: 5K/10K',
    description: 'A loading week more than 30% above the loading week immediately before it',
    test: p => {
      const t = loadingWeeks(p).sort((a, b) => a.n - b.n)
      const k = t.findIndex((w, j) => j > 0 && w.n === t[j - 1].n + 1 && t[j - 1].weekly_km > 0 && w.weekly_km > 1.3 * t[j - 1].weekly_km)
      return k > 0 ? `W${t[k - 1].n} ${t[k - 1].weekly_km} → W${t[k].n} ${t[k].weekly_km}` : null
    },
  },
  {
    id: 'LONG-RUN-STEP-OVER-5KM', section: '§45', cls: 'NEW', source: 'read: marathon',
    description: 'The long run rises by more than 5 km between two consecutive non-deload weeks',
    test: p => {
      const x = pairs(p).find(([a, b]) => !isDeloadWeek(a) && !isDeloadWeek(b) && longRunKm(a) > 0 && longRunKm(b) - longRunKm(a) > 5.01)
      return x ? `W${x[0].n} ${longRunKm(x[0])} → W${x[1].n} ${longRunKm(x[1])}` : null
    },
  },
  // ── Taper and race week (§6, §39) ───────────────────────────────────────────
  {
    id: 'TAPER-FIRST-WEEK-KM-AT-PEAK', section: '§6', cls: 'NEW', source: 'read: 5K/10K (888)',
    description: 'The first taper week carries at least the weekly km of the last peak loading week',
    test: p => {
      const t = trainingWeeks(p)
      const tw = firstTaper(p)
      const lp = [...t].sort((a, b) => b.n - a.n).find(w => w.phase === 'peak' && !isDeloadWeek(w))
      return tw && lp && tw.weekly_km >= lp.weekly_km ? `taper W${tw.n} ${tw.weekly_km} ≥ peak W${lp.n} ${lp.weekly_km}` : null
    },
  },
  {
    id: 'TAPER-FIRST-WEEK-LR-AT-PEAK', section: '§6', cls: 'NEW', source: 'read: HM (peak-length long run 7 days out), marathon',
    description: 'The first taper week holds the long run at the plan\'s peak long run',
    test: (p, i) => {
      const tw = firstTaper(p); const peak = nonTaperPeakLR(p)
      if (!tw || !isHalfOrLonger(i.race_distance_km) || peak <= 0) return null
      return longRunKm(tw) >= peak - 0.05 ? `taper W${tw.n} long run ${longRunKm(tw)} vs peak ${peak}` : null
    },
  },
  {
    id: 'RACE-WEEK-S39-ON-FINISH-GOAL', section: '§39', cls: 'NEW', source: 'read: HM',
    description: 'A finish-goal HM/marathon plan carries §39\'s race-week easy run, which §39 scopes to time targets',
    test: (p, i) => {
      if (i.goal !== 'finish' || !isHalfOrLonger(i.race_distance_km)) return null
      const rw = raceWeek(p)
      return rw && runsOf(rw).some(r => r.s.label === 'Race-week easy') ? 'Race-week easy present' : null
    },
  },
  {
    id: 'RACE-WEEK-EASY-LONGER-THAN-TAPER', section: '§39, §6', cls: 'NEW', source: 'read: HM',
    description: 'The race-week easy run is longer than every weekday run of the week before',
    test: p => {
      const ri = raceWeekIndex(p); if (ri < 1) return null
      const s = runsOf(p.weeks[ri]).find(r => r.s.label === 'Race-week easy'); if (!s) return null
      const pen = Math.max(0, ...runsOf(p.weeks[ri - 1]).filter(r => !isLongRun(r.s)).map(r => r.s.duration_mins ?? 0))
      return (s.s.duration_mins ?? 0) > pen ? `${s.s.duration_mins} min > ${pen} min` : null
    },
  },
  // ── Sessions (§9, §12, §18, §22, §78, §117) ────────────────────────────────
  {
    id: 'EASY-RUN-150-MIN', section: '§9', cls: 'NEW', source: 'read: marathon / ultra',
    description: 'A non-long easy run of 150 minutes or more',
    test: p => {
      for (const w of loadingWeeks(p)) for (const r of runsOf(w))
        if (r.s.type === 'easy' && !isLongRun(r.s) && (r.s.duration_mins ?? 0) >= 150) return `W${w.n} ${r.day} ${r.s.duration_mins} min`
      return null
    },
  },
  {
    id: 'QUALITY-LONGER-THAN-LONG-RUN', section: '§9', cls: 'NEW', source: 'read: 5K/10K, HM',
    description: 'A quality session longer than the same loading week\'s long run',
    test: p => {
      for (const w of loadingWeeks(p)) {
        const lr = longRunOf(w); if (!lr) continue
        const q = runsOf(w).find(r => isQualitySession(r.s) && km(r.s) > km(lr) + 0.25)
        if (q) return `W${w.n} ${q.s.catalogue_id ?? q.s.label} ${km(q.s).toFixed(1)} > ${km(lr).toFixed(1)}`
      }
      return null
    },
  },
  {
    id: 'QUALITY-SHARE-35', section: '§22', cls: 'NEW', source: 'read: HM (goal-pace dose up to 46% of a week)',
    description: 'One quality session is more than 35% of a build or peak week',
    test: p => {
      for (const w of trainingWeeks(p)) {
        if (!['build', 'peak'].includes(w.phase ?? '') || w.weekly_km <= 0) continue
        const q = runsOf(w).find(r => isQualitySession(r.s) && km(r.s) / w.weekly_km > 0.35)
        if (q) return `W${w.n} ${km(q.s).toFixed(1)}/${w.weekly_km}`
      }
      return null
    },
  },
  {
    id: 'RUN-ON-BLOCKED-DAY', section: '§18', cls: 'NEW', source: 'read: 5K/10K, base-build',
    description: 'A run placed on a day the runner said they cannot train',
    test: (p, i) => {
      const b = blockedDays(i); if (!b.size) return null
      for (const w of p.weeks) for (const r of runsOf(w)) if (b.has(r.day) && r.s.type !== 'race') return `W${w.n} ${r.day}`
      return null
    },
    kinds: ['race', 'base_build'],
  },
  {
    id: 'RUNS-EXCEED-DAYS', section: '§18, §64', cls: 'NEW', source: 'read: 5K/10K, base-build',
    description: 'A week places more runs than the runner\'s days available',
    test: (p, i) => {
      const w = p.weeks.find(x => runsOf(x).length > i.days_available)
      return w ? `W${w.n} ${runsOf(w).length} runs > ${i.days_available} days` : null
    },
    kinds: ['race', 'base_build'],
  },
  {
    // §81/§82 license some weekday overruns (structured sessions, the easy-run floor) on condition the
    // plan SAYS so; the objection is the silent one, so a session carrying its overrun note passes.
    id: 'WEEKDAY-OVERRUN-UNDECLARED', section: '§81, §82', cls: 'NEW', source: 'read: 5K/10K',
    description: 'A weekday run more than 5% over the runner\'s weekday cap that carries no overrun note',
    test: (p, i) => {
      const cap = i.max_weekday_mins; if (!cap) return null
      for (const w of trainingWeeks(p)) for (const r of runsOf(w))
        if (!isWeekend(r.day) && (r.s.duration_mins ?? 0) > cap * 1.05 && !r.s.weekday_overrun_note) return `W${w.n} ${r.day} ${r.s.duration_mins} > ${cap}`
      return null
    },
  },
  {
    id: 'TT-BEFORE-QUALITY-INJURED', section: '§78, §21', cls: 'NEW', source: 'read: base-build/foundation (588)',
    description: 'A runner with a tendon, knee or shin history meets a maximal time trial before their first quality session',
    test: (p, i) => {
      if (!['achilles', 'plantar', 'shin', 'knee', 'calf'].some(k => hasInjuryKeyword(i.injury_history, k))) return null
      const tts = timeTrials(p).map(x => x.w.n).filter(n => n >= 1)
      const firstQ = Math.min(Infinity, ...p.weeks.filter(w => w.n >= 1 && runsOf(w).some(r => isQualitySession(r.s))).map(w => w.n))
      return tts.length && Math.min(...tts) < firstQ ? `TT W${Math.min(...tts)}, first quality W${firstQ}` : null
    },
  },
  {
    id: 'RUN-WALK-ON-QUALITY', section: '§117 Am. 9', cls: 'NEW', source: 'read: marathon (hotfix 1)',
    description: 'A quality session carries a run-walk interval',
    test: p => {
      for (const w of p.weeks) for (const r of runsOf(w)) if (r.s.run_walk_strategy && isQualitySession(r.s)) return `W${w.n} ${r.s.label}`
      return null
    },
  },
  {
    id: 'MAX-LONG-RUN-BELOW-DECLARED', section: '§106, §113', cls: 'NEW', source: 'read: marathon',
    description: 'A healthy runner\'s longest planned long run is below the longest run they already run',
    test: (p, i) => {
      if ((i.injury_history ?? []).length) return null
      const mx = Math.max(0, ...trainingWeeks(p).map(longRunKm))
      return mx > 0 && mx < (i.longest_recent_run_km ?? 0) - 0.5 ? `max ${mx} < declared ${i.longest_recent_run_km}` : null
    },
  },
  // ── Triage FIX classes (objection triage 2026-11-20) ───────────────────────
  {
    id: 'FIX-PEAK-CUT-UNCONSTRAINED', section: '§106', cls: 'FIX', source: 'triage row 4 (engine placement)',
    description: 'The peak week is below 95% of current volume and none of the runner\'s own constraints (weekday cap, ≤ 4 days, injury, fresh return) applies',
    test: (p, i) => {
      if (i.max_weekday_mins || i.days_available <= 4 || (i.injury_history ?? []).length || i.weeks_at_current_volume !== undefined) return null
      return i.current_weekly_km > 0 && peakWeekKm(p) < 0.95 * i.current_weekly_km ? `peak ${peakWeekKm(p)} vs current ${i.current_weekly_km}` : null
    },
  },
  {
    id: 'FIX-RUNWALK-LONG-RUN-BELOW-17', section: '§117 Am. 2', cls: 'FIX', source: 'triage row 7',
    description: 'A run-walk-prescribed marathon whose peak long run is under the 17 km bound',
    test: (p, i) => isMarathon(i.race_distance_km) && metaFlag(p, 'run_walk_prescribed') && peakLongRunKm(p) > 0 && peakLongRunKm(p) < 17
      ? `peak long run ${peakLongRunKm(p)}` : null,
  },
  {
    id: 'FIX-LONG-RUN-SHORT-NO-RUNWALK', section: '§117 Am. 3, Am. 5', cls: 'FIX', source: 'triage row 8',
    description: 'A marathon whose peak long run is below the 55% bar, with sessions not carrying the run-walk interval',
    test: (p, i) => {
      if (!isMarathon(i.race_distance_km)) return null
      const pk = peakLongRunKm(p)
      if (pk <= 0 || pk >= i.race_distance_km * 0.55 - G.DISTANCE_ROUNDING_PRECISION_KM) return null
      const runs = trainingWeeks(p).flatMap(w => runsOf(w))
      return runs.some(r => !r.s.run_walk_strategy) ? `peak long run ${pk}` : null
    },
  },
]
