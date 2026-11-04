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

/** Text columns. Everything else on this row is numeric. */
const TEXT_FIELDS = ['session_day', 'source', 'verdict', 'feedback_text'] as const

/**
 * The shape the card requires.
 *
 * ⚠️ **VALUES ARE NUMBERS, AND I RECORDED THE OPPOSITE.** An earlier cut of this module
 * asserted that PostgREST returns `numeric` columns quoted, added a `numericField()`
 * converter, and wrote the claim into the incident doc and build log as measured fact.
 * It is FALSE. A live `supabase-js` read returns `{ planned_load_km: 7, actual_load_km:
 * 6.71, ef_trend_pct: 5.2 }` — unquoted, `typeof === 'number'`.
 *
 * 🔑 **The mistake was the INSTRUMENT.** The quoted `"7.00"` I saw came from the Supabase
 * MCP `execute_sql` tool, which serialises numerics as strings. That is not the transport
 * the app uses. The codebase's own evidence said so all along: `ef_trend_pct` is
 * `NUMERIC(6,2)`, is read `as number`, and has `.toFixed(1)` called on it — which would
 * throw on a string, on a line the screenshot shows rendering fine.
 *
 * **Measure with the client the producer actually calls.**
 */
export type RunAnalysisCardRow = {
  [K in typeof RUN_ANALYSIS_CARD_FIELDS[number]]?:
    K extends typeof TEXT_FIELDS[number] ? string | null : number | null
}
