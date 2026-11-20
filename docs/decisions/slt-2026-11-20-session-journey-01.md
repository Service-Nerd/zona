# SLT — SESSION-JOURNEY-01: the 2026-11-04 re-measure, run on 2026-11-20

**Sitting:** SLT, one sitting. **Input:** the 2026-10-07 ruling (`slt-2026-10-07-session-journey.md`), which
deferred on a date (2026-11-04) and a number (users who log a session, 6). The re-measure is **16 days late**.
Traynor's commercial seat is stood down; revenue is still zero, so nobody prices churn (stated, not silent).

## Evidence (production, read-only)

Command: `npx tsx scripts/board-evidence-slt-2026-11-20.ts` (selects only). "Since fix" = rows created on or
after 2026-10-08, the day after the four 10-07 defects were fixed. `METRIC` = `v_metric_users` (excludes 18
internal accounts and 1 admin), which did not exist on 10-07; the 10-07 funnel counted every account.

| Step | 10-07 (all accounts) | 11-20 all accounts | 11-20 metric users |
|---|---|---|---|
| Accounts | 43 | 56 | 37 |
| Have a plan | 30 | 43 | 29 |
| Connected a health source | 28 | 38 | 27 |
| Ever had a run arrive | 16 | 27 | 22 |
| **Logged a session (ever)** | **6** | **14** | **8** |
| Logged a session since 10-08 | — | 11 | 8 |
| ...who had never logged before 10-08 | — | 7 | 6 |
| Auto-linked a completion since 10-08 | — | 7 | 5 |
| Got a scored read (ever) | 3 | 6 | 4 |
| Logged anything in the last 14 days | 3 | 8 | 7 |

- **The deciding figure moved 6 → 14 on the 10-07 definition**, and 7 of the 14 are people who first logged
  after the fixes. On the honest population it is **8 of 29 plan-holders (28%)**, all 8 since the fixes.
- ⚠️ **The denominator moved too** (plans 30 → 43). Rate on the 10-07 definition: 6/30 = 20% → 14/43 = 33%.
  It improved; it did not cross half.
- 🔴 **The step-3/4 break is still the shape of the funnel.** 22 metric users have had a run arrive; 8 have
  ever logged. **12 metric plan-holders have runs and have never logged a session**, and the runs keep
  coming: 271 activity rows from metric users since 10-08 against 43 completion rows. Of the 12:
  4 free with 5+ runs since 10-08, 4 paid with 5+, 2 paid with 1–4, 1 trial with 1–4, 1 free with none since.
  **Six of them hold paid or trial access and are running regularly, and nothing links.** Why is not measured
  here (it is a diagnosis, not a count).

**What the evidence cannot show:** whether the movement is the fixes or the new cohort (43 vs 30 plans); why
12 runners' runs never become completions; anything about step 6, because 4 metric users have a scored read.
Nothing has run on a device.

## The board

🧠 **Sutherland:** "It more than doubled, and that is the first good news this item has had. But read who it
doubled among: people whose watch already sends us the run. Twelve runners are doing the hard part, going out
and running, and the app is failing to notice. That is not a motivation problem; you cannot nudge someone into
a behaviour they are already performing."

📦 **Fried:** "Same answer as October, sharper. Four people have a scored read. Building the plan-level view
for four people while six paying runners' runs fall on the floor is building the attic before the stairs.
Don't build step 6."

🏃 **Hutchinson:** "Nothing here touches prescription. One coaching note: a block-level read built on 8 runners'
completions would be summarising almost nothing; I would not put a trend in front of anyone on that supply."

🔬 **Wood:** "The October kill stands on step 6. What changed is that step 4 is now measurable as a failure of
*context*, not demand: runners run, the run arrives, the link does not happen. That is exactly the friction
point that matters, and it is invisible to them. Fix the environment, not the screen."

🧭 **Zhuo:** "My October condition is unmet: nobody has walked the journey on a device. But the count has done
something useful; it has located the break. The next deliverable is not a design. It is finding out why twelve
runners with runs have zero completions."

## Conflicts

- **Sutherland vs Fried on whether the rise is a win.** Sutherland: the rise proves the fixes worked and the
  item is alive. Fried: the absolute number (8 real people) is still too small to fund anything above step 4.
  Both are recorded; neither changes the ruling.
- **Unpriced:** what the 12 silent runners cost in churn. Silence, recorded as silence.

## Ruling — DON'T BUILD (step 6 and step 3), item re-scoped to step 4

1. **Step-6 aggregation: still DON'T BUILD.** Supply is 4 metric runners with a scored read.
2. **Step-3 (mid/pre-run surface): still DON'T BUILD.** No device walk exists.
3. **The deciding figure moved (6 → 14; 8 honest), so the October hypothesis "no demand" is refuted; the
   break is now located at step 4.** The board names the next question: why do 12 metric plan-holders with
   arriving runs (6 of them paid/trial, running weekly) have zero completions? That is a defect investigation
   (`/zona-debug`), ⚙️ NO BOARD, not an SLT build; the orchestrator files or routes it — this sitting files
   nothing.
4. **Re-measure again only after (3) is answered**, with the same script, so the definition does not drift.
5. Zhuo's walked-journey condition stands for any future step-3 or step-6 sitting.

**Hand-off:** none to another board. Step 4's investigation is ⚙️ NO BOARD.

## What this does not prove

That the fixes caused the rise (cohort grew 43%); why the 12 do not link; anything about willingness to pay.
"Logged a session" counts superseded rows as 10-07 did (13 vs 14 live-only, all accounts).
