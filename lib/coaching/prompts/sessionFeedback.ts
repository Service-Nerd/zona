import type { Session, Plan, RaceResult } from '@/types/plan'
import type { Verdict } from '../sessionScore'
import type { CohortSummary } from '../runHistory'
import type { HrStreamSummary } from '../streamAnalysis'
import type { PaceFadeSummary } from '../paceAnalysis'
import type { LimiterHypothesis } from '../limiter'
import { limiterLabel } from '../limiter'
import { buildRaceNarrativeBlock } from '../raceNarrative'
import { LIMITER } from '../constants'
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
  /** Pre-built athlete profile block (from buildAthleteContext). Empty string when no traits captured. */
  athleteContext?: string
  /** AI-DEPTH-02 — back-third-vs-first-third HR drift summary. Null on Strava-sourced runs (no per-sample HR persisted yet) and on sample-starved runs. */
  streamSummary?: HrStreamSummary | null
  /**
   * First-half vs back-half average pace, from Strava's splits_metric.
   * Companion to streamSummary — HR drift answers "did the engine push?",
   * pace fade answers "did the legs hold?". Null for HealthKit-sourced runs
   * (no per-km splits), manual rows, and pre-migration Strava rows.
   */
  paceFadeSummary?: PaceFadeSummary | null
  /** AI-DEPTH-10 — most recent prior analysed session of the SAME type (single specific run, distinct from the averaged cohort). Null when no same-type analysis exists in history. */
  previousSimilarSession?: {
    dayLabel:    string
    daysAgo:     number
    verdict:     string | null
    hrInZonePct: number | null
  } | null
  /**
   * Strava-reported average temperature in °C. Null for HealthKit-sourced
   * runs and pre-migration Strava rows. When present and warm/hot, the
   * prompt instructs Kit to factor heat into the read — a run with HR
   * 10bpm above ceiling in 28°C is execution noise, not an execution
   * failure, and the feedback should reflect that.
   */
  tempC?: number | null
  /**
   * Deterministic limiter hypothesis from lib/coaching/limiter.ts. When
   * present and confidence is medium/high, the prompt instructs Kit to
   * name the limiter as part of the read. Null when no signal crosses
   * a defensible threshold (manual loggers with no fatigue tag, etc.).
   */
  limiter?: LimiterHypothesis | null
  /**
   * RACE-DEBRIEF-02 — the runner's own logged account of the race
   * (`Week.result_embedded`). Present only on a race session. Authoritative
   * over device signals; drives the race-debrief block. §71.3.
   */
  raceResult?: RaceResult | null
}

// Few-shot examples — Zonna voice: honest, dry, no cringe.
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
    isFirstAnalysis, athleteContext, streamSummary, previousSimilarSession, tempC, limiter, paceFadeSummary,
    raceResult } = input

  // §71 — a race is debriefed, not scored. Suppress the zone/drift/fade
  // citations and the plan-scoring verdict; frame the read as a race debrief.
  const isRace = session.type === 'race'

  // §72 — an ultra-distance effort is read as time-on-feet. Back-half fade over
  // this distance is expected physiology, not a fault. A non-race ultra effort
  // keeps its training-session read (verdict, cohort) but drops the
  // fade-as-fault citations. Race efforts are already handled by isRace.
  const isUltraEffort = !isRace && actualDistKm >= LIMITER.SUPPRESS_ULTRA_DISTANCE_KM

  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000
  const isMaintenance = plan.meta.plan_kind === 'maintenance'

  // Signed weeks-to-race. A race in the PAST reads "run N weeks ago" / "this
  // week" — never "0 weeks away". The old Math.max(0, …) clamp made a finished
  // race look imminent (the §73 in-flight-vs-done bug class). Maintenance plans
  // wipe race_date to '' → null here; their recency comes from the block below.
  const signedWeeksToRace = plan.meta.race_date
    ? Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / MS_PER_WEEK)
    : null
  const raceTiming =
    signedWeeksToRace === null ? ''
    : signedWeeksToRace > 0    ? `, ${signedWeeksToRace} week${signedWeeksToRace === 1 ? '' : 's'} away`
    : signedWeeksToRace === 0  ? ', this week'
    :                            ` — run ${Math.abs(signedWeeksToRace)} week${signedWeeksToRace === -1 ? '' : 's'} ago`

  const raceContext = plan.meta.race_name
    ? `${plan.meta.race_name}${plan.meta.race_distance_km ? ` (${plan.meta.race_distance_km}km)` : ''}${isMaintenance ? '' : raceTiming}`
    : 'target race'

  // Maintenance weeks keep continuous `n` carried from the race plan (e.g. n=21)
  // while plan.weeks holds only the maintenance block — so "Week 21 of 4" is
  // incoherent. Show maintenance-relative position instead.
  const maintIdx = isMaintenance ? plan.weeks.findIndex(w => w.n === weekN) : -1
  const weekLine = maintIdx >= 0
    ? `Maintenance week: ${maintIdx + 1} of ${plan.weeks.length}`
    : `Week: ${weekN} of ${plan.weeks.length}`

  // ADR-013 — post-race maintenance context. The runner has NO upcoming race;
  // recency is measured from the source race. Without this the prompt supplied
  // no elapsed-time ground truth and the model fabricated one (e.g. "two days
  // after your 100km effort" three weeks post-race). Supply the real figure —
  // or, when the date wasn't carried (pre-fix plans), explicitly forbid inventing one.
  const maintenanceBlock = isMaintenance
    ? (() => {
        const srcName = plan.meta.source_race_name
          ?? plan.meta.race_name?.replace(/^After\s+/i, '')
          ?? 'your race'
        const srcDist = plan.meta.source_race_distance_km ?? plan.meta.race_distance_km ?? null
        const distStr = srcDist ? ` (${srcDist}km)` : ''
        const srcDate = plan.meta.source_race_date
        let recency: string
        if (srcDate) {
          const days  = Math.max(0, Math.round((Date.now() - new Date(srcDate).getTime()) / 86_400_000))
          const weeks = Math.round(days / 7)
          recency = days < 10
            ? `It has been ${days} day${days === 1 ? '' : 's'} since the race. Do not state a different figure.`
            : `It has been about ${weeks} week${weeks === 1 ? '' : 's'} since the race. Do not state a different figure.`
        } else {
          recency = 'The exact time since the race is not known here — do NOT state or imply a specific number of days or weeks since it, and do not describe this run as being "X days after" the race.'
        }
        return `
POST-RACE MAINTENANCE — this run is part of a recovery/maintenance block after ${srcName}${distStr}. There is no upcoming race: do not coach toward a countdown, taper, or race prep, and do not invent one. ${recency}
`
      })()
    : ''

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

  // AI-DEPTH-10 — last same-type session. Distinct from the averaged cohort:
  // this is a single specific prior run the model can name by day + days-ago.
  // Use sparingly — only when this session's outcome connects to the previous.
  const previousSimilarBlock = previousSimilarSession
    ? `
Most recent same-type session (single specific run, not averaged):
- ${previousSimilarSession.dayLabel}, ${previousSimilarSession.daysAgo} day${previousSimilarSession.daysAgo === 1 ? '' : 's'} ago
- Verdict: ${previousSimilarSession.verdict ?? 'unknown'}${previousSimilarSession.hrInZonePct != null ? `, ${previousSimilarSession.hrInZonePct.toFixed(0)}% in zone` : ''}

Continuity rule: reference this run ONLY if today's outcome continues, reverses, or directly contrasts it — e.g. "Tuesday's easy nailed, this one drifted" or "second easy in a row that ran hot". Otherwise ignore. Never reference gratuitously.
`
    : ''

  // AI-DEPTH-02 — HR drift across the run. Surfaces back-third fade that the
  // aggregate hr_in_zone_pct figure hides. Null block when no usable stream
  // (Strava-sourced or sample-starved).
  const streamBlock = streamSummary
    ? `
HR drift across the run (back third vs first third):
- First third avg HR: ${streamSummary.firstThirdAvgHr} bpm
- Last third avg HR: ${streamSummary.lastThirdAvgHr} bpm
- Drift: ${streamSummary.hrDriftBpm >= 0 ? '+' : ''}${streamSummary.hrDriftBpm} bpm (${streamSummary.hrDriftPct >= 0 ? '+' : ''}${(streamSummary.hrDriftPct * 100).toFixed(1)}%)${streamSummary.sparse ? '\n- Sample density: sparse — treat as a hint, not a hard signal' : ''}

Drift rule: when the absolute drift is ≥ 10 bpm or ≥ 7%, reference it directly as a back-third fade in your feedback (e.g. "HR drifted 14 bpm in the back third — the fade started after the halfway mark"). Below those thresholds, only mention drift if it's the dominant story. Do not invent causes — observation only.
`
    : ''

  // Pace fade across the run (Strava per-km splits). Same shape as the HR
  // drift block — surfaces a back-half slowdown that the aggregate avg pace
  // hides. Threshold for reference in feedback: ≥ 15s/km.
  const paceFadeBlock = paceFadeSummary
    ? `
Pace fade across the run (back half vs first half, ${paceFadeSummary.splitsUsed} per-km splits):
- First half: ${formatPaceSec(paceFadeSummary.firstHalfAvgPaceSecPerKm)}
- Back half:  ${formatPaceSec(paceFadeSummary.backHalfAvgPaceSecPerKm)}
- Fade: ${paceFadeSummary.paceFadeSecPerKm >= 0 ? '+' : ''}${paceFadeSummary.paceFadeSecPerKm}s/km (${paceFadeSummary.paceFadePct >= 0 ? '+' : ''}${(paceFadeSummary.paceFadePct * 100).toFixed(1)}%)${paceFadeSummary.sparse ? '\n- Splits: minimum sample — treat as hint, not hard signal' : ''}

Pace-fade rule: when fade is ≥ 15s/km in the back half, reference it directly ("pace dropped 22s/km in the back half"). Cross-reference with HR drift: pace fade + flat HR = legs went before lungs (muscular); pace fade + HR rise = engine pushed (aerobic). Negative fade is a negative split — call it out as a strength when the session called for even effort. Below 15s/km, ignore unless it's the dominant story.
`
    : ''

  // Environmental context — temperature from Strava. Only surface when the
  // value crosses a threshold where heat or cold actually changes the read.
  // Tepid days (10–21°C) are noise and would only crowd the prompt. Hot
  // (≥22°C) days suppress HR-discipline lectures; cold (≤4°C) days warn
  // about warmup creep.
  const tempBlock = (tempC != null && (tempC >= 22 || tempC <= 4))
    ? `
Environmental context — Strava-reported average temperature: ${tempC.toFixed(0)}°C${tempC >= 28 ? ' (hot)' : tempC >= 22 ? ' (warm)' : tempC <= 0 ? ' (freezing)' : ' (cold)'}.

Heat/cold rule: when temp ≥ 22°C, HR running 5–10bpm above zone ceiling is expected — name the heat, don't lecture the discipline. When temp ≤ 4°C, first-km HR can be artificially low (warmup creep) and pace can feel harder than the data suggests. Factor this in when reading the session; don't manufacture it as the headline unless it dominates.
`
    : ''

  // Limiter hypothesis (deterministic — from lib/coaching/limiter.ts). Only
  // surfaced when confidence is medium/high. Low-confidence hypotheses are
  // genuine guesses and Kit lecturing about a guess is worse than silence.
  const limiterBlock = (limiter && (limiter.confidence === 'high' || limiter.confidence === 'medium'))
    ? `
Likely limiter (rule-engine hypothesis, ${limiter.confidence} confidence): ${limiterLabel(limiter.category)}.
Why: ${limiter.reasoning}.

Limiter rule: when confidence is high, name the limiter as part of the read — use an observational stem ("The limiter looks like…", "What stands out…", "This suggests…"). Don't restate the reasoning verbatim — paraphrase it into the voice. When confidence is medium, frame as a hypothesis ("looks like…", "points at…") rather than a fact. Never override what the session-level numbers above clearly say — the limiter is one read, not the only one.
`
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

  // §71 — race debrief framing. When the session is a race, this block replaces
  // the zone/drift/fade citation blocks and the verdict line: a race is read,
  // not scored.
  // RACE-DEBRIEF-02 — the runner's own account of the race, authoritative over
  // any device signal. Silently omits when no result was logged.
  const raceNarrativeBlock = isRace ? buildRaceNarrativeBlock(raceResult) : ''

  // §71 / RACE-DEBRIEF-02 — temperature on the race path is UN-gated (any value,
  // not just ≥22/≤4°C) so the debrief can name the conditions. Honest-absence
  // (ADR-011 §5 / INV-DATA-005) when temp wasn't recorded: don't invent it.
  const raceTempBlock = isRace
    ? (tempC != null
        ? `\nConditions: ${tempC.toFixed(0)}°C${tempC >= 28 ? ' (hot)' : tempC >= 22 ? ' (warm)' : tempC <= 0 ? ' (freezing)' : tempC <= 4 ? ' (cold)' : ''}. Heat slows everyone and is not a discipline failure — name the conditions if they shaped the day, but never lecture pacing or HR against them.\n`
        : `\nConditions: temperature wasn't recorded for this run. If the runner's account mentions the weather, trust it; don't invent a temperature.\n`)
    : ''

  const raceDebriefBlock = isRace
    ? `
RACE EFFORT — this session was a race, not a training run. Debrief it; do not score it. Rules:
- Do NOT judge it by zone discipline, HR drift, or back-half pace fade. A race is run at race effort, and fading over race distance — especially long or ultra — is expected physiology, not a fault.
- Acknowledge the effort and the distance covered. Finishing is the achievement; the time is secondary.
- If the athlete's notes mention what happened out there (injury, heat, a tactical call), that account is the truth of the race — never contradict it, and never tell them to do something they already did.
- Read it like a coach who was on the course, not a scorer reading a spreadsheet.
${raceNarrativeBlock}${raceTempBlock}`
    : ''

  // §72 — ultra-distance non-race effort: keep the training read, but frame the
  // fade as expected and replace the fade-as-fault citation blocks.
  const ultraEffortBlock = isUltraEffort
    ? `
ULTRA-DISTANCE EFFORT (${actualDistKm.toFixed(0)}km) — this is time-on-feet, not a pace session. Back-half pace fade and late HR drift over this distance are expected physiology (glycogen depletion), not a fault. Don't cite the fade as a problem or tell them to "start slower" — read it as the fatigue-resistance work it is.
`
    : ''

  return `${voiceHeader}
${athleteContext ?? ''}
${FEW_SHOT_EXAMPLES}
${firstRunNote}
Now write feedback for this session:

Race context: ${raceContext}
${weekLine}${weekPhase ? ` — ${weekPhase} phase` : ''}

Session type: ${session.type} (${session.label})
Planned distance: ${session.distance_km ? `${session.distance_km}km` : 'not set'}
Actual distance: ${actualDistKm.toFixed(1)}km
${paceLine ? paceLine + '\n' : ''}${hrLine}
${efLine ? efLine + '\n' : ''}RPE: ${rpe !== null ? rpe : 'not logged'}
Fatigue: ${fatigueTag ?? 'not logged'}${isRace ? '' : `\nVerdict: ${verdict}`}
${isRace ? raceDebriefBlock : `${maintenanceBlock}${previousSimilarBlock}${isUltraEffort ? ultraEffortBlock : `${streamBlock}${paceFadeBlock}`}${cohortBlock}${tempBlock}${limiterBlock}`}
Write 2–4 sentences of honest, specific feedback. No headers. No bullet points. Plain text only.`
}

function formatPaceSec(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}
