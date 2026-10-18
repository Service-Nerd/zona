// STRENGTH-ENGINE-01 Phase 2 (Design Board STRENGTH-APP-01) — the single owner of
// every strength string the app shows. Components never compose these.
//
// ⚠️ Copy is the founder's. These are drafts in the brand voice; the RIR phrasing in
// particular ("reps in reserve") was flagged for his call. Client-safe: no Node imports.

import { CATALOGUE_BY_ID, type Experience, type Focus, type SessionMinutes, type BlockRole, type EquipmentTag, type Prescription, type SessionKind, type StrengthPlan, type StrengthSession } from '@/packages/strength'
import { formatStepDuration, formatWeight } from '@/lib/format'
import type { LiftFeel, LiftSuggestion } from '@/packages/strength'

/** Titles drop "+ core": core is in nearly every session, and saying so on each is saying it four times (Collins). */
export const STRENGTH_KIND_TITLE: Record<SessionKind, string> = {
  full_body: 'Full body',
  lower_core: 'Lower body',
  upper_core: 'Upper body',
  mobility: 'Mobility',
}

export const STRENGTH_BLOCK_TITLE: Record<BlockRole, string> = {
  warmup: 'Warm-up',
  plyo: 'Jumps',
  main: 'Main lifts',
  accessory: 'Accessories',
  core: 'Core',
  mobility: 'Cool-down',
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

/** "3 × 5" · "3 × 30 s" · "3 × 10 contacts" · warm-up "8" / "40 s". */
export function doseLine(p: Prescription): string {
  const amount = p.reps != null ? String(p.reps) : p.seconds != null ? `${p.seconds} s` : `${p.contacts ?? 0} contacts`
  return p.sets > 1 ? `${p.sets} × ${amount}` : amount
}

/** The supporting line: effort, then rest, then side. Empty pieces are dropped. */
export function effortLine(p: Prescription): string {
  return [
    p.per_side ? 'each side' : null,
    p.rir != null ? `${p.rir} reps in reserve` : null,
    p.rest_s > 0 ? `rest ${formatStepDuration(p.rest_s)}` : null,
  ].filter(Boolean).join(' · ')
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
  legsLimitedNote: 'Your run week leaves fewer of these days for heavy legs, so some sessions are upper body.',
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
  if (s.kind === 'start' || !s.last || s.load_kg == null) return 'New lift. Start light.'
  const last = `Last time ${formatWeight(s.last.load_kg, units)}, ${FEEL_WORD[s.last.feel]}.`
  const load = formatWeight(s.load_kg, units)
  if (s.kind === 'hold_week') return `${last} Keep ${load} this week.`
  if (s.kind === 'reps' && prescribedReps != null) return `${last} Try ${load} for ${prescribedReps + s.extra_reps}.`
  return `${last} Try ${load}.`
}
