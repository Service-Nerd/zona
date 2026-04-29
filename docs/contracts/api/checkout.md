# API Contract — /api/checkout

**Method:** POST  
**Auth:** Bearer token (any tier).  
**Gate:** None — all authenticated users can initiate checkout.

## Request body

```json
{ "annual": false }
```

`annual: true` uses `STRIPE_PRICE_ANNUAL`. `annual: false` (default) uses `STRIPE_PRICE_MONTHLY`.

## Response — 200

```json
{ "url": "https://checkout.stripe.com/c/pay/..." }
```

Client should redirect to `url` to complete payment.

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | No valid session |
| 503 | `STRIPE_SECRET_KEY` not configured (pre-launch) |
| 503 | Price ID not configured for requested billing period |

## Notes

- Stripe Checkout session created with `mode: 'subscription'`, `trial_period_days: 14`.
- `success_url` redirects to `/dashboard?subscription=success`.
- `cancel_url` redirects to `/dashboard`.
- `user_id` embedded in both `subscription_data.metadata` and `session.metadata` for webhook reconciliation.
- Returns 503 (not 500) when Stripe is not yet configured — safe error message for pre-launch state.
