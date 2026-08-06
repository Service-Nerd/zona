// GEN-FIX-10 (§82, 2026-08-06) — a reshape whose intervention IS removing a
// week's quality session (an efficiency or fatigue signal) records WHY on the
// week, so INV-PLAN-QUALITY-EXPECTED can tell a deliberate downgrade from a
// generator defect. Anything not listed here that strips quality is still a
// violation — that is the point.
//
// The set is typed as TriggerType so a wrong literal fails compilation: the
// original GEN-FIX-10 shipped 'fatigue', but the reshaper's fatigue trigger is
// 'fatigue_accumulation' (planAdjustment.ts), so the exemption never fired for
// fatigue downgrades and INV-PLAN-QUALITY-EXPECTED kept firing on exactly the
// case the fix exempts — producing the spurious reshape_invalid ops events it
// set out to stop. Kept in one place, shared by the route and its test, so the
// two names can't drift apart again.
import type { Week } from '@/types/plan'
import type { TriggerType } from '@/lib/coaching/planAdjustment'

export const INTENSITY_DOWNGRADE_TRIGGERS = new Set<TriggerType>([
  'ef_decline',
  'fatigue_accumulation',
])

/**
 * Stamp `week.quality_downgraded` when an intensity-downgrade trigger has left
 * the week with no quality session. Returns whether it stamped. Idempotent-ish:
 * only stamps when quality is actually absent, so a downgrade that still leaves
 * a quality session (unusual) is not falsely excused.
 */
export function recordQualityDowngrade(
  week: Week,
  triggerType: string | undefined,
  nowIso: string,
): boolean {
  if (!triggerType || !INTENSITY_DOWNGRADE_TRIGGERS.has(triggerType as TriggerType)) return false
  const stillHasQuality = Object.values(week.sessions).some(s => s?.type === 'quality')
  if (stillHasQuality) return false
  week.quality_downgraded = { trigger: triggerType, at: nowIso }
  return true
}
