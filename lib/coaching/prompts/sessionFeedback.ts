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
  /** Prescribed zone label for this session — e.g. "Zone 2", "Zone 3", "Zone 4–5". */
  prescribedZoneLabel?: string | null
  /** Prescribed HR band — for quality/intervals where the session has a target range, not just a ceiling. */
  prescribedHrBand?: { lo: number; hi: number } | null
}

// Few-shot examples — Zona voice: honest, dry, no cringe.
// Coverage: easy hot, easy nailed, quality nailed, quality drifted easy,
// quality overcooked, intervals nailed, intervals undercooked, long drift.
// The voice frames "right zone for the session", not "always Zone 2".
const FEW_SHOT_EXAMPLES = `
Example 1 — easy run, HR ran hot:
Input: Easy run (Zone 2, ≤148), 10km, avg HR 162, 38% in zone, RPE 6, verdict: off_target
Output: "HR ran 14 beats hot for most of it. That's not an easy run — that's a moderate run wearing easy-run clothes. Pull it back next time: if HR climbs past the ceiling, drop to a walk until it comes down. Zone 2 is slower than you think it should be. That's the point."

Example 2 — easy run, nailed:
Input: Easy run (Zone 2, ≤148), 8km, avg HR 141, 92% in zone, RPE 4, verdict: nailed
Output: "There it is. Kept it under control — HR stayed where it needed to, effort was honest. This is what the easy days are for. Don't ruin it by going harder next time because this one felt easy."

Example 3 — tempo, nailed:
Input: Tempo (Zone 3, 158–172), 8km, avg HR 165, 88% in band, RPE 7, verdict: nailed
Output: "That's what a quality session looks like. HR sat right in the band, effort matched what was asked, and you didn't go rogue on the distance. One session like that does more than three sloppy ones."

Example 4 — tempo, drifted easy:
Input: Tempo (Zone 3, 158–172), 6km, avg HR 149, 22% in band, RPE 5, verdict: off_target
Output: "That wasn't a tempo — that was a steady-state run with extra steps. HR sat 10 beats below the band for most of it. Quality sessions only count if you actually push into the zone. Next time, lock onto the pace target from the first km, don't ease into it."

Example 5 — intervals, undercooked:
Input: Intervals (Zone 4–5, 168+), 5km, avg HR 155, 35% in band, RPE 3, verdict: concerning
Output: "RPE 3 on intervals is either a warm-up or a missed session. Intervals are supposed to hurt — controlled discomfort, not cruise control. HR barely touched the zone. If you felt fine the whole time, the pace wasn't right."

Example 6 — intervals, nailed:
Input: Intervals (Zone 4–5, 168+), 6 × 800m, avg HR 174 during reps, 82% in band, RPE 9, verdict: nailed
Output: "Hit the band on every rep. That's the work. Now eat, sleep, and let the next two days do their job — sessions like this are only worth what you recover from."

Example 7 — long run, drifted hot:
Input: Long run (Zone 2, ≤148), 18km planned / 16km actual, avg HR 156, 41% in zone, RPE 5, verdict: close
Output: "Cut it 2km short and HR drifted above Zone 2 in the back half — probably connected. Long runs fall apart when you start too fast. Next one: start slower than you think you need to, especially the first 5km."
`

export function buildSessionFeedbackPrompt(input: SessionFeedbackPromptInput): string {
  const { session, weekN, plan, verdict, totalScore, hrDisciplineScore, distanceScore,
    actualDistKm, actualAvgHr, hrInZonePct, hrAboveCeilingPct, efTrendPct, rpe, fatigueTag,
    prescribedZoneLabel, prescribedHrBand } = input

  const weeksToRace = plan.meta.race_date
    ? Math.max(0, Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))
    : null
  const raceContext = plan.meta.race_name
    ? `${plan.meta.race_name}${plan.meta.race_distance_km ? ` (${plan.meta.race_distance_km}km)` : ''}${weeksToRace !== null ? `, ${weeksToRace} weeks away` : ''}`
    : 'target race'

  // Prescribed zone band: ceiling for Z2, range for Z3+.
  const zoneTarget = prescribedHrBand
    ? (prescribedZoneLabel?.includes('2')
        ? `≤${prescribedHrBand.hi}`
        : `${prescribedHrBand.lo}–${prescribedHrBand.hi}`)
    : (plan.meta.zone2_ceiling ? `≤${plan.meta.zone2_ceiling}` : null)
  const zoneStr = prescribedZoneLabel && zoneTarget ? `${prescribedZoneLabel}, ${zoneTarget}` : zoneTarget ?? null

  const hrLine = actualAvgHr
    ? `Avg HR: ${actualAvgHr} bpm${zoneStr ? ` (target: ${zoneStr})` : ''}${hrInZonePct !== null ? `, ${hrInZonePct.toFixed(0)}% in zone` : ''}${hrAboveCeilingPct !== null && hrAboveCeilingPct > 10 ? `, ${hrAboveCeilingPct.toFixed(0)}% above ceiling` : ''}`
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
