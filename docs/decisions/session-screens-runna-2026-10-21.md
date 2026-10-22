# Session screens, closed · open · logged: what to take from Runna, and how to beat it (2026-10-21)

**Item:** `SESSION-SCREENS-WOW-01`. **Asked by the founder, verbatim (in substance):** *"I really like how these look.
They've got colour and visuals and icons and everything is very clear … make our closed session and open session and
logged sessions look really good … consider the user and what they need … the wow moment … nothing is off the table,
think outside the box. I want us to be an industry disrupter."* (The ambition is now in `brand.md` § Brand Positioning.)

**Standing brief:** `docs/canonical/app-review-brief.md`. Feeling outranks tidiness, it is a blank sheet, and the
settled-ground scan prices each reversal rather than ending the argument. Significant brand changes go to the SLT first.

---

## Part 1 — The report to the board (UI/UX specialist)

### 1.1 What the three Runna screenshots show

| # | Runna screen | Elements |
|---|---|---|
| R1 | **Logged** interval session (dark) | Title bar with share and a done tick · **activity card first**: a left gradient rail in the session colour (orange to red), a stepped **workout-shape glyph**, the time window, **three big numbers** (distance · time · avg pace), the Strava mark, PB medals (1K · 1MI · 5K) · *Description* with an **Outdoor / Treadmill** toggle · steps under **full-width coloured header bands** (grey warm-up, orange-red *Repeat ×3* with a repeat icon), numbered rows, the quantity in bold inside a sentence (*"0.62mi at 13:00/mi"*, *"90s walking rest"*), a range on a second line, and the **modality on the right with an icon** (RUN · REST) · the coach as a chat bubble with a face |
| R2 | **Logged** easy run (light) | A **hero with a green wash and route-line texture** · date and *Schedule* · a big title · type and distance · an honest **duration range** (*35m–40m*) · **three status circles**: Cooldown stretches (to do) · Activity linked ✓ · Workout complete ✓ · the activity card with a green-to-yellow rail, the **GPS route outline**, three numbers · an AI line (*"your workout insights are ready"*) · a card carousel |
| R3 | **Open** easy run, the steps | The same header bands (grey, green-to-yellow *Session*), *"5 mins walking warm up"* · WALK, *"4.5km at a conversational pace ⓘ"* · RUN |

**What makes it land, in one line each:** colour gives every session an identity; the header bands make the structure
scannable from across a room; the sentence-plus-modality row reads like an instruction a coach would say; the logged
state leads with **what you did**; the status circles give the session a **closing ritual**.

### 1.2 Our comparable screens (captured 2026-10-21 at 375 px from the real components)

| State | Ours | Surface | What it does today |
|---|---|---|---|
| **Closed** | Today's session row; the Plan day row | `TodayScreen` (`SessionCard`), `PlanCalendar` `DayRow` | White row, left rail in the session colour, name, *Zone 3 · 146–157 bpm · 6:16–6:31 /km*, distance on the right. Under a very large *"6km, at tempo."* headline |
| **Open** | Session detail | `SessionPopupInner` | Verdict pill · the **Hold the zone** card (zone name in the session colour, HR band, the 1–5 zone ruler) · a one-line brief · Distance / Est. pace tiles · *Session structure* with tinted Warm-up / Main set / Cool-down headers, numbered steps, a dot, the name, the target, the quantity right-aligned · Kit's note · Log this run |
| **Logged** | The same session detail after a run + the post-run card | `SessionPopupInner` (verdict pill, *execution summary: planned vs actual*), `RunFeedbackCard` | Pill *Held / Drifted* · the prescription card still first · planned vs actual · the post-run card: score chip, *"Drifted off plan. Worth knowing why."*, *"32% in your prescribed zone"* with a zone bar, Kit's read |

**Where we already match or beat it.** Our step structure is the same idea, and its targets are honest (zone-bound, not
just a pace). The **Hold the zone** card and the zone ruler are something Runna does not have, and **Kit's read takes a
view on the effort**, which no competitor does. That is our edge in `brand.md`.

**Where we fall short, measured on the captures:**
1. **The logged state still leads with the plan.** The prescription card sits above the planned-vs-actual summary, so
   the first thing a runner sees after their run is what they were told to do, not what they did.
2. **Colour is a 3–4 px rail and a pale tint.** Every session reads alike at a glance. The founder's word was
   "colour", and the app is already more colourful than the website; on a session screen it barely shows.
3. **There is no picture of the session.** Runna's stepped glyph says "intervals" before you read a word. We say
   *"Over-unders · Zone 3"* in text.
4. **No closing ritual.** Logging, linking and the zone read land as separate states in different places.
5. **The step row puts the number on the right and the instruction in two lines.** Runna's single sentence (*"0.62mi at
   13:00/mi"*) plus a modality tag is quicker to read mid-session.
6. Two copy defects seen while capturing (not this item's): an em dash in the long-run coach note (*"Time on feet is the
   point — walk breaks…"*, `lib/` copy, the open `EMDASH-LIB-COPY-01` class) and em dashes in a stored Kit read from
   2026-10-07.

### 1.3 The data check that decides the biggest idea
Production, read-only, 2026-10-21: **207 of 353 Apple Health runs (59%) carry a heart-rate stream**
(`raw_payload.hrSamples`, median 326 samples). Strava and manual runs carry none (ADR-011: Strava does not persist
per-sample HR). So a run-over-time heart-rate picture is possible for most runners with a watch, and must degrade for
the rest.

### 1.4 Recommendations

| # | Idea | The user need | The wow | Settled ground it touches | Cost |
|---|---|---|---|---|---|
| **W1** | 🌟 **The Zone Trace** (logged). The planned session drawn as a band of zones over time, with **your heart rate drawn through it**; where you left the band, the line changes colour. One sentence on top: *"Held the zone for 32 of 40 minutes."* | *Did I do it right?* answered in one look, in the product's own idea | **The screenshot people send their friends.** Nobody else can draw it honestly, because nobody else has a zone opinion | None reversed. New shared component (hard trigger). Degrades to today's zone bar for runs without a stream (41% of Apple Health runs; 47% of all logged runs) | M. `streamAnalysis` already reads the samples; needs the plan's per-step zone timeline (exists via `derived_set`) |
| **W2** | **The logged hero is your run.** Once logged, the top becomes the activity: Distance · Time · Avg pace · Avg HR as large numerals, the verdict, the Zone Trace. The plan moves under *"What was planned"* | After a run the question is *how did it go*, not *what was the brief* | The screen changes to say *you did this* | `screen-architecture.md` Session Detail job (*"understand the prescription"*): extend the job to *and how it went*. Reverses nothing ruled | S–M. Reorder; the execution summary exists |
| **W3** | **The session silhouette** (open, and the Today card). A miniature of the session's shape, width = time, height = zone, drawn from the steps | Know the session's shape before reading it: a long steady block vs four sharp reps | The session looks like what it will feel like | ⚠️ **UX-SESSION-GLYPH-01 (2026-09-12) declined a shape glyph on Plan rows** as a duplicate of colour + label. This is different: it encodes **duration and zone per step**, which neither the colour nor the label carries. **Not proposed for Plan rows** | S–M. Pure function of `derived_set` |
| **W4** | **Colour that owns the session screen.** The session colour as a confident header band on the open screen (solid token at a stronger tint), section headers in the session colour, the rail widened | The session has an identity at a glance | The app finally looks like the colour it already is | 🔴 **Reverses "Type accent, not flood" (STANDING) for one surface**, and touches "no gradient". Proposed as **solid tints, no gradients**. Silvanto's veto applies: this is the one to price | S once ruled; a token and a pattern |
| **W5** | **The step row as a spoken instruction.** *"**3 × 800 m** at **6:22–6:40 /km**"*, a second line for the why, and a **modality glyph** (run · jog · walk · rest) leading the row; *Repeat ×3* as its own band with a repeat glyph | Read the next step at a glance, mid-run | It reads like a coach talking | S6 (an icon language, bounded) **allows** this: modality repeats down a list. ICON-RULE-01's bound is about setting rows, not steps | S |
| **W6** | **A closing ritual: three marks.** *Logged · Linked · Zone read*, filling as each lands, then Kit's line | Know the session is finished and nothing is pending | The session closes, it does not just stop | No streaks or rewards: it is status, not a prize. Wood's line (habit, not gamification) must hold | S |
| **W7** | **Honest duration range** on easy and long runs (*35–40 min*) from the pace band | *How long do I need?* is the question a day-job runner asks first | Small, but it is the thing they plan their morning around | ADR-015 owns the format (`formatDuration`) | S |

**Declined in the report, with reasons:**
- **PB medals and badges (R1):** gamification, forbidden (CLAUDE.md, Wood). Our answer to "a moment" is W1.
- **Route-line hero art and the GPS route outline (R2):** we do not have GPS routes (ADR-011: the health plugin has none),
  and a texture for its own sake is decoration, the paper-grain precedent.
- **The card carousel with dots (R2):** a swipe with nothing behind it; the P-06(b) kill.
- **Outdoor / Treadmill toggle (R1, R2):** a real need, but what changes on a treadmill is a **coaching** question
  (pace and effort equivalence). Routed to the Coaching Board, not designed here.

### 1.5 Questions for the board
1. Is W1 the wow, and is it ours to own? What would make it better still?
2. W4: is "Type accent, not flood" right for a **session** screen, or only for lists? Price the reversal.
3. W3 after UX-SESSION-GLYPH-01: is a time × zone silhouette a new encoding, or the same duplicate in a new place?
4. What did the report miss? The board is asked for its own ideas, not only a verdict.

---

## Part 2 — The Design Board sitting (Zhuo chair; Silvanto, Sierra, Wroblewski, Collins)

**Trigger:** hard. New shared components (Zone Trace, silhouette) and a reversal of a standing pattern on one surface.
**Settled-ground scan:** *Type accent, not flood* (STANDING) · *No chrome / no gradient on gradient* (STANDING) ·
S6 icon language, bounded · ICON-RULE-01 (setting rows, bound of eight) · UX-SESSION-GLYPH-01 (declined on Plan rows) ·
*Celebrating the peak week* FORBIDDEN (Wood) · the P-06(b) swipe-stack kill · the stock-footage and paper-grain kills ·
`screen-architecture.md` Session Detail job · the post-run rulings (*RPE asked before the read*, the founder's overturn
keeping the 50/100 as a chip) · `getSessionColor` as the single owner of session colour.
**Evidence:** our three states captured at 375 px from the real components (`/copy-preview`, `/post-run-preview`,
`/strength-preview`); the HR-stream count above. **Not measured:** any of it on a device; the Zone Trace's legibility at
phone size; colour contrast of the stronger tints.

### 🧭 Julie Zhuo (chair)
The founder brought a preference (*"I like how these look"*) and the report turned it into three findings with a user
behind each: the logged screen answers the wrong question first, the sessions have no identity at a glance, and the
session never closes. Those are decisions. W1 is the strongest idea we have had on this screen because it is the
product's thesis drawn as a picture. Success condition, before anything is drawn: **a runner can say whether they held
the zone without reading a word.** Test it on a phone with five real runs, held and drifted.

### ✋ Miklu Silvanto
W1 and W2 together are the right hierarchy: *now* (how did it go) above *over time* (what was planned). The Zone Trace
must be one line and one band; if it grows axes, legends and a key, it becomes a chart, and a chart is homework. On W4
I **veto the report's version** as written, naming the rule: `ui-patterns.md` and CLAUDE.md, *"Type accent, not flood.
Session colours as left borders, dots, chips; never full card backgrounds."* A header band in the session colour on
every session screen is a flood. I will not veto this: **the session colour fills the Zone Trace band and the
silhouette** (it is data there, not decoration), the rail widens to 6 px, and section headers take the session colour as
**text and a 2 px top rule**, not a fill. Colour where it means something.

### 🎓 Kathy Sierra
W1 is the first idea in months that makes the **runner** better rather than the app busier: after ten of them, they
start to *feel* where their zone ends, which is exactly the perceptual skill we exist to build. Two asks. First, the
trace's sentence must be about them, not us (*"You held it until the climb"*, not *"Zone adherence 80%"*). Second, W6 is
fine as status but kill the word "complete": a run is not a task list. **My idea:** on the open screen, show **last
time's trace for this kind of session**, faint, behind the plan. "Last tempo you drifted at minute 14" is coaching the
runner can use today.

### 📱 Luke Wroblewski
W5 is the most useful change per pixel: mid-run, the runner glances for two things, **what now and for how long**. Put
the quantity first and bold, the modality glyph at the left edge where the thumb is not, and keep each step to one line
plus an optional second. W7 yes. W2: the logged hero needs a fallback for a run with no heart-rate stream, which is
**180 of 387 logged runs (47%)**: 146 Apple Health runs without samples, 21 Strava, 13 manual (and a manual log may have
no HR at all). W1 must be tappable to a full-width view; at 343 px a 40-minute trace is 8 px
a minute, enough to see a drift, not to read a minute. **My idea:** a **"Next step" pin** while the session is open on
the day: the current step floats at the top as you scroll the structure. Not a run tracker; a better list.

### 🎪 Brian Collins
Runna's screens look good because they **commit**. Ours look careful. I argued for W4 as written and I lose to
Silvanto's veto, and I want that recorded, because the founder said *colour* and we are giving him a 6 px rail. I accept
his version because putting the colour **into the data** is the braver idea: a session you can recognise by the shape
and colour of its trace is a brand nobody can copy. W3: it is **not** the duplicate UX-SESSION-GLYPH-01 killed; that
killed a glyph subdividing amber on Plan rows, this is a time-and-zone shape. **Taxonomy check:** if the silhouette of
*Progressive tempo* and *Cruise intervals* come out identical, we have learned CD-1 again; measure before drawing.
**My idea:** **the trace is the share image.** `SaveImageButton` already exists; the logged session exports as one
card: the trace, the sentence, three numbers, the brand mark. That is the marketing.

### ⚡ Recorded disagreements
- **Collins vs Silvanto on W4.** Collins: the header band as written. Silvanto: veto on the flood; colour goes into the
  trace, the silhouette, a 6 px rail and coloured header text with a top rule. **Veto sustained; Collins lost**, and
  his challenge is recorded: if the founder, on a device, finds the session screens still too quiet, the next step is
  to propose amending the rule itself, as its own ruling.
- **Sierra vs the report on W6's words.** "Workout complete" goes; the marks read *Logged · Linked · Zone read*.

### ⛔ Veto check
**Silvanto: VETO sustained on W4 as written** (rule: *Type accent, not flood*, `ui-patterns.md` / CLAUDE.md). Collins
challenged and did not override. The amended W4 above is not vetoed.

### ⚖️ Ruling: SHIP WITH AMENDMENT, to a prototype first (nothing built for runners yet)
1. **W1 Zone Trace: SHIP to prototype.** One band (the planned zones over time, filled in the session colour), one HR
   line, off-band segments in `--warn` (never red, no red in training UI), one sentence about the runner. Tap opens a
   full-width view. No stream: today's zone bar. Measure on five real runs at 375 px.
2. **W2 logged hero: SHIP.** Logged session leads with the run (three numerals + Avg HR, the verdict, the trace); the
   plan follows under *What was planned*. Manual log without HR: the numerals and the verdict line only.
   `screen-architecture.md` Session Detail job amended to *the prescription, and how it went*.
3. **W3 silhouette: SHIP to prototype** on the open screen and the Today card, **not Plan rows**; first measure how many
   distinct silhouettes the catalogue produces (Collins' CD-1 check). Identical shapes for differently-named sessions
   is a finding for the Coaching Board, not a reason to draw.
4. **W4: AMENDED as Silvanto.** Colour into the trace and silhouette, rail 6 px, section headers in the session colour as
   text and a 2 px top rule. No bands, no gradients, no washes.
5. **W5 step row: SHIP.** Quantity first and bold, one line plus an optional why, modality glyph at the left
   (run · jog · walk · rest), *Repeat ×N* as a labelled group. Within S6.
6. **W6 closing marks: SHIP** as *Logged · Linked · Zone read*, status only, no animation of reward.
7. **W7 duration range: SHIP** for easy and long runs, through `lib/format.ts`.
8. **Board's own ideas, filed for the prototype:** Sierra's *last time's trace* on the open screen; Wroblewski's *next
   step pin*; Collins' *the trace is the share image*. All three need the prototype before a ruling.
9. **Routed out:** Outdoor / Treadmill → Coaching Board. The two em-dash defects → `EMDASH-LIB-COPY-01` and the Kit
   prompt check.
10. **SLT:** not required yet. W4 as amended is not a significant brand change; if the founder pushes for W4 as written
    after the prototype, it goes to the SLT with the rule amendment.

### 📦 Artifacts (with the build)
1. **Pattern:** `ui-patterns.md` § Session screens: closed · open · logged (this ruling). Zone Trace and silhouette as
   new shared components with their *why*.
2. **Tokens/constants:** the rail width (6 px) and the header top rule (2 px) as named values; the trace's band and line
   colours from `getSessionColor` and `--warn`.
3. **Checks:** a markup arm that the logged state renders the run before the plan; a check that no session screen paints
   a session colour as a background fill (holds the veto); the silhouette's distinct-shape count gated against the
   catalogue; `sessionColourReach.test.ts` extended to the trace.
4. **Register row:** `design-rulings.md`, this date.

### ⚠️ What this ruling does not settle
How any of it feels on a phone; whether the trace stays legible on a long run at 375 px; whether the stronger colour
use satisfies the founder; the closed **Plan row** (deliberately untouched); the website, which renders `SessionCard`
and must be checked when the closed card changes.

---

## Part 3 — The prototype (2026-10-21, local throwaway branch, never pushed)

Built as ruled: `/session-wow-preview` with closed · open · logged views, at 375 × 812, on the harness plan's real
quality sessions and **four real heart-rate traces, de-identified** (two held at 93% and 96% in zone, two drifted at 67%
and 71%; all easy runs, 55–79 min, 659–947 samples). Code kept as `scripts/session-wow/prototype-page.tsx.txt`, no data.

**The chair's success condition, checked on the four:** *can a runner say whether they held the zone without reading a
word?* **Yes on all four.** Held runs stay blue under the ceiling with at most one short amber spike (a hill); drifted
runs go amber above the ceiling in the second half and stay there. At 343 px a 79-minute run is ~4.3 px a minute: a
drift is obvious, a minute is not readable, so Wroblewski's tap-to-expand stands.

**Findings the prototype made, which no document had:**
1. **The band must draw what the prescription means.** The first version drew Zone 2 as a band with a floor, so the
   96% "held" run showed long grey stretches *below* the band and looked like a failure. An easy, long or recovery run
   is a **ceiling** (§12: easy runs are capped at the top of Z2); under it is held. Only quality has a floor. Fixed in
   the prototype; it must be in the pattern and tested.
2. **Collins' CD-1 check came back positive.** On the harness plan's quality sessions, 5 names produce distinct shapes
   **except Cruise intervals and Mile repeats, which draw the same silhouette** (two ~10-minute reps at the same pace
   with a ~2-minute jog). Two names, one session. Routed to the Coaching Board as evidence for CD-1; not a reason to
   stop drawing.
3. **The silhouette needs the step model, not string parsing.** A progressive step (*"7:18 → 6:22 /km"*) drew as easy;
   the real build should read effort from the resolved step (zone or pace anchor), not from text.
4. **Reach per runner varies more than the population figure says.** 59% of Apple Health runs carry a trace, but the
   founder's own account has 3 of 62 runs with 100+ samples. The zone-bar fallback is not an edge case; it is how
   some runners will always see it.
5. ~~Catalogue step notes carry em dashes~~ **Corrected 2026-10-22: not a defect.** 14 of ~172 catalogue notes carry one,
   and the founder's ruling (2026-09-22) allows em dashes in session descriptions; these notes are the session's
   description. Nothing filed.

**Not yet tested:** a drifted *quality* session (no real quality trace was available with a matching analysis), a
long run over two hours, the share image, and any of it on the founder's phone.

---

## Part 4 — The founder's verdict and his two conditions (2026-10-21)

> *"I absolutely love this!!! We do have to be mindful of what things look like when we don't have the data points.
> I.e when we log a run we don't immediately have the hr data. We also need to be mindful what we currently have on
> those screens and that we don't lose or clutter the screen and so each screen we change or update needs to be looked
> at in scope of the screen it's on and also the journey it takes the user on."*

**Condition 1 — data states, measured (production, read-only, 2026-10-21):**

| What | Count | So |
|---|---|---|
| Logged sessions (live, complete) | **129, from only 5 runners** | Every rate below is a small population |
| …linked to a watch run | 8 (all Apple Health; 0 Strava) | **121 are hand-logged** (72 with a typed average HR, 49 without) |
| …in the last 30 days | 15, of which **8 linked** | Linking is now about half, and rising |
| Apple Health runs with a rich trace (100+ samples) | **137 of 354 (39%)** | The earlier "59%" counted 20+ samples; 100+ is what draws well |
| …sparse trace (1–99 samples) | 145 (41%) | Enough for zone percentages, not a line |
| …no samples | 72 (20%) | |
| HK runs with **no HR at the first read** | **83 of 336 known (25%)** | The founder's case |
| …of which HR arrived later | **32 (39%)** now carry an average HR; **only 1** gained a rich trace; 51 never did | ⚠️ *Corrected the same day:* the first count read `hr_arrived_late_at`, which is stamped on only 3 of the 32 (a telemetry gap, filed as `HR-LATE-STAMP-01`). Late HR is common; a late **trace** is rare |

**The logged states, therefore (all five must be designed, not inherited):**

| State | What the logged hero shows |
|---|---|
| **L1** linked, rich trace | Numbers · the Zone Trace · its sentence |
| **L2** linked, sparse trace | Numbers · today's zone bar from the bucketed percentages · the same sentence family |
| **L3** linked, **no HR yet** | **Already built (HR-SYNC-02), reuse it:** *"Watch HR hasn't landed yet."* for 24 h, then *"HR didn't land. Tap to retry."*; Post-run's `PendingHrCard`. Numbers above it; if HR lands, the next open shows L2 (or L1, rarely) |
| **L4** hand-logged with average HR | **Already built:** the execution summary shows *"141 bpm avg"* in `--warn` with ↑ above the Zone 2 ceiling. Reuse it in the hero; no line is drawn (an average cannot show a drift) |
| **L5** hand-logged, no HR | Numbers · how it felt · Kit. No zone element at all (empty means calm, not broken) |
| *any* | The Kit read in flight uses `AIMark`'s working state, never a spinner |

**Condition 2 — each screen in its own scope, and the journey.** The journey today:
**Today card** (closed) → **Session detail** (open) → *Log this run* → **Log sheet** (manual) or **link picker** →
**Reflect** (RPE, fatigue, reflection) → **Post-run** screen (linked runs; also the *"Run linked"* push) → back.

What each screen carries now (from the code), and what the ruling may do there:

| Screen | Carries today | Change | Must not lose |
|---|---|---|---|
| **Today card** | Hero line · date strip · Hold-the-zone strip · the session card (rail, name, zone · HR · pace, distance) · the 5-step zone ruler under it · Log this run · voice line | Rail to 6 px; duration range into the existing meta line; the silhouette **replaces the zone ruler** under the card (both say intensity), so nothing is added | Zone · HR · pace on the card; the CTA position |
| **Session detail, pre-run** | Title + pill · Hold-the-zone card with ruler · voice line · metric tiles (distance/duration toggle, est. pace) · structure · description fallback · why this session · how to run it (run-walk) · Kit note · CTA | Silhouette **inside the structure header**, not a new card; step rows restyled in place; duration range in the existing tile | The zone card (our edge), the km/min toggle, run-walk, why-this-session |
| **Session detail, logged** | Title + verdict pill · zone card · execution summary (planned vs actual) · structure · how did it feel · CTA | Execution summary becomes the **hero** (L1–L5); zone card + structure fold under *What was planned*; closing marks | RPE / fatigue / reflection, the link affordance, Undo |
| **Post-run** | Score chip · verdict sentence · zone bar · Kit read | The trace **takes the zone bar's slot** in L1; L2 keeps the bar. One owner for the sentence, shared with the session hero | **The settled order: RPE is asked before the read** (design-rulings, *RPE asked BEFORE the read*). The trace is part of the read, so it is revealed after the runner says how it felt |

Two journey findings:
- **The reveal is the wow, and the ruling already gives it a moment:** say how it felt, *then* see the trace. A
  reveal the runner earned, not a chart on arrival.
- **The trace is a reason to link.** Half of recent logs are still by hand. Where a matching Apple Health run exists,
  the log sheet already offers the link; the board should decide whether the hand-logged hero says what linking would
  show, once, without nagging.

---

## Part 5 — Design Board: the build ruling (Zhuo chair; Silvanto, Sierra, Wroblewski, Collins)

**Settled ground added to Part 2's scan:** *RPE asked before the read* (post-run) · *empty means calm, not broken*
(ux-principles) · AIMark working state replaces spinners · *Gate richness, never access* · the ICON-RULE-01 bound.

- **Zhuo.** The founder's conditions are the right ones, and the measurements make them sharper than he said: the
  trace is the minority state today (L1 is rare: 8 linked logs), so **the screen must be excellent without it.** Build
  in the order the states occur, not the order we like them. Success condition per screen: nothing on the inventory's
  *must not lose* column disappears, and no screen grows in height in its common state.
- **Silvanto.** Replacing the zone ruler with the silhouette on Today is the right trade, one intensity encoding for
  another, and it keeps Today's height. On the logged hero, L3 must not leave a hole the size of a chart: one line,
  same weight as a caption.
- **Sierra.** The reveal after RPE is the best idea in this round, and it was already ruled; we just had not noticed
  it was a wow. L4's *"Avg 141 · ceiling 145"* is honest and still teaches the ceiling. For L5, Kit carries it.
- **Wroblewski.** L3 and L4 reuse the copy that exists (corrected count: 39% of late HR does land, so *"hasn't landed
  yet"* is honest). The link nudge **already exists** at the moment of logging (auto-match: *Log this run* / *Looks like
  this one?* with the run named, *Wrong one?*), and *Update log* links one afterwards: no new nudge.
- **Collins.** Ship the trace as the share image in the same build as the hero: the moment someone sees L1 is the
  moment they want to send it. And since L1 is rare, make the rest of the hero as confident as the trace; three big
  numerals in ink are not decoration.

**Recorded:** no disagreement on scope. Collins' share image is accepted for phase 1 if it reuses `SaveImageButton`.

### ⚖️ Ruling: SHIP WITH AMENDMENT, phased, each phase its own build and check
1. **Phase 1, the logged journey.** Session detail (logged) hero with **all five states L1–L5**, the trace with
   ceiling-only bands for easy, long and recovery (Part 3 finding), *What was planned* fold, closing marks; Post-run
   trace in the zone bar's slot, **revealed after RPE**; one sentence owner shared by both; share image via
   `SaveImageButton`. No new link nudge (it exists).
2. **Phase 2, pre-run detail.** Step rows (W5), silhouette inside the structure header (from the step model, not
   text), duration range in the existing tile.
3. **Phase 3, Today card.** 6 px rail, duration range, silhouette replacing the zone ruler. **Check the website**,
   which renders `SessionCard`.
4. **Every phase ships with an inventory check**: a markup arm per screen asserting each *must not lose* element still
   renders, and a height measure at 375 px in the common state, falsified by removing one element.
5. Coaching routes from Part 3 stand (CD-1 evidence; Outdoor/Treadmill). L3/L4 copy is reused; only the trace
   sentences are new copy, for the founder. The trace's sentence thresholds go to the Coaching Board (Part 6).

### ⚠️ What this does not settle
Copy (founder); the tier of the trace (the post-run read is PAID via `activity_intelligence`; whether the trace itself
is free is an SLT question under *gate richness, never access*); how a two-hour run reads at 375 px; the device.

---

## Part 6 — SLT (Sutherland, Fried, Hutchinson, Wood, Zhuo), 2026-10-21

**Asked by the founder:** *"Take these to the SLT but we do have to remain on brand … be very clear on what is there
already."* Traynor's commercial seat stays stood down (£0 revenue, 0 paying subscribers): nobody here prices conversion.

### What is already there (read from the code, not assumed)
| Founder's question | Exists? | Where | Copy today |
|---|---|---|---|
| 1. No-HR line (L3) | ✅ **Yes** (HR-SYNC-02) | `HrPendingStatusRow` on the Today card; `PendingHrCard` on Post-run (paid) | *"Watch HR hasn't landed yet."* (24 h, `PENDING_HR_WINDOW_HOURS`) → *"HR didn't land. Tap to retry."* |
| 2. Hand-logged average HR (L4) | ✅ **Yes**, as a column | Execution summary, *Planned / Actual* | *"141 bpm avg"*, `--warn` with ↑ over the Zone 2 ceiling |
| 3. Link nudge | ✅ **Yes**, at the moment of logging | Auto-match (`resolveAutoMatch`) on Today's *Log this run* and the session CTA; `linkPickerCopy` | *"Log this run"* (high) / *"Looks like this one?"* (medium) + run name · distance · when + *"Wrong one?"*; *"Update log"* links later |
| 4. Trace tier | ❌ New | — | — |
| The trace's sentence | ❌ New copy | — | Draft below |

**So items 1–3 need no new copy and no new UI decision: reuse.** The SLT sat on item 4 and on the brand fit of the
one new piece of copy.

### Facts for item 4
- The trace is **rule-based** (the runner's own heart rate against their own zone ceiling); no model call, no cost per
  view. Kit's read, the reframe and plan reshaping are the AI and stay where they are.
- Today the post-run AI surfaces are PAID (`activity_intelligence`); the execution summary (planned vs actual) is shown
  to every tier. CLAUDE.md: *"Gate richness, never access."* FREE includes *"session display and tracking"*.

### Seats
- **🧠 Sutherland.** The trace is the costly signal: it shows a runner something no encouraging app can, that they went
  over. Paywall it and the proof of the brand sits behind a till. Give the picture away and charge for the
  explanation: *why* you drifted is what Kit is for. On brand: *"Hold the zone."* belongs in exactly this moment.
- **📦 Fried.** Free, and stop building what exists: items 1–3 are done, and the honest work is to reuse them. The trace
  is their data drawn back to them; charging for that is charging for their own heartbeat. One quiet locked line under
  it for free runners (*Kit's read on why*, the existing locked pattern) and no more.
- **🏃 Hutchinson.** No physiology claim in a line drawn against a ceiling, so no objection to free. **But the sentence
  makes claims** ("you held it", "it got away from you") on thresholds the prototype invented (under 10% above, a
  three-minute run above). Those are coaching numerics: they go to the Coaching Board and into named config, as the
  Configuration Singularity requires. The ceiling-only rule for easy runs is §12 and already settled.
- **🔬 Wood.** This is the habit loop: run, see, adjust next time. Feedback that arrives only for payers cuts the loop
  for the runners we are trying to change. Free. And keep it the same picture every time: a familiar cue is what
  becomes automatic.
- **🧭 Zhuo.** On brand by construction: the reused strings already passed the voice rules, and the new sentences are
  short, honest and specific. Brand checks for the founder: no tagline used in the app sentence; *"Hold the zone."* is
  `BRAND.voiceAnchor` and is used only as itself, never rephrased; no em dashes.

**Conflicts:** none on the tier. Hutchinson's condition (thresholds to the Coaching Board) is accepted by all.

### ✅ Recommendation
1. **Items 1–3: reuse what exists.** No new nudge, no new no-HR copy, no new average-HR treatment.
2. **The Zone Trace is FREE** (`SESSION-SCREENS-WOW-01`, tier: FREE). Kit's read on *why* stays PAID; free runners see
   the existing locked line under the trace.
3. **The trace's sentence thresholds go to the Coaching Board** before build, as named config.
4. **New copy for the founder** (the only new words in phase 1), checked against `brand.md`'s voice:

| State | Draft |
|---|---|
| Held | *"Hold the zone."* is the voice anchor; the held line: **"You held the zone."** |
| Drifted late | **"You held it for 38 minutes, then it got away from you."** |
| Over most of it (easy) | **"Above your ceiling for 32 of 55 minutes. Easy days need to feel easy."** |
| No trace, has % (L2) | Reuse the post-run verdict sentence family that exists |

**MUST/NEVER:** no gamification; no locked brand string rephrased; tokens only; no modal; free users keep the plan,
the card and the log action (*gate richness, never access*). **Risks:** the free trace removes one paid-only visual
from the post-run screen; with no conversion data there is no way to know whether that matters (Traynor's absence,
stated rather than guessed).

---

## Part 7 — Coaching Board: when each trace sentence applies (2026-10-21)

**Founder, on the three sentences:** *"1 = yes"* (approved) and *"yes run the board"*.
**Trigger:** soft, qualifies. The sentences make claims about a runner's effort, and their thresholds are coaching
numerics (Configuration Singularity), so they are this board's even though no doctrine file has been touched yet.
**Proposed:** pick the sentence from the run's time above its ceiling, plus, for the late-drift line, when the first
sustained excursion began.

### 🔍 Conflict scan (amendments read, not just headings)
- **§12 Am.1 (`ZONE_DRIFT_ABOVE_CEILING_PCT` = 20):** drift is **directional**, time *above the ceiling*, never a band.
  The accusation sentence must use this, unchanged.
- **§12 Am.2 (`ZONE_HELD_MAX_ABOVE_CEILING_PCT` = 10):** *"a one-sided rule does not invert into one-sided praise"*.
  Praise is stricter than the absence of a warning. **"You held the zone." is praise**, so it takes 10, not 20.
- **§12 (the easy cap):** easy, long and recovery runs are a ceiling; the prototype's band-with-a-floor was wrong and
  is already fixed (Part 3).
- **P-04 (Hutchinson, 2026-09-20):** *"we cannot tell 'ran too hard' from 'ran up a hill in August'"*. A sentence may
  state **what happened**, never **why**.
- **SLT 2026-09-20 (`zoneVerdictLabel` returns null):** the *pill* lost its words. These sentences are not the pill;
  they carry the run's own numbers. No conflict, but the pill stays wordless.
- **§108:** no composite score. None proposed.
- **Instrument:** the trace's own above-ceiling share matches the stored analysis closely (131 rich traces, 13 runners:
  median |difference| **0.8 points**, p90 **4.8**), but p90 is enough to flip a run across 10 or 20.

### 📐 Measured
- Live analyses with HR: **76, from 2 runners**: 70 at ≤10% above (praise), 3 between 10 and 20 (neither), 3 over 20
  (drifted). Thin, and declared as thin.
- Rich traces treated as easy runs (131, 13 runners; overstated, since some are quality sessions): of those over 20%,
  **11 had the first sustained (3-minute) excursion after 40% of the run**; most drift starts early.

### Seats
- **🏃 Hutchinson (chair).** Use the thresholds this board already ratified; inventing a third pair for a new surface
  is how two screens end up disagreeing about the same run. **The pill and the sentence must never disagree**, so
  when the run has an analysis, its `hr_above_ceiling_pct` decides, and the trace supplies only *timing*. "Then it got
  away from you" states what happened. It does not say why, and it must not grow a cause.
- **📊 Seiler.** Directional, yes. On the late line: cardiac drift on a long easy run is real physiology, and on most
  runs over about 90 minutes heart rate will creep at the same pace. That is exactly what this product asks the runner
  to answer by slowing down, so the sentence is right to name it. The onset rule should be a fraction of the run, not
  a clock time, so a 40-minute run and a 2-hour run are read alike.
- **🎯 McMillan.** This is how a coach talks. Keep the in-between band silent on judgement: a runner at 14% above has
  done nothing wrong and nothing remarkable, so state the minutes and stop. And if a run has no analysis (a free runner,
  since the trace is free), compute from the trace, the same way, from one function.
- **🩹 Willy.** No load claim here. One note: a three-minute sustained excursion as the onset test keeps a hill from
  being called a drift, which is the injury-free version of Hutchinson's August hill.
- **⚕️ Sims.** Heat, illness and the luteal phase all lift heart rate a few beats with no change in effort, and we
  cannot see any of them. That is why the sentences must say what happened and never imply fault; "got away from
  you" passes, "you pushed too hard" would not.
- **💪 Blagrove.** No objection from this seat.

**Recorded disagreement:** none on the rule. Seiler would add a heat note one day; there is no temperature-aware
copy and none is proposed.

### ⚖️ Ruling: CORRECT WITH AMENDMENT
| Time above the ceiling | Sentence | Rule |
|---|---|---|
| **≤ 10%** (`ZONE_HELD_MAX_ABOVE_CEILING_PCT`) | **"You held the zone."** | §12 Am.2 praise ceiling, reused |
| **> 10% and ≤ 20%** | **"Over your ceiling for {m} of {n} minutes."** (the factual first half of the approved line, no judgement) | Neither praise nor warning |
| **> 20%** (`ZONE_DRIFT_ABOVE_CEILING_PCT`), the first sustained excursion **≥ `TRACE_SUSTAINED_ABOVE_S` (180 s)** starting **at or after `TRACE_LATE_ONSET_FRACTION` (0.4)** of the run, and ≤ 10% above before it | **"You held it for {m} minutes, then it got away from you."** | Timing from the trace |
| **> 20%**, any other shape | **"Above your ceiling for {m} of {n} minutes. Easy days need to feel easy."** on easy, long and recovery runs; the first sentence only on quality | §12 Am.1, reused |

- **One owner of the share:** the run's analysis (`hr_above_ceiling_pct`) when it exists, so the pill colour and the
  sentence always agree; otherwise computed from the trace by the same smoothing (`TRACE_SMOOTHING_S` = 30 s, the
  prototype's window, now named). The trace is always the source of the *minutes* in the late line.
- **Words never state a cause.** No "too hard", no "pushed", no "ran too fast".
- ✅ The in-between sentence: founder approved 2026-10-21 (*"1. Yes."*).

### 📦 Artifacts (with phase 1, in one commit)
1. **Principle:** §12 Amendment 3, *the trace sentence*: the table above, the one-owner rule, the no-cause rule.
2. **Numerics:** `TRACE_SUSTAINED_ABOVE_S`, `TRACE_LATE_ONSET_FRACTION`, `TRACE_SMOOTHING_S` in `lib/coaching/constants.ts`,
   reusing the two ratified thresholds rather than copying them.
3. **Check:** not a `validatePlan()` invariant (it reads a run, not a plan). A unit test that every sentence comes from
   the selector, that each row of the table is reachable, that a run at exactly 10 and 20 lands where §12 says, and that
   with an analysis present the sentence and `zoneVerdict` never disagree; plus a check that no trace sentence names a
   cause. Falsified by moving a threshold.

**SLT escalation:** none.

---

## Part 8 — Build analysis, phase 1 (the logged journey), 2026-10-21

**Input:** Design Board build ruling (Part 5) · SLT (Part 6: trace FREE, reuse) · Coaching Board (Part 7: sentences) ·
founder approvals (four sentences; *"Yes"* to start).
**Change:** the run's own heart-rate trace, with its sentence, appears on the logged journey, and the logged session
detail leads with the run.

**Settled ground:** Part 2/5 rows · *RPE asked before the read* · *empty means calm* · `getSessionColor` the only colour
source · *Type accent, not flood* (Silvanto's veto) · §12 Am.1/Am.2 thresholds · SLT 2026-09-20 (the pill stays
wordless) · COMPLETE-01 (`SessionCompleteCard` is the peak-end artefact, rendered **after RPE** on both paths) ·
SAVE-IMG-01 (`/api/og/session-complete-card` renders the same card at 1080 × 1920).

### 🔴 The finding that changes the plan
The ruling put the trace in **`RunFeedbackCard`'s zone-bar slot**. That card is **paid-only**
(`hasPaidAccess && analysis`), and the SLT has since made the trace **free**. Read from the code, the free, after-RPE
slot already exists: **`SessionCompleteCard`**, which shows *TIME IN ZONE % + ZoneBar* (state A) or *RPE / 10*
(state B), renders **after the runner answers how it felt** on **both** the hand-logged path (`SessionPopupInner`'s
reflect view) and the linked path (`PostRunScreen`), and **is the share image** (`SaveImageButton` → the OG route).
So the trace belongs there: one change satisfies *free*, *revealed after RPE*, *on both paths* and *the trace is the
share image*, with no new card.

**Design Board, convened on the location only (Zhuo chair):** Zhuo: the ruling's intent was "where the zone bar is,
after RPE"; this is that place, and the one we named was wrong about the tier. Silvanto: one card, not two; agreed.
Wroblewski: it also reaches the hand-logged path, which the named slot never did. Sierra: the reveal is better here,
because the card is the moment. Collins: the share image comes for free. **Ruling: SHIP WITH AMENDMENT.** The trace
replaces `SessionCompleteCard`'s ZoneBar when a rich trace exists; the state B (RPE) and the ZoneBar remain for the
other states. `RunFeedbackCard` is unchanged in phase 1.
⚠️ **Issue found and filed, not fixed:** a paid post-run already shows time-in-zone **twice** (`RunFeedbackCard`'s
*"32% in your prescribed zone"* bar and `SessionCompleteCard` state A). Adding the trace makes the repeat louder.
Filed as `POSTRUN-ZONE-TWICE-01` (🧭 Design Board).

### Reuse
| Need | Reused | Blast radius |
|---|---|---|
| Thresholds | `ZONE_HELD_MAX_ABOVE_CEILING_PCT`, `ZONE_DRIFT_ABOVE_CEILING_PCT`, `zoneVerdict` | Read only |
| Ceiling | `hrBandForZoneString`, the session's prescribed zone (§84, `displayZonesForSession`) | Read only |
| Colour | `getSessionColor(session)` | Read only |
| Trace read | The dashboard's existing direct, RLS-scoped read of `strava_activities` (the pattern at `DashboardClient.tsx:1358`), extended by **one column** (`raw_payload->hrSamples`) for **one** activity, on open | No new route; the same client that already works on native |
| Smoothing / onset maths | New pure owner `lib/coaching/zoneTrace.ts` (the prototype's, named) beside `streamAnalysis.ts` | New |
| Card and share | `SessionCompleteCard` (state A gains the trace), `/api/og/session-complete-card` (draws it; resolved hex, as that route already does for every colour) | Both callers of the card, the OG route, `SaveImageButton` unchanged |
| No HR yet | `HrPendingStatusRow`, `PendingHrCard`, `classifyHrPending` | Unchanged |
| Logged numbers | The execution summary (planned vs actual) | Moved (below) |

### Consumers (app and website)
`SessionCompleteCard`: `SessionPopupInner` (reflect view), `PostRunScreen`, the OG route. `SessionPopupInner`:
`DashboardClient`, `/copy-preview`. **Website: none** (no marketing page renders either; checked `app/` page routes).
`FounderNoteScreen` references the card's voice anchor in a comment only.

### Is it a MOVE? **Yes, for 1b** (the logged detail's order). The six asks:
1. **Navigates in by anchor:** none (`getElementById` / `scrollIntoView`: 0 in `SessionPopupInner`).
2. **Reached only from it:** `ZoneInfoSheet` opens from the zone card's tap. Folding the card under *What was planned*
   must keep that tap working when the fold is open. Check added.
3. **Reached from both:** none.
4. **Copy naming a location:** none found (*"above"*, *"below"* searched in the screen's strings).
5. **Own header:** the zone card carries *HOLD THE ZONE*; inside the fold it must not repeat the fold's title.
6. **Ran on mount:** four `useEffect`s, all keyed on `session` / `completion`, none on the zone card. Unchanged.
7. **Who may mount it:** the fold is ungated; the zone card stays visible to every tier.

### Routing
Coaching: done (Part 7). Design: the location amendment above. SLT: done. Founder: done (copy).
`zona-architectural-principles`: the read stays client-side under RLS like its siblings; no AI call (ADR-006 n/a).

### Split: two builds, each committed and verified on its own
- **1a. The trace.** `zoneTrace.ts` (sentence selector, smoothing, onset) + its §12 Am.3 + constants + tests in one
  commit · `ZoneTrace` component · `SessionCompleteCard` state A shows it when the run has 100+ samples · the OG route
  draws it · the one-column read on both paths.
- **1b. The logged detail.** The execution summary leads; zone card + structure fold under *What was planned*; closing
  marks; the five states.

### Risks → mitigation
- `SessionPopupInner` is ~2,000 lines: 1b moves blocks, never rewrites them; the move hook fires and the six asks
  above are re-checked on the diff.
- `raw_payload` is large on some rows: the select names the one key (`raw_payload->hrSamples`), not the column.
- Satori (the OG renderer) and SVG: verified by rendering the PNG, not assumed.
- Free tier: no analysis exists, so the share is computed from the trace by the same owner; the pill stays as it is.
- A trace that disagrees with the analysis near 10 or 20: the analysis decides when present (Part 7).

### Acceptance
Every sentence comes from one selector (tested at 10, 20, the late rule, quality vs easy) · the trace appears only
with 100+ samples and only after RPE · states L2–L5 render exactly as today · no must-not-lose element disappears
(markup arms, falsified) · the OG PNG shows the trace · full suite green · seen at 375 px on real traces.

---

## Part 9 — Design Board: the smaller 1b and POSTRUN-ZONE-TWICE-01 (2026-10-22)

**Asked:** the founder approved taking the re-scoped 1b and the duplicated time-in-zone to the board.
**Premise re-measured before the sitting** (the item was a snapshot): `POST-LOG-01` (2026-05-16) already folds the whole
session body on a logged session behind *"Session details · tweak how it felt"*, closed by default. So the
*"What was planned"* fold the board ruled in Part 5 **already exists**. What does not:
1. **A free runner reopening a logged session sees none of their own run**: `LockedCoachingPreview` leads and the
   planned-vs-actual summary is inside the closed fold.
2. **The trace never appears on a reopened session**; it lives on `SessionCompleteCard`, shown only straight after RPE.
3. **Time in zone is shown twice** on a paid post-run: `RunFeedbackCard`'s zone row (verdict line + % + bar) and
   `SessionCompleteCard` state A (% + ZoneBar, now the trace) directly below it.

### 🔍 Settled ground
- **POSTRUN-JOURNEY-01 part 1 (founder's overturn, 2026-10-07):** on post-run *the zone signal leads, Kit immediately
  below, above the fold at 390 pt*; the score stays a collapsed chip. Traynor's argument (the paid read is what they pay
  for) is recorded as not withdrawn; Kit-above-the-fold was its mitigation.
- **RPE asked before the read** (post-run).
- **COMPLETE-01:** `SessionCompleteCard` is the peak-end artefact and the closing moment (*"Logged."* + the voice anchor).
- **UX-POSTRUN-01:** no dashboards; *Up next* before *Unlink* (Wood).
- **Gate richness, never access.**
- Guarded by `lib/ui/postRunOrder.test.ts` (order and absence, source-shaped).

### Seats
- **🧭 Zhuo (chair).** The board ruled 1b on a premise that was half false, and the honest response is a smaller ruling,
  not a defence of the old one. The decision underneath both questions is the same: **one zone signal, in one place, on
  every logged surface**, and the place that is free, shared and closing is the completion card.
- **✋ Silvanto.** Two zone signals stacked is the "hierarchy of horizon" failure in its plainest form: the same fact,
  twice, a centimetre apart. Make the card the only home of it, and Kit's read carries words only.
- **🎓 Sierra.** On a reopened session the free runner should meet their own run, not a sales card. And the closing
  marks: the card already closes the session (*"Logged."*, *"Hold the zone."*). Three marks on top of that are a
  checklist; for a hand-logged runner two would never tick. Drop them.
- **📱 Wroblewski.** Measured: the card with a trace is ~450 px at 375. Put it under *How did it feel* on post-run and
  Kit's read starts below the fold on every phone. That **breaks the mitigation the founder accepted on 10-07**. It is
  his call, not ours, and he should see it as a choice. On reopen, respect RPE-before-read: if no RPE was given, show one
  line, *"How did it feel?"*, opening the fold, and no card.
- **🎪 Collins.** The card is the moment and the share; putting it first is right. I would also say Kit below the fold is
  fine because the number is what they came for, but that is the founder's overturn to revisit, not mine to wave away.

### ⚡ Recorded disagreement
Collins would accept Kit below the fold; Wroblewski and Silvanto would not decide it for the founder. **Unresolved here
by design: routed to the founder.**

### ⚖️ Ruling: SHIP WITH AMENDMENT
1. **One home for the zone signal:** `SessionCompleteCard` (trace when rich; % + bar when sparse; RPE / 10 when no HR) on
   every logged surface. **`RunFeedbackCard` loses its zone row** (verdict line, %, bar) wherever the card sits above it;
   the score chip and Kit's read stay. The card's sentence comes from `traceSentence` for every state with a %, so the
   verdict line's job is not lost. Resolves `POSTRUN-ZONE-TWICE-01`.
2. **Post-run order:** How did it feel → **the completion card** → Kit's read → reflection → Done. Keeps *number before
   words* and *RPE before the read*. ⚠️ **Kit moves below the fold** (estimate from the measured 450 px card): a
   **founder decision**, presented as one.
3. **Reopened logged session, every tier:** the completion card first **when RPE exists**, else one line *"How did it
   feel?"* that opens the existing fold → Kit's read (paid) / `LockedCoachingPreview` (free) → Up next → Unlink → the
   existing *Session details* fold, unchanged.
4. **Closing marks: DON'T SHIP** (not permanent). The completion card is the closing ritual; marks that cannot all tick
   for every tier are a checklist.
5. **Checks:** `postRunOrder.test.ts` amended to the new order; a check that no logged surface renders two zone signals;
   a check that a free reopened session renders the card before the locked preview; each falsified.

**Founder decision needed before build:** on post-run, the card under *How did it feel* puts Kit's read below the fold
(it is above today, by his 10-07 condition). **A:** accept it (the number leads, Kit follows). **B:** keep Kit above the
fold by putting Kit's read first and the card after it, which keeps today's order but leaves the number second.

### Part 9b — the board decides the post-run order from a UX point of view (2026-10-22)

**Founder:** *"I want them to make the call from a ux point of view."* Recorded as a delegation: the board may now rule on
the condition he set on 2026-10-07 (Kit above the fold), on UX grounds only.

- **Zhuo.** The question is the runner's, not ours: straight after a run they ask *"how did I do?"*, then *"why?"*. The
  screen should answer in that order.
- **Silvanto.** Number first, explanation second is the hierarchy of horizon done right. The card's sentence is already a
  one-line read, so the first screen is not empty of meaning without Kit.
- **Sierra.** The card is the moment the runner recognises themselves: their own line, their own sentence. Kit's read is
  worth a scroll once they know what it is explaining.
- **Wroblewski.** One condition: nothing may suggest the screen ends at the card. The card must not sit flush with the
  bottom of the viewport with nothing peeking; the space before Kit stays at the normal section gap so Kit's byline
  starts within the first scroll, and the *Done* button stays last.
- **Collins.** A, as before.

**Ruling: A, unanimous on UX grounds.** How did it feel → completion card → Kit's read → reflection → Done. Kit below the
fold is accepted; Wroblewski's condition binds (normal section gap, no extra spacing, Done last). Traynor's commercial
argument for Kit above the fold is recorded as not answered here: it is a commercial question and his seat is stood down.

---

## Part 10 — Design Board: phase 2 re-sat on settled ground the 10-21 scan missed (2026-10-22)

**Trigger:** building `SESSION-PRERUN-DETAIL-01` (W5 step rows, W3 silhouette, W7 duration range) surfaced rulings the
Part 2 scan did not read.

### 🔍 Settled ground (missed on 10-21, read now)
- **`SESSION-STEP-SLOTS-01` (2026-10-06), Option E:** lead = the runner's chosen metric; **line 2 = the target, first,
  always, on every row**; line 3 = the other metric, then the instruction. **Option C, a sentence in the lead slot, was
  pre-killed** (`:723`). Runna's *"0.62mi at 13:00/mi"* **is** Option C.
- **`SESSION-STEP-LEGIBILITY-01` (2026-10-06, re-sat):** a recovery step **always** keeps its role word as the
  **modality signal**; the `n×` repeat bar is unchanged.
- **UX-SESSION-GLYPH-01 / `ui-patterns.md`:** *"a second non-verbal encoding of something the colour and the label
  already carry"* is forbidden.
- 🔴 **Scan failure, recorded:** Part 2's scan read the register's summary rows and not §21b's amendments, the same class
  as 6ai. W5 was ruled against ground it did not know it was standing on.

### 📐 Measured (199 v2 sessions from the cohort grid)
Every non-running step already names its modality in the role word: **jog 232 of 232, stand 12 of 12** (no walk steps
in the sample). Run steps are the default and say *"Hard"* or the coaching note. The pre-run tiles already show both
distance and duration through the km / min toggle.

### Seats
- **Zhuo.** W5 was a preference borrowed from a screenshot, ruled without the rulings. Vacate it rather than defend it.
- **Silvanto.** The modality glyph is a second encoding of a word that is already there on 100% of the steps it would
  mark. That is the forbidden pattern, by name.
- **Sierra.** Option E put the target where the runner's eyes go mid-run, and nothing here is new evidence against it.
- **Wroblewski.** W7 in the detail is already one tap away (the toggle). Its real value is on the Today card, where the
  runner plans the morning: keep it for phase 3.
- **Collins.** I lose W5 and say so: it was the most Runna-like thing in the report, which is exactly why it should not
  have survived. The silhouette is the one piece that is ours: draw it.

### ⚖️ Ruling
1. **W5 step rows: DON'T SHIP — vacated** (not permanent). Option E stands. The modality glyph is a duplicate encoding.
2. **W7 in the pre-run detail: DON'T SHIP** (exists: the toggle). Moves to phase 3, the Today card.
3. **W3 silhouette: SHIP.** In the *Session structure* header of the pre-run detail, read from the session model
   (`composeSession` parts + `derived_set` steps), height by prescribed zone, width by minutes. Not on Plan rows. Hidden
   when the session has no structure. CD-1 evidence (Cruise intervals = Mile repeats) already routed to the Coaching
   Board.
4. **So phase 2 is the silhouette alone.**

---

## Part 11 — Design Board: phase 3, the Today card, re-sat on two rulings and one measurement (2026-10-22)

**Settled ground found while re-measuring:**
- **HOLD-THE-ZONE-01 (2026-05-14):** the 5-segment `ZoneBar` under the Today card exists because *"zones were a chip
  everywhere and a headline nowhere"*; it is the brand's "you are here" in the five zones.
- **TODAY-V2 preconditions:** 22 conditional blocks can render on Today with no priority order; the fold is contested.
- `SessionCard` renders on the **website homepage** too (`app/page.tsx`, two places).

**Measured:** the Today `ZoneBar` is **4 px** tall (`ZoneBar` default, no labels) plus a 12 px gap. A silhouette that
reads at 375 px is ~30–40 px (the detail's is 40). Swapping them adds ~26–36 px to Today's common state. The meta line
(*"Zone 3 · 146–157 bpm · 6:16–6:31 /km"*) already fills its width at 375 px; a time range appended to it would wrap.

- **Zhuo.** The Part 5 ruling (silhouette replaces the ruler, nothing taller) cannot be built as written: the two
  conditions contradict each other at the measured sizes. Pick the one that matters.
- **Silvanto.** Keep the ruler. It is the five-zone scale, and a shape without the scale says less, not more. The shape
  is one tap away on the detail, which is where depth belongs.
- **Sierra.** Agreed. On the time range: *how long do I need?* is the planning question, so give it, but not in a line
  that wraps.
- **Wroblewski.** Under the distance on the right: the card's left column already has two lines, so a small second line
  on the right costs no height. Only on easy and long runs (one pace band governs the whole run), only when the lead
  is distance.
- **Collins.** The 6 px rail is the one piece of colour left from W4 as amended; ship it, and say plainly that the
  homepage cards change too. I lose the Today silhouette, recorded.

### ⚖️ Ruling: SHIP WITH AMENDMENT
1. **The silhouette on Today: DON'T SHIP** (not permanent). The `ZoneBar` stays (HOLD-THE-ZONE-01); the shape is on the
   detail.
2. **The rail: 3 → 6 px** on `SessionCard`, app **and** website homepage, as a named constant.
3. **The time range:** a small second line under the distance on the right (*"35–41 min"*), easy, long and recovery
   runs with a pace band, only when the card leads with distance. From one owner, through `formatDuration`.
4. **Check:** the card's height unchanged at 375 px with the range; the range absent on quality runs and in duration
   mode; the rail width from the constant.

---

## Part 12 — Coaching Board: may the Today card show a time range on an easy run? (2026-10-22)

**Trigger:** soft, qualifies: a number the runner reads as guidance about effort. **Question:** easy, recovery and long
runs display their pace as a ceiling (*"6:45 /km or slower"*, `easyPaceAsCeiling`; CD-11 / §12: *"'or slower' is ratified
doctrine"*). A time range from both ends of the stored band (*"35–41 min"*) states a slow end the doctrine does not impose.

**Conflict scan:** §12 (easy is a ceiling, not a band), CD-11 (*or slower*, never a ≤), §12 Am.2 (praise vs accusation,
not touched), P-04 (what happened vs why, not touched). No conflict with the zone model.

- **🏃 Hutchinson (chair).** The slow end of the band is the engine's own estimate of an easy pace, not a limit. Read as a
  bound, *"35–41 min"* tells a runner who jogs at 8:00 that they overran. Read as an estimate, it is true and useful.
  So it must be marked as an estimate, which this app already has a mark for.
- **📊 Seiler.** Easy has no slow limit; nothing here may suggest one.
- **🎯 McMillan.** A day-job runner plans the morning by the longer number, so give both ends; just do not make the
  longer one sound like a deadline.
- **🩹 Willy.** No load claim. No objection.
- **⚕️ Sims.** No objection. **💪 Blagrove.** Not this seat's domain.

**Ruling: CORRECT WITH AMENDMENT.** The range shows with the app's estimate mark, **`~35–41 min`**, as the card already
marks estimated distances (`~2km`). It is an estimate of how long the run takes at the band's two ends, not a limit; no
other wording. Not a principle, numeric or invariant: it reads the stored band and adds no prescription (recorded as
not mechanically checkable by `validatePlan()`; the format is tested).

### Part 11b — the time range, built, measured and withdrawn (2026-10-22)

Built as ruled (Parts 11 and 12) and measured on the real `SessionCard` at Today's 343 px content width. **Height: no
cost** (65.6 px with and without). **Width: the cost that decides it.** The right column widens, and on the longest
realistic meta line (*"Zone 1–2 · 118–145 bpm · 11:30 /mi or slower"*, range *"~1h 43–1h 54"*) the meta line truncates:
**247 px of text in 223 px**, cutting the pace target, which is on Today's must-not-lose list and is what
`SESSION-STEP-SLOTS-01` puts first. A typical easy card fitted (235 of 235). A rule on character counts would be the
*"arithmetic on character counts is not a layout"* error the register already records.

**Ruling (chair, on the measurement): DON'T SHIP** (not permanent). The code was removed, not left unused. Reopen only
with a layout that costs neither the pace target nor a line, measured at 320 and 375 px in miles.
