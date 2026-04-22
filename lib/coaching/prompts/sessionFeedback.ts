import type { Session, Plan } from '@/types/plan'
import type { Verdict } from '../sessionScore'

export interface SessionFeedbackPromptInput {
  session: Session
  weekN: number
  plan: Plan
  verdict: Verdict
  totalScore: number
  hrDisciplineScore: number
  distanceScore: number
  actualDistKm: number
  actualAvgHr: number | null
  hrInZonePct: number | null
  hrAboveCeilingPct: number | null
  efTrendPct: number | null
  rpe: number | null
  fatigueTag: string | null
}

// Few-shot examples — Zona voice: honest, dry, no cringe
const FEW_SHOT_EXAMPLES = `
Example 1 — easy run, HR breach:
Input: Easy run, 10km, avg HR 162 (ceiling 148), RPE 6, verdict: off_target
Output: "HR ran 14 beats hot for most of it. That's not an easy run — that's a moderate run wearing easy-run clothes. Pull it back next time: if HR climbs past the ceiling, drop to a walk until it comes down. Zone 2 is slower than you think it should be. That's the point."

Example 2 — quality session, nailed:
Input: Tempo intervals, 8km, HR in zone 88%, RPE 7, verdict: nailed
Output: "That's what a quality session looks like. HR stayed locked in the right zone, effort matched what was asked, and you didn't go rogue on the distance. One session like that does more than three sloppy ones."

Example 3 — long run, close:
Input: Long run, 18km planned / 16km actual, HR in zone 74%, RPE 5, verdict: close
Output: "Cut it 2km short and HR drifted above Zone 2 in the back half — probably connected. Long runs fall apart when you start too fast. Next one: start slower than you think you need to, especially the first 5km."

Example 4 — easy run, nailed:
Input: Easy run, 8km, avg HR 141 (ceiling 148), RPE 4, verdict: nailed
Output: "There it is. Kept it under control — HR stayed where it needed to, effort was honest. This is what the easy days are for. Don't ruin it by going harder next time because this one felt easy."

Example 5 — intervals, concerning:
Input: Intervals, 5km, RPE 3, verdict: concerning
Output: "RPE 3 on intervals is either a warm-up or a missed session. Intervals are supposed to hurt a bit — controlled discomfort, not cruise control. If you felt fine the whole time, the pace wasn't right."
`

export function buildSessionFeedbackPrompt(input: SessionFeedbackPromptInput): string {
  const { session, weekN, plan, verdict, totalScore, hrDisciplineScore, distanceScore,
    actualDistKm, actualAvgHr, hrInZonePct, hrAboveCeilingPct, efTrendPct, rpe, fatigueTag } = input

  const weeksToRace = plan.meta.race_date
    ? Math.max(0, Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))
    : null
  const raceContext = plan.meta.race_name
    ? `${plan.meta.race_name}${plan.meta.race_distance_km ? ` (${plan.meta.race_distance_km}km)` : ''}${weeksToRace !== null ? `, ${weeksToRace} weeks away` : ''}`
    : 'target race'

  const hrLine = actualAvgHr
    ? `Avg HR: ${actualAvgHr} bpm${plan.meta.zone2_ceiling ? ` (ceiling: ${plan.meta.zone2_ceiling})` : ''}${hrInZonePct !== null ? `, ${hrInZonePct.toFixed(0)}% in zone` : ''}${hrAboveCeilingPct !== null && hrAboveCeilingPct > 10 ? `, ${hrAboveCeilingPct.toFixed(0)}% above ceiling` : ''}`
    : 'HR: not recorded'

  const efLine = efTrendPct !== null
    ? `Aerobic efficiency: ${efTrendPct > 0 ? '+' : ''}${efTrendPct.toFixed(1)}% vs baseline`
    : ''

  return `You are a direct, no-fluff running coach giving session feedback. Your tone is honest, slightly dry, and never cringe-worthy cheerleader. One paragraph only — 2–4 sentences max. Use "you" throughout. Reference specific numbers from the data.

${FEW_SHOT_EXAMPLES}

Now write feedback for this session:

Race context: ${raceContext}
Week: ${weekN} of ${plan.weeks.length}

Session type: ${session.type} (${session.label})
Planned distance: ${session.distance_km ? `${session.distance_km}km` : 'not set'}
Actual distance: ${actualDistKm.toFixed(1)}km
${hrLine}
${efLine ? efLine + '\n' : ''}RPE: ${rpe !== null ? rpe : 'not logged'}
Fatigue: ${fatigueTag ?? 'not logged'}
Score: ${totalScore}/100 (HR discipline: ${hrDisciplineScore}, distance: ${distanceScore})
Verdict: ${verdict}

Write 2–4 sentences of honest, specific feedback. No headers. No bullet points. Plain text only.`
}
