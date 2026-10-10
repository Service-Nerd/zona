# Contract — `GET|POST /api/ops/enrich-health`

**Authority**: This document defines the enrichment-health reader: its auth, its response
shape, and **which table it counts**. Any change must update this document in the same commit.

**Route:** `app/api/ops/enrich-health/route.ts` · **Owner:** `lib/ops/enrichHealth.ts`

## Why it exists

`plan_enrich_failed` had **one writer and zero readers** — no route, no digest, no alert. So AI
enrichment could degrade indefinitely and the only way to notice was to query by hand, which is
exactly how it was noticed on 2026-10-02, and only because the founder said live users had
arrived.

ADR-006 makes the fallback **silent to the runner** by design. That is correct and unchanged.
It was also silent to *us*, which never was.

## Auth

`CRON_SECRET` via `Authorization: Bearer <secret>` or `x-cron-secret`, matched with
`secretMatches`. 403 otherwise. Same shape as every other `/api/ops/*` route — an endpoint that
names runners is not public. `GET` delegates to `POST`.

## 🔴 It counts the PLANS table, not `ops_events`, and that is the contract

```jsonc
{
  "healthy": false,
  "denominator": "plans.plan_json.meta.enrichment (NOT ops_events)",
  "verdict": {
    "eligible": 18,          // excludes free-tier 'skipped' and legacy nulls
    "withVoice": 16,         // 'applied' | 'applied_partial'
    "withoutVoice": 2,       // the number that matters
    "withoutVoicePct": 11,   // null when eligible === 0 — never 0%
    "affected": [            // oldest first; this IS the remediation target
      { "user_id": "…", "created_at": "…", "enrichment": "failed_invalid_copy" }
    ],
    "alert": true
  },
  "boundary": {                     // WEEK-THEME-TOKEN-ENRICH-01, 2026-10-10
    "weekCopyRejected30d": 0,       // null when the count could NOT be read
    "meaning": "model-authored week label/theme carrying a {{placeholder}}, refused by the merge; engine copy kept"
  }
}
```

⚠️ **`boundary` IS NOT PART OF THE VERDICT, AND THAT SEPARATION IS THE CONTRACT.** It is the
only `ops_events` read in this route, and it exists because a new ops kind with no reader is the
inert-field class (`run_walk_strategy`: a writer, no reader, and a green invariant that could
not see a screen). Three rules bind it:

| Rule | Why |
|---|---|
| **It is never a rate and never a denominator** | the `denominator` note below is about exactly this mistake. `weekCopyRejected30d` is a count of refusals at the merge boundary, not a share of anything |
| **It must not move `healthy`** | a rejection is the guard **working** — `OPS-SUBS-UNHANDLED-SEEN-01`'s rule: counted and reported, never alerting |
| **`null` means "could not read", not "none"** | *"no rows"* and *"did not look"* are the pair this repo keeps confusing, which is the whole of `OPS-SUBS-UNHANDLED-SEEN-01` |

⚠️ **The `denominator` field is deliberate.** The first version of this measurement derived a
rate from `ops_events` as `failed / (failed + plan_enrich_server_saved)` and reported **67%**.
`plan_enrich_server_saved` fires **only** when `shouldServerPersist()` is true — the server
backstop writing because the runner closed the app before the enricher finished — so it is a
**subset of successes, not a success counter**. The real reading from `meta.enrichment` was
**18 eligible, 16 with voice, 2 without — 11%**. The field names its source so a reader cannot
repeat that.

**A failure EVENT is a thing that happened; `meta.enrichment` is the thing the runner HAS**, and
only the second can be alerted on or remediated honestly.

## Judgement rules, each with its reason

| Rule | Why |
|---|---|
`skipped` is **not** eligible | A free plan is never enriched by design; counting it deflates the rate |
A legacy row (no field) is **not** eligible | Absent is not failed |
`applied_partial` **has** voice | **38 of 43** recorded failures were partial reverts; treating them as failures is how 43 harmed runners was first reported when it was 2 |
A stuck `pending` **has no** voice | `ENRICH-SAVE-01` says `pending` is expected transiently and a defect if it persists — excluding it would hide exactly that case |
**Any** runner without voice sets `alert` | Not a threshold, deliberately: at this scale a percentage is noise (one plan moves it 5pp) and a paying runner with no AI coaching is a fact, not a rate. Raise it with a measurement, never a guess |

## It is a READER, not a probe

It writes nothing and is **not scheduled** — the same line `OPS-SUBS-ALERT-01` took: the state
already exists, so a second automation would only re-read it and spend budget. **The daily digest
must call it**, and ⚠️ **that wiring is not done** — until it is, this route is correct and
unread, which is the condition it was built to end.

## What this contract does not cover

Why an enrichment failed (`ops_events.plan_enrich_failed` carries the codes and messages), and
remediation — `scripts/reenrich-plans.ts`, dry-run by default.
