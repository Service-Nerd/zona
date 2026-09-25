# TIME-INPUT-SECONDS-01 — every time field collects seconds

**Design Board, 2026-09-25. SHIP WITH AMENDMENT.** Register row: `design-rulings.md`.

## The ask, and why it was the wrong shape

Founder: *"I want one component that has the same look and feel across the whole app that
we use for that input of time"*, with an explicit invitation to challenge the terminology.

**The component already existed.** `components/shared/DurationPicker.tsx` opens by calling
itself *"the canonical time/duration entry"*, is built on a shared `WheelPicker`, is used by
all six entry points, and **already supported seconds**.

So "component" was the right word for the thing and the wrong word for the problem. **The
problem was that the decision was made six times** — `showSeconds` defaulted to `false`, was
set at three call sites and forgotten at three. Building what was asked for would have
produced a second component and fixed nothing.

## The evidence that turned it into a decision

Taken before the board spoke, on live production data.

| | |
|---|---|
| Stored `target_time` values ending `:00` | **4 of 4** |
| Stored `benchmark.time` values ending `:00` | **8 of 8** |
| **Total** | **12 of 12 — 100%** |

🔴 **The three screens did not omit the seconds. They wrote `:00` into the string.** So the
app asserted a precision it had never collected, and no runner had ever been able to
disagree.

**Worst-case pace error from truncating to the minute, always in the FAST direction:**

| 5K | 10K | HM | Marathon |
|---|---|---|---|
| **11.8 sec/km** | 5.9 sec/km | 2.8 sec/km | 1.4 sec/km |

Sierra's framing carried it: *"We are not failing to record seconds. We are inventing a
slightly better athlete and then coaching them."*

Silvanto's carried the craft half: the benchmark screen **displays** `HM 1:45:28` and, in
the same scroll, **would not accept** `:28`.

## The amendment, and the dissent it preserves

**Wroblewski did not move and the ruling records that.** A **result** is a fact; a **target**
is an intention, and nobody decides *"I want to run 1:54:37"*. Asking for seconds under
*"what time are you aiming for?"* demands precision the runner does not possess — his seat's
core objection, not a quibble.

The chair converted it rather than overruling it: **the wizard's seconds wheel defaults to
`00`.** A runner with no view expresses none at zero cost; a runner who has one can say so.

⚠️ **What would reopen it:** evidence that runners enter non-round targets. **That evidence
cannot exist until this ships**, which is why the objection is recorded as live rather than
answered.

## What shipped

- `showSeconds` **deleted**, not defaulted — so the compiler visited all six call sites
  rather than letting three keep an old default silently
- Seconds wired through `BenchmarkUpdateScreen` and both wizard pickers, including
  sessionStorage draft persistence and the step-completion predicates
- Three `` `${h}:${mm}:00` `` fabrications replaced with the runner's own value
- `'30:00'` for the 30-minute time trial **kept and named** — that is the protocol, not an
  entered value

## What this does not settle

**Nothing here has been felt on a device**, and a three-wheel control is more affected by
that than most. It is this board's standing weakness and it applies in full.

**And the Coaching Board has not seen it.** Input precision changed; no prescription rule
did — but their benchmarks have been optimistic by up to 11.8 sec/km, which is the same
shape as §50's max-HR asymmetry (*"evidence in one direction is informative, in the other it
is not"*). Flagged, not blocked.
