# PendingAdjustmentBanner — Diagnosis

**Date**: 2026-04-23  
**Status**: Two confirmed bugs + one expected behaviour gap. Not a rendering issue.

---

## 1. Component file — present and correct

- `components/shared/PendingAdjustmentBanner.tsx` — exists, correct props interface
- Imported at top of `DashboardClient.tsx` line 17 — import is valid
- `AdjustmentBanner` wrapper (line 2834) correctly renders `PendingAdjustmentBanner` with the `adjustment.summary` as children

---

## 2. Today screen wiring — correct

- `pendingAdjustment` is passed as prop to `TodayScreen` (line 685)
- TodayScreen prop type declares `pendingAdjustment?: any | null` (line 2897)
- Render gate at line 3300: `{pendingAdjustment && (<AdjustmentBanner ...>)}`
- Logic is sound — banner shows when `pendingAdjustment` state is non-null

---

## 3. Plan screen — banner NOT wired

The banner is **absent from PlanScreen entirely**.

- `PlanScreen` receives no `pendingAdjustment` prop (line 686 — PlanScreen call has no such prop)
- `PlanScreen` function signature has no adjustment-related props
- No `AdjustmentBanner` or `PendingAdjustmentBanner` rendered inside PlanScreen JSX

**Expected behaviour or design gap?** The Phase 2 brief only specified Today screen for the banner. Plan screen absence may be intentional — but if the banner should appear on Plan too, it needs to be wired in the same way as Today.

---

## 4. What sets `pendingAdjustment` state — and the critical bug

`pendingAdjustment` is set at line 319 via this Supabase query (line 311):

```ts
supabase.from('plan_adjustments')
  .select('*')
  .eq('user_id', user.id)
  .eq('status', 'pending')            // ← only fetches 'pending'
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
```

This correctly fetches only rows with `status = 'pending'`. The banner only appears when such a row exists.

**Bug found in `adjustmentsThisWeekRes` query inside `/api/adjust-plan/route.ts` (lines 46–49):**

```ts
supabase.from('plan_adjustments')
  .select('id')
  .eq('user_id', user.id)
  .in('status', ['pending', 'confirmed', 'auto_applied'])
  // ← no week_n filter
```

This query fetches ALL adjustments across ALL weeks in those statuses. The count is used to enforce `MAX_ADJUSTMENTS_PER_WEEK = 2` (constants.ts line 49). Because it counts across all weeks — not just the current week — once a user has 2+ lifetime confirmed/auto-applied adjustments, `guardCheck()` returns `false` and no further adjustments are ever generated.

**Effect**: After the first two adjustments ever applied (whether this week or weeks ago), `checkAdjustmentTriggers()` always returns `null`. The `plan_adjustments` table never gets new `pending` rows. `setPendingAdjustment` is never called. Banner never renders.

**This is the primary bug preventing the banner from appearing for returning users.**

---

## 5. Dynamic adjustments toggle

- `dynamic_adjustments_enabled` is read from `user_settings` at line 302
- Default state is `true` (line 135)
- If the column is `false`, `setDynamicAdjustmentsEnabled(false)` is called
- **However**: `dynamicAdjustmentsEnabled` state is never checked before the coaching data fetch at line 305 — the `if (paidAccess)` gate is the only guard
- The toggle controls display in MeScreen but does **not** gate the initial fetch of pending adjustments from Supabase
- Separately: `/api/adjust-plan` (POST) does not check `dynamic_adjustments_enabled` from `user_settings` — it only checks tier
- If the feature is toggled off in user settings, new adjustments still get generated if the route is called directly. The toggle is UI-only, not enforced at the API boundary.

---

## 6. Is the feature fully operational end-to-end?

No. Two blockers beyond the DB query bug:

**Blocker A — who calls `POST /api/adjust-plan`?**  
Nothing in the frontend calls this endpoint. The `AdjustmentBanner.confirm()` function calls it on user confirmation, but that is the *confirm* action, not the *generation* action. Generation requires a separate trigger (a cron job, a Strava webhook handler, or an explicit user action). No such trigger exists in the current codebase. The `plan_adjustments` table will only have rows if inserted manually or via a future background job.

**Blocker B — `adjustmentsThisWeekRes` has no week_n filter**  
Even when `POST /api/adjust-plan` is called, the guard query counts adjustments across all weeks. After 2 lifetime adjustments, the engine is permanently suppressed. The query should filter by `week_n = weekN`.

---

## 7. Summary diagnosis

| Check | Finding |
|---|---|
| Component file present? | Yes — `components/shared/PendingAdjustmentBanner.tsx` |
| Imported in DashboardClient? | Yes — line 17 |
| Wired into TodayScreen? | Yes — prop passed, render gate correct |
| Wired into PlanScreen? | **No** — not in scope or missing |
| `pendingAdjustment` state ever set? | Only if `plan_adjustments` has a `pending` row for this user |
| `plan_adjustments` rows being generated? | **No** — nothing calls `POST /api/adjust-plan` automatically |
| Guard query correct? | **No** — counts all-time adjustments, not current-week |
| `dynamic_adjustments_enabled` enforced at API? | **No** — toggle is UI-only |

**Root cause of "not rendering": The `plan_adjustments` table has no `pending` rows for the test user because nothing generates them. This is expected behaviour given the feature is incomplete, not a rendering bug.**

---

## 8. What to fix (not doing this now — read-only investigation)

1. **`/api/adjust-plan` line 46–49** — add `.eq('week_n', weekN)` to the `adjustmentsThisWeekRes` query so `MAX_ADJUSTMENTS_PER_WEEK` applies per-week, not per-lifetime.

2. **Generation trigger** — decide where `POST /api/adjust-plan` gets called. Options: (a) on dashboard load if `paidAccess && dynamicAdjustmentsEnabled`, (b) via Strava webhook after activity sync, (c) nightly cron. Without this, the table stays empty and the banner never renders.

3. **API enforcement of toggle** — `POST /api/adjust-plan` should check `user_settings.dynamic_adjustments_enabled` and return early if `false`.

4. **PlanScreen banner** — if the banner should appear on Plan too, pass `pendingAdjustment` prop and render `AdjustmentBanner` at the top of the plan list.
