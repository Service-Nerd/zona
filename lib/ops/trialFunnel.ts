import { resolveTier, TRIAL_DAYS, type TierInputs } from '@/lib/trial'

// OPS-DIGEST-TRIAL-COHORT-01 (2026-10-09) — the trial funnel the digest reports
// had been structurally incapable of a non-zero answer.
//
// ── WHAT IT WAS ──────────────────────────────────────────────────────────────
//   (select count(*) from subscriptions s where s.status='trialing') as trialing_total
//
// ── WHY THAT IS ALWAYS ZERO ──────────────────────────────────────────────────
// Zonna's reverse trial is NOT a subscription. It is `user_settings.
// trial_started_at` plus `resolveTier`, and no code path ever writes a
// `subscriptions` row with status `trialing` for it — that status exists only for
// a provider-side trial we do not run. So:
//
//   MEASURED AGAINST PRODUCTION, 2026-10-09:
//     digest query, subscriptions.status='trialing' ....  0
//     resolveTier, real cohort ........................  5 on trial
//                                                       20 paid, 22 free
//     subscriptions rows by status ..................... { active: 19 }
//
// `at_risk_trialing` is derived from the same predicate, so **the conversion leak
// the digest instructs itself to "always surface prominently" could never fire.**
// A KPI that cannot move reads exactly like a KPI with nothing to report.
//
// ── THE SHAPE OF THE FIX ─────────────────────────────────────────────────────
// This module does NOT re-decide who is on trial. `lib/trial.ts → resolveTier`
// is the ratified single owner of the order admin -> subscription -> grant ->
// trial -> free (TIER-OWNER-01), and it is called here per runner. The only thing
// this module adds is the FLEET roll-up and the at-risk window.
//
// ⚠️ THE DIGEST CANNOT CALL THIS. It is a cloud routine, not repo code, and it
// has no way to hold `CRON_SECRET`, so its SQL necessarily MIRRORS the predicate
// — the `deloadCadence` / `tierResolution` class, which this repo has paid for.
// `digestTrialSqlMirror.test.ts` is the mechanism that keeps the two honest, the
// same way `digestEnrichSqlMirror.test.ts` does for enrichment health.

/**
 * Days without any activity signal before a trialling runner is "at risk".
 *
 * ⚠️ Three days, carried over unchanged from the query this replaces, so the
 * series does not break at the point the denominator is corrected. It is a
 * judgement, not a measurement: with 5 runners on trial there is no distribution
 * to fit. Move it with a number, not a feel.
 */
export const AT_RISK_NO_ACTIVITY_DAYS = 3

/** One row per runner: the four tier facts plus their last activity signal. */
export interface TrialFunnelRow extends TierInputs {
  user_id: string
  /** Max of session_completions / strava_activities / session_reflections /
   *  user_settings.last_today_open_at — the digest's own Active(7d) signal set. */
  lastSeen?: string | Date | null
}

export interface TrialFunnelVerdict {
  /** Runners `resolveTier` puts on `trial` right now. */
  onTrial: number
  /** On trial AND no activity signal for `AT_RISK_NO_ACTIVITY_DAYS`. The leak. */
  atRisk: number
  /** Who they are — this is who an intervention would target. */
  atRiskUsers: Array<{ user_id: string; daysQuiet: number | null }>
  paid: number
  free: number
  /**
   * ⚠️ RAISED BY ANY at-risk runner, not by a rate. At this scale a percentage is
   * noise, and a trialling runner who has gone quiet is a fact. Same call as
   * `enrichHealth.alert`, and for the same reason.
   */
  alert: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

export function judgeTrialFunnel(
  rows: readonly TrialFunnelRow[],
  now: Date = new Date(),
): TrialFunnelVerdict {
  let paid = 0
  let free = 0
  const trialling: TrialFunnelRow[] = []

  for (const r of rows) {
    const { tier } = resolveTier(r, now)
    if (tier === 'trial') trialling.push(r)
    else if (tier === 'paid') paid++
    else free++
  }

  const quietFor = (r: TrialFunnelRow): number | null =>
    r.lastSeen == null
      ? null
      : Math.floor((now.getTime() - new Date(r.lastSeen).getTime()) / DAY_MS)

  // ⚠️ A runner with NO signal at all is at risk, not excluded. `coalesce(…,
  // 'epoch')` in the SQL does the same thing, and it is the right way round: a
  // trial with no activity whatsoever is the worst case, and a `null` that
  // silently drops out of a COUNT is how a leak stays invisible.
  const atRiskRows = trialling.filter(r => {
    const d = quietFor(r)
    return d === null || d >= AT_RISK_NO_ACTIVITY_DAYS
  })

  return {
    onTrial: trialling.length,
    atRisk: atRiskRows.length,
    atRiskUsers: atRiskRows.map(r => ({ user_id: r.user_id, daysQuiet: quietFor(r) })),
    paid,
    free,
    alert: atRiskRows.length > 0,
  }
}

/** Re-exported so the mirror test has one place to read the window from. */
export { TRIAL_DAYS }
