# SLT — WAITLIST-UNREACHABLE-01: is the waitlist a live surface?

**Sitting:** SLT, one sitting, 2026-11-20. The item's order is SLT first, then Design Board "if it lives".

## Analysis — the item re-measured (filed 2026-11-08)

| Item says | Today |
|---|---|
| `WaitlistForm.tsx` imported by nothing | Confirmed: only its own file, `globals.css` (a comment), a geometry fixture and tests reference it. |
| Route, table, deletion clause all live | Confirmed: `app/api/waitlist/route.ts` is a **public, unauthenticated POST** that inserts via the service-role key, no rate limit; `on_auth_user_deleted` deletes by email (`20260924_charity_seat_stays_spent.sql:76`). |
| "Shipping a form nobody decided to show is how the first one got here" | 🔴 **The premise is inverted. The form was REMOVED by decision, twice.** `f8266cf3` (2026-06-15) *"flip zonna.run from waitlist to live App Store CTA … WaitlistForm + pre-launch copy removed from the landing page"*; then `53202c10` (2026-09-21, COPY-CTA-01) removed it from `PlanPage` because it asked the most interested reader *"to wait for something that already exists"*, with the comment *"the waitlist component stays in the repo, unused, for the next pre-launch surface"*. |
| "or is it superseded by the App Store badge's coming-soon state?" | The badge is **not** in its coming-soon state: `BRAND.appStore.url` is set (`apps.apple.com/app/id6767516424`), so `AppStoreBadge` renders the live download link. |
| (not stated) | **`waitlist` holds 0 rows** (production read). ⚠️ That does not prove nobody signed up 06-03 → 06-15: the deletion trigger erases a row when an account with that email is deleted, so 0 rows is a floor, not a count. |
| Feature registry | GTM-08 row (2026-06-03) still describes "App Store badge + waitlist email capture" as the shipped surface. Stale since 06-15. |

So the question has already been answered twice by the product, in code: the waitlist is superseded by a live
App Store. What was never decided is the *remains*: a public write endpoint into a table nothing reads.

## The board

🧠 **Sutherland:** "A waitlist for a product you can download is a queue in front of an open door. It was
right to remove it. Keeping it 'for the next pre-launch surface' is hoarding; the next launch will want a
different form."

📦 **Fried:** "Delete it. Form, route, table, trigger clause. An unauthenticated endpoint that writes PII into a
table nobody reads is not dormant, it is liability. Zero rows says the cost of deleting is zero."

🏃 **Hutchinson:** "Nothing here touches coaching."

🔬 **Wood:** "No behaviour to change. The one habit at stake is ours: dead plumbing that looks maintained gets
maintained. Remove it."

🧭 **Zhuo:** "There is nothing for the Design Board to rule on if nothing renders. The hand-off in the item only
exists if the SLT says it lives. It does not."

## Conflicts

None of substance. The only counter-argument on record is COPY-CTA-01's "keep it for the next pre-launch
surface"; no seat holds it. Recorded so the reversal of that comment is visible.

## Ruling — NOT A LIVE SURFACE. RETIRE IT (no Design Board sitting)

1. The waitlist is **superseded by the live App Store** (decided in code 2026-06-15 and 2026-09-21; ratified here).
2. **Retire the whole stack in one change**, ⚙️ NO BOARD: `WaitlistForm.tsx` and its fixture/test entries,
   `app/api/waitlist`, the `waitlist` table (a drop migration),
   the `delete from public.waitlist` clause in `on_auth_user_deleted`, the `DB-USER-PURGE-01` declaration in
   `lib/supabase/userDataSurfaces.ts`, and the `globals.css` comment row. Lower `UNCONTRACTED_ANY_BASELINE`
   and say it is a **deletion**, not a payment.
3. ⚠️ **Do not half-do it:** dropping the table while the trigger still deletes from it breaks account deletion.
   The trigger change and the drop ship together; the drop is a production DDL the founder applies.
4. Correct the GTM-08 feature-registry row (stale since 06-15) in the same change.

**Tier:** n/a. **Hand-off:** none — the Design Board leg falls away because nothing renders.

## What this does not prove

Whether anyone ever joined the list (0 rows is a floor). Whether a future pre-launch (e.g. Android) wants
email capture; if so it is a new surface and a hard Design Board trigger, built fresh.
