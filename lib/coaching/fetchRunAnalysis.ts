// POSTRUN-POLL-WEEK-BLIND-01 (2026-10-07) — the single owner of "fetch THIS
// session's run analysis".
//
// 🔴 WHY IT IS A MODULE AND NOT A QUERY INSIDE AN EFFECT. The post-run poll ran
// this query inline, and it omitted `week_n`:
//
//     .eq('user_id', uid).is('superseded_at', null)
//     .eq('session_day', sessionDay).maybeSingle()
//
// `session_day` IS NOT A KEY. A runner with analysed runs on the same weekday in
// two different weeks has two live rows; `maybeSingle()` returns
// `{ data: null, error }` on more than one row; and the call site destructured the
// error away. So the poll could never resolve — it ticked 16 × 2.5s and surfaced
// "Taking longer than usual."
//
// MEASURED ON THE FOUNDER'S RUN: the AI finished in 127 ms (ai_call 13:45:52.945Z,
// row written 13:45:53.072Z) and he watched a loading state for SEVENTEEN MINUTES
// over data that was already there. 2 of the 5 users with any analysis were already
// in that state; worst collision 19 rows on one weekday; and it degrades for every
// runner from roughly week 2, when weekdays start repeating.
//
// ⚠️ IT LIVES HERE SO IT CAN BE RUN. Inside a React effect it was unreachable by any
// test — `vitest.config.ts` is `environment: 'node'` with no jsdom — so the only
// available check was a source assertion, and a source assertion passes on a comment.
// `fetchRunAnalysis.test.ts` drives THIS, against a fake client that reproduces
// `maybeSingle()`'s real cardinality behaviour.

/** The columns the post-run card and the session card both read. */
export const RUN_ANALYSIS_COLUMNS =
  'session_day, week_n, source, verdict, total_score, feedback_text, hr_in_zone_pct, ' +
  'ef_trend_pct, hr_discipline_score, distance_score, pace_score, ef_score, ' +
  'planned_load_km, actual_load_km, planned_load_mins, actual_load_mins'

export interface RunAnalysisFetchResult {
  row: Record<string, unknown> | null
  /** Non-null when the query itself failed. NEVER discard this: swallowing it is
   *  what made a hard failure look like "the analysis is still running". */
  error: { message: string } | null
}

/**
 * @param weekN      REQUIRED. Together with `sessionDay` this is the key; alone,
 *                   `sessionDay` matches every week the runner has ever trained.
 */
export async function fetchRunAnalysis(
  supabase: any,
  userId: string,
  weekN: number,
  sessionDay: string,
): Promise<RunAnalysisFetchResult> {
  const { data, error } = await supabase
    .from('run_analysis')
    .select(RUN_ANALYSIS_COLUMNS)
    .eq('user_id', userId)
    .is('superseded_at', null)   // PLAN-WEEK-COLLISION-01: live plan only
    .eq('week_n', weekN)
    .eq('session_day', sessionDay)
    .maybeSingle()
  return { row: (data as Record<string, unknown> | null) ?? null, error: error ?? null }
}
