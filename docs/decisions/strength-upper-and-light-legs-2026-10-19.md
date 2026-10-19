# Boards — full body keeps upper work; a no-heavy-legs day keeps light leg work (2026-10-19)

**Items:** `STRENGTH-FULLBODY-NO-UPPER-01`, `STRENGTH-CHOSEN-NO-LEGS-01`. **Founder:** *"I want you to do the board
sittings with the 2 open items."*

## Measured first (current engine, 2026-10-19)
- **Full body with no upper main/accessory work, running focus:** 30 min **95%** (674 / 708 sessions on 8 real run
  plans) and 100% standalone; 45 min **58%** / 75%; 60 min 0%. General focus 0% everywhere. A 30-min running full body:
  warm-up, skipping, Bulgarian split squat, B-stance RDL, suitcase carry. Cause: the running full-body template holds an
  upper pull and an upper push, at the same drop priority as hip and calf work, so S10's clock removes them first.
- **Chosen days with no heavy legs:** all 2- and 3-day picks × 8 real run plans = 448 plans; **29 (6.5%) hold zero
  heavy-leg sessions AND zero lower-body work of any kind**. Every one is a weekend pick (Fri/Sat, Fri/Sun, Sat/Sun,
  Fri/Sat/Sun) next to the Sunday long run. With the engine choosing the days: 0 of 16.

## Coaching Board (Hutchinson chair; Blagrove, Sims, McMillan, Willy, Seiler)
**Conflict scan:** S1 (twice a week per region, ACSM [M]) broken by both; S1 Am.2 (chosen days are the sessions) so
item 2 is solved on the day; S2 bans HEAVY lower and plyos, not lower work; S3 (convert to upper + core) amended; S10's
drop order is item 1's cause; S13 already keeps calf/soleus as low-cost lower work (precedent); S11 not contradicted
(the split already prescribes upper in full body).

**Item 1.** Blagrove: at 30 min protect single-leg, hinge and calf for economy, but the session is called full body
and the split counts on it; superset the pull with core, it fills rest already spent. Sims: keep it; whole-body
resistance work matters for bone (spine, wrist) in peri- and post-menopausal women, the demographic's under-served part.
Hutchinson: the economy evidence for upper work is thin [L]; the case is S1's own standard and that the title is a
promise. McMillan: a missing row is not noticed; a "Full body" that is not, is. Willy, Seiler: no objection.
**Disagreement recorded:** Blagrove would drop it before calf work at 30 min, Sims would not; the superset settles it.
**Ruling: CORRECT WITH AMENDMENT.** S10 Am.3: every full-body session holds at least `FULL_BODY_MIN_UPPER_ITEMS` (1)
upper movement, pull first, supersetted with core; it trims to 2 sets before any drop and is the last accessory dropped.
Invariant `S-FULLBODY-UPPER`. The title stays true, so the Design Board has no title question.

**Item 2.** Blagrove: an upper-only block is not a running strength plan; S2 bans heavy legs, not calf/soleus and hip
work. Willy: submaximal only the day before a long run (RIR ≥ 3), no plyos, no loaded squat/hinge/single-leg; tendons
keep a weekly load. Hutchinson: no evidence either way [I], small muscle mass, low risk; claim nothing. McMillan: weekend
lifting before a Sunday long run is the common real pick; give them legs they can do, tell them, don't force a weekday.
Sims, Seiler: no objection.
**Ruling: CORRECT WITH AMENDMENT.** S3 Am.2: for running focus, a chosen day that cannot take heavy legs becomes upper
body + core + **light lower** (`LIGHT_LOWER_PATTERNS`: calf, hip abduction; `LIGHT_LOWER_RIR` 3; no plyos, no squat,
hinge or single-leg). Invariants `S-LIGHT-LOWER-ONLY` (a session without heavy legs holds no heavy-lower pattern) and
`S-LEGS-EVERY-WEEK` (a running-focused ordinary week with sessions has lower work, light or heavy).

## Design Board (Zhuo chair; Wroblewski, Sierra, Silvanto, Collins)
**Settled ground:** PINNED-DAYS-01, SAVE-PATTERN-01 (consent screen, readback), the existing `legsLimitedNote`.
Wroblewski: the client cannot know which days are legal without the run week; the engine already notes
`legs_limited_by_run_week`, so say it where the plan is in hand: on *Here is what changes* and under the days for an
existing plan. Sierra: say what they get: *"Your run week keeps heavy legs off these days, so they get lighter leg
work."* Silvanto, Collins: no new component; the title question is moot. **Ruling: SHIP WITH AMENDMENT.** Copy goes to
the founder; it replaces *"…so some sessions are upper body"*, which item 2 makes false. Check: a markup arm.

**Not settled:** whether 6.5% is the real-world share (strength is admin-only; no live picks exist); the S10 cost of the
upper superset at 30 min is to be measured in the build, not assumed.
