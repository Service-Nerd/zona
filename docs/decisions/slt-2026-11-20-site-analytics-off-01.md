# SLT: turn on page analytics for the marketing site (2026-11-20, SITE-ANALYTICS-OFF-01)

**Input:** founder, 2026-11-20: run each item's one relevant sitting. **This item must be ruled today; NOT READY is not
an acceptable outcome.** Item filed 2026-11-20 by the `RUNKED-COMPARE-PAGE-01` sitting.
**This sitting rules on whether to enable, and on cost.** The wiring is ⚙️ NO BOARD and is a hand-off, not built here.
**Nothing was enabled on Vercel by this sitting.**

**One-line brief:** should the marketing site get cookieless page analytics (Vercel Web Analytics, the only candidate
already inside the existing sub-processor), so the sittings that keep ruling on "no data" can rule on a number?
**Tier:** none (an internal measurement instrument, not a runner-facing feature). Not in `feature-registry.md`.

## Analysis, before any seat spoke

| Item says | Re-measured 2026-11-20 | How |
|---|---|---|
| Web Analytics not enabled on `zona`; pageviews API returns 400 | **Confirmed.** *"Web Analytics is not enabled for this project (400)"* | `vercel api "/v1/query/web-analytics/visits/aggregate?projectId=prj_Ht3ZCjCSoQCYk1WRPdmVEKXOJ5V3&teamId=team_djqnDcvo3ry8S6DE34NuY7fj&by=day&since=2026-11-01T00:00:00Z&until=2026-11-20T00:00:00Z"` |
| (not stated) | The project record carries a `webAnalytics` object with an `id` and **no enabled timestamp**; `speedInsights.hasData: false` | `vercel api /v9/projects/prj_Ht3ZCjCSoQCYk1WRPdmVEKXOJ5V3` |
| Vercel on Pro since 2026-10-14 | **Confirmed `pro`** | `vercel api /v2/teams/team_djqnDcvo3ry8S6DE34NuY7fj` → `billing.plan` |
| "the site has no other page analytics" | **Confirmed.** `@vercel/analytics` is not a dependency (only `@vercel/functions`); no Plausible/PostHog/GTM/Umami/Fathom script anywhere in `app/ components/ lib/`. ⚠️ **So enabling the dashboard toggle alone would collect nothing** — the script must be mounted in code | `grep '"@vercel' package.json`; `grep -rn` for each vendor |
| 8 comparison pages, 1 guide, 9 plan pages unmeasured | Counts not re-derived here (taken from the `RUNKED-*` sittings the same day). **10 docs** in the decision/ruling/backlog record name "no analytics" as the reason a question could not be settled, 8 of them decision notes, from 2026-09-20 to today | `grep -rlE "no site analytics\|no analytics\|no page analytics\|Web Analytics is not enabled" docs/decisions docs/canonical/design-rulings.md docs/releases/backlog.md` |
| `SITE-SCROLL-DEPTH-01` blocked on the same absence | **Confirmed.** It needs scroll depth to the `W-02` section and `SameWeekTwice` on `/`. Pageviews alone will NOT unblock it: it needs **custom events** | backlog `SITE-SCROLL-DEPTH-01`; design-rulings `:5002` |

**Cost (Vercel docs, `/docs/analytics/limits-and-pricing`, last updated 2026-08-25).** Pro: **no included events,
$0.03 per 1,000 events**, charged against the Pro monthly usage credit; custom events included with **2 properties**;
12-month reporting window. The $10/month Web Analytics Plus add-on (UTM, 8 properties, 24 months) is **not needed**
for any question on the record. ⚠️ **Traffic is unknown, so the bill is unknown**; the arithmetic is 100,000 events =
$3.00. **Not measured:** how much of the monthly credit is already consumed.

**Privacy (Vercel docs, `/docs/analytics/privacy-policy`).** No cookies; a visitor is a hash of the incoming request,
discarded after 24 hours; stored per event: timestamp, URL, dynamic path, referrer, filtered query params, coarse
geolocation, OS, browser, device type. Vercel is already the hosting sub-processor, so no new third party.

**Three facts that shape the wiring, found in analysis:**
1. **There is ONE root layout** (`app/layout.tsx` renders `CapacitorBoot` beside every page) and no route group:
   marketing pages are siblings of `/dashboard`, `/auth` and the `*-preview` routes. The iOS app loads the same
   Vercel origin via `server.url`. **A naive `<Analytics />` in the root layout would count the signed-in app and the
   iOS webview too.**
2. **`/auth/reset` carries `token_hash` in its query string** (AUTH-RESET-01). Vercel filters query params, but a
   recovery token is not something to rely on a vendor filter for.
3. **`app/privacy/page.tsx:89` says, today:** *"We do not currently collect analytics or behavioural data beyond what
   is required for core app functionality. When analytics are added, this policy will be updated."* The page
   promises its own update.

**Settled ground.** SLT 2026-09-20 `CONSENT-UI-01` (memory `project_consent_ui_slt.md`): **no consent screen;
disclosure, not ceremony**; a usage-analytics *toggle* was rejected because gating it would throttle instrumentation.
That ruling assumed analytics with nothing to consent to; cookieless counting with no device storage is that shape.
`LEGAL-COUNSEL-01` (founder) is still open on consent-vs-disclosure. 2026-10-02 SLT froze `OPS-ARTIFACT-PLACEMENT-01`
on the same missing population. Traynor's seat is stood down; his recall trigger is unmet.

**What the evidence can and cannot show.** It shows the instrument is absent, cheap per event, cookieless and inside
an existing sub-processor. It cannot show traffic, so it cannot price the bill to the dollar, and it cannot say whether
counsel would call request-hash counting "access to terminal equipment".

## The board

🧠 **Sutherland.** We have spent two months holding sittings whose conclusion was "we cannot know". That is not
restraint, it is a ritual. The cheapest thing in this whole backlog is the ability to stop guessing, and we keep
pricing it as if it were a feature. The interesting bit is the asymmetry: the expensive outcome is not the $3, it is
another ten decision notes that end in a shrug. Turn it on.

📦 **Fried.** I asked for "one guide, then wait a fortnight". The fortnight taught nothing, which means I set a rule
nobody could read the result of. That is on us. I want the smallest thing: pageviews on marketing pages, plus the two
scroll-depth events the Design Board already named. No dashboards, no UTM add-on, no funnel builder, no weekly report
anybody has to look at. Count, then answer the questions already on the record. Anything beyond that comes back here.

🏃 **Hutchinson.** No coaching question in this. One guard from my side: a number on the site must never become a
claim on the site. "Thousands of runners read this" is an outcome claim and would route to the Coaching Board under
W-03. Counting readers is fine; publishing them is not.

🔬 **Wood.** My kill mandate is for instruments that measure nothing anyone acts on. So name the decisions before
enabling, or this becomes decorative: (1) `SITE-SCROLL-DEPTH-01`'s placement ruling; (2) whether any of the 8
comparison pages or the guide has readers, which decides whether `RUNKED-GUIDES-01`'s cadence continues; (3)
`OPS-ARTIFACT-PLACEMENT-01`'s frozen population. If after 28 days of data none of those three has been re-sat, switch
it off. I also want it **off the app**. The app's behaviour is `analytics_events`' job, per user, and a second
anonymous counter over the same screens is two registers with a human in between.

🧭 **Zhuo.** Agree with all of that, and I'll put the wiring condition precisely, because this is where it goes wrong:
the script must be **scoped to marketing routes by an allow-list**, not a deny-list of app routes, so a new
`/dashboard`-like route defaults to *not counted*. The `*-preview` routes and `/auth/*` are excluded. And the privacy
page changes **in the same commit** as the script, because the page currently says the opposite and says it will
change. As Design Board chair: nothing here changes what a visitor sees, so it needs no Design Board sitting; the
scroll-depth item returns to that board with a number, which is what it asked for.

## ⚡ Conflicts

- **Wood vs Sutherland on the stop condition.** Sutherland would leave it on indefinitely at that price. Wood wants a
  28-day review with a kill if no decision consumed it. **Wood's condition carried**: the cost that matters is
  instrumentation nobody reads, which this repo has recorded as equivalent to none.
- **Disclosure vs counsel.** Nobody argued for a consent banner (settled 2026-09-20). Open: `LEGAL-COUNSEL-01` may
  still say consent. The board rules on what exists and names that as the revisit trigger rather than waiting for it.
- **No commercial seat.** Traynor's question, *what is the traffic?*, is the thing this instrument would answer. Noted
  as the first evidence that could meet his recall trigger.

## ✅ Ruling: ENABLE (build differently from a default install)

Enable **Vercel Web Analytics on the Pro plan, without the Plus add-on**, for **marketing routes only**, with
pageviews plus exactly two custom events for `SITE-SCROLL-DEPTH-01`.

**Conditions (all binding on the build):**
1. **Founder action, not the build's:** flip Web Analytics on for project `zona` in the Vercel dashboard. This sitting
   did not, and an agent must not.
2. **Scope by allow-list.** The script runs on marketing routes only (home, `/pricing`, `/plans/*`, `/comparisons`
   and its articles, `/guides/*`, `/about`, the top-level article routes, `/charity-runners`, `/support`, `/privacy`, `/terms`). **Never** `/dashboard*`, `/auth/*`, `/api/*`, any
   `*-preview` or probe route, or inside the Capacitor webview. A route not on the list is not counted. Enforced by a
   test that fails when the script can mount on a non-listed route, falsified by adding `/dashboard` to the list.
3. **No query strings sent** (`beforeSend` drops them), so a token can never leave even if scoping regresses.
4. **Two custom events only**, for `SITE-SCROLL-DEPTH-01`: reaching the `W-02` section and reaching `SameWeekTwice`
   on `/`. No identifiers in event data. Any further event comes back to this board.
5. **Privacy page updated in the same commit** (`app/privacy/page.tsx` § Usage data, and § Cookies stays true): say
   what is counted, that it is cookieless and anonymous, that it covers the website and not the app. Words are the
   founder's to approve (👤), drafted by Claude, per the 2026-09-21 content ruling.
6. **No published numbers.** Readership figures never appear on the site or in marketing copy without a Coaching Board
   claims check (W-03).
7. **Spend guard.** Set a Vercel spend notification on the team before collection starts (founder action).
8. **28-day review.** 28 days after the first event, the orchestrator re-sits at least one of the three named
   decisions on the data. If none is re-sat, the script comes out.

**Revisit triggers:** `LEGAL-COUNSEL-01` concludes request-hash counting needs consent (then switch off pending a
consent design, not a banner by default); or monthly analytics spend exceeds $10 (then re-price against the Plus
add-on and sampling); or the 28-day review finds no consumer.

**Hand-offs:** ⚙️ NO BOARD (wiring, conditions 2–5, with a regression test and a falsification) · 👤 FOUNDER
(dashboard toggle, spend notification, privacy wording) · 🧭 Design Board receives `SITE-SCROLL-DEPTH-01` back **when
there is a number**, not before.

## 🚨 MUST/NEVER check

- No client-side AI calls, no hardcoded colours or brand strings involved.
- No popups or consent wall (consistent with ADR rules and `CONSENT-UI-01`).
- "Free users are never abandoned": unaffected; no app surface changes.
- ADR-011 (data SOR): unaffected; this touches no runner data and no `strava_activities` write.
- Privacy policy promise (`page.tsx:89`): honoured only by condition 5. Shipping the script without it would make the
  policy false on publication.

## ⚠️ Risks to existing features

- **Root layout is shared with the app and iOS shell** (condition 2 exists for this).
- **Bundle:** `@vercel/analytics` adds a client script on marketing pages. `clientBundleBoundary.test.ts` exists because
  this site regressed 110 kB → 251 kB twice; the build must read that gate, not assume.
- **`noEmDash.test.ts`** applies to the privacy wording.
- **`AUTH-RESET-01`** token in the query string: condition 3.

## What this does not prove

Traffic (unmeasured, which is the point). The monthly bill to the dollar (depends on traffic; only the rate is known).
The Pro usage credit already consumed (not measured). That Vercel's request-hash method needs no consent under
UK/EU ePrivacy law (counsel's question, `LEGAL-COUNSEL-01`). That any page has a reader. Nothing was run on a device.
