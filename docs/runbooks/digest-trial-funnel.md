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

## What the live prompt carries AROUND Q2B, and why the prose is gated too

**Applied to the live routine 2026-10-10.** Q2B is now IN the prompt (it was only ever
described here), conditional on `at_risk_trialing > 0`. STEP 1's `"Run these TEN queries"`
became `"Run the queries below … Q2B is conditional; every other query runs every time"` —
the count was already wrong by one before Q2B existed, and a hardcoded count in a document
that gains queries is a number that rots.

🔴 **TWO DEFECTS SHIPPED IN THIS PROSE AND BOTH WERE FOUND BY RUNNING IT, NOT BY READING
IT.** The SQL was correct on every attempt; the instruction that interprets it was wrong
twice. A prompt's surface is the agent, so it was driven against real and synthetic query
results three times.

| # | What the instruction said | What it did |
|---|---|---|
| 1 | *"RUN Q2B AND RENDER THE ROWS"* | Q2B returns the **whole trial cohort**, so the rows (4) and the KPI (`at_risk_trialing` 1) disagreed. Rendered at face value it **overstates the leak 4×** |
| 2 | at risk = `days_quiet >= 3` | **`-1` is not `>= 3`.** The sentinel for *no signal at all* — the worst case — failed the only test naming it, so testing `>= 3` alone silently drops it |

Defect 2 is the same shape as a declared zero read as a gap by `> 0`: **a sentinel is not a
number, and a comparison written for numbers discards it.** It was authored hours after that
lesson was cited.

**The settled wording, which `digestTrialSqlMirror.test.ts` now pins against the SQL:**

> WHEN at_risk_trialing > 0, RUN Q2B AND RENDER THE ROWS (trial_day, last_seen, days_quiet)
> — a count says there is a leak and does not say where, and this is the only place the leak
> becomes actionable. 🔴 Q2B RETURNS THE WHOLE TRIAL COHORT, NOT THE AT-RISK SUBSET: a row is
> at risk if days_quiet >= 3 OR days_quiet = -1, and the number of those rows MUST EQUAL
> at_risk_trialing. ⚠️ -1 IS A SENTINEL, NOT A NUMBER — it means no activity signal of any
> kind and it FAILS a >= 3 test, so testing only >= 3 silently drops the worst case. Render
> the at-risk rows under the at-risk heading and put any remaining cohort rows in a clearly
> separate list labelled as context, never under the at-risk heading. If the two numbers
> disagree, say so and trust at_risk_trialing. days_quiet = -1 means NO activity signal at
> all, which is the worst case and not a missing value; rank those first. ⚠️ This is an
> OBSERVATION list, never an outreach list: Russ's standing instruction is zero contact with
> runners without his sign-off, so never draft a message or suggest emailing them.

⚠️ **Q2B's `where` clause was a SECOND hand-written copy of the trial predicate with no
gate.** The mirror test parsed only the `## Q2 —` block, so `trialFunnel.ts` and Q2 were
locked together while Q2B could drift silently — the `deloadCadence` / `tierResolution` class
this very file's test header names. Gated 2026-10-10: Q2B's four exclusion clauses are now
compared against Q2's `trial` CTE, and the prose above is compared against the SQL it
interprets.

⚠️ **The `-1` sentinel has never occurred on live data** — no trialling runner has yet had
zero signal. The arm is real and unexercised in production, which is why defect 2 needed a
synthetic case to catch.

## Re-application

1. Open the routine's prompt at claude.ai (trigger `trig_01P5snwo2k4reDGrX4Z3wkyC`).
2. Replace the `Q2` block with the SQL above, verbatim, and the `Q2B` block likewise.
3. Re-apply the STEP 1 and STEP 3 prose from § *What the live prompt carries around Q2B* —
   **the SQL alone is not the change.** Q2B without its rendering rule over-counts the leak
   4× and drops the no-signal case.
4. Paste it all back into this file so the transcript stays byte-identical.
5. `npx vitest run lib/ops/digestTrialSqlMirror.test.ts`.
6. **Then verify at the surface, not by reading.** Both prose defects above were invisible on
   the page and obvious on the first run. Drive the instruction against one real day and one
   synthetic day carrying a `days_quiet = -1` row.
