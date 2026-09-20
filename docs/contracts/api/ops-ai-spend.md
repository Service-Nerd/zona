# API Contract — `GET /api/ops/ai-spend` + the Anthropic call owner (OPS-AI-OWNER-01)

**Tier:** Ops/internal — not user-facing, no FREE/PAID gate.
**Owner:** `lib/ai/callAnthropic.ts` (the only caller of Anthropic) · `lib/ai/surfaces.ts` (the surface vocabulary) · `lib/ai/pricing.ts` (the price list) · `lib/ops/aiSpend.ts` (the arithmetic) · `app/api/ops/ai-spend/route.ts` (the read).
**Closes:** `OPS-AI-SPEND-01` (what did it cost) and `OPS-AI-FAILURE-ALERT-01` (did it work).

---

## Why there is one owner

There were **fourteen** independent copies of the Anthropic `fetch`, one per surface, agreeing only
by accident: same URL, same `anthropic-version`, same `content?.[0]?.text` extraction, same
`if (res.ok)` / silent-catch shape. That duplication is what made both ops items expensive enough
to be scoped down to "just the two or three highest-traffic routes" — a reduction that only makes
sense while there are fourteen places to edit.

Deleting the duplication removed the trade. All fourteen surfaces are instrumented, and
`noRawAnthropicCalls.test.ts` fails the build if a fifteenth is written by hand.

## `callAnthropic(call: AnthropicCall): Promise<AnthropicResult>`

**Server-only** — it reaches `recordOpsEvent`, which holds the service-role key. Never import into
a client or isomorphic module.

```ts
interface AnthropicCall {
  surface:   AiSurface                     // from lib/ai/surfaces.ts
  model:     string                        // from lib/ai/models.ts — never a literal
  maxTokens: number
  messages:  Array<{ role: string; content: unknown }>
  system?:   unknown                       // string, or a content-block array for cache_control
  beta?:     string                        // sent as `anthropic-beta`
  apiKey?:   string                        // defaults to process.env.ANTHROPIC_API_KEY
  userId?:   string | null                 // recorded for attribution. Never a name.
}

type AnthropicResult =
  | { ok: true;  text: string; data: any; usage: AiUsage }
  | { ok: false; reason: 'api_error' | 'fetch_failed'; status: number | null; detail: string }
```

- **Never throws.** Every failure is a result, not an exception.
- **`system` is omitted from the body entirely** when the caller passes none — byte-identical to
  what the old sites sent.
- **The failure vocabulary is `enrich.ts`'s existing one.** `api_error` / `fetch_failed` are reused
  rather than a second set of names being introduced beside them.
- A **2xx whose body is not JSON** is a failure. Every one of the fourteen sites previously read
  that as an empty answer, indistinguishable from a successful empty completion.
- **Telemetry cannot break the call.** `recordOpsEvent` documents itself as never-throwing, but
  awaiting it unguarded would make that promise load-bearing for every AI call in the product, so
  `callAnthropic` wraps it. Falsification-tested.

### Surfaces

`AI_SURFACES` in `lib/ai/surfaces.ts` is the single vocabulary, shared with `AI_ROUTE_LIMITS`.
`callAnthropic.test.ts` fails if a rate-limit key is not a declared surface, and if a declared
surface has no call site.

## Events written

| Kind | When | `detail` |
|---|---|---|
| `ai_call` | every successful call | `{ surface, model, ms, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, cost_usd }` |
| `ai_call_failed` | non-2xx, transport throw, or non-JSON 2xx | `{ surface, model, reason, status?, detail }` (detail truncated to 200 chars) |

`user_id` carries the runner where the caller has one. **No PII beyond that** — never prompt text,
never a name.

⚠️ **`cost_usd` is `null`, never `0`, for a model with no price entry.** A silent zero is the `?? 0`
class this repo has four measured defects from: the total stays plausible while a whole model is
missing from it.

## `GET /api/ops/ai-spend?days=7`

**Auth:** `CRON_SECRET` via `Authorization: Bearer` or `x-cron-secret`. `days` clamps to 1–90.

```jsonc
{
  "window_days": 7,
  "truncated": false,              // true if the 50,000-row cap was hit — the totals are then clipped and say so
  "totals": {
    "calls": 812, "failures": 3, "failureRatePct": 0.4,
    "estimatedCostUsd": 1.8412,    // null if ANY call was unpriced
    "unpricedCalls": 0,
    "distinctUsers": 26,
    "estimatedCostPerUserUsd": 0.0708
  },
  "bySurface": [ { "surface": "enrich-plan", "calls": 26, "failures": 0, "inputTokens": 0, "outputTokens": 0,
                   "cacheCreationTokens": 0, "cacheReadTokens": 0, "estimatedCostUsd": 1.61, "unpricedCalls": 0 } ],
  "failuresByReason": { "api_error": 3 }
}
```

Surfaces are ordered most-expensive first.

## ⚠️ What this does not do

- **The tokens are measured. The dollars are not.** `lib/ai/pricing.ts` is a price list copied by
  hand from Anthropic's published rates. Nothing in this repo can reconcile it against the invoice,
  and it will go stale. Every figure derived from it is an estimate and is labelled as one.
- **It records; it does not alert.** Nothing pages anyone and nothing polls this route. Wiring the
  failure count into the daily ops digest is a cloud-routine change, not a repo change.
- **It cannot see the credit balance.** A run of `api_error` is the earliest *symptom* of an empty
  balance, not a reading of it. That is `OPS-ANTHROPIC-CREDIT-01`, and it is founder-owned.
- **Retention is unsolved, and not newly so.** `ops_events` has always accumulated without a prune
  job. `ai_call` is the highest-volume kind yet added — order 500–2,000 rows/day at cohort scale,
  a few MB/month — so it makes an existing question more pressing. It interacts with
  `OPS-SUPABASE-PLAN-01` and belongs with that decision.
