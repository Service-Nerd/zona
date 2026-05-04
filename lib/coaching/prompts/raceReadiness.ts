import { buildVoiceHeader } from './voiceRules'

export interface RaceReadinessPromptInput {
  raceName: string
  raceDistanceKm: number | null
  daysToRace: number
  // Plan-level aggregates
  totalPlannedSessions: number
  completedSessions: number
  // Zone discipline across easy + long sessions for the whole plan
  avgZoneDisciplinePct: number | null   // null = insufficient HR data
  // Aerobic efficiency trend: first 2 weeks vs last 2 weeks of the plan
  efTrendPct: number | null
  // Total km logged across entire plan
  totalLoadKm: number | null
  // Recent RPE pattern (last 3 weeks) — avg RPE on easy/recovery sessions
  recentEasyRpe: number | null          // null = no RPE logged
  // Current phase — lets the prompt know whether user is actually in taper
  currentPhase: string | null           // 'taper' | 'peak' | etc.
  firstName?: string | null
}

export function buildRaceReadinessPrompt(input: RaceReadinessPromptInput): string {
  const {
    raceName, raceDistanceKm, daysToRace,
    totalPlannedSessions, completedSessions,
    avgZoneDisciplinePct, efTrendPct, totalLoadKm,
    recentEasyRpe, currentPhase, firstName,
  } = input

  const voiceHeader = buildVoiceHeader({
    role:              'writing a pre-race readiness assessment',
    outputConstraint:  '2–3 sentences only. No headers. No bullet points. Plain text.',
    includeVoiceAnchor: false,
    firstName,
  })

  const completionRate = totalPlannedSessions > 0
    ? Math.round((completedSessions / totalPlannedSessions) * 100)
    : null

  const dataBlock = [
    `Race: ${raceName}${raceDistanceKm ? ` (${raceDistanceKm}km)` : ''}`,
    `Days to race: ${daysToRace}`,
    `Current training phase: ${currentPhase ?? 'unknown'}`,
    completionRate !== null
      ? `Session completion across full plan: ${completionRate}% (${completedSessions}/${totalPlannedSessions})`
      : 'Session completion: unknown',
    avgZoneDisciplinePct !== null
      ? `Zone discipline (easy + long sessions, full plan): ${avgZoneDisciplinePct.toFixed(0)}% in prescribed zone`
      : 'Zone discipline: insufficient HR data — assess on RPE if available',
    efTrendPct !== null
      ? `Aerobic efficiency trend (plan start vs recent): ${efTrendPct > 0 ? '+' : ''}${efTrendPct.toFixed(1)}%`
      : 'Aerobic efficiency trend: insufficient data',
    totalLoadKm !== null
      ? `Total training load logged: ${totalLoadKm.toFixed(0)}km`
      : null,
    recentEasyRpe !== null
      ? `Avg RPE on easy/recovery sessions (last 3 weeks): ${recentEasyRpe.toFixed(1)} / 10 ${recentEasyRpe > 5 ? '(elevated — easy days running hard)' : '(good — appropriate effort)'}`
      : 'RPE on easy days: not logged',
  ].filter(Boolean).join('\n')

  const instructions = `
Write a 2–3 sentence pre-race readiness assessment. Rules:
- The race window is now. No training advice — this is assessment only.
- Open with the most important signal from the data (zone discipline, or RPE if no HR data).
- Reference at least one specific number.
- Close with a single clear instruction for the next ${daysToRace} days.
  - If the data looks good: tell them the work is done, protect what's built, don't add.
  - If the data shows fatigue (elevated easy RPE, poor zone discipline): name it. Tell them protecting the taper is now the only job.
  - If data is sparse: give honest general taper guidance without inventing readiness you can't see.
- Tone: honest, calm, no cringe. This is a coach speaking before a race, not a cheerleader.
- No markdown. Plain text only.`

  return `${voiceHeader}

${dataBlock}
${instructions}`
}
