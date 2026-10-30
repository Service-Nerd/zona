# Coach screen review — Coaching Board + Design Board, joint sitting (2026-10-30)

**Input:** founder, 2026-10-30: *"I still don't feel it adds much value. It doesn't pop enough, there are no or limited
wow moments. It feels flat… Review it from a point of decisions we have already made about it and challenge those if
needed… look at what we found our competitors are doing… Runners love metrics and want to feel seen, heard and like
they are making improvements."*

**Method.** Three reads before any seat spoke: the screen as the code renders it (`CoachScreen`,
`DashboardClient.tsx:5234–6264`), every ruling already taken about it, and the repo's own competitor research. Then
production measured (read-only, 56 days). **Nothing seen on a device.**

---

## 1. What the measurements say, before anyone's opinion

| | Figure |
|---|---|
| Coach opens | **236 by 18 people. 170 of them are one admin account.** The other 17 opened it **66 times**; median **1–2** |
| Of the 17, ran in the period | 12; **11 with heart rate**; the most active runners (19, 25, 25 HR runs) opened Coach **once** |
| Had a weekly report (the main card's content) | **2** |
| Had a run analysis (what the zone rings read) | **4** |
| Apple Health runs that already carry a zone split | **259 of 317** |
| Had recovery data in the last 14 days | 3 |

🔴 **Finding 1: the screen is flat mainly because it is EMPTY, not because it is badly drawn.** For a typical runner
today Coach shows: *"Nothing to read yet. Generate a report…"*, empty zone rings, a race estimate, (until today) *"Not
enough runs yet"*, `X/Y` sessions, and a trend card reading *"— → —"* that *"lands after a few months"*. **Five of the
seven blocks are an empty state for most of the people who open it.** No design pass can make an empty state pop.

🔴 **Finding 2: the Sunday weekly report has not run once in at least 90 days.** `vercel.json` schedules
`/api/push/send-weekly-report` every Sunday 18:00, for every runner with push on (24). It authenticates with
`x-cron-secret` only; **Vercel cron sends `Authorization: Bearer`**, so every call is refused (403). The daily push route
reads the Bearer header and its own comment says why (`send-daily/route.ts:125`): the fix was made on one twin and not
the other. Measured: **0 Sunday-evening reports and 0 `weekly_report` notifications in 90 days**; every report in the
table was a manual tap. This is the main card on Coach, and the screen's stated job (*"Kit's synthesis"*,
`screen-architecture.md:117`). ⚠️ First hypothesis (Vercel deployment protection on the internal URL) was **tested and
wrong**: the deployment URL reaches the route.

🔴 **Finding 3: the zone rings read the narrow source.** `ZoneRings` reads `run_analysis.hr_pct_z*` (runs matched to a
session: 4 people). The activity log already stores the same split for **259 of 317** runs. The identical defect was
fixed for the load tile today (`LOAD-SOURCE-TOTAL-01`).

**Also found in the code** (small, filed as one item): the trend route is called with `include_gloss=true`, so **every
Coach load pays for a model call whose output is never shown**; two props and two computed values are dead; the week
counter is shown twice; the free teaser says the zone score *"Needs Strava"* (false: ADR-011, and the Strava app is
inactive); `screen-architecture.md` still lists the zone discipline tile, the 2×2 grid and the ledger, all removed.

---

## 2. What competitors do, and the crossover (from the repo's own research)

| Competitor | What makes the runner feel seen | Ours | Verdict |
|---|---|---|---|
| Coopah | A weekly coach's report: volume, sessions vs plan, what to focus on | The weekly read | **We have it and it never arrives** (Finding 2) |
| Runna | Post-run insights; PB medals; three big numbers | Post-run analysis + score | Have it; medals killed (gamification) |
| Garmin / WHOOP | One readiness number; "83%… a sense I'm going in the right direction" (founder) | Readiness on Today; post-run score | Have it; composite score forbidden (§108) |
| Runked | Fitness/fatigue picture over weeks | `LoadShape` (+ bars, ruled) | Ruled today |
| Planzy / Miles | Projection chart, projected finish | Race arc (3 points) | Projection killed (UX-PROGRESS-01, §109) |
| WHOOP / Oura | One thing, in tiers: today, am I improving, deep dive | Coach's hierarchy | The finding behind CO-ONE |
| **Nobody** | **Whether your easy runs were actually easy, week by week** | Zone discipline (in a sheet, behind a tap) | **Our one unique metric, and it has no headline** |
| **Nobody** | **Easy runs costing less heart rate at the same pace** | `TrendCard` | Unique; waits months before it says anything |

Collins: *"The one thing no competitor can show is the thing this brand exists for, and on our own screen it is a
percentage inside a sheet you have to tap to find."*

---

## 3. The sitting

🧭 **Zhuo (chair):** *"The founder's word is 'flat'. The measurement says 'empty'. Those need different fixes, and if we
redesign an empty screen we will ship a prettier empty screen. Order matters: fill it, then make it sing."*

🏃 **Hutchinson:** *"Runners do love numbers, and the honest ones we hold are better than our competitors': we can tell a
runner the share of their easy running that stayed easy, and whether easy is costing them less heart rate than in
September. Garmin cannot say the first and Runked will not say the second. We have been hiding both."*

📊 **Seiler:** *"Time in zone from the activity log is the right source: it is what the body did. One caution: a zone
split from wrist HR on a short run is noisy. Show it over the week and over weeks, never one run as a verdict."*

🎯 **McMillan:** *"A runner wants to be told one true thing about their week on Sunday night. We built that and switched
it off by accident. Fix that before anything else."*

🩹 **Willy:** *"'Feel like you are improving' is where apps get people hurt: the record they chase is pace. If we
celebrate anything, celebrate the restraint and the durability: the longest run that stayed easy, a block with no
heavy weeks. Never a pace PB on an easy run."*

⚕️ **Sims:** *"Seen means the app notices what the runner did, including the week life got in the way. A sentence that
names the lighter week without judgement does more for retention than a badge."*

✋ **Silvanto:** *"Now before over time. Today the top of Coach is a paragraph. The thing that should be at the top is one
number the runner believes, with the week's shape under it. Rings are our trademark; give them a headline."*

🎓 **Sierra:** *"Ask what the runner can do after three weeks that they could not before. Answer: see their own easy. A
weekly row of 'how much of your easy was easy' teaches that. A badge teaches nothing."*

📱 **Wroblewski:** *"Count the taps to the one thing we are proud of: two, and a sheet. And the main card asks the runner
to press 'Generate report' to get the coaching they paid for. That is a chore, not a coach."*

🎪 **Collins:** *"It is not quiet because it is right, it is quiet because it is empty and safe. Our wow is the honest
moment: 'your easy runs held the zone four weeks running', said big. Give the discipline number the 56px."*

---

## 4. Settled decisions, re-examined

| Decision | Verdict | Why |
|---|---|---|
| **CO-ONE: one Kit voice, not eleven** | ✅ **Stands** | The fix is that the one voice must actually arrive |
| **UX-COACH-01: four blocks, hierarchy fixed, content stateful** | ✅ Stands | Measured problem is content, not structure |
| **A5: shape, never score** (load) | ✅ Stands | Extended today, not reversed |
| **§108: no composite score** | ✅ Stands | Zone discipline is a measured share, not a composite |
| **Pattern 32: "no tile that restates a chart"** (killed the zone discipline tile) | 🔁 **CHALLENGED, AMENDED** | The tile restated the rings; the amendment is that **the rings get their own headline number**, the share of easy running that stayed easy, drawn as the rings' title, not as a second tile. Collins argued; Silvanto agreed on condition it is the rings' own figure, labelled as such. **Recorded as an amendment, not a reversal** |
| **Celebration forbidden; Runna PB medals killed** | 🔁 **CHALLENGED, NARROWED** | Still no badges, medals, confetti, streaks. **New: an earned, specific sentence** when the runner's own evidence crosses a governed line (Willy and Sims's list: discipline held, the longest run that stayed easy, easy HR cost falling). A sentence and its evidence, never a badge. **Thresholds are the Coaching Board's** |
| **Projection / trajectory curve (UX-PROGRESS-01)** | ✅ Stands | Bars of past weeks are a record, not a projection (ruled today) |
| **ZoneRings retained as the trademark** | ✅ Stands | And now fed for everyone (Finding 3) |
| **TrendCard: honest wait before a verdict** | 🔁 **CHALLENGED, AMENDED** | The wait is right (the noise floor is measured); the EMPTY wait is not. The pending state shows progress toward the answer ("4 of 6 easy runs collected") instead of "— → —" |
| **"Generate report" as a manual action** | 🔴 **OVERTURNED** | Coaching the runner paid for must arrive without a chore: generated on Sunday (Finding 2) and, if stale, on opening Coach. The manual refresh stays as a secondary action |

**No settled kill is reversed.** Streaks, ranks, scores, projections, fitness/fatigue labels, a metrics dashboard and
medals all stay out.

---

## 5. The plan, in order (each filed with its board)

| # | Item | Board | What it changes for the runner |
|---|---|---|---|
| 1 | `WEEKLY-REPORT-CRON-AUTH-01` | ⚙️ NO BOARD (defect) | The Sunday read and its push arrive again, for 24 runners |
| 2 | `COACH-RINGS-SOURCE-01` | 🏃 ruled here (same principle as §129: what you ran, not what was matched) | Zone rings fill for ~11 of 17 runners, not 4 |
| 3 | `COACH-READ-AUTO-01` | 💼 SLT (one model call per runner per week if stale on open) | The main card is never "Generate a report" for a runner with runs |
| 4 | `COACH-CODE-HYGIENE-01` | ⚙️ NO BOARD | Stops a model call per Coach load that nobody sees; fixes the "Needs Strava" teaser; brings `screen-architecture.md` current |
| 5 | `COACH-DISCIPLINE-HEADLINE-01` | 🧭 Design (ruled here) → build | The rings get a big headline: *"84% of your easy running stayed easy"*, plus up to 8 weekly bars of that share: **our one metric nobody else has, given the biggest moment on the screen** |
| 6 | `COACH-SEEN-MOMENTS-01` | 🏃 Coaching (thresholds) → 🧭 Design (placement) | One earned sentence when the runner's evidence crosses a line, e.g. *"Four weeks running, your easy runs stayed easy."* Rule-based, never a badge |
| 7 | `COACH-TREND-PENDING-01` | 🧭 Design | The trend card shows progress toward its first answer instead of "— → —" |

**Order is deliberate (Zhuo):** 1–4 fill the screen and cost almost nothing; 5–7 make it sing and should be judged on a
screen that has data in it. The `RUNKED-LOAD-VIEW-01` bars wait on the same reach measurement as before.

## What this review does not establish

- **Nobody has seen Coach on a device**, with or without data. The founder's *"flat"* was not compared against a filled
  screen, because almost no runner has one.
- **Whether a filled screen brings runners back** is unmeasured. The test: Coach opens per non-admin runner per week,
  before and after items 1–3.
- 17 non-admin openers is a small population; one runner moves any percentage by ~6 points.
- Finding 2's cause is read from code and confirmed by the absence of reports; the 403 itself was not observed (Vercel
  Hobby keeps logs for hours, and the last Sunday run was 4 days ago).
