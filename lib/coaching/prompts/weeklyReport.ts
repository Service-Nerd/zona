import type { Plan } from '@/types/plan'
import type { InsightPriority, WeeklyReportData } from '../weeklyReport'

// Few-shot examples — Zona voice for each insight type
const FEW_SHOT_EXAMPLES: Partial<Record<InsightPriority, string>> = {
  load_spike: `
Headline: "You did too much."
Body: "Load ratio hit 1.4x this week — that's not building fitness, that's building fatigue debt. The gains come in recovery, not in the extra kilometres you added on Thursday. Next week: back off 15–20% on the easy sessions."
CTA: "Keep the long run. Cut one easy session entirely."`,

  zone_drift: `
Headline: "Easy runs weren't easy."
Body: "Zone 2 discipline dropped below 65% this week — most of it in the easy runs. You're training in no-man's land: hard enough to fatigue, not hard enough to build. The fix is slower, not harder."
CTA: "If HR climbs past the ceiling on any run this week, walk. Immediately."`,

  shadow_load: `
Headline: "You're running more than the plan says."
Body: "Actual kilometres came in 22% over plan this week. That might feel good right now, but it's masking the recovery the plan built in. The plan isn't a floor — it's the target."
CTA: "This week: no unplanned runs. Run exactly what's in the plan, no more."`,

  ef_decline: `
Headline: "Your engine is getting less efficient."
Body: "Aerobic efficiency dropped 10% vs your 4-week average — you're working harder for the same speed. That's a fatigue signal. It usually means recovery has been compromised somewhere: sleep, extra activity, or just accumulated load."
CTA: "Swap one quality session for an easy run this week. Let the legs breathe."`,

  solid_week: `
Headline: "Solid week."
Body: "Zone discipline was above 80%, load came in on plan, and there's no alarm worth raising. This is the kind of week that quietly builds fitness. The boring ones add up."
CTA: "Keep the same structure next week."`,

  low_data: `
Headline: "Not enough data yet."
Body: "Only one run logged this week — can't say much that's useful from one data point. Get the sessions in and the picture gets clearer."
CTA: "Log the rest of this week's sessions."`,
}

export function buildWeeklyReportPrompt(
  data: WeeklyReportData,
  plan: Plan,
  weekN: number,
  firstName?: string,
  dayOfWeek?: string,
  sessionsPlannedToDate?: number,
  plannedKmToDate?: number,
): string {
  const weeksToRace = plan.meta.race_date
    ? Math.max(0, Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))
    : null
  const raceContext = plan.meta.race_name
    ? `${plan.meta.race_name}${plan.meta.race_distance_km ? ` (${plan.meta.race_distance_km}km)` : ''}${weeksToRace !== null ? `, ${weeksToRace} weeks away` : ''}`
    : 'target race'

  const example = FEW_SHOT_EXAMPLES[data.primaryInsight] ?? FEW_SHOT_EXAMPLES.solid_week!

  // Mid-week context: show sessions/km vs what was due by today, not the full week target
  const isMidWeek = dayOfWeek !== undefined && dayOfWeek !== 'Sunday'
  const sessionLine = (isMidWeek && sessionsPlannedToDate !== undefined)
    ? `Sessions completed: ${data.sessionsCompleted} of ${data.sessionsPlanned} this week (${sessionsPlannedToDate} due by ${dayOfWeek})`
    : `Sessions completed: ${data.sessionsCompleted} of ${data.sessionsPlanned}`
  const volumeLine = (isMidWeek && plannedKmToDate !== undefined)
    ? `Volume: ${data.totalKmActual.toFixed(1)}km actual vs ${plannedKmToDate.toFixed(1)}km due by ${dayOfWeek} (${data.totalKmPlanned.toFixed(1)}km full-week target)`
    : `Volume: ${data.totalKmActual.toFixed(1)}km actual vs ${data.totalKmPlanned.toFixed(1)}km planned`

  return `You are a direct, no-fluff running coach writing a weekly check-in. Honest, slightly dry, never cheerleader. Use "you" throughout.${firstName ? ` Address ${firstName} naturally if appropriate (once, max).` : ''}
${isMidWeek ? ` Important: it is currently ${dayOfWeek} — this is a mid-week report. Evaluate against what was due by today, not the full week target.` : ''}
Output format — exactly three fields:
Headline: [one punchy sentence, 8 words max]
Body: [2–3 sentences, specific and data-driven]
CTA: [one actionable sentence starting with a verb]

${example}

Now write the weekly report for this athlete:

Race: ${raceContext}
Week: ${weekN} of ${plan.weeks.length}

This week's data:
- ${sessionLine}
- ${volumeLine}
- Load ratio (vs 4-week avg): ${data.acuteChronicRatio.toFixed(2)}x
- Zone discipline score: ${data.zoneDisciplineScore !== null ? `${data.zoneDisciplineScore}/100` : 'no signal (no Strava-analysed sessions yet)'}
${data.avgRpe !== null ? `- Avg RPE: ${data.avgRpe.toFixed(1)}\n` : ''}- Dominant coaching flag: ${data.dominantFlag}
- Primary insight: ${data.primaryInsight}

Write the three fields above. No extra commentary. No headers. No markdown.`
}
