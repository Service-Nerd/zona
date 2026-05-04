import type { Session, Plan } from '@/types/plan'
import type { Verdict } from '../sessionScore'
import type { CohortSummary } from '../runHistory'
import { buildVoiceHeader } from './voiceRules'

export interface SessionFeedbackPromptInput {
  session: Session
  weekN: number
  plan: Plan
  verdict: Verdict
  actualDistKm: number
  actualAvgHr: number | null
  /** Actual average pace in seconds per km — derived from avg_speed. Null if unavailable. */
  actualPaceSecPerKm?: number | null
  hrInZonePct: number | null
  hrAboveCeilingPct: number | null
  efTrendPct: number | null
  rpe: number | null
  fatigueTag: string | null
  /** Training phase at time of session — e.g. "base", "build", "peak", "taper". */
  weekPhase?: string | null
  /** Prescribed zone label for this session — e.g. "Zone 2", "Zone 3", "Zone 4–5". */
  prescribedZoneLabel?: string | null
  /** Prescribed HR band — for quality/intervals where the session has a target range, not just a ceiling. */
  prescribedHrBand?: { lo: number; hi: number } | null
  /** Past-self cohort summary (R25 cut #1) — null when fewer than MIN_COHORT_SIZE similar runs exist. */
  cohortContext?: CohortSummary | null
  /** True when this is the athlete's first ever analysed session — prompt gets a softer welcome frame. */
  isFirstAnalysis?: boolean
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

Example 8 — easy run, no HR recorded:
Input: Easy run (Zone 2), 9km, HR: not recorded, RPE 5, verdict: close
Output: "No HR data — RPE 5 on an easy run is a hair high. Easy effort should feel almost embarrassingly slow. Get the HR monitor on next time: without it, you're guessing at a zone you can't see."

Example 9 — recovery run, nailed:
Input: Recovery (Zone 1, ≤130), 5km, avg HR 128, 87% in zone, RPE 2, verdict: nailed
Output: "Recovery done right — HR stayed low, effort was genuinely easy. These feel pointless, which is exactly the point. Don't make them harder."

Example 10 — first ever analysed session, easy run, solid:
Input: Easy run (Zone 2, ≤148), 7km, avg HR 144, 88% in zone, RPE 4, verdict: nailed. FIRST SESSION.
Output: "Good start. HR stayed where it needed to and effort was honest — that's the whole job on an easy day. The picture gets clearer each run from here."
`

export function buildSessionFeedbackPrompt(input: SessionFeedbackPromptInput): string {
  const { session, weekN, plan, verdict,
    actualDistKm, actualAvgHr, actualPaceSecPerKm, hrInZonePct, hrAboveCeilingPct,
    efTrendPct, rpe, fatigueTag, weekPhase,
    prescribedZoneLabel, prescribedHrBand, cohortContext,
    isFirstAnalysis } = input

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

  // Past-self cohort block (CoachingPrinciples §58). Empty string when no cohort.
  const cohortBlock = cohortContext
    ? `
Past-self cohort — your last ${cohortContext.cohortSize} similar runs (matched on distance ±15% and HR band):
- Avg HR: ${cohortContext.avgHr ?? '—'} bpm
- Avg pace: ${cohortContext.avgPaceSecPerKm ? formatPaceSec(cohortContext.avgPaceSecPerKm) : '—'}
- Avg in-zone: ${cohortContext.avgInZonePct !== null ? `${cohortContext.avgInZonePct}%` : '—'}
- Typical distance: ${cohortContext.medianDistanceKm.toFixed(1)}km

If today's numbers diverge meaningfully from this cohort (HR ±5 bpm, pace ±10s/km, in-zone ±15%), reference the comparison directly in your feedback. Don't speculate causes — observation only.
`
    : ''

  const voiceHeader = buildVoiceHeader({
    role: 'giving session feedback',
    outputConstraint: 'One paragraph only — 2–4 sentences max.',
  })

  const paceLine = actualPaceSecPerKm
    ? `Actual pace: ${formatPaceSec(actualPaceSecPerKm)}/km avg`
    : ''

  const firstRunNote = isFirstAnalysis
    ? '\nFirst session context: This is the athlete\'s first ever analysed run. Keep the welcome implicit — one sentence that acknowledges a start, then get specific about the data. No hype. No "welcome to the journey" framing.\n'
    : ''

  return `${voiceHeader}

${FEW_SHOT_EXAMPLES}
${firstRunNote}
Now write feedback for this session:

Race context: ${raceContext}
Week: ${weekN} of ${plan.weeks.length}${weekPhase ? ` — ${weekPhase} phase` : ''}

Session type: ${session.type} (${session.label})
Planned distance: ${session.distance_km ? `${session.distance_km}km` : 'not set'}
Actual distance: ${actualDistKm.toFixed(1)}km
${paceLine ? paceLine + '\n' : ''}${hrLine}
${efLine ? efLine + '\n' : ''}RPE: ${rpe !== null ? rpe : 'not logged'}
Fatigue: ${fatigueTag ?? 'not logged'}
Verdict: ${verdict}
${cohortBlock}
Write 2–4 sentences of honest, specific feedback. No headers. No bullet points. Plain text only.`
}

function formatPaceSec(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}
