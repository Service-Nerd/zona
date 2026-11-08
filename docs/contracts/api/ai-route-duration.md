# Contract — the execution ceiling on every AI route

**Authority**: this document defines the execution-duration contract shared by every API route
that can reach the model. The per-route contracts reference it rather than restating it; it is
referenced, never copied, because fourteen copies of one number is how the number drifts.

**Owner**: `lib/ai/limits.ts → AI_LIMITS` · **Gate**: `lib/ai/aiRouteMaxDuration.test.ts`
**Item**: `OPS-FN-DURATION-01` (2026-11-08)

## The contract

| | |
|---|---|
| **Route ceiling** | `export const maxDuration = 300` on every route in `callAnthropic`'s import closure. A LITERAL, because Next.js route segment config must be statically analysable and so cannot read the constant |
| **Client timeout** | `AI_LIMITS.CALL_TIMEOUT_MS = 240_000`, applied as `AbortSignal.timeout(...)` inside `callAnthropic` |
| **Failure** | a timeout returns `{ ok: false, reason: 'timeout', status: null }` and records `ai_call_failed` with `reason: 'timeout'` and the elapsed `ms` |
| **Population** | 14 routes, derived by walking the import closure — **never a list** |

## Why the number is in code

🔴 **No route set `maxDuration`, so each ran on whatever the platform default happened to be —
and that default has changed twice**: 60 s Hobby / 90 s Pro, then 300 s on all plans,
**conditional on Fluid compute being enabled**. That condition cannot be verified from the dev
machine (observability returns 404; the project API does not expose it). An invisible platform
default deciding whether a runner's plan finishes generating is the `GTM-SITE-01` shape exactly:
*"the code said one thing, production did another"*, and keeping the value in git makes it
reviewable.

**300 is the maximum on Hobby and the default on Pro**, so it is valid on either, and an in-code
value overrides `vercel.json`, the dashboard and the Fluid defaults. ⚠️ It is a **ceiling, not a
reservation** — Vercel bills active CPU, so declaring it on a route whose p95 is 1.3 s costs
nothing. What it buys is that the number is a decision.

## Why the timeout is derived from the ceiling and not from throughput

`callAnthropic` had **no timeout of any kind**, so a hung connection ran until the platform
killed the function. ⚠️ **And a function the platform kills cannot log its own death**:
`ai_call_failed` had **0 rows, ever**, which is not evidence of no failures. So the timeout's job
is **not** to predict a duration — it is to **fire before the platform does**, so the failure is
attributable. 240 s leaves 60 s for everything the route still does after the model returns
(generation, `validatePlan`, the repair ladder, the save). **A timeout at or above the ceiling is
not a timeout.**

⚠️ **The throughput model was tried first and is wrong.** Pooled over 749 real calls the p05 rate
is 22.8 output tokens/s, which sizes `enrich-plan`'s 14,000-token ceiling at **615 s** — absurd,
because the pooled rate is dominated by small calls that are LATENCY-bound (29 tokens in 931 ms)
while `enrich-plan` streams at **96–113 tok/s**. Two regimes behind one average.

## Measured, 2026-11-08 (`ops_events.ai_call`, 749 calls)

| surface | n | p50 | p95 | max |
|---|---|---|---|---|
| `enrich-plan` | 103 | 42.7 s | 57.0 s | **64.4 s** |
| `weekly-report` | 36 | 3.3 s | 5.0 s | 5.7 s |
| every other surface | — | ≤ 1.6 s | ≤ 2.1 s | ≤ 3.6 s |

**And rising:** `enrich-plan` p50 went **38.3 → 45.4 → 59.1 s** across 2026-09/10/11, with 3 of
103 calls already over 60 s. ⚠️ The item that filed this said *"plan enrichment measures
28–35 s"* — stale by nearly 2×, in the direction that matters.

## Not covered

🔻 **The timeout is NOT per surface**, so a hung `daily-coach-note` (p95 1.3 s) holds a function
for four minutes. Filed as `AI-TIMEOUT-PER-SURFACE-01` rather than guessed: four surfaces have
n ≤ 5 samples and `enrich-maintenance` has **zero**.

🔻 **`maxDuration` on the route is not the only ceiling a request meets.** Any client fetch
timeout, CDN limit or proxy in front of the function is outside this contract and unmeasured.

🔴 **THE 300 IS ACCEPTED BY THE BUILD AND UNVERIFIED IN PRODUCTION, and that is the honest
negative space of this whole item.** `npm run build` exits 0, so the value is syntactically and
type-wise fine. But **the 300 s ceiling is conditional on Fluid compute**, and if Fluid is off
Vercel **clamps** rather than failing — in which case the real ceiling is lower than 300, the
240 s client timeout never fires, and **every gate in this contract stays green while proving
nothing.** A silent clamp is indistinguishable from a working ceiling from here.

👤 **ONE DASHBOARD CHECK SETTLES IT and it is the founder's:** Vercel → project `zona` →
Settings → Functions → **is Fluid compute enabled?** If yes, nothing to do. If no, enabling it is
the one-click fix and the ceiling becomes real. ⚠️ From this machine the question is
unanswerable: observability returns 404 and `get_project` does not expose the flag. Filed as
`OPS-FLUID-COMPUTE-CONFIRM-01`.

🔻 **And no long call has been observed in production since this shipped.** The first
`enrich-plan` over 64 s after deploy is the real test; `ai_call_failed` with `reason: 'timeout'`
is where it would appear, and that row existing at all would be the first evidence this path can
report its own failure.
