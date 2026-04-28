// dailyCoachNote prompt — generates the one-sentence Z coach note shown
// at the top of the Today screen for paid/trial users. Anchored in this
// user's last few days, not generic week-phase strings.
//
// Voice authority: docs/canonical/brand.md (honest, slightly dry, never
// cheerleader, no emojis, one sentence). Few-shot examples below pull
// directly from brand.md.
//
// Output contract: exactly one sentence. No quotes. No prefix.

export interface DailyCoachNoteInput {
  /** "Tuesday" — for natural reference if the model wants it. */
  todayDayName: string
  /** Today's session type ("easy", "long", "rest", etc.) — or null if no plan today. */
  todaySessionType: string | null
  /** Today's prescribed zone label, e.g. "Zone 2", "Zone 3". Null on rest days. */
  todayZoneLabel: string | null
  /** Today's distance in km if applicable. */
  todayDistanceKm: number | null

  /** Most recent completed session — what happened last time they ran. */
  lastSession: {
    daysAgo: number                 // 1 = yesterday, 2 = day before, etc.
    type: string                    // 'easy', 'quality', etc.
    verdict: string | null          // 'nailed' / 'close' / 'off_target' / 'concerning' / null
    hrAboveCeilingPct: number | null  // % of run above Z2 ceiling (drift signal)
    rpe: number | null              // 1–10
    fatigueTag: string | null       // 'Fresh' / 'Fine' / 'Heavy' / 'Wrecked'
  } | null

  /** Plan context. */
  weekPhase: string | null          // 'base' / 'build' / 'peak' / 'taper'
  weekN: number
  totalWeeks: number
  weeksToRace: number | null
  raceName: string | null
  raceDistanceKm: number | null

  /** Pattern signals. */
  heavyFatigueTrend: boolean        // 2+ of last 3 fatigue tags are Heavy/Wrecked
  consecutiveNailed: number         // count of recent nailed sessions in a row

  /** Optional first name — model may use once, naturally. */
  firstName: string | null
}

// Few-shot examples — Zona voice anchored. Each shows a specific recent
// reality being acknowledged in one sentence. NEVER generic phase strings.
const FEW_SHOT_EXAMPLES = `
Example 1 — yesterday's easy ran hot, today is also easy:
Input: today=easy, last=easy 1 day ago, off_target, 38% above ceiling
Output: "Yesterday's easy ran hot — pull this one back from the start."

Example 2 — two nailed sessions, today is the long run:
Input: today=long, last=quality 2 days ago, nailed; consecutiveNailed=2
Output: "Two good ones banked. Don't ruin it on the long run."

Example 3 — heavy fatigue trend, today is easy:
Input: today=easy, heavyFatigueTrend=true
Output: "Body's been talking. Today's a 'do less' day, even on the easy run."

Example 4 — taper week, race close:
Input: today=easy, phase=taper, weeksToRace=2
Output: "Taper week. The work is already in the bank — don't add to it."

Example 5 — rest day after a hard one:
Input: today=rest, last=intervals 1 day ago, nailed
Output: "Hard session yesterday. Do nothing today. It helps."

Example 6 — first quality of the cycle:
Input: today=quality, phase=build, no recent quality
Output: "First quality of the build. Hit the band — don't overcook it."

Example 7 — long run week, no fatigue concerns, no recent issue:
Input: today=easy, last=easy 2 days ago, nailed; long run on Saturday
Output: "Easy day. Saturday's long run is the anchor — keep this one boring."

Example 8 — concerning RPE on last session:
Input: today=easy, last=easy 1 day ago, RPE 8
Output: "RPE 8 yesterday on what should've been easy — check the legs before you start."

Example 9 — long gap since last run:
Input: today=easy, last=easy 5 days ago
Output: "Five days off. Today is a re-entry, not a comeback — keep it short and slow."

Example 10 — solid form, nothing notable:
Input: today=easy, last=easy 2 days ago, nailed; no flags
Output: "Easy day. You know the drill — embarrassingly slow, the whole way."
`

export function buildDailyCoachNotePrompt(input: DailyCoachNoteInput): string {
  const facts: string[] = []

  // Today
  if (input.todaySessionType === 'rest' || !input.todaySessionType) {
    facts.push('Today: rest day')
  } else {
    const dist = input.todayDistanceKm ? `${Math.round(input.todayDistanceKm)}km ` : ''
    const zone = input.todayZoneLabel ? ` (${input.todayZoneLabel})` : ''
    facts.push(`Today: ${dist}${input.todaySessionType}${zone}`)
  }

  // Last session
  if (input.lastSession) {
    const ls = input.lastSession
    const ago = ls.daysAgo === 1 ? 'yesterday' : `${ls.daysAgo} days ago`
    const parts: string[] = [`${ls.type} ${ago}`]
    if (ls.verdict) parts.push(`verdict: ${ls.verdict}`)
    if (ls.hrAboveCeilingPct !== null && ls.hrAboveCeilingPct > 15) parts.push(`${Math.round(ls.hrAboveCeilingPct)}% above zone ceiling`)
    if (ls.rpe !== null) parts.push(`RPE ${ls.rpe}`)
    if (ls.fatigueTag) parts.push(`tagged ${ls.fatigueTag}`)
    facts.push(`Last session: ${parts.join(', ')}`)
  } else {
    facts.push('No recent completed sessions')
  }

  // Plan context
  if (input.weekPhase) facts.push(`Phase: ${input.weekPhase} (week ${input.weekN}/${input.totalWeeks})`)
  if (input.weeksToRace !== null && input.weeksToRace >= 0) {
    facts.push(`Race: ${input.raceName ?? 'target race'}${input.raceDistanceKm ? ` (${input.raceDistanceKm}km)` : ''}, ${input.weeksToRace} weeks away`)
  }

  // Pattern signals
  if (input.heavyFatigueTrend) facts.push('Pattern: heavy/wrecked fatigue tag in 2+ of last 3 sessions')
  if (input.consecutiveNailed >= 2) facts.push(`Pattern: ${input.consecutiveNailed} nailed sessions in a row`)

  return `You are Zona — a direct, no-fluff running coach. Voice rules from brand.md, non-negotiable:

- Honest, slightly dry, self-aware. Never cheerleader.
- One sentence. Always. No headers, no quotes around the output.
- Specific beats abstract. Reference one specific fact from the data when possible.
- Never use: "amazing", "great job", "crushing", "smash", "beast mode", "you've got this", "based on your data", "it seems like", emojis, exclamation marks for routine moments.
- Always use: short sentences, plain words, the user's actual recent reality.
- Examples that work: "Bit keen. Ease it back." / "There it is. Don't ruin it." / "Do nothing. It helps." / "Body's talking. Listen to it."
- Examples that don't work: "Great session yesterday!" / "Beast mode time!" / "Based on your data, it looks like..."

Your job: write ONE sentence framing today, anchored in a specific fact from below.${input.firstName ? ` You may address ${input.firstName} once if it lands naturally — don't force it.` : ''}

${FEW_SHOT_EXAMPLES}

Now write the daily coach note for this athlete:

${facts.join('\n')}

Output: one sentence in Zona voice, anchored in the most relevant fact above. No quotes. No prefix. Just the sentence.`
}
