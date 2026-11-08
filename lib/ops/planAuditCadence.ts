/**
 * OPS-AUDIT-CADENCE-DOC-01 (2026-11-08) — how long since the audit last ran, published
 * by the audit itself.
 *
 * 🔴 WHY A NUMBER AND NOT A BOOLEAN. The daily digest asked *"did the audit run today?"*
 * and reported *"ran once and has not run since"* — which was **true within a calendar
 * day and false about the world**. The workflow is scheduled `45 7 * * *`; GitHub Actions
 * best-effort scheduling on free runners lands it hours later, so a digest written at
 * 09:00 UTC is asking about a run that has not happened yet and will not for five more
 * hours. Measured over **54 consecutive days (2026-09-16 → 2026-11-08, zero gaps)**:
 * landings **11:46–17:27 UTC**, lag against schedule **241–582 min** (4 h 01 m – 9 h 42 m),
 * mean **374 min**, p95 **504 min**.
 *
 * 🔑 SO THE REPO PUBLISHES THE INTERVAL AND THE DIGEST STOPS DOING CALENDAR ARITHMETIC.
 * "Hours since the previous run" is a property of the data; "did it run today" is a
 * property of the clock the reader happens to be holding.
 *
 * ⚠️ NOT A STALENESS VERDICT, DELIBERATELY. No threshold, no `stale: true` — the route's
 * own `newest_invalid_plan_age_days` comment makes the argument: *"a hardcoded window
 * would rot silently the first time the deploy cadence changed"*. The real gap ranges
 * **21.8 h – 26.9 h** and exceeds 24 h on **25 of 53** observed intervals, so any
 * "late" line drawn at a day would fire on half of all normal mornings — NOISE-GATE-01.
 */

/** The audit's own schedule, for the record. Not used to compute anything here: see below. */
export const PLAN_AUDIT_SCHEDULE_UTC = '45 7 * * *'

export type AuditCadence = { hours_since_previous_run?: number }

/**
 * Hours between the previous `plan-audit-summary` row and this run, to one decimal.
 *
 * ⚠️ ABSENT, NEVER ZERO, when there is no previous run to measure from. `?? 0` would
 * assert "it ran a moment ago", which is the most dangerous possible value for a
 * staleness field and the `absence-written-as-a-value` class this repo keeps paying for.
 * **A reader must treat absence as UNKNOWN and never as fine.**
 *
 * 🔻 DECLARED LIMIT, and it is a function of fleet size rather than of time. The caller
 * reads the previous summary out of a 1,000-row window over `kind='plan_rule_invalid'`,
 * which also holds one row per breaching plan per run. At ~16 rows a day that window is
 * about two months; as the fleet grows it shrinks in days, and the field goes absent
 * before anything is wrong. That is the second reason absence cannot mean "fine".
 *
 * 🔻 AND THERE IS NO LAG-AGAINST-SCHEDULE FIELD, on purpose. The route cannot tell a
 * cron POST from a `workflow_dispatch` or a hand-run GET, so a per-run "late by N
 * minutes" would be computed against a schedule that did not trigger it — a number whose
 * meaning depends on provenance the route does not have. The measurement belongs in the
 * workflow header, where it is stated once with its method; see
 * `.github/workflows/ops-cron-plan-audit.yml`.
 */
export function cadenceSinceLastRun(opts: { now: Date; previousRunAt: string | null | undefined }): AuditCadence {
  const { now, previousRunAt } = opts
  if (!previousRunAt) return {}
  const prev = new Date(previousRunAt).getTime()
  if (!Number.isFinite(prev)) return {}
  const hours = (now.getTime() - prev) / 3_600_000
  // A negative interval is clock skew or a mis-ordered read, not a cadence. Reporting it
  // as a cadence would hand the digest a number that cannot be interpreted.
  if (!Number.isFinite(hours) || hours < 0) return {}
  return { hours_since_previous_run: Math.round(hours * 10) / 10 }
}
