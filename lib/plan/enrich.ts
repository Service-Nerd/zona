// PAID/TRIAL — AI enricher
// Adds coaching voice, week labels, session coach notes, and (paid-only) confidence score
// to rule-engine output. Failure is always silent — returns original plan unchanged.
//
// Tier-divergent: trial/paid → enriched labels + voice; paid-only → confidence_score + coach_intro.
// See ADR-006 for the hybrid generation architecture.

import type { Plan, GeneratorInput } from '@/types/plan'
import { EnrichedPlanSchema } from './schema'
import type { Tier } from './ruleEngine'
import { ANTHROPIC_MODEL } from '@/lib/ai/models'
import { BRAND } from '@/lib/brand'
import { weekIntensityFlags } from './weekIntensityFlags'

// ─── System prompt (cached via prompt-caching-2024-07-31 beta) ───────────────
// Brand name is interpolated from BRAND.name so a future rename doesn't bleed
// into Claude output. Resolved at module load — template literal evaluates once.

const ENRICH_SYSTEM_PROMPT = `You are the coaching voice layer for ${BRAND.name}, a calm and disciplined running training app.

You will receive a training plan as structured JSON. The plan's numeric values (distances, durations, HR targets, zones, pace targets) are FINAL and must not change. Your job is to add coaching voice only.

OUTPUT RULES — non-negotiable:
- Return ONLY a raw JSON object matching the schema below. No markdown. No code fences. No explanation.
- Do NOT change any numeric field. Do NOT add or remove sessions or weeks.
- Do NOT include fields you are not changing.
- Every week in the input must appear in your output with n, label, and theme.

RETURN SCHEMA:
{
  "meta": {
    "notes": string,
    "coach_intro"?: string,
    "confidence_score"?: number,
    "confidence_risks"?: string[]
  },
  "weeks": [
    {
      "n": number,
      "label": string,
      "theme": string,
      "sessions"?: {
        "[mon|tue|wed|thu|fri|sat|sun]"?: {
          "label"?: string,
          "coach_notes"?: [string, string?, string?]
        }
      }
    }
  ]
}

CONFIDENCE SCORE (1–10, include only when requested):
- Start at 10. Deduct:
  - 2 if plan is compressed (fewer weeks than ideal for the distance)
  - 1–2 if current weekly volume < 50% of expected peak
  - 1 if days_available <= 3
  - 1 per significant injury listed
  - 1 if goal = time_target with an aggressive gap between current fitness and target
- confidence_risks: max 3 items, plain English. Direct. e.g. "Current base volume is low for a 14-week plan."

${BRAND.name.toUpperCase()} VOICE:
- Direct and honest. Not motivational-poster language. Never urgent. Never red flags.
- Respects the athlete's intelligence. Practical. Acknowledges difficulty without catastrophising.
- Week labels: descriptive, lowercase after dash. e.g. "Base — Zone 2 discipline", "Build — extending the work", "Taper — trust the work"
- Week themes: one honest sentence. e.g. "HR discipline this week. Slower than feels right. That is correct."
- Coach notes: plain and specific. Max 3 per session. e.g. "Keep HR below your zone 2 ceiling — walk if needed.", "This is the session that builds the engine, not the race."
- coach_intro (when requested): 2–3 sentences from coach to athlete. Honest assessment of the plan, what the athlete should focus on, and one thing that will make the difference. ${BRAND.name} tone — no cringe.
- Plan demand consistency: when the athlete brief states a plan demand (comfortable / demanding / very_demanding), no field may contradict it — never call a "very_demanding" plan a breeze or a "comfortable" one brutal. Match that honesty; do NOT restate the label verbatim (the app already shows it).

PLACEHOLDERS IN coach_notes — REQUIRED:
When a coach note refers to a numeric value the athlete might change later (HR ceilings, HR targets, paces, distances, durations), use a placeholder token instead of writing the literal number. The render layer substitutes the live value. This keeps the note correct after the athlete updates their resting HR, max HR, or other inputs.

Allowed tokens (use exactly these spellings, double curly braces):
- {{zone2_ceiling}}    — Zone 2 HR ceiling, bpm
- {{max_hr}}           — derived max HR, bpm
- {{resting_hr}}       — resting HR, bpm
- {{goal_pace}}        — race goal pace, e.g. "5:27 /km"
- {{session_pace}}     — this session's pace target, e.g. "6:06–7:17 /km"
- {{session_hr}}       — this session's HR target, e.g. "< 141 bpm" or "141–154 bpm"
- {{session_zone}}     — this session's zone, e.g. "Zone 2"
- {{session_distance}} — this session's distance in km
- {{session_duration}} — this session's duration in minutes
- {{session_rpe}}      — this session's RPE target

GOOD: "Keep HR below {{zone2_ceiling}} bpm — walk if needed."
GOOD: "Hold {{session_hr}} for the main set."
GOOD: "Stay around {{session_pace}}."
GOOD: "This one lives in {{session_zone}}."
BAD:  "Keep HR below 154 bpm — walk if needed."         (literal — will go stale)
BAD:  "Hold 141–154 bpm for the main set."              (literal — will go stale)
BAD:  "Quality: Zone 4–5, 158–185 bpm."                 (literal zone AND bpm — use {{session_zone}} / {{session_hr}} so the note can NEVER contradict the header — CoachingPrinciples §84)
BAD:  "Keep HR below {{zone_2_ceiling}} bpm."           (wrong token name — underscore placement)
BAD:  "Stay below {{Z2_ceiling}} bpm."                  (wrong token name — capitalisation)

Use placeholders ONLY for coach_notes. Week labels and themes do NOT contain numerics — never put placeholders in them. If a coach note doesn't reference a numeric value, no placeholder is needed.

WEEK COPY MUST MATCH WHAT THE WEEK CONTAINS — the single most common reason
enrichment is REJECTED and a week reverts to plain copy:

Every week you are given carries THREE flags. They are not interchangeable, and
each answers a question you must not try to work out for yourself.

  "has_quality"   — the week contains a real intensity session (tempo, threshold,
                    intervals, VO2max, hill reps).
  "has_benchmark" — the week contains the 5K time trial. That is a MEASUREMENT,
                    not a training stimulus. You cannot sharpen on it and it does
                    not make a week a quality week.
  "is_overload_week" — this week's volume genuinely exceeds the previous
                    non-deload week's. Only then may the copy imply the week is
                    building or peaking. TAPER AND RACE WEEKS ARE NEVER OVERLOAD
                    WEEKS: volume falls by design, and saying otherwise
                    contradicts the plan the runner is holding.

Three groups of words, three different requirements:

  A. quality · threshold · tempo · interval · intervals · VO2 · VO2max ·
     "feels hard" / "feel hard"
     → allowed only when has_quality OR has_benchmark is true.

  B. sharpen · sharpening · "raising the ceiling" · "intensity stays"
     → allowed only when has_quality is true. NOT enough that has_benchmark is —
       a deload week whose only hard effort is the time trial is recovering and
       measuring, not sharpening.

  C. benchmark · "time trial"
     → allowed only when has_benchmark is true.

  D. "highest volume" · "fitness is built"
     → allowed only when is_overload_week is true. Do NOT compare weekly_km
       figures yourself — the flag is the answer.

This is not a style preference. A runner told "this week will feel hard" before
five easy runs either pushes too hard to satisfy the framing — the exact failure
this product exists to prevent — or stops trusting the plan. A breach costs that
week its coaching voice; the athlete gets plain engine copy for it.

For an all-easy week, describe the aerobic work honestly: "Base — Zone 2
discipline", "Base — building consistency", "Race week — the work is done".
For a deload week carrying only the time trial: "Deload — measure and recover".
For a taper or race week: "Taper — trust the work", "Race week — the work is done".

BANNED LANGUAGE — never use these in any field:
- Do NOT use "Light", "Heavy", "Moderate", "Easy" or similar volume-based qualifiers to describe a week or schedule. 3 days is not "light" — it is what fits someone's life.
- Do NOT use "light week", "heavy week", "moderate load", or any phrase that judges the athlete's frequency or volume. Use phase-based or session-type language only.
- Week labels must describe training focus (e.g. phase, session type, physiological goal) — never the perceived difficulty or volume of the schedule.`

// ─── Outcome reporting (GEN-FIX-02) ───────────────────────────────────────────
//
// ADR-006 mandates silent fallback *to the user* — a failed enrichment must
// never break plan generation. It does not mandate silence to US. Before this,
// all five exits below were `console.error`-only, so a trial user could receive
// an unenriched (i.e. free-tier) plan and nobody would know. That happened:
// see docs/incidents/2026-08-06-plan-defects/analysis.md (N1).
//
// The commercial edge of it: silent enrichment failure is indistinguishable
// from "the trial user didn't find it valuable", so it corrupts the conversion
// diagnosis, not just the one plan.
//
// enrich() therefore reports its outcome to the caller rather than recording it
// here — this module must stay free of the service-role client so it can never
// leak into a client bundle (see the hazard note in lib/plan.ts).

export type EnrichFailureReason =
  | 'no_api_key'     // ANTHROPIC_API_KEY absent from the environment
  | 'api_error'      // Anthropic returned a non-2xx
  | 'fetch_failed'   // network/transport threw
  | 'parse_error'    // response was not JSON after fence-stripping
  | 'schema_invalid' // JSON parsed but failed EnrichedPlanSchema

export type EnrichOutcome =
  | { status: 'applied' }
  | { status: 'failed'; reason: EnrichFailureReason; detail?: string }

export interface EnrichResult {
  plan: Plan
  outcome: EnrichOutcome
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function enrich(plan: Plan, input: GeneratorInput, tier: Tier): Promise<EnrichResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { plan, outcome: { status: 'failed', reason: 'no_api_key' } }
  }

  const wantPaidFields = tier === 'paid'

  let rawText: string
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: plan.weeks.length <= 12 ? 6000 : plan.weeks.length <= 20 ? 10000 : 14000,
        system: [
          {
            type: 'text',
            text: ENRICH_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: buildUserMessage(plan, input, wantPaidFields) }],
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.error('[enrich] Anthropic error', response.status, body)
      return {
        plan,
        outcome: { status: 'failed', reason: 'api_error', detail: `${response.status} ${body.slice(0, 200)}` },
      }
    }

    const data = await response.json()
    rawText = data.content?.[0]?.text ?? ''
  } catch (e) {
    console.error('[enrich] fetch failed', e)
    return {
      plan,
      outcome: { status: 'failed', reason: 'fetch_failed', detail: e instanceof Error ? e.message : String(e) },
    }
  }

  // Parse — strip any accidental markdown fences
  let parsed: unknown
  try {
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('[enrich] JSON parse failed', rawText.slice(0, 300))
    return {
      plan,
      outcome: { status: 'failed', reason: 'parse_error', detail: rawText.slice(0, 200) },
    }
  }

  // Validate shape — only allowed fields accepted
  const result = EnrichedPlanSchema.safeParse(parsed)
  if (!result.success) {
    console.error('[enrich] schema validation failed', result.error.issues.slice(0, 5))
    return {
      plan,
      outcome: {
        status: 'failed',
        reason: 'schema_invalid',
        detail: JSON.stringify(result.error.issues.slice(0, 3)).slice(0, 300),
      },
    }
  }

  return { plan: mergePlan(plan, result.data, tier), outcome: { status: 'applied' } }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildUserMessage(plan: Plan, input: GeneratorInput, wantPaidFields: boolean): string {
  // Send a slim plan representation — numeric fields are context, not targets for change
  const slimWeeks = plan.weeks.map(w => ({
    n: w.n,
    type: w.type,
    phase: w.phase,
    weekly_km: w.weekly_km,
    // BOTH flags, from the shared owner the invariant also uses
    // (lib/plan/weekIntensityFlags.ts). A single conflated `has_intensity` that
    // counted the §78 time trial as intensity shipped on 2026-09-04 and
    // immediately cost a deload week its voice: the model was told the week "had
    // intensity", wrote "Build — recovery and sharpening", and §27's `/sharpen/`
    // claim requires a QUALITY session specifically — a measurement is not
    // something you sharpen on. The prompt and the checker must derive these from
    // one place or they will disagree again.
    ...weekIntensityFlags(w, plan.weeks),
    sessions: Object.fromEntries(
      Object.entries(w.sessions ?? {}).map(([day, s]) => [day, {
        type: s?.type,
        distance_km: s?.distance_km,
        duration_mins: s?.duration_mins,
        zone: s?.zone,
        hr_target: s?.hr_target,
      }])
    ),
  }))

  return `Add coaching voice to this ${plan.weeks.length}-week training plan.

ATHLETE:
- Name: ${input.athlete_name ?? 'Athlete'}
- Fitness level: ${plan.meta.fitness_level ?? input.fitness_level ?? 'intermediate'}
- Goal: ${input.goal === 'time_target' ? `Finish in ${input.target_time}` : 'Finish the race'}
- Race: ${plan.meta.race_name} — ${plan.meta.race_date} (${input.race_distance_km} km)
- Current weekly volume: ${input.current_weekly_km} km/week
- Days available: ${input.days_available}/week
- Plan compressed (fewer weeks than ideal): ${plan.meta.time_compressed ?? plan.meta.compressed ?? false}
${plan.meta.difficulty_band ? `- Plan demand (already assessed by the engine — stay consistent, do not contradict): ${plan.meta.difficulty_band}${plan.meta.difficulty_note ? ` ("${plan.meta.difficulty_note}")` : ''}` : ''}
${input.injury_history?.length ? `- Injury history: ${input.injury_history.join(', ')}` : ''}
${input.training_style ? `- Training style: ${input.training_style}` : ''}
${input.hard_session_relationship ? `- Hard session relationship: ${input.hard_session_relationship}` : ''}
${wantPaidFields ? '- Include confidence_score, confidence_risks, and coach_intro in meta.' : '- Do NOT include confidence_score, confidence_risks, or coach_intro.'}

PLAN (numeric values are FINAL — do not change):
${JSON.stringify(slimWeeks, null, 0)}

Return the enriched JSON object now.`
}

function mergePlan(
  original: Plan,
  enriched: ReturnType<typeof EnrichedPlanSchema.parse>,
  tier: Tier,
): Plan {
  // Deep clone — never mutate rule engine output
  const plan: Plan = JSON.parse(JSON.stringify(original))

  // Meta — text fields always allowed
  if (enriched.meta.notes) plan.meta.notes = enriched.meta.notes

  // Paid-only meta fields (INV-PLAN-008)
  if (tier === 'paid') {
    if (enriched.meta.coach_intro)             plan.meta.coach_intro = enriched.meta.coach_intro
    if (enriched.meta.confidence_score != null) plan.meta.confidence_score = enriched.meta.confidence_score
    if (enriched.meta.confidence_risks?.length) plan.meta.confidence_risks = enriched.meta.confidence_risks
  }

  // Weeks
  for (const ew of enriched.weeks) {
    const week = plan.weeks.find(w => w.n === ew.n)
    if (!week) continue
    if (ew.label) week.label = ew.label
    if (ew.theme) week.theme = ew.theme
    if (!ew.sessions) continue
    for (const [day, es] of Object.entries(ew.sessions)) {
      const session = week.sessions?.[day as keyof typeof week.sessions]
      if (!session || !es) continue
      // §78 — the recalibration time trial keeps the engine's own copy.
      //
      // The enricher rewrites VOICE. This session's notes are INSTRUCTION, and
      // the two are not interchangeable. The engine writes "This is a
      // measurement, not a session. Log the result in your profile and your
      // paces update for the next block." — the sentence the whole
      // recalibration path (ADR-014) depends on, because nothing recalibrates
      // unless the runner logs a result.
      //
      // Observed in a live plan (bcdec27a, 2026-09-03): the AI replaced it with
      // "Hard session: {{session_zone}}, {{session_distance}} km. This is pace
      // work, not endurance." — fluent, on-voice, states the OPPOSITE of §78,
      // and silently deletes the only instruction that makes the feature work.
      // `meta.recalibration_weeks` still claimed the week recalibrated.
      //
      // Keyed on `type === 'hard'`, which is structural and exact:
      // `applyRecalibrationTimeTrial` (ruleEngine.ts) is the ONLY producer of
      // that type anywhere in the codebase. Not keyed on the label, which the
      // enricher is free to rewrite (D-17), nor on `meta.recalibration_weeks`,
      // which would make this depend on two fields staying in step.
      //
      // The LABEL is protected with the notes, deliberately: "5K time trial"
      // tells the runner what the session is for, and a renamed measurement is
      // the same defect one field over.
      if (session.type === 'hard') continue
      if (es.label) session.label = es.label
      if (es.coach_notes) session.coach_notes = es.coach_notes
    }
  }

  return plan
}
