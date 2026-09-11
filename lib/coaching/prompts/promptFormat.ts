// Distance formatting for model prompts — BUG-KIT-DECIMALS-01.
//
// ADR-015 makes `lib/format.ts` the sole owner of every distance string the
// runner reads. `formatDistanceForPrompt()` was carved out of that rule on the
// argument that a prompt is not a display surface: it keeps full precision so
// the model can do arithmetic that agrees with the engine's own.
//
// That hole is the width of the AI layer. A number handed to Kit BECOMES
// user-facing the moment Kit repeats it — and Kit repeats distances constantly.
// Founder, 2026-09-11: "Kit says 5.7km, the plan says 6km, on the same screen."
//
// So the carve-out narrows to what it was actually for. The split is by what
// the number IS, not by which prompt it lands in:
//
//   fmtPlanned — a distance the ENGINE PRESCRIBED (session distance, weekly
//                target). The runner is looking at this number on the session
//                card or the plan header, where `formatDistance()` rounds it to
//                whole units. Kit must quote the same string.
//   fmtRace    — a race distance. The race card carries its iconic decimal
//                (`exact: true` → "21.1km", "42.2km"), never "42.195km".
//   fmtDist    — a MEASURED or ANALYTICAL value: what the runner actually ran,
//                a cohort median, a multi-month trend anchor, a phase total.
//                Precision is legitimate here and `dp` stays explicit.
//
// ⚠️ THE ONE EXCEPTION, and it is not an oversight. On a PLANNED-vs-ACTUAL
// COMPARISON — sessionFeedback / sessionReframe's "Planned distance / Actual
// distance", weeklyReport's volume line — the planned number goes through
// `fmtDist(km, 1)`, NOT `fmtPlanned`. Two reasons, both load-bearing:
//   1. Both sides of a comparison must carry the SAME precision. Quote a 5.5km
//      session as "6km" beside an actual of "5.5km" and the model narrates a
//      shortfall that did not happen — its own few-shot example is "Cut it 2km
//      short". That risk is what `formatDistanceForPrompt`'s raw km path was
//      built for (FMT-01, §66) and the reason is still good.
//   2. It is what the runner sees there anyway. The comparison line the app
//      renders beside Kit's feedback uses `formatDistance(…, { exact: true })`
//      for BOTH numbers (`manualSessionFeedback.ts`, `DashboardClient` distLine),
//      so 1dp matches that surface exactly.
// Measured 2026-09-11: every prescribed session distance the engine emits is at
// most 1dp (25,959 sessions over 621 cohort plans; 49.6% whole, 50.4% one
// decimal), so 1dp on a comparison is lossless.
//
// Guarded by `promptDistanceParity.test.ts`, which fails if a prompt builder
// passes a prescribed field through `fmtDist`.

import { formatDistance, formatDistanceForPrompt, type DistanceUnits } from '@/lib/format'

export const PROMPT_DISTANCE_FALLBACK = '—'

export interface PromptDistanceFormatters {
  /** Measured / analytical distances. `dp` null keeps the raw value. */
  fmtDist: (km: number | null | undefined, dp?: number | null) => string
  /** A distance the engine prescribed — matches the session card and plan header. */
  fmtPlanned: (km: number | null | undefined) => string
  /** A race distance — matches the race card's iconic decimal. */
  fmtRace: (km: number | null | undefined) => string
}

/**
 * One set of distance formatters bound to the runner's unit preference.
 *
 * Replaces the `const fmtDist = …` closure that was redeclared identically in
 * nine prompt builders; they now share an owner, so the planned/measured split
 * cannot be got right in one file and wrong in the next.
 */
export function promptDistanceFormatters(units: DistanceUnits): PromptDistanceFormatters {
  return {
    fmtDist: (km, dp = null) => formatDistanceForPrompt(km, units, dp) ?? PROMPT_DISTANCE_FALLBACK,
    fmtPlanned: (km) => formatDistance(km, units) ?? PROMPT_DISTANCE_FALLBACK,
    fmtRace: (km) => formatDistance(km, units, { exact: true }) ?? PROMPT_DISTANCE_FALLBACK,
  }
}
