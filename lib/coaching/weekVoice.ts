import { isLongRun } from '@/lib/plan/sessionRole'
import type { Plan, Week } from '@/types/plan'

// ── PLAN-BASED COACHING ───────────────────────────────────────────────────
//
// ⚠️ EXTRACTED FROM `DashboardClient.tsx`, WHERE IT WAS PRIVATE. Nothing about
// these functions was ever app-specific: they are pure functions of (week,
// plan) with no hooks, no auth and no state, and the file they lived in is
// 14k lines of client component. The marketing device still needs the SAME
// words the product says — the founder's rule is that a marketing screen must
// be the app's screen — and the alternative was to type the headline into a
// mockup, which is the fiction this whole strand of work exists to stop.
//
// Behaviour is unchanged; `DashboardClient` imports them from here.
//
// Week-level coaching voice — rule-engine derived, shared by two surfaces:
//   • PlanScreen  → slim inline card above the calendar
//   • CoachScreen → full PlanCoachingCard with header + footer
//
// Pure functions of (currentWeek, plan). No AI involved — so per ui-patterns.md
// § AIMark provenance rule, neither surface gets a Kit / AIMark byline.

export interface WeekVoiceContext {
  phase?: string
  hasQuality: boolean
  hasLong: boolean
  weeksToRace: number
}

export function buildWeekVoiceContext(currentWeek: Week, plan: Plan): WeekVoiceContext {
  const sessions = Object.values((currentWeek as any).sessions ?? {}) as any[]
  return {
    phase: (currentWeek as any).phase as string | undefined,
    hasQuality: sessions.some(s => s && ['quality','tempo','intervals','hard'].includes(s.type)),
    hasLong: sessions.some(s => s && isLongRun(s)),
    weeksToRace: Math.max(
      0,
      Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))
    ),
  }
}

export function getWeekVoiceHeadline(ctx: WeekVoiceContext): string {
  if (ctx.phase === 'foundation') return "Foundation week. Easy only — build the base."
  if (ctx.phase === 'taper') return "Taper week. Back off and trust the work."
  if (ctx.phase === 'peak')  return "Peak week. You're sharp. Don't add more."
  if (ctx.hasQuality && ctx.hasLong) return "Quality and long run this week. Hard stuff first, long stuff rested."
  if (ctx.hasQuality) return "Quality session this week. Everything else is recovery."
  if (ctx.hasLong)    return "Long run week. Keep easy runs genuinely easy."
  return "Steady week. Execute consistently."
}

export function getWeekVoiceItems(ctx: WeekVoiceContext, max = 3): string[] {
  const items: string[] = []
  if (ctx.hasQuality && ctx.hasLong) {
    items.push("Do the quality session before fatigue builds — earlier in the week is better.")
    items.push("The long run should be Zone 2 only. No heroics.")
  } else if (ctx.hasQuality) {
    items.push("Run the quality session when fresh — not back-to-back with another hard day.")
    items.push("Everything else this week is recovery. Treat it that way.")
  } else if (ctx.hasLong) {
    items.push("Keep the pace honest throughout — if HR climbs, walk.")
    items.push("Fuel and hydrate from the start, not when you're already behind.")
  }
  if (ctx.phase === 'base') items.push("Base phase: volume over intensity. The fitness accrues slowly. That's fine.")
  if (ctx.phase === 'taper') items.push("Resist adding miles. Your goal is to arrive fresh, not to cram.")
  if (ctx.weeksToRace <= 4 && ctx.weeksToRace > 0) items.push(`${ctx.weeksToRace} week${ctx.weeksToRace !== 1 ? 's' : ''} out. Stay disciplined.`)
  return items.slice(0, max)
}

export const PHASE_LABELS: Record<string, string> = {
  foundation: 'Foundation Block', base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper',
  // ADR-013 maintenance-plan phases — without these the raw lowercase phase leaks
  // through and the uppercase CSS renders "MAINTENANCE_RESTORATION" on the Plan card.
  maintenance_restoration: 'Restoration', maintenance_base: 'Base',
}

