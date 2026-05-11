/**
 * Athlete-context block builder — shared across every coaching prompt.
 *
 * Pulls stable athlete traits from plan.meta (the single source of truth for
 * athlete profile under R23 doctrine) and renders a compact, labelled block
 * that prompt builders inject after the voice header.
 *
 * Doctrine:
 * - Never list every trait. Only those the model can plausibly use.
 * - The block instructs the model to *use* traits implicitly, not list them back.
 *   "Integrate naturally" prevents the model from regurgitating the profile.
 * - Empty when nothing useful is captured — caller injects nothing.
 *
 * Why this exists: pre-R25, six coaching prompts received zero athlete-shape
 * context at fire time. Two runners with identical recent data got identical
 * coach notes regardless of training age, injury history, or how they relate to
 * hard sessions. This helper plumbs the captured profile into every surface.
 */
import type { Plan } from '@/types/plan'

export interface AthleteContextInput {
  plan: Pick<Plan, 'meta'>
  /** First name — used elsewhere via buildVoiceHeader; never duplicated in this block. */
  firstName?: string | null
}

// Human-readable labels for the categorical enums. Kept in this file rather
// than the prompts because the labels are part of the prompt copy contract.
const HARD_SESSION_RELATIONSHIP_LABEL: Record<string, string> = {
  avoid:   'tends to back off hard sessions',
  neutral: 'no strong preference on hard sessions',
  love:    'enjoys hard sessions',
  overdo:  'tends to push too hard, blow the band',
}

const TRAINING_AGE_LABEL: Record<string, string> = {
  '<6mo':   'less than 6 months of running history',
  '6-18mo': '6–18 months of running history',
  '2-5yr':  '2–5 years of running history',
  '5yr+':   '5+ years of running history',
}

const FITNESS_LEVEL_LABEL: Record<string, string> = {
  beginner:     'beginner',
  intermediate: 'intermediate',
  experienced:  'experienced',
}

/**
 * Builds the labelled athlete-context block. Returns empty string when no
 * captured trait can be surfaced — prompt builders should then inject nothing
 * (no header, no spacing artefacts).
 *
 * The block is wrapped in a clear instruction line so the model treats it as
 * background colour, not as a checklist to recite.
 */
export function buildAthleteContext({ plan }: AthleteContextInput): string {
  const m = plan.meta
  const lines: string[] = []

  // Goal — only surface when it adds nuance the model can act on
  if (m.goal === 'time_target' && m.target_time) {
    lines.push(`- Goal: time target (${m.target_time})`)
  } else if (m.goal === 'finish') {
    lines.push(`- Goal: finish the race — no time pressure`)
  }

  // Experience composite — fitness level + training age, surfaced together
  // because either alone is half a signal
  const fitness = m.fitness_level ? FITNESS_LEVEL_LABEL[m.fitness_level] : null
  const age     = m.training_age ? TRAINING_AGE_LABEL[m.training_age] : null
  if (fitness || age) {
    const parts = [fitness, age].filter(Boolean).join(', ')
    lines.push(`- Experience: ${parts}`)
  }

  // Hard-session relationship — the highest-value coaching trait. Tells the
  // model whether to push back (overdoer), encourage commitment (avoider), or
  // stay neutral.
  if (m.hard_session_relationship && HARD_SESSION_RELATIONSHIP_LABEL[m.hard_session_relationship]) {
    lines.push(`- Hard sessions: ${HARD_SESSION_RELATIONSHIP_LABEL[m.hard_session_relationship]}`)
  }

  // Injury history — keep verbatim from the captured array. The model can
  // use this to soften pushback when fatigue signals are present.
  if (m.injury_history && m.injury_history.length > 0) {
    lines.push(`- Injury history: ${m.injury_history.join(', ')}`)
  }

  // Terrain — useful colour when feedback touches pacing or HR drift on hills
  if (m.terrain && m.terrain !== 'road') {
    lines.push(`- Terrain: ${m.terrain}`)
  }

  // Days available — surfaces only when constrained (<=4), so the model
  // doesn't suggest "add a session" to someone who can't
  if (typeof m.days_available === 'number' && m.days_available <= 4) {
    lines.push(`- Training availability: ${m.days_available} days/week`)
  }

  if (lines.length === 0) return ''

  return `
Athlete profile (use sparingly — integrate naturally into the message, never list these traits back):
${lines.join('\n')}
`
}
