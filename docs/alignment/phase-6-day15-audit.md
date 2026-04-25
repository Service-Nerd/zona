# Phase 6.3 — Day-15 Journey Audit

**Audited:** 2026-04-25
**Method:** code trace from each paid-feature entry point to UpgradeScreen

---

## Paths confirmed safe (no dead-ends)

| Entry point | Free / expired-trial behaviour | Verdict |
|---|---|---|
| Strava connect button (Me screen) | Routes to `/api/strava/connect` → Strava OAuth → `/api/strava/callback` → `isFeatureAllowed('strava_intelligence', tier)` returns false → redirect to `/dashboard?strava=upgrade` → DashboardClient line 184–186 catches query param → `setScreen('upgrade')` → UpgradeScreen with `trialExpired={trialExpired}` for loss-framing variant. | ✅ Clean handoff |
| Reshape plan (Me screen) | UI button is wrapped in `{hasPaidAccess && onDynamicAdjustmentsChange && (...)}`. Free users never see the button. | ✅ Gated at UI |
| Coach tab | DashboardClient renders `<CoachTeaser ... />` for free users (line 727), full `<CoachScreen>` for paid. CoachTeaser has its own upgrade CTA. | ✅ Tier-divergent rendered |
| Session detail "Connect Strava" prompt (free users, post-log) | Calls `onUpgrade` → `setScreen('upgrade')`. | ✅ Direct route |
| Wizard distance picker (Marathon/50K/100K) | Locked options call `onUpgrade` instead of `setDistanceKm`. | ✅ Inline gate |
| Today screen day-10 nudge banner (1–4 days remain) | Tap → `onUpgrade` → `setScreen('upgrade')` with **no loss framing yet** (still trial-active). | ✅ Pre-expiry nudge |
| Day-15 expiry transition | DashboardClient on mount: `paidAccess = hasActiveSub || isTrialActive(trialStartedAt)`; sets `trialExpired = !paidAccess && !!trialStartedAt`. UpgradeScreen renders loss-framing when `trialExpired === true`. | ✅ Automatic on next reload |

---

## Findings

### F1 — ReshapeScreen 403 has no upgrade CTA (defense-in-depth gap)

**Severity:** Low — only reachable by URL manipulation since MeScreen gates the entry.

**Trace:** If a free user navigates directly to `screen=reshape` (browser back/forward, URL state, etc.), `ReshapeScreen.analyse()` calls `/api/adjust-plan` which now returns `{ error: 'Subscription required' }` (status 403). The screen sets `error='Subscription required'`, `status='error'`, and renders the error state — but with no "Upgrade" CTA. User can only tap Back.

**Code location:** `app/dashboard/DashboardClient.tsx:3018` and the error render block below.

**Fix:** When `error === 'Subscription required'`, show a primary "See plans" CTA that calls `setScreen('upgrade')`. Two-line change.

**Recommendation:** Defer. Defense-in-depth only — primary gate is the MeScreen UI hide. Add when next touching ReshapeScreen for unrelated reasons.

---

### F2 — Free users can generate new plans post-trial (Option A semantic gap)

**Severity:** Medium — real product behaviour question.

**Trace:** `app/api/generate-plan/route.ts` does NOT block free users. It computes `tier = await getUserTier(user.id)` and passes to `generate(input, tier)`. Free users get the rule-engine output (no AI enrichment); paid get rule + AI.

**Conflict:** `lib/plan/featureGates.ts → PAID_ONLY_ONGOING` includes `new_plan_generation`. The Phase 6 follow-up doc (`docs/alignment/phase-6-gates-followup.md`) lists drafted paywall copy for it:
> "New plan needs Premium. Your existing one stays as-is."

**Two valid interpretations:**

| Strict Option A | Lenient Option A |
|---|---|
| Free users keep their trial-era plan and **cannot regenerate**. New plan generation is the subscription value. | Free users can regenerate **rule-engine plans** freely (treated as "generic templates"). AI enrichment + ultras stay paid-only. |
| Marketing edge: "fresh start" is part of premium | Brand promise: "free users are never abandoned" — they always have a tailored plan |
| Cleaner upsell to subscription | Existing `feature-registry.md` line: "Generic plan templates (5K/10K/HM) via rule-based engine — FREE". Lenient = today's behaviour. |

**Code change required for strict path:**
```ts
// in app/api/generate-plan/route.ts — after getUserTier:
const isRegen = !!input.is_regeneration  // would need a new flag in GeneratorInput
if (isRegen && !isFeatureAllowed('new_plan_generation', tier)) {
  return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
}
```
Or: detect existing plan presence server-side (`fetchPlanForUser`) and gate based on that.

**Recommendation:** **Needs your call.** This is a commercial decision, not a refactor.

---

## Verification (manual, browser-required)

These can't be confirmed by code-trace alone. Worth a quick check after deploy:

1. **Day-10 nudge appears.** Edit `trial_started_at` in Supabase to ~10 days ago, reload dashboard, see banner with "4 days of full access left" or similar. Tap it → UpgradeScreen renders normally (no loss framing yet — trial still active).
2. **Day-15 transition.** Edit `trial_started_at` to >14 days ago, reload. Banner disappears. Tap any paid feature (Coach tab → goes to CoachTeaser; Strava in Me → goes to upgrade with loss framing).
3. **Reset.** Restore `trial_started_at` to your real trial date.

---

## Conclusion

The day-15 path is clean. No production dead-ends within the supported UI flows. The two findings above are:
- **F1** — defensive polish, low priority
- **F2** — needs a product decision, not a code fix
