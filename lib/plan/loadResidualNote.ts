// INJURY-PEAK-JUMP-01 (Coaching Board 2026-10-28, §90 Amendment 3 / §34) — the ramp residual,
// written FROM THE CHECKS' OWN VERDICT.
//
// The note used to be computed mid-build by its own predicate (curve `weekly_km`, any rise over
// the cap). That predicate over-declared on 78% of plans against the 20% the checks warn, could
// name a different week from the one the checker flagged, and could stay silent on a warned plan.
// It is now derived from the violations, so the week and the rise it names are the checker's.
//
// Called at `generateRulePlan`'s single exit and again by `composePlanWithFoundation`, because
// composing foundation weeks re-validates the plan the runner actually receives (ADR-020).

import type { GeneratorInput, Plan } from '@/types/plan'
import type { Violation } from './invariants'

/** The checks whose warning obliges the note. One list, read by the engine and its test. */
export const RAMP_RESIDUAL_CODES: readonly string[] = ['INV-PLAN-DELIVERED-RAMP', 'INV-PLAN-INJURY-CAP-DELIVERED']

export function loadResidualNoteFrom(violations: readonly Violation[], input: Pick<GeneratorInput, 'race_distance_km'>): { note: string; week: number } | null {
  const ramp = violations.filter(v => RAMP_RESIDUAL_CODES.includes(v.code) && v.ramp && v.week > 0)
  if (!ramp.length) return null
  // The injury arm is the more specific statement for the runner it applies to; otherwise the largest rise.
  const injury = ramp.filter(v => v.code === 'INV-PLAN-INJURY-CAP-DELIVERED')
  const pool = injury.length ? injury : ramp
  const v = pool.reduce((a, b) => (b.ramp!.rise_pct > a.ramp!.rise_pct ? b : a))
  const { rise_pct, cap_pct, scope } = v.ramp!
  const rise = Math.round(rise_pct)
  const head = scope === 'non_long'
    ? `In week ${v.week} your easy and quality running rises about ${rise}%, above the ${cap_pct}% weekly ceiling your injury history sets.`
    : `Week ${v.week} rises about ${rise}%, above the ${cap_pct}% weekly growth we normally allow.`
  // D6 — "your race sets the long run" is §24's floor, which exists only above 10K.
  const reason = input.race_distance_km > 10 ? ' Your race sets the long run, so it cannot be cut to fit.' : ''
  return {
    note: `${head}${reason} Keep the easy days easy that week, and move the long run rather than shorten it if the week is not going well.`,
    week: v.week,
  }
}

/** Stamp or clear the note on `plan.meta` from `violations` of THAT plan. */
export function reconcileLoadResidualNote(plan: Plan, violations: readonly Violation[], input: Pick<GeneratorInput, 'race_distance_km'>): void {
  const meta = plan.meta as Plan['meta'] & { load_residual_note?: string; load_residual_week?: number }
  const r = loadResidualNoteFrom(violations, input)
  if (r) { meta.load_residual_note = r.note; meta.load_residual_week = r.week }
  else { delete meta.load_residual_note; delete meta.load_residual_week }
}
