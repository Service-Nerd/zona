// STRENGTH-ENGINE-01 Phase 2 (Design Board STRENGTH-APP-01) — the single owner of
// every strength string the app shows. Components never compose these.
//
// ⚠️ Copy is the founder's. These are drafts in the brand voice; the RIR phrasing in
// particular ("reps in reserve") was flagged for his call. Client-safe: no Node imports.

import { CATALOGUE_BY_ID, PATTERN_REGION, type Experience, type Focus, type SessionMinutes, type EquipmentTag, type Prescription, type SessionKind, type StrengthPlan, type StrengthSession } from '@/packages/strength'
import { formatStepDuration, formatWeight } from '@/lib/format'
import type { LiftFeel, LiftSuggestion } from '@/packages/strength'
import { partEffort, type PartKind, type SessionPart } from './sessionParts'

/** Titles drop "+ core": core is in nearly every session, and saying so on each is saying it four times (Collins). */
export const STRENGTH_KIND_TITLE: Record<SessionKind, string> = {
  full_body: 'Full body',
  lower_core: 'Lower body',
  upper_core: 'Upper body',
  mobility: 'Mobility',
}

/**
 * The title a runner reads for one session (Design Board 2026-10-19). One owner, read from what the session HOLDS,
 * because the kind no longer settles it: a 30-min full body can lose its upper work to the clock (S10 Am.3, re-sat),
 * and an upper session that replaces a leg session carries light leg work (S3 Am.2). Seven sites, two of them AI
 * prompts, read `STRENGTH_KIND_TITLE[kind]` before this. Both titles approved by the founder, 2026-10-19.
 */
export const STRENGTH_TITLE_BY_CONTENT = { lowerOnly: 'Lower body', upperLightLegs: 'Upper body and light legs' }
export function strengthSessionTitle(s: Pick<StrengthSession, 'kind' | 'blocks'>): string {
  const work = s.blocks.filter(b => b.role === 'main' || b.role === 'accessory').flatMap(b => b.items)
  if (s.kind === 'full_body' && !work.some(i => { const e = CATALOGUE_BY_ID.get(i.exercise_id); return !!e && PATTERN_REGION[e.pattern] === 'upper' })) {
    return STRENGTH_TITLE_BY_CONTENT.lowerOnly
  }
  if (lostItsHeavyLegs(s)) return STRENGTH_TITLE_BY_CONTENT.upperLightLegs
  return STRENGTH_KIND_TITLE[s.kind]
}

/**
 * A leg session the run week turned into an upper session with light leg work (S3 Am.2): the session that says so
 * (S3 Am.3, Coaching Board 2026-10-28 A). The light-leg items are the engine's own mark of the conversion
 * (`placement.ts` sets `lightLower` only on the upper days that replaced a leg day).
 */
export function lostItsHeavyLegs(s: Pick<StrengthSession, 'kind' | 'blocks'>): boolean {
  return s.kind === 'upper_core' && s.blocks.some(b => (b.role === 'main' || b.role === 'accessory') && b.items.some(i => i.light))
}

/** The one line a stacked session carries, said once, on the row that needs it (S4). */
export const STRENGTH_AFTER_RUN_LINE = 'After your run, at least 3 hours later'

/** Hero adverb on a strength-only day: the app's existing word for strength (TodayScreen getHeroAdverb). */
export const STRENGTH_HERO_ADVERB = 'with weights'

export function exerciseName(id: string): string {
  return CATALOGUE_BY_ID.get(id)?.name ?? id
}

export function exerciseCues(id: string): string[] {
  return CATALOGUE_BY_ID.get(id)?.cues ?? []
}

// ── STRENGTH-SESSION-PARTS-01 (Design Board 2026-10-28 E; wording approved by the founder 2026-10-28) ─────────────
// Rounds, rest and effort are said once per part; a row says the exercise and its dose only.

export const STRENGTH_PART_TITLE: Record<PartKind, string> = {
  warmup: 'Warm-up', cooldown: 'Cool-down', superset: 'Superset', main: 'Main lift', accessory: 'Accessory', core: 'Core', plyo: 'Jumps',
}

/** "Part 1 · Superset" for a training part; the warm-up and cool-down are named, not numbered. */
export function partTitle(p: SessionPart, n: number | null): string {
  return n == null ? STRENGTH_PART_TITLE[p.kind] : `Part ${n} · ${STRENGTH_PART_TITLE[p.kind]}`
}

/** Plain words for an RIR, never "reps in reserve" (Sierra, 2026-10-28): "2 in the tank". */
export function effortWords(low: number, high = low): string {
  return `${low === high ? low : `${low}–${high}`} in the tank`
}

/** "3 rounds · rest 1:30 min", plus the part's own effort when it differs from the session's. Empty for a one-pass prep part. */
export function partHeader(p: SessionPart, sessionRir: number | null): string {
  const prep = p.kind === 'warmup' || p.kind === 'cooldown'
  if (prep && p.rounds === 1 && p.rest_s === 0) return ''
  const own = partEffort(p, sessionRir)
  return [
    `${p.rounds} ${p.rounds === 1 ? 'round' : 'rounds'}`,
    p.rest_s > 0 ? `rest ${formatStepDuration(p.rest_s)}` : 'no rest',
    own ? effortWords(own[0], own[1]) : null,
  ].filter(Boolean).join(' · ')
}

/** A row's dose inside its part: "10", "10 each side", "30 s", "10 contacts"; "2 × 10" only when it differs from the rounds. */
export function partDose(p: Pick<Prescription, 'sets' | 'reps' | 'seconds' | 'contacts' | 'per_side'>, rounds: number): string {
  const amount = p.reps != null ? String(p.reps) : p.seconds != null ? `${p.seconds} s` : `${p.contacts ?? 0} contacts`
  const dose = p.per_side ? `${amount} each side` : amount
  return p.sets !== rounds ? `${p.sets} × ${dose}` : dose
}

/** Said once, under the tiles, when the session's lifts are new (instead of on every row). */
export const STRENGTH_NEW_LIFTS_LINE = 'New lifts this block. Start light and build from there.'

/** The link between a superset's rows. */
export const STRENGTH_SUPERSET_LINK = 'then straight into'

const DAY_NAME: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }

/** Both swap-day lines say "after the run" for the same runs: the swap day stacks behind them (S4). */
const liftsAfterTheRun = (run: string | null): run is 'quality' | 'easy' => run === 'quality' || run === 'easy'

/**
 * S3 Am.3 (Coaching Board 2026-10-28 A; the founder's words) — on a session that lost its heavy legs: why, then the
 * swap the plan already holds (`legs_day_suggestion`). The swap is named only on the day it would replace: another
 * converted day in the same plan is not fixed by it. The run is named in the words the legs-day line already uses.
 */
export function noLegsLine(beside: 'quality' | 'long' | null, swap?: { day: string; run: string | null } | null): string {
  const why = beside ? `No heavy legs today: your ${beside} run is the day next to it.` : 'No heavy legs today.'
  if (!swap) return why
  const day = DAY_NAME[swap.day] ?? swap.day
  return `${why} ${liftsAfterTheRun(swap.run) ? `Lifting on ${day}, after the run, would fit legs in.` : `Lifting on ${day} would fit legs in.`}`
}

/** A main lift the runner has no usable log for: the rows that say "New lift. Start light." (`liftSuggestionLine`). */
export function isNewLift(s: LiftSuggestion | undefined): boolean {
  return !!s && s.kind !== 'bodyweight' && (s.kind === 'start' || !s.last || s.load_kg == null)
}

export function exerciseCount(s: StrengthSession): number {
  return s.blocks.filter(b => b.role !== 'warmup').reduce((n, b) => n + b.items.length, 0)
}

/** The strength session on a calendar date, or null. Dates are ISO YYYY-MM-DD. */
export function strengthOnDate(plan: StrengthPlan | null, date: string): StrengthSession | null {
  if (!plan) return null
  for (const w of plan.weeks) for (const s of w.sessions) if (s.date === date) return s
  return null
}

/** Local calendar date of a Date, as the strength plan keys it. */
export function isoLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Setup (Me → Strength). Drafts; the founder owns the words. ──────────────────




export const STRENGTH_SETUP = {
  focusLabel: 'What is it for?',
  focus: {
    running: { label: 'Running-focused', sub: 'Single-leg strength, calves and hips, built around your runs.' },
    general: { label: 'General', sub: 'The same leg work, with more upper body.' },
  } satisfies Record<Focus, { label: string; sub: string }>,
  // PINNED-DAYS-01 (Design Board 2026-10-18): one question, asked positively; the picks are the count.
  daysLabel: 'Which days can you lift?',
  daysNote: 'Two is what we would suggest. Your sessions stay on these days.',
  daysMaxNote: 'Four is the most. Your sessions stay on these days.',
  minutesLabel: 'How long?',
  equipmentLabel: 'What can you use?',
  bodyweightNote: 'Bodyweight builds the habit and some strength. Heavier work needs weights.',
  experienceLabel: 'How much have you lifted?',
  experience: { new: 'New to it', some: 'Some', regular: 'Regularly' } satisfies Record<Experience, string>,
  boneLabel: 'Osteoporosis or a spinal fracture',
  boneSub: 'Leaves out jumps and loaded forward bends.',
  injuriesNote: (tags: string[]) => `Allowing for your ${tags.join(' and ')}, from your plan.`,
  // STRENGTH-CHOSEN-NO-LEGS-01 (Design Board 2026-10-19; founder approved): what they get, not what they lose.
  // STRENGTH-CHOSEN-NO-LEGS-01 (Design Board 2026-10-19; founder approved): what they get, not what they lose.
  // ⚠️ True for BOTH foci only since STRENGTH-GENERAL-LEGS-01; for a few hours on 2026-10-19 it was false for General
  // (no leg work at all) and was focus-aware. If light leg work is ever scoped again, this line must be too.
  legsLimitedNote: (_focus: Focus): string => 'Your run week keeps heavy legs off these days, so they get lighter leg work.',
  /** STRENGTH-LEGS-DAY-01 (Design Board 2026-10-19; founder approved the shape): name the day, never move one. */
  legsDayLine: (s: { day: string; run: string | null }): string => {
    const day = DAY_NAME[s.day] ?? s.day
    return liftsAfterTheRun(s.run)
      ? `Lift on ${day} after your ${s.run} run and your legs get a proper session.`
      : `Lift on ${day} and your legs get a proper session.`
  },
  cta: 'Build my strength plan',
  ctaUpdate: 'Update',
  // SAVE-PATTERN-01: the "Built" line moved to Plan, where the change is (`strengthPlanReadback`).
  saveFailed: 'Couldn’t build it. Try again.',
  loadFailed: 'Couldn’t load your strength plan.',
}

export const EQUIPMENT_LABEL: Record<string, string> = {
  bodyweight: 'Bodyweight', bands: 'Bands', dumbbells: 'Dumbbells', kettlebell: 'Kettlebell', bench: 'Bench', box: 'Box or step',
  pullup_bar: 'Pull-up bar', barbell: 'Barbell', rack: 'Rack', cable: 'Cable machine', machines: 'Gym machines',
}

// ── STRENGTH-ENTRY-01 — the entry points. Founder owns the final words (copy call). ──

export type StrengthWizardChoice = 'no' | 'home' | 'gym'

/** The wizard's one strength question (Design Board: one step, three answers, not seven). */
export const STRENGTH_WIZARD = {
  title: 'Add strength around your runs?',
  subtitle: 'Placed around your run week, never on top of it. Change it any time.',
  options: [
    { value: 'no', label: 'Not now', sub: 'Just the running.' },
    { value: 'home', label: 'Yes, at home', sub: 'Bodyweight to start. Add kit later.' },
    { value: 'gym', label: 'Yes, at a gym', sub: 'Weights, machines and a bench.' },
  ] satisfies { value: StrengthWizardChoice; label: string; sub: string }[],
}

/** The kit each wizard answer stands for. Everything else is the setup's default, editable later. */
export const STRENGTH_WIZARD_EQUIPMENT: Record<Exclude<StrengthWizardChoice, 'no'>, EquipmentTag[]> = {
  home: ['bodyweight'],
  gym: ['bodyweight', 'bands', 'dumbbells', 'kettlebell', 'bench', 'box', 'pullup_bar', 'barbell', 'rack', 'cable', 'machines'],
}

/** The rest card's one line, for a runner who has not set strength up (at most once a week). */
export const STRENGTH_REST_INVITE = {
  title: 'Strength fits on days like this',
  sub: 'Set it up around your runs.',
}

/** Coach: evidence, not a second voice. No streak, no badge, no load chart (no logging yet). */
export const STRENGTH_COACH = {
  label: 'Strength',
  count: (done: number, planned: number) => `${done} of ${planned} this week`,
  heavier: (week: number) => `Heavier lifts from week ${week}.`,
  jumps: (week: number) => `Jumps join in week ${week}.`,
}

// ── STRENGTH-PROGRESSION-01 (Design Board 2026-10-18) — plain words, never "RIR" (Sierra) ──

export const LIFT_FEEL_LABEL: Record<LiftFeel, string> = { easy: 'Easy', right: 'About right', hard: 'Hard' }
const FEEL_WORD: Record<LiftFeel, string> = { easy: 'easy', right: 'about right', hard: 'hard' }
export const LIFT_WEIGHT_LABEL = 'What you lifted'
export const LIFT_LOGGED = 'Logged'

/** The row's line before the set: last time, then what to try. Null on a bodyweight lift. */
export function liftSuggestionLine(s: LiftSuggestion | undefined, prescribedReps: number | undefined, units: 'km' | 'mi'): string | null {
  if (!s || s.kind === 'bodyweight') return null
  if (isNewLift(s) || !s.last || s.load_kg == null) return 'New lift. Start light.'
  const last = `Last time ${formatWeight(s.last.load_kg, units)}, ${FEEL_WORD[s.last.feel]}.`
  const load = formatWeight(s.load_kg, units)
  if (s.kind === 'hold_week') return `${last} Keep ${load} this week.`
  if (s.kind === 'reps' && prescribedReps != null) return `${last} Try ${load} for ${prescribedReps + s.extra_reps}.`
  // S14 Am.1 — more reps this block: say the reps, so a lighter weight after "about right" reads as a reason.
  if (s.kind === 'more_reps' && prescribedReps != null) return `${last} Try ${load} for ${prescribedReps}.`
  return `${last} Try ${load}.`
}
