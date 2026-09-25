# Ops digest triage — 2026-09-25

Four items from the daily ops digest, each worked as a structured debug session.
**Build measured:** `36b3d26` (production, deployed 2026-09-24 19:46 UTC).
**Everything below was verified against live Supabase (`wkppmpsvqkaxbekdgzdm`) or by
regenerating on the current build. Nothing is inferred from the digest.**

> **Headline:** three of the four premises dissolved on measurement. The one real defect
> was not in any of them — it was found underneath the board item, and it is bigger.

---

## ITEM 1 — trial → subscriptions instrumentation gap

**Verdict: PREMISE FALSE, but a real measurement defect exists one layer along.**
**Tag: ⚙️ NO BOARD.**

### Confirmed
The digest is right that `subscriptions` holds `{active: 1}` and no `trialing` rows, and
right that six plans in seven days carry `plan_json.meta.tier = "trial"`.

### Cause — the separation is deliberate and documented in three places
Zonna's 14-day **reverse trial** is a `user_settings.trial_started_at` timestamp. It has
no subscription row **by design**:

- `lib/trial.ts` — `resolveTier` reads `trialStartedAt`, never `subscriptions`, for trial.
- `supabase/migrations/20260529_admin_user_tiers.sql` — *"our 14-day reverse trial has NO
  subscription row — it is driven purely by `user_settings.trial_started_at`. A store
  'trialing' row means StoreKit/RevenueCat granted entitlement, so it resolves as
  premium. Correct."*
- `20260722_analytics_events.sql` — `v_trial_conversion` was built **for the MON-TRIAL-01
  baseline** and already measures it the right way round: denominator
  `user_settings.trial_started_at`, numerator `subscriptions` presence.

`meta.tier = "trial"` on those six plans is `resolveTier()` stamping correctly at
generation time. **The system is working.** So the digest's conclusion — *"the 1 Jan
trial-to-paid gate is unmeasurable if trials never appear in the table conversion is
measured from"* — is false: conversion is not measured from that table.

### 🔴 The real defect: `v_trial_conversion` counts the founder's own admin row as a conversion

Live, today:

| | |
|---|---|
| `v_trial_conversion` denominator, as shipped | **31** |
| numerator (`converted = true`), as shipped | **1** |
| …of which **admin** | **1** |
| charity-grant users sitting in the denominator | **1** |
| test/demo accounts in the denominator | **2** |

The single `subscriptions` row is `user_id 1afc17e4`, `provider: stripe`, created
2026-04-27, period end 2027-04-27 — **`russell.j.shear@gmail.com`, `is_admin = true`**.
A hand-seeded comp, not revenue. `admin_user_tiers` resolves it as `admin` and reports
**zero `premium` users**, which is correct. `v_trial_conversion` does not, and reports
**1/31 = 3.2%** where the honest figure is **0/28 = 0%**.

### Why it survived — a hazard solved for one transition, named but not solved for its twin
`20260920_charity_tier_and_partner_cohort.sql` (GTM-CHARITY-05) identified this exact
failure and wrote it down:

> *"`v_trial_conversion` (a LEFT JOIN on anyone with a `trial_started_at`) counts them as
> UNCONVERTED TRIALS — which would make trial→paid look worse than it is for a whole
> season."*

**The fix touched only `admin_user_tiers`. `v_trial_conversion` was never changed** —
confirmed by `pg_get_viewdef` against production: no admin filter, no grant filter, no
test filter. So the charity half of the problem is *still live*, and the admin half —
which biases the other way, making conversion look **better** — was never noticed at all.

The 5% gate is scheduled for 1 January. At 30 users, one admin row is 3.2 percentage
points of a 5-point threshold.

### Recommendation
`v_trial_conversion` gets a `converted_real` column and an exclusion set: `is_admin`,
active charity grant, and a test-account predicate. **Keep the raw `converted` column** —
a view that silently changes its own meaning is worse than one that is wrong in a way you
can see. Same `adminViewTierParity.test.ts` treatment: a test that reads the migration
file and fails when the arms drift from `lib/trial.ts`. Filed `OPS-TRIAL-CONV-01`.

**Not fixed here**: the view is production DDL, and `CLAUDE.md` is explicit that DDL needs
the SQL editor. The migration is written and ready to hand over, not applied.

---

## ITEM 2 — foundation-week invariant coverage

**Verdict: PREMISE FALSE. The field the digest read is measuring something else.**
**Tag: ⚙️ NO BOARD.**

### Confirmed
The 2026-09-24 12:55 audit did flag two plans with `foundation_week_violations` of 9 and 6.

### Cause — `foundation_week_violations` counts plan-level violations, not foundation weeks
`app/api/ops/plan-audit/route.ts` computes it as:

```ts
foundation_week_violations: errors.filter(v => (v.week ?? 1) <= 0).length
```

Foundation weeks carry **negative** `n` (`lib/plan/foundationBlock.ts:6` — *"Foundation
weeks carry `phase: 'foundation'` and negative `n` values"*). But `week: 0` is the
codebase's convention for **plan-level, no-specific-week** violations — `invariants.ts:882`
says so in as many words (*"input-level, plan-wide — no specific week (convention)"*), and
there are **60 such emit sites**.

**Every one of the five codes the digest cited as evidence is a `week: 0` plan-level
violation.** Checked individually:

| code | emitted with | line |
|---|---|---|
| `INV-PLAN-ONRAMP-FLOOR` | `week: 0, // plan-level` | 3962 |
| `INV-PLAN-DIFFICULTY-ANNOTATED` | `week: 0` | 3094 |
| `INV-PLAN-HR-ASSUMPTIONS-SURFACED` | `week: 0` | 5621 |
| `INV-PLAN-PREP-TIME-STATUS-ANNOTATED` | `week: 0` | 3067 |
| `INV-PLAN-COMPRESSION-CLASSIFICATION` / `-SPLIT` | `week: 0` | 6501 / 6544 |

### Measured over the whole live fleet (23 stored plans, validator re-run locally)

| | |
|---|---|
| `foundation_week_violations` as the field reports it | **50** |
| genuine foundation-week violations (`week < 0`) | **1** |
| plan-level violations miscounted as foundation (`week == 0`) | **49** |

**98% of what the field reports is not a foundation week.** And the two plans the digest
named contain **no foundation weeks at all** — 497a0e5c (reported 9) and e7c73cbb
(reported 6) both have zero. The one genuine foundation-week violation is
`INV-PLAN-LONG-IS-LONGEST` on a plan last updated 2026-06-15.

### Does the current build still emit breaching foundation weeks? — NO
Swept the cohort grid × four pre-plan runways (14 / 28 / 49 / 84 days), composing each
plan through `composePlanWithFoundation` and validating the assembled result:

| | |
|---|---|
| grid inputs | 41,472 |
| plans composed | 158,528 |
| plans **carrying foundation weeks** | **79,264** |
| foundation-week (`week < 0`) error violations | **0** |
| error violations of any kind | **0** |

**There is no live gap.** ADR-020 moved foundation construction server-side and
`composePlanWithFoundation` validates the whole assembled plan — this measurement is that
working.

### Recommendation
Rename and re-compute the field so it means what it says: `plan_level_violations` for
`week === 0` and `foundation_week_violations` for `week < 0`, reported separately. A field
whose name states a cohort and whose arithmetic counts a different one will mislead every
reader, which is what happened here. Filed `OPS-AUDIT-FW-COUNT-01`.

---

## ITEM 3 — plan-audit cadence vs. deploys

**Verdict: PREMISE FALSE. The audit has run every single day.**
**Tag: ⚙️ NO BOARD.**

### Confirmed — it is a daily cron and it has not missed a day
`.github/workflows/ops-cron-plan-audit.yml` — `cron: '45 7 * * *'`, GitHub Actions (Vercel
Hobby caps at 2 crons, both taken). The route records a summary event **on every run,
including clean ones**, under `kind='plan_rule_invalid'`, `detail.source='plan-audit-summary'`.
That is the complete run log:

| date | run at (UTC) | checked | invalid | newest invalid plan (days) |
|---|---|---|---|---|
| 09-24 | 12:55 | 22 | 15 | 0 |
| 09-23 | 13:02 | 19 | 14 | 1 |
| 09-22 | 12:50 | 23 | 19 | 0 |
| 09-21 | 14:33 | 22 | 18 | 2 |
| 09-20 | 12:38 | 22 | 18 | 1 |
| 09-19 | 12:04 | 22 | 13 | 1 |
| 09-18 | 12:22 | 21 | 13 | 0 |
| 09-17 | 12:47 | 19 | 13 | 0 |
| 09-16 | 12:51 | 17 | 17 | 4 |

**Nine consecutive days, exactly one run each, no gaps.** The digest's *"has not run
since"* is true only within the 24th's own calendar day and carries no information.

### The thing that is genuinely worth recording — a 4–7 hour schedule lag
Scheduled 07:45 UTC; actual landings 12:04–14:33 UTC. **Mean lag ≈ 5 h, range 4 h 19 m to
6 h 48 m.** This is GitHub Actions' best-effort scheduling on free runners, not a fault —
but it is why "ran at 12:55" did not match anyone's expectation of 07:45, and it is
probably the whole origin of this digest item.

### invalid = 15 is fleet history, and no current-build plan is breaching
Confirmed: 10 of 15 are 31d+, and the `0-1d: 1` entry at audit time is plan `c8aef8f9`
(updated 08:56 on the 24th), which **predates `36b3d26` by ~11 hours** and carries
**zero error violations** — its 11 findings are all `warn`. The live-plan policy
deliberately never backfills doctrine fixes, so a high static `invalid` is the designed
state; `PLAN-AUDIT-01` alerts on *transition* for exactly this reason.

### Recommendation — do NOT add a post-deploy run
One plan has been created since the last audit. A post-deploy run buys a window of at most
~13 hours on a fleet generating roughly one plan a day, and the audit reads *stored plans*,
not the build — it cannot speak to a build nobody exercised. **Two cheaper fixes instead:**

1. The digest should read `plan-audit-summary` events and compare against the **previous**
   day, not ask "did it run today". That is a routine change, not repo code.
2. Record the 07:45→~12:30 lag in the workflow header so the next reader does not file
   this again. Filed `OPS-AUDIT-CADENCE-DOC-01`.

---

## BOARD ITEM — the load-residual exception on an injury runner

**Verdict: PREMISE FALSE at week 4, and a much larger coverage hole underneath it.**
**Tag: 🏃 COACHING BOARD. Nothing implemented.**

Full brief: `docs/decisions/coaching-2026-09-25-injury-delivered-coverage.md`.

**In one line:** week 4's +41% is a post-deload bounceback returning to week 2's exact
volume (24 → 17 → 24 km, net 0%) and is legal under §2 Amendment 3 — but in checking it,
**five of the six injuries the wizard offers turn out to have no delivered-volume check at
all.** §94's arm is gated `if (healthy)`; §90's arm matches only `knee` / `shin_splints`.
Neither executes for Achilles, Back, Hip, Shin splints or Plantar fasciitis. The healthy
twin of the same runner gets four warnings at +23%; the Back and Plantar-fasciitis
versions reach **+36% in silence**.

Plus one defect, board-exempt: **`'Shin splints'` does not match `'shin_splints'`** — the
engine's matcher was made separator-insensitive on 2026-09-16, the checker's was not, and
the checker's own comment still claims the two agree. Filed `INJURY-GUARD-PREDICATE-01`;
**must land before the board rules**, because it changes the cost of one of the options.

---

## What this triage does not prove

- **No runner is shown to have been harmed.** Every finding is about *verification*, not
  prescription. Every cap the engine applies, it still applies.
- **`invariant:liveness` cannot catch the Item-4 hole.** Both affected invariants are
  *proven wakeable* — via `['knee']`. Liveness proves a rule **can** fire; it cannot prove
  it fires **for the cohort it names**. That gap has no harness.
- **The foundation sweep varied the runway, not every axis.** 0 violations across 158,528
  composed plans is evidence for the grid swept, and `cohortGrid` does not vary
  `injury_history` at all — the injury findings above came from a hand-built cell for
  exactly that reason.
- **`v_trial_conversion` was read, not corrected.** The migration is drafted; production
  DDL is a hand-over.
