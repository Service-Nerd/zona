/**
 * Post-run reframe prompt builder (POST-RUN-REFRAME-01).
 *
 * The ONLY surface in Zonna where the voice extends beyond one sentence and is
 * permitted warmth-as-permission. This is the runner spiralling after a tough
 * session; the job is to give them the hug AND the truth, never one without
 * the other.
 *
 * Doctrine:
 * - 3-4 sentence output, fixed structure: ACKNOWLEDGE → CAUSE → PROGRESS (opt) → ANCHOR.
 * - Warmth lives in sentence 1, never the closer.
 * - Specific evidence in sentence 2 is mandatory — no reframe without it.
 * - The reframe degrades gracefully across data tiers (A/B/C). The tier is set
 *   by the caller (reframeTier.ts); the prompt adapts its evidence instructions
 *   accordingly.
 *
 * Risk-gate decision lives UPSTREAM in the route, not in this builder. If the
 * route decides the reframe should be silenced (overload flag fired), it does
 * NOT call this builder — it surfaces the warning copy directly.
 *
 * Canonical authority: docs/canonical/brand.md § Reframe Voice.
 * Regression suite: docs/canonical/reframe-golden-cases.md.
 */

import type { Session, Plan } from '@/types/plan'
import type { CohortSummary, TrendSeries } from '../runHistory'
import type { HrStreamSummary } from '../streamAnalysis'
import { buildVoiceHeader } from './voiceRules'
import type { ReframeTier } from '../reframeTier'

/** Builder version — bump when the prompt structure or instructions change.
 *  Persisted on session_reflections.reframe_prompt_version for regression tracking. */
export const REFRAME_PROMPT_VERSION = '1.0.0'

export interface SessionReframePromptInput {
  // The user's voice — required. Sanitised and length-capped by the route.
  userNote: string

  // Which evidence tier the reframe runs at. Drives instruction emphasis,
  // not data presence (data presence is independently optional below).
  tier: ReframeTier

  // Session identity
  session: Session
  weekN: number
  plan: Plan

  // Session execution — what just happened
  rpe: number | null
  fatigueTag: string | null
  actualDistKm: number | null
  actualAvgHr: number | null
  hrInZonePct: number | null
  hrAboveCeilingPct: number | null
  hrBelowFloorPct: number | null

  // Tier A enrichment (optional — render when present, regardless of tier label)
  cohortContext?: CohortSummary | null
  streamSummary?: HrStreamSummary | null
  /** Multi-month HR/pace trend at this distance (AI-DEPTH-03). Tier A only. */
  trendSeries?: TrendSeries | null

  // Tier B context (also useful at A)
  planCompletion?: {
    completed: number
    scheduled: number
    windowWeeks: number
  } | null
  recentRpePattern?: {
    sessionType: string
    recentAvg: number
    earlierAvg: number
    windowWeeks: number
  } | null
  /** Most recent prior same-type analysed session (AI-DEPTH-10 pattern). */
  previousSimilarSession?: {
    dayLabel: string
    daysAgo: number
    verdict: string | null
    hrInZonePct: number | null
  } | null

  // Tier C — structural anchors
  phasePosition?: {
    phase: string
    weekInPhase: number
    totalWeeksInPhase: number
  } | null
  totalSessionsLogged?: number | null

  // Athlete colour — from buildAthleteContext, empty string when no traits captured
  athleteContext?: string

  // First name — passed through buildVoiceHeader for "once-if-natural" use
  firstName?: string | null
}

// Few-shot examples. These are the canonical voice teachers — derived from
// docs/canonical/reframe-golden-cases.md and the brand.md § Reframe Voice
// good examples. Coverage: one per tier, plus tier-A variants.
const FEW_SHOT_EXAMPLES = `
Example 1 — Tier A — easy went hot earlier in week, today's easy ran below zone (spiral):
Runner said: "the 2nd run of the week and it feels awful. I feel worse than i ever have, questioning if im good enough and i feel a failure. I feel i cant make the goal."
Inputs: Easy run today, 80min, 47% below zone ceiling. Tuesday's easy was 80% above ceiling. Race in 7 weeks.
Output: "You're not failing, even though it feels like it. Tuesday was 80% above your zone ceiling — today is your body settling that bill, not a verdict on the race. The work underneath is happening: you've stayed consistent through a tough block, and that's the fitness you'll lean on. Seven weeks to race day."

Example 2 — Tier A — long run felt awful but cohort says fitness improving:
Runner said: "Worst long run in months. I can't do this."
Inputs: Long run, 22km, RPE 8. Cohort: last 5 similar long runs avg HR 168, today 162. Race in 12 weeks.
Output: "You're allowed a bad one — it isn't the verdict it feels like. Your HR on this distance came in 6 bpm lower than the average of your last 5 similar long runs, so the engine is getting stronger even when the legs aren't agreeing. The consistency over the last 6 weeks is exactly what you're building on. Twelve weeks to race day."

Example 3 — Tier A — tempo missed target, cohort says progression real:
Runner said: "Missed by 5 seconds. The plan's wrong for me."
Inputs: Tempo, target 4:30/km, actual 4:35/km. Cohort: same tempo 3 months ago, avg 4:53/km. Race in 6 weeks.
Output: "Don't take that to heart — one tempo isn't the story. Five seconds off is execution, and three months ago this same effort would have been 18 seconds slower. The progression is real even when one session doesn't land. Six weeks to race day."

Example 4 — Tier B — easy felt hard after big week, no Strava connected:
Runner said: "Why was that so hard? Doubting if I'm running the right plan."
Inputs: Easy 8km, RPE 7. Yesterday: intervals, RPE 8. Last 4 weeks: 22/24 sessions done, easy-day RPE trended 7-8 → 5-6. Half marathon in 7 weeks.
Output: "Hard week catching up — that's signal, not a verdict on the plan. Yesterday's intervals at RPE 8 means today was always going to feel heavy. Your easy-day RPE has trended from 7-8 down to 5-6 over the last 4 weeks — the engine is adapting. Seven weeks to race day."

Example 5 — Tier C — new user, week 2, minimum data:
Runner said: "Shouldn't this be easier? Am I running the wrong plan?"
Inputs: Easy 5km, RPE 7. Total sessions logged: 3. Week 2 of 6, base phase. 10K race in 6 weeks.
Output: "You're not running the wrong plan — week 2 is exactly when this hits. The body takes a few weeks to settle into a new rhythm before 'easy' actually feels easy. You've logged 3 of 4 sessions so far, and that's what compounds. Six weeks to your 10K."
`

export function buildSessionReframePrompt(input: SessionReframePromptInput): string {
  const {
    userNote,
    tier,
    session,
    weekN,
    plan,
    rpe,
    fatigueTag,
    actualDistKm,
    actualAvgHr,
    hrInZonePct,
    hrAboveCeilingPct,
    hrBelowFloorPct,
    cohortContext,
    streamSummary,
    trendSeries,
    planCompletion,
    recentRpePattern,
    previousSimilarSession,
    phasePosition,
    totalSessionsLogged,
    athleteContext,
    firstName,
  } = input

  // Race anchor — drives sentence 4
  const weeksToRace = plan.meta.race_date
    ? Math.max(0, Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))
    : null
  const raceContext = plan.meta.race_name
    ? `${plan.meta.race_name}${plan.meta.race_distance_km ? ` (${plan.meta.race_distance_km}km)` : ''}${weeksToRace !== null ? `, ${weeksToRace} weeks away` : ''}`
    : null
  const anchorInstruction = raceContext
    ? `Sentence 4 (anchor): name the race ("${plan.meta.race_name}") and the time-to-race (${weeksToRace !== null ? `${weeksToRace} weeks` : 'unknown'}). Factual, not motivational.`
    : `Sentence 4 (anchor): there is no race set — anchor to the next session or "next easy day". Factual, not motivational.`

  // Session block — what just happened
  const hrLine = actualAvgHr
    ? `Avg HR: ${actualAvgHr} bpm${hrInZonePct !== null ? `, ${hrInZonePct.toFixed(0)}% in zone` : ''}${hrAboveCeilingPct !== null && hrAboveCeilingPct > 10 ? `, ${hrAboveCeilingPct.toFixed(0)}% above ceiling` : ''}${hrBelowFloorPct !== null && hrBelowFloorPct > 10 ? `, ${hrBelowFloorPct.toFixed(0)}% below floor` : ''}`
    : 'HR: not recorded'

  // Tier A evidence — render when data is present
  const cohortBlock = cohortContext
    ? `
Past-self cohort — your last ${cohortContext.cohortSize} similar runs (matched on distance ±15% and HR band):
- Avg HR: ${cohortContext.avgHr ?? '—'} bpm
- Avg pace: ${cohortContext.avgPaceSecPerKm ? formatPaceSec(cohortContext.avgPaceSecPerKm) : '—'}
- Avg in-zone: ${cohortContext.avgInZonePct !== null ? `${cohortContext.avgInZonePct}%` : '—'}
- Typical distance: ${cohortContext.medianDistanceKm.toFixed(1)}km
`
    : ''

  // Multi-month HR/pace trend at same distance band. Render only when the
  // series actually crosses the delta threshold — sub-threshold series are
  // noise, not signal. (AI-DEPTH-03)
  const trendBlock = trendSeries && (trendSeries.hrIsTrending || trendSeries.paceIsTrending)
    ? `
Multi-month trend — ${trendSeries.sessionType} runs at ${trendSeries.distanceKm.toFixed(1)}km (±15%) over the last ${trendSeries.windowMonths} months:
${trendSeries.buckets.map(b => `- ${b.shortLabel}: avg HR ${b.avgHr ?? '—'} bpm${b.avgPaceSecPerKm ? `, avg pace ${formatPaceSec(b.avgPaceSecPerKm)}` : ''} (${b.cohortSize} run${b.cohortSize === 1 ? '' : 's'})`).join('\n')}
${trendSeries.hrIsTrending && trendSeries.hrDeltaBpm !== null
  ? `Direction: HR has ${trendSeries.hrDeltaBpm < 0 ? 'dropped' : 'risen'} ${Math.abs(trendSeries.hrDeltaBpm)} bpm over the window at this distance.`
  : ''}${trendSeries.paceIsTrending && trendSeries.paceDeltaSec !== null
  ? `\nDirection: Pace has ${trendSeries.paceDeltaSec < 0 ? 'improved' : 'slowed'} ${Math.abs(trendSeries.paceDeltaSec)}s/km over the window.`
  : ''}

Trend rule: if HR has dropped (or pace has improved) over the window, this is the strongest "engine getting stronger" evidence available. Cite it in sentence 3 (progress) — quote specific numbers. If the direction is the wrong way (HR rising, pace slowing) at this same distance, the rule engine will normally fire a risk flag; this block won't appear under reframe-positive conditions.
`
    : ''

  const streamBlock = streamSummary
    ? `
HR drift across the run (back third vs first third):
- First third avg HR: ${streamSummary.firstThirdAvgHr} bpm
- Last third avg HR: ${streamSummary.lastThirdAvgHr} bpm
- Drift: ${streamSummary.hrDriftBpm >= 0 ? '+' : ''}${streamSummary.hrDriftBpm} bpm (${streamSummary.hrDriftPct >= 0 ? '+' : ''}${(streamSummary.hrDriftPct * 100).toFixed(1)}%)${streamSummary.sparse ? '\n- Sample density: sparse — use as a hint, not a hard signal' : ''}
`
    : ''

  // Tier B evidence — plan-side patterns
  const completionBlock = planCompletion
    ? `
Plan completion — last ${planCompletion.windowWeeks} weeks:
- ${planCompletion.completed} of ${planCompletion.scheduled} scheduled sessions completed
`
    : ''

  const rpeBlock = recentRpePattern
    ? `
Recent RPE pattern on ${recentRpePattern.sessionType} sessions — last ${recentRpePattern.windowWeeks} weeks:
- Earlier average: ${recentRpePattern.earlierAvg.toFixed(1)}
- Recent average: ${recentRpePattern.recentAvg.toFixed(1)}
- Trend: ${recentRpePattern.recentAvg < recentRpePattern.earlierAvg ? 'descending (adaptation)' : recentRpePattern.recentAvg > recentRpePattern.earlierAvg ? 'rising (accumulating)' : 'flat'}
`
    : ''

  const previousSimilarBlock = previousSimilarSession
    ? `
Most recent same-type session (single specific run, not averaged):
- ${previousSimilarSession.dayLabel}, ${previousSimilarSession.daysAgo} day${previousSimilarSession.daysAgo === 1 ? '' : 's'} ago
- Verdict: ${previousSimilarSession.verdict ?? 'unknown'}${previousSimilarSession.hrInZonePct != null ? `, ${previousSimilarSession.hrInZonePct.toFixed(0)}% in zone` : ''}
`
    : ''

  // Tier C structural anchors
  const phaseBlock = phasePosition
    ? `
Plan phase: ${phasePosition.phase} — week ${phasePosition.weekInPhase} of ${phasePosition.totalWeeksInPhase} in this phase
`
    : ''

  const sessionsLoggedBlock = totalSessionsLogged != null
    ? `Total sessions logged in this plan so far: ${totalSessionsLogged}\n`
    : ''

  // Tier-specific instruction layer — varies the evidence emphasis
  const tierInstruction = tier === 'A'
    ? `EVIDENCE TIER: A (full history). Sentences 2 and 3 should reach for the most specific numerical claim available — cohort comparison, drift, or recent pattern. Quote actual numbers.`
    : tier === 'B'
      ? `EVIDENCE TIER: B (plan + RPE only, no activity history). No cohort/trend/drift available. Sentences 2 and 3 should anchor on plan completion and RPE patterns. Quote actual counts and trend direction.`
      : `EVIDENCE TIER: C (minimum data, new user). No cohort, no RPE pattern. Sentence 2 should name a structural cause (week-in-phase, new-rhythm adaptation). Sentence 3 may be omitted — 3 sentences is acceptable at this tier. Sentence 4 anchors to the goal or next session.`

  const voiceHeader = buildVoiceHeader({
    role: 'writing a post-run reframe — the ONE surface where Zonna gets to give the runner the hug AND the truth',
    outputConstraint: '3-4 sentences max, fixed structure (acknowledge → cause → progress → anchor). Never 5 or more.',
    firstName,
  })

  return `${voiceHeader}
${athleteContext ?? ''}

REFRAME JOB — DIFFERENT FROM REGULAR FEEDBACK.
The runner just logged a difficult session and shared how they felt about it. They are often spiralling — questioning the plan, the goal, their ability. Your job is the reframe: warmth-as-permission + truth from the data + connection to the goal. Read the structure carefully.

STRUCTURE (strict — every reframe follows this):
1. ACKNOWLEDGE — warmth-as-permission. Validates the FEELING without endorsing the spiral. Examples: "You're allowed a bad one." / "Hard week catching up." / "Don't take that to heart." / "You're not failing, even though it feels like it." NEVER cheerleading — never "You're crushing it!" / "Don't give up!" / "You've got this!". The line: permission gives the runner the right to feel what they feel. Cheerleading tells them how to feel.
2. CAUSE — name what the data actually says happened in THIS session. Specific, named. One named number or fact from the inputs below.
3. PROGRESS (optional — include only when evidence supports it) — where the work IS paying off. Use the evidence blocks below. Numerical at Tier A, pattern-based at Tier B, omit at Tier C.
4. ANCHOR — return to the goal at the right altitude. Factual, never motivational. ${anchorInstruction}

HARD RULES:
- Specific evidence in sentence 2 is mandatory. No reframe without one named data point from the session or recent history.
- Warmth lives in sentence 1, never the closer. No "You've got this." No "Keep going." No "Hold the zone next session." as the closer.
- 3 sentences when there's no progress evidence to surface, 4 when there is. NEVER more than 4.
- Plain prose only — no headers, no bullet points, no markdown.
- The runner's own words are sacred. Don't quote them back; don't paraphrase. Respond to the feeling underneath.

${tierInstruction}

${FEW_SHOT_EXAMPLES}

Now write the reframe for this runner:

Runner said: "${userNote}"

Session type: ${session.type} (${session.label})
Week: ${weekN} of ${plan.weeks.length}
Planned distance: ${session.distance_km ? `${session.distance_km}km` : 'not set'}
Actual distance: ${actualDistKm !== null ? `${actualDistKm.toFixed(1)}km` : 'not logged'}
${hrLine}
RPE: ${rpe !== null ? rpe : 'not logged'}
Fatigue: ${fatigueTag ?? 'not logged'}
${raceContext ? `Race: ${raceContext}` : 'Race: none set'}
${trendBlock}${cohortBlock}${streamBlock}${previousSimilarBlock}${completionBlock}${rpeBlock}${phaseBlock}${sessionsLoggedBlock}
Write the reframe now. 3-4 sentences. Plain text only. No headers.`
}

function formatPaceSec(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}
