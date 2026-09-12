# UX-COACH-01 — Coaching Board + SLT, 2026-09-12

Two sittings on the same day, on a founder reframe: *"It's for all. Simple, easy to
understand for a non-elite runner, a view of their progress, and a feel-good or
understood moment. What does the paid tier get that really impresses — maybe that's the
entire coach screen?"* Then: *"I'd like to see progress on estimated times. This is where
I was, I am, and what the potential is."*

---

## Facts established in code first (three specs were found wrong on 2026-09-12 alone)

- **The entire Coach screen is ALREADY paid-gated.** Free users get `CoachTeaser`. So
  *"maybe that's the entire coach screen"* — it already is. Nothing needs re-tiering; the
  problem is that the gated thing has no subject.
- **Seven blocks, verified accurate.** My own raw JSX count said 4 `TrendCard` and 3
  `ZoneRings`; those are conditional render branches (skeleton / live / pending), so the
  entry's "TrendCard ×2" was right and my count was the misleading one.
- **`RaceTimesCard` renders on `PlanScreen` (line 8533) while its own header says
  "Coach screen — canonical home".** A comment describing an intent the code does not
  implement.
- **Two-thirds of the founder's arc already exists.** R31 ships `baselineSeconds`,
  `currentSeconds`, `deltaSeconds` with four confidence states. There is **no** forward
  projection anywhere, and that is the only genuinely new part.

## Coaching Board — "what the potential is"

**Conflict scan.** §44.1 governs directly: *"Ordinal, never a percentage. With one
benchmark run and one max HR the engine cannot defend a probability — a '72% chance' is
fabricated precision, and false precision is an overclaim."* A projected race-day time is
that claim wearing a different number. §44's amendment (CD-16/SC-06) already computes
`meta.goal_beyond_measured_fitness`. ADR-011: no GPS, cadence, power or VO2max, so a
trajectory model has nothing to be built from.

- **Hutchinson (chair)** — fitness does not extrapolate linearly, and the last eight weeks
  of improvement are the *worst* predictor of the next eight; the early gains are the cheap
  ones. Two of the founder's three elements are memory, not prophecy.
- **Seiler** — a VDOT time is a statement about a *test*, defensible when labelled as one.
  Draw it as a line toward a date and you have asserted a slope nobody can defend.
- **McMillan** — design the regression case first. A screen that only speaks when the arrow
  is up is marketing.
- **Willy** — show a beginner a potential faster than their goal and some will train for the
  potential instead of the plan.
- **Sims** — four confidence states exist because data quality varies. "Potential" without
  "on current evidence" reads as a verdict on her.

**RULING — CORRECT WITH AMENDMENT.** Build the arc. **"Potential" is the runner's own
stated goal against measured fitness, never an engine-invented future time.** Rejected: any
projected finish for a future date, any rising line toward race day, any percentage.
Required: the regression case ships with it. → **§109**.

## SLT — should the arc move to Coach?

- **Sutherland** — it is currently filed next to a list of appointments. The founder's own
  phrasing is a *story*, and stories are what people re-open an app for.
- **Fried** — move it as a REPLACEMENT, not an addition. But Kit's read stays the hero: the
  arc answers the second question, not the first. Above Kit it becomes a scoreboard.
- **Hutchinson** — no objection; the labelling matters *more* on a prominent screen. A
  projection on Plan is a detail; the same projection at the top of the flagship is a promise.
- **Wood** — supports, and this is not a reversal. **A rising chart is illusion-of-progress;
  a past–present–goal comparison is a reference point**, which is context, and context
  changes behaviour. Conditional on the regression case existing.
- **Traynor** — this is the **trial-conversion asset**. A runner on day 3 has no trend and
  barely a week of sessions, but they have a baseline from plan creation and a goal. It is
  the one part of Coach that works inside the 14-day window where the decision is made.

**Conflict — Fried vs Traynor on hierarchy.** Fried wants Kit permanently on top; Traynor
notes that in week 1 Kit has nothing to say and the arc does. **Resolved without either
principle bending: the hierarchy is fixed, the content is stateful.** Kit's slot always
leads; in week 1 it holds an empty-state read that points at the arc.

**RECOMMENDATION — move `variant="status"` to Coach as a replacement.** Hierarchy: Kit's
read → the arc → aerobic trend → two tiles → one link out. The 2×2 grid and the second
`TrendCard` come out. `anchor`/`result` variants stay in the benchmark flow. ⚠️ R32's
recalibration nudge renders only on `variant="status"`, so it travels with it and must not
be orphaned.

## Design, researched not invented

[WHOOP](https://www.925studios.co/blog/whoop-design-breakdown) runs three tiers *across
navigation* — Tier 1 "how should I train today", Tier 2 "am I improving", Tier 3 deep-dive
for the 15% — with the hero metric at ~72pt and a deliberately narrow colour vocabulary
where every hue carries meaning. Oura's 2025 rebuild surfaces *one* thing based on what the
body most needs to know. The industry finding underneath both: more data without context
produces anxiety, not action.

**The Coach screen currently tries to be all three tiers at once. That is what "seven
blocks, no subject" means.**

**Deliberate divergence.** WHOOP compresses dozens of signals into one 0–100 score. §108
forbids us a new composite — so **our compression is linguistic, not numeric.** Anyone can
draw a ring; nobody else has a coach that says *"Tuesday drifted 8 bpm above your ceiling
and Wednesday looked the same."* That is the differentiator, and it was buried under a
stats grid.

## Agreed shape

1. **Kit's read** — hero, 27px, interpretation then evidence then the instruction on a moss
   rail. Always leads. Empty state points at the arc.
2. **The arc** — `2:14 at plan start · 2:06 now · 1:59 your goal`, a position rail between
   two fixed points, framed by `goal_beyond_measured_fitness`.
3. **Aerobic trend** — one hero figure (−5 bpm at the same easy pace) plus sparkline.
4. **Two tiles**, then **one link out** replacing both tap-to-explain sheets.

## ZoneRings is RETAINED — and my first proposal was wrong to drop it

**The founder caught this:** *"What about the zone rings image? That's our trademark."*
He is right, and more strongly than "it feels like ours":

- `ZoneRings` is **one of the three** components the marketing homepage renders in its
  ProductStill trio (`SessionCard`, `CoachNoteBlock`, `ZoneRings`), under the heading
  *"YOUR ZONES, ON COACH"*. It is literally one third of the product's public face.
- Its own header calls it **"brand-mark-as-data-display"**: the four concentric rings of
  the Zonna mark ARE the four HR zone buckets, and arc-fill was chosen over thickness
  specifically so the silhouette survives any data shape. It is the logo, drawn by the
  runner's own week.

**Dropping it would have recreated the exact defect class fixed on 2026-09-12** — the
marketing site promising something the app no longer contains (cf. PLAN-LONGRUN-COLOUR-01,
where the homepage showed a purple long run the product could not render).

**How it is retained without the screen going messy again.** Not as another metric card —
**paired with Kit's read as its evidence.** The sentence and the rings are the same fact in
two registers, word and image: *"Nine per cent of your week sat in Zone 3"* above rings
showing Z3 at 9%. The mark becomes the hero's companion rather than a competing block.

⚠️ **And it subsumes a tile I had invented.** My draft had "71% — easy running that stayed
easy". The demo ring data is `{z1: 8, z2: 71, z3: 9, z45: 12}` — **the Z2 arc IS that 71%.**
The tile was the rings drawn worse and off-brand. Removed.

**Revised hierarchy — four blocks, down from seven, each answering a different question:**
1. **Kit's read + ZoneRings** — the week, interpreted and pictured. One block.
2. **The arc** — where I was · where I am · the goal I chose (§109).
3. **Aerobic trend** — one figure: am I getting fitter.
4. **One link out** — replacing both tap-to-explain sheets.

**Known rough edges, recorded rather than hidden:** the empty-state placeholders render as
heavy bars that read like redactions; and the trend sparkline falls when things go well
(HR down at the same pace), which needs a label or it reads as decline.
