# API Contract — /api/charity/redeem

**Method:** POST
**Auth:** Bearer token (`getUserFromRequest`). Any tier.
**Gate:** None on tier — redeeming is how a free user *becomes* paid.
**Route:** `app/api/charity/redeem/route.ts` (GTM-CHARITY-04)

Exchanges a charity access code for a paid-tier grant. **This route is the auth boundary for
the whole feature (ADR-003):** every rule deciding whether a grant is made lives here, and
nothing in the client is trusted.

## Request

```
POST /api/charity/redeem
Authorization: Bearer <supabase access token>
Content-Type: application/json

{ "code": "ZONNA-XXXX-XXXX" }
```

`code` is passed through `normaliseCode` (`lib/charity/code.ts`), which is **forgiving about
presentation and strict about identity** — case, spacing and separators are normalised. The
alphabet is Crockford-style (`23456789ABCDEFGHJKMNPQRSTVWXYZ`): no I, L, O, U, 0 or 1, so the
classic misreads cannot occur. Shape is `ZONNA-XXXX-XXXX`; codespace 30⁸ ≈ 6.6 × 10¹¹.

## Response — 200

Newly redeemed:

```json
{ "ok": true, "expiresAt": "2027-01-15T09:30:00.000Z" }
```

Already redeemed by **this** user — idempotent, and deliberately does **not** burn a second code:

```json
{ "ok": true, "alreadyRedeemed": true, "expiresAt": "2027-01-15T09:30:00.000Z" }
```

## Error responses

| Status | Condition | Message |
|--------|-----------|---------|
| 401 | No valid session | `Unauthorized` |
| 400 | Body is not valid JSON | `Invalid request` |
| 400 | `code` missing or normalises to empty | `Enter your code to continue.` |
| 404 | No such code | `That is not a code we recognise. Check it and try again.` |
| 409 | `claimed_at` already set | `That code has already been used.` |
| 409 | Batch revoked | `That code is no longer active. Ask your charity for a new one.` |
| 409 | Lost the claim race, or the one-grant-per-user index rejected it | `That code has already been used.` |
| 429 | More than `CHARITY_REDEEM_LIMIT` attempts in the window | `Too many attempts. Wait a few minutes and try again.` |
| 500 | Update errored | `Could not redeem that code. Try again.` |

⚠️ **The messages are deliberately specific** — *"already used"* vs *"not a code we recognise"*.
This is a gift, and a runner who mistypes one character deserves to know which problem they
have. With a 30⁸ codespace on an authenticated route, specificity is not a meaningful
enumeration risk. **Do not "harden" these into one generic failure.**

## Affiliation is never verified, and never needs to be

The partner is issued a capped batch and decides who gets a code, because they are the only
party who knows who holds a place with them. **Possession of an unclaimed code IS the proof.**
So this route asks only: *is this code real, unclaimed, and from a live batch?*

## The grant window

`initialGrantExpiry(now)` = **now + 90 days** (`INITIAL_GRANT_DAYS`).

Deliberately short rather than generous. At redemption there is no plan and therefore no race
date — and for a marathon runner, building the plan is itself the thing the grant unlocks. The
provisional window must be **shorter than a typical block**, or it, not the race date, would be
the value that actually binds and the race+7d rule would never fire. A runner who redeems and
never builds a plan lapsing at 90 days is the correct outcome: they did not use the gift.

Re-anchoring happens elsewhere (`reanchorGrantExpiry`, on plan save): **extend-only**, to
`max(currentExpiry, raceDate + 7d)` clamped by an 18-month ceiling from `grantedAt`. A runner
switching marathon → 10K never has access clawed back.

## Concurrency and state

- **Service-role client.** `charity_codes` has no public read policy, because an unredeemed
  code is a secret and a readable table is a harvestable batch.
- **The claim is atomic.** The update carries `.is('claimed_at', null)`; two runners racing the
  same code produce exactly one winner, because the second update matches zero rows. Without
  that predicate both could read "unclaimed" and both write.
- **Batch revocation blocks unclaimed codes only.** It deliberately does not touch grants
  already made — taking access back from a runner mid-block is the cliff this design exists to
  avoid.

### Why the gates read `claimed_at`, never `claimed_by` (GTM-CHARITY-07)

`charity_codes.claimed_by` is `ON DELETE SET NULL`. Gating on it meant deleting an account
nulled the column while leaving `claimed_at` and `expires_at` populated — so **the code
returned to the unclaimed pool and became redeemable again by anyone holding it.** A small
abuse path (redeem → delete → re-redeem) and, more likely to bite, a batch redemption count
that silently drifts *down* over a season.

**Both the read gate and the atomic predicate had to move together.** Leaving the predicate on
`claimed_by` would have let a deleted-user row be re-claimed by the update even though the read
gate refuses it — a worse bug than the original, because the refusal would depend on which path
a request happened to take.

No migration was needed: `claimed_at` already records the fact and already survives deletion.

## Notes

- One grant per user is enforced by a **partial unique index**; the `alreadyRedeemed` branch is
  the friendly path to the same rule, not a substitute for it.
- On account deletion the code is **released back to its batch, not deleted** — the batch keeps
  its record that a seat was used. See `delete-account.md`.

### Rate limiting

**10 attempts per user per hour** (`CHARITY_REDEEM_LIMIT` / `CHARITY_REDEEM_WINDOW_SECONDS`,
`lib/charity/code.ts`), via the shared `checkRateLimit()` on key `charity:redeem:<user_id>`.
Exceeded → **429** `Too many attempts. Wait a few minutes and try again.`

Checked **after** normalisation, so a blank submit does not spend an attempt, and **before** any
DB read, so a caller cannot probe the codes table at speed.

⚠️ **Defence in depth, not the primary control** — the primary controls are auth and the 30⁸
codespace. It **fails open** if the limiter's own infrastructure is down, and that trade is
sharper here than on the AI routes it was borrowed from: a false denial withholds a gift a
runner was promised, which is worse than the thing being prevented.

### History — the comment claimed this control before it existed (CHARITY-REDEEM-RATELIMIT-01)

Until 2026-09-24 `lib/charity/code.ts` justified the codespace with *"the redeem route is also
rate-limited and authenticated"*. **Authenticated was true; rate-limited was false** on every
path since the feature shipped — nothing in the route, nothing in `middleware.ts`, and
`AI_ROUTE_LIMITS` covers AI surfaces only and never named charity.

Found while writing this contract. The sentence was **load-bearing** — it was the stated reason
the codespace was considered sufficient — so the fix was to build the mechanism, not to soften
the claim. **A claim in a comment is not a mechanism.**
