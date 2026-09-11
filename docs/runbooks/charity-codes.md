# Runbook — charity access codes

**When you need this:** a charity partner has told you how many runners they
have, and you need to give those runners the app free.

Everything here is safe to re-read. The only command that changes anything is
step 2.

---

## Give a partner their codes

### 1. Decide the number

Ask the partner how many runners they have, then add roughly 20% headroom for
late entries and people who lose the email. The number is a **cap**: it bounds
what you are giving away, and you can always mint a second batch later.

### 2. Mint the batch

```bash
npx tsx scripts/mint-charity-codes.ts "Make-A-Wish UK" 120 > mawuk-codes.csv
```

Quote the partner name exactly as you want it in your own reporting. The CSV
lands in the file; progress goes to the screen, so the file contains only codes.

### 3. Check it landed

```bash
npx tsx scripts/check-charity-code.ts
```

You should see the batch with `minted` equal to the number you asked for.

### 4. Send the CSV to the partner

They distribute to their own runners. **You never need to know who they are** —
that is the whole design. The charity decides who gets a code, because they are
the only party who knows who holds a place with them. Possession of the code is
the proof.

---

## Check whether a specific code worked

```bash
npx tsx scripts/check-charity-code.ts ZONNA-4K7M-9PQR
```

```
claimed   : YES by 9f2c…           # or "no — still available"
expires   : 2026-12-10 (90d away)
grant live: YES — this user resolves as paid
```

**Use this rather than trusting the app.** If you test on your own account and
you are `is_admin`, `getUserTier` resolves admin → paid *before* it ever reaches
the grant, so the app looks identical whether the redemption landed or silently
failed. The row is the truth.

---

## Turn a batch off

```sql
update charity_batches set revoked_at = now() where id = '<batch id>';
```

Get the id from `check-charity-code.ts` with no arguments.

Revoking stops **unclaimed** codes being redeemed. It deliberately does **not**
touch grants already made: clawing access back from a runner mid-training block
is the exact thing the grant design exists to avoid.

---

## How the expiry works

Three rules, all in `lib/charity/grantWindow.ts`, which is the single owner of
this date. Nothing else computes it.

| When | What happens |
|---|---|
| **They redeem** | 90 days from today. Deliberately short: it has to be shorter than a training block so the race date below is what actually binds. |
| **They save a plan with a race date** | Extends to **race day + 7 days**. Fires inside `savePlanForUser`, so the wizard, a reshape, a recalibration and the maintenance handoff are all covered. |
| **They change or defer their race** | Extends again. **Never shrinks** — switching marathon → 10K does not claw access back. Capped at 18 months from redemption so a new race each season cannot make it perpetual. |

A runner who redeems and never builds a plan lapses at 90 days. That is correct:
they did not use it.

### What happens when it expires

`getUserTier` stops returning `paid` and they drop to the free tier. Every gated
API route goes through that one function, so nothing needs to be switched off
by hand. **They keep the plan they built** (Option A) — they just lose the
ongoing coaching, reshaping and run analysis.

---

## Where a runner enters their code

Three doors, all reaching the same screen. If a partner asks "where do they put
it?", the answer is any of these:

| Door | When they hit it |
|---|---|
| **Me screen** → "Have a charity code?" | Any time, from day one. |
| **Setting up a plan** → under the distance tiles | During onboarding, and again at the paywall. |
| **Upgrade screen** → under Restore | When they hit a paid gate. |

**Tell them to redeem when they install, not when they get blocked.** It costs
them nothing: the grant re-anchors to race date + 7 days as soon as they build a
plan, so redeeming early does not shorten it. Waiting means their access quietly
depends on remembering before day 15.

## What a comped runner will NOT receive

Worth knowing before a partner asks, because it used to be wrong (fixed
2026-09-11). Anyone who has redeemed a code is excluded from the trial emails
**permanently**, live grant or lapsed:

- Day 11: *"3 days left."*
- Day 14: *"Trial ends today."*

They never had a trial story to end, and those emails going to a partner's
fundraisers is the worst possible first impression. The same exclusion covers
the in-app trial countdown and the account label, so a grant holder reads as
**Pro**, not **Trial**.

When their grant does eventually lapse, the Upgrade screen says "Your charity
access has ended", not "14 days done".

## First time only, per environment

The database tables come from `supabase/migrations/20260911_charity_access_codes.sql`.
Applied to production 2026-09-11. If you ever set up a fresh environment, run it
there too and append the filename to `.claude/state/applied-migrations.txt`.

The scripts read `.env.local` for `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. Both are already there.

---

## Related

- Spec and the SLT reasoning: `docs/releases/backlog.md` → **GTM-CHARITY-04**
- Landing page for these runners: `/charity-runners`
- Why we grant PAID and not the free tier: the free tier cannot generate a
  marathon plan at all, and every injury-protective feature (reshaping, run
  analysis) is paid, which is the wrong thing to withhold from the highest
  injury-risk cohort the product serves.
