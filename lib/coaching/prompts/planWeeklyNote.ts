import { buildVoiceHeader } from './voiceRules'

export interface PlanWeeklyNotePromptInput {
  /** 1-indexed week number. */
  weekN: number
  /** Phase label for this week: 'foundation' | 'base' | 'build' | 'peak' | 'taper'. */
  phase: string | null
  /** Weeks until race (0 means race week). Null when no race date. */
  weeksToRace: number | null
  /** Race name from plan meta. Optional. */
  raceName: string | null
  /** Race distance label ('5K', '10K', 'HM', 'Marathon', etc.). Optional. */
  raceDistance: string | null
  /**
   * Sessions in the week — one row per non-rest day.
   * Shape: { day: 'Mon'…'Sun', type, distanceKm?: number }
   */
  sessions: Array<{ day: string; type: string; distanceKm?: number | null }>
  /** First name — used for a single optional address per voice rules. */
  firstName?: string | null
  /** Pre-built athlete profile block (from buildAthleteContext). Empty string when no traits captured. */
  athleteContext?: string
  /**
   * AI-DEPTH-10 continuity — the previous week's plan note.
   * Null on week 1 or when invalidated by a plan regeneration.
   */
  previousWeeklyNote?: { weekN: number; headline: string; items: string[] } | null
}

const PHASE_LABELS: Record<string, string> = {
  foundation: 'Foundation',
  base:       'Base',
  build:      'Build',
  peak:       'Peak',
  taper:      'Taper',
}

/**
 * Builds the prompt for the Plan-screen weekly voice card.
 *
 * Output contract (parsed by route):
 *   HEADLINE: <one sentence — the week's job>
 *   ITEM: <one line — the priority session>
 *   ITEM: <optional second line — pacing/recovery cue>
 *
 * The model is instructed to emit exactly this format. The route falls back to
 * the rule-engine voice on parse failure (silent degrade per ADR-006).
 */
export function buildPlanWeeklyNotePrompt(input: PlanWeeklyNotePromptInput): string {
  const {
    weekN, phase, weeksToRace, raceName, raceDistance,
    sessions, firstName, athleteContext, previousWeeklyNote,
  } = input

  const phaseLabel = phase ? (PHASE_LABELS[phase] ?? phase) : null

  const voiceHeader = buildVoiceHeader({
    role:              'writing the week-ahead voice card for the plan',
    outputConstraint:  'One HEADLINE line and one or two ITEM lines. No other text. No markdown.',
    includeVoiceAnchor: true,
    firstName,
  })

  const sessionList = sessions.length === 0
    ? 'All rest / no run sessions this week.'
    : sessions
        .map(s => {
          const dist = s.distanceKm != null && s.distanceKm > 0
            ? ` · ${s.distanceKm.toFixed(s.distanceKm < 10 ? 1 : 0)}km`
            : ''
          return `${s.day}: ${s.type}${dist}`
        })
        .join('\n')

  const raceLine = weeksToRace !== null
    ? weeksToRace === 0
      ? `Race week${raceName ? ` (${raceName})` : ''}.`
      : weeksToRace === 1
        ? `1 week to race${raceName ? ` (${raceName})` : ''}.`
        : `${weeksToRace} weeks to race${raceName ? ` (${raceName})` : ''}.`
    : 'No race date set.'

  const dataBlock = [
    `Week ${weekN}${phaseLabel ? ` — ${phaseLabel} phase` : ''}`,
    raceLine,
    raceDistance ? `Race distance: ${raceDistance}` : null,
    '',
    'Sessions this week:',
    sessionList,
  ].filter(v => v !== null).join('\n')

  const previousBlock = previousWeeklyNote
    ? `

Previous week's note (use only for continuity, never quote verbatim):
- Week ${previousWeeklyNote.weekN} headline: "${previousWeeklyNote.headline}"
- Items: ${previousWeeklyNote.items.map(i => `"${i}"`).join(' / ')}

Continuity rule: reference last week's framing AT MOST ONCE, only when this week tracks against it — e.g. last week emphasised easy discipline and this week's quality session lands on top of it, or last week was a deload and this week reintroduces volume. Never reference gratuitously.`
    : ''

  const instructions = `
Write the week-ahead voice card. Rules:
- HEADLINE: one sentence naming the week's job in plain words (e.g. "Quality and long run this week. Hard stuff first.").
- ITEM lines: each is one short coaching cue. Prefer the priority session ("Run the quality session when fresh.") and/or one pacing/recovery cue ("Easy runs must be conversational — no exceptions.").
- Maximum TWO item lines. One is fine.
- Honest and specific. Reference the actual session shape — name a day or type when it helps.
- Never start an ITEM with "Tip:" or "Remember:". Just say it.
- Race week: address the race; everything else is execution detail.
- Deload / rest-heavy week: name the restraint, don't apologise for it.

Output EXACTLY this format. Nothing else.

HEADLINE: ...
ITEM: ...
ITEM: ...`

  return `${voiceHeader}
${athleteContext ?? ''}${previousBlock}

${dataBlock}
${instructions}`
}

/**
 * Parses the structured response from the Plan weekly note prompt.
 * Returns null on parse failure — the route falls back to rule-engine voice.
 */
export function parsePlanWeeklyNoteResponse(raw: string): { headline: string; items: string[] } | null {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  let headline: string | null = null
  const items: string[] = []

  for (const line of lines) {
    if (line.toUpperCase().startsWith('HEADLINE:')) {
      headline = line.slice('HEADLINE:'.length).trim()
    } else if (line.toUpperCase().startsWith('ITEM:')) {
      const item = line.slice('ITEM:'.length).trim()
      if (item) items.push(item)
    }
  }

  if (!headline) return null
  return { headline, items: items.slice(0, 2) }
}
