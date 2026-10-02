# Runbook — wire the daily digest to the fleet-wide enrichment check

**Status: PREPARED AND TESTED, NOT APPLIED.** The routine write was denied in-session
("Modify Shared Resources"), so this is the by-hand procedure. ⚠️ **The routine is
UNCHANGED** — an earlier attempt using a `prompt_file` key returned **HTTP 200 and changed
nothing**, which was verified by re-reading the live prompt (23,293 chars, no `Q5B`). A silent
no-op, the same class as *the migration that applied cleanly and changed nothing*.

| | |
|---|---|
**Routine** | `Zonna daily ops digest` · `trig_01P5snwo2k4reDGrX4Z3wkyC` |
**Cron** | `CRON_TZ=Europe/London 0 7 * * *` — **do not change** |
**Model / permission / project** | `claude-opus-4-8` · `auto` · `claude_proj_011CZdCd9s2C2WubBSB15cgu` — **do not change** |
**Edit** | `prompt` only. Two insertions, two heading words |

## Why — the gap this closes

🔴 **The digest already reads enrichment state (Q5), and its guidance already says the two
things I got wrong today**: *"STATE THE DENOMINATOR"* and *"`applied_partial` is the SUCCESS
path of a deliberate degrade, not a failure… do not write it up as the AI tier being down."*
Both of my errors were specifically warned against in a prompt I had not read.

**What is genuinely missing is the WINDOW.** Q5 is scoped to `created_at >= now() - interval
'7 days'`. A failed enrichment is **permanent** — the runner holds that voiceless plan for the
whole 16+ week block — but after seven days the digest stops mentioning them. Measured
2026-10-02: one affected runner was **six days old**, visible that morning and invisible the
next. This repo has recorded a date-scoped list quietly taking its coverage with it **three
times**.

So the addition is **fleet-wide and unwindowed**, and it is the number to lead with.

## Step 1 — insert `Q5B` immediately before `Q6 — data integrity:`

```
Q5B — enrichment health, FLEET-WIDE and UNWINDOWED (OPS-ENRICH-HEALTH-01):
with s as (
  select p.user_id,
         to_char(p.created_at,'YYYY-MM-DD') as created_utc,
         p.plan_json->'meta'->>'enrichment' as enrichment,
         (select u.email from auth.users u where u.id = p.user_id) as email
  from plans p
)
select
  count(*) filter (where enrichment is not null and enrichment <> 'skipped') as eligible,
  count(*) filter (where enrichment in ('applied','applied_partial')) as with_voice,
  count(*) filter (where enrichment is not null and enrichment <> 'skipped'
                    and enrichment not in ('applied','applied_partial')) as without_voice,
  coalesce(json_agg(json_build_object('email', email, 'created', created_utc, 'state', enrichment))
           filter (where enrichment is not null and enrichment <> 'skipped'
                     and enrichment not in ('applied','applied_partial')), '[]'::json) as without_voice_rows
from s;
```

✅ **Verified against production before being written down** (`execute_sql`, project
`wkppmpsvqkaxbekdgzdm`), because a query handed to an automation is untested code:

```
eligible 18 · with_voice 16 · without_voice 2
without_voice_rows: malcolmberrido85@… (2026-09-26, failed_invalid_copy)
                    6bpvjrhk8h@privaterelay… (2026-10-02, failed_unparseable)
```

Identical to `GET /api/ops/enrich-health`, which is the canonical reader.

## Step 2 — insert this into `STEP 2B`, immediately before `BEFORE ESCALATING ANYTHING…`

```
Q5B (enrichment health, FLEET-WIDE): Q5 above is windowed to 7 days, and THAT IS THE GAP THIS CLOSES. A failed enrichment is permanent — the runner holds that voiceless plan for the whole 16+ week block — but a 7-day window stops mentioning them after a week. On 2026-10-02 one affected runner was six days old: visible that morning, invisible the next. This repo has recorded a date-scoped list quietly taking its coverage with it three times.

So Q5B counts the WHOLE fleet with no window, and it is the number to lead the enrichment line with:

- `without_voice` is the one that matters: runners holding a plan with no AI copy at all. ANY of them is worth a line, and they stay reported until the state changes — that is the point of the query having no window.
- `eligible` EXCLUDES free-tier `skipped` (never enriched by design) and legacy plans with no field. Counting either would deflate the figure.
- `with_voice` counts `applied` AND `applied_partial` together. ⚠️ On 2026-10-02 a measurement that treated `applied_partial` as a failure reported "two thirds of plans failing" when the true answer was 2 runners of 18 eligible — 38 of 43 recorded failures were partial reverts. The guidance in Q5 above already said this; it was not read.
- Quote it as `without_voice of eligible`, never as a bare percentage: at this fleet size one plan moves the rate by ~5pp.
- `without_voice_rows` names them, so remediation has a target. `scripts/reenrich-plans.ts` in the repo restores the voice (dry-run by default) and needs Russ's authorisation to write.

⚠️ THE JUDGEMENT RULES ABOVE ARE MIRRORED FROM `lib/ops/enrichHealth.ts`, which is their owner and is unit-tested. The duplication is deliberate and declared: the canonical reader is `GET /api/ops/enrich-health`, and this routine cannot call it because that endpoint requires `CRON_SECRET`, which a cloud routine has no way to hold. If the rules there change, change this SQL in the same breath — they have already drifted once in this codebase when a producer kept its own copy of a predicate (84 plans).
```

## Step 3 — two heading words

- `STEP 1 — Run these NINE queries` → **TEN**
- `STEP 2B — Zonna engine health. Report on Q4 and Q5.` → **Report on Q4, Q4B, Q5 and Q5B.**

## Step 4 — verify, because a 200 proved nothing last time

Re-read the routine and confirm **all three**: `Q5B` present · `TEN queries` present · prompt
length ≈ **26,329** chars (was 23,293). Then confirm name, cron, enabled, model and permission
mode are untouched.

## ⚠️ Why the digest mirrors the rules instead of calling the route

`GET /api/ops/enrich-health` requires `CRON_SECRET`, and a cloud routine has no way to hold it.
So the SQL mirrors `lib/ops/enrichHealth.ts`, which **owns** the judgement and is unit-tested.
**The duplication is deliberate and declared** — and it is a real risk: this codebase has
already paid 84 plans for a producer keeping its own copy of a predicate. **If the rules in
`enrichHealth.ts` change, change this SQL in the same breath.**
