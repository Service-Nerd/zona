# SLT — PLAN-IDENTITY-01: several plans per runner, switch between them

**Sitting:** SLT, one sitting, 2026-11-20. The item asks three things: is multi-plan a feature, which tier,
when. Its onward order is ⚙️ ADR + architecture → 🧭 Design Board; neither is run here.
Traynor's seat stood down: nobody prices whether multi-plan converts. Stated, not silent.

## Analysis — the item re-measured (filed 2026-10-18)

Command: `npx tsx scripts/board-evidence-slt-2026-11-20.ts` (read-only) + code reads.

| Item says | Today |
|---|---|
| "every week-keyed table (seven)" | Confirmed: `WEEK_KEYED_TABLES` in `lib/plan/supersede.ts:75` has 7 entries. |
| Motivated by PLAN-REBUILD-SUPERSEDE-01 (completions colliding across plans) | That defect is **fixed** (`calendarChangedWeeks`, 2026-10-18) and the collision is handled by marking rows superseded. Superseded completion rows: **178 across 4 users, 1 of them a metric user.** |
| "Reverses ADR-013's rejected follow-on" | Confirmed: ADR-013 line 58 — *"If true multi-plan concurrency is ever needed, revisit the plan_id-scoped-completions migration."* |
| (founder) "so we can not over write sessions" | One `plans` row per user: **0 users** have more than one. Replaced plans go to `plan_archive`, which has no restore UI. |
| (not stated) — how often runners replace a plan | **17 of 29 metric plan-holders** have at least one archived plan; **16 metric users archived 35 plans since 2026-10-08**; one has 7. Replacing a plan is common. |

**What the evidence can and cannot show.** It shows runners rebuild plans often, and that the data hazard the
founder named is now contained by supersede (one metric user affected). It cannot show that any runner wants to
*keep and switch between* plans: there is no request, no event, and `plan_archive` has never been readable by a
runner. A rebuild means "replace this", which is the opposite of "keep both".

## The board

🧠 **Sutherland:** "People rebuild plans for the same reason they reorganise a desk before working: it feels
like progress. Letting them keep five plans multiplies the desk. The founder's real fear is losing history, and
that is a different, smaller promise: 'your old plan is never thrown away'."

📦 **Fried:** "Seven tables, an ADR, every reader filtered by a plan id, a switcher UI, for zero users asking.
The overwrite problem is already fixed. Not now."

🏃 **Hutchinson:** "Two concurrent race plans is a coaching problem, not a data one: which plan governs load this
week? If this ever ships, 'switch' must mean one active plan at a time, and the Coaching Board rules on what
happens to load continuity on a switch. Concurrent active plans would be incorrect."

🔬 **Wood:** "Switching between plans is the exact opposite of what builds a habit: a stable context. One plan,
one week, one session today. A switcher is a standing invitation to renegotiate the plan whenever it gets hard."

🧭 **Zhuo:** "The founder's sentence says *eventually*. This is a direction, not an item. What is the observable
success condition? None is stated. Without one it cannot go to design."

## Conflicts

- **Founder vs Wood.** The founder wants switching; Wood holds that switching works against the habit the product
  exists to build. Not resolved here; recorded for the founder.
- **Sutherland vs Fried** on the smaller promise. Sutherland would surface the archive ("your old plans are kept");
  Fried would build nothing. Both agree the full migration is not now.

## Ruling — DON'T BUILD NOW. A future feature, PAID if ever built, with a trigger

1. **Is it a feature?** A legitimate direction, not a current need. The data-safety motive is already met by
   supersede + `plan_archive`.
2. **Tier, if built:** PAID (plan management beyond one generated plan is a personalised/intelligent feature per
   CLAUDE.md § Feature Tagging; a free runner keeps one plan and is never abandoned).
3. **When:** not before **(a)** any runner asks to return to a previous plan, or **(b)** paying (non-comped)
   subscribers exist for Traynor's recall. Until then it stays parked with this note.
4. **Constraint carried to any future ADR:** one active plan at a time; "switch" archives the current plan; the
   Coaching Board rules on load continuity across a switch before build (Hutchinson).
5. The smaller promise (show runners their archived plans, read-only) is **not** filed by this sitting; it is
   recorded as Sutherland's alternative for the founder to take or leave.

**Hand-offs:** ⚙️ ADR and 🧭 Design Board **not convened** — nothing to design until the trigger in (3) fires.

## What this does not prove

Demand in either direction: no runner has been asked. `plan_archive` count is rebuilds, not intent to switch.
Cost of the migration is not estimated here.
