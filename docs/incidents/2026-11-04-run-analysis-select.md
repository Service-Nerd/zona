# Incident — "No distance data." about a run whose distance was in the same table

**Date found:** 2026-11-04 · **Live since:** the column list dates to 2026-05-24 · **Triage:** Systemic
**Fix commit:** see `RUN-ANALYSIS-SELECT-01` · **Catalogue class:** checker reads a different source from the producer

---

## Symptom

One session-detail screen, two answers about one run:

| surface | says |
|---|---|
| header | `Apple Health · 4.2mi` |
| Kit score card, DISTANCE row | **`No distance data.`** |

Everything around it worked: HR 70% in zone, a pace target, efficiency 5.2% above baseline, 85/100.

## What was actually wrong

`app/dashboard/DashboardClient.tsx:1991` (and its two siblings at `:2228`, `:7088`).

`buildScoreExplanations` reads **twelve** fields off its `analysis` argument. The SELECT fetched **nine**.
The three omitted — `planned_load_km`, `planned_load_mins`, `actual_load_mins` — are the only inputs
`compareLoad` has, so `kmComparable` and `minsComparable` were both false, `axis` was `'none'`, and the
`else` branch printed the string.

The data was never missing. For the reported run: `strava_activities.distance_m = 6710.09`,
`session_completions.strava_activity_km = 6.7`, and the analysis row itself held `planned_load_km 7.00`,
`actual_load_km 6.71`, `planned_load_mins 43`, `actual_load_mins 42.92`, `distance_score 100`.

## Why it survived

- **It reads as a true statement.** "No distance data." is a sentence the app is entitled to say, so it
  provokes no suspicion — unlike a wrong number, which invites arithmetic.
- **`buildScoreExplanations(analysis: any, …)`.** With `any`, the compiler cannot notice that three of
  the fields read are never fetched.
- 🔴 **AND A MEASUREMENT HAD ALREADY LOOKED STRAIGHT AT IT.** `POSTRUN-METRIC-PREF-01` fixed this same
  line on 2026-10-08, correctly, with tests, and recorded in its own comment: *"measured on all 83 live
  `run_analysis` rows … 81 are km-comparable, 9 are minutes-comparable … so the duration branch was
  reachable on ZERO live rows."* **That measurement read the TABLE. The screen reads the SELECT.** It
  concluded one branch was unreachable when in truth *both* were, and the conclusion it drew — "the
  duration branch has never run" — was true for the wrong reason.

**Measured 2026-11-04, 100 live rows, 6 users: 87 comparable in the table, 0 comparable on the screen.**
The line had never rendered for anyone. Neither had `"Short."`, which comes from the same call — so a
runner who genuinely fell short has never been told so on this card.

## Blast radius

| dimension | finding |
|---|---|
| Shared owner | `compareLoad` unchanged — it was always right, and was never reached |
| Coupled | `short` and `onTarget` were equally unreachable |
| Other selects | **three** feed this card; the post-run poll at `:7088` omitted **six** fields, so the card is most degraded immediately after a run |
| Prescription | none — display only |
| Tier / schema / AI / native | none |
| Sweep | see below |

## The sweep

Two passes, both with the population derived from the code rather than hand-listed:

1. **Does any `.select()` name a column that does not exist?** Every `.from(T).select('…')` under
   `app/`, `lib/`, `components/`, checked against `tableColumns.ts` — **0**. (Two apparent hits were a
   JSON path `raw_payload->hrSamples` and an embedded FK resource.)
2. **Does any file READ a column its own select omitted?** 34 candidates, **1 real** — this one. The other
   33 were `created_at`/`updated_at` on insert payloads, a second query in the same file, derived fields
   (`withSessionType` adds `session_type`), and `plan.meta.race_distance_km`. The five with real domain
   fields were each checked by hand.

⚠️ **Pass 2 is NOT a gate and deliberately did not become one.** A 33:1 false-positive rate is a check
that gets switched off, which this repo records as equivalent to having no check.

## Fix

`lib/coaching/runAnalysisColumns.ts` — one `RUN_ANALYSIS_CARD_COLUMNS`, the pattern
`SESSION_OVERRIDE_COLUMNS` already set for the same reason (a seventh hand-typed copy forgot `new_slot`).
All three selects use it; `analysis: any` became `RunAnalysisCardRow`.

🔴 **AND THE FIX ALMOST SHIPPED A WORSE BUG.** `planned_load_km` and its siblings are `numeric`, so
PostgREST returns them **quoted** — the live rows read `"7.00"`. `compareLoad` coerces happily (`"6.71" -
"7.00"` is -0.29) so every comparison and every unit test passes on strings, but `formatDistance` guards
with `Number.isFinite`, and `Number.isFinite("6.71")` is **false**. The card would have read
**"Planned null, ran null."** — worse than what it replaced. `numericField()` converts rather than casts.
`actual_load_km` was in the SELECT all along and was already read `as number`; it had been a string the
whole time, and nothing noticed because `axis` never reached `'distance'`. **A cast is not a conversion.**

⚠️ And `numericField`'s own first cut returned **0** for `''`, because `Number('')` is `0` — absence
written as a measured value, the same class as `distance_km ?? 0` and `body.hidden === true` earlier the
same day. Caught by its own test.

## Regression defence

`lib/coaching/runAnalysisCardColumns.test.ts`, 12 arms. **Both sides derived from source**: the fields
`buildScoreExplanations` reads are parsed out of its body, the fields each card select fetches are parsed
out of the select, so neither can drift alone. Plus the behavioural half — the live row values, the string
trap, and `formatDistance` rejecting the raw string.

Three mutations, all red: dropping the three columns from the owner; a select typing its own list again;
reverting the conversion to a cast.

⚠️ **Two of the arms were wrong before they were right.** The select-population arm first flagged the
ceiling-history query at `:2258`, which correctly fetches six columns and never touches the card — so the
discriminator became `total_score`. That then found **zero** once the selects moved onto the constant, an
arm passing because it was looking at nothing; the vacuity floor caught it.

## Catalogue

- [x] Existing class: **checker reads a different source from the producer**. The measurement read the
      table, the code reads the column list. No new row needed.

## Follow-ups

- `"Short."` becomes reachable for the first time. Where the two axes disagree `compareLoad` returns
  `null` by design (§66 withholds the verdict) — that path is now live too and has never been seen in
  production.
