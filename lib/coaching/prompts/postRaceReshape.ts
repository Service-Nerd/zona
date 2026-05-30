/**
 * Prompt builder for post-race reshape enrichment (AI-DEPTH-08).
 *
 * Generates:
 *   1. A summary paragraph (2–3 sentences) for the PostRaceReshapeCard.
 *   2. Per-week theme overrides and per-session coach notes for recovery weeks.
 *
 * Model: ANTHROPIC_MODEL_DEEP (Sonnet) — this requires plan-shaped reasoning
 * across multiple weeks and a race result with varied outcome branches.
 *
 * Voice spec:
 *   - Honest, dry, specific. Never cheerleader.
 *   - Acknowledge what actually happened (outcome, notes, what broke/worked).
 *   - Recovery notes should be low-key: "Walk if it hurts." not "Rest up!"
 *   - First quality session back gets a specific note: "Legs will feel it. Go easy."
 *   - DNF tone: matter-of-fact, not consoling. "Didn't finish. That's the data."
 *   - PB tone: acknowledge it, don't hype it. "There it is. Now rest."
 *
 * Output format: strict JSON — the route parses this directly.
 */

import type { Plan, RaceResult, Week } from '@/types/plan'
import type { DistanceBucket } from '@/lib/coaching/postRaceReshape'

export interface PostRaceReshapePromptContext {
  plan: Plan
  result: RaceResult
  raceWeekN: number         // 1-indexed
  weeksAffected: number[]   // 1-indexed week numbers modified by rule engine
  distanceBucket: DistanceBucket
  peakWeeklyKm: number
  reshapedWeeks: Week[]     // the already-reshaped weeks (rule engine output)
}

export interface PostRaceReshapeAIOutput {
  /** 2–3 sentence reshape summary shown on PostRaceReshapeCard. */
  summary: string
  /** Per-week enrichment — only weeks in weeksAffected. */
  week_enrichments: Array<{
    week_n: number
    theme?: string  // optional override — use if the rule-engine theme is too generic
    session_notes: Array<{
      day: string            // 'mon' | 'tue' | ... | 'sun'
      coach_notes: string[]  // 1–2 items max. First-quality-back gets special note.
    }>
  }>
}

function outcomeLabel(outcome: RaceResult['outcome']): string {
  switch (outcome) {
    case 'pb':         return 'personal best'
    case 'on_target':  return 'on target'
    case 'off_target': return 'off target'
    case 'dnf':        return 'did not finish'
    default:           return 'completed'
  }
}

function formatTime(t?: string): string {
  return t ?? 'not logged'
}

export function buildPostRaceReshapePrompt(ctx: PostRaceReshapePromptContext): string {
  const { plan, result, raceWeekN, weeksAffected, distanceBucket, peakWeeklyKm, reshapedWeeks } = ctx
  const athlete = plan.meta.athlete ?? 'the runner'
  const raceName = plan.meta.race_name ?? 'the race'
  const raceDistKm = result.distance_km ?? plan.meta.race_distance_km

  const outcome = outcomeLabel(result.outcome)
  const finishTime = formatTime(result.finish_time)
  const rpe = result.rpe != null ? `${result.rpe}/10` : 'not logged'

  const notesBlock = [
    result.notes          && `Runner notes: "${result.notes}"`,
    result.what_worked    && `What worked: "${result.what_worked}"`,
    result.what_broke     && `What broke: "${result.what_broke}"`,
    result.fueling_outcome   && `Fueling: "${result.fueling_outcome}"`,
    result.strategy_outcome  && `Strategy: "${result.strategy_outcome}"`,
  ].filter(Boolean).join('\n')

  // Describe the reshaped weeks for the model
  const weekDescriptions = weeksAffected.map(wn => {
    const w = reshapedWeeks[wn - 1]
    if (!w) return null
    const sessions = Object.entries(w.sessions)
      .filter(([, s]) => s)
      .map(([day, s]) => `  ${day}: ${s!.type} ${s!.distance_km ? `(${s!.distance_km}km)` : ''}`)
      .join('\n')
    return `Week ${wn} — ${w.label ?? ''} — target ${w.weekly_km}km:\n${sessions}`
  }).filter(Boolean).join('\n\n')

  const firstQualityWeek = (() => {
    // First week outside the quality blackout window that has a quality session
    for (const wn of weeksAffected) {
      const w = reshapedWeeks[wn - 1]
      if (!w) continue
      const hasQuality = Object.values(w.sessions).some(
        s => s && ['quality', 'intervals', 'tempo', 'hard'].includes(s.type)
      )
      if (hasQuality) return wn
    }
    return null
  })()

  return `You are Kit, the ${raceName} running coach inside Zonna. Write recovery coaching content for ${athlete} after their ${raceDistKm}km race.

Race outcome: ${outcome}
Finish time: ${finishTime}
RPE: ${rpe}
${notesBlock ? `\n${notesBlock}` : ''}

The plan has been structurally reshaped — ${weeksAffected.length} weeks modified. Below are the reshaped weeks:

${weekDescriptions}

Peak weekly volume (pre-taper): ${peakWeeklyKm}km
Distance bucket: ${distanceBucket}
${firstQualityWeek ? `First quality session returns at week ${firstQualityWeek}.` : 'No quality sessions in the reshaped window.'}

Your job: write a summary and per-session coach notes. Follow these rules exactly:

VOICE:
- Honest. Dry. Specific. Never cheerleader. Never motivational.
- If outcome is 'personal best': acknowledge it briefly, move to recovery. "There it is. Now rest."
- If outcome is 'on_target': matter-of-fact. "Job done. Now recover properly."
- If outcome is 'off_target': honest without alarm. "Not the day. The training still landed."
- If outcome is 'did not finish': matter-of-fact, not consoling. "Didn't finish. That's the data. Rest first."
- Recovery week notes must be low-key, practical. "Walk if it hurts." not "Rest up, champion!"
- The first quality session back gets a specific, sober note. "Legs will feel strange. Let them."
- Max 2 coach_notes per session. Each under 12 words.

FORMAT:
Return valid JSON matching this exact schema. No preamble, no explanation, just the JSON object.

{
  "summary": "2–3 sentences. What happened, what the recovery looks like, what comes next. Dry tone.",
  "week_enrichments": [
    {
      "week_n": <number>,
      "theme": "<optional 1-sentence override for the week theme — omit if rule-engine theme is fine>",
      "session_notes": [
        { "day": "<mon|tue|wed|thu|fri|sat|sun>", "coach_notes": ["<note 1>", "<note 2 if needed>"] }
      ]
    }
  ]
}

Only include weeks from this list: ${JSON.stringify(weeksAffected)}
Only include sessions that exist in those weeks.
Output only the JSON object. No markdown fences.`
}
