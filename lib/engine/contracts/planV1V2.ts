// FREE — infrastructure. ADR-027 B1 (ADR027-B1-CONTRACTS).
//
// The one seam between a v1 plan (what `plans.plan_json` holds and every screen reads
// today) and Plan v2. B1's exit condition is that this round-trips every stored plan:
// `toV1(toV2(p))` deep-equals `p`.
//
// What differs today is deliberately small, and every difference is lossless:
//   1. v2 carries `schema_version: 2`.
//   2. ADR-027 stamps live at the top level (`stamps`). Inside a v1 `plan_json` they
//      travel as `meta.engine_stamps`, so a v2-built plan stored through the v1 save
//      path keeps them. A v1 plan the current engine built has no stamps, and its v2
//      form has no `stamps` key: absence is not written as a value.
//   3. A week key v2 does not declare moves to the opaque `v1_carry` and back. Only a
//      retired field is ever there (see `PlanV2Schema.v1_carry`).
// Later B-phases change the v2 shape here and nowhere else (ARCH-ENG-010).
//
// Neither function parses. Validation is `parsePlanV2`, separately, so a caller can
// tell "the adapter lost a field" from "the plan is not valid v2".

import type { Plan } from '@/types/plan'
import { PlanV2Schema, WeekV2ObjectSchema, type PlanV2, type EngineStamps } from './planV2'

const V2_ONLY_TOP_LEVEL = new Set(['schema_version', 'stamps', 'v1_carry'])
const WEEK_KEYS = new Set(Object.keys(WeekV2ObjectSchema.shape))

/** v1 → v2. Pure: the input is not mutated. */
export function toV2(plan: Plan): PlanV2 {
  const src = structuredClone(plan) as unknown as Record<string, unknown>
  const meta = { ...(src.meta as Record<string, unknown>) }
  const stamps = meta.engine_stamps as EngineStamps | undefined
  delete meta.engine_stamps
  const carry: Record<string, Record<string, unknown>> = {}
  const weeks = Array.isArray(src.weeks)
    ? (src.weeks as Record<string, unknown>[]).map((w, i) => {
        const kept: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(w)) {
          if (WEEK_KEYS.has(k)) kept[k] = v
          else (carry[String(i)] ??= {})[k] = v
        }
        return kept
      })
    : src.weeks
  const out: Record<string, unknown> = { schema_version: 2 }
  for (const [k, v] of Object.entries(src)) out[k] = k === 'meta' ? meta : k === 'weeks' ? weeks : v
  if (stamps !== undefined) out.stamps = stamps
  if (Object.keys(carry).length > 0) out.v1_carry = { weeks: carry }
  return out as unknown as PlanV2
}

/** The week keys `toV2` carried rather than declared. Empty for anything the engine builds. */
export function carriedWeekKeys(plan: PlanV2): string[] {
  const c = plan.v1_carry?.weeks ?? {}
  return Array.from(new Set(Object.values(c).flatMap(w => Object.keys(w)))).sort()
}

/** v2 → v1. Pure: the input is not mutated. */
export function toV1(plan: PlanV2): Plan {
  const src = structuredClone(plan) as unknown as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(src)) {
    if (V2_ONLY_TOP_LEVEL.has(k)) continue
    out[k] = v
  }
  if (src.stamps !== undefined) {
    out.meta = { ...(src.meta as Record<string, unknown>), engine_stamps: src.stamps }
  }
  const carry = (src.v1_carry as { weeks?: Record<string, Record<string, unknown>> } | undefined)?.weeks
  if (carry && Array.isArray(out.weeks)) {
    out.weeks = (out.weeks as Record<string, unknown>[]).map((w, i) => carry[String(i)] ? { ...w, ...carry[String(i)] } : w)
  }
  return out as unknown as Plan
}

export function isPlanV2(plan: unknown): plan is PlanV2 {
  return typeof plan === 'object' && plan !== null && (plan as { schema_version?: unknown }).schema_version === 2
}

/** Strict parse. On failure, names every offending path (an unknown key reads as
 *  `meta: Unrecognized key: "foo"`), so a stored plan that does not fit says why. */
export function parsePlanV2(plan: unknown):
  | { ok: true; plan: PlanV2 }
  | { ok: false; issues: string[] } {
  const r = PlanV2Schema.safeParse(plan)
  if (r.success) return { ok: true, plan: r.data }
  return { ok: false, issues: r.error.issues.map(i => `${i.path.join('.') || '<root>'}: ${i.message}`) }
}
