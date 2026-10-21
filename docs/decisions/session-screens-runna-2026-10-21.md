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
