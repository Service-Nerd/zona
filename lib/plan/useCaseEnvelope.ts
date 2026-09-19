/**
 * USE-CASE ENVELOPE — what "fit for purpose for 90–95% of use cases" MEANS,
 * written down once so it can be argued with.
 *
 * ⚠️ READ THIS FIRST: EVERY WEIGHT BELOW IS AN ASSUMPTION, NOT A MEASUREMENT.
 * Zonna has no adherence, dropout or demographic data — one analytics event
 * exists in the whole product and no charity code has ever been redeemed. The
 * SLT has already refused once to size a build on an invented number
 * (`S111-SUBFLOOR-VOLUME-01`), and this module must not become a back door for
 * doing that. Its job is the opposite: to make the assumption a SINGLE, NAMED,
 * REVIEWABLE object instead of an unstated one smuggled into a grid.
 *
 * WHY IT EXISTS. Five harnesses measure the engine and none of them weights by
 * how likely an input is. `cohortGrid` is exhaustive and un-sampled on purpose,
 * which is right for finding defects and wrong for answering "are we serving
 * our runners". Measured 2026-09-19: the marathon refusal rate reads **32%**
 * across a uniform grid and **11%** across profiles a real entrant presents
 * with, because the uniform grid counts a 10 km/week marathoner exactly as
 * heavily as a 30 km/week one. Both numbers are true. Only one answers the
 * founder's question, and for weeks the engine has been judged on the other.
 *
 * ⚠️ AN INPUT OUTSIDE THE ENVELOPE IS NOT AN INPUT WE MAY SERVE BADLY. The
 * envelope weights attention, never excuses a defect: a 10 km/week marathoner
 * is rare AND must still get an honest, actionable refusal. Coverage inside the
 * envelope is the headline; behaviour outside it is still audited.
 */

import type { GeneratorInput } from '@/types/plan'

export interface EnvelopeBand<T> {
  /** The value. */ value: T
  /** Share of real entrants, as a fraction. Assumption — see header. */ weight: number
  /** Why this band and this weight. Prose, because the number is a judgement. */ why: string
}

/**
 * Weekly volume at sign-up, for a MARATHON entrant.
 *
 * Anchored on the one cohort we actually know something about: Make-A-Wish
 * London places, accepted ~7 months out by people who are fundraising first and
 * running second. The charity has NOT yet answered what their runners run
 * (`docs/runbooks/charity-volume-question.md`, drafted, unsent) — when it does,
 * THESE NUMBERS CHANGE and the file records who changed them.
 */
export const MARATHON_VOLUME_BANDS: EnvelopeBand<number>[] = [
  { value: 8,  weight: 0.06, why: 'Barely running. Real, and the cohort §111 refuses. Small but not zero.' },
  { value: 15, weight: 0.14, why: 'Couch-to-charity-place. The flagship persona M1/E1 sits here.' },
  { value: 25, weight: 0.28, why: 'Runs a few times a week already. The modal charity entrant.' },
  { value: 35, weight: 0.27, why: 'Established recreational runner stepping up to the distance.' },
  { value: 50, weight: 0.17, why: 'Experienced amateur, has raced shorter, wants a time.' },
  { value: 70, weight: 0.08, why: 'Serious club amateur. Rare in this product, not absent.' },
]

/** Days a week the runner can train. A day job is the constraint the brand is named for. */
export const DAYS_BANDS: EnvelopeBand<number>[] = [
  { value: 3, weight: 0.22, why: 'Three is the honest floor for a working parent; §52 refuses marathons here.' },
  { value: 4, weight: 0.38, why: 'The modal day-job runner. If one cell must work, it is this one.' },
  { value: 5, weight: 0.29, why: 'Committed amateur with a flexible week; the level most plans are designed around.' },
  { value: 6, weight: 0.11, why: 'Rare outside club runners, and the cell where quality frequency stops being the binding constraint.' },
]

/** Structural fitness level. */
export const LEVEL_BANDS: EnvelopeBand<'beginner' | 'intermediate' | 'experienced'>[] = [
  { value: 'beginner',     weight: 0.45, why: 'Priority one per the founder: first-timers, minimise dropouts.' },
  { value: 'intermediate', weight: 0.40, why: 'Has run before but has never followed structured training; the biggest single group.' },
  { value: 'experienced',  weight: 0.15, why: 'Smallest group; also the loudest if the coaching is wrong.' },
]

/** Injury history. Roughly half of recreational runners report something. */
export const INJURY_BANDS: EnvelopeBand<string[]>[] = [
  { value: [],              weight: 0.60, why: 'No current injury history declared, which is the majority but not the default assumption.' },
  { value: ['knee'],        weight: 0.22, why: 'The commonest self-reported running complaint.' },
  { value: ['shin_splints'], weight: 0.12, why: 'Concentrated in new runners ramping volume — our cohort.' },
  { value: ['achilles'],    weight: 0.06, why: 'Older runners; matters because it punishes volume jumps.' },
]

export const AGE_BANDS: EnvelopeBand<number>[] = [
  { value: 28, weight: 0.24, why: 'Under-30s: fastest recovery, and the group most likely to over-declare their level.' },
  { value: 38, weight: 0.36, why: 'The day-job core the brand is named for: work, family, and a race at the weekend.' },
  { value: 48, weight: 0.26, why: 'Masters entry, where §3 changes the deload cadence and recovery slows measurably.' },
  { value: 58, weight: 0.14, why: 'Masters proper. Willy holds a standing reservation here and Sims a separate bone-health one.' },
]

export const GOAL_BANDS: EnvelopeBand<'finish' | 'time_target'>[] = [
  { value: 'finish',      weight: 0.62, why: 'First-timers and charity runners want to finish.' },
  { value: 'time_target', weight: 0.38, why: 'Repeat marathoners chasing a number.' },
]

/** Weeks of runway from sign-up to race day. */
export const RUNWAY_BANDS: EnvelopeBand<number>[] = [
  { value: 12, weight: 0.14, why: 'Signed up late, or found us late. §44 pressure lives here.' },
  { value: 16, weight: 0.26, why: 'The classic sixteen-week marathon block most published plans assume.' },
  { value: 20, weight: 0.32, why: 'A sensible lead time: enough runway to build a base before the block proper.' },
  { value: 30, weight: 0.28, why: 'A London place in April accepted the previous autumn.' },
]

export interface WeightedCase { input: GeneratorInput; weight: number; label: string }

/**
 * The weighted marathon population. Cartesian product of the bands with the
 * product of their weights — so the numbers this produces are SHARE OF RUNNERS,
 * not share of grid cells, which is the whole point.
 */
export function marathonEnvelope(planStart = '2026-11-02'): WeightedCase[] {
  const out: WeightedCase[] = []
  for (const v of MARATHON_VOLUME_BANDS)
  for (const d of DAYS_BANDS)
  for (const l of LEVEL_BANDS)
  for (const inj of INJURY_BANDS)
  for (const a of AGE_BANDS)
  for (const g of GOAL_BANDS)
  for (const r of RUNWAY_BANDS) {
    const weight = v.weight * d.weight * l.weight * inj.weight * a.weight * g.weight * r.weight
    const start = new Date(planStart + 'T00:00:00Z')
    const race = new Date(start.getTime() + r.value * 7 * 86_400_000)
    // Training age follows structural level: an "experienced" runner with six
    // months of running is a contradiction, and a grid that generates one
    // measures nothing real. This is the coherence the uniform grids lack.
    const training_age = l.value === 'beginner' ? '6-18mo'
      : l.value === 'intermediate' ? '2-5yr' : '5yr+'
    out.push({
      weight,
      label: `${v.value}km/wk ${l.value} ${d.value}d age${a.value} ${g.value} ${r.value}wk ${inj.value.join('+') || 'healthy'}`,
      input: {
        athlete_name: 'Envelope', age: a.value, race_name: 'Target race',
        primary_metric: 'distance', race_distance_km: 42.2,
        race_date: race.toISOString().slice(0, 10), plan_start: planStart,
        goal: g.value, fitness_level: l.value, training_age,
        resting_hr: 55, max_hr: 185,
        current_weekly_km: v.value,
        // A plausible long run for that weekly volume, capped at marathon sense.
        longest_recent_run_km: Math.round(Math.min(v.value * 0.45, 32)),
        days_available: d.value, injury_history: [...inj.value],
        hard_session_relationship: 'neutral', recent_quality_training: 'occasional',
        ...(g.value === 'time_target' ? { target_time: '4:15:00' } : {}),
      } as unknown as GeneratorInput,
    })
  }
  return out
}
