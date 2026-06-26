import type { ProposedAdjustment } from '../planAdjustment'
import { buildVoiceHeader } from './voiceRules'
import { computeSessionDiff, summariseDiff } from '../diff/sessionDiff'

// Few-shot examples — Zonna voice for adjustment explanations.
// IMPORTANT: examples illustrate TONE only. Numbers in examples are
// representative; Claude must NOT borrow them when writing for a
// real adjustment. The hard rule below enforces this.
const FEW_SHOT_EXAMPLES = `
Example 1 — reduce_volume / acute_chronic_high:
Trigger detail: load ratio 1.38x
Output: "Load spiked 1.38x this week. Trimmed the easy and long sessions by about 15% to give you space to absorb it. You can still hit all your quality work — the cuts are in the junk miles, not the sessions that matter."

Example 2 — flag_for_review / zone_drift:
Trigger detail: zone discipline 52/100
Output: "Easy-run discipline came in at 52/100 — too much time above Zone 2. Added an HR ceiling reminder to each easy session — nothing structural changed, just a prompt to slow down. If you can't hold Zone 2, walk until you can."

Example 3 — swap_session / ef_decline:
Trigger detail: EF trend -11%
Output: "Aerobic efficiency is down 11% from your baseline — that's a fatigue signal, not a fitness problem. Swapped Thursday's intervals for an easy run. You'll get the intervals back next week. Don't argue with the data."

Example 4 — user_skip / injury signal:
Trigger detail: { session: "intervals", reason: "calf_tightness" }
Output: "Skipped the intervals — calf tightness isn't worth pushing through on a speed session. Moved it back; the work comes when the leg does."

Example 5 — sparse trigger detail:
Trigger detail: {}
Output: "Load and effort signals didn't line up this week. Pulled the easy sessions back slightly to give the legs room to absorb it."

Example 6 — flag_for_review / fitness_signal (POSITIVE — no plan change, benchmark CTA):
Trigger detail: { qualifyingCount: 3, paceScoreThreshold: 60, hrCeilingThreshold: 15 }
Output: "Three quality sessions ran ahead of target — and HR stayed controlled each time. That's not noise, it's a pattern. The plan is working from an older version of you. Worth a new benchmark to see where the ceiling actually is."

Example 7 — reduce_volume / long_run_shortfall (alignment, NOT a telling-off):
Trigger detail: { consecutiveCount: 2, avgCompletionPct: 71, threshold: 82 }
Output: "Long runs have come in around 71% of the plan two weeks running. Pulled this week's back to match where you're actually finishing — no point chasing a number that isn't landing. Build it back when it feels right."
`

/** AI-DEPTH-10 — most recent non-pending adjustment, for continuity framing. */
export interface PreviousAdjustmentSummary {
  summary:        string
  triggerType:    string
  adjustmentType: string
  status:         string
  daysAgo:        number
}

export function buildAdjustmentExplanationPrompt(
  adjustment: ProposedAdjustment,
  athleteContext?: string,
  previousAdjustment?: PreviousAdjustmentSummary | null,
): string {
  const { trigger, adjustmentType, summary, sessionsBefore, sessionsAfter } = adjustment

  // RESHAPE-FIX-WAVE2A — Per-day structural diff.
  //
  // Pre-fix: `changedSessions` enumerated sessions that differ by raw
  // JSON equality, then listed only their post-change shape. Sonnet
  // saw "long — 24km" but couldn't tell whether it had moved or stayed
  // put. The 2026-06-26 incident's "the 24km run stays intact" came
  // from this prompt opacity.
  //
  // Post-fix: feed the model the explicit diff. Each line shows
  // "Day: before → after" so the structural change is unambiguous.
  // The model is also told NOT to summarise the diff itself — that's
  // the rule-engine diff renderer's job. The model writes the WHY.
  const structuralDiff = summariseDiff(computeSessionDiff(sessionsBefore, sessionsAfter))
  const diffBlock = structuralDiff.length > 0
    ? structuralDiff.map(line => `- ${line}`).join('\n')
    : '- (no per-day changes — coaching-note adjustment only)'

  const voiceHeader = buildVoiceHeader({
    role: 'explaining a plan adjustment',
    outputConstraint: 'One paragraph, 1–3 sentences. Fewer is fine if the trigger is simple.',
  })

  const previousAdjustmentBlock = previousAdjustment
    ? `

Previous adjustment context (for continuity only):
- ${previousAdjustment.daysAgo} day(s) ago — ${previousAdjustment.adjustmentType} (${previousAdjustment.triggerType}, ${previousAdjustment.status}): "${previousAdjustment.summary}"

Continuity rule: reference the previous adjustment ONLY if this new one continues, contradicts, or repeats it — e.g. "second time this month" or "last time we softened the long run, this time we're swapping intervals." Otherwise ignore it. Never reference gratuitously.`
    : ''

  return `${voiceHeader}
${athleteContext ?? ''}${previousAdjustmentBlock}
HARD RULES — anti-confabulation:
1. The ONLY metrics you may quote are those present in the "Trigger detail" JSON below. Do not invent percentages, run counts, weekly totals, paces, or HR numbers.
2. Do not invent specifics about individual sessions ("three easy runs", "Wednesday's tempo") unless they are explicitly listed in "Structural diff".
3. If the trigger detail is sparse, write a sparse explanation. It is better to be terse than to invent.
4. Few-shot examples below are for TONE only — never copy their numbers.
5. DO NOT enumerate the structural diff yourself. The runner sees the per-day before/after as a separate component below your prose. Your job is the WHY — the reasoning, the trade-off, the coaching context. If you find yourself writing "moved X to Y," delete it: the diff already shows that.
6. DO NOT make stability claims about anything in the "Structural diff" — every entry there is a change. Phrases like "X stays intact", "Y is preserved", "Z remains" are forbidden for any session that appears in the diff. Stability prose is reserved for sessions NOT in the diff.

${FEW_SHOT_EXAMPLES}

Now explain this adjustment:

Trigger type: ${trigger.type}
Trigger detail: ${JSON.stringify(trigger.detail)}
Adjustment type: ${adjustmentType}
Engine summary (rule-based, factual): ${summary}

Structural diff (every line here is a real change — do not claim any of these are unchanged):
${diffBlock}

Write 1–3 sentences explaining the WHY behind the change. Fewer is fine. Plain text only. No headers. No enumeration of the diff. Numbers only from Trigger detail.`
}
