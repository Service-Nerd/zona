import { buildVoiceHeader } from './voiceRules'

export interface PhaseSummaryPromptInput {
  phaseEnded: string              // 'base' | 'build' | 'peak' | 'foundation'
  phaseNewName: string            // 'build' | 'peak' | 'taper'
  totalWeeksInPhase: number
  avgZoneDisciplinePct: number | null   // avg hr_in_zone_pct across easy+long sessions in phase
  efTrendPct: number | null             // EF trend from first to last week of phase (% change)
  completionRate: number | null         // sessions completed / sessions planned (0–1)
  totalLoadKm: number | null            // total actual km logged in phase
  firstName?: string | null
}

const PHASE_LABELS: Record<string, string> = {
  foundation: 'Foundation',
  base:       'Base',
  build:      'Build',
  peak:       'Peak',
  taper:      'Taper',
}

export function buildPhaseSummaryPrompt(input: PhaseSummaryPromptInput): string {
  const {
    phaseEnded, phaseNewName, totalWeeksInPhase,
    avgZoneDisciplinePct, efTrendPct, completionRate,
    totalLoadKm, firstName,
  } = input

  const phaseEndedLabel = PHASE_LABELS[phaseEnded] ?? phaseEnded
  const phaseNewLabel   = PHASE_LABELS[phaseNewName] ?? phaseNewName

  const voiceHeader = buildVoiceHeader({
    role:              'writing a phase-end training summary',
    outputConstraint:  '2–3 sentences only. No headers. No bullet points. Plain text.',
    includeVoiceAnchor: true,
    firstName,
  })

  const dataBlock = [
    `Phase just completed: ${phaseEndedLabel} (${totalWeeksInPhase} weeks)`,
    `Next phase: ${phaseNewLabel}`,
    avgZoneDisciplinePct !== null
      ? `Avg zone discipline (easy + long sessions): ${avgZoneDisciplinePct.toFixed(0)}% in prescribed zone`
      : 'Zone discipline: insufficient HR data',
    efTrendPct !== null
      ? `Aerobic efficiency trend across phase: ${efTrendPct > 0 ? '+' : ''}${efTrendPct.toFixed(1)}%`
      : 'Aerobic efficiency: insufficient data',
    completionRate !== null
      ? `Session completion rate: ${Math.round(completionRate * 100)}% of scheduled sessions`
      : 'Session completion: unknown',
    totalLoadKm !== null
      ? `Total load this phase: ${totalLoadKm.toFixed(0)}km`
      : null,
  ].filter(Boolean).join('\n')

  const instructions = `
Write a 2–3 sentence phase-end coaching note. Rules:
- Open with an honest assessment of what the data shows — good or bad, say it plainly.
- Reference at least one specific number (zone discipline %, efficiency trend, or completion rate).
- Close with a single forward-looking sentence about what the new phase requires — not hype, just what's next.
- If zone discipline was low (< 65%), name it directly. Don't soften it.
- If zone discipline was high (≥ 80%), acknowledge it and move on — don't dwell.
- Never say "phase is complete" or "congratulations". Just speak to what the data shows.
- No markdown. Plain text only.`

  return `${voiceHeader}

${dataBlock}
${instructions}`
}
