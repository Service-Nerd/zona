# LinkedIn content briefs — drafted 2026-09-07

Source material for two build-in-public posts. Both stories are **verified against
the repo**, not recalled. Facts below are quoted from `feature-registry.md` and
`CoachingPrinciples.md` — every number is real.

**Audience:** technical, ServiceNow background. Platform devs, architects, consultants.
**Voice:** DHTB professional register — bold-unicode hook, dry, one takeaway,
ServiceNow bridge, App Store link in first comment.

> **Instruction to the drafting model:** do not invent detail. Each brief has a
> "Do NOT claim" section. If you need a fact that isn't here, leave it out rather
> than filling the gap. The strength of these posts is that every specific is true.

---

## BRIEF 1 — DELOAD-OWNER-01 · "The same rule in five places"

**Shipped:** 2026-09-04 · `lib/plan/deloadCadence.ts` · registry line 293

### The story in one line
The rule deciding which weeks are recovery weeks existed in five separate places in
one file, and they only agreed by accident.

### Verified facts
- The expression `weekN % recoveryFreq === 0` appeared **five times** in
  `ruleEngine.ts`: three building the volume curve, one placing a tune-up race,
  one stamping the week's badge.
- **They were not the same expression.** The tune-up scan had no phase test at all.
  The volume passes relied on a `continue` further up having already skipped the
  taper. The post-deload bounceback tested the *previous* week's phase.
- They produced the same answer only because of the control flow around them.
  Nobody designed that. It was luck.
- Changing two of the five made the volume curve and the week badge **disagree** —
  plans that opened a build phase with a recovery week went from **4 to 12**.
- Fix: one owner module, `isDeloadWeek(weekN, phase, recoveryFreq)`.
- **Zero behavioural change, measured not assumed:** 432 plans generated before and
  after (6 distances × 3 day-counts × 2 ages × 3 declared levels × 2 goals × 2 injury
  histories), byte-identical.
- The test enforcing it fails on three conditions: if any file outside the owner
  computes the cadence, if the engine's call-site count moves off five, **and if
  nothing imports the owner at all** — because an orphaned module reads as solved.
- Falsification-tested: putting one copy back fails 2 of the 8 tests.

### The takeaway (one only)
Duplicated logic doesn't announce itself by breaking. It sits there agreeing with
itself until the day you touch one copy. The fix isn't "remember not to duplicate" —
it's a test that fails when someone does.

### ServiceNow bridge
This is the Script Include argument, but with the part people skip. Everyone agrees
shared logic belongs in a Script Include. Nobody writes the check that *fails the
build* when the same condition turns up inline in a fourth business rule.

The extra beat worth landing: those five copies agreed because of **execution order**.
Any ServiceNow dev who has debugged business rules firing in an order nobody
documented will recognise that exact feeling — it works, and no one can tell you why.

### The honest bit
I wrote all five. Over months. Each one looked like the smallest reasonable change
at the time.

### Hook options
1. 𝗧𝗵𝗲 𝘀𝗮𝗺𝗲 𝗿𝘂𝗹𝗲 𝗲𝘅𝗶𝘀𝘁𝗲𝗱 𝗶𝗻 𝗳𝗶𝘃𝗲 𝗽𝗹𝗮𝗰𝗲𝘀 𝗶𝗻 𝗺𝘆 𝗰𝗼𝗱𝗲𝗯𝗮𝘀𝗲. 𝗧𝗵𝗲𝘆 𝗮𝗴𝗿𝗲𝗲𝗱 𝗯𝘆 𝗮𝗰𝗰𝗶𝗱𝗲𝗻𝘁.
2. 𝗜 𝗰𝗵𝗮𝗻𝗴𝗲𝗱 𝘁𝘄𝗼 𝗹𝗶𝗻𝗲𝘀 𝘁𝗵𝗮𝘁 𝗺𝗲𝗮𝗻𝘁 𝘁𝗵𝗲 𝘀𝗮𝗺𝗲 𝘁𝗵𝗶𝗻𝗴. 𝗧𝗵𝗿𝗲𝗲 𝗼𝘁𝗵𝗲𝗿𝘀 𝗱𝗶𝘀𝗮𝗴𝗿𝗲𝗲𝗱.
3. "Zero behavioural change" is a claim. I generated 432 plans to make it a measurement.

### Do NOT claim
- Don't say it was a live user-facing bug that shipped — the disagreement was caught
  in the same session that caused it. It's a near-miss story, not an outage story.
- Don't inflate 432. It's a deliberate grid, not a stress test.
- Don't imply the five copies were identical text. The point is the opposite.

---

## BRIEF 2 — HR-MAX-01 · "Apple Health made my training worse"

**Shipped:** 2026-08-31, device-verified 2026-09-02 · `lib/plan/maxHrGuard.ts` ·
registry line 40 · CoachingPrinciples §50

### The story in one line
Connecting Apple Health to my own app made every training zone about 15% too low,
because I treated a measurement as an estimate.

### Verified facts
- Apple Health's "observed max HR" is the highest rate the watch **happened to
  record**. That is a **floor**, not a maximum.
- My code wrote it over the age-based estimate on connect. Every HR zone and every
  plan target then ran **~15% low**.
- **My own data:** age 44. Apple-observed max **159**. Age estimate (Tanaka) **177**.
  True max **188**.
- The existing guard was a **symmetric ±15% plausibility band**. 159 is only ~10%
  below 177 — so it sailed through. Connecting a data source made the app worse,
  which is the opposite of what new data is supposed to do.
- **The category error:** a symmetric band treats a lower bound as a two-sided
  estimate. A recorded heart rate proves the heart *reached* that rate. It says
  nothing whatsoever about the ceiling.
- **The fix is asymmetric.** Above the estimate: trust it up to 15% — it physically
  happened. Below the estimate: reject it outright (tolerance zero) unless the
  runner explicitly confirmed it themselves.
- Provenance now has three states: `observed`, `user_confirmed`, and absent.
  Unattributed values degrade to the *device* path, not the trusted one — because
  you can't tell a laundered device floor from a hand-typed number.
- **Second bug found underneath:** the scan pulled `limit: 5000` most-recent raw
  samples. On a watch logging continuously, 5000 samples is **1–2 days**, not the
  90-day window I thought I was reading. Now scans workout HR peaks across the full
  window with bounded pagination.
- Not a silent correction: the profile screen shows the guarded zones plus a
  plain-language note and a way out — *"If 159 really is your max, tap Save to
  confirm it."*
- One owner module shared by engine and client, so the two can't drift apart.

### The takeaway (one only)
Data arriving from an authoritative system is not authoritative about everything it
contains. Before you let a source write an attribute, ask what that source is
*capable of knowing*. Mine could only ever under-report.

### ServiceNow bridge
This is a reconciliation problem, and it's the strongest bridge of the two.

CMDB people already have the vocabulary: authoritative source precedence, per
attribute. IRE exists precisely because "this data came from Discovery" doesn't mean
Discovery is right about that field. My bug was a missing reconciliation rule — I let
the least authoritative source win on the one attribute it could only ever
under-report.

Second angle if the first is too niche: precision is not accuracy. `159` looks more
trustworthy than `177` because a device measured it. It was the wrong number, and it
looked righter.

### The honest bit
I found it in my own training data, in my own app, as the user. Not in a test. The
zones felt easy and I assumed I was getting fitter.

### Hook options
1. 𝗔𝗽𝗽𝗹𝗲 𝗛𝗲𝗮𝗹𝘁𝗵 𝘁𝗼𝗹𝗱 𝗺𝘆 𝗮𝗽𝗽 𝗺𝘆 𝗺𝗮𝘅 𝗵𝗲𝗮𝗿𝘁 𝗿𝗮𝘁𝗲 𝘄𝗮𝘀 𝟭𝟱𝟵. 𝗜𝘁'𝘀 𝟭𝟴𝟴.
2. 𝗖𝗼𝗻𝗻𝗲𝗰𝘁𝗶𝗻𝗴 𝗮 𝗱𝗮𝘁𝗮 𝘀𝗼𝘂𝗿𝗰𝗲 𝗺𝗮𝗱𝗲 𝗺𝘆 𝗮𝗽𝗽 𝘄𝗼𝗿𝘀𝗲. 𝗧𝗵𝗮𝘁 𝘀𝗵𝗼𝘂𝗹𝗱𝗻'𝘁 𝗯𝗲 𝗽𝗼𝘀𝘀𝗶𝗯𝗹𝗲.
3. I was reading a 90-day window. I was actually reading two days. Same query, and
   it never errored.

### Do NOT claim
- Don't say Apple Health is broken or wrong. It reported exactly what it observed.
  The bug was entirely mine — in what I did with it.
- Don't say users were harmed. Founder-detected, fixed before it was reported by
  anyone. Say "I found it in my own data" — that's the honest and stronger framing.
- 188 is the founder's true max; don't present it as measured by the app.
- Don't merge the two bugs into one. The symmetric guard and the 5000-sample window
  are separate failures that compounded. If space is tight, lead with the guard and
  use the window as the kicker.

---

## Which to run first

**HR-MAX-01.** It has a personal stake, a number people feel (159 vs 188), a
counter-intuitive turn (adding data made it worse), and the CMDB reconciliation
bridge is the most specific ServiceNow parallel across both. DELOAD-OWNER-01 is
the better *craft* post but a more familiar lesson — hold it for a week when there's
nothing fresher.

## Sources (for verification)
- `docs/canonical/feature-registry.md` lines 40 (HR-MAX-01), 293 (DELOAD-OWNER-01)
- `docs/canonical/CoachingPrinciples.md` §50 "Asymmetry" (from line 1340)
- `lib/plan/maxHrGuard.ts`, `lib/plan/deloadCadence.ts`
- Commits: `c44e0e5` (HR-MAX-01), `599dbde` (DELOAD-OWNER-01)
