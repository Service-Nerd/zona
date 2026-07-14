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

import type { Session, Plan, RaceResult } from '@/types/plan'
import type { CohortSummary, TrendSeries } from '../runHistory'
import type { HrStreamSummary } from '../streamAnalysis'
import type { PaceFadeSummary } from '../paceAnalysis'
import type { LimiterHypothesis } from '../limiter'
import { limiterLabel } from '../limiter'
import { buildRaceNarrativeBlock } from '../raceNarrative'
import { LIMITER } from '../constants'
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
  /** Per-km pace fade (Strava splits_metric). Companion to streamSummary. */
  paceFadeSummary?: PaceFadeSummary | null
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

  /**
   * Strava-reported average temperature in °C. Null for HealthKit-sourced
   * runs and pre-migration Strava rows. When ≥22°C and the runner is
   * spiralling about HR or pace, the heat is often the explanation —
   * naming it costs nothing and protects the reframe from sounding tone-deaf.
   */
  tempC?: number | null

  /**
   * Deterministic limiter hypothesis. Same source as session feedback. In the
   * reframe context it feeds sentence 2 (CAUSE) — instead of generic "the
   * session was hard", Kit names what the rule engine thinks went sideways.
   * Only surfaced at medium/high confidence; low-confidence guesses would
   * undermine the reframe's authority.
   */
  limiter?: LimiterHypothesis | null

  /**
   * RACE-DEBRIEF-02 — the runner's own logged race account (`Week.result_embedded`).
   * Present only on a race session. Authoritative over device signals; for a
   * race it supplies the CAUSE (sentence 2) instead of HR/pace fade. §71.3.
   */
  raceResult?: RaceResult | null

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
    tempC,
    limiter,
    paceFadeSummary,
    raceResult,
  } = input

  // §71 — a race is debriefed, not scored. When the reflected session is a race,
  // the CAUSE (sentence 2) must not lean on HR drift / pace fade / zone
  // discipline; the athlete's own account of the race is the truth of it.
  const isRace = session.type === 'race'
  // §72 — an ultra-distance non-race effort (e.g. a 50km+ long run) is read as
  // time-on-feet: back-half fade is expected, so the CAUSE must not lean on it.
  const isUltraEffort = !isRace && actualDistKm != null && actualDistKm >= LIMITER.SUPPRESS_ULTRA_DISTANCE_KM
  const suppressFade = isRace || isUltraEffort
  // RACE-DEBRIEF-02 — the runner's logged account (authoritative) + un-gated
  // conditions on the race path. Both silently omit when absent.
  const raceNarrativeBlock = isRace ? buildRaceNarrativeBlock(raceResult) : ''
  // §72 — ultra non-race override for the CAUSE. Race efforts use RACE OVERRIDE.
  const ultraOverride = isUltraEffort
    ? `
ULTRA-DISTANCE EFFORT (${actualDistKm!.toFixed(0)}km) — for sentence 2 (CAUSE), do NOT cite back-half pace fade or late HR drift as a fault: over this distance that is expected physiology (glycogen depletion), not a failure. The cause is the distance itself, or what the runner's note names. Never tell them to "start slower".
`
    : ''
  const raceTempBlock = isRace
    ? (tempC != null
        ? `\nConditions: ${tempC.toFixed(0)}°C${tempC >= 28 ? ' (hot)' : tempC >= 22 ? ' (warm)' : tempC <= 0 ? ' (freezing)' : tempC <= 4 ? ' (cold)' : ''}. Heat slows everyone — if the runner's distress is about pace or HR, name the conditions as part of the cause; never frame the heat as a discipline failure.\n`
        : `\nConditions: temperature wasn't recorded. If the runner's account mentions the weather, trust it; don't invent a temperature.\n`)
    : ''

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

  const paceFadeBlock = paceFadeSummary
    ? `
Pace fade across the run (back half vs first half):
- First half: ${formatPaceSec(paceFadeSummary.firstHalfAvgPaceSecPerKm)}
- Back half:  ${formatPaceSec(paceFadeSummary.backHalfAvgPaceSecPerKm)}
- Fade: ${paceFadeSummary.paceFadeSecPerKm >= 0 ? '+' : ''}${paceFadeSummary.paceFadeSecPerKm}s/km${paceFadeSummary.sparse ? '  (minimum splits — treat as hint)' : ''}
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

  // Environmental context — only surface when it actually changes the read.
  // A reframe about HR running hot or pace feeling awful on a 28°C day is
  // a different reframe — and saying nothing about the heat is what makes
  // Kit sound like a dashboard rather than someone who's been there.
  const tempBlock = (tempC != null && (tempC >= 22 || tempC <= 4))
    ? `\nEnvironmental context: ${tempC.toFixed(0)}°C${tempC >= 28 ? ' (hot)' : tempC >= 22 ? ' (warm)' : tempC <= 0 ? ' (freezing)' : ' (cold)'}. If the runner's distress is about HR or pace and the heat plausibly explains it, name the temperature in sentence 2 as part of the cause — don't pretend it wasn't a factor.\n`
    : ''

  // Limiter hypothesis — drives sentence 2 (CAUSE) when present and confident.
  // Surfaced only at medium/high confidence; low-confidence in the reframe
  // context would undermine the reassurance — uncertainty is the wrong note
  // when the runner is already spiralling.
  const limiterBlock = (limiter && (limiter.confidence === 'high' || limiter.confidence === 'medium'))
    ? `\nLikely limiter (rule-engine hypothesis, ${limiter.confidence} confidence): ${limiterLabel(limiter.category)}.\nWhy: ${limiter.reasoning}.\n\nLimiter rule for the reframe: when present, this is the CAUSE for sentence 2. Name it directly — "today is your body settling that bill" / "the limiter looks like recovery, not fitness". Don't restate the reasoning verbatim — translate it. Confidence-high gets named as fact; confidence-medium gets named as hypothesis ("looks like…").\n`
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
${isRace ? `
RACE OVERRIDE — this session was a RACE, not a training run:
- Open (sentence 1) by acknowledging the race as an accomplishment. Finishing the distance is the achievement; the time is secondary. This is warmth-as-permission, not cheerleading.
- Override sentence 2 (CAUSE): do NOT cite HR drift, back-half pace fade, or zone discipline as a fault. A race is run at race effort, and fading over race distance — especially long or ultra — is expected physiology, not a failure. If the runner's note names what actually happened (an injury, the heat, a tactical decision), THAT is the cause — reflect it honestly. Never contradict their account, and never tell them to do something they already did (e.g. "start conservatively" when they did).
- The mandatory "named data point" for sentence 2 may be the runner's own stated cause or the race distance/effort — it does not have to be a device metric here.
${raceNarrativeBlock}` : ''}${ultraOverride}
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
${trendBlock}${cohortBlock}${suppressFade ? '' : streamBlock}${suppressFade ? '' : paceFadeBlock}${previousSimilarBlock}${completionBlock}${rpeBlock}${phaseBlock}${sessionsLoggedBlock}${isRace ? raceTempBlock : tempBlock}${suppressFade ? '' : limiterBlock}
Write the reframe now. 3-4 sentences. Plain text only. No headers.`
}

function formatPaceSec(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}
