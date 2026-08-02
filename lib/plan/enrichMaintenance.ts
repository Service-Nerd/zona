// PAID — AI enricher for the post-race maintenance block (MAINT-02)
// Adds coaching voice to the rule-engine maintenance weeks: per-session coach_notes
// and one per-week `coach_debrief`. Gated by `maintenance_coaching`; the route is the
// auth boundary (ADR-003) — this module is a pure function of (weeks, context, key).
//
// Failure is ALWAYS silent — returns the input weeks unchanged (ADR-006 hybrid pattern,
// same contract as lib/plan/enrich.ts). Never throws to the caller.
//
// Voice register is locked in CoachingPrinciples §75. The maintenance block is not a
// reward and not a fallback — it is the mechanical consequence of racing. The voice is
// flat and factual in Phase 1, quiet and settled in Phase 2, most restrained after a DNF.

import { z } from 'zod'
import type { Week, RaceResult } from '@/types/plan'
import { ANTHROPIC_MODEL } from '@/lib/ai/models'
import { BRAND } from '@/lib/brand'

// ─── Output schema — only voice fields may change ──────────────────────────────
// coach_debrief + session coach_notes are the sole enrichable fields. Numerics,
// labels, themes, session structure are rule-engine and locked.

const MaintEnrichmentSchema = z.object({
  weeks: z.array(z.object({
    n:             z.number().int().positive(),
    coach_debrief: z.string().optional(),
    // partialRecord (Zod v4): the model returns only the days it wrote voice for.
    // Plain z.record(enum, …) would require ALL seven day keys to be present.
    sessions:      z.partialRecord(
      z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
      z.object({
        coach_notes: z.tuple([z.string(), z.string().optional(), z.string().optional()]).optional(),
      }),
    ).optional(),
  })),
})

// ─── System prompt (cached) ────────────────────────────────────────────────────

const MAINT_SYSTEM_PROMPT = `You are the coaching voice layer for ${BRAND.name}, a calm and disciplined running training app.

You will receive the weeks of a POST-RACE MAINTENANCE BLOCK as structured JSON. The runner has finished (or DNF'd) their goal race; these weeks protect the recovery window. The numeric values (distances, zones, durations) are FINAL and must not change. Your only job is to add coaching voice.

WHAT THE MAINTENANCE BLOCK IS (do not contradict this):
- It is not a reward for racing well and not a fallback for feeling bad. It is the mechanical consequence of what a race does to the body.
- Phase "maintenance_restoration" = quality blackout. Easy running, rest, cross-training only. The body is still repairing, not yet adapting.
- Phase "maintenance_base" = holding a base. Quality reintroduced at one mild session per week. Not ramping toward anything.
- A "maintenance_base" week flagged "reengagement": true is one of the block's final weeks. The recovery window has been served. The training does not change at all — but this is the one place in the block where looking forward is permitted, lightly.

OUTPUT RULES — non-negotiable:
- Return ONLY a raw JSON object matching the schema below. No markdown. No code fences. No explanation.
- Do NOT change any numeric field. Do NOT add or remove sessions or weeks. Do NOT return week labels or themes.
- Include only the weeks and sessions you are writing voice for. Reference weeks by their "n".

RETURN SCHEMA:
{
  "weeks": [
    {
      "n": number,
      "coach_debrief"?: string,
      "sessions"?: {
        "[mon|tue|wed|thu|fri|sat|sun]"?: { "coach_notes"?: [string, string?, string?] }
      }
    }
  ]
}

VOICE REGISTER (CoachingPrinciples §75) — this is the whole job:
- coach_debrief: ONE sentence per week. Flat and factual. It is a quiet weekly note, not a pep talk.
  - maintenance_restoration weeks: flat, factual, present-tense. No forward goal language. Do NOT reference the race after the first two maintenance weeks.
  - maintenance_base weeks: quiet and settled — "back to base", nothing to prove, no ramp language.
  - maintenance_base weeks with "reengagement": true: the block is ending and the runner is recovered. Still quiet, still no ramp language — but the door may be left open, stated once and without pressure (the rule-engine line for these weeks is "Still here. When you're ready." — match that register, do not echo the words). Never name a distance, a race, or a target. Never ask a question. Never imply the runner is behind or should now be deciding something.
  - DNF (outcome = "dnf"): the most restrained voice in the product. Zero pressure, zero forward-looking framing. e.g. "The body doesn't know what it didn't finish. Recover anyway."
- coach_notes: plain and specific. Max 2 for a maintenance session — restraint is the point. Easy runs are Zone 2 only; the note reinforces holding back, not pushing.
- NEVER: "great job", "well done", "crushed it", celebration of the race, motivational-poster language, exclamation marks, emojis, or any "you've earned this" framing. The race happened. This is what comes after.
- Honest, quiet, a little dry. One good sentence beats two.

PLACEHOLDER (optional): if a coach_note refers to the Zone 2 HR ceiling, write the token {{zone2_ceiling}} instead of a number — the render layer substitutes the live value. Use ONLY this exact token, only in coach_notes, only when it fits. No other tokens.

Write the JSON object now.`

// ─── Context passed in by the route ────────────────────────────────────────────

export interface MaintenanceEnrichContext {
  raceResult:     RaceResult
  raceName?:      string | null
  raceDistanceKm: number
}

// ─── Main export ────────────────────────────────────────────────────────────────

/**
 * Enrich the maintenance weeks with coaching voice. Returns a NEW array with
 * `coach_debrief` set per week and `coach_notes` set per session. On any failure
 * (no key, API error, bad JSON, schema mismatch) returns `weeks` unchanged.
 *
 * @param weeks   the maintenance weeks produced by generateMaintenanceBlock()
 * @param ctx     race-result context (outcome / RPE / distance drive the voice)
 * @param apiKey  Anthropic key; when absent the enricher no-ops (mirrors enrich.ts)
 */
export async function enrichMaintenanceBlock(
  weeks: Week[],
  ctx: MaintenanceEnrichContext,
  apiKey: string | undefined = process.env.ANTHROPIC_API_KEY,
): Promise<Week[]> {
  if (!apiKey || weeks.length === 0) return weeks

  let rawText: string
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 3000,
        system: [{ type: 'text', text: MAINT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: buildUserMessage(weeks, ctx) }],
      }),
    })

    if (!response.ok) {
      console.error('[enrichMaintenance] Anthropic error', response.status, await response.text().catch(() => ''))
      return weeks
    }

    const data = await response.json()
    rawText = data.content?.[0]?.text ?? ''
  } catch (e) {
    console.error('[enrichMaintenance] fetch failed', e)
    return weeks
  }

  let parsed: unknown
  try {
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('[enrichMaintenance] JSON parse failed', rawText.slice(0, 300))
    return weeks
  }

  const result = MaintEnrichmentSchema.safeParse(parsed)
  if (!result.success) {
    console.error('[enrichMaintenance] schema validation failed', result.error.issues.slice(0, 5))
    return weeks
  }

  return mergeWeeks(weeks, result.data)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildUserMessage(weeks: Week[], ctx: MaintenanceEnrichContext): string {
  const { raceResult, raceName, raceDistanceKm } = ctx
  const outcome = raceResult.outcome ?? 'off_target'

  const slimWeeks = weeks.map(w => ({
    n: w.n,
    phase: w.phase,
    // MAINT-07 — marks the §75 Phase 3 window so the debrief can carry the
    // closing register. Omitted (not `false`) elsewhere to keep the payload slim.
    ...(w.reengagement ? { reengagement: true } : {}),
    weekly_km: w.weekly_km,
    theme: w.theme, // context only — do NOT rewrite; here so the debrief doesn't echo it
    sessions: Object.fromEntries(
      Object.entries(w.sessions ?? {}).map(([day, s]) => [day, {
        type: s?.type,
        label: s?.label,
        distance_km: s?.distance_km,
        zone: s?.zone,
      }]),
    ),
  }))

  return `Add coaching voice to this ${weeks.length}-week post-race maintenance block.

RACE JUST COMPLETED:
- Race: ${raceName ?? 'the goal race'} (${raceDistanceKm} km)
- Outcome: ${outcome}${outcome === 'dnf' ? ' (did not finish — use the most restrained register)' : ''}
- Effort (RPE 1–10): ${raceResult.rpe ?? 'not recorded'}

MAINTENANCE WEEKS (numeric values are FINAL — do not change; themes are context only, do not rewrite them):
${JSON.stringify(slimWeeks, null, 0)}

Return the enriched JSON object now — coach_debrief per week, coach_notes per session.`
}

function mergeWeeks(original: Week[], enriched: z.infer<typeof MaintEnrichmentSchema>): Week[] {
  // Deep clone — never mutate the rule-engine output.
  const weeks: Week[] = JSON.parse(JSON.stringify(original))

  for (const ew of enriched.weeks) {
    const week = weeks.find(w => w.n === ew.n)
    if (!week) continue
    if (ew.coach_debrief) week.coach_debrief = ew.coach_debrief
    if (!ew.sessions) continue
    for (const [day, es] of Object.entries(ew.sessions)) {
      const session = week.sessions?.[day as keyof typeof week.sessions]
      if (!session || !es?.coach_notes) continue
      session.coach_notes = es.coach_notes
    }
  }

  return weeks
}
