// PAID/TRIAL — AI enricher
// Adds coaching voice, week labels, session coach notes, and (paid-only) confidence score
// to rule-engine output. Failure is always silent — returns original plan unchanged.
//
// Tier-divergent: trial/paid → enriched labels + voice; paid-only → confidence_score + coach_intro.
// See ADR-006 for the hybrid generation architecture.

import type { Plan, GeneratorInput } from '@/types/plan'
import { EnrichedPlanSchema } from './schema'
import type { Tier } from './ruleEngine'

// ─── System prompt (cached via prompt-caching-2024-07-31 beta) ───────────────

const ENRICH_SYSTEM_PROMPT = `You are the coaching voice layer for Zona, a calm and disciplined running training app.

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

ZONA VOICE:
- Direct and honest. Not motivational-poster language. Never urgent. Never red flags.
- Respects the athlete's intelligence. Practical. Acknowledges difficulty without catastrophising.
- Week labels: descriptive, lowercase after dash. e.g. "Base — Zone 2 discipline", "Build — first quality session", "Taper — trust the work"
- Week themes: one honest sentence. e.g. "HR discipline this week. Slower than feels right. That is correct."
- Coach notes: plain and specific. Max 3 per session. e.g. "Keep HR below your zone 2 ceiling — walk if needed.", "This is the session that builds the engine, not the race."
- coach_intro (when requested): 2–3 sentences from coach to athlete. Honest assessment of the plan, what the athlete should focus on, and one thing that will make the difference. Zona tone — no cringe.

BANNED LANGUAGE — never use these in any field:
- Do NOT use "Light", "Heavy", "Moderate", "Easy" or similar volume-based qualifiers to describe a week or schedule. 3 days is not "light" — it is what fits someone's life.
- Do NOT use "light week", "heavy week", "moderate load", or any phrase that judges the athlete's frequency or volume. Use phase-based or session-type language only.
- Week labels must describe training focus (e.g. phase, session type, physiological goal) — never the perceived difficulty or volume of the schedule.`

// ─── Main export ──────────────────────────────────────────────────────────────

export async function enrich(plan: Plan, input: GeneratorInput, tier: Tier): Promise<Plan> {
  if (!process.env.ANTHROPIC_API_KEY) return plan

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
        model: 'claude-haiku-4-5-20251001',
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
      console.error('[enrich] Anthropic error', response.status, await response.text().catch(() => ''))
      return plan
    }

    const data = await response.json()
    rawText = data.content?.[0]?.text ?? ''
  } catch (e) {
    console.error('[enrich] fetch failed', e)
    return plan
  }

  // Parse — strip any accidental markdown fences
  let parsed: unknown
  try {
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('[enrich] JSON parse failed', rawText.slice(0, 300))
    return plan
  }

  // Validate shape — only allowed fields accepted
  const result = EnrichedPlanSchema.safeParse(parsed)
  if (!result.success) {
    console.error('[enrich] schema validation failed', result.error.issues.slice(0, 5))
    return plan
  }

  return mergePlan(plan, result.data, tier)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildUserMessage(plan: Plan, input: GeneratorInput, wantPaidFields: boolean): string {
  // Send a slim plan representation — numeric fields are context, not targets for change
  const slimWeeks = plan.weeks.map(w => ({
    n: w.n,
    type: w.type,
    phase: w.phase,
    weekly_km: w.weekly_km,
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
- Plan compressed (fewer weeks than ideal): ${plan.meta.compressed ?? false}
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
      if (es.label) session.label = es.label
      if (es.coach_notes) session.coach_notes = es.coach_notes
    }
  }

  return plan
}
