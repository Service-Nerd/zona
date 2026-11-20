# SLT — COMP-NO-IN-PRODUCT-PATH-01: how the founder gives a runner paid access

**Sitting:** SLT, one sitting, 2026-11-20. Traynor's seat stood down; this item is about access, not revenue,
so the gap matters less than usual (every paid account is comped: there is no revenue to protect).

## Analysis — the item re-measured (filed 2026-11-02)

Command: `npx tsx scripts/board-evidence-slt-2026-11-20.ts` (read-only) + code reads named below.

| Item says | Today |
|---|---|
| 23 subs prove the Offer Code route works | **24** subscriptions, **all** `revenuecat / active / is_comped`, period ends 2027-09-28 → 2027-11-02. Zero organic. |
| Option 1: "re-wire the redeem door" | 🔴 **There is no door to re-wire.** `REDEEM-SCREEN-UNREACHABLE-01` deleted `RedeemCodeScreen` and `/api/charity/redeem` on 2026-11-14. Option 1 is now "rebuild a deleted screen and route" — a larger build than when filed. |
| Option 3: "write it into a runbook" | ⚠️ **Already half done.** `docs/runbooks/charity-codes.md` § "What to do instead, today" documents the App Store Connect Offer Code round trip and states that a non-responding runner has "no answer". |
| `charity_codes` only TEST codes | 4 codes, 1 claimed, 1 live grant (a `@test.com` account to 2026-12-22, per the 11-14 record). |
| Admin flag would give admin powers | Confirmed: `resolveTier` returns `reason: 'admin'` first (`lib/trial.ts:365`). 1 admin. |

🔑 **A fourth path the item did not list, already wired, no code needed:** `resolveTier`'s `grant` branch
(`lib/trial.ts:376`) reads `charity_codes.expires_at` by `claimed_by`, on the server (`getUserTier`) **and** the
client (`DashboardClient.tsx:1703`, RLS policy *"Users can read their own claimed code"*). A founder can mint a
code (`scripts/mint-charity-codes.ts`, still kept) and set `claimed_by` / `claimed_at` in the SQL editor — the
runner resolves `paid / grant` with **no action of their own**, is excluded from trial emails permanently, and
RevenueCat never touches it. ⚠️ **Two costs:** the client joins `charity_batches(partner_name, cap, revoked_at)`
for the FIRSTRUN reveal, so **the batch's partner name is runner-visible**; and `GTM-CHARITY-07`'s claim gate
lived in the deleted route, so nothing enforces a batch cap on a hand-written claim.

**Who a comp could matter to:** 10 metric users resolve `free`; 8 hold a plan; **6 of those have had a run or a
log since 2026-10-08**. So the live case is not hypothetical, but it is single digits. Not measured: how many
comp requests have actually arrived (one is recorded, 2026-11-02).

## The board

🧠 **Sutherland:** "A comp you have to ask a lapsed runner to redeem is a gift with homework. The person who
stopped replying is precisely the one you most want to surprise. If a path exists that needs nothing from them,
use it, but make sure what they *see* is a gift from you, not a stranger's charity."

📦 **Fried:** "Do not build an admin panel for a request that has happened once. There is already a mechanism
that works without the runner and it costs a SQL statement. Write it down. Building a founder grant UI is
surface area for a frequency of roughly zero."

🏃 **Hutchinson:** "The item's own footnote is the coaching point: a comp restores access, not the month of
coaching they missed. Whoever grants it should check the plan is still current. No prescription change here."

🔬 **Wood:** "No behaviour here except the founder's. Make his action a two-minute habit with a checklist, or it
will be re-derived from scratch, wrongly, the next time, which is what happened on 11-02."

🧭 **Zhuo:** "The runner-visible part is the reveal. If a goodwill grant shows a partner name, someone has to
decide what that name says. That is a copy and encoding question, small, and only if the reveal fires."

## Conflicts

**Sutherland vs Fried** — Sutherland wants the no-runner-action path to be the default for goodwill; Fried
accepts it only as documentation, never as built tooling. Resolved in the ruling: documented, not built.

## Ruling — BUILD DIFFERENTLY: no code; two documented paths

1. **Don't build** a founder grant action or rebuild the redeem door. Frequency does not justify it.
2. **Primary path stays App Store Connect Offer Codes** (genuine subscription, 24 of 24 paid accounts).
3. **Fallback for a runner who will not or cannot act: a hand-written grant on the existing `grant` branch**,
   documented in `docs/runbooks/charity-codes.md` as exact SQL, with these conditions:
   - a dedicated, non-TEST goodwill batch whose `partner_name` reads acceptably to the runner (the reveal shows it);
   - an explicit `expires_at` (no open-ended grants);
   - the runbook states that no cap is enforced (the gate went with the route) and that it is a production write
     the founder runs in the SQL editor;
   - check the runner's plan is current before telling them (Hutchinson).
4. The runbook line "for a runner who has stopped responding there is currently no answer" becomes false and must
   be replaced in the same change.

**Tier:** n/a (ops entitlement path). **Hand-off:** none required; if the founder wants the reveal copy changed
for goodwill grants, that is 🧭 Design Board / 👤 founder copy, small.

## What this does not prove

The SQL grant path is **read from code, not executed** — no production write was made. Whether the FIRSTRUN
reveal fires for a hand-claimed grant on an existing account, and what it says, is not observed. Request
frequency is one recorded case.
