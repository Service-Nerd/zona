/**
 * ACT-FUNNEL-01 / ACT-READ-COUNT-01 — the single owner of the phrase **"run read"**.
 *
 * 🔴 WHY THIS MODULE EXISTS. The founder's activation brief asked to *"define 'run read'
 * consistently everywhere it appears"*, and the phrase appears in a trial email, a funnel view and
 * (soon) a lifecycle email, each of which was free to mean something slightly different. It means
 * exactly one thing:
 *
 *   > A **run read** is a `run_analysis` row with `superseded_at IS NULL`.
 *
 * ⚠️ `superseded_at` is not decoration. A superseded row belongs to a plan week that has been
 * replaced (PLAN-WEEK-COLLISION-01); counting it reports a read the runner can no longer open.
 *
 * 🔴 AND THE COUNT USED TO BE CAPPED AT TEN. `app/api/email/send-trial/route.ts → getRunSummary`
 * did `.select(...).limit(10)` and then `analysedRunCount = rows.length`, so a runner with eleven
 * reads was told they had ten — **a hard ceiling presented as a total**, in the one email that
 * asks them to pay for reads. Latent when measured (nobody in the ended-trial cohort had passed
 * ten) and wrong the moment somebody does; the live maximum today is 15.
 *
 * 🔴 AND IT WAS NEVER SCOPED TO THE TRIAL. The same query fed copy reading *"Fourteen days, N runs
 * read"* and *"N sessions across your trial"* while counting the runner's whole history. Two
 * different claims from one number. **The window is an argument here, never a default**, so a
 * caller has to say which question it is asking.
 */

export interface RunReadWindow {
  /** Inclusive. */
  from: Date
  /** Exclusive, so a 14-day window is `[trial_started_at, trial_started_at + 14d)`. */
  to: Date
}

/** The fields the trial emails render. Kept narrow on purpose: this is not a general reader. */
export interface LatestRunRead {
  actual_load_km:       number | null
  hr_in_zone_pct:       number | null
  hr_above_ceiling_pct: number | null
  verdict:              string | null
  created_at:           string
}

/**
 * How many runs Zonna has read for this user, optionally inside a window.
 *
 * ⚠️ Uses an exact HEAD count, so there is no row limit to forget. The previous shape — fetch rows,
 * take `.length` — can only ever be as right as its `limit`.
 */
export async function countRunsRead(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  window?: RunReadWindow,
): Promise<number> {
  let q = supabase
    .from('run_analysis')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('superseded_at', null)
  if (window) {
    q = q.gte('created_at', window.from.toISOString())
         .lt('created_at', window.to.toISOString())
  }
  const { count, error } = await q
  // A failed count is NOT zero. Zero is a claim about the runner ("no runs read"); an error is a
  // claim about us, and the two must not render the same sentence.
  if (error) throw new Error(`countRunsRead failed: ${error.message}`)
  return count ?? 0
}

/** The most recent run read, or null. Same definition, same optional window. */
export async function latestRunRead(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  window?: RunReadWindow,
): Promise<LatestRunRead | null> {
  let q = supabase
    .from('run_analysis')
    .select('actual_load_km, hr_in_zone_pct, hr_above_ceiling_pct, verdict, created_at')
    .eq('user_id', userId)
    .is('superseded_at', null)
  if (window) {
    q = q.gte('created_at', window.from.toISOString())
         .lt('created_at', window.to.toISOString())
  }
  const { data, error } = await q.order('created_at', { ascending: false }).limit(1)
  if (error) throw new Error(`latestRunRead failed: ${error.message}`)
  return (data?.[0] as LatestRunRead) ?? null
}

/**
 * The trial window for a runner, from the same `TRIAL_DAYS` the tier resolver uses.
 * Returns null when they never started a trial, so a caller cannot silently invent one.
 */
export function trialWindow(w: { clockStartedAt: Date | null; endsAt: Date | null }): RunReadWindow | null {
  // 🔴 THIS TOOK `(trialStartedAt, trialDays)` AND BUILT `[stamp, stamp + 14)` ITSELF, which was
  // right for exactly as long as the trial began at signup. With
  // `TRIAL_STARTS_AT_FIRST_READ` on, a runner whose first read lands on day 16 has a trial of
  // `[16, 30)` — and the day-14 email counted `[0, 14)` and told them **0 runs read** in the mail
  // that asks them to pay for reads. Found by code review of the wiring; the interlock's sweep
  // had a clause for exactly this shape and a rewrite of mine had dropped it.
  //
  // It takes the OWNER's answer now. `resolveTrialWindow` knows about the first read, the cap and
  // the extension; this knows about none of them and must not pretend to.
  //
  // ⚠️ `clockStartedAt` null means the clock has not started, so there is no read to count and no
  // window to count it in — null, which `countRunsRead` reads as "no window" and the caller must
  // not confuse with "all time". The day-14 zero branch is reached by the COUNT being zero, which
  // it is in that state by definition.
  if (!w.clockStartedAt || !w.endsAt) return null
  return { from: w.clockStartedAt, to: w.endsAt }
}
