/**
 * RUN-ANALYSIS-SELECT-01 (2026-11-04) — the ONE column list every read of
 * `run_analysis` that feeds the score card selects.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * `buildScoreExplanations` reads twelve fields off its `analysis` argument. The
 * dashboard's SELECT fetched nine of them. The three it omitted —
 * `planned_load_km`, `planned_load_mins`, `actual_load_mins` — are the ONLY
 * inputs `compareLoad` has, so `axis` resolved to `'none'` on every row and the
 * card printed **"No distance data."** about runs whose distance was sitting in
 * the same table.
 *
 * 📐 MEASURED 2026-11-04 on all 100 live `run_analysis` rows, 6 users:
 * **87 are comparable in the TABLE. 0 are comparable on the SCREEN.** The line
 * had never rendered for anyone, and neither had "Short."
 *
 * ⚠️ THE PART WORTH REMEMBERING. `POSTRUN-METRIC-PREF-01` fixed this same line on
 * 2026-10-08, correctly, with tests — and recorded *"measured on all 83 live
 * `run_analysis` rows … 81 are km-comparable"*. **That measurement read the TABLE.
 * The screen reads the SELECT.** It concluded the duration branch was unreachable
 * when in fact BOTH branches were. A measurement taken against the database cannot
 * see a column list, and this is the third hand-typed column list in this repo to
 * silently lose a field (`SESSION_OVERRIDE_COLUMNS` exists for the same reason).
 *
 * ⚠️ `buildScoreExplanations(analysis: any, …)` is why the compiler was no help.
 * `RunAnalysisCardRow` below is the shape it actually requires; the gate in
 * `runAnalysisCardColumns.test.ts` derives BOTH sides from source — the fields the
 * function reads, and the fields each SELECT fetches — so neither can drift alone.
 */

/** Keys every caller needs to place the row against a session. */
const IDENTITY = ['week_n', 'session_day', 'source'] as const

/** What the card renders. Derived from `buildScoreExplanations`'s own reads. */
const CARD = [
  'verdict', 'total_score', 'feedback_text',
  'hr_in_zone_pct', 'hr_above_ceiling_pct', 'hr_below_floor_pct',
  'hr_discipline_score', 'distance_score', 'pace_score', 'ef_score', 'ef_trend_pct',
  // 🔴 The four the omission was about. `compareLoad` has no other inputs.
  'actual_load_km', 'planned_load_km', 'actual_load_mins', 'planned_load_mins',
] as const

/** The zone ring beneath the card. */
const ZONES = ['hr_pct_z1', 'hr_pct_z2', 'hr_pct_z3', 'hr_pct_z4_5'] as const

export const RUN_ANALYSIS_CARD_FIELDS = [...IDENTITY, ...CARD, ...ZONES] as const

/** The string handed to `.select()`. Never retype this list at a call site. */
export const RUN_ANALYSIS_CARD_COLUMNS = RUN_ANALYSIS_CARD_FIELDS.join(', ')

/**
 * The shape `buildScoreExplanations` requires. Numeric columns arrive from
 * PostgREST as strings or numbers depending on type, so these stay loose on
 * value and strict on PRESENCE — presence is what was wrong.
 */
export type RunAnalysisCardRow = {
  [K in typeof RUN_ANALYSIS_CARD_FIELDS[number]]?: number | string | null
}

/**
 * 🔴 POSTGREST RETURNS `numeric` COLUMNS AS STRINGS, AND THE CARD'S FORMATTERS REJECT THEM.
 *
 * `planned_load_km` and its three siblings are `numeric`, so a live row arrives as
 * `{ planned_load_km: "7.00" }` — quoted. `formatDistance` guards with
 * `Number.isFinite(km)`, and `Number.isFinite("6.71")` is **false** (it does not coerce),
 * so the formatter returns `null` and the card would read **"Planned null, ran null."**
 *
 * That is WORSE than the "No distance data." it replaces, and it would have shipped:
 * `compareLoad`'s own arithmetic coerces happily (`"6.71" - "7.00"` is -0.29), so every
 * comparison and every unit test passes on strings. Only the formatter notices.
 *
 * ⚠️ `actual_load_km` was in the SELECT all along and was already read as `as number`.
 * It was a string the whole time; nothing caught it because `axis` never reached
 * `'distance'`. A cast is not a conversion.
 *
 * Lives here, with the column list, because this module owns what the row LOOKS like.
 */
export function numericField(v: number | string | null | undefined): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  // ⚠️ `Number('')` and `Number('  ')` are BOTH 0, and a finite 0 would pass straight
  // through as "this run covered no ground". That is `distance_km ?? 0` (SESSION-KM-01/02)
  // and `body.hidden === true` (BOOT-STALL-HIDDEN-ABSENT-01) in a third costume: an
  // absent value written as a measured one. Caught by this module's own test.
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
