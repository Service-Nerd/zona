/**
 * NOTE-TRUTH — a note may not claim something false about its own plan.
 *
 * Final plan read, cause 3: "about a third of the new classes are a note that is false about its
 * own plan", because notes are written by fallback chains reading different facts from the
 * sessions. Each predicate below reads the sentence AND the plan's own fields, and fires when the
 * plan contradicts the sentence. ⚠️ They match the stored wording, so a copy change can silence one
 * without the plan changing; the scorecard's ratchet then reads it as a fall. That is a
 * definition move, never an improvement (coaching-measurement.md § 2).
 */
import { GENERATION_CONFIG as G } from '@/lib/plan/generationConfig'
import { isLongRun, isTimeTrial } from '@/lib/plan/sessionRole'
import {
  loadingWeeks, longRunKm, metaFlag, metaNote, metaNotes, peakLongRunKm, peakWeekKm, qualityCount,
  runsOf, sessionNotes, timeTrials, trainingWeeks, km,
} from '../metrics'
import type { PlanPredicate } from '../types'

const hasHard = (p: Parameters<PlanPredicate['test']>[0]) => qualityCount(p) > 0 || timeTrials(p).length > 0

export const NOTE_TRUTH: PlanPredicate[] = [
  {
    id: 'NT-NO-HARD-SESSIONS-FALSE', section: '§41', cls: 'NOTE-TRUTH', source: 'read: marathon, 5K/10K',
    description: '"This plan has no hard sessions" on a plan that carries a quality session or a time trial',
    test: p => /has no hard sessions/.test(metaNote(p, 'hard_pref_note')) && hasHard(p)
      ? `${qualityCount(p)} quality, ${timeTrials(p).length} TT` : null,
  },
  {
    id: 'NT-GAINS-FROM-QUALITY-NONE', section: '§34', cls: 'NOTE-TRUTH', source: 'read: 5K/10K (2,560)',
    description: '"Gains here come from the quality sessions" on a plan with no quality session',
    test: p => /gains here come from the quality sessions/i.test(metaNotes(p)) && qualityCount(p) === 0 ? '0 quality sessions' : null,
  },
  {
    id: 'NT-HOLDS-BUT-CUTS', section: '§106', cls: 'NOTE-TRUTH', source: 'read: 5K/10K (504), HM',
    description: '"Holds your fitness" on a plan whose peak week is below 95% of the runner\'s current volume',
    test: (p, i) => /holds your fitness/i.test(metaNotes(p)) && i.current_weekly_km > 0 && peakWeekKm(p) < 0.95 * i.current_weekly_km
      ? `peak ${peakWeekKm(p)} vs current ${i.current_weekly_km}` : null,
  },
  {
    id: 'NT-AT-CEILING-BUT-CUTS', section: '§106, §23', cls: 'NOTE-TRUTH', source: 'triage rows 2 and 5 (FIX the note)',
    description: '"Already where this distance wants it" on a plan whose peak week is below the runner\'s current volume',
    test: (p, i) => /already where this distance wants it/.test(metaNote(p, 'volume_constraint_note')) && peakWeekKm(p) < i.current_weekly_km
      ? `peak ${peakWeekKm(p)} vs current ${i.current_weekly_km}` : null,
  },
  {
    id: 'NT-SAYS-NOT-BUILD-BUT-BUILDS', section: '§38', cls: 'NOTE-TRUTH', source: 'read: marathon',
    description: 'The volume note says the plan is "not to build you up" and the peak is 25%+ above week 1',
    test: p => {
      const w1 = trainingWeeks(p).find(w => w.n === 1)?.weekly_km ?? 0
      return /not to build you up/.test(metaNote(p, 'volume_constraint_note')) && w1 > 0 && peakWeekKm(p) / w1 >= 1.25
        ? `week 1 ${w1} → peak ${peakWeekKm(p)}` : null
    },
  },
  {
    id: 'NT-NOT-CHASE-WITH-GOAL-PACE', section: '§22', cls: 'NOTE-TRUTH', source: 'read: marathon, HM',
    description: 'A note says the plan is "not to chase a time" while the plan prescribes goal-pace work',
    test: p => /not to chase a time/.test(metaNotes(p))
      && p.weeks.some(w => runsOf(w).some(r => r.s.stimulus === 'race_pace' || !!r.s.lr_segment_pace))
      ? 'goal-pace work present' : null,
  },
  {
    id: 'NT-FREQUENCY-UNDERSTATES-W1', section: '§18 Am.', cls: 'NOTE-TRUTH', source: 'read: marathon',
    description: 'The frequency note says week 1 uses N runs and week 1 places more',
    test: p => {
      const m = /uses (\d+), building to (\d+)/.exec(metaNote(p, 'frequency_constraint_note'))
      const w1 = trainingWeeks(p).find(w => w.n === 1)
      return m && w1 && runsOf(w1).length > Number(m[1]) ? `note ${m[1]}, week 1 ${runsOf(w1).length}` : null
    },
  },
  {
    id: 'NT-PACE-NOTES-CONTRADICT', section: '§120, §34', cls: 'NOTE-TRUTH', source: 'read: marathon, 5K/10K',
    description: 'The goal-below-easy note and a "quicker than your current fitness supports" difficulty note on one plan',
    test: p => metaNote(p, 'goal_below_easy_ceiling_note') && /quicker than your current fitness supports/.test(metaNote(p, 'difficulty_note'))
      ? 'both notes present' : null,
  },
  {
    id: 'NT-BENCHMARK-NOTE-WITHOUT-BENCHMARK', section: '§34', cls: 'NOTE-TRUTH', source: 'read: 5K/10K',
    description: 'A note refers to "your benchmark" on a plan built without one',
    test: (p, i) => !i.benchmark && /your benchmark/i.test(metaNotes(p) + sessionNotes(p)) ? 'no benchmark in input' : null,
  },
  {
    id: 'NT-FIRST-SESSION-NOTE-AFTER-W1', section: '§50', cls: 'NOTE-TRUTH', source: 'read: marathon, 5K/10K',
    description: '"Run the first session by feel" on a session after week 1',
    test: p => p.weeks.some(w => w.n > 1 && runsOf(w).some(r => (r.s.coach_notes ?? []).some(n => /Run the first session by feel/.test(n ?? ''))))
      ? 'after week 1' : null,
  },
  {
    id: 'NT-WALK-BREAKS-ABOVE-BAR', section: '§117 Am. 3', cls: 'NOTE-TRUTH', source: 'read: marathon',
    description: 'The long-run shortfall note advises walk breaks on a plan not prescribed to walk whose long run reaches the 55% bar',
    test: (p, i) => /walk breaks/.test(metaNote(p, 'long_run_shortfall_note')) && !metaFlag(p, 'run_walk_prescribed')
      && peakLongRunKm(p) >= i.race_distance_km * 0.55 - G.DISTANCE_ROUNDING_PRECISION_KM
      ? `peak long run ${peakLongRunKm(p)}` : null,
  },
  {
    id: 'NT-DIFFICULTY-WEEKS-WRONG', section: '§44', cls: 'NOTE-TRUTH', source: 'read: HM (prep-weeks off by one), marathon',
    description: 'The difficulty note states a number of weeks that is not the plan\'s',
    test: p => {
      const m = /on (\d+) weeks/.exec(metaNote(p, 'difficulty_note'))
      const n = p.weeks.filter(w => w.n > 0).length
      return m && Number(m[1]) !== n ? `note ${m[1]}, plan ${n}` : null
    },
  },
  {
    id: 'NT-TWO-SHORTFALL-CAUSES', section: '§80 Am. 1', cls: 'NOTE-TRUTH', source: 'read: HM (duplicate and contradictory notes)',
    description: 'A volume shortfall note and a peak shortfall note both present, each naming its own cause',
    test: p => metaNote(p, 'volume_shortfall_note') && metaNote(p, 'peak_shortfall_note') ? 'both present' : null,
  },
  {
    id: 'NT-RETURNING-WRONG-CAUSE', section: '§51, §29', cls: 'NOTE-TRUTH', source: 'read: base-build/foundation (246), HM',
    description: '"Coming back from a break" when week 1 sits well under 70% of current volume for another reason',
    test: (p, i) => {
      if (!/coming back from a break/.test(metaNote(p, 'returning_runner_note'))) return null
      const w1 = p.weeks.find(w => w.n === 1)?.weekly_km ?? 0
      return w1 < 0.7 * i.current_weekly_km - 1.5 ? `week 1 ${w1} vs current ${i.current_weekly_km}` : null
    },
  },
  {
    id: 'NT-TUNE-UP-BESIDE-TT', section: '§32, §78', cls: 'NOTE-TRUTH', source: 'read: 5K/10K (3,312)',
    description: 'A tune-up race callout in a week next to a time trial',
    test: p => p.weeks.some((w, k) => !!w.tune_up_callout
      && [p.weeks[k - 1], w, p.weeks[k + 1]].some(x => x && runsOf(x).some(r => isTimeTrial(r.s)))) ? 'tune-up beside TT' : null,
  },
  {
    id: 'NT-ZONE-LABEL-NO-ZONES', section: '§14', cls: 'NOTE-TRUTH', source: 'read: HM',
    description: 'A session label names a zone ("Zone 2") on a plan that carries no HR target anywhere',
    test: p => {
      const all = p.weeks.flatMap(w => runsOf(w))
      if (all.some(r => r.s.hr_target)) return null
      const n = all.filter(r => /Zone \d/.test(r.s.label ?? '')).length
      return n ? `${n} labels` : null
    },
  },
  {
    id: 'NT-TAPER-UNDECLARED', section: '§6, §34', cls: 'NOTE-TRUTH', source: 'read: 5K/10K (888)',
    description: 'The first taper week is at 95%+ of the peak week and no note mentions the taper',
    test: p => {
      const tw = trainingWeeks(p).find(w => w.phase === 'taper')
      return tw && (tw.weekly_km ?? 0) >= 0.95 * peakWeekKm(p) && peakWeekKm(p) > 0 && !/taper/i.test(metaNotes(p))
        ? `taper W${tw.n} ${tw.weekly_km} vs peak ${peakWeekKm(p)}` : null
    },
  },
  {
    id: 'NT-LOPSIDED-UNDECLARED', section: '§52, §34, §80 Am. 1', cls: 'FIX', source: 'triage row 10 (BINGE undeclared)',
    description: 'A loading week whose long run is over 60% of the week, and the lopsided-week fact is written nowhere',
    test: p => {
      if (/most of the week/.test(metaNotes(p))) return null
      const w = loadingWeeks(p).find(x => {
        const tot = runsOf(x).reduce((a, r) => a + km(r.s), 0)
        return tot > 0 && runsOf(x).some(r => isLongRun(r.s) && km(r.s) > 0.6 * tot)
      })
      return w ? `W${w.n} long run ${longRunKm(w)}` : null
    },
  },
]
