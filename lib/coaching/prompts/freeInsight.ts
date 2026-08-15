// freeInsight prompt — generates the weekly Kit insight surfaced on the Coach
// tab for free users (KIT-TASTE-01). Strava-independent: sourced entirely from
// manual `session_completions` rows (RPE + fatigue tag + completion ratio).
//
// Tier note: free users get ONE generation per ISO-Monday week. The route
// caches the result in `free_insights` so re-renders don't re-bill Haiku.
// This is the only free-tier surface that calls the AI directly — every
// other AI call route is paid/trial only.
//
// Output contract: JSON {"headline": "...", "body": "..."}. The route parses
// and falls back silently to "no card" if the model breaks the shape.

import { buildVoiceHeader } from './voiceRules'
import { formatPace, formatPaceDelta, formatDistanceForPrompt, type DistanceUnits } from '@/lib/format'

export interface FreeInsightInput {
  /** Reader's preferred units (FMT-01). Defaults to 'km' so km prompts stay
   *  byte-identical; only a miles reader sees a change. */
  units?: DistanceUnits
  /** Calendar week the insight covers (Monday ISO). Just for the model's reference; not displayed. */
  weekLabel: string
  /** Number of sessions logged with RPE in the last 7 days. Always ≥ 2 when the route reaches this prompt. */
  loggedCount: number
  /** Number of sessions planned in the last 7 days. Drives completion ratio. */
  plannedCount: number
  /** Recent completions, newest first. Empty fields where the user didn't supply them. */
  completions: Array<{
    sessionType: string                            // 'easy' / 'long' / 'quality' / 'rest' / etc.
    daysAgo: number                                // 0 = today, 1 = yesterday, …
    plannedDistanceKm: number | null
    rpe: number | null                             // 1–10 user-reported
    fatigueTag: string | null                      // 'Fresh' / 'Fine' / 'Heavy' / 'Wrecked'
  }>
  /** Optional first name — model may use once if it lands naturally. */
  firstName: string | null
}

const FEW_SHOT_EXAMPLES = `
Example 1 — heavy fatigue pattern on easy days:
Input: 3 easy days, RPEs 7/8/7, fatigue tags Heavy/Heavy/Fine
Output: {"headline": "Easy days aren't easy.", "body": "Three easy days, RPE 7s and Heavy tags. Easy means easy — the next one should feel embarrassingly slow."}

Example 2 — solid completion, mixed but honest RPE:
Input: 4 of 5 sessions logged, RPEs across 3–6, fatigue mostly Fine
Output: {"headline": "Honest week.", "body": "Four of five logged, RPE 3 to 6, mostly Fine. That's what a week in the zone looks like."}

Example 3 — single quality session, rated high RPE:
Input: 1 quality session, RPE 9, Wrecked. Other 2 logs are easy at RPE 4.
Output: {"headline": "Quality hit hard.", "body": "RPE 9 and Wrecked after the quality session. That's fine — that's the day to dig. The two easy logs at RPE 4 say you've kept the rest of the week boring."}

Example 4 — first time logging:
Input: 2 sessions logged, both at RPE 6, Fine and Fine
Output: {"headline": "Two on the board.", "body": "RPE 6 both times, Fine both times. Solid baseline. Keep logging — Kit needs the data to read you properly."}
`

export function buildFreeInsightPrompt(input: FreeInsightInput): string {
  const units: DistanceUnits = input.units ?? 'km'
  const fmtDist = (v: number | null | undefined, dp: number | null = null) => formatDistanceForPrompt(v, units, dp) ?? '—'
  const voiceHeader = buildVoiceHeader({
    role: 'writing a short weekly check-in for a free-tier runner',
    outputConstraint: 'Return JSON exactly: {"headline": "...", "body": "..."}. Headline: 3–6 words. Body: one or two sentences, max 200 chars.',
    firstName: input.firstName,
  })

  const completionFacts = input.completions
    .map(c => {
      const ago = c.daysAgo === 0 ? 'today' : c.daysAgo === 1 ? 'yesterday' : `${c.daysAgo}d ago`
      const dist = c.plannedDistanceKm ? `${fmtDist(c.plannedDistanceKm, 0)} ` : ''
      const rpe = c.rpe !== null ? `, RPE ${c.rpe}` : ''
      const fat = c.fatigueTag ? `, ${c.fatigueTag}` : ''
      return `- ${ago}: ${dist}${c.sessionType}${rpe}${fat}`
    })
    .join('\n')

  return `${voiceHeader}

Your job: write ONE short Kit insight covering the runner's last week of training, anchored in their RPE + fatigue logs. This is the only thing they'll see from Kit this week — make it count.

Critical rules:
- This runner is on the free tier. They have no Strava connected — no HR, no pace, no zone analysis. Only manual RPE + fatigue tags + planned session types.
- Never claim to know HR, pace, zone-discipline, or anything from "the data" beyond what's in the facts below.
- Never suggest they upgrade. The upsell is elsewhere.
- The insight is reciprocal — Kit is giving them something useful, not asking. No prompts, no questions, no "let me know if".
- One observation, one consequence. No motivational closers.

${FEW_SHOT_EXAMPLES}

Now write this athlete's weekly insight.

Week: ${input.weekLabel}
Logged: ${input.loggedCount} of ${input.plannedCount} planned sessions.

Recent completions (newest first):
${completionFacts}

Output: JSON only, exactly the shape above. No prefix, no markdown fence, no commentary.`
}
