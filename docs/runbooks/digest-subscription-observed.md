# Runbook — the digest's Q9 must see the events we DON'T act on

**Owner of the judgement:** `lib/ops/subscriptionHealth.ts` —
`ENTITLEMENT_AT_RISK_KINDS` (alert) and `ENTITLEMENT_OBSERVED_KINDS` (count only).
**Gate:** `lib/ops/subscriptionHealth.test.ts` § *observedNotActioned*, including a
population arm that parses every `*_unhandled` kind out of `recordOpsEvent.ts`'s own union.
**Filed as:** `OPS-SUBS-UNHANDLED-SEEN-01`.

---

## Why this runbook exists

Q9 selected four kinds — the ones that mean **a runner paid and the entitlement did not
land**. That list is right for *alerting*. It is wrong for *observing*, and the difference
produced a confident wrong answer on 2026-10-09: asked whether RevenueCat cancellations were
reaching us, the honest read of the digest was **"no rows, so no events."**

**Measured directly against production:**

| kind | 14 days |
|---|---|
| `revenuecat_event_unhandled` | **3** |
| `revenuecat_event_unusable` | **17** |
| `revenuecat_event_received` | 3 |
| `revenuecat_reconciled` | 19 |
| `revenuecat_reconcile_none` | 298 |

They had been arriving the whole time. `webhookTrace.ts`'s own header states the principle:

> *"ABSENCE OF OPS EVENTS DID NOT PROVE THE WEBHOOKS NEVER FIRED ... a healthy webhook and an
> unreachable one looked identical."*

⚠️ **`revenuecat_event_unhandled` is NOT a defect.** It is recorded when `toStatus()` returns
null, and for `CANCELLATION` that is the ratified behaviour — `SUBS-CANCELLATION-TIER-01`
established that CANCELLATION means *auto-renew switched off*, not *access ended*. Acting on
it would have demoted all 500 charity runners. **So it must be counted and never alerted on**,
which is the same treatment `preSignupRedemptions` already gets one screen away.

---

## Q9 — add the observed kinds

Two changes to the existing Q9. Nothing else moves.

```sql
select to_char(e.created_at,'YYYY-MM-DD HH24:MI') as at_utc,
       e.kind,
       e.detail->>'provider'   as provider,
       e.detail->>'event_type' as event_type,
       e.detail->>'status'     as status,
       e.detail->>'missing'    as missing_field,
       e.detail->>'environment' as environment,
       left(coalesce(e.detail->>'message',''), 200) as message,
       coalesce((select u.email from auth.users u where u.id = e.user_id),
                '(UNATTRIBUTABLE - no user_id)') as email
from ops_events e
where e.kind in ('stripe_event_unusable','revenuecat_event_unusable',
                 'stripe_event_write_failed','revenuecat_event_write_failed',
                 'stripe_event_unhandled','revenuecat_event_unhandled')
  and e.created_at >= now() - interval '7 days'
order by e.created_at desc;
```

### ✅ Run against production before it was handed over

Executed against `wkppmpsvqkaxbekdgzdm` on 2026-10-09. **8 rows in 7 days**, and the shape is
the whole argument for the rendering rule below:

| rows | kind | event_type | reading |
|---|---|---|---|
| 6 | `revenuecat_event_unusable` | `INITIAL_PURCHASE` | all `missing_field = app_user_id_not_a_user` — pre-signup redemptions, **already** carved out, neutral |
| **2** | `revenuecat_event_unhandled` | **`CANCELLATION`** | attributable to real runners; **invisible to the old Q9** |

⚠️ **Both CANCELLATIONs are almost certainly the offer-code pattern, not churn.**
`SUBS-CANCELLATION-TIER-01` records that a code created with auto-renew off emits CANCELLATION
**~2 minutes after purchase, on every redemption** — and one of these lands two minutes after
that runner's plan was created. That is precisely why these must be **counted and not
alerted**: red on this would be red on a normal redemption.

(Emails are deliberately not reproduced here — this file is committed.)

### And the rendering rule, which is the half that matters

The prompt's STEP 2C / STEP 4 say any Q9 row is **RED and outranks everything**. That must
NOT apply to the two new kinds. Add to the Q9 instruction:

> ⚠️ **An `*_unhandled` row is NEUTRAL, never red.** It means the provider sent an event type
> we deliberately do not map — `CANCELLATION` is the common one and means auto-renew off, not
> access ended. Render these as a single counted line inside Data integrity
> ("N provider events arrived that we deliberately do not act on"), exactly like pre-signup
> redemptions. **Never let one of these promote Data integrity to red**, and never describe
> one as a lost sale. They exist in the query so that "no rows" can never again be read as
> "no events".

⚠️ **If you only paste the SQL and not this rule, the digest will start screaming about
cancellations every time one arrives** — which is worse than the blindness it replaces, and
is how a section stops being read (NOISE-GATE-01).

## ⚠️ A THIRD change this file did not declare: `limit 20` is gone

The section above says *"Two changes to the existing Q9. Nothing else moves."* **Its own SQL
block also drops `limit 20`**, which the original Q9 carried. That is a third change, it went
unstated, and it was found by diffing the delivered prompt rather than by reading this file.

**Measured before accepting it (2026-10-10, live):** the worst 7-day window in the whole
history of these kinds is **14 rows** — 20 rows all time, first on 2026-09-28 — so a limit of
20 has never once truncated anything and removing it changes no result today.

🔻 **It is unbounded during a campaign, and this file predicts the number itself:** *"A
500-runner campaign produces roughly a thousand of these."* At that volume an unlimited Q9
returns every row into the digest's context every morning. **Put a `limit 200` on it before a
charity campaign goes out**, which keeps the pre-signup count honest while bounding the pull.
Not done now: today's ceiling is 14.

## Re-application

1. Open the routine's prompt at claude.ai (trigger `trig_01P5snwo2k4reDGrX4Z3wkyC`).
2. Replace the `Q9` SQL block with the above, and append the rendering rule to the Q9
   instruction in STEP 2C.
3. Paste both back into this file so the transcript stays byte-identical.
4. `npx vitest run lib/ops/subscriptionHealth.test.ts`.

⚠️ **What no test here can check:** the live prompt. This file is the transcript; the gate
catches the lib and the transcript drifting. Same residual as
`digest-enrichment-health.md` and `digest-trial-funnel.md`.
