# Security Audit — August 2026

Full assessment of the Zonna codebase: 49 API routes, the Supabase access
model, secrets/tokens, the Claude/LLM integration, and dependencies. Findings
are numbered in severity order and stable — reference them by number.

**Scope note:** there is no `/api/claude` proxy. Every Claude call is inlined in
route handlers via `fetch('https://api.anthropic.com/...')`, so any AI-route
hardening must be applied per-route (or via a new shared wrapper).

**Status legend:** 🔴 open · 🟡 mitigated/accepted · ✅ fixed

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | CRITICAL | `strava/refresh` issues any user's live Strava token, unauthenticated | ✅ fixed (this branch) |
| 2 | CRITICAL | Next.js 14.2.3 middleware authorization-bypass CVE (CVE-2025-29927) | 🔴 open |
| 3 | HIGH | RevenueCat webhook fails **open** — grants subscriptions from a body field | ✅ fixed (this branch) |
| 4 | HIGH | No rate limiting / spend cap on any AI route (cost abuse) | 🔴 open |
| 5 | HIGH | No request body-size limit before user text becomes prompt tokens | 🔴 open |
| 6 | HIGH | Runtime dependency CVEs (next, tar, apn→node-forge/jsonwebtoken, ws, nanoid) | 🔴 open |
| 7 | MEDIUM | Strava OAuth `state` is not a CSRF nonce (account-linking CSRF) | ✅ fixed (this branch) |
| 8 | MEDIUM | Service-role + manual filtering trades away RLS defence-in-depth (systemic) | 🔴 open |
| 9 | MEDIUM | `analyse-run` / `weekly-report` impersonation via `x-service-key` + `x-user-id` | 🟡 accepted |
| 10 | MEDIUM | Stripe webhook has no ordering / idempotency guard | 🔴 open |
| 11 | LOW | `auth-check` debug endpoint left in place | 🔴 open |
| 12 | LOW | Timing-unsafe secret comparisons across cron/webhook routes | 🔴 open |
| 13 | LOW | `checkout` builds redirect URLs from the request `Origin` header | 🔴 open |
| 14 | LOW | Prompt injection: user free-text concatenated into prompts (contained) | 🟡 accepted |

---

## 1 — CRITICAL — `strava/refresh` issues any user's live Strava token, unauthenticated

`app/api/strava/refresh/route.ts`. The handler read `userId` from the POST body,
performed no authentication, looked up that user's `strava_refresh_token` via the
service-role client, and returned a freshly minted Strava `access_token` in the
response body. Any unauthenticated caller could POST `{"userId":"<victim-uuid>"}`
and receive a working Strava access token (`read,activity:read`) for that user,
refreshable indefinitely; it also acted as a "is this user connected?" oracle.

**Fix:** derive the user from the validated bearer token (`getUserFromRequest`),
ignore any body `userId`, scope the lookup to `user.id`. Caller updated to
`authedFetch` (attaches the token; body param dropped).

## 2 — CRITICAL — Next.js 14.2.3 middleware authorization-bypass (CVE-2025-29927)

Affects `>=14.0.0 <14.2.25`. This app uses `middleware.ts` on the session path, so
a crafted `x-middleware-subrequest` header can skip middleware. Same upgrade closes
HIGH SSRF / cache-poisoning / Server-Component DoS advisories. **Upgrade `next` →
14.2.35** (non-breaking within 14.2.x). *(Open — dependency change, out of scope
for this branch.)*

## 3 — HIGH — RevenueCat webhook fails open

`app/api/webhooks/revenuecat/route.ts`. The signature check was wrapped in
`if (REVENUECAT_WEBHOOK_SECRET) { ... }`. If the env var was unset the check was
skipped entirely and the route upserted `subscriptions` with `user_id` taken
straight from the request body — a self-serve upgrade to every PAID feature for
any `user_id`. Contrast the Stripe webhook, which fails closed.

**Fix:** treat a missing `REVENUECAT_WEBHOOK_SECRET` as fail-closed (reject), and
require a matching `Authorization` header on every request via a constant-time
comparison before any DB write.

## 4 — HIGH — No rate limiting / spend cap on any AI route

No limiter anywhere in the app. Every Claude route is authenticated and
tier-gated, but a single trial user (14 days full access, no billing artifact)
can script `post-race-reshape` (Sonnet, `max_tokens: 2048`), `generate-plan`, or
`post-run-reframe` in a loop and drive unbounded Anthropic spend. *(Open.)*

## 5 — HIGH — No request body-size limit

App Router `req.json()` has no size cap; only `post-run-reframe` caps one field
(`user_note`, 2000 chars). Other AI routes accept arbitrary JSON that flows into
the prompt, making per-call token cost attacker-controlled. *(Open.)*

## 6 — HIGH — Runtime dependency CVEs

`npm audit`: 29 total (2 critical, 23 high). Runtime: `next` (→14.2.35), `tar`
(→7.5.21), the `apn → jsonwebtoken ≤8.5.1 → node-forge ≤1.3.3` crypto-forgery
cluster (signs APNs tokens — review before bumping), `ws`, `nanoid`,
`brace-expansion`. Dev-only chain (Capacitor/eslint/vite/`sharp` no-fix) lower
priority. *(Open.)*

## 7 — MEDIUM — Strava OAuth `state` is not a CSRF nonce

`app/api/strava/connect` + `callback`. The OAuth `state` was the plaintext
`userId` (or `userId|ios`) with no signature and no session binding, and `connect`
took `user_id` from the query with no auth. An attacker could mint an authorize
URL / callback binding Strava tokens to an arbitrary `userId` (account-linking
CSRF).

**Fix:** `connect` now authenticates (`getUserFromRequest`), derives `userId` from
the session, and returns an HMAC-signed, timestamped, single-use-nonce `state`
(`lib/strava/oauthState.ts`). `callback` verifies the signature/TTL and trusts
only the verified `userId` — the plaintext-userId parse is gone. Both web and
native clients initiate via `authedFetch` (bearer) and open the returned URL, so
the native `SFSafariViewController` flow (no session cookie) keeps working.

## 8 — MEDIUM — Service-role + manual filtering (RLS defence-in-depth)

~25 per-user routes authenticate correctly, then query with the service-role
client (RLS bypassed) scoped by a manual `.eq('user_id', user.id)`. Correct today,
but IDOR protection rests entirely on that one filter with no backstop. Preferred
long-term pattern: anon client with the forwarded user JWT. *(Open — systemic.)*

## 9 — MEDIUM — `analyse-run` / `weekly-report` impersonation primitive

Internal calls pass the service-role key + arbitrary `x-user-id` and act as that
user. By design for cron fan-out and not client-forgeable (key is server-only),
but a broad impersonation primitive keyed on the most powerful secret. *(Accepted
— documented.)*

## 10 — MEDIUM — Stripe webhook ordering / idempotency

`webhooks/stripe/route.ts` is signature-verified and fails closed (good), but has
no processed-`event.id` dedup and no timestamp gating; a stale `updated` arriving
after a `deleted` could re-activate a cancelled subscription. The `upsert` makes
duplicates harmless — only out-of-order is the residual risk. *(Open.)*

## 11 — LOW — `auth-check` debug endpoint

Self-described temporary endpoint echoing the caller's own `userId`/`email`/`tier`.
Properly gated (no cross-user leak) but should be removed. *(Open.)*

## 12 — LOW — Timing-unsafe secret comparisons

Cron/webhook secret checks use plain `!==` rather than constant-time compare. The
secret is checked in every case, so low. *(Open.)*

## 13 — LOW — `checkout` trusts the request `Origin` header for redirect URLs

Only affects where the attacker's own browser lands post-checkout, not the charge.
Pin to an allowlist for tidiness. *(Open.)*

## 14 — LOW — Prompt injection (contained)

User free-text (`user_note`, `race_name`) is concatenated into prompts unescaped.
Contained: plans come from the deterministic rule engine (ADR-006), AI output
renders as React text (no `dangerouslySetInnerHTML`), and reflections are
per-user keyed — no cross-tenant stored-XSS. Worst case is a user leaking
non-secret coaching doctrine on their own screen. *(Accepted.)*

---

## Verified clean

- `getUserFromRequest` validates the bearer JWT via `supabase.auth.getUser(token)`;
  43/49 routes enforce auth at the boundary and scope service-role queries to
  `user.id`. No IDOR outside finding 1 / 7.
- No service-role key, Strava secret, or Claude key reachable from any
  `NEXT_PUBLIC_*` var, `'use client'` file, response body, or log.
- No SQL injection — zero `.rpc()` calls; all queries use the parameterised builder.
- Tier resolved server-side from the DB (`getUserTier`); no route trusts a
  client-supplied `tier`. Free/expired users get 403 before the Claude call.
- Checkout price integrity: price derived from server-side env price IDs, never
  the body; identity from the validated session. Stripe webhook signature-verified,
  fails closed. Strava scope least-privilege (`read,activity:read`).
- `.env.local` is gitignored; `.env.example` holds placeholders only.
