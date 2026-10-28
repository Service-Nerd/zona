# Design Board: the strength session screen, and a guided session (2026-10-28)

**Founder:** "I want the screens and wording ... it needs to feel part of the app and be consistent with the run sessions
but also be distinct." Feedback after two sessions: *too much text on screen ... not clear on some of the wording ... I'm used
to super setting ... I'd like those to be on different pages, so round 1 ... make it easier to capture the weights ... track
timed exercises on the app ... start the session and end it when finished.* Evidence: three screenshots of his own
*Full body · Wed · Week 2* session, and two of a competitor's strength screens (for reference, not for copying).
Items: `STRENGTH-SESSION-PARTS-01` (E), `STRENGTH-GUIDED-SESSION-01` (F), `STRENGTH-BW-LOG-01` (bug).
**Trigger:** a new screen (guided session) and a significant change to an existing one: hard.

## Settled-ground scan

- **STRENGTH-APP-01 (2026-10-16):** SessionScreen anatomy (pinned header, Duration · Exercises tiles, `StepSection` cards,
  actions at the end), titles by kind, cues one tap deep. **Kept.** Its "done or skipped only, no per-set logging until
  something reads them" is **amended** below: a guided session reads its own rounds while it runs; only session time and
  the existing main-lift logs are stored.
- **STRENGTH-PROGRESSION-01 (10f, 2026-10-18):** main lifts only; dose loudest; plain words, never "RIR"; no PR badge,
  streak, chart, celebration or required field; Mark complete never waits. **Kept.**
- **STRENGTH-MEDIA-01:** media only inside an opened row; not built. **Untouched.**
- **STRENGTH-SESSION-TITLE-01, STRENGTH-NOTE-01, STRENGTH-LEGS-DAY-01:** kept; the legs-day line now also appears on a
  converted session (Coaching Board 2026-10-28, A).
- Token layer: `--s-strength` for training blocks, `--moss` for warm-up/cool-down. No new token.

## Evidence (the founder's screenshots, 375 pt; source `StrengthSessionScreen.tsx`)

- Every main-lift row carries two support lines: *"each side · 2 reps in reserve · rest 1:30 min"* and *"New lift. Start
  light."*, so four main lifts print the same two sentences four times. 7 + 4 + 2 + 2 rows; the actions sit below
  ~3.5 screen heights.
- **The engine's supersets are invisible.** Calf raise + side plank are paired (`superset`), and each row shows its own
  *"rest 1 min"*; nothing says "together".
- "Reps in reserve" appears on core and bodyweight moves (*Side plank with leg lift*, *Kneeling walkout*), where the
  founder read it as unclear.
- The weight field is one tap deep and uses the keyboard; the inverted row (bodyweight) asks for a weight (logged 90 kg).
- No start, no end, no timer, no idea of "where am I" during the session.
- Reference pattern seen: parts ("Part 4 · Repeat 2 times"), each part's sets/rest/equipment said once, supersets as a
  linked pair, a guided mode one part per page with timers and a single start.

## The seats

🧭 **Zhuo (chair).** Two jobs on one screen today: *what is this session* and *do the session*. The list does the first
badly and the second not at all. Split them: the overview says what, in parts; a guided session does it, one part at a
time. The success condition is observable: the founder can run a whole session from the phone without scrolling back up.

✋ **Silvanto.** Horizon again. In the gym, what matters is this part, this set, this rest. Everything else is noise at that
moment. The overview can carry the whole session because the runner reads it before starting; the guided page carries
one part. Say each thing once: rest and effort belong to the part, not to every row. No veto: no palette or type change,
`--s-strength` stays the strength signal and the run screen's anatomy holds, which is what "consistent but distinct" means.

🎓 **Sierra.** "Reps in reserve" is our phrase, not theirs. Say what to do: "Stop with 2 in the tank." And the runner
gets better at lifting by knowing what they lifted last time; put that number where the weight goes, prefilled.

📱 **Wroblewski.** Gym, one hand, sweaty. Weight entry by keyboard is the slowest input we have: a stepper with the
suggested weight prefilled, ± the lift's own step (2.5 kg lower, 1 kg upper), the keyboard only on tap of the number. A big
"Next" at the bottom, reachable. The rest timer counts down by itself and does not need a tap to start. Screen stays awake.
Timed moves get a start button, not an auto-start.

🎪 **Collins.** Distinct: the overview is grouped in **parts** with a link between paired moves, which no run screen has,
and the guided session is the first screen in the app built for doing rather than reading. Consistent: same header, same
cards, same type. I want the part header to carry the round count big ("2 rounds"), it is the number the runner is
counting.

## Recorded disagreements

- Collins wanted the round count as the part's headline; Silvanto would keep the exercise the headline and the count in
  the part header. **Collins lost** on the overview; the guided page leads with the round ("Round 1 of 2"), where it is the
  thing being counted.

## Ruling

**`STRENGTH-SESSION-PARTS-01`: SHIP WITH AMENDMENT.** The overview keeps SessionScreen anatomy and groups training work
into **parts**: *Warm-up · Part 1 … Part N · Cool-down*. A part is one lift, or a superset pair shown as two linked rows.
The part header says once: rounds, rest after the round, and the effort line in plain words. Rows say only exercise and
dose ("8", "8 each side", "30 s"); the "New lift. Start light." line appears once under the tiles when the session's
lifts are new, not on every row. Effort wording on reps-based work only ("Stop with 2 in the tank"); none on timed core.
A converted session carries the legs-day line. One **Start session** button (primary) above **Mark complete**.

**`STRENGTH-GUIDED-SESSION-01`: SHIP WITH AMENDMENT.** Start session opens a full-screen guided flow, one part per page:
round counter, the part's moves, per-move weight stepper (main lifts, loaded only) prefilled from the suggestion, a rest
countdown after each round, a timer on timed moves (tap to start), Next / Back at the bottom, **End session** always
available. Ending records start and end time and goes to the overview with the feel chips for main lifts and *Done*. Leaving
mid-session keeps progress for the day. Per-set results are held for the session only; stored: session times and the
existing main-lift logs. **Amends STRENGTH-APP-01's "done or skipped only".**

**`STRENGTH-BW-LOG-01`: defect.** A bodyweight lift (bar used as an anchor, e.g. the inverted row) logs the feel only.

## Artifacts at build

1. Pattern: `ui-patterns.md` *Strength session screen* rewritten for parts; new *Guided strength session* section.
2. Constants: `STRENGTH_GUIDED` (rest countdown source = the prescription's `rest_s`; weight step from `LOAD_STEP_KG_*`);
   no new token.
3. Checks: `strengthScreens.markup.test.ts` arms (rest and effort said once per part; superset rows linked; no "reps in
   reserve" on timed items; Start session present; bodyweight lift has no weight field), a guided-flow test of round and
   rest progression, falsified.
4. Wording: in the build plan, founder-approved before build.

## What this ruling does not settle

Nobody has run a guided session on a device; screen-awake and timers in the Capacitor webview are unmeasured.
