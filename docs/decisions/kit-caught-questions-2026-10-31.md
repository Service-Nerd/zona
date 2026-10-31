# What Kit caught — four open questions, three boards (2026-10-31)

**Input:** founder, on the `COACH-KIT-CAUGHT-01` mockup (`kit-caught-mockups.png`): *"Get these answered by
appropriate boards."* Routing: Q1 threshold → SLT (it set two). Q2 good news → Coaching Board (what may be claimed),
then Design Board (treatment). Q3 Upgrade-screen placement → Design Board, then SLT. Q4 the free weekly insight → SLT
(cost, tier) with the Design Board (one Kit voice).

## Measured first (production, read-only)

| | Figure |
|---|---|
| Free runners with a plan and runs in the last 10 weeks | **11** |
| …with ≥1 receipt / ≥2 receipts / none | **7 / 4 / 4** |
| Receipt kinds among them: a run mostly in Zone 3 · a week off their normal · longest easy run ≥80% in Z1–2 · "easiest week" | 6 · 4 · 1 · 0 |
| Free runners who opened Coach (the teaser), 56 days | **11**, ~58 events (Pro: 7, 225) |
| Free weekly insight model calls, 56 days | **2, for 1 runner** (it needs ≥2 RPE logs in 7 days; everyone else sees *"Example — not your data"*) |
| Upgrade-screen views by source, 56 days | today 8 · me 3 · wizard 2 · **coach_teaser 2** |
| Purchase attempts, 56 days | **4, all `failed`** (not cancellations), 2 different runners, none an admin → filed `IAP-PURCHASE-FAILED-01` |

## Coaching Board — Q2: may a receipt say something went well?

**Conflict scan:** §131 (moments are earned, never a badge or a longest-run record) · §132 (kinds by time in zone) ·
§130 (describe, never grade) · P-01 (moss = held, amber = cooked; threshold `ZONE_DRIFT_ABOVE_CEILING_PCT`) · §12.

⚕️ **Sims:** *"Seen means noticing what they did right too. A list of only misses is a report card."*
🩹 **Willy:** *"Then it must not become a longest-run receipt; that rewards distance. Say the run stayed easy, not that it
was long."* 📊 **Seiler:** *"And give the share, not 'all of it'. Wrist HR is never all of anything."*
🎯 **McMillan:** *"The long run is the one that matters to hold easy. Pick it, but don't name it as long."*
🏃 **Hutchinson:** *"A receipt states a measured share of one run. That is a description, inside §130."*

**Ruling: CORRECT WITH AMENDMENT.** A good-news receipt is allowed: the runner's longest `easy`-kind run (§132) in the
window, when at least **80%** of it sat in Zones 1–2, stated as its date, distance and measured share (*"23 Oct, 6 km:
100% of it in Zones 1–2"*, never "all", never "longest"). One per list. The threshold becomes a named constant at build
(`COACH_RECEIPT_EASY_MIN_PCT`, §133), with its test. Measured: fires for 1 of 11 free and 3 of 9 Pro runners.

## Design Board — Q2 treatment, Q3 placement, Q4 one voice

**Settled ground:** P-01 (moss held / amber drifted) · CO-ONE (one Kit voice) · SHARE-ICON-01 · Upgrade screen pattern
(`frontend-design` § Upgrade Screen Pattern: feature list with left accent, honest pricing, free path visible).

✋ **Silvanto:** *"Use P-01's pair for the dots: moss for held, amber for drifted. No third colour."*
📱 **Wroblewski:** *"Three receipts at most, no tap targets, and the same card on Coach and on Upgrade so it is
recognised."* 🎓 **Sierra:** *"On the Upgrade screen the receipts answer 'what would I lose?' with the runner's own week.
Put them above the feature list."* 🎪 **Collins:** *"Coach would then show two Kit cards, the insight and the receipts.
That is CO-ONE broken on the free screen."*

**Rulings:**
- **Q2 treatment: SHIP.** Moss dot for a held run, amber for a drifted run or a week off normal (P-01's pair).
- **Q3: SHIP.** Receipts sit under the Upgrade headline, above the feature list, for a trialling runner and a
  trial-ended runner (*"In your trial, Kit caught"*). Same card as Coach, ≤3, no taps. Reached only by tapping upgrade.
- **Q4: one Kit card on free Coach.** Receipts and the free insight never render together (CO-ONE). See the SLT for which.

## SLT — Q1 threshold, Q3 surface, Q4 the free insight

⚠️ No commercial seat (Traynor stood down); nobody prices conversion, and there is no trial-to-paid rate to price it with.

🧠 **Sutherland:** *"One true, specific sentence about my Tuesday beats an empty card. Two was a guard against padding;
padding is now impossible by construction."* 📦 **Fried:** *"The free insight ran twice in eight weeks. Everyone else
sees an example labelled 'not your data'. That is the teaser's job done badly."* 🏃 **Hutchinson:** *"But it is the only
free coaching for a runner with no heart rate; receipts need HR. Don't take that away from them."* 🔬 **Wood:** *"Then
let it stand only where receipts cannot: no HR, but RPE logged."* 🧭 **Zhuo:** *"Which also settles CO-ONE."*

**Rulings:**
- **Q1: AMENDED — from ONE receipt** (7 of 11 free runners, against 4 at two). Max three. Zero → *"Nothing yet."*
- **Q3: BUILD.** The Upgrade screen is reached by a tap, so it stays within "behaviour, never a calendar date".
- **Q4: the free insight becomes the fallback.** Shown only when the runner has no receipt AND has logged RPE; never
  beside receipts. The *"Example — not your data"* state is retired from Coach. The route and its Haiku call stay.
- **Measure after build:** `upgrade_view` from `coach_teaser` (2 in 56 days today) and from the Upgrade screen's
  receipts. With 11 free openers, one runner moves a rate ~9 points; say so when reported.

## What this does not settle

- `IAP-PURCHASE-FAILED-01`: if purchases fail, no surface converts. It ranks above this build.
- Nothing seen on a device. The 80% threshold was measured on 20 runners.
