// Pure helper for substituting `{{token}}` placeholders in session_guidance
// text with the runner's actual numbers. No React, no Supabase — drop-in for
// any render path that has the runner's plan + current session in scope.
//
// Token syntax:
//   {{token}}              — replaced with the value, or '' if missing
//   {{token|fallback}}     — replaced with the value, or `fallback` if missing
//
// Tokens that don't appear in the context resolve to '' (or the fallback).
// Unknown tokens are passed through to fallback for the same reason. This is
// intentional: the rendering surface should never crash on a typo'd token —
// the missing value just renders blank.
//
// Token vocabulary (v1):
//
//   Plan-level (from plan.meta and the dashboard's HR/zone props):
//     {{zone2_ceiling}}    — Z2 HR ceiling, integer bpm
//     {{max_hr}}           — derived max HR, integer bpm
//     {{resting_hr}}       — runner's resting HR, integer bpm (omit if missing)
//     {{goal_pace}}        — race goal pace, e.g. "5:27 /km" (time-targeted only)
//
//   Session-level (from the current Session):
//     {{session_pace}}     — pace_target, e.g. "6:06–7:17 /km"
//     {{session_hr}}       — hr_target, e.g. "< 141 bpm" or "141–154 bpm"
//     {{session_zone}}     — zone, e.g. "Zone 2" / "Zone 3–4"
//     {{session_distance}} — distance_km
//     {{session_duration}} — duration_mins
//     {{session_rpe}}      — rpe_target (1–10)
//     {{session_label}}    — session label, e.g. "Long run — Zone 2"
//
// Add new tokens by extending GuidanceContext + the lookup map below.

export interface GuidanceContext {
  zone2_ceiling?: number | null
  max_hr?: number | null
  resting_hr?: number | null
  goal_pace?: string | null

  session_pace?: string | null
  session_hr?: string | null
  session_zone?: string | null
  session_distance?: number | null
  session_duration?: number | null
  session_rpe?: number | null
  session_label?: string | null
}

// Tolerant of optional whitespace inside braces ({{ token }} as well as {{token}})
// — the AI enricher has been observed to add stray spaces.
const TOKEN_RE = /\{\{\s*(\w+)\s*(?:\|([^}]*))?\}\}/g
// Catches anything that looks like an orphan template token after substitution
// (malformed braces the main regex couldn't parse). Belt-and-braces against
// raw `{{...}}` ever reaching the user.
const ORPHAN_RE = /\{\{[^}]*\}?\}?/g

export function renderGuidance(
  text: string | null | undefined,
  ctx: GuidanceContext,
): string {
  if (!text) return ''
  const substituted = text.replace(TOKEN_RE, (_match, token: string, fallback: string | undefined) => {
    const value = (ctx as Record<string, unknown>)[token]
    if (value === undefined || value === null || value === '') {
      return fallback ?? ''
    }
    return String(value)
  })
  // Strip any orphaned template syntax, then collapse the double spaces that
  // empty substitutions leave behind ("Run for  minutes" → "Run for minutes").
  return substituted
    .replace(ORPHAN_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
}

/** Build a context from a Session and the dashboard's HR/zone props. Omits
 *  null/undefined fields so the renderer can fall back gracefully. */
export function guidanceContextFromSession(args: {
  session: { pace_target?: string; hr_target?: string; zone?: string; distance_km?: number; duration_mins?: number; rpe_target?: number; label?: string } | null | undefined
  zone2Ceiling?: number | null
  maxHR?: number | null
  restingHR?: number | null
  goalPace?: string | null
}): GuidanceContext {
  const s = args.session
  return {
    zone2_ceiling: args.zone2Ceiling ?? undefined,
    max_hr:        args.maxHR ?? undefined,
    resting_hr:    args.restingHR ?? undefined,
    goal_pace:     args.goalPace ?? undefined,
    session_pace:     s?.pace_target,
    session_hr:       s?.hr_target,
    session_zone:     s?.zone,
    session_distance: s?.distance_km,
    session_duration: s?.duration_mins,
    session_rpe:      s?.rpe_target,
    session_label:    s?.label,
  }
}

/**
 * PLAN-LEVEL prose: `meta.coach_intro`, `meta.plan_intro`, and a week `theme`.
 *
 * ── WHY THIS EXISTS, AND WHY IT IS NOT `guidanceContextFromSession` ──────────
 * COACH-INTRO-TOKEN-01 (2026-10-09). `GeneratePlanScreen` rendered
 * `meta.coach_intro` through `convertDistanceString` alone, so an unresolved
 * `{{token}}` the enricher emitted reached the runner verbatim, on the first
 * screen they see after their plan is generated.
 *
 * Measured across all 34 live plans, by field:
 *   session.coach_notes  1,115 tokens / 22 plans — REQUIRED by design, and
 *                        already substituted by `renderGuidance`. Correct.
 *   week.theme              49 tokens / 11 plans — no reachable render today.
 *   meta.coach_intro         1 token  /  1 plan  — RENDERED RAW. 🔴
 *   meta.notes               1 token  /  1 plan  — no consumer at all.
 *
 * Both live tokens are `{{zone2_ceiling}}`, which is a PLAN-level value, so the
 * substitution is real and not a strip-and-hope.
 *
 * ⚠️ IT TAKES THE PLAN'S OWN `meta`, NOT THE DASHBOARD'S DEVICE-DERIVED CEILING,
 * and that is a decision rather than convenience. `effectiveZone2Ceiling` prefers
 * a Karvonen value computed from today's resting/max HR; `meta.zone2_ceiling` is
 * what the engine built the plan with and what the enricher saw when it wrote
 * `{{zone2_ceiling}}` into that sentence. Printing the device value would put a
 * number in the prose that contradicts the plan's own HR targets. Taking `meta`
 * also means no call site can pick a different source — one rule, three surfaces,
 * no per-site variation to drift.
 *
 * ⚠️ THE SESSION CONTEXT IS DELIBERATELY ABSENT, not forgotten. These strings are
 * about the whole plan and there is no session in scope where they render, so a
 * session token in one of them has no correct value — `renderGuidance` resolves it
 * to its fallback or to empty, and `ORPHAN_RE` guarantees no brace survives either
 * way. That is `renderGuidance`'s own documented promise: "belt-and-braces against
 * raw `{{...}}` ever reaching the user". This is the surface where that promise was
 * not kept.
 */
export function planProseContext(
  meta: {
    zone2_ceiling?: number | null
    max_hr?: number | null
    resting_hr?: number | null
    goal_pace_per_km?: string | null
  } | null | undefined,
): GuidanceContext {
  return {
    zone2_ceiling: meta?.zone2_ceiling ?? undefined,
    max_hr:        meta?.max_hr ?? undefined,
    resting_hr:    meta?.resting_hr ?? undefined,
    goal_pace:     meta?.goal_pace_per_km ?? undefined,
  }
}

/**
 * THE SINGLE OWNER of "render a plan-level string to a runner".
 *
 * Substitutes plan-level tokens, strips any orphan brace, and then applies the
 * reader's unit preference — in that ORDER, deliberately: `convertDistanceString`
 * rewrites "12 km" into "7 mi", and a token that resolves to a distance has to
 * exist before it can be converted. Doing it the other way round converts the
 * literal text of the template and leaves the brace.
 */
export function renderPlanProse(
  text: string | null | undefined,
  ctx: GuidanceContext,
  convert: (s: string) => string | null | undefined,
): string {
  const substituted = renderGuidance(text, ctx)
  if (!substituted) return ''
  return convert(substituted) ?? substituted
}
