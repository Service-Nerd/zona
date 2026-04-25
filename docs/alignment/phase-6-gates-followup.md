# Phase 6 — Feature Gates UI (Follow-up Plan)

**Status:** Server-side gate logic shipped. UI gates + day-15 transition deferred from R23 rebuild autonomous run.

---

## What's done (server-side, in repo)

| File | What |
|---|---|
| `lib/plan/featureGates.ts` | `FEATURE_GATES` constant — Option A categories (Phase 1) |
| `lib/plan/canUseFeature.ts` | `canUseFeature(feature, tier)` + `isFeatureAllowed()` server helper (Phase 6) |
| `lib/trial.ts` | `getUserTier()` and `hasPaidAccess()` already work post-pull (Bearer auth) |

The combination is enough for any API route to gate a feature:

```ts
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'

const user = await getUserFromRequest(req)
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const tier = await getUserTier(user.id)
if (!isFeatureAllowed('new_plan_generation', tier)) {
  return NextResponse.json({ error: 'Subscription required' }, { status: 402 })
}
```

---

## What still needs doing (in-loop)

### 6.2 — Wire into existing API routes

Audit each route and replace ad-hoc tier checks with the new helper:

| Route | Feature key |
|---|---|
| `app/api/generate-plan/route.ts` | `new_plan_generation` (every call after the user already has a plan); ultra plans → `ultra_plan_generation` |
| `app/api/adjust-plan/route.ts` | `dynamic_reshape_r20` |
| `app/api/confirm-adjustment/route.ts` | `dynamic_reshape_r20` |
| `app/api/revert-adjustment/route.ts` | `dynamic_reshape_r20` |
| `app/api/recalibrate-zones/route.ts` | `dynamic_reshape_r20` (or its own key) |
| `app/api/analyse-run/route.ts` | `strava_intelligence` |
| `app/api/weekly-report/route.ts` | `strava_intelligence` |
| `app/api/strava/callback/route.ts` | `strava_intelligence` |
| `app/api/claude/route.ts` | `ai_coach_notes_new` |

The existing `hasPaidAccess()` calls map cleanly to `isFeatureAllowed('<key>', tier)` — gradual migration.

### 6.3 — Day-15 transition UI

**Day-10 in-app message** — banner on Today screen, calm copy, dismissible.
- Trigger: trial day 10 (4 days remaining). Compute via `trial_started_at + 10 days < now()`.
- Copy candidate (ZONA voice): "Four days left at full access. Plan is yours either way."
- Style: amber-accent banner, NOT modal (UI principle N-004).

**Day-15 soft transition** — full-screen route, NOT modal.
- Trigger: trial expired AND user attempts a paid feature.
- Already partially shipped: `UpgradeScreen` exists at `app/dashboard/UpgradeScreen.tsx`. Loss-framing variant lives there (GTM-04).
- Phase 6.3 work: ensure tier-divergent routing surfaces the right UpgradeScreen variant when a feature gate fires.

**Paywall copy for gated actions** — already exists in UpgradeScreen. Drafts for new gates:

| Feature | Soft-block copy (ZONA voice) |
|---|---|
| `new_plan_generation` | "New plan needs Premium. Your existing one stays as-is." |
| `dynamic_reshape_r20` | "Reshape needs Premium. The plan you have keeps running." |
| `ultra_plan_generation` | "Ultras are Premium. 5K through HM are free." |
| `strava_intelligence` | "Strava analysis needs Premium. You can still log manually." |
| `ai_coach_notes_new` | "New coach notes need Premium. Existing notes on your plan stay." |

These need user approval before shipping. Trigger `frontend-design` skill per spec rule 4.

### 6.4 — Trial start trigger

**Decision (Phase 0 C-16): keep on first dashboard load.** Already implemented in `DashboardClient.tsx` line ~295. No code change needed. Documented as-is.

---

## Verification (browser-required)

- Trial day 10 banner appears, dismisses, doesn't return same session.
- Trial day 15 expiry: free user attempts `new_plan_generation` → routes to UpgradeScreen.
- Free user with existing trial-era plan: opens plan, sees no gate (granted-retained).
- Free user taps "Reshape plan" on existing plan: sees paywall (paid-only-ongoing).
- Subscription active: all features unlocked.
- Subscription expired: same gating as free.

---

## Estimated effort

2–3 hours for an in-loop session: ~1h API-route migration, ~1h day-10 banner + UpgradeScreen wiring, ~1h browser smoke + agent-browser journey test.
