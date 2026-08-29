# Onboarding + Plan-Generation Audit — Phase 0 (INVESTIGATE ONLY)

**Date:** 2026-08-29
**Author:** Claude (read-only investigation)
**Test account:** `Cyprus.test@test.com` (`auth.users.id = 1809c05e-1bce-407a-96a0-150ac1a9800d`)
**Scope:** Signup → onboarding → 10K plan generation. No code changes, no edits, no migrations, no deploys. All Supabase queries were read-only.

> **Original status (investigation phase): PROPOSED, not applied.** The sections below are the as-investigated record. **Resolution status is tracked in §R immediately below** — the per-defect prose is preserved as the diagnosis, not the current state.

---

## R. Resolution status (updated 2026-08-29)

All engineering defects shipped to `main`; the 10-user leak was backfilled; the one coaching item was ratified by the Coaching Board.

| # | Item | Status | Commit / ref |
|---|---|---|---|
| D1 | Signup hang | ✅ Shipped | `ec398ce` |
| D2 | `has_onboarded` leak (Problem A) | ✅ Shipped | `e2fa9e5` |
| D3 | Zone cards "—" | ✅ Shipped | `e2fa9e5` |
| D4 | Foundation long-run day | ✅ Shipped (+test) | `60e7111` |
| D5 | Connect CTA label | ✅ Shipped | `e2fa9e5` |
| D5 | Connect skip now always visible | ✅ Shipped | `83d3ce8` |
| D6 | "Adjust inputs" → first step | ✅ Shipped | `03ece26` |
| D7 | Sticky CTA overlap | ✅ Shipped | `03ece26` |
| D8 | Ceremony day-chip sort | ✅ Shipped | `eae8989` |
| D9 | "Long ea…" title clip | ✅ Shipped | `16551eb` |
| A1 | Enrichment silently discarded | ✅ Shipped (+test, RCA confirmed) | `113c7ea` |
| Backfill | 10 leaked users → `has_onboarded=true` | ✅ Done (leak = 0) | SQL run 2026-08-29 |
| Coaching-1 | Foundation long-run cap 50→35% | ✅ Ratified + shipped (CD-20) | `f9d609f` |
| Coaching-2 | "Highest volume" Peak copy | ✅ Shipped (copy fix) | `26815bc` |

**Board ruling for Coaching-1:** `docs/decisions/coaching-board-2026-08-29-foundation-long-run.md` (CD-20). **Incident record:** `docs/incidents/2026-08-29-onboarding-leak.md`.

**Still open (blocked on product/brand/screenshot):**
- **D5 "Kit" persona** — the CTA and skip are fixed; renaming/introducing the "Kit" persona (a locked `BRAND` string, colliding with Health**Kit**) is a brand decision.
- **D10 whitespace above phase cards** — investigation could not localise a static source; every candidate returns `null` cleanly. Needs a screenshot of the tester's exact preview state.
- **Coaching-3 phase labels (W3 vs Weeks 1–4)** — ruled a non-bug: two surfaces, each internally consistent.

**Engineering follow-ups (surfaced during Coaching-1, tracked in §7 below):**
- `INV-PLAN-FOUNDATION-BLOCK` volume arm is stricter than §57 (rejects `> current_weekly_km`; §57 permits `baseline × 1.10`).
- Foundation weeks are prepended client-side and never re-run through `validatePlan` → `INV-PLAN-FOUNDATION-BLOCK` is dormant in the live path.

---

## 0. Method & evidence gaps

- Traced each defect from entry point to failure in the actual source; line numbers quoted inline.
- Ran read-only SQL against Supabase (`wkppmpsvqkaxbekdgzdm`) for the test user's real state.
- **Evidence gap 1 — the named handover is not in the repo.** `ZONNA-RESHAPE-RLS-FIX.md` does not exist anywhere under `/Users/russellshear/zona-app` (searched repo-wide) or in the home tree. I could not read "Problem A" from its source; I reconstructed it from the code and the DB. If you have that file elsewhere, worth cross-checking my P0/onboarding conclusions against it.
- **Evidence gap 2 — the handover's cohort claim partially contradicts the DB.** The brief says the cohort has "zero ops_events." For *this* user there are **three `plan_enrich_failed` ops_events** (see §Additional Finding). So either the cohort claim is about a different event type, or this user is not representative of the 9-of-14. Worth confirming before generalising.
- Where a root cause could not be fully confirmed from code alone, it is tagged **Likely** or **Unverified** with the exact evidence that would settle it.

---

## 1. DB snapshot — `Cyprus.test@test.com` (read-only)

| Field | Value | Note |
|---|---|---|
| `auth.users.created_at` | 2026-08-25 06:58:23Z | |
| `email_confirmed_at` | 2026-08-25 06:58:23Z | **= created_at → auto-confirm is ON (email confirmation OFF)** |
| `last_sign_in_at` | 2026-08-25 06:58:51Z | signed in ~28s after signup |
| `user_settings.has_onboarded` | **`false`** | the leak — Problem A reproduced |
| `user_settings.orientation_seen` | `false` | |
| `user_settings.resting_hr` | **`51`** | present — **refutes the "max only" P1 hypothesis** |
| `user_settings.max_hr` | **`185`** | present |
| `user_settings.zone_boundaries` | `null` | red herring for P1 (see below) |
| `user_settings.date_of_birth` | `null` | but `birth_year = 1982` is set |
| `user_settings.plan_json` | `null` | plan lives in `plans`, not the mirror column |
| `user_settings.updated_at` | 2026-08-25 **07:08:28Z** | **after** plan save — HR was written late |
| `plans` rows | **1** (created 2026-08-25 07:06:40Z) | plan saved; onboarding flag not flipped |
| `ops_events` | **3 × `plan_enrich_failed`** | 07:03:28, 07:06:15, 07:06:20 |

**Reconstructed timeline:** signup+autoconfirm 06:58:23 → sign-in 06:58:51 → enrich-fail ×1 07:03:28 → enrich-fail ×2/×3 07:06:15–20 → **plan saved 07:06:40** → user_settings (HR) updated 07:08:28. Note HR reached `user_settings` **after** the plan was saved and (almost certainly) after the orientation screen was shown — this is the crux of P1.

---

## 2. Defect list — priority ordered

| # | Pri | Defect | Root cause | Confidence | Class |
|---|---|---|---|---|---|
| D1 | **P0** | "Creating account…" never resolves | `signUp` awaited with no try/catch/finally/timeout; auto-confirm session ignored, no nav | Confirmed (no error handling) / Likely (exact hang trigger) | Eng |
| D2 | **P0** | `has_onboarded` never flips (Problem A) | Flip lives only in `dismissWelcome`, whose trigger (Welcome screen) was retired/commented out — dead code | Confirmed | Eng |
| D3 | **P1** | Orientation zone cards show `—` for all 5 zones | Cards read DashboardClient mount-time state (null on wizard path), not `plan.meta` HR | Confirmed | Eng |
| D4 | **P1** | Selected long-run day ignored in Foundation week | `foundationBlock.ts` reimplements day placement Mon-first and never reads `preferred_long_run_day` | Confirmed | Eng |
| D5 | **P2** | "Kit needs your runs…" dead-end | Unlabelled CTA + skip hidden until after permission tap + uncredited "Kit" persona / HealthKit name collision | Confirmed | Eng + copy |
| D6 | **P2** | "Adjust inputs" lands on last wizard step | `goBack` explicitly navigates to `getLastWizardStep()` | Confirmed | Eng |
| D7 | **P2** | "Use this plan" CTA overlaps Peak/Taper cards | Sticky CTA is a flex sibling outside the scroll region; scroll area reserves no bottom space | Confirmed | Eng |
| D8 | **P3** | Day chips unsorted (Sun/Thu/Tue/Fri) | `Object.entries(week.sessions)` insertion order, no day-index sort (ceremony card) | Confirmed | Eng/cosmetic |
| D9 | **P3** | Session title truncates "Long ea…" | CSS ellipsis on a too-narrow flex child; label is "Long easy" | Confirmed | Eng/cosmetic |
| D10 | **P3** | Dead whitespace above phase cards | Conditional cards collapse out but stacked `marginTop:20px` + null-card margins remain | Likely | Eng/cosmetic |

Additional (not in the brief, surfaced by the DB): **A1 — enrichment produced invalid plans 3×** (`plan_enrich_failed` / `post_enrich_invalid`). See §Additional Finding.

---

## 3. Engineering defects — detail

### D1 — P0: "Creating account…" never resolves

**Symptom:** After submitting signup, the button stays on "Creating account…" indefinitely. The account is created in Supabase and the user can later sign in.

**Call path:** `app/auth/login/page.tsx` → `handleEmail` (line 172) → signup branch (lines 182–190). Loading-driven label at lines 418–420.

```tsx
// app/auth/login/page.tsx:172–191
async function handleEmail(e) {
  e.preventDefault()
  setLoading(true); setError(null); setMessage(null)
  if (mode === 'signin') { ... }
  else {
    const { error } = await supabase.auth.signUp({           // 183 — only { error } destructured
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false); return }  // 187
    setMessage('Account created. Check your email.')          // 188 — wrong copy under auto-confirm
    setLoading(false)                                          // 189
  }
}
```

**Root cause (two layers):**
1. **No error/timeout guard (Confirmed).** `handleEmail` has no `try/catch/finally` and no timeout. `setLoading(false)` only runs if the awaited `signUp` **resolves**. If the promise rejects (network drop, or — per project memory — a native Capacitor webview cookie-write stall) or hangs, `loading` is never cleared and no error is shown (the `if (error)` branch only handles a *resolved* result carrying an error, not a rejection). The server row is written before the client settles → "account created but stuck." This is the exact symptom.
2. **Auto-confirm path ignores the session (Confirmed, distinct bug).** DB shows auto-confirm is ON, so `signUp` returns a live `session` and `@supabase/ssr` persists cookies. This code destructures only `{ error }` (line 183), shows "Check your email." (line 188 — there is no email), and **never navigates to `/dashboard`.** Even on the *happy* path the user is silently signed in but left on the login screen.

**Confidence:** Confirmed that there is no `finally`/timeout/catch and that the session is ignored. **Likely** on the precise hang trigger (rejection vs. never-settling promise). **What would settle it:** a client console / Vercel log showing whether `signUp` threw, and whether the repro is web or native (Capacitor). Native is the prime suspect given the cookie-persistence memory.

**Proposed fix (for review):** wrap in `try/catch/finally` (clear `loading` in `finally`); on a returned `session`, hard-navigate to `/dashboard` (mirror the sign-in branch at line 181); fix the auto-confirm copy; consider an await timeout. **Blast radius:** `handleEmail` also serves the sign-in branch (line 176–181) — keep that hard-nav intact. The `/auth/callback` route and `emailRedirectTo` are only exercised if email confirmation is re-enabled; verify both configs. Sign in with Apple/Google paths are separate handlers — unaffected.

**Docs/contracts:** none broken; add a note to `docs/canonical/ux-principles.md` State Coverage (error state of a submit must always resolve). No coaching involvement.

---

### D2 — P0: `has_onboarded` never flips (Problem A)

**Symptom:** User completes plan generation, a `plans` row is written, but `has_onboarded` stays `false` (and `orientation_seen` false). Reproduced exactly in the DB snapshot.

**The flip exists in exactly one place** — `app/dashboard/DashboardClient.tsx:1391–1398`:

```tsx
async function dismissWelcome() {
  setShowWelcome(false)
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('user_settings').upsert({ id: user.id, has_onboarded: true, updated_at: ... })  // 1396
  } catch {}   // swallows everything, result ignored
}
```

**Root cause (Confirmed): the only caller is dead code.** `dismissWelcome` is wired solely to the retired Welcome screen's dismiss button (`DashboardClient.tsx:1817`, inside `if (showWelcome)` at 1784). But `showWelcome` initialises `false` (line 240) and its only set-true trigger is commented out:

```tsx
// DashboardClient.tsx:997–1000
// Welcome screen retired per brand-product-alignment v2 — migration complete.
// if (!data?.has_onboarded && loadedPlan.weeks.length > 0) {
//   setShowWelcome(true)
// }
```

So `showWelcome` can never become true → the Welcome screen never renders → `dismissWelcome` is never invoked → **`has_onboarded` is never set to `true` for anyone onboarding through the current flow.** The live finalise path `handlePlanSaved` (line 1400–1415) calls `savePlanForUser` (which writes `plans`/`plan_archive`/`plan_weekly_notes` only — `lib/plan.ts:86–174`) and sets orientation, but **never touches `has_onboarded`.** That is the 9-of-14 leak.

**Secondary (Confirmed) hardening gaps on the write itself, once relocated:**
- It uses the cookie/browser client and does **not** check `.error`; wrapped in `try {} catch {}` that swallows failures. Per project memory, the cookie client has no session on native → RLS silently blocks the write. So even when reached it can fail silently.
- `orientation_seen` (line ~1851) has the identical fire-and-forget shape (`void supabase...upsert`), which explains `orientation_seen=false` in the DB.
- **No telemetry.** `recordOpsEvent` (`lib/ops/recordOpsEvent.ts`) is not called on this path — a skipped/failed flip is invisible. This is why the handover saw "no save failure."

**Confidence:** Confirmed. Single write site, dead-caller chain, and commented-out trigger are all directly visible.

**Proposed fix (for review):** move the `has_onboarded: true` write into the live finalise path (`handlePlanSaved`, after `savePlanForUser` succeeds); check `.error`; on native use a service-role-backed API route (not the RLS-blocked cookie client); record an ops_event on failure. **Blast radius:** `handlePlanSaved` is the single plan-save finalise; `savePlanForUser` is called elsewhere (re-saves/reshapes) so the flip belongs in `handlePlanSaved`, not inside `savePlanForUser`, to avoid re-flipping on every reshape. Any gate elsewhere that reads `has_onboarded` to decide routing must be checked (grep shows it's read in DashboardClient load). **Consider a one-off backfill** for the 9 affected users (SQL below — for your review, do not run):

```sql
-- REVIEW ONLY — do not execute. Backfill has_onboarded for users who have a saved plan but the flag never flipped.
-- Scope-check the count first, then decide.
update public.user_settings us
set has_onboarded = true, updated_at = now()
where us.has_onboarded is not true
  and exists (select 1 from public.plans p where p.user_id = us.id);
```

**Docs/contracts/invariants:** worth adding an invariant/telemetry note — "plan saved ⇒ has_onboarded true" is an onboarding invariant currently unenforced. Add to `docs/canonical/` onboarding notes and consider an ops_event contract. No coaching involvement.

---

### D3 — P1: Orientation zone cards render `—` for all five zones

**Symptom:** All five zone cards show an em-dash instead of a bpm range; footnote correctly says max HR 185.

**The original hypothesis ("Karvonen needs resting+max; user has max only") is REFUTED** — the DB shows `resting_hr=51` AND `max_hr=185`. `zone_boundaries` being null and `date_of_birth` being null are **red herrings**: this surface computes zones live and is not gated on either.

**Call path & real root cause (Confirmed):** `OrientationScreen` (`app/dashboard/DashboardClient.tsx` ~2352) renders each card's range at line **2536**:

```tsx
{hr ? `${hr.minHR}–${hr.maxHR}` : '—'}          // 2536
// zones is null when haveHR is false:
const haveHR = restingHR != null && maxHR != null && maxHR > restingHR   // 2449
const zones  = haveHR ? calculateZones(restingHR!, maxHR!) : null         // 2450
```

`restingHR`/`maxHR` here are the OrientationScreen **props**, fed from DashboardClient **React state**, which is only populated from `user_settings` **at mount** (lines 959–960: `if (data?.resting_hr) setRestingHR(...)`). On the **wizard path**, HR is collected into `plan.meta` only (`GeneratePlanScreen.tsx:672–673`) — the generate-plan route does **not** write `resting_hr`/`max_hr` back to `user_settings`, and `handlePlanSaved` never calls `setRestingHR/setMaxHR`. So a user who supplies HR through the wizard reaches orientation **in the same session** with DashboardClient state still `null` → `haveHR` false → all five cards `'—'`. The footnote reads `plan.meta.max_hr` (correct = 185), which is exactly why the footnote is right while the cards are blank — a clean confirmation of the source mismatch.

`calculateZones` (`DashboardClient.tsx:10503–10510`) is a pure Karvonen calc that always returns 5 numeric bands given resting+max; it is not the failure. (A separate `karvonenBand()` in `lib/coaching/zoneRules.ts:51–63` returns null on missing input, but is not on this path.) There is **no %max-HR fallback** on the orientation cards — they binary-gate on `haveHR` and drop straight to `'—'`.

**Confidence:** Confirmed on the code path. The DB corroborates: `user_settings.updated_at` (07:08:28) is *after* plan save (07:06:40), i.e. HR reached `user_settings` after orientation was shown — which is why the DB now shows 51/185 while the screen showed em-dashes. **One residual open question (Unverified):** *what* wrote HR to `user_settings` at 07:08:28, since the generate-plan route doesn't. Likely a later Profile/Me edit or HealthKit. Does not change the defect; settle by checking the Me-screen save path if you want the full picture.

**Empty-state check vs `docs/canonical/ux-principles.md` (State Coverage Requirement, ~lines 94–106):** *"Empty | Explain the state. Provide a next step if one exists… A screen that does not handle its empty or error state is not shipped."* Five naked em-dashes with no explanation and no next step **fails** this. Worse: the fallback prompt copy (lines 2593–2601) only renders when `!haveHR && !plan.meta.hr_zone_method` — but this user *has* `hr_zone_method` set, so even that prompt is suppressed.

**Proposed fix (for review):** have OrientationScreen derive its HR from `plan.meta.resting_hr`/`plan.meta.max_hr` (the just-generated source of truth), falling back to DashboardClient state; OR write HR to `user_settings` in the generate-plan finalise so state hydrates. Add a real empty state per ux-principles if HR genuinely absent. **Blast radius:** `restingHR`/`maxHR` DashboardClient state feeds other surfaces (zone displays, coaching) — changing its hydration source affects those; prefer fixing OrientationScreen's read rather than the global state. Check the Me/Profile HR editor and any zone rendering that also reads this state. **Class: Engineering** (source-of-truth wiring), not coaching.

---

### D4 — P1: Selected long-run day ignored in the Foundation (W-1) week

**Symptom:** User picked Sunday. Generated W-1 "Foundation" = Mon/Tue/Wed easy 5km + Thu long 15km, Fri/Sat/Sun empty. Summary cards correctly show Sun/Thu/Tue/Fri — preference captured & rendered, but not applied to session placement.

**Confirmed: two entirely separate code paths, defect isolated to the Foundation generator.**
- **Main weeks (n≥1)** are built **server-side** by `generateRulePlan()` in `lib/plan/ruleEngine.ts` (via `app/api/generate-plan/route.ts:58`). It **respects** the preference — `ruleEngine.ts:1892–1895`:
  ```ts
  const longDayPref = input.preferred_long_run_day === 'sat' ? ['sat','sun','fri'] : ['sun','sat','fri']
  const longDay = firstAvailableDay(longDayPref, blocked) ?? 'sun'
  ```
- **Foundation weeks (n≤0)** are built **client-side** by `generateFoundationBlock()` in `lib/plan/foundationBlock.ts`, called from `GeneratePlanScreen.tsx:718` & `:788`, then prepended to the server weeks (`GeneratePlanScreen.tsx:723`). Its placement logic **ignores** the preference — `foundationBlock.ts:80–84`:
  ```ts
  const trainingDays = DEFAULT_DAYS.filter(d => !blocked.has(d)).slice(0, daysAvailable)  // Mon-first
  // Place long run on the last training day
  const longDay = trainingDays[trainingDays.length - 1]   // = 'thu' for daysAvailable=4
  ```

The preference is **not dropped in transit** — `input` (carrying `preferred_long_run_day`, type at `types/plan.ts:58`) reaches `generateFoundationBlock`, which then calls `buildFoundationSessions(weeklyKm, longRunKm, input.days_available ?? 4, input.days_cannot_train ?? [])` (`foundationBlock.ts:170–175`) — passing only the **count** of days and blocked days, never `preferred_long_run_day` nor the actual chosen day-set. The function has no parameter for it. So W1 ("Base — easy start") correctly lands the long run on Sunday while W-1 Foundation does not. The doctrine comment at `foundationBlock.ts:66–67` even documents the intended-but-unimplemented behaviour ("Long run placed on the last available training day (usually Sat/Sun)").

**Confidence:** Confirmed.

**Proposed fix (for review):** thread `preferred_long_run_day` (and ideally the actual selected training days, not just the count) into `buildFoundationSessions`, and place the long run using the same `firstAvailableDay(longDayPref, blocked)` logic as `ruleEngine.ts` — ideally by **extracting that day-placement into a shared helper** so the two paths can't drift again. **Blast radius:** `foundationBlock.ts` is consumed only on the client wizard path (`GeneratePlanScreen.tsx`); its output feeds the prepended weeks and any Foundation-week rendering/validation. `buildFoundationSessions` also sets session `type: 'easy'` and label "Long easy" (line 87–88) — see D9. **This is an engineering fix** (placement wiring). *However*, note the adjacent coaching-logic gap in §Coaching-1 (foundation has no spacing rule at all) — the placement fix alone will move the long run to Sunday but won't fix consecutive-day clustering.

**Docs/contracts/invariants:** the singularity doctrine (CLAUDE.md → Configuration Singularity; ADR-009) argues day-placement logic should have one owner — extracting a shared helper aligns with that. If placement moves, re-run `scripts/property-validate-plans.ts` / `validatePlan()` to confirm no invariant regressions on foundation weeks.

---

### D5 — P2: "Kit needs your runs to do anything useful" dead-end

**Symptom:** Onboarding screen states "Kit needs your runs…", coach "Kit" never introduced, Continue doesn't say what it triggers, no skip path.

**Screen:** `ConnectRunsScreen`, `app/dashboard/DashboardClient.tsx:2630–2798`. Copy from `BRAND.connect.*` (`lib/brand.ts:110–113`): `ask: "Kit needs your runs to do anything useful."`, `subline: "Without them, he's coaching blind."`. Flow position (Confirmed): **Orientation → Connect Runs → Push permission** (documented at `DashboardClient.tsx:2800–2801`); rendered as early-return at `:1863–1893`, gated `showConnectRuns` (fires only when `connect_runs_seen` is exactly `null` AND native — `:1636–1642`).

**What "Continue" does (`:2738–2766`):** onClick = `connectHealthKit` (`:2646`) → `requestHealthKitAuth()` → triggers the **iOS HealthKit permission dialog** → on grant upserts `healthkit_connected_at` + `connect_runs_seen:true`. Button label is the bare word **"Continue"** (`:2765`) — no statement that it opens Apple Health.

**Three confirmed issues:**
1. **Unlabelled CTA** — "Continue" doesn't state it triggers the Apple Health prompt.
2. **Skip hidden until after the tap** — the "Connect later" skip (`:2778–2793`, `skip()` → `connect_runs_seen:false`) is gated on `permissionAsked` (`:2777`), which only flips true *after* `requestHealthKitAuth()` runs (`:2652`). So the **first frame has no visible exit** — a dead-end until the user taps Continue. (Comments at `:2642–2643`, `:2774–2776` show this is a deliberate Apple 5.1.1(iv) compliance choice, but the UX reads as a dead end.)
3. **Persona/name collision** — the screen is entirely about **Apple HealthKit** (`connectHealthKit`, `requestHealthKitAuth`, `healthkit_connected_at`), while the copy personifies the coach as **"Kit"** (also `:11966` "Kit reads here. He needs your runs first"). "Kit" (coach) vs "HealthKit" (Apple) collide, and "Kit" is never introduced before this screen asks for trust. Header is just `BRAND.voiceAnchor` ("Hold the zone.") + wordmark.

**vs. no-dead-ends principle** (`docs/canonical/ux-principles.md:63`): *"There must be no dead ends. Every question has a sensible default."* The first frame violates the visible expectation.

**Confidence:** Confirmed. **Class: Engineering + copy** (flow logic works; gaps are unlabelled CTA, hidden-until-after skip, uncredited persona). **Copy changes touch `lib/brand.ts`** (`BRAND.connect.*` are locked-ish brand strings) → route wording through the brand owner, not ad-hoc. **Blast radius:** `BRAND.connect.ask` is also duplicated inline in `components/strava/StravaPanel.tsx:121` (admin-only) — if copy changes, update both or de-duplicate. Making the skip always-visible must preserve the Apple 5.1.1(iv) intent (don't force the permission).

---

### D6 — P2: "Adjust inputs" returns to the final wizard step, not the first

**Symptom:** From the preview, "Adjust inputs" drops the user on the last wizard step.

**Confirmed — it's explicit, not incidental.** `app/dashboard/GeneratePlanScreen.tsx`: single unified step state `appStep` (`:403`, initial `'distance'`). The "Adjust inputs" `BackBtn` (`:866`) → `goBack` (`:564–571`), preview branch at `:566`:

```tsx
if (appStep === 'preview') { navigateTo(getLastWizardStep(), 'back'); return }   // 566
function getLastWizardStep() { const seq = getStepSequence(...); return seq[seq.length - 1] }  // 573–576
```

It deliberately navigates to the **last** wizard sub-step (`constraints` free / `injuries` paid). Same pattern on the error screen "Try again" (`:851`). Field values are independent `useState` and are correctly preserved; only the *landing step* is forced to the end. The `zona_wizard_draft` restore (`:501–503`) only affects fresh mounts, not this in-session tap — it is not the cause here.

**Confidence:** Confirmed. **Class: Engineering.** **Proposed fix (for review):** decide the intended behaviour — if "Adjust inputs" should mean "review from the top", navigate to `sequence[0]`/`'distance'`; if it means "one tweak then regenerate", the current last-step behaviour is arguably intentional and the *label* is the bug. **This is a product/UX decision, not purely mechanical** — flag for your call. **Blast radius:** `getLastWizardStep()` is also used by the error-screen retry (`:851`); changing `goBack` shouldn't touch that path.

---

### D7 — P2: "Use this plan" CTA overlaps Peak/Taper cards

**Symptom:** Sticky "Use this plan" CTA renders over the last (Peak, Taper) phase cards.

**Confirmed — flexbox, not z-index.** `GeneratePlanScreen.tsx`: phase cards list `:906–915`; sticky CTA `:918–943` (`position: sticky; bottom: 0`). The CTA is a **sibling** of the scroll container (`:877`, `flex:1; overflowY:auto; padding:'0 20px'`), not a child. A `position: sticky` element only reserves space within *its own* scroll container; since the CTA lives outside the `overflowY:auto` div, that scroll area reserves **no bottom space**, so the last cards scroll underneath it. The outer column's `paddingBottom:'40px'` (`:864`) pads the flex column, not the inner scroll region, so it doesn't clear the cards either.

**Confidence:** Confirmed. **Class: Engineering (layout).** **Proposed fix (for review):** add `paddingBottom` (or a spacer) to the scroll container (`:877`) ≈ CTA height (`~72px+` incl. safe-area), or move the CTA inside the scroll container as a sticky child. **Blast radius:** localized to the preview screen; verify on iOS safe-area (the CTA already uses `env(safe-area-inset-bottom)`).

---

### D8 — P3: Day chips unsorted (Sun/Thu/Tue/Fri)

**Confirmed.** `components/GeneratingCeremony.tsx:83` builds `sessionDays` from `Object.entries(week.sessions ?? {})` (insertion order) and maps them at `:112–125` with **no sort**. The rule engine inserts the long run (Sunday) first (`ruleEngine.ts:1904/1933`), so Sunday leads. The real Plan screen (`DashboardClient.tsx:6456`) and `PlanCalendar.tsx:961` both iterate a fixed `DOW_ORDER` and are correctly sorted — only the ceremony card is unsorted. **Fix:** sort `sessionDays` by day index. **Blast radius:** ceremony card only.

### D9 — P3: Session title truncates "Long ea…"

**Confirmed.** `DashboardClient.tsx:12432–12438` header uses CSS `overflow:hidden; textOverflow:ellipsis; whiteSpace:nowrap` on a width-constrained flex child; the full label is `"Long easy"` (`foundationBlock.ts:88`), truncated when competing with the right-aligned type chip (`:12441`). Not JS truncation. **Fix:** give the title flex room / reduce competing chip width, or shorten the label. **Blast radius:** same ellipsis pattern at `DashboardClient.tsx:2527, 4695, 11357` — check those aren't also clipping.

### D10 — P3: Dead whitespace above phase cards

**Likely.** `GeneratePlanScreen.tsx:902` (`PreviewPhaseStrip` wrapper `margin:'20px 0 0'`) + `:906` ("Plan shape" block `marginTop:20px`) stack; amplified on FREE/`comfortable` plans where the in-between cards (`DifficultyCard :879`, ConfidenceBadge `:880/881` gated on non-null score, `coach_intro :887`) render null but their surrounding top-margins remain. **Fix:** collapse margins / conditionally render spacing only when a card is present. **Confidence:** Likely (visual reasoning, not runtime-measured) — settle by inspecting the rendered DOM for a FREE 10K plan. **Blast radius:** preview screen spacing only.

---

## 4. Additional finding (not in brief) — A1: enrichment produced invalid plans 3×

The DB shows **three `plan_enrich_failed` / `post_enrich_invalid`** ops_events for this user before the plan saved:

| Time | Codes |
|---|---|
| 07:03:28 | `INV-PLAN-RACE-SPECIFIC-EXPOSURE` ×2 |
| 07:06:15 | `INV-PLAN-RACE-SPECIFIC-EXPOSURE` ×2 |
| 07:06:20 | `INV-PLAN-COPY-MATCHES-SESSIONS`, `INV-PLAN-RACE-SPECIFIC-EXPOSURE` ×2 |

Per ADR-006 (hybrid generation) enrichment failure is **silent** — the rule-engine plan is returned unchanged, so the user still got a plan. But three consecutive validation failures on a plain 10K means the **AI enricher is producing output that violates `validatePlan()`** (`INV-PLAN-RACE-SPECIFIC-EXPOSURE`, `INV-PLAN-COPY-MATCHES-SESSIONS`). Consequence for this user: **no AI voice/coaching copy on their plan** — the paid/trial enrichment silently no-op'd.

- **This contradicts the handover's "zero ops_events" for the cohort** — worth reconciling (evidence gap 2).
- **Confidence:** the failures are Confirmed from the DB; the *reason* the enricher violates these invariants is **Unverified** — needs a trace of the enrich path (`lib/plan/enrich*`, the invariants named) against a 10K trial input. Recommend a follow-up investigation.
- **Class:** likely engineering (enricher output) but the invariants it trips are coaching-doctrine — route via the debug pipeline first, then the Coaching Board only if the *invariant* is what's wrong.

---

## 5. Coaching-logic recommendations — SIGN-OFF REQUIRED, no changes made

These describe current behaviour only. **Do not implement without your approval; correctness-affecting ones convene the Coaching Board (ADR-017).**

### Coaching-1 — Session spacing (4 runs on 4 consecutive days, 15km long run after 3 easy days)
- **Main engine HAS spacing doctrine** (CoachingPrinciples §7): `generationConfig.ts:640–653` (`MIN_HOURS_BETWEEN_QUALITY: 48`, `..._QUALITY_AND_LONG: 48`, `..._LARGEST_SESSIONS: 48`); placement heuristic `ruleEngine.ts:2174–2178` ("pick the day whose min gap to placed hard days is largest"); enforced by `invariants.ts:143–162` (`findQualityLongSpacingViolations`, applied `:808–812`) + `INV-PLAN-LARGEST-SESSIONS-SPACED`.
- **The Foundation path has NO spacing logic at all.** `buildFoundationSessions` (`foundationBlock.ts:73–114`) places easy runs on consecutive Mon-first days and the long run last, no gap heuristic. Because every foundation session is typed `easy` (even the long run, labelled "Long easy", `:87–88`), the §7 hard/quality-spacing rules **do not target it** and no easy-run distribution rule exists. This is why the observed week clusters 4 consecutive run days + a 15km long run right after 3 easy days.
- **Recommendation (for the board):** decide whether Foundation weeks need a spacing/rest-distribution rule, and whether a 15km "easy" long run so early is appropriate for a 10K plan. Fixing D4 (placement) will move the long run to Sunday but will **not** de-cluster the easy days on its own.

### Coaching-2 — Build peak 46km == Peak peak 46km, but Peak copy says "Highest volume"
- **By design, Peak does NOT add volume over Build.** `ruleEngine.ts:529–545`: every non-deload week multiplies toward a single ceiling `peakKm` and is clamped to it (`:541`); in the peak phase growth is *halved* (`:540`, `1 + (allowance-1)/2`). Once Build reaches `peakKm`, Peak sits at the identical clamped value → 46/46. Peak's real distinction is race-specific intensity/long-run sharpening, not higher volume.
- **The copy is the mismatch:** `PHASE_DESCRIPTION.peak = "Highest volume. Race-specific sharpening."` (`GeneratePlanScreen.tsx:223`) is inaccurate on the volume claim.
- **Recommendation:** either (a) fix the copy to describe sharpening rather than volume (a copy change, brand — not the board), or (b) if you actually want Peak to exceed Build in volume, that's a **curve change → Coaching Board**. Your call which.

### Coaching-3 — Phase labelling: single week ("W3/W7") vs ranges ("Weeks 1–4")
- Two different surfaces, each internally consistent — **not a bug in either**:
  - Ranges: plan-preview phase-summary cards, `GeneratePlanScreen.tsx:285` (`Weeks 1–4`), rendered `:302`.
  - Single week: the GeneratingCeremony reveal card, `components/GeneratingCeremony.tsx:99` (`· W{week.n}`), which deliberately samples one representative week per phase (`getRepWeeks`, `:143–150`).
- **Recommendation:** cosmetic/UX-consistency decision — pick one convention if the cross-surface difference bothers you. Not correctness.

---

## 6. Priority-ordered defect list (recap)

**P0 (blockers):** D1 signup hang · D2 has_onboarded leak
**P1 (broken core UX):** D3 zone cards em-dash · D4 long-run day ignored
**P2 (bad UX, not blocking):** D5 Kit dead-end · D6 adjust-inputs step · D7 CTA overlap
**P3 (cosmetic):** D8 chip sort · D9 title truncation · D10 whitespace
**Follow-up:** A1 enrich failures (needs its own trace)
**Coaching (sign-off):** Coaching-1 foundation spacing · Coaching-2 peak volume copy/curve · Coaching-3 phase labelling

---

## 7. Proposed release grouping (one release shipped fully before the next)

**Release 1 — "Onboarding completes" (P0, ship alone).** D1 + D2. These are the two silent-failure blockers and share a family (unguarded Supabase calls, no telemetry). Ship together with the backfill SQL (D2) and add ops_events on both paths so the next leak is visible. Must ship alone — everything else depends on users actually getting through onboarding.

**Release 2 — "Plan is correct" (P1).** D3 (zone HR source) + D4 (foundation long-run day). Both are plan-generation correctness and both touch the wizard→plan handoff; naturally co-located. D4's shared-helper extraction pairs with re-running plan invariants. *Coaching-1 (foundation spacing) is a candidate to bundle here* only if the board signs off in time — otherwise D4 ships as placement-only and Coaching-1 follows.

**Release 3 — "Onboarding feels finished" (P2).** D5 + D6 + D7. All onboarding/wizard/preview UX polish, no engine involvement, can be one frontend-design pass. D5 needs a brand/copy decision (BRAND.connect.*) and preserves Apple 5.1.1(iv); D6 needs your product call on intended back behaviour.

**Release 4 — "Cosmetic sweep" (P3).** D8 + D9 + D10. Low-risk, bundle together, ship last.

**Separate track — A1 (enrich failures)** and the **Coaching recommendations**: not releases yet — A1 needs a trace, coaching items need your sign-off / board. Don't couple them to the above.

---

## 8. Docs / contracts / invariants impacted

| Defect | Docs / contracts / invariants to update in the fix commit |
|---|---|
| D1 | `docs/canonical/ux-principles.md` (State Coverage — submit must always resolve); verify Supabase auth config (auto-confirm, `/auth/callback`) |
| D2 | New onboarding invariant "plan saved ⇒ has_onboarded true"; ops_event contract for the flip; `docs/contracts/` if a new service-role route is added; update onboarding notes; backfill recorded in an incident write-up (`docs/incidents/`) |
| D3 | `docs/canonical/ux-principles.md` (real empty state); OrientationScreen prop contract if HR source changes (`docs/contracts/`) |
| D4 | ADR-009 / Configuration Singularity (shared day-placement helper); re-run `scripts/property-validate-plans.ts` + `validatePlan()`; `docs/canonical/plan-invariants.md` if an invariant is added; **not** a coaching-doctrine edit (defect fix restoring documented intent per `foundationBlock.ts:66–67`) |
| D5 | `lib/brand.ts` `BRAND.connect.*` (brand owner); de-dupe with `components/strava/StravaPanel.tsx:121`; `docs/canonical/ux-principles.md` no-dead-ends |
| D6 | `docs/contracts/` GeneratePlanScreen behaviour note (intended "Adjust inputs" semantics) |
| D7, D10 | none (layout); `docs/canonical/ui-patterns.md` sticky-CTA footer-padding pattern worth documenting |
| D8, D9 | none |
| A1 | follow-up incident write-up; possibly `plan-invariants.md` if an enricher invariant is at fault |
| Coaching-1/2/3 | Coaching Board (ADR-017) for correctness changes; `CoachingPrinciples.md` §, `GENERATION_CONFIG`, `validatePlan()` if any is ratified; Coaching-2 copy-only + Coaching-3 are brand/UX, not the board |

---

*End of Phase 0 audit. No code, files, migrations, or deploys were changed. The one SQL block (D2 backfill) is presented for review only and was not executed.*
