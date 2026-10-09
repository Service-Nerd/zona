# Runbook — the daily digest's trial funnel

**Owner of the judgement:** `lib/ops/trialFunnel.ts` (`judgeTrialFunnel`), which calls
`lib/trial.ts → resolveTier` per runner rather than re-deciding anything.
**Gate:** `lib/ops/digestTrialSqlMirror.test.ts` compares the SQL recorded below against
that module's constants and predicate. If it goes red, re-apply the SQL here and in the
live routine.
**Filed as:** `OPS-DIGEST-TRIAL-COHORT-01`.

---

## Why this runbook exists

The digest's Q2 counted the trial cohort as:

```sql
(select count(*) from subscriptions s where s.status='trialing') as trialing_total,
```

Zonna's reverse trial is **not** a subscription. It is `user_settings.trial_started_at`
plus `resolveTier`, and nothing ever writes a `subscriptions` row with status `trialing`
for it. So the count was always zero, and so was `at_risk_trialing` — which the prompt
instructs itself to *"always surface prominently"* as the conversion leak.

**Measured against production on 2026-10-09:**

| Measure | Value |
|---|---|
| `subscriptions.status='trialing'` (the old query) | **0** |
| `resolveTier` — runners on trial | **5** |
| `resolveTier` — paid / free | 20 / 22 |
| `subscriptions` rows by status | `{ active: 19 }` |

A KPI that cannot move reads exactly like a KPI with nothing to report.

## Why the duplication is unavoidable

The digest is a cloud routine, not repo code, and cannot call an endpoint that needs
`CRON_SECRET`. So its SQL mirrors the predicate. That is the `deloadCadence` /
`tierResolution` class and it gets a mechanism, not a note.

⚠️ **What no test here can check:** the live prompt at claude.ai. This file is the
byte-verified transcript of what was applied; the gate catches the lib and the transcript
drifting apart. Transcript-versus-live stays a by-hand step.

---

## Q2 — active-user tiers and the TRIAL FUNNEL, reverse-trial correct

Replaces the last two lines of the previous Q2. The `sig` CTE is unchanged — it is the
digest's own Active(7d) signal set.

```sql
with sig as (
  select user_id, max(ts) as last_seen from (
    select user_id, created_at ts from session_completions
    union all select user_id, created_at from strava_activities
    union all select user_id, created_at from session_reflections
    union all select id, last_today_open_at from user_settings where last_today_open_at is not null
  ) x group by user_id),
trial as (
  select us.id as user_id
  from user_settings us
  where us.trial_started_at > now() - interval '14 days'
    and coalesce(us.is_admin, false) = false
    and not exists (
      select 1 from subscriptions s
      where s.user_id = us.id
        and s.status in ('trialing','active')
        and s.current_period_end > now())
    and not exists (
      select 1 from charity_codes cc
      where cc.claimed_by = us.id
        and cc.expires_at > now()))
select
  (select count(*) from sig where last_seen >= now()-interval '7 days') as active_7d,
  (select count(*) from sig where last_seen >= now()-interval '30 days') as active_30d,
  (select count(*) from user_settings us where exists(select 1 from session_completions c where c.user_id=us.id and c.created_at>=now()-interval '7 days') and us.last_today_open_at>=now()-interval '7 days') as engaged_7d,
  (select count(*) from trial) as trialing_total,
  (select count(*) from trial t where coalesce((select max(last_seen) from sig where sig.user_id=t.user_id),'epoch') < now()-interval '3 days') as at_risk_trialing;
```

### ✅ Run against production before it was handed over

A query handed to a human is untested code. Executed against
`wkppmpsvqkaxbekdgzdm` on 2026-10-09:

| Column | Value |
|---|---|
| `old_trialing_total` (the predicate being replaced) | **0** |
| `trialing_total` | **5** |
| `at_risk_trialing` | **1** |

So the digest had never once reported a real at-risk trialling runner, and there is one:
trial started 2026-10-02, last signal the same day, **6 days quiet on day 6 of 14**. Two
more sit on trial day 12 and 13.

### Each clause, and which rule it mirrors

| Clause | Mirrors |
|---|---|
| `trial_started_at > now() - interval '14 days'` | `TRIAL_DAYS = 14` and `isTrialActive`'s **strict** `elapsed < TRIAL_DAYS` |
| `coalesce(us.is_admin,false) = false` | `resolveTier` step 1 — admin resolves `paid`, never `trial` |
| `not exists (… status in ('trialing','active') and current_period_end > now())` | step 2 — an active subscription outranks the trial |
| `not exists (… cc.expires_at > now())` | step 3 — `isGrantActive`: a NULL `expires_at` is **not** active, so no `is null` arm |
| `coalesce(…, 'epoch')` | a runner with no signal at all is **at risk**, not excluded from the count |
| `interval '3 days'` | `AT_RISK_NO_ACTIVITY_DAYS = 3` |

⚠️ **The order of the `not exists` clauses does not matter in SQL, but the order in
`resolveTier` does** — admin above subscription above grant above trial. The SQL can only
ask "is this runner on trial?", so it must exclude every tier that outranks trial. Adding
a fifth tier above `trial` in `resolveTier` means adding a clause here, and the gate's
population arm is what will tell you.

## Q2B — WHO, not how many

A count tells Russ there is a leak; it does not tell him where. Run this whenever
`at_risk_trialing > 0` and render the rows.

```sql
with sig as (
  select user_id, max(ts) as last_seen from (
    select user_id, created_at ts from session_completions
    union all select user_id, created_at from strava_activities
    union all select user_id, created_at from session_reflections
    union all select id, last_today_open_at from user_settings where last_today_open_at is not null
  ) x group by user_id)
select us.id, us.trial_started_at::date as trial_start,
  date_part('day', now() - us.trial_started_at)::int as trial_day,
  (select max(last_seen) from sig where sig.user_id=us.id)::date as last_seen,
  coalesce(date_part('day', now() - (select max(last_seen) from sig where sig.user_id=us.id))::int, -1) as days_quiet
from user_settings us
where us.trial_started_at > now() - interval '14 days'
  and coalesce(us.is_admin, false) = false
  and not exists (select 1 from subscriptions s where s.user_id=us.id and s.status in ('trialing','active') and s.current_period_end > now())
  and not exists (select 1 from charity_codes cc where cc.claimed_by=us.id and cc.expires_at > now())
order by days_quiet desc;
```

`days_quiet = -1` means **no activity signal at all** — the worst case, not a missing
value. `judgeTrialFunnel` returns `daysQuiet: null` for the same runner and still counts
them at risk.

⚠️ **This is an observation query, not an outreach list.** The founder's standing
instruction is zero contact with runners without his sign-off.

## Re-application

1. Open the routine's prompt at claude.ai (trigger `trig_01P5snwo2k4reDGrX4Z3wkyC`).
2. Replace the `Q2` block with the SQL above, verbatim.
3. Paste it back into this file so the transcript stays byte-identical.
4. `npx vitest run lib/ops/digestTrialSqlMirror.test.ts`.
