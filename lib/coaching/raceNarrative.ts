/**
 * Race narrative — the runner's own account of a goal race.
 *
 * Doctrine (§71.3): a race is debriefed WITH the athlete, not scored from
 * device data. What the runner logged about the race — injury, heat, a
 * tactical call — is the truth of the day and OUTRANKS any classifier. This
 * module turns `Week.result_embedded` (RaceResult, captured by RaceResultSheet
 * / AI-DEPTH-08) into (a) a prompt block the coaching surfaces reflect, and
 * (b) an acute-injury flag the limiter reads to stay silent (§71.3).
 *
 * The injury vocabulary is a deliberately conservative heuristic. A false
 * positive only costs limiter silence — which for a race is the correct
 * default anyway — so we err toward flagging.
 */

import type { RaceResult } from '@/types/plan'

/** Injury/incident vocabulary matched against the runner's own race account. */
export const RACE_INJURY_KEYWORDS = [
  'injur', 'pulled', 'strain', 'tore', 'torn', 'tweak', 'rolled',
  'sprain', 'hamstring', 'calf', 'achilles', 'it band', 'itb',
  'gave out', 'gave way', 'went at', 'seized', 'blister',
] as const

function narrativeText(result: RaceResult | null | undefined): string {
  if (!result) return ''
  return [result.what_broke, result.notes, result.strategy_outcome]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/**
 * True when the runner's race account names an acute injury/incident. The
 * limiter reads this to stay silent — an injury-driven fade must never be
 * attributed to fitness or pacing (§71.3).
 */
export function raceInjuryFlagged(result: RaceResult | null | undefined): boolean {
  const text = narrativeText(result)
  if (!text) return false
  return RACE_INJURY_KEYWORDS.some(k => text.includes(k))
}

/**
 * Athlete-account block for a race debrief — the runner's own words about what
 * happened out there. Authoritative over any device signal. Returns '' when no
 * narrative was logged (the block silently omits, per the athleteContext
 * pattern). Only the fields the runner actually filled in are surfaced.
 */
export function buildRaceNarrativeBlock(result: RaceResult | null | undefined): string {
  if (!result) return ''
  const lines: string[] = []
  if (result.outcome)          lines.push(`- Outcome the runner logged: ${result.outcome}`)
  if (result.finish_time)      lines.push(`- Finish time: ${result.finish_time}`)
  if (result.notes)            lines.push(`- Notes: "${result.notes}"`)
  if (result.what_broke)       lines.push(`- What broke: "${result.what_broke}"`)
  if (result.what_worked)      lines.push(`- What worked: "${result.what_worked}"`)
  if (result.strategy_outcome) lines.push(`- Pacing / strategy: "${result.strategy_outcome}"`)
  if (result.fueling_outcome)  lines.push(`- Fueling: "${result.fueling_outcome}"`)
  if (!lines.length) return ''
  return `
The runner's own account of the race — this is what actually happened out there. It OUTRANKS any device signal: reflect it, never contradict it, and never tell them to do something they already did.
${lines.join('\n')}
`
}
