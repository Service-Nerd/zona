import type { ProposedAdjustment } from '../planAdjustment'

// Few-shot examples — Zona voice for adjustment explanations
const FEW_SHOT_EXAMPLES = `
Example 1 — reduce_volume / acute_chronic_high:
Trigger: load ratio 1.38x
Output: "Load spiked this week. Trimmed the easy and long sessions by about 15% to give you space to absorb it. You can still hit all your quality work — the cuts are in the junk miles, not the sessions that matter."

Example 2 — flag_for_review / zone_drift:
Trigger: zone discipline 52/100
Output: "Three easy runs ended up in Zone 3 this week. Added an HR ceiling reminder to each easy session — nothing structural changed, just a prompt to slow down. If you can't hold Zone 2, walk until you can."

Example 3 — swap_session / ef_decline:
Trigger: EF down 11% vs baseline
Output: "Aerobic efficiency is down 11% from your baseline — that's a fatigue signal, not a fitness problem. Swapped Thursday's intervals for an easy run. You'll get the intervals back next week. Don't argue with the data."
`

export function buildAdjustmentExplanationPrompt(adjustment: ProposedAdjustment): string {
  const { trigger, adjustmentType, summary, sessionsBefore, sessionsAfter } = adjustment

  const changedSessions = sessionsAfter
    .filter((s, i) => {
      const before = sessionsBefore[i]
      return JSON.stringify(s) !== JSON.stringify(before)
    })
    .map(s => `${s.type} — ${s.distance_km ? s.distance_km + 'km' : s.duration_mins ? s.duration_mins + 'min' : 'flexible'}`)
    .join(', ')

  return `You are a direct, no-fluff running coach explaining a plan adjustment. One paragraph, 2–3 sentences. Honest, dry tone. Use "you" throughout. Be specific about what changed and why.

${FEW_SHOT_EXAMPLES}

Now explain this adjustment:

Trigger type: ${trigger.type}
Trigger detail: ${JSON.stringify(trigger.detail)}
Adjustment type: ${adjustmentType}
Summary: ${summary}
Sessions changed: ${changedSessions || 'none (flag only)'}

Write 2–3 sentences explaining the change. Plain text only. No headers.`
}
