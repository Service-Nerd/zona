# SLT — `OPS-ARTIFACT-PLACEMENT-01`, final ruling (2026-11-20)

**Ruling: RETIRE the Coach weekly share card (`SHARE-01`'s `ShareWeekButton` and the
weekly zone card behind it) and CLOSE the item.** Not a freeze, not a wait.

Founder instruction for this sitting: a final ruling today; "not ready / wait for reach" is not an
acceptable answer, because the 2026-10-05 condition (reachability) has been unmet for 46 days.

Prior decision: `docs/decisions/2026-10-05-slt-artifacts-unfrozen.md` (freeze stands, condition
replaced from *usage* to *reachability*). An earlier sitting today returned NOT READY on the same
evidence; this sitting exists because the founder overruled waiting as an outcome.

---

## Registry check

`SHARE-01` is shipped (feature-registry row, PAID, 2026-05-23). `SHARE-ICON-01` (2026-10-31) made it
an icon on four surfaces via `components/shared/ShareControl.tsx`. `COACH-KIT-CAUGHT-01` (2026-10-31)
already **retired `SHARE-01`'s free upsell button**. `OPS-ARTIFACT-REACH-01` (2026-09-28) shipped the
four events this sitting reads. Nothing here is a rebuild; the question is whether a shipped surface
stays.

**One-line brief:** keep, fix, or retire the share-your-week control on Coach, which almost nobody
can see.
**Tier:** PAID (unchanged; `SHARE-01`). Retirement removes a PAID richness surface; no access is
gated by it, so "gate richness, never access" is untouched.

---

## Analysis (written before any seat spoke)

### Figures: the item vs today

| | item / 10-05 | earlier today | re-run for this sitting |
|---|---|---|---|
| can see `ShareWeekButton` | 2 of 41 accounts | 1 of 37 metric users | **1 of 56 accounts / 1 of 37 metric users** |
| unsuperseded weekly reports | 18 across 3 users | 38 / 14 users | **38 across 14 users** |
| of which carry a score | 13 across 2 users | 5 / 2 | **5 across 2 users**; newest 2026-11-19 |
| scored reports, last 28 days | n/a | 2 users (1 metric) | **5 reports, 2 users (1 metric)** |
| `share_week_pressed` | 0 | n/a | **11 events, 2 users: 10 by an admin account, 1 by one metric user** |
| `share_week_result` | 0 | n/a | **29 events; outcomes fetching / sharing / cancelled / error only; 0 `success`, 0 `downloaded`** |
| `coach_open` | n/a | n/a | 315 events, 22 users (16 metric) |
| `ledger_view` | 164 / 10 users | n/a | 283 events, 20 users (18 metric) |

Commands (both read-only, selects only):
```
npx tsx scripts/board-evidence-slt-2026-11-20.ts            # OPS-ARTIFACT section
npx tsx scripts/board-evidence-ops-artifact-placement-01.ts # presses, outcomes, report timing, null-score join
```

**What moved since 10-05:** the account base grew (41 → 56) and the reach did not (2 → 1).
Coach is opened by 22 users; the share control appears for 1. **The constraint is not Coach traffic.**

### Why reach is ~1: two independent gates, measured

The render condition (`app/dashboard/DashboardClient.tsx:6248`) is
`reportIsCurrent && weeklyReport?.zone_discipline_score != null`, on the paid Coach screen.

1. **The score gate is honest, not a defect.** 33 of 38 unsuperseded reports carry a null
   `zone_discipline_score`. Joined against `run_analysis` on (user, `week_n`): **0 of the 33 have any
   analysed-HR row for that week** (6 have a `run_analysis` row of some kind, none with
   `hr_in_zone_pct`). The score is null because there is no HR to score (`WeeklyReportData` documents
   it: *"null when no Strava-analysed HR data"*). That is the ADR-011 consequence (iPhone-only runners
   get no HR coaching), so **the ceiling on this artifact is the HR-analysed population, and no
   change to the button can raise it.**
2. **The week gate is structural.** The weekly-report cron runs `0 18 * * 0` (Sunday 18:00 UTC);
   **32 of 37 reports since 10-20 were generated at that hour.** The report is keyed to the week
   current *at generation*. The button requires that week to still be current *when viewed*. Once the
   plan week rolls, the Coach card itself says *"Last week's report is below."* and the button is
   gone. Measured: report week trails plan week for 12 of 14 report-holders today. ⚠️ The exact
   length of the visible window depends on each plan's week boundary and was **not measured**.

So even a perfect fix to gate 2 lifts reach from 1 to **at most 2 users** (the only two with any
scored report in 28 days, one of them an admin). A dated kill-condition over that denominator is the
10-05 trap again.

### Usage, such as it is

All 11 presses: 10 from one admin account across five weeks, 1 from one metric user (2026-11-02,
ended `cancelled`). **No `success` outcome has ever been recorded.** Three early attempts (10-25 to
10-31) ended `error`. ⚠️ Whether the iOS path ever reports a genuine share as `cancelled` was **not
verified**; the claim made here is only that no success has been recorded.

### Settled-ground scan

- `2026-10-05-slt-artifacts-unfrozen.md`: condition replaced with reachability. Today answers it:
  reachability is capped by HR availability, not by a fixable gate.
- `COACH-KIT-CAUGHT-01`: the free upsell to this card was already retired. The card has no role left
  in the paid proposition's marketing: `/pricing` and the homepage mention it **zero** times (recorded
  by `OPS-ARTIFACT-REACH-01`; I grepped `app/pricing` and `app/page.tsx` for share copy today: 0 hits)
  and there is no `featureGates.ts` key for it, so `lib/marketing/pricing.test.ts` does not bind.
- `design-rulings.md` row 4099 (Kaevor #2): an HR-gated discipline card is *"a reward for owning a
  watch"*. Recorded there as a reason not to ship a second one; it applies equally to this one.
- `SHARE-ICON-01`: rules *how* share looks on four surfaces. Retiring one surface narrows that ruling's
  scope; it does not reverse its pattern (see hand-off).
- `LEDGER-01` / `LEDGER-PLACEMENT-01`: the ledger is the restraint artifact that actually reaches
  people (20 users). Untouched by this ruling.

### What the evidence can and cannot show

Can: reach, its two causes, press and outcome counts. Cannot: whether a reachable share card would
drive referral, because there has never been a population to measure it on, and the HR ceiling means
there will not be one soon. **The ruling is made on that impossibility, not on a measured lack of
demand.**

---

## The board

⚠️ **Seat not at the table:** Traynor (commercial, stood down 2026-09-22). This item is partly a
referral question, which is his lens. Stated so the absence is visible; his standing objection
(*"what is the traffic?"*) is answered by the numbers above: there is none.

### 🧠 Rory Sutherland
"I came in wanting to save it. A share card is the only thing in this app a runner might show another
runner, and word of mouth is the only distribution a product like this really gets. But look at what
it shares: a percentage only a watch-owner can earn, offered for about six hours after a Sunday
evening cron. That isn't a referral mechanism, it's a lottery ticket the house forgot to print. If we
want runners to show off restraint, the thing to show is the ledger, which twenty people actually look
at. Retire this one; don't confuse the idea with the implementation."

### 📦 Jason Fried
"One person in fifty-six can see it. Ten of eleven presses are ours. Zero successful shares, ever.
Every surface we keep costs a contract, tests, an OG route, a client helper and a share-sheet path on
iOS, and it costs attention every time somebody reads `DashboardClient`. We already took its upsell
away in October. Kill it, close the item, and stop holding a meeting about a button."

### 🏃 Alex Hutchinson
"The number it shares is `zone_discipline_score`, a km-weighted time-in-zone mean, and the HR bands it
is computed against were redefined this week under ADR-026. I would not want a number whose definition
just moved printed onto a public image with our wordmark on it, and certainly not one only a minority
of runners can produce. Nothing here touches what the engine prescribes, so the Coaching Board has
nothing to rule. Retire."

### 🔬 Wendy Wood
"Sharing a weekly score is a social trigger. It changes nothing about whether the next easy run is
easy. It is the illusion-of-progress class, and it is invisible besides. I'm using the kill mandate:
retire it. If we ever want a context cue around zone discipline, it belongs at the moment of the run,
not in a Sunday-night artifact."

### 🧭 Julie Zhuo
"What is it for? Referral. Is there a user problem behind it? Not one we have ever observed. Is the
success condition observable? Not at a denominator of one. That makes keeping it a preference. The
design question is narrow: removing the share icon from Coach leaves `SHARE-ICON-01`'s pattern intact
on the run surfaces, so the Design Board does not need to sit. It does need its register to say the
Coach surface is gone, so the four-surface claim stays true."

---

### ⚡ Conflicts

- **Sutherland vs Fried on the idea.** Sutherland retires the *implementation* but keeps the *idea*
  (a shareable restraint artifact) alive, pointing at the ledger; Fried wants the topic closed. Ruled:
  this item closes; a shareable ledger would be a **new item**, filed only if someone proposes it, not
  by this sitting (the founder's "don't invent work" stands).
- **Fix-the-gate vs retire.** The week gate is cheap to fix. Nobody argued for fixing it, because the
  fix lifts reach from 1 to at most 2. Recorded so the cheap option is visibly considered and declined
  on a measurement, not overlooked.

### ✅ Recommendation and ruling: RETIRE and CLOSE

1. **Retire** the Coach `ShareWeekButton` render site, the `ShareWeekButton` component,
   `lib/share/shareWeeklyZoneCard.ts`, `app/api/og/weekly-zone-card/route.tsx`, and its contract
   `docs/contracts/api/og-weekly-zone-card.md`. Retire the `share_week_pressed` / `share_week_result`
   event names from `lib/analytics.ts` and `docs/contracts/api/analytics-events.md` (historical rows
   stay in `analytics_events`; nothing deletes data).
2. **Keep** `ShareControl`, `SaveImageButton`, `shareSessionCompleteCard.ts`,
   `app/api/og/session-complete-card`, `@capacitor/share` and `@capacitor/filesystem`: the session
   share is a separate surface with a no-HR state (State B), outside this ruling. Check
   `lib/brand-og.ts` keeps every export the session route still imports.
3. **Close `OPS-ARTIFACT-PLACEMENT-01`.** Mark the `SHARE-01` registry row **retired 2026-11-20**
   with a pointer here (orchestrator applies).
4. **Return condition (not a wait, a recall trigger):** the share card may be re-proposed as a NEW
   item only if HR-scored weekly reports reach **≥10 distinct metric users in a 28-day window**,
   measured by `scripts/board-evidence-slt-2026-11-20.ts` (today: 1). The code is in git history.

**Owner of the build:** ⚙️ NO BOARD removal build, to be filed by the orchestrator as a retirement
item (suggested scope id `SHARE-01-RETIRE-01`). It changes a visible surface by removal only.

**Build conditions:**
- Regression arms the build must carry: Coach screen renders with no share control; the session
  share (`SaveImageButton` on both completion paths) still renders; `noEmDash`, colour sweep and
  contract audit stay green; `audit-docs.sh` stops expecting the retired contract.
- Falsify the removal arm by re-adding the render site and watching it go red.
- `reportIsCurrent` stays: it still gates the Coach card's other current-week fallbacks.

### Hand-offs

- 🧭 **Design Board, notified, not convened:** `SHARE-ICON-01` names four surfaces. The orchestrator
  should append a scope note to its `design-rulings.md` row: *"Coach surface retired by SLT
  2026-11-20 (`OPS-ARTIFACT-PLACEMENT-01`); pattern unchanged on the run surfaces."* Per ADR-023 an
  SLT decision that changes a design ruling's scope is recorded, not silent.
- 🏃 Coaching Board: none (no prescription change).

### 🚨 MUST/NEVER check

No modal, colour, gamification, schema change, or source-filtered query. Removal reduces a
watch-owner-only social trigger, which moves *toward* the no-gamification line. Free users lose
nothing (the control was PAID and its free upsell is already gone). No hardcoded brand strings involved.

### ⚠️ Risks to existing features

- `lib/brand-og.ts` is shared by three OG routes; removing one must not remove a shared export.
- `ShareControl` is shared; its markup test asserts no `Button` labelled Share **anywhere**, and must
  still pass with one fewer consumer.
- `lib/coaching/analysisSupersedeReaders.test.ts` and `lib/coaching/sessionDayShape.test.ts` reference
  the weekly-zone-card route; the build must update them, not delete their other arms.
- Component-contract baselines in `audit-docs.sh` may move by one; declare it.

---

## What this does NOT prove

- That a share card cannot work. It proves this one cannot be seen by enough people to find out.
- That iOS `cancelled` outcomes were genuine cancels (not verified).
- Why 27 of the 33 null-score report weeks have **no `run_analysis` row at all** (no runs, unlinked
  runs, or an analysis gap). Not measured; outside this item.
- The exact per-plan length of the window in which `reportIsCurrent` is true after the Sunday cron.
