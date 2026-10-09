# API Contract — `GET /api/ops/subscription-health` (OPS-SUBS-HEALTH-CONSUMER-01)

**Tier:** Ops/internal — not user-facing, no FREE/PAID gate.
**Owner:** `lib/ops/subscriptionHealth.ts` (the definition of "somebody paid and did not get access") · `lib/subscriptions/webhookTrace.ts` (what the webhooks record) · `app/api/ops/subscription-health/route.ts` (the read).
**Closes:** `OPS-SUBS-HEALTH-CONSUMER-01`.

---

## Why this route exists

`lib/ops/subscriptionHealth.ts` shipped on 2026-09-28 with **no consumer at all**. Its only
references in the repo were two comments in `webhookTrace.ts` and its own test file, while every
other ops probe — `ai-spend`, `onboarding-integrity`, `plan-audit`, `reshape-integrity`,
`strava-webhook-health` — had a route. A handoff recorded it as *"added to the dashboard"*. It was
not.

That is the `configConsumer.test.ts` class: a value can be authored, ratified, documented, enforced
by a check and still be **inert**. The module was written precisely because *"the name belongs in
versioned, tested code rather than in a prose prompt nothing can check"* — and for two days the
thing actually deciding whether a paid-but-unentitled runner got surfaced was the daily digest
routine's hand-rolled SQL, outside the repo, which had to be edited **by hand** to match a code
change on 2026-09-30.

## Auth

`CRON_SECRET` via `Authorization: Bearer <secret>` or `x-cron-secret`. Same shape as every other
ops route. **Not public:** the response names accounts that have paid.

`GET` delegates to `POST`; both behave identically.

## ⚠️ It is a READER, not a probe

`OPS-SUBS-ALERT-01` ruled **"no probe, no cron"**: the rows already exist in `ops_events`, so a
second automation would only re-read them and spend budget doing it. This route therefore:

- **writes nothing** — no `recordOpsEvent`, no dedup window, no alert row;
- **is not scheduled** — nothing calls it on a timer;
- **refuses rather than reassures** — a failed `ops_events` read returns **500**, never
  `healthy: true`. A probe that answers "clean" because the query failed is the failure it exists
  to prevent (`strava-webhook-health` takes the same line).

## Response

```ts
{
  healthy: boolean          // !verdict.alert
  window_days: number       // AT_RISK_WINDOW_DAYS — 7, from the owner, never a literal
  verdict: AtRiskVerdict    // judgeEntitlementRisk(rows) — see the owner
  rows: Array<{
    at_utc: string
    kind: string
    provider: string | null
    event_type: string | null
    environment: string | null        // 'sandbox' | 'production' | null
    missing: string | null
    attributable: boolean             // false = a payment we cannot trace to an account
    pre_signup_redemption: boolean    // see below
    remedy: string                    // from the owner, never written here
  }>
}
```

⚠️ **`environment: null` means "we could not establish which world this was", never
"production".** Any row written before 2026-09-30 predates the field.

⚠️ **`pre_signup_redemption: true` is NOT a lost sale.** It is the designed charity journey
(`CHARITY-OFFER-CODE-01`): redeem an offer code, then install, then sign up, so the receipt
attaches to an anonymous `$RCAnonymousID:` and the route answers 200 on purpose. These are excluded
from `verdict.alert` and counted in `verdict.preSignupRedemptions`. An offer created with
auto-renew OFF also emits `CANCELLATION` ~2 minutes after every redemption, so each redemption
leaves **two** rows.

🔴 **AND UNTIL 2026-10-09 THIS ROUTE COULD ONLY EVER SEE ONE OF THOSE TWO ROWS**
(`OPS-SUBS-UNHANDLED-SEEN-01`). The sentence above was already written here — the document
knew a `CANCELLATION` followed every redemption — and the query selected only
`ENTITLEMENT_AT_RISK_KINDS`, which does not contain `revenuecat_event_unhandled`. So an event
we had **decided** not to act on was indistinguishable from an event that never arrived.
Measured that day: **3 `revenuecat_event_unhandled` and 17 `revenuecat_event_unusable` in 14
days**, and the honest read of the digest was *"no rows, so no cancellations."*

The route now selects `[...ENTITLEMENT_AT_RISK_KINDS, ...ENTITLEMENT_OBSERVED_KINDS]`, and
`verdict.observedNotActioned` counts the second list. **It never raises `alert`** — the same
treatment `preSignupRedemptions` gets, and for the same reason: alerting on a CANCELLATION
would alert on every charity redemption. `webhookTrace.ts` states the principle: *"absence of
ops events did not prove the webhooks never fired."*

⚠️ **A consumer rendering this field must not colour it as a failure.**
`docs/runbooks/digest-subscription-observed.md` carries the rendering rule, and pasting the
SQL without it is worse than the blindness it replaces.

## What the route may NOT do

Guarded by `lib/ops/subscriptionHealthConsumer.test.ts`, which fails the build if any of these
regress:

| Must not | Why |
|---|---|
| Hardcode a `*_unusable` / `*_write_failed` kind string | That is how the digest's Q9 and the module drifted apart in the first place. Read `ENTITLEMENT_AT_RISK_KINDS` |
| Select only the at-risk kinds | An event we deliberately do not act on is still an event. Select `ENTITLEMENT_OBSERVED_KINDS` too, or "no rows" reads as "no events" |
| Alert on an `*_unhandled` row | `CANCELLATION` means auto-renew off, not access ended. Alerting fires on every charity redemption — counted, never alerted |
| Decide for itself which rows are pre-signup | A second copy of the rule, agreeing only by accident — `TIER-OWNER-01`'s shape |
| Write its own remedy text | The instruction and the detection must not drift; `remedyFor()` owns it |

⚠️ **The gate lives in `lib/`, not beside the route.** `vitest.config.ts` collects only
`lib/**/*.test.ts` and `components/**/*.test.ts`, so a test next to the handler would never run —
the same constraint that put `webhookTrace` in `lib/`. It asserts a **consumer exists**, not that
the handler is correct.

## Residual, stated

**The daily digest routine's prose is still not mechanically checkable from here.** Nothing in this
repo can read a cloud routine's prompt, so the route existing does not by itself stop the prompt
drifting from the owner. Closing that gap means the digest **calling this route** instead of
re-deriving Q9 — which is why option 1 in the backlog item was the only real one.
