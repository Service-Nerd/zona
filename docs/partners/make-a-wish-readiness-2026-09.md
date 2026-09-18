# Make-A-Wish UK: readiness and product brief

**Prepared:** 2026-09-18 · **Repo state:** `main` @ `2dcfa44` · **Assessment only, nothing was changed.**

**Scope of the proposal:** ~500 Make-A-Wish UK runners for the 2027 London Marathon get full paid-tier
access (including AI enrichment) via the existing access-code flow, roughly October 2026 to race week
April 2027. iOS only. Apple Health is the system of record. List price £7.99/month.

**Method:** every claim below was traced to code, config, a live Supabase query, or a live HTTP check.
Where a fact lives outside the repo (App Store Connect, Anthropic Console, Vercel billing, Apple
Developer) it is marked **UNVERIFIED** with the place to check. Figures I derived rather than measured
are labelled as estimates with the arithmetic shown.

---

## A. Executive summary

The product side is ready: the charity access-code mechanism is fully built, tested and deployed
(`charity_batches` / `charity_codes`, `POST /api/charity/redeem`, `RedeemCodeScreen`, three in-app entry
points), a redeemed code resolves to the same `paid` tier as a subscription through a single owner
(`resolveTier`), and the grant auto-extends to race day plus seven days when the runner saves a plan, so
nobody loses access mid-block. Twenty-six API routes enforce the tier server-side. The marathon distance
is paid, and a comped runner passes that gate. The infrastructure side is not ready: **Vercel is on the
Hobby plan, which Vercel's own fair-use terms restrict to non-commercial personal use**, and Zonna sells a
subscription, so the account is out of compliance today and would be running a 500-person partnership on
it. **Supabase is on the Free plan**, whose 500 MB database ceiling is projected to break somewhere around
250 to 320 active runners, whose 5 GB monthly egress allowance is the next thing to bind, and which
includes **no backups at all**. Both are fixed for about $45/month combined. AI cost is not a
concern: roughly $2.50 per runner across the seven months, so £1,250 at full redemption. The residual
risks are three privacy-policy gaps (Anthropic receives the runner's first name and injury history, and
the email provider Resend is not disclosed), one admin reporting view that does not know charity grants
exist, and the fact that there is no per-partner reporting at all.

---

## B. GO / NO-GO

**CONDITIONAL GO.** Not safe on current plans: move Vercel to Pro (a terms-of-service requirement, not a
capacity one) and Supabase to Pro (500 MB database ceiling and zero backups) before codes go out.
Everything else on the critical list is hours of work, not weeks.

---

## C. Capacity table

Assumption for "at 500": a runner doing a 28-week block at four logged runs a week, redeeming Oct 2026.
Per-runner storage is derived from measured per-row sizes in production (`pg_total_relation_size` ÷ rows),
which include indexes and TOAST: activities 4.3 KB/row, run analysis 1.5 KB, completions 0.78 KB, health
samples 0.62 KB, notifications 0.75 KB, weekly reports 6.5 KB, plans ~12 KB. That comes to **~1.5 MB per
runner per block**; I use a 1.5–2.0 MB band below.

| Limit | Current | At 500 (100%) | At 500 (30%, =150) | Breaks? | Fix | Cost |
|---|---|---|---|---|---|---|
| Supabase DB size (Free: 500 MB) | **15 MB**, 3.2 MB of it table data | 765 MB – 1.02 GB | 240 – 315 MB | **YES at 100%.** Breaks at ~250–320 active runners | Supabase Pro (8 GB) | $25/mo |
| Supabase egress (Free: 5 GB/mo) | Not measured in repo (**UNVERIFIED**, see Supabase dashboard → Usage) | ~3 GB/mo est. (500 × 20 opens × ~300 KB) | ~0.9 GB/mo | **Marginal at 100%** (~60% of cap) | Pro (250 GB) | included |
| Supabase auth MAU (Free: 50,000) | **26** | 526 | 176 | No | — | — |
| Supabase file storage (Free: 1 GB) | **0** (no storage bucket used) | 0 | 0 | No | — | — |
| Supabase compute (Free: shared CPU, 500 MB RAM) | Adequate | Untested at this size | Untested | **Likely** at 100% | Pro includes Micro instance | included |
| Supabase pooler connections | Not a factor: the app talks PostgREST over HTTP, not direct Postgres | — | — | No | — | — |
| Supabase backups (Free: **none**) | **None** | **None** | **None** | **YES, today** | Pro = 7-day backups | included |
| Supabase project auto-pause (Free: after 7 days idle) | Live risk in the pre-launch gap | n/a | n/a | Pre-launch only | Pro never pauses | included |
| Vercel plan terms (Hobby = non-commercial only) | **Hobby**, app sells £7.99/mo | Violation | Violation | **YES, today** | Vercel Pro | $20/mo |
| Vercel function invocations (Hobby: 1M/mo) | Low | ~150k/mo est. | ~45k/mo | No | — | — |
| Vercel Active CPU (Hobby: 4 hrs/mo) | Low | < 1 hr est. | < 1 hr | No | — | — |
| Vercel Provisioned Memory (Hobby: 360 GB-hrs/mo) | Low | ~40–70 GB-hrs est. | ~15 GB-hrs | No | — | — |
| Vercel function max duration (Hobby 60 s / Pro 300 s) | Plan enrichment measured at **28–35 s** (code comment, `generate-plan/route.ts:234`) | Same | Same | **Tight**, no route sets `maxDuration` | Pro raises ceiling to 300 s | included |
| Vercel cron jobs | Already worked around: 1 in `vercel.json`, 6 more moved to GitHub Actions because "Hobby caps at 2 crons" | Same | Same | No | Could consolidate on Pro | — |
| APNs (Apple) | No documented volume cap | ~500 devices, ≤1 push/user/day | ~150 | No | — | — |

**Total additional infrastructure cost, Oct 2026 – Apr 2027 (7 months): $315** ($175 Supabase + $140 Vercel).

---

## D. AI cost table

Every call path that exists in the shipped app. Models are pinned in `lib/ai/models.ts`: Haiku 4.5
($1 / $5 per MTok in/out), Sonnet 4.5 ($3 / $15). Output ceilings are the literal `max_tokens` in each
route. **Input token counts are estimates** derived from prompt-file sizes and payload shape, not from
measured production usage: nothing in the app records `usage.input_tokens`, so the only ground truth is
the Anthropic Console (**UNVERIFIED**, see Console → Usage).

Frequency column assumes a 28-week block, four runs a week, opening the app five days a week.

| Call path | Model | Est. cost/call | Frequency per runner | Total per runner |
|---|---|---|---|---|
| Plan enrichment (`lib/plan/enrich.ts`) | Haiku | $0.042 | 3 (initial + 2 regenerations) | $0.13 |
| Daily coach note (`/api/daily-coach-note`) | Haiku | $0.003 | ~140 (cached 1/day) | $0.41 |
| Run analysis (`/api/analyse-run`) | Haiku | $0.004 | ~112 (1 per linked run) | $0.45 |
| Post-run reframe (`/api/post-run-reframe`) | Sonnet | $0.020 | ~28 (1/week) | $0.55 |
| Weekly report (`/api/weekly-report`) | Sonnet | $0.015 | 28 (1/week) | $0.42 |
| Plan adjust / reshape (`/api/adjust-plan`) | Sonnet | $0.008 | ~28 | $0.23 |
| Plan weekly note (`/api/plan-weekly-note`) | Haiku | $0.003 | 28 (cached 1/week) | $0.09 |
| Aerobic trend (`/api/coaching/trend`) | Haiku | $0.001 | ~28 (not cached) | $0.04 |
| Post-race reshape (`/api/post-race-reshape`) | Sonnet | $0.043 | 1 | $0.04 |
| Phase summary (`/api/phase-summary`) | Sonnet | $0.006 | ~3 | $0.02 |
| Maintenance block enrichment | Haiku | $0.018 | 1 | $0.02 |
| Race readiness (`/api/race-readiness`) | Sonnet | $0.008 | 1 | $0.01 |
| **Total per runner, Oct–Apr** | | | | **~$2.40** |

| Scenario | Runners | Total Oct–Apr | Band |
|---|---|---|---|
| 100% redemption | 500 | **$1,200** | $750 – $2,500 |
| 30% redemption | 150 | **$360** | $225 – $750 |

**Most expensive single call:** plan enrichment. It is the only path with a four- or five-figure output
ceiling (`max_tokens` scales 6,000 / 10,000 / 14,000 by plan length) and the only one that has been
measured taking 28–35 seconds.
**Most expensive path across the block:** post-run reframe and weekly report, jointly. Both run Sonnet
weekly for the whole block, and together they are 40% of the per-runner total.

Two calls are free-tier only and cost nothing here: the first-plan intro line (`lib/plan/freeIntro.ts`)
and the weekly free insight, which returns 400 for any non-free tier.

---

## E. Engineering feature table

Category keys: **FREE_ALWAYS** / **GRANTED_AT_TRIAL_RETAINED_IN_FREE** (kept after access ends) /
**PAID_ONLY_ONGOING**. Source of truth is `lib/plan/featureGates.ts`; the predicate is
`lib/plan/canUseFeature.ts`; tier comes from `lib/trial.ts → resolveTier`.

| Feature | Tier category | Enforced where | Code reference | Discrepancy |
|---|---|---|---|---|
| Plan generation, 5K / 10K / HM | FREE_ALWAYS (`generic_plan_templates`) | API + UI | `planSignatures.ts` `free_tier_available: true` | — |
| Plan generation, Marathon / 50K / 100K | PAID_ONLY_ONGOING (`ultra_plan_generation`) | **API + UI** | `canUseFeature.ts → canGenerateDistance`, `generate-plan/route.ts:114` | Gate constant `ultra_plan_generation` is never read by `isFeatureAllowed`; the real enforcer is `PLAN_SIGNATURES.free_tier_available`. Documented in the file. Behaviour is correct. |
| Reading the plan, all weeks | FREE_ALWAYS (`plan_view`) | UI | `featureGates.ts` | — |
| Regenerating a rule-engine plan | FREE_ALWAYS (`rule_engine_regeneration`) | API | R23-D6 lenient reading | — |
| Manual session completion | FREE_ALWAYS (`manual_session_completion`) | API + UI | `health/ingest/route.ts:48` branches before the paid gate | — |
| Manual run entry (distance/duration/HR) | FREE_ALWAYS | API | `health/ingest/route.ts` manual branch | — |
| Plan difficulty band | FREE_ALWAYS (`plan_difficulty_band`) | Engine meta | SLT-signed FREE 2026-08-18 | — |
| Pace zones from benchmark (VDOT) | GRANTED_AT_TRIAL_RETAINED_IN_FREE (`vdot_pace_zones`) | Engine | `featureGates.ts` | — |
| HR zones (Karvonen) | GRANTED_AT_TRIAL_RETAINED_IN_FREE (`hr_karvonen_zones`) | Engine | `featureGates.ts` | — |
| Existing AI coach notes on the plan | GRANTED_AT_TRIAL_RETAINED_IN_FREE (`ai_coach_notes_existing`) | None needed | retained unconditionally | — |
| Catalogue-sourced sessions on existing plan | GRANTED_AT_TRIAL_RETAINED_IN_FREE (`session_catalogue_full`) | Engine | `ruleEngine.ts:3113` uses `tier !== 'free'` | — |
| Injury adaptations at plan creation | GRANTED_AT_TRIAL_RETAINED_IN_FREE (`injury_adaptations_initial`) | None | applied for every tier by design | Gate `injury_adaptations_new` was **deleted** 2026-09-11 as wrong; engine adapts for all tiers. Correct. |
| Apple Health ingest (runs + recovery) | PAID_ONLY_ONGOING (`activity_intelligence`) | **API** | `health/ingest/route.ts:53`, `health/samples/route.ts` | UI gate is client-side only; API is authoritative. Consequence: **when access ends, run data stops flowing entirely.** |
| Run analysis / score card | PAID_ONLY_ONGOING (`activity_intelligence`) | API | `analyse-run/route.ts:48` | — |
| Daily coach note | PAID_ONLY_ONGOING (`activity_intelligence`) | API | `daily-coach-note/route.ts:41` | — |
| Weekly report | PAID_ONLY_ONGOING (`activity_intelligence`) | API | `weekly-report/route.ts:41` | Route does **not** call the AI rate limiter (`guardAiRequest`/`enforceAiRateLimit`). See M. |
| Pre-run readiness band | PAID_ONLY_ONGOING (`activity_intelligence`) | API | `coaching/prerun-band/route.ts` | — |
| Aerobic trend card | PAID_ONLY_ONGOING (`activity_intelligence`) | API | `coaching/trend/route.ts:41` | — |
| Phase summary | PAID_ONLY_ONGOING (`activity_intelligence`) | API | `phase-summary/route.ts:28` | — |
| Race readiness note | PAID_ONLY_ONGOING (`activity_intelligence`) | API | `race-readiness/route.ts:28` | — |
| Plan weekly note ("week ahead") | PAID_ONLY_ONGOING (`activity_intelligence`) | API | `plan-weekly-note/route.ts:50` | — |
| Dynamic reshape (auto + manual) | PAID_ONLY_ONGOING (`dynamic_reshape_r20`) | API | `adjust-plan`, `confirm-adjustment`, `revert-adjustment`, `recalibrate-zones`, `recalibrate-taper` | — |
| Post-race reshape | PAID_ONLY_ONGOING (`dynamic_reshape_r20`) | API | `post-race-reshape/{route,confirm,revert}` | — |
| AI enrichment on new plans | PAID_ONLY_ONGOING (`ai_coach_notes_new`) | API | `generate-plan/route.ts:190` free branch skips enrichment | — |
| Race time estimates | PAID_ONLY_ONGOING (`race_time_estimates`) | API | `race-times/route.ts` | — |
| Post-run reframe (text/voice reflection) | PAID_ONLY_ONGOING (`post_run_reframe`) | API | `post-run-reframe/route.ts:69` | — |
| Confidence score + coach intro | PAID_ONLY_ONGOING (`confidence_score`) | Engine | `enrich.ts:226` `wantPaidFields = tier === 'paid'` | **Real discrepancy.** `canUseFeature` allows `trial`, but `enrich` requires literal `'paid'`, so a 14-day trial user never gets it. Charity grants resolve to `'paid'`, so **Make-A-Wish runners are unaffected.** |
| Maintenance block coaching | PAID_ONLY_ONGOING (`maintenance_coaching`) | API | `maintenance-block/route.ts:33` | — |
| Strava link/unlink/callback | PAID_ONLY_ONGOING (`activity_intelligence`) | API | `strava/*` routes | Screen is admin-only. See Part 3 Q15. |
| Tailored strength sessions | PAID_ONLY_ONGOING (`strength_sessions_tailored`) | — | `featureGates.ts` "when shipped" | **NOT BUILT.** Excluded from all customer-facing sections. |
| Push registration | FREE | API | `push/subscribe/route.ts` (no tier gate) | Registration is free; the daily send is paid. |
| Daily push notification | PAID | Cron | `push/send-daily/route.ts` "Free tier: no daily push" | — |

**Excluded from the above (not user-facing, disabled, or admin-only):** Strava screen (admin URL only, nav
entry removed); Calendar screen (retired); Welcome screen (retired); smoke tracker (props still plumbed
through `DashboardClient`, no UI entry point); `/api/ops/*` integrity probes; `/api/me/today-heartbeat`;
`/api/discipline-ledger`; `/me-preview`, `/post-run-preview`, `/coach-preview` fixture pages; admin
Supabase views; the waitlist table (0 rows).

---

## F. Customer feature table

Plain English, for the charity to send to runners. Eight rows, benefit-led.

| | Free | Full access |
|---|---|---|
| **Your training plan** | 5K, 10K and half marathon | Adds marathon and ultra distances |
| **The whole plan, visible** | Yes, every week, nothing blurred | Yes |
| **Rebuild it when life changes** | Yes, as often as you like | Yes |
| **A plan that moves when you miss a week** | No | Yes, it reshapes around what you actually did |
| **Your runs read back to you** | Log runs by hand | Runs arrive from Apple Health and get a written read: did you hold the zone, what your heart rate did, and a weekly score |
| **Coaching written for your session** | The plan's own notes | A note for the run in front of you, a daily nudge, and a weekly summary |
| **An honest finish-time estimate** | No | Yes, from your real running, updated as you train |
| **A second opinion after a hard run** | No | Tell it how the run felt and get an honest reframe, or a warning if the pattern says ease off |

---

## G. One sentence: what full access adds

Full access turns a written plan into a coach that reads every run you do, tells you in plain words
whether you held the zone or drifted, and reshapes the weeks ahead when life gets in the way.

---

## H. One sentence: what they keep when access ends

They keep the plan itself and every week of it, their pace and heart-rate zones, and all the coaching
notes already written on it; what stops is the reading of new runs, the reshaping, and the new coaching.

---

## I. Access code: three steps for runners

1. **Download Zonna from the App Store and sign in** with Apple, Google or an email address.
2. **Tap "Have a charity code?"** on the first screen of plan setup, or find "Charity access" on your
   profile later.
3. **Type the eight characters** from your email and tap Redeem. Capitals, hyphens and pasting all sort
   themselves out. Everything switches on immediately, free, and once you set your race date your access
   runs to a week after race day.

---

## J. Privacy summary

Five points a charity can rely on, all verified in code.

- **Runner data stays with Zonna. Make-A-Wish receives nothing.** There is no code path anywhere in the
  app that sends runner data to a partner, and the access-code table stores no runner identity: a code
  row holds a user ID, a claim date and an expiry date, nothing else. The app also never names the charity
  back to the runner.
- **Everything is stored in the EU.** The Supabase project (`Zonna Run`) runs in AWS `eu-west-1`, Ireland.
  Row-level security is on for all 29 tables.
- **Apple Health is read-only and narrow.** Zonna requests six read permissions only: workouts, heart
  rate, resting heart rate, heart rate variability, sleep, and active energy. It never writes to Apple
  Health, and access can be revoked from iOS Settings at any time.
- **The AI coaching sends a runner's training context to Anthropic, and Anthropic does not train on it.**
  What is sent is described honestly in section M, point 2, and the privacy policy needs one correction
  before codes go out.
- **A runner can delete their account and everything in it from inside the app**, in three taps from the
  profile screen. Deletion cascades across all 23 user-linked tables in the database.

---

## K. Onboarding flow

From a cold install to a first session on screen. Tap counts assume the shortest honest path and count
each button press and each field commit as one tap.

| # | Screen | What happens | Taps |
|---|---|---|---|
| 1 | App Store | Install | 1 |
| 2 | Login (`app/auth/login/page.tsx`) | Sign in with Apple, Google, or disclosed email form | 1–2 (Apple/Google) |
| 3 | Plan wizard, step 1: **How far?** | Distance tiles. **"Have a charity code?" sits here** (`GeneratePlanScreen.tsx:1527`) | 1 |
| 3a | *(optional)* **Redeem code** | Enter code, redeem, "Get started" | 3 |
| 4 | Race details | Race name (optional) + date | 2 |
| 5 | Goal | Finish, or a time target | 1 |
| 5a | *(if time target)* Target time | | 1 |
| 6 | **Teaching screen: "This plan will feel too easy at first."** | Interstitial, "Got it" | 1 |
| 7 | Weekly volume | Ruler input | 1 |
| 8 | Longest recent run | Ruler input | 1 |
| 9 | Training age *(skippable)* | | 1 |
| 10 | Recent quality work *(skippable)* | | 1 |
| 11 | Your level | Engine's read, overrulable | 1 |
| 12 | Birth year *(skippable)* | For max-HR estimate | 1 |
| 13 | Benchmark race *(skippable)* | Gives precise paces | 1 |
| 14 | **Teaching screen: "Easy should feel easy."** | Interstitial, "Continue" | 1 |
| 15 | Your week | Day grid; tap a weekend day twice to set the long run | 3–4 |
| 16 | Weekday time cap *(skippable)* | | 1 |
| 17 | Hard sessions *(full access only)* | | 1 |
| 18 | Terrain *(full access only)* | | 1 |
| 19 | Injuries *(full access only, skippable)* | | 1 |
| 20 | Generating ceremony | Plan builds; enrichment streams in | 0 |
| 21 | "Use this plan" | Saves the plan | 1 |
| 22 | **Orientation** ("Your plan is set", race card, first session) | Once only | 1 |
| 23 | **Connect your runs** (Apple Health permission) | iOS permission sheet on top | 2 |
| 24 | **Push permission** | Once only | 2 |
| 25 | **Today** | First session visible | — |

**Totals:** ~26 taps free path, **~32 taps** for a charity runner who redeems during setup (full-access
wizard has three extra questions). 15 questions plus 2 teaching screens on the free path, 18 plus 2 on
full access; 6 of the questions are skippable.

---

## L. Pre-launch checklist

Ordered by risk. The first three are blockers.

| # | Item | Why it is here | Owner |
|---|---|---|---|
| 1 | **Move Vercel from Hobby to Pro ($20/mo)** | Hobby is contractually non-commercial. Vercel's fair-use page names "any method of requesting or processing payment from visitors" as commercial. Zonna sells a subscription. Risk is account pause, which takes the whole app down for 500 runners mid-block. Also raises function max duration 60 s → 300 s, and plan enrichment already measures 28–35 s. | Founder |
| 2 | **Move Supabase from Free to Pro ($25/mo)** | 500 MB DB ceiling projected to break at ~250–320 active runners; **zero backups on Free**; project auto-pauses after 7 idle days. | Founder |
| 3 | **Correct the privacy policy** on what goes to Anthropic (first name, injury history) and add Resend as a processor | Customer-facing accuracy. A charity will read this page. | Founder |
| 4 | **Set `APNS_PRODUCTION=1` in Vercel** before the TestFlight/App Store build | Sandbox tokens are rejected by the production APNs server and vice versa. Documented in CLAUDE.md, still flagged as not done. **UNVERIFIED**, check Vercel → Environment Variables. | Founder |
| 5 | **Confirm the Supabase password-reset email template** uses `{{ .SiteURL }}/auth/reset?token_hash={{ .TokenHash }}&type=recovery` and `/auth/reset` is in Redirect URLs | Without it, reset silently fails for anyone opening the email on a different device, which is the normal iOS case. Memory says the founder set this on 2026-09-11; the device test was still outstanding. **UNVERIFIED**, check Supabase → Auth → Email Templates. | Founder |
| 6 | **Mint and test the batch**: `npx tsx scripts/mint-charity-codes.ts "Make-A-Wish UK" 500 --notes "London 2027"` then redeem one on a **non-admin** account | The mint script caps at 1000, so 500 is fine. Redeeming on an admin account proves nothing (`getUserTier` resolves admin → paid first); `scripts/check-charity-code.ts` reads the row directly. **No code has ever been redeemed in production** (1 of 3 existing codes is claimed, on a test batch). | Founder |
| 7 | **Add the charity grant to `admin_user_tiers`** | The admin view reimplements the tier ladder and does not know grants exist, so 500 comped runners will show as `free`/`trial` in every admin and reporting surface, and `v_paying_users` will be wrong. This is a fourth copy of a rule that `resolveTier` is supposed to own. | Engineering |
| 8 | **Add a per-partner reporting query or view** | There is none today. Scope is in Part 2 Q11: about 30 lines of SQL. | Engineering |
| 9 | **Add a rate limiter to `/api/weekly-report`** | It is the only Sonnet route with no `guardAiRequest`/`enforceAiRateLimit` call. Low risk (it is authenticated and tier-gated) but it is the one hole in the spend guard. | Engineering |
| 10 | **Decide what happens to `charity_codes.claimed_by` on account deletion** | The FK is `ON DELETE SET NULL`, so deleting an account frees the code for someone else to redeem while leaving `claimed_at`/`expires_at` populated. It also silently corrupts redemption counts. | Engineering |
| 11 | **Confirm the live App Store version and minimum iOS** | Repo says `MARKETING_VERSION 1.9.1`, build 15, deployment target **iOS 16.6**. What is actually live is **UNVERIFIED**, check App Store Connect. | Founder |
| 12 | **Check the Strava application status** | The Strava app was reported Inactive (403). Nothing paid depends on Strava (ADR-011), and the screen is admin-only, but the privacy policy and one onboarding comment still describe Strava. Either reactivate or leave it: it does not block the partnership. | Founder |
| 13 | **Set an Anthropic spend alert** | There is no per-user or per-route token accounting anywhere in the app. The Console is the only visibility. | Founder |
| 14 | **Run one end-to-end marathon plan** on a comped test account with an October start and an April race date | Proves the foundation-block path (26-week runway vs 20-week max plan) behaves, and that the "uncovered runway" note reads well. | Engineering |

---

## M. Discrepancies, exclusions and UNVERIFIED items

### Discrepancies (code wins; these are places the docs or another layer disagree)

1. **`admin_user_tiers` does not know charity grants exist.** `lib/trial.ts → resolveTier` is documented as
   the single owner of `admin → subscription → grant → trial → free`, and the whole point of the file's
   header comment is that the order existed in three places and drifted. The Supabase view
   `admin_user_tiers` is a **fourth** copy, and it stops at `subscription → trial → free`. Consequence at
   500 runners: every comped runner reads as `free` or `trial` in admin tooling, and `v_paying_users`
   (which counts `tier = 'premium'`) is unaffected but `v_trial_conversion` will treat comped runners as
   unconverted trials.
2. **The privacy policy understates what goes to Anthropic.** It says "session data is sent to Anthropic's
   API to generate a coaching response." In fact `lib/plan/enrich.ts → buildUserMessage` sends the
   runner's **first name** (`- Name: ${input.athlete_name}`) and their **injury history**
   (`- Injury history: ${input.injury_history.join(', ')}`), plus race, goal, weekly volume, days
   available and fitness level. The first name is resolved server-side from `user_settings.first_name`
   (`generate-plan/route.ts → resolveAthleteFirstName`). No email, no user ID, no raw HR stream.
   This needs one sentence added before a charity reads the page.
3. **Resend is an undisclosed processor.** `lib/email/resend.ts` sends the trial emails and receives the
   runner's email address. The privacy policy's third-party list names Supabase, Anthropic, Strava,
   Vercel and RevenueCat, but not Resend.
4. **The confidence score is not available on the 14-day trial**, despite `canUseFeature('confidence_score',
   'trial')` returning allowed and the trial being described as full access. `enrich.ts:226` sets
   `wantPaidFields = tier === 'paid'`, and a trial resolves to `'trial'`. **Charity grants resolve to
   `'paid'`, so Make-A-Wish runners get it.** Flagged because it means the reverse trial is not literally
   full access, which affects marketing copy elsewhere.
5. **`ultra_plan_generation` is a constant nothing reads.** Nothing calls
   `isFeatureAllowed('ultra_plan_generation')`. The actual marathon paywall is
   `PLAN_SIGNATURES[d].free_tier_available` via `canGenerateDistance`, enforced in both the wizard and
   `/api/generate-plan`. Behaviour is correct and the file documents this at length; the constant is
   decorative.
6. **`PLAN_SIGNATURES.MARATHON.min_weeks` is 14 but the engine refuses below 10.** `min_weeks` governs plan
   construction length; the refusal is `GENERATION_CONFIG.PREP_TIME_THRESHOLDS.MARATHON.block = 10`
   (12 for a returning runner). The number a runner meets is 10, not 14.
7. **`/api/weekly-report` has no AI rate limiter**, unlike the other eleven AI routes. It is authenticated
   and tier-gated, so it is not an open door, but it is the one path where a client loop could run Sonnet
   without a per-user ceiling.
8. **`charity_codes.claimed_by` is `ON DELETE SET NULL`.** Deleting an account releases the code back to
   the unclaimed pool (the redeem route only checks `row.claimed_by`), while `claimed_at` and `expires_at`
   stay set. A leaked-and-deleted account therefore returns a live code to circulation.
9. **Strava copy is still live in customer-facing surfaces** while Strava is admin-only in-app. See Part 3
   Q15 for the full list.

### Exclusions from customer-facing sections

- **Tailored strength sessions** (`strength_sessions_tailored`): the gate exists, the feature does not.
  Already argued as omitted in `lib/marketing/pricing.ts → OMITTED_FROM_PRICING`.
- **Strava**: the screen is admin-only by URL and the nav entry is removed; the Strava application is
  reported Inactive. Nothing paid depends on it (ADR-011).
- **Calendar screen, Welcome screen, smoke tracker**: retired or removed from all UI surfaces.
- **Preview/fixture pages** (`/me-preview`, `/post-run-preview`, `/coach-preview`): internal.
- **Everything in the backlog or roadmap**: excluded by instruction.

### UNVERIFIED (and where to check)

| Item | Where to check |
|---|---|
| Live App Store version number and whether 1.9.1 is the shipped build | App Store Connect → App Store → iOS App |
| Actual Anthropic token spend and per-model split | Anthropic Console → Usage. Nothing in the app records `usage.input_tokens`/`output_tokens`. |
| Supabase current egress against the 5 GB Free allowance | Supabase dashboard → Reports → Usage |
| Vercel current invocations, Active CPU, Provisioned Memory | Vercel dashboard → Usage |
| Vercel function max duration actually applied (60 s Hobby vs Fluid-compute default) | Vercel dashboard → Project → Functions. No route sets `maxDuration`. |
| Whether `APNS_PRODUCTION=1` is set | Vercel → Project `zona` → Settings → Environment Variables |
| Supabase reset-password email template and redirect URL allowlist | Supabase → Authentication → Email Templates / URL Configuration |
| Apple Developer: HealthKit and Push capabilities on `app.zonna.ios` | Apple Developer portal → Identifiers |
| Strava application status (reported Inactive, 403) | Strava developer dashboard |
| Whether Anthropic zero-retention / no-training applies to this account by default | Anthropic Console → Organization settings. The privacy policy asserts "does not use API inputs to train their models by default". |

---

# Detail

## Part 1: Features (free vs full access)

### 1–2. Feature inventory and enforcement

See section **E** above for the complete table with tier category, enforcement layer and code reference.

**Gated in one layer only:**

- **Marathon / ultra distance** was client-only until TIER-ENFORCE-01. It is now enforced in both the
  wizard tile and `/api/generate-plan` using the *same predicate* (`canGenerateDistance`), so the lock a
  runner sees and the 403 the server returns cannot disagree.
- **Confidence score and coach intro** are enforced only inside `enrich.ts` (`tier === 'paid'`), not via
  `canUseFeature`. This is the discrepancy in M.4.
- **Apple Health ingest** is gated server-side in `/api/health/ingest` and `/api/health/samples`. The
  client-side sync in `lib/health/clientSync.ts` does not check tier itself; the route is the boundary,
  which is correct under ADR-003 but means a downgraded user's device keeps trying and getting 403s.
- **Push registration** has no tier gate at all (deliberate: registration is free, the daily send is
  gated in the cron).

### 3. Distances, plan lengths, and short timelines

| Tier | Distances it can generate |
|---|---|
| Free | 5K, 10K, Half marathon |
| Trial / Paid / **Charity grant** | 5K, 10K, Half marathon, **Marathon, 50K, 100K** |

**Marathon plan length** (`lib/plan/planSignatures.ts`): minimum 14 weeks, **ideal 16**, maximum 20.

**What happens with fewer weeks than ideal** (`lib/plan/inputs.ts → validatePrepTime`, thresholds in
`GENERATION_CONFIG.PREP_TIME_THRESHOLDS`):

| Weeks to race | Finish goal | Time goal |
|---|---|---|
| Under 10 (12 if returning from a layoff) | **Refused.** `PrepTimeError`, HTTP 422, with alternatives offered: race the half at the same event, switch goal to finish, or defer to a race with at least 16 weeks | Same refusal |
| 10 to 15 | Generates cleanly | **Warns and requires acknowledgement.** Message: "…is below the recommended 16-week minimum… Expect maintenance-grade volume rather than a true build." Runner must resubmit with `acknowledged_prep_warning: true` |
| 16+ | Clean | Clean |

A plan generated in the warn band is stamped `prep_time_status: 'warned'`, and an invariant forces
`difficulty_band = 'very_demanding'` so the honesty is carried through to the UI.

**For this cohort specifically:** codes go out around October 2026 for a late-April 2027 race, so about
26 weeks. Plan length maxes at 20 weeks, and the foundation block adds at most 3 more
(`FOUNDATION_MAX_WEEKS: 3`). A runner starting immediately therefore gets roughly 23 covered weeks and
2–3 uncovered, which crosses `FOUNDATION_UNCOVERED_WEEKS_NOTE_THRESHOLD: 2` and surfaces a runner-facing
note about the gap. A gap over 28 days (`FOUNDATION_GAP_AUTO_DAYS`) routes through the deferred
foundation decision rather than auto-generating. **This is the single path worth testing end to end
before launch** (checklist item 14) because it is the exact shape every Make-A-Wish runner will hit.

Two more refusals they could meet, from `/api/generate-plan`'s own guard:
- marathon with current weekly volume under 20 km, and
- half or longer with a longest recent run under 5 km.

Both return 422 with an explanatory message rather than generating something unsafe.

### 4. The wizard, step by step

`getStepSequence()` in `app/dashboard/GeneratePlanScreen.tsx`. Full-access runners get three extra
questions at the end.

| # | Step | Question | Optional? | Tier |
|---|---|---|---|---|
| 1 | `distance` | How far? (5K / 10K / Half / Marathon / 50K / 100K) | No | Both |
| 2 | `race-details` | Race name and date | Name optional, date required | Both |
| 3 | `goal` | Crossing the line, or hitting a number | No | Both |
| 4 | `target-time` | What's the target? | Only if time goal | Both |
| 5 | `teach-easy` | *Teaching screen: "This plan will feel too easy at first."* | Interstitial | Both |
| 6 | `weekly-volume` | How much are you running now? (last 4 weeks) | No | Both |
| 7 | `longest-run` | Longest run in the last six weeks | No | Both |
| 8 | `training-age` | How long have you been at this? | Yes | Both |
| 9 | `recent-quality` | Been doing the hard stuff? (past tense, not self-image) | Yes | Both |
| 10 | `your-level` | Where are you right now? (engine's read, overrulable) | No | Both |
| 11 | `birth-year` | Year of birth, for max-HR estimate | Yes | Both |
| 12 | `benchmark` | Recent race result, for precise paces | Yes | Both |
| 13 | `teach-easy-day` | *Teaching screen: "Easy should feel easy."* | Interstitial | Both |
| 14 | `your-week` | Which days do you run? (tap a weekend day twice for the long run) | No | Both |
| 15 | `weekday-ceiling` | Weekday time cap, Mon–Fri | Yes | Both |
| 16 | `hard-sessions` | You and hard sessions | No | **Full access only** |
| 17 | `terrain` | Road, trail, or both | No | **Full access only** |
| 18 | `injuries` | Old injuries that still show up | Yes | **Full access only** |

Progress is a thin fill bar, never "step 7 of 12". Draft state persists in `sessionStorage` under
`zona_wizard_draft` and is cleared on save.

### 5. Does a code-redeemed user get exactly what a subscriber gets?

**Functionally yes.** `resolveTier` returns `{ tier: 'paid', reason: 'grant' }` for a live grant and
`{ tier: 'paid', reason: 'subscription' }` for a subscription. Every gate reads `tier`, so all 26
tier-gated routes behave identically. `distancePaywall.test.ts` pins this specifically for the
charity case.

Four differences, none of them a feature difference:

1. **Ordering.** An active subscription is checked *above* a grant, so a runner who later subscribes is
   resolved by their payment and does not lose access when the gift lapses.
2. **Expiry wording.** `reason` drives the copy. A lapsed grant and a lapsed trial both resolve to `free`,
   so the UI keeps `charityGrantEndsAt` separately to avoid telling a comped runner "your 14 days are up".
3. **Trial emails are suppressed.** `/api/email/send-trial` resolves tier and passes a required access
   argument to `decideTrialEmails`, so a grant holder does not receive "3 days left" or "trial ends today".
4. **Admin visibility.** `admin_user_tiers` does not see grants, so a comped runner looks free or trial in
   admin tooling. This is discrepancy M.1 and checklist item 7.

### 6. On expiry: what they keep and what stops

Option A downgrade, from `canUseFeature`. Note that `GRANTED_AT_TRIAL_RETAINED_IN_FREE` is allowed
unconditionally once the artefact exists.

**Keeps, permanently:**
- The plan itself, all weeks, nothing blurred (`plan_view`, `personalised_plan`)
- Pace zones derived from their benchmark (`vdot_pace_zones`)
- Heart-rate zones (`hr_karvonen_zones`)
- Every AI coach note already written on the plan (`ai_coach_notes_existing`)
- Catalogue-sourced sessions on that plan (`session_catalogue_full`)
- Injury adaptations baked in at creation (`injury_adaptations_initial`)
- Logging sessions by hand, and hand-entering a run's distance/duration/HR
- The difficulty band and the plan's own rationale notes
- The ability to regenerate a **5K/10K/HM** plan freely

**Stops:**
- **Apple Health ingest.** `/api/health/ingest` and `/api/health/samples` both return 403. New runs stop
  arriving. This is the most consequential single item and it is worth saying plainly to runners.
- Run analysis and score cards, daily coach note, weekly report, pre-run readiness band, aerobic trend,
  phase summaries, race readiness note, week-ahead note (all `activity_intelligence`)
- Plan reshaping, both automatic and manual, plus recalibration and post-race reshape
  (`dynamic_reshape_r20`)
- AI enrichment on any newly generated plan (`ai_coach_notes_new`)
- Generating a **new** marathon or ultra plan. The existing one is kept and readable.
- Race time estimates, post-run reframe, confidence score, maintenance-block coaching
- The daily push notification

Grant windows (`lib/charity/grantWindow.ts`): 90 days at redemption, re-anchored to **race date + 7 days**
the first time the runner saves a plan, extend-only (a deferred race extends it; switching to a shorter
race does not claw it back), hard ceiling of 18 months from redemption.

---

## Part 2: Access code mechanism

### 7. End-to-end flow

1. **Sign-up first.** `POST /api/charity/redeem` calls `getUserFromRequest(req)` and returns 401 without a
   session. A runner must have an account before a code does anything.
2. **Where they enter it.** Three entry points, one mechanism (`RedeemCodeScreen.tsx`):
   - the wizard's first step, as "Have a charity code?" (`GeneratePlanScreen.tsx:1527`), shown when
     onboarding or when not already paid,
   - the Me/profile screen ("Charity access"),
   - the Upgrade screen (`UpgradeScreen.tsx:443`), which is where a runner who filed the email away meets
     it at the gate.
3. **Input is forgiving.** `lib/charity/code.ts → normaliseCode` accepts lowercase, spaces, hyphens,
   with or without the `ZONNA` prefix, and stray copy-paste whitespace. `formatCodeInput` runs the same
   rules forwards as the runner types, so the box and the parser cannot disagree. The alphabet is
   Crockford-style with no `I`, `L`, `O`, `U`, `0` or `1`.
4. **Storage.** `charity_batches` (partner name, cap, notes, `revoked_at`) and `charity_codes` (batch FK,
   normalised code, `claimed_by`, `claimed_at`, `expires_at`). Migration
   `20260911_charity_access_codes.sql`. RLS is on both; there is **no public read policy** on
   `charity_codes`, so an unredeemed code cannot be harvested. A user can read only their own claimed row.
5. **Entitlement is set** by the redeem route updating the row with `claimed_by`, `claimed_at` and
   `expires_at = now + 90 days`, using the service role. The claim is atomic:
   `.eq('id', row.id).is('claimed_by', null)`, so two runners racing the same code produce exactly one
   winner.
6. **Re-anchoring.** `lib/charity/reanchor.ts → reanchorCharityGrant` runs inside `savePlanForUser`, which
   is the single owner of plan writes, so every path that can set a race date is covered: wizard, reshape,
   recalibration, maintenance handoff. It never throws: a failed grant update leaves the runner with
   access rather than losing them their plan.
7. **Resolution.** `getUserTier(userId)` fetches four rows in parallel (subscription, user settings,
   charity code, and the admin flag) and calls the pure `resolveTier`. `DashboardClient` calls the same
   pure function client-side because it cannot use a service-role function. **The order exists in exactly
   one place**, and `tierResolution.test.ts` tests that owner rather than a copy of it. Order:
   `admin → active subscription → charity grant → trial → free`.

### 8. Code shape, cap, expiry, partner identity

| Question | Answer |
|---|---|
| Shared or unique? | **Unique, single-use per runner.** `charity_codes_code_idx` is a unique index on the code; `claimed_by` is set once. |
| Redemption cap | **Per batch, set at mint time and recorded on the row.** `scripts/mint-charity-codes.ts "Make-A-Wish UK" 500` mints exactly 500 and stores `cap = 500`. Script hard-caps at 1000 so a typo cannot mint ten thousand. There is no unlimited mode. |
| One grant per user | Enforced by the database: `charity_codes_one_grant_per_user_idx`, a partial unique index on `claimed_by WHERE claimed_by IS NOT NULL`. |
| Expiry | Per code, set at redemption: 90 days, then re-anchored to race date + 7 days when a plan is saved, extend-only, ceiling 18 months from redemption. **There is no batch-level expiry date.** |
| Partner identifier | `charity_batches.partner_name` plus `notes`. Codes join to the batch by `batch_id`. |
| Kill switch | `charity_batches.revoked_at`. Revoking stops **unclaimed** codes being redeemed and deliberately does **not** touch grants already made. |
| Codespace | 30^8 ≈ 6.6 × 10^11. |

### 9. Abuse

| Vector | Answer |
|---|---|
| Can a leaked code be redeemed publicly without limit? | **No.** Each code is single-use and the claim is atomic. A leaked *code* burns once. |
| Can a leaked **batch** (the CSV) be abused? | **Yes, up to the cap.** Possession of a code is the proof of entitlement by design: the partner is the only party that knows who holds a place with them, so Zonna never verifies affiliation. If the CSV leaks, up to 500 strangers could redeem. Mitigation is `revoked_at` on the batch, which stops the unredeemed remainder. |
| Can one user redeem twice? | **No.** The route checks for an existing grant and returns `alreadyRedeemed: true` rather than burning a second code; the partial unique index is the hard backstop. |
| Can a code stack with a trial? | **It supersedes it.** Both can be live at once (redeeming on day one is the expected arrival). `resolveTier` returns `paid`/`reason: 'grant'`, not `trial`. This is pinned by a test that was added specifically because moving the grant check below the trial check did **not** fail the rest of the suite. |
| Can a user who has already had a trial redeem? | **Yes.** An expired trial is irrelevant: the grant is checked above the trial and resolves to `paid` regardless. |
| Enumeration? | The route gives specific failure reasons ("already used" vs "not a code we recognise") on purpose, because this is a gift and a mistyped character deserves a clear answer. With a 6.6 × 10^11 codespace and an authenticated, rate-limited route, this is not a meaningful enumeration risk. |
| **Account deletion frees the code.** | `claimed_by` is `ON DELETE SET NULL`, so deleting the account returns the code to the unclaimed pool with `claimed_at`/`expires_at` still set. Checklist item 10. |

### 10. Can a batch be created with a fixed expiry and cap without a code change?

**Cap: yes.** `npx tsx scripts/mint-charity-codes.ts "Make-A-Wish UK" 500 --notes "London 2027 · race 2027-04-25" > mawuk-codes.csv`
mints 500, records the cap, and writes the codes to CSV (progress goes to stderr so the redirect captures
only codes).

**Fixed expiry: no.** Expiry is per-code and set at redemption (90 days), then re-anchored to the runner's
own race date. There is no batch-level "all access ends 2027-05-02" field.

**Is that a problem here? Almost certainly not.** Every runner in this cohort has the same race date, so
re-anchoring gives each of them 2027-05-02 (race + 7) automatically as soon as they save a plan. The only
divergence is a runner who redeems and never builds a plan, who lapses at 90 days, which is the intended
outcome.

**Smallest change if a hard batch expiry is still wanted:** add a nullable `expires_at` column to
`charity_batches`, and in `initialGrantExpiry`'s caller take `min(batchExpiry, computedExpiry)`, plus the
same clamp inside `reanchorGrantExpiry`. That is one migration, one new argument threaded through two pure
functions, and two test cases. Roughly half a day including tests. **I would not do it for this
partnership** because the race-date re-anchor already produces the right date and a batch cap that
overrides it can only cut someone off earlier than race day, which is the exact failure the grant design
exists to avoid.

### 11. Reporting

**Today there is essentially none, per partner or otherwise.**

- `analytics_events` has exactly **one** event name in the entire codebase: `coach_open`
  (`lib/analytics.ts`, the union is the source of truth). 90 rows total.
- The six admin views are `admin_user_tiers`, `admin_user_directory`, `v_paying_users`,
  `v_trial_conversion`, `v_hr_present_pct`, `v_coach_engagement`. **None joins to `charity_batches`**,
  and `admin_user_tiers` does not even model grants.
- `ops_events` is operational telemetry (write failures, integrity probes), not product analytics.

Every metric asked for *is* derivable from existing tables. Smallest change is one view:

```sql
create or replace view v_partner_cohort as
select
  b.partner_name,
  b.cap,
  count(c.id)                                             as codes_minted,
  count(c.claimed_by)                                     as codes_redeemed,
  count(distinct p.user_id)                               as plans_generated,
  count(distinct case when u.last_sign_in_at > now() - interval '7 days'
                      then c.claimed_by end)              as weekly_active,
  count(distinct case when s.healthkit_connected_at is not null
                      then c.claimed_by end)              as healthkit_connected,
  count(sc.id)                                            as sessions_logged
from charity_batches b
join charity_codes   c  on c.batch_id   = b.id
left join auth.users u  on u.id         = c.claimed_by
left join user_settings s on s.id       = c.claimed_by
left join plans      p  on p.user_id    = c.claimed_by
left join session_completions sc on sc.user_id = c.claimed_by
group by b.id, b.partner_name, b.cap;
```

That covers all six requested metrics. Caveats worth stating to the charity: "weekly active" is
`auth.users.last_sign_in_at`, which is a sign-in, not an app open (there is no app-open event); and
`healthkit_connected_at` records that the permission sheet was accepted, which iOS does not let the app
distinguish from a silent denial, so it is an upper bound.

Two further gaps: (a) the view above needs `admin_user_tiers` fixed first if you want a tier column on it,
and (b) account deletion nulls `claimed_by`, so redemption counts drift downward over time.

---

## Part 3: Apple Health

### 12. What is read, how often, and how it reaches Supabase

**Read permissions requested** (`lib/health/clientSync.ts → requestHealthKitAuth`), six, all read-only:

| Type | Used for |
|---|---|
| `workouts` | The run itself: start/end, distance, duration, calories, elevation from metadata |
| `heartRate` | The per-workout HR sample stream, up to 10,000 samples per workout |
| `restingHeartRate` | Daily recovery signal, and the HR-zone pre-fill |
| `heartRateVariability` | Daily recovery signal |
| `sleep` | Daily recovery signal; only `asleep`/`rem`/`deep`/`light` count, `inBed` and `awake` are excluded |
| `calories` | Active energy per workout |

`distance` was deliberately removed (it comes from `HKWorkout.totalDistance`, so requesting it was
unnecessary consent friction). Every requested permission has an active query, which is a documented
invariant.

**How often:**
- **App open and pull-to-refresh** → `syncOnAppOpen()`: recent running workouts (24-hour minimum lookback,
  30 days on first sync, paginated 50 at a time up to 10 pages), 14 days of recovery samples, and a retry
  sweep for rows missing HR from the last 48 hours.
- **Background**, via the custom `HealthObserverPlugin` Swift plugin: `HKObserverQuery` plus
  `enableBackgroundDelivery` on workouts, HR and recovery, so a finished run can wake the ingest pipeline.
  **Known limit, documented in `HealthObserverPlugin.swift:24`: a fully-killed app cannot background-ingest**
  because there is no JS runtime to receive the callback. The run is picked up on the next cold start.
- **Not on a server schedule.** There is no server-side Apple Health poll; Apple does not offer one.

**Path to Supabase:**
`HealthKit → clientSync.ts → POST /api/health/ingest (bearer auth, tier-gated) →
lib/health/adapter.ts (adaptHealthKitWorkout) → consolidateIncomingHealthKitRow (dedup ±5 min / ±5%) →
upsert into strava_activities on (user_id, apple_health_uuid) → autoMatchAndAnalyse → run_analysis`.
Recovery samples go via `POST /api/health/samples` into `health_daily_samples`, keyed
`(user_id, sample_date)`.

`strava_activities` is a v1 misnomer: it is the source-agnostic run log, with a `source` column of
`apple_health | strava | manual`.

**What is stored per run:** distance, duration, elevation, avg/max HR, average speed, calories, the
percentage of time in each HR zone, a BPM histogram, and the full raw HealthKit payload including the HR
sample stream (`raw_payload`). Recovery is stored as one daily summary value per metric, not raw streams.

### 13. Devices this effectively supports

From ADR-011 §5, which is explicit about this:

| Setup | Runs | HR stream | Recovery | Coaching triggers |
|---|---|---|---|---|
| iPhone + **Apple Watch** | Full | Full | Full | All fire |
| iPhone + **chest strap that writes to Apple Health** | Full | Full | Whatever the device writes | All fire |
| iPhone + **Garmin / Coros / Polar / Wahoo** writing to Apple Health | Full | Full, whatever that app writes | Partial | All fire |
| **iPhone only**, Strava on the phone, no watch | Workout shell only: distance and duration | **None** | RHR/HRV only if passive HR exists | Load and fatigue triggers only |
| iPhone only + Strava connected | Shell + splits + temperature | **Still none** | As above | Load and fatigue only |
| No device at all | Manual entry: distance, duration, optional avg HR | None | None | Load only |

**Nothing requires a specific device.** Anything that writes workouts to Apple Health feeds the system
transitively; Zonna reads once, from one place, and never reaches back to the originating provider.

**The honest limitation, worth saying to the charity:** an iPhone-only runner with no watch and no chest
strap gets **no heart-rate-based coaching**, even with Strava connected, because Strava's write to Apple
Health does not include the HR stream and Apple controls what Strava writes. For a charity cohort with a
high proportion of first-time marathoners, this will be a meaningful share of the group. The product
handles it honestly rather than silently: every degraded cell in that matrix has a required UI state that
explains the gap and offers a specific action, and the rule is explicit that it must never be a generic
"connect Strava" prompt, because connecting Strava does not solve the no-HR case.

### 14. Denied or partially granted permission

**Graceful, with one structural caveat that is Apple's, not Zonna's.**

- **Full denial:** `requestHealthKitAuth` returns false and the connect screen shows a calm one-liner:
  "Apple Health said no. Enable in iOS Settings → Health, or connect later." The runner continues to a
  working app. Nothing blocks.
- **Skipping the screen entirely:** `connect_runs_seen` is tri-state (`null` = not yet asked, `false` =
  skipped, `true` = connected). Skipping is a first-class outcome, not an error state.
- **Partial grant:** handled per-type. `fetchAppleHealthHRSnapshot` returns whatever it found and returns
  null only when it found nothing at all, so a runner with resting HR but no workouts still gets their
  zones pre-filled. `syncOnAppOpen` uses `Promise.allSettled`, so one failing query does not take the
  others down. Every entry point is wrapped in try/catch, and failures log to console rather than
  surfacing.
- **The caveat:** Apple's privacy model means a silent denial is indistinguishable from "no data": a
  denied read returns an empty array, not an error. The code says so explicitly and treats the call
  succeeding as "the user saw the prompt and did not bail out", then lets the actual sync verify by
  trying. Consequence for reporting: `healthkit_connected_at` is an upper bound on real connections.
- **Falls back to:** manual session completion (free) and manual run entry with optional average HR
  (free), plus everything the plan itself provides.

### 15. Live Strava references

Strava is **not dead code**. It is live, tier-gated, and reachable, but has no nav entry and (per the last
check) an inactive Strava application.

**Live server code, all tier-gated on `activity_intelligence`:**
`/api/strava/connect`, `/api/strava/callback`, `/api/strava/refresh`, `/api/strava/link-activity`,
`/api/strava/unlink-activity`, `/api/webhooks/strava`, `/api/ops/strava-webhook-health`.

**Live client code:** `components/strava/StravaPanel.tsx`, and `StravaScreen` inside `DashboardClient`,
rendered only at `screen === 'strava' && isAdmin` (defence in depth at the render boundary, plus the nav
entry is removed).

**Live consolidation logic:** `lib/coaching/healthkitConsolidate.ts` patches a Strava activity onto an
existing Apple Health row; if no HK row exists the Strava activity is **discarded**, never stored as
canonical.

**Customer-facing copy still mentioning Strava:**

| Surface | What it says |
|---|---|
| `/privacy` §"Strava" | Describes read-only Strava access and token storage |
| `/privacy` third-party list | Names Strava as a processor |
| `/privacy` cookies section | Says local storage holds a "Strava session token" |
| `/terms` | Contains Strava references |
| `ConnectRunsScreen` | A code comment reserves layout for a future Strava CTA; no Strava button is rendered |
| `lib/marketing/comparisons.ts` | Competitor comparison prose mentions Strava/Garmin |

**Recommendation:** leave the code alone (ADR-011 means no paid feature depends on Strava and the product
functions fully without it), but decide whether the privacy policy's Strava section should stay. It is
accurate *if* a runner ever connects Strava, and a runner cannot reach that screen without an admin URL.
Simplest honest fix is one clause: "Strava integration is not currently available in the app."

---

## Part 4: Capacity and cost

### 16. Supabase today

| Field | Value |
|---|---|
| Project | `Zonna Run`, ref `wkppmpsvqkaxbekdgzdm` |
| Region | `eu-west-1` (AWS Ireland) |
| Postgres | 17.6.1.104 |
| Organization plan | **Free** |
| Database size | **15 MB** (3.2 MB of that is table + index data; the rest is Postgres baseline) |
| Auth users | **26** |
| RLS | Enabled on all 29 public tables |

Row counts, all tables:

| Table | Rows | Total size |
|---|---|---|
| `session_completions` | 277 | 200 kB |
| `health_daily_samples` | 210 | 128 kB |
| `notifications` | 159 | 104 kB |
| `run_analysis` | 140 | 208 kB |
| `strava_activities` | 114 | **488 kB** (largest) |
| `ops_events` | 101 | 184 kB |
| `analytics_events` | 90 | 48 kB |
| `ai_rate_limits` | 56 | 64 kB |
| `user_settings` | 26 | 96 kB |
| `plans` | 19 | **360 kB** |
| `plan_adjustments` | 18 | 120 kB |
| `weekly_reports` | 16 | 96 kB |
| `daily_coach_notes` | 16 | 48 kB |
| `session_overrides` / `session_catalogue` | 14 / 14 | 48 / 32 kB |
| `plan_archive` | 11 | 208 kB |
| `session_metric_overrides` | 10 | 64 kB |
| `session_guidance` | 9 | 32 kB |
| `push_subscriptions` | 8 | 48 kB |
| `plan_weekly_notes` / `session_reflections` | 8 / 8 | 48 / 80 kB |
| `charity_codes` | **3** (1 claimed) | 80 kB |
| `charity_batches` | **1** | 32 kB |
| `subscriptions` | 1 | 48 kB |
| `phase_summaries`, `race_readiness_notes`, `free_insights`, `post_race_reshapes` | 1 each | 32–48 kB |
| `waitlist` | 0 | 48 kB |

Free plan limits and headroom: DB 500 MB (3% used), egress 5 GB/mo (**UNVERIFIED**), auth MAU 50,000
(0.05% used), file storage 1 GB (0% used, no bucket in use), compute shared CPU / 500 MB RAM, **no
backups**, project pauses after 7 idle days. Connection pooling is not a constraint because the app
uses PostgREST over HTTP rather than direct Postgres connections.

### 17. Per active paid user

Measured per-row costs (total relation size ÷ rows, so indexes and TOAST included):

| Table | Bytes/row | Rows per 28-week block | Subtotal |
|---|---|---|---|
| `strava_activities` | 4,383 | 112 (4 runs/wk) | **491 kB** |
| `weekly_reports` | 6,554 | 28 | 184 kB |
| `run_analysis` | 1,521 | 112 | 170 kB |
| `notifications` | 750 | ~200 | 150 kB |
| `plans` + `plan_archive` | ~12,000 | ~12 | 144 kB |
| `health_daily_samples` | 624 | 196 | 122 kB |
| `session_completions` | 782 | 140 | 109 kB |
| `daily_coach_notes` | ~500 content | 196 | 98 kB |
| everything else | | | ~80 kB |
| **Total** | | | **~1.5 MB** |

**Largest contributor: `strava_activities`, about a third of the total**, and within it the dominant field
is `raw_payload`. Average 1,570 bytes compressed for an Apple Health row, peaking at 12,329.

**Stored raw that could be derived:** `raw_payload` holds the **complete HealthKit workout payload
including `hrSamples`**, which can be up to 10,000 per-second heart-rate readings
(`lib/health/adapter.ts:125`, `raw_payload: payload`). Everything the app actually reads from that stream
is already derived into dedicated columns on the same row: `avg_hr`, `max_hr`, `hr_in_zone_pct`,
`hr_above_ceiling_pct`, `hr_below_floor_pct`, `hr_pct_z1` through `hr_pct_z4_5`, and `hr_bpm_histogram`.
The only consumer of `raw_payload` is the HR-retry path, which reads the *shell* fields
(`totalEnergyKcal`, `elevationGainMeters`, `sourceName`) and overlays freshly-queried samples. Stripping
`hrSamples` from the stored payload would cut the biggest table by roughly 30–40% with no behavioural
change. **I am not recommending it as a launch blocker** because moving to Supabase Pro makes the 500 MB
ceiling irrelevant, and the raw stream has real future value (re-bucketing runs after a zone
recalibration is exactly the defect ADR-011 §263 describes). It is the first thing to trim if storage
ever does bind.

### 18. Projection to +500 users

| | 100% redemption (500) | 30% redemption (150) |
|---|---|---|
| Total auth users | 526 | 176 |
| DB size (at 1.5 MB/runner) | **765 MB** | **240 MB** |
| DB size (at 2.0 MB/runner, heavy trainers) | **1.02 GB** | **315 MB** |
| Against Free's 500 MB | **1.5× to 2× over** | 48–63% used |
| Auth MAU vs 50,000 | 1% | 0.4% |
| Egress vs 5 GB/mo | ~3 GB/mo est., **60% used** | ~0.9 GB/mo |

**What breaks first, and at what user count:** the **database size ceiling**, at roughly **250 to 320
active runners** (500 MB minus the 15 MB baseline, divided by 1.5–2.0 MB). Second is **egress**, which at
full redemption sits near 60% of the Free allowance and would break if runners open the app more than
assumed. Third, and least predictable, is **compute**: Free is shared CPU with 500 MB RAM, and 500 users
plus an hourly push cron scanning every subscription is untested at that size.

**Paid-tier cost if needed: yes, needed. Supabase Pro at $25/month** gives 8 GB database (10× headroom on
the worst case), 250 GB egress, 100,000 MAU, a dedicated Micro compute instance, **7-day backups**, and no
auto-pause. Seven months = **$175**.

### 19. Claude API

See section **D** for the table. Method notes:

- Every call path in the shipped app is listed. Models come from `lib/ai/models.ts`
  (`ANTHROPIC_MODEL = claude-haiku-4-5-20251001`, `ANTHROPIC_MODEL_DEEP = claude-sonnet-4-5-20250929`).
- Output ceilings are the literal `max_tokens` in each route, which I verified by grepping every call
  site: 80 (daily note), 120 (trend, free intro), 150 (adjust-plan, phase-summary), 200 (analyse-run,
  race-readiness, free insight), 220 (weekly note), 300 (weekly report, reframe), 2,048 (post-race
  reshape), 3,000 (maintenance enrichment), 6,000/10,000/14,000 (plan enrichment, by plan length).
- **Input token counts are estimated**, from prompt-file sizes (the enrichment system prompt is 9,982
  characters ≈ 2,700 tokens) plus payload shape. Nothing in the app records `usage` from the API
  response, so the Console is the only ground truth.
- Two paths use prompt caching (`anthropic-beta: prompt-caching-2024-07-31` with an ephemeral breakpoint
  on the system prompt): plan enrichment and maintenance enrichment. At this volume, with a 5-minute TTL
  and requests spread across the day, I have assumed **no cache hits**, which makes the estimate
  conservative.
- Free-tier-only paths (`freeIntro`, `weekly-free-insight`) cost nothing for this cohort.

**Projection Oct 2026 – Apr 2027: $1,200 at 100% redemption, $360 at 30%.** Band $750–$2,500 and
$225–$750 respectively. Against £7.99/month list price, the AI cost of a comped runner over seven months
is under one month's subscription.

### 20. Spend protection

**Rate limiting exists and is per-user, per-route, fixed-window** (`lib/ai/limits.ts`, backed by the
`ai_rate_limits` table and a `check_rate_limit` Postgres RPC):

- Default: **30 requests per hour** per user per route.
- Heavy routes (`generate-plan`, `maintenance-block`, `post-race-reshape`, `adjust-plan`,
  `post-run-reframe`): **10 per hour**.
- Body size cap of 64 kB on routes that read a body, so user text cannot inflate prompt tokens without
  bound (413 on exceed).

**Gaps:**
1. **`/api/weekly-report` calls neither `guardAiRequest` nor `enforceAiRateLimit`.** It is the only Sonnet
   route without one. It is authenticated and tier-gated, so it is not open, but a client loop could run
   it without a ceiling.
2. **The limiter fails open.** If the RPC errors or the DB is unreachable, `checkAiRateLimit` returns
   `true` and the request proceeds. This is a deliberate, documented trade (a false denial breaks the
   product; a brief limiter outage has bounded exposure) but it means the guard is not a hard cap.
3. **There is no global or per-org spend ceiling anywhere in the app**, and no token accounting. Set a
   spend alert in the Anthropic Console (checklist item 13).

**If the API fails: silent fallback, everywhere, by design.** `enrich()` never throws. It returns the
rule-engine plan unchanged with a typed outcome (`no_api_key`, `api_error`, `fetch_failed`, `parse_error`,
`schema_invalid`). The runner gets a complete, valid, constitutionally-checked plan with plain engine copy
instead of coaching voice, and no error. This is the hybrid generation pattern (ADR-006): the
deterministic engine always succeeds, AI is enrichment only. Failures are recorded as
`plan_enrich_failed` ops events so the fallback is visible rather than invisible. Same shape on the other
routes: the daily coach note returns `{ note: null, fallback: true }`.

**The practical consequence for the partnership:** an Anthropic outage degrades the product to
rule-engine quality. It does not take it down.

### 21. Vercel

| Field | Value |
|---|---|
| Team | `service-nerd's projects`, **plan: `hobby`** |
| Project | `zona` (`prj_Ht3ZCjCSoQCYk1WRPdmVEKXOJ5V3`) |
| Production host | `https://www.zonna.run` (apex 307-redirects to `www`) |
| Crons | 1 in `vercel.json` (weekly report, Sun 18:00) + 6 on GitHub Actions, explicitly because "Vercel Hobby caps at 2 crons" |

**The thing that bites at 500 users is not capacity, it is the plan's terms.** Vercel's fair-use page
states: *"Hobby teams are restricted to non-commercial personal use only. All commercial usage of the
platform requires either a Pro or Enterprise plan,"* and defines commercial usage to include *"any method
of requesting or processing payment from visitors of the site."* Zonna sells a £7.99/month subscription
through RevenueCat. The account is out of compliance today; running a 500-person charity partnership on
it raises both the visibility and the cost of enforcement, and the enforcement action is an account pause.

Capacity headroom on Hobby, for completeness:

| Resource | Hobby allowance | Estimated at 500 users |
|---|---|---|
| Function invocations | 1,000,000/mo | ~150,000/mo |
| Fast Data Transfer | 100 GB/mo | well under |
| Active CPU | 4 hrs/mo | under 1 hr |
| Provisioned Memory | 360 GB-hrs/mo | ~40–70 GB-hrs |
| Function max duration | 60 s (Pro: 300 s) | **Plan enrichment measured at 28–35 s** |

The duration line is the one real capacity risk. No route sets `maxDuration`, so every route runs at the
platform default; `/api/generate-plan` mitigates by streaming (`ReadableStream`), which keeps the
connection alive, but a slow Anthropic response on a 20-week plan with a 14,000-token ceiling has less
margin than is comfortable. Pro's 300 s ceiling removes the question.

**Vercel Pro: $20/month. Seven months = $140.**

### 22. Push notifications (APNs)

Fully wired end-to-end on iOS native. Client registers via `@capacitor/push-notifications` and posts the
APNs device token to `/api/push/subscribe` with `platform: 'ios'`; `push_subscriptions` carries a
`platform` column; sends route through `lib/apnpush.ts` using the `apn` npm package.

**Constraints at this volume: none material.**
- Apple publishes no per-app volume cap for APNs at this scale. 500 devices with at most one push per user
  per day is trivial.
- The daily cron runs **hourly** and computes each user's local hour from their stored timezone, sending
  in the 06:00–11:00 local window with an idempotency stamp collapsing it to one send per day. At 500
  subscriptions that is 24 invocations a day each scanning 500 rows: nothing.
- Free-tier users get no daily push, so at 100% redemption every one of the 500 is eligible.
- The library caches a single `apn.Provider`, so connections are reused.

**The one operational item:** `APNS_PRODUCTION` must be `1` for a production build. Sandbox tokens are
rejected by the production APNs server and vice versa. If it is wrong, **every push silently fails** for
the whole cohort. **UNVERIFIED**, checklist item 4.

Missing env vars degrade gracefully: `getProvider()` logs a warning and returns null, and web subscribers
keep working.

---

## Part 5: Privacy, data and trust

### 23. What is collected and stored, and where

**Region: AWS `eu-west-1`, Ireland.** Confirmed from the live Supabase project record, and matches the
privacy policy's "Supabase infrastructure (AWS, EU region)".

| Category | Fields | Table |
|---|---|---|
| **Identity** | Email, first name, last name, or an OAuth reference for Apple/Google | `auth.users`, `user_settings` |
| **Physiological** | Resting HR, max HR (and its source), birth year | `user_settings` |
| **Training inputs** | Race, date, goal, target time, weekly volume, longest run, training age, recent quality, days available, blocked days, weekday time cap, hard-session relationship, terrain, **injury history** | inside `plans.plan_json` |
| **Run data** | Per run: distance, duration, elevation, avg/max HR, speed, calories, temperature, splits, per-zone HR percentages, BPM histogram, and the **full raw HealthKit payload including the per-second HR stream** | `strava_activities` |
| **Recovery data** | One daily value each for resting HR, HRV, sleep hours, and per-stage sleep minutes | `health_daily_samples` |
| **Subjective** | RPE 1–10, fatigue tags, free-text session reflections | `session_completions`, `session_reflections` |
| **AI output** | Run analyses, weekly reports, daily notes, reframes, phase summaries, readiness notes | `run_analysis`, `weekly_reports`, `daily_coach_notes`, `session_reflections`, `phase_summaries`, `race_readiness_notes` |
| **Billing** | Subscription status, period end, provider (`revenuecat`/`stripe`). **No card data ever**: Apple handles payment | `subscriptions` |
| **Entitlement** | Which code a user claimed, when, and when it expires. No partner-visible identity | `charity_codes` |
| **Device** | Push token, platform, timezone | `push_subscriptions`, `user_settings` |
| **Behavioural** | Exactly one event type: `coach_open` | `analytics_events` |
| **On device only** | Last-sync timestamp in localStorage | — |

RLS is enabled on all 29 tables. Several routes deliberately use a **user-scoped** (JWT) Supabase client
rather than the service role, so RLS backstops the `.eq(user_id)` filters rather than the filter being the
only thing between one runner's data and another's; a test (`rlsCoverage.test.ts`) enforces policy
coverage on every build.

### 24. Third parties, and exactly what goes to Claude

**Processors in the code:**

| Processor | Receives | In privacy policy? |
|---|---|---|
| **Supabase** (AWS EU) | Everything above. Database and auth. | ✅ |
| **Anthropic** | Training context including first name and injury history. See below. | ⚠️ **Understated** |
| **Vercel** | Hosting, request logs | ✅ |
| **RevenueCat** | App Store transaction ID, subscription status, pseudonymous user ID. Not name, email or payment details. | ✅ |
| **Apple** (APNs, HealthKit, IAP) | Push tokens, payment | Partially |
| **Resend** | The runner's **email address**, for trial emails | ❌ **Not disclosed** |
| **Strava** | Only if a runner connects it, which requires an admin URL | ✅ |
| **Analytics SDK** | **None.** Analytics is owned in Supabase; there is no third-party analytics SDK anywhere in the codebase. | n/a |
| **Crash reporting** | **None.** No Sentry, Bugsnag, Crashlytics or equivalent in the repo. Errors go to `console` and `ops_events`. | n/a |

**Exactly what is sent to the Claude API.** From `lib/plan/enrich.ts → buildUserMessage`, the enrichment
call sends:

- **The runner's first name** (`- Name: ${input.athlete_name ?? 'Athlete'}`). Resolved server-side from
  `user_settings.first_name` so it cannot be spoofed by the client.
- Fitness level, goal (and target time), race name, race date, distance
- Current weekly volume, days available per week
- Whether the plan is time-compressed, and its difficulty band
- **Injury history** (`- Injury history: ${input.injury_history.join(', ')}`), e.g. "Knee, Shin splints"
- Training style and hard-session relationship
- A slimmed plan: per week, the week number, type, phase, weekly km, intensity flags, and per session the
  type, distance, duration, zone and HR target

The other AI routes send comparable training context: session details, recent run summaries, RPE and
fatigue tags, and for the reframe the runner's own free-text reflection.

**What is never sent:** email address, surname, user ID, date of birth, any auth token, any billing
detail, and the **raw per-second HR stream** (only derived summaries and zone percentages).

**So: is it identifiable health data?** Honestly, yes in part. A first name plus an injury history plus a
named race on a named date is not anonymous, and the brief asked for the true answer. It is a small,
bounded set, it is disclosed to a processor that contractually does not train on API inputs by default,
and no email or account identifier accompanies it. But the privacy policy currently says only "session
data", and that sentence needs to name the first name and the injury history before a charity reads it.

### 25. Does the charity receive any runner data?

**No. Verified by exhaustion, not assumption.**

- There is no outbound integration to any partner: no webhook, no export endpoint, no scheduled report, no
  shared credential anywhere in `app/api/` or `lib/`.
- The `charity_codes` table stores a user ID, a claim timestamp and an expiry. It has no name, email, plan,
  or run data, and **no RLS policy grants a partner any read at all** (the only SELECT policy is
  `auth.uid() = claimed_by`, i.e. the runner reading their own row).
- The app is explicitly designed never to name the charity back to the runner either. From
  `RedeemCodeScreen.tsx`: *"per the SLT ruling we never name the charity back to the runner: the
  fundraising page and the people watching are the extrinsic pressure that makes this cohort overtrain, so
  reflecting it into the app amplifies the thing that hurts them."*
- Any partner reporting would come from the aggregate view scoped in Part 2 Q11, which returns counts
  only, and does not exist yet.

### 26. Account deletion

**Yes, in-app, in three taps:** Me → Account → Delete account (`DeleteAccountScreen`, reached via
`activeSection === 'delete-account'`), which calls `POST /api/delete-account`.

**What the route does:** explicitly deletes `session_completions`, `subscriptions` and `user_settings`,
then calls `auth.admin.deleteUser(uid)`.

**What actually gets deleted:** everything. I verified the foreign keys directly against production.
**Twenty-three tables carry `ON DELETE CASCADE` to `auth.users`**: `user_settings`, `session_completions`,
`session_overrides`, `subscriptions`, `plans`, `plan_archive`, `plan_adjustments`, `strava_activities`,
`run_analysis`, `weekly_reports`, `push_subscriptions`, `health_daily_samples`, `phase_summaries`,
`race_readiness_notes`, `plan_weekly_notes`, `session_reflections`, `free_insights`, `notifications`,
`post_race_reshapes`, `analytics_events`, `ops_events`, `session_metric_overrides`, `daily_coach_notes`.
The three explicit deletes in the route are therefore redundant but harmless.

**What survives:**
- `charity_codes`: `claimed_by` is set to NULL (`ON DELETE SET NULL`), leaving `claimed_at` and
  `expires_at` populated and the code redeemable again. Discrepancy M.8.
- `ai_rate_limits`: the bucket key is text (`ai:<route>:<userId>`) with no FK, so a row containing the
  user ID survives until its window rolls. Minor, but it is a user identifier persisting past deletion.
- `waitlist`: email-keyed, no FK. Currently 0 rows.

**What the privacy policy promises:** permanent deletion of all associated data within 30 days, auth
records immediately, and a 7-day manual route via support@zonna.run if in-app deletion fails. The code
deletes immediately, which is better than promised, with the two exceptions above.

### 27. Privacy policy and terms

Both live and returning HTTP 200: `https://www.zonna.run/privacy`, `https://www.zonna.run/terms`.
Also live: `/support` and `/pricing`.

**Does the privacy policy cover HealthKit?** Yes, well. A dedicated "Apple Health" section names the exact
read-only permissions, states that Zonna never writes to Apple Health and never reads outside that list,
distinguishes what is stored per run (summary values **and** the per-workout HR sample stream) from what
is stored for daily recovery (one summary value per metric), and tells the runner how to revoke from iOS
Settings.

**Does it cover AI processing?** Yes, but **understated**. The Anthropic section says session data is sent
to generate a coaching response and that Anthropic does not train on API inputs by default. It does not
say that the runner's first name and injury history are included. That is the correction in checklist
item 3.

**One further gap:** Resend is not listed as a processor.

### 28. Support route

- **In-app:** Me → Support (`SupportScreen`), which opens a pre-filled email to `support@zonna.run` and
  offers a copy-to-clipboard button for the address. Free for all tiers.
- **Web:** `https://www.zonna.run/support`, live, covering contact, account recovery, billing and data
  questions. Billing refunds are correctly routed to Apple.
- **Email:** `support@zonna.run`, the single channel, described in-app as "a real person reads it".
- **There is no live chat, ticketing system or help centre**, and no in-app FAQ. For 500 runners arriving
  in a single cohort, this is worth thinking about: a single inbox is the whole support surface.

---

## Part 6: App Store and onboarding

### 29. Version and minimum iOS

| Field | Value | Source |
|---|---|---|
| Bundle ID | `app.zonna.ios` | `capacitor.config.ts` |
| App name | `Zonna` (sourced from `BRAND.name`) | `capacitor.config.ts` |
| Marketing version | **1.9.1** | `ios/App/App.xcodeproj/project.pbxproj` |
| Build number | **15** | same |
| **Minimum iOS (app target)** | **16.6** | `IPHONEOS_DEPLOYMENT_TARGET` |
| Widget extension target | 26.4 | same file, widget target only |

**UNVERIFIED:** whether 1.9.1 build 15 is what is actually live on the App Store. Check App Store Connect.

Worth knowing for a charity cohort: **iOS 16.6 excludes iPhone 7 and older** (iOS 16 requires iPhone 8 or
newer). With ~500 runners, a handful will be on older hardware and cannot install. There is no Android
build and no mobile web fallback for the dashboard beyond what the browser gives.

### 30. First-run flow and code entry

See section **K** for the screen-by-screen table with tap counts. Summary: **~32 taps** from install to
first session for a charity runner who redeems during setup.

**Where the code entry sits:** three places, all reaching the same `RedeemCodeScreen`.

1. **Inside the wizard, on the very first step** ("How far?"), as a quiet underlined "Have a charity
   code?" link. Shown when `isOnboarding || !hasPaidAccess`. This is the one that matters for this
   cohort: it is the earliest possible moment, and it is before the runner meets the marathon lock.
2. **Me / profile**, as "Charity access".
3. **Upgrade screen**, which is where a runner who put the email away meets it at the gate.

**One thing to flag about ordering.** A runner who does *not* redeem first will tap Marathon on step 1 and
meet a PAID lock that routes to Upgrade. The redeem link is on that screen too, so the path recovers, but
the first thing a Make-A-Wish runner sees would be a paywall. **The charity's instructions should tell
runners to tap "Have a charity code?" before choosing their distance** (this is why step 2 of the
three-step wording in section I says exactly that).

### 31. Zone education for someone who has never heard of Zone 2

There is more of this than most apps ship, and it is deliberate.

| Surface | What it does | When |
|---|---|---|
| **Wizard interstitial A** | "This plan will feel too easy at first." Eyebrow: *Hold the zone*. Placed immediately after the goal is stated, when ambition peaks. | Every plan, both tiers |
| **Wizard interstitial B** | "Easy should feel easy." Eyebrow: *The easy day*. Placed after the benchmark, just before the runner commits their week, when pace is known. | Every plan, both tiers |
| **Orientation screen** | After the first plan ever: "Your plan is set", the race card, total weeks, and the first upcoming session named with its type colour. | Once, first plan only |
| **ZoneInfoSheet** | A slide-up sheet with three lines per zone (what it is, how it should feel, why it matters) plus the runner's live HR band in bpm. Reachable by tapping the zone chip on any session card, or a zone row in the profile. | On demand, any time |
| **Plan intro card** | Zone introduction after the plan is generated | Post-plan |
| **ZoneBar / ZoneRings** | Visual zone primitives on Today, Session Detail and the profile | Ongoing |
| **Session Detail prescription card** | Names the zone, the HR target and the estimated pace bracket at the top of every session | Every session |
| **In-product voice anchor** | "Hold the zone." appears on the loading, connect and orientation screens | Ongoing |

The two wizard interstitials are counted separately from the questions in the progress bar, which counts
real questions only, so the teaching does not read as extra form-filling.

**Assessment for this cohort:** this is genuinely well covered for a first-time marathoner. The one
thing a complete novice does not get is an explanation *before* they have a plan, i.e. on the login or
marketing surface. `https://www.zonna.run/charity-runners` exists and is live, and is the natural place
for the charity to link.

---

## Appendix: how each claim was checked

| Area | Method |
|---|---|
| Feature gates, tiers, enforcement | Read `featureGates.ts`, `canUseFeature.ts`, `trial.ts`; grepped all 26 `isFeatureAllowed` call sites |
| Charity mechanism | Read `lib/charity/*`, `app/api/charity/redeem/route.ts`, `RedeemCodeScreen.tsx`, `scripts/mint-charity-codes.ts`, migration `20260911_charity_access_codes.sql` |
| Wizard steps | Read `getStepSequence()` and `STEP_META` in `GeneratePlanScreen.tsx` |
| Plan lengths and refusals | Read `planSignatures.ts`, `inputs.ts → validatePrepTime`, `GENERATION_CONFIG.PREP_TIME_THRESHOLDS` |
| HealthKit | Read `lib/health/clientSync.ts`, `lib/health/adapter.ts`, `app/api/health/ingest/route.ts`, ADR-011 |
| Supabase usage | Live SQL against project `wkppmpsvqkaxbekdgzdm`: table sizes, row counts, per-column sizes, FK delete rules, view definitions, org plan |
| Vercel plan | Live API call, `list_teams` → `plan: "hobby"`; `.vercel/project.json` |
| Platform limits | Fetched `vercel.com/docs/limits`, `vercel.com/docs/limits/fair-use-guidelines`, `supabase.com/pricing` |
| Claude pricing | Fetched `claude.com/pricing`; models read from `lib/ai/models.ts`; `max_tokens` grepped from every call site |
| Legal pages | `curl` HTTP status against the four live URLs; read `app/privacy/page.tsx` |
| iOS version | Read `ios/App/App.xcodeproj/project.pbxproj`, `capacitor.config.ts` |
| Deletion | Read `app/api/delete-account/route.ts`; queried `pg_constraint` for every FK to `auth.users` |
