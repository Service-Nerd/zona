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
// LEVEL_BANDS (flat, volume-independent) was DELETED 2026-09-19, not left in
// place "in case". It was superseded by `levelBandsFor`, nothing read it, and
// an exported table nothing reads is decorative config — the class
// `configConsumer.test.ts` exists to catch. Deleting beats deprecating.

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

/**
 * WHICH RACE OUR RUNNERS ARE TRAINING FOR.
 *
 * The 90–95% fit-for-purpose target applies to EVERY distance (founder,
 * 2026-09-19), with the marathon as priority. So the envelope cannot be
 * marathon-only: a distance we serve badly is a distance we serve badly
 * whatever its share.
 */
export const DISTANCE_BANDS: EnvelopeBand<number>[] = [
  { value: 5,    weight: 0.12, why: 'Shortest supported race; over-represented among true beginners, under-represented in our funnel.' },
  { value: 10,   weight: 0.18, why: 'The step-up race, and the commonest first "I have a time goal" distance.' },
  { value: 21.1, weight: 0.30, why: 'The most popular road race distance in the UK, and the one most day-job runners repeat.' },
  { value: 42.2, weight: 0.32, why: 'The founder priority and the charity channel; also the distance with the most ways to go wrong.' },
  { value: 50,   weight: 0.06, why: 'First ultra, usually an experienced road runner moving across.' },
  { value: 100,  weight: 0.02, why: 'Rare in this product; retained because the engine claims to support it.' },
]

/**
 * Weekly volume at sign-up, BY DISTANCE. A 5K entrant and a marathon entrant do
 * not present with the same mileage, and a single shared band set would model
 * neither. Marathon keeps the bands argued above; the rest are scaled to the
 * distance's real entry population.
 */
export const VOLUME_BANDS_BY_DISTANCE: Record<number, EnvelopeBand<number>[]> = {
  5: [
    { value: 5,  weight: 0.22, why: 'Genuinely new to running; a 5K is the first goal a couch-start runner sets.' },
    { value: 12, weight: 0.38, why: 'Runs occasionally, wants structure. The modal 5K entrant.' },
    { value: 25, weight: 0.28, why: 'Regular runner chasing a 5K time rather than a first finish.' },
    { value: 45, weight: 0.12, why: 'Club-adjacent runner sharpening; high volume for a short race.' },
  ],
  10: [
    { value: 8,  weight: 0.18, why: 'Has done a 5K, stepping up, still low base.' },
    { value: 18, weight: 0.36, why: 'The modal 10K entrant: running a few times a week already.' },
    { value: 30, weight: 0.30, why: 'Established recreational runner with a time in mind.' },
    { value: 50, weight: 0.16, why: 'Experienced amateur using the 10K as a sharpening race.' },
  ],
  21.1: [
    { value: 10, weight: 0.12, why: 'Half marathon as a first big goal from a low base; a real and risky cell.' },
    { value: 20, weight: 0.30, why: 'The modal half entrant.' },
    { value: 32, weight: 0.33, why: 'Established runner; the half is their repeat distance.' },
    { value: 50, weight: 0.25, why: 'Experienced amateur, often marathon-trained, racing a half.' },
  ],
  50: [
    { value: 30, weight: 0.24, why: 'Road marathoner moving to trail ultra on modest volume; the risky entry cell.' },
    { value: 45, weight: 0.34, why: 'The modal first-50K runner.' },
    { value: 60, weight: 0.27, why: 'Consolidated ultra base.' },
    { value: 85, weight: 0.15, why: 'Experienced ultra runner.' },
  ],
  100: [
    { value: 45, weight: 0.22, why: 'Under-prepared but committed; the cell where a refusal is most likely correct.' },
    { value: 65, weight: 0.38, why: 'The modal 100K entrant.' },
    { value: 90, weight: 0.27, why: 'Serious ultra base.' },
    { value: 120, weight: 0.13, why: 'High-volume ultra specialist.' },
  ],
}

/** Runway by distance — nobody takes thirty weeks to prepare a 5K. */
export const RUNWAY_BANDS_BY_DISTANCE: Record<number, EnvelopeBand<number>[]> = {
  5:    [{ value: 8, weight: 0.38, why: 'A short sharp block, the usual 5K commitment.' },
         { value: 12, weight: 0.42, why: 'A full 5K build with a base phase.' },
         { value: 16, weight: 0.20, why: 'Long runway for a short race; usually a returning runner.' }],
  10:   [{ value: 10, weight: 0.34, why: 'Typical 10K block.' },
         { value: 14, weight: 0.42, why: 'A full 10K build.' },
         { value: 20, weight: 0.24, why: 'Building a base first.' }],
  21.1: [{ value: 12, weight: 0.32, why: 'Tight but common half-marathon block.' },
         { value: 16, weight: 0.40, why: 'The standard half build.' },
         { value: 24, weight: 0.28, why: 'Booked early, building from a low base.' }],
  50:   [{ value: 16, weight: 0.28, why: 'Short for an ultra; a real entry pattern.' },
         { value: 22, weight: 0.44, why: 'The standard 50K block.' },
         { value: 30, weight: 0.28, why: 'A full ultra build.' }],
  100:  [{ value: 20, weight: 0.30, why: 'Short for 100K.' },
         { value: 28, weight: 0.45, why: 'The standard 100K block.' },
         { value: 36, weight: 0.25, why: 'A long, properly periodised ultra build.' }],
}

/**
 * LEVEL IS CONDITIONAL ON VOLUME, AND IT HAS TO BE (ENVELOPE-COHERENCE-01).
 *
 * ⚠️ MEASURED FLAW IN THIS FILE'S FIRST VERSION: level and volume were
 * independent bands, so the envelope constructed a "beginner" running 50 km a
 * week — **7.1% of the entire population weight on its own, 13.6% across all
 * implausible pairings.** §79 defines `fitness_level` as the STRUCTURAL axis,
 * derived from volume, so that runner contradicts the engine's own model. The
 * headline fit-for-purpose number was being computed over people who cannot
 * exist. This is the same independence artefact the file's header criticises
 * `cohortGrid` for, reproduced here within a day of writing that criticism.
 *
 * ⚠️ A LOW-VOLUME "EXPERIENCED" RUNNER IS **NOT** IMPLAUSIBLE and is kept: a
 * returning runner with five years behind them and 8 km this week is real, and
 * §29's fresh-return scaling exists precisely for them. Only the high-volume
 * beginner is removed, because that one contradicts a definition rather than
 * being merely uncommon.
 *
 * Weights are shares WITHIN each volume band and sum to 1, so the volume
 * distribution above is unchanged by this conditioning.
 */
export function levelBandsFor(weeklyKm: number): EnvelopeBand<'beginner' | 'intermediate' | 'experienced'>[] {
  if (weeklyKm <= 12) return [
    { value: 'beginner',     weight: 0.70, why: 'At this volume most runners are structurally beginners, and this is the founder priority cell.' },
    { value: 'intermediate', weight: 0.25, why: 'Has run before and is currently ticking over at low volume.' },
    { value: 'experienced',  weight: 0.05, why: 'A genuinely experienced runner at 12 km/week is returning from a layoff — §29 territory, real but uncommon.' },
  ]
  if (weeklyKm <= 25) return [
    { value: 'beginner',     weight: 0.45, why: 'The modal charity entrant sits here and is still structurally a beginner.' },
    { value: 'intermediate', weight: 0.45, why: 'Runs regularly without structured training; the biggest single group overall.' },
    { value: 'experienced',  weight: 0.10, why: 'Rebuilding after time off.' },
  ]
  if (weeklyKm <= 40) return [
    { value: 'beginner',     weight: 0.15, why: 'Possible but unusual: high mileage with no training history at all.' },
    { value: 'intermediate', weight: 0.55, why: 'The centre of gravity for a day-job runner at this volume.' },
    { value: 'experienced',  weight: 0.30, why: 'Consolidated base, races regularly.' },
  ]
  return [
    { value: 'beginner',     weight: 0.02, why: 'Near-impossible by §79, which derives the structural level from volume. Kept non-zero so the cell is exercised, not so it is weighted.' },
    { value: 'intermediate', weight: 0.38, why: 'A committed amateur who has never followed a structured block.' },
    { value: 'experienced',  weight: 0.60, why: 'At 40+ km/week sustained, the runner is experienced by any reading of §79.' },
  ]
}

export interface WeightedCase { input: GeneratorInput; weight: number; label: string }

/**
 * The weighted marathon population. Cartesian product of the bands with the
 * product of their weights — so the numbers this produces are SHARE OF RUNNERS,
 * not share of grid cells, which is the whole point.
 */
export function marathonEnvelope(planStart = '2026-11-02'): WeightedCase[] {
  return distanceEnvelope(42.2, planStart)
}

/**
 * The weighted population for ONE distance. Weights are shares of that
 * distance's entrants, so they sum to 1 within the distance — the distance's
 * own share of the whole product is applied by `fullEnvelope`.
 */
export function distanceEnvelope(distanceKm: number, planStart = '2026-11-02'): WeightedCase[] {
  const volumes = VOLUME_BANDS_BY_DISTANCE[distanceKm] ?? MARATHON_VOLUME_BANDS
  const runways = RUNWAY_BANDS_BY_DISTANCE[distanceKm] ?? RUNWAY_BANDS
  const out: WeightedCase[] = []
  for (const v of volumes)
  for (const d of DAYS_BANDS)
  for (const l of levelBandsFor(v.value))
  for (const inj of INJURY_BANDS)
  for (const a of AGE_BANDS)
  for (const g of GOAL_BANDS)
  for (const r of runways) {
    const weight = v.weight * d.weight * l.weight * inj.weight * a.weight * g.weight * r.weight
    const start = new Date(planStart + 'T00:00:00Z')
    const race = new Date(start.getTime() + r.value * 7 * 86_400_000)
    const training_age = l.value === 'beginner' ? '6-18mo'
      : l.value === 'intermediate' ? '2-5yr' : '5yr+'
    // A time target only means something with a plausible number for the
    // distance. A single '4:15:00' across all six would make a 4h15 5K, whose
    // goal pace is slower than easy pace -- a fixture artefact, not a runner.
    const TARGETS: Record<number, string> = {
      5: '0:26:00', 10: '0:54:00', 21.1: '2:00:00', 42.2: '4:15:00', 50: '6:30:00', 100: '14:00:00',
    }
    out.push({
      weight,
      label: `${distanceKm}km ${v.value}km/wk ${l.value} ${d.value}d age${a.value} ${g.value} ${r.value}wk ${inj.value.join('+') || 'healthy'}`,
      input: {
        athlete_name: 'Envelope', age: a.value, race_name: 'Target race',
        primary_metric: 'distance', race_distance_km: distanceKm,
        race_date: race.toISOString().slice(0, 10), plan_start: planStart,
        goal: g.value, fitness_level: l.value, training_age,
        resting_hr: 55, max_hr: 185,
        current_weekly_km: v.value,
        longest_recent_run_km: Math.round(Math.min(v.value * 0.45, distanceKm * 0.75)),
        days_available: d.value, injury_history: [...inj.value],
        hard_session_relationship: 'neutral', recent_quality_training: 'occasional',
        // ⚠️ THE RUNNER ACKNOWLEDGES THE WARNINGS, BECAUSE A REAL ONE DOES.
        // `PrepTimeError`/`DaysAvailableError` carry TWO reasons: 'block' (a
        // real refusal) and 'warn_unacknowledged' (a confirmation prompt the
        // client shows, the runner ticks, and generation proceeds). An
        // envelope that never acknowledges counts every confirmation prompt as
        // a refusal — measured, 2,304 cases, all of them people who would in
        // fact have received a plan. Modelling the runner as someone who never
        // clicks "yes, I understand" is modelling nobody.
        // Genuine 'block' refusals are unaffected and still refuse.
        acknowledged_days_warning: true,
        acknowledged_prep_warning: true,
        ...(g.value === 'time_target' ? { target_time: TARGETS[distanceKm] ?? '4:15:00' } : {}),
      } as unknown as GeneratorInput,
    })
  }
  return out
}

/** Every distance, each case weighted by BOTH its within-distance share and the
 *  distance's share of the product. Sums to 1 across the whole population. */
export function fullEnvelope(planStart = '2026-11-02'): WeightedCase[] {
  return DISTANCE_BANDS.flatMap(d =>
    distanceEnvelope(d.value, planStart).map(c => ({ ...c, weight: c.weight * d.weight })))
}
