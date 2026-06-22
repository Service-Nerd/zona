import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'

// CA-03 — post-race "what next" goal ladder.
//
// Pure, deterministic sequencing: given a just-finished race, propose the next
// sensible goals. Engine-owned (CoachingPrinciples §67) — the options are
// computed, never free-text. The card that renders these carries NO AIMark:
// this is rule-engine output, not model output.

export type RaceDistanceKey = '5K' | '10K' | 'HM' | 'MARATHON' | '50K' | '100K'

export type NextGoalKind = 'chase_time' | 'step_up' | 'maintain'

export interface NextGoalOption {
  kind:        NextGoalKind
  /** Short label, e.g. "Same distance, faster". */
  label:       string
  /** One-line rationale in Zonna voice. */
  blurb:       string
  /** Target race distance (km) this option seeds into the wizard. */
  distanceKm:  number
  distanceKey: RaceDistanceKey
  /** Wizard goal type. */
  goal:        'finish' | 'time_target'
  /** Suggested target time "h:mm:ss" / "mm:ss" when goal === 'time_target'. */
  targetTime?: string
  /** Minimum sensible prep (weeks) for this goal — sourced from GENERATION_CONFIG. */
  minPrepWeeks: number
}

export interface FinishedRace {
  distanceKm:  number
  /** Finish time string ("h:mm:ss" / "mm:ss"), if recorded. */
  finishTime?: string | null
  /** Original goal/target time string, if the plan carried one. */
  targetTime?: string | null
  outcome?:    'on_target' | 'off_target' | 'dnf' | 'pb' | null
}

// Distance ladder we auto-sequence within. Ultra rungs (50K/100K) exist in
// config but we never auto-ladder INTO them — stepping a marathoner to an
// ultra is too big a jump to propose unprompted (§67: don't over-reach).
const LADDER: Array<{ key: RaceDistanceKey; km: number }> = [
  { key: '5K',       km: 5 },
  { key: '10K',      km: 10 },
  { key: 'HM',       km: 21.1 },
  { key: 'MARATHON', km: 42.2 },
]

const PREP = GENERATION_CONFIG.PREP_TIME_THRESHOLDS

/** Resolve a distance in km to its race-distance bucket. */
export function raceKeyFromKm(km: number): RaceDistanceKey {
  if (km <= 6)  return '5K'
  if (km <= 12) return '10K'
  if (km <= 22) return 'HM'
  if (km <= 43) return 'MARATHON'
  if (km <= 55) return '50K'
  return '100K'
}

export function parseTimeToSeconds(t?: string | null): number | null {
  if (!t) return null
  const parts = t.split(':').map(Number)
  if (parts.some(n => !isFinite(n))) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

export function formatSeconds(total: number): string {
  const s   = Math.max(0, Math.round(total))
  const h   = Math.floor(s / 3600)
  const m   = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

/** Riegel time prediction across distances: T2 = T1 × (D2/D1)^1.06. The 1.06
 *  exponent is the standard Riegel fatigue factor — an algorithm constant. */
function riegel(t1Sec: number, d1Km: number, d2Km: number): number {
  return t1Sec * Math.pow(d2Km / d1Km, 1.06)
}

// Suggestion seed for "same distance, faster" — config-owned (INV-CFG-003).
const CHASE_IMPROVEMENT_FACTOR = GENERATION_CONFIG.GOAL_SEQUENCING.CHASE_IMPROVEMENT_FACTOR

/**
 * The achievement line shown above the options — finish vs goal, in Zonna voice.
 * One sentence, one number, never a celebration. §67.
 */
export function achievementLine(race: FinishedRace): string {
  const key       = raceKeyFromKm(race.distanceKm)
  const finishSec = parseTimeToSeconds(race.finishTime)
  const goalSec   = parseTimeToSeconds(race.targetTime)

  if (race.outcome === 'dnf') return `You toed the line for the ${key}. That counts.`
  if (finishSec == null)      return `${key} done. In the book.`

  const ft = formatSeconds(finishSec)
  if (goalSec != null) {
    const delta = goalSec - finishSec
    if (Math.abs(delta) < 30) return `You ran ${ft} — right on your goal.`
    if (delta > 0)            return `You ran ${ft} — ${formatSeconds(delta)} inside your goal.`
    return `You ran ${ft} — ${formatSeconds(-delta)} over. It happens.`
  }
  return `You ran ${ft}. In the book.`
}

/**
 * Ordered next-goal options for a finished race.
 *
 * Order reflects the natural progression for the outcome:
 *  - missed the goal (off_target / dnf) → chase the same time again first
 *  - hit or beat it (pb / on_target / unknown) → step up distance first
 * `maintain` is always last — the low-pressure option is never the headline.
 *
 * A marathon finisher gets no step_up (ladder is capped at the marathon).
 */
export function nextGoalOptions(race: FinishedRace): NextGoalOption[] {
  const fromKey    = raceKeyFromKm(race.distanceKm)
  const finishSec  = parseTimeToSeconds(race.finishTime)
  const goalSec    = parseTimeToSeconds(race.targetTime)
  const ladderIdx  = LADDER.findIndex(r => r.key === fromKey)
  const fromKm     = ladderIdx >= 0 ? LADDER[ladderIdx].km : race.distanceKm
  const nextRung   = ladderIdx >= 0 && ladderIdx < LADDER.length - 1 ? LADDER[ladderIdx + 1] : null
  const missed     = race.outcome === 'off_target' || race.outcome === 'dnf'

  // chase_time — same distance, a faster target.
  let chaseTarget: string | undefined
  let chaseGoal: 'finish' | 'time_target' = 'finish'
  if (missed && goalSec != null) {
    // Missed it — re-attempt the same goal.
    chaseTarget = formatSeconds(goalSec); chaseGoal = 'time_target'
  } else if (finishSec != null) {
    // Hit/beat it — a modest improvement on the achieved time.
    chaseTarget = formatSeconds(finishSec * CHASE_IMPROVEMENT_FACTOR); chaseGoal = 'time_target'
  } else if (goalSec != null) {
    chaseTarget = formatSeconds(goalSec); chaseGoal = 'time_target'
  }
  const chase: NextGoalOption = {
    kind:        'chase_time',
    label:       'Same distance, faster',
    blurb:       missed ? `Run ${fromKey} again and land the time.` : `Run another ${fromKey} and take time off.`,
    distanceKm:  fromKm,
    distanceKey: fromKey,
    goal:        chaseGoal,
    targetTime:  chaseTarget,
    minPrepWeeks: PREP[fromKey]?.block ?? 6,
  }

  // step_up — next distance up the ladder (capped at marathon).
  const stepUp: NextGoalOption | null = nextRung
    ? {
        kind:        'step_up',
        label:       `Step up to ${nextRung.key}`,
        blurb:       `You've got the ${fromKey} in the legs. ${nextRung.key} is the next line.`,
        distanceKm:  nextRung.km,
        distanceKey: nextRung.key,
        goal:        finishSec != null ? 'time_target' : 'finish',
        targetTime:  finishSec != null ? formatSeconds(riegel(finishSec, fromKm, nextRung.km)) : undefined,
        minPrepWeeks: PREP[nextRung.key]?.block ?? 8,
      }
    : null

  // maintain — same distance, no time pressure.
  const maintain: NextGoalOption = {
    kind:        'maintain',
    label:       'Hold your base',
    blurb:       'Keep the engine. Pick a race when one calls.',
    distanceKm:  fromKm,
    distanceKey: fromKey,
    goal:        'finish',
    minPrepWeeks: PREP[fromKey]?.block ?? 6,
  }

  const ordered = missed
    ? [chase, stepUp, maintain]
    : [stepUp, chase, maintain]

  return ordered.filter((o): o is NextGoalOption => o != null)
}
