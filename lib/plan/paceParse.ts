// MKT-PLAN-SEGMENT-BASIS-01 (Coaching Board 2026-09-30) — the single owner of
// "turn a prescribed pace STRING back into minutes per km".
//
// ── WHY THIS FILE EXISTS, AND WHY NOW ───────────────────────────────────────
// This function was private to `invariants.ts`, where TEN call sites already
// depend on it — including the one that reads `plan.meta.goal_pace_per_km`. So
// parsing a pace string is not a workaround in this codebase; the constitution's
// own enforcement layer is built on it.
//
// `sessionComposer.ts` now needs the same operation to price a race-pace segment
// at the segment's pace instead of the session's average. That would have made
// TWO copies, and this repo's most expensive defect class is exactly that shape:
// the tier order written three times with the test asserting its own copy
// (TIER-OWNER-01), the deload cadence in five places in one file
// (DELOAD-OWNER-01), `sumWeeklyKm`'s expression in six places with a second
// incompatible answer in fourteen more (SESSION-KM-01/02), fourteen hand-written
// Anthropic calls (OPS-AI-OWNER-01). Every one was extracted AFTER it drifted.
//
// ⚠️ EXTRACTED BEFORE THE SECOND COPY EXISTED, not after. That is the only
// difference between this file and those four incidents.
//
// ⚠️ NOT A MOVE OF BEHAVIOUR. The body is byte-identical to the private version;
// `invariants.ts` imports it and its ten call sites are unchanged. If this file
// alters a single parse result, the invariant layer's own suite says so.

/**
 * Minutes per km from a prescribed pace string, or `null`.
 *
 * Accepts a band (`"5:30–6:00"`, returning the MIDPOINT) or a single pace
 * (`"5:00 /km"`). Tolerates trailing units and an en or hyphen dash, because
 * §ADR-015's formatters emit an EN dash in ranges and hand-authored fixtures
 * carry hyphens.
 *
 * ⚠️ RETURNS `null`, NEVER 0. A zero would assert "this pace is infinitely fast"
 * and divide into nonsense downstream — the `?? 0` class this repo has paid for
 * four separate times (SESSION-KM-01/02: `distance_km ?? 0` asserted a session
 * covered no ground, and four checks silently never ran). Callers choose between
 * skipping and defaulting; they are never handed a number that looks valid.
 */
export function parsePaceMidpoint(s: string): number | null {
  const m = s.match(/^(\d+):(\d+)\s*[–-]\s*(\d+):(\d+)/)
  if (!m) {
    const single = s.match(/^(\d+):(\d+)/)
    if (!single) return null
    return parseInt(single[1], 10) + parseInt(single[2], 10) / 60
  }
  const fast = parseInt(m[1], 10) + parseInt(m[2], 10) / 60
  const slow = parseInt(m[3], 10) + parseInt(m[4], 10) / 60
  return (fast + slow) / 2
}
