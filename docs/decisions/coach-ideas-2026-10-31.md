# Coach: ideas sitting — Design Board, competitors re-read (2026-10-31)

**Input:** founder, 2026-10-31, after the shipped Coach screen on device: *"I want the design board to convene again
with full knowledge of what currently exists on the coach screen and conditions they present themselves and the
layout… a full review of competitors and screen shots and analysis we have already seen… ideas that make a runner want
to buy the pro offering, feel understood, feel they are seeing progress or if not why, and some real wow moments and
competitive edge. I want ideas and to see mock ups."*

**Trigger:** hard (new Coach sections proposed). **Status:** IDEAS + MOCKUPS. **Nothing built, nothing ruled for build.**
Mockups: `coach-ideas-mockups.png`, sent to the founder 2026-10-31, drawn with his production data.

## What the board read first

1. **The screen as the code renders it**, every state and threshold (`CoachScreen`, `DashboardClient.tsx:5212–6240`):
   Kit's read (10 states) with the rings inside it (headline at ≥2 runs with zone data, `COACH_EASY_SHARE_MIN_RUNS`);
   "This week" (load verdict at ≥3 of 4 prior weeks, 8 bars, runs + strength foot); easy run trend (live / steady /
   pending with pips); race projections last. Free runners get `CoachTeaser`.
2. **Every competitor source in the repo**: Miles (17 screens, T-01…T-20, P-01…P-16, M-1…M-9), Planzy (28 screens,
   CI-1…CI-7), Runna (three screens, described only), Runked (App Store images), Coopah, Garmin, WHOOP/Oura, Trenara,
   NRC. The board looked again at the Runked fitness/fatigue and streak screens, Planzy's progress projection and
   Miles's plan screen. Caveat carried from the record: **no competitor app was ever used on a device.**
3. **The founder's own data, measured** (production, read-only, runs since 2026-09-06): easy ceiling **145 bpm**
   (resting 51 / max 185, 70% of reserve); **6 of 16** runs with HR landed between the ceiling and 158 (the grey zone);
   **5 of 6** midweek 8–10 km runs finished above 145 while every long run before 11 Oct stayed under it; matched pair
   **23 Aug 9.3 km 7:06/km 146 bpm vs 27 Oct 9.5 km 6:19/km 155 bpm**.

## Findings the founder did not raise

| Finding | Effect |
|---|---|
| **His four long runs since 11 Oct carry no heart rate** (16.3, 15.5, 14.5, 10.0 km; `avg_hr` null) | The rings count "across 1 run", so the easy-share headline (ruled 10-30, built) is hidden on his own screen this week. Founder declined an investigation this sitting; recorded, not filed |
| Two different numbers are called "zone discipline" | The rings' easy share (all runs) vs the sheet's prescribed-zone % (matched runs) |
| The free teaser sells a "zone discipline score" and "Load ratio" tiles | Paid Coach no longer has either |
| The stale-report headline says "Last week's report is below." | Nothing below renders it |
| The load card shows "Not enough runs yet" while still loading | No skeleton state |
| The trend skeleton shows a second Kit byline | Conflicts with "Kit appears once" (CO-ONE) |
| `screen-architecture.md` lists the Coach blocks in the wrong order and calls the headline "not built" | Doc drift |

## The sitting

🧭 **Zhuo (chair):** *"The brief has four asks: want Pro, feel understood, see progress or why not, wow. Most of the
current screen answers the third. Nothing on it answers the first for a free runner, because the teaser sells things
that no longer exist."*

✋ **Silvanto:** *"The strongest thing we hold is the picture of the grey middle itself. Not a score: each run, placed
by its effort, against a ceiling. Two clusters is a disciplined runner; one clump in the middle is the problem the brand
names. Now first: Kit's read, then the rings. Over time: the effort picture, then progress, then the race."* No veto
exercised; idea 4 (the reveal) is within the palette and type scale.

🎓 **Sierra:** *"'Same run, then and now' teaches more than any trend line: the runner recognises the run. And when the
answer is 'not easier', saying why is the bit that makes them better: you got faster faster than you got fitter."*

📱 **Wroblewski:** *"The questions must be preset, three of them, answered in the card. A text box on Coach is a chat
product, and a chat product is a different screen with a different cost."* **Against** the questions shipping before
the other five.

🎪 **Collins:** *"Runked's answer to 'feel seen' is a streak and a chest. Planzy's is a curve that is a promise. Ours is
a dot plot that tells a runner the truth about their Tuesdays. That is the competitive edge, and the Sunday reveal is
the moment they screenshot it."* **For** the reveal, **for** the questions.

**Advisory (SLT, recorded):** Sutherland's standing dissent from `RUNKED-LOAD-VIEW-01` applies to idea 1: *give the
restraint picture away free*, because the sentence a competitor cannot say is the advert.

## The ideas

| # | Idea | Answers | Tier proposed | Owner before build |
|---|---|---|---|---|
| 1 | **Every run, by effort**: dot per run on an HR axis with the easy ceiling and grey band; headline count; "what a held month looks like" | understood, wow, edge | Picture FREE, Kit's read of it PRO | 🏃 band edges (ceiling and the grey top, §14) → 🧭 → 💼 tier |
| 2 | **Same run, then and now**: closest match ~8 weeks back, pace + HR + zone bar; "why it isn't easier yet" | progress or why not | PRO | 🏃 match tolerance; Seiler: a picture, never the verdict (the trend stays the judge) |
| 3 | **Kit noticed + ask Kit**: up to three rule-based noticings under the read; three preset questions answered in the card | understood, want Pro | PRO | 🧭 split (Wroblewski against first, Collins for); 💼 cost per tap |
| 4 | **The Sunday reveal**: one full screen, once a week: rings draw, easy share, Kit's headline | wow | PRO | 🧭 motion pattern; no push, never a streak |
| 5 | **Race estimate as a record**: every earned estimate as a dot against the goal line, what moved it; nothing past today | progress | PRO | 🏃 §109 (past only); ⚙️ needs estimate history stored |
| 6 | **What Kit caught**: trial day ~12 and free Coach: the runner's own receipts, the effort picture kept free, honest free path | want Pro | FREE / trial surface | 💼 SLT (conversion surface); replaces the stale teaser |

**Settled ground touched and priced:** CO-ONE stands (all ideas are Kit, one voice). §108 stands (idea 1 is a
placement of measured values, no composite). UX-PROGRESS-01 / §109 stand (idea 5 draws the past only). "Celebration
forbidden, narrowed" (10-30) covers idea 4: no badge, the runner's own number. M-6 (no streak or cumulative total)
stands. Chatbot wizard (Planzy) was killed for the wizard; idea 3 is not a chat, and the board records that boundary.
**Card count:** seven would re-create "seven blocks, no subject"; condition: idea 2 takes the trend card's slot while
no trend exists, rather than adding a card.

## Recommendation

**Order:** 1 → 6 → 2 → 4 → 3 → 5. Idea 1 is the edge and costs no new data; 6 fixes the only surface that sells Pro;
2 and 4 carry the progress and the wow; 3 needs the SLT on cost; 5 needs new storage.

## What this sitting does not establish

- **Nothing seen on a device.** Mockups are static HTML at 375px; idea 4's motion is described, not drawn.
- Idea 5's earlier dots and its "moved after" line are **illustrative**; every other number is the founder's own.
- Idea 1 was measured for **one runner**. Whether the grey-middle count says something true for the other 16 Coach
  openers (and for runners whose HR is wrist-only and noisy, Seiler) is unmeasured.
- No idea has a Coaching Board or SLT ruling yet; tier tags are proposals.
