// CA-01 — FREE first-plan coach intro.
//
// The "wedge moment" (free user, fresh install, no Strava, no logged runs) is
// otherwise the only place in the product with zero AI voice — AIMark never
// lights up and Kit's voice, the strongest asset, stays invisible until paid.
// This adds one short Haiku-generated sentence to a free user's FIRST plan: a
// deliberately small taste of the voice, naming where the work actually is.
//
// Deliberately NOT the paid enricher (lib/plan/enrich.ts):
//   - paid coach_intro = 2–3 sentences + confidence assessment, full enrichment
//   - free plan_intro  = one line, no confidence, no week labels/notes
// Distinct field (meta.plan_intro), distinct call, distinct scope.
//
// Failure is always silent — returns null and the caller leaves the rule plan
// unchanged (ADR-006 hybrid pattern: the engine output always stands alone).

import type { Plan, GeneratorInput } from '@/types/plan'
import { ANTHROPIC_MODEL } from '@/lib/ai/models'
import { buildVoiceHeader } from '@/lib/coaching/prompts/voiceRules'
import { BRAND } from '@/lib/brand'

// Friendly race-distance label for the prompt — keeps Kit specific without
// making it parrot a raw decimal ("42.195km").
function distanceLabel(km: number): string {
  if (Math.abs(km - 5) < 0.5) return '5K'
  if (Math.abs(km - 10) < 0.5) return '10K'
  if (Math.abs(km - 21.0975) < 1) return 'half marathon'
  if (Math.abs(km - 42.195) < 1) return 'marathon'
  return `${Math.round(km)}km`
}

/**
 * Generate a one-line "why this plan" intro for a free user's first plan.
 * Returns the trimmed sentence(s), or null on any failure (no key, API error,
 * empty output). Never throws — the caller treats null as "no intro".
 */
export async function generateFreeIntro(plan: Plan, input: GeneratorInput): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  const firstName = (input.athlete_name ?? '').trim().split(/\s+/)[0] || null

  const system = [
    buildVoiceHeader({
      role: `writing the single-line intro to a runner's brand-new training plan — the first words they ever hear from you`,
      outputConstraint: 'One sentence. Two at the very most. Under 30 words total. No greeting, no sign-off, no quote marks.',
      includeVoiceAnchor: false,
      firstName,
    }),
    '',
    `CONTEXT — non-negotiable:`,
    `- This is a brand-new runner to ${BRAND.name}. You have NO run history, NO device data, NO logged sessions. Never reference past performance, "your data", or anything you can't see.`,
    `- ${BRAND.name} exists because runners blur their zones — they go medium-hard on everything, never truly recover and never truly push, so every run blurs into the same grey middle. The discipline this plan asks for is the whole point.`,
    `- Say what this plan is really asking of them, or where the work actually is — name the focus honestly (holding easy days easy, the long run, consistency across the weeks, restraint). Specific beats generic.`,
    `- Reference the real plan facts (distance, weeks) so it reads as theirs, not a template.`,
    `- Plain and dry. No hype, no welcome-aboard, no exclamation marks. Output ONLY the sentence(s) — no preamble.`,
  ].join('\n')

  const phases = Array.from(new Set(plan.weeks.map(w => w.phase).filter(Boolean)))
  const userMsg = [
    `Write the intro line for this plan:`,
    `- Race: ${plan.meta.race_name || distanceLabel(input.race_distance_km)} — ${distanceLabel(input.race_distance_km)}`,
    `- Length: ${plan.weeks.length} weeks`,
    `- Days available: ${input.days_available}/week`,
    `- Goal: ${input.goal === 'time_target' && input.target_time ? `finish in ${input.target_time}` : 'finish the race'}`,
    phases.length ? `- Phases: ${phases.join(' → ')}` : '',
    ``,
    `Return only the line.`,
  ].filter(Boolean).join('\n')

  let rawText: string
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 120,
        system,
        messages: [{ role: 'user', content: userMsg }],
      }),
    })

    if (!response.ok) {
      console.error('[freeIntro] Anthropic error', response.status, await response.text().catch(() => ''))
      return null
    }

    const data = await response.json()
    rawText = data.content?.[0]?.text ?? ''
  } catch (e) {
    console.error('[freeIntro] fetch failed', e)
    return null
  }

  // Strip stray quotes/fences and clamp length defensively.
  const cleaned = rawText
    .replace(/^```(?:\w+)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .replace(/^["'“‘]+|["'”’]+$/g, '')
    .trim()

  if (!cleaned) return null
  return cleaned
}
