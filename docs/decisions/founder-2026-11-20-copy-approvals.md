# 👤 Founder copy approvals — 2026-11-20

The words for six rulings sat on 2026-11-20, where the board ruled the meaning and handed the words to the founder
(👤 FOUNDER: voice and tone). Drafted by the assistant in house voice; **approved by the founder as written, 2026-11-20.**
No em dashes in sentences (founder call 2026-09-11). These are copy decisions only; each lands with its item's build.

| Item | Surface | Approved copy |
|---|---|---|
| `BENCHMARK-DATE-REQUIRED-01` | in-field declaration option | **I don't remember** |
| `BENCHMARK-DATE-REQUIRED-01` | consequence line for a blank date | *No date, so we treat it as older and set your paces a touch easier.* |
| `PROFILE-BIRTH-YEAR-REQUIRED-01` | step subtitle (replaces the false *"Only to estimate your max heart rate…"*) | *Used to check your max heart rate and how often you get a recovery week.* |
| `PROFILE-BIRTH-YEAR-REQUIRED-01` | in-step decline label | **I'd rather not say** |
| `PROFILE-BIRTH-YEAR-REQUIRED-01` | consequence line for a decline | *Fine. Your max heart rate is used as you set it, and recovery weeks come more often.* |
| `WALKRUN-DELOAD-CLAIM-01` | walk-run deload week `theme` (replaces *"An easier week, on purpose."*) | *Same as last week, on purpose. No step up yet.* |
| `TUNE-UP-CALLOUT-INERT-01` | the tune-up week's line (replaces the PB / "not a race effort" sentence) | *Optional: a parkrun this week. Run it as a check, not a race.* |
| `COACH-READ-1027-FOLLOWUPS-01` (claim 5) | replaces *"not to chase a time"* on plans prescribing race/goal-pace work | *The race-pace runs are practice, not a target.* |
| `DOUBLE-STRIDES-01` | double-run advice when one half carries hill strides | *Doing both? Run the hill strides first.* |

## Checked before filing
The birth-year consequence line makes two claims; both are asserted by `lib/plan/noInventedAge.test.ts`:
*"a max with no age is used AS GIVEN"* (§50 case 1) and *"an absent age takes the MASTERS cadence, the cautious side"* (§3).
The benchmark consequence line follows `INV-PLAN-VDOT-DISCOUNT-DATELESS` (an undated benchmark takes §10's ceiling discount).

## Conditions carried
- The tune-up line ships only if the 💼 SLT approves the surface (Design Board 2026-11-20).
- The birth-year decline does not change App Store 5.1.1's reading ("the declaration is required, the year is not").
- Each build re-checks its line against the code it renders beside; a copy claim that stops being true is a defect.

## Follow-up copy — decided by the assistant on the founder's delegation, 2026-11-20

The founder: *"I told you to sort the words."* Drafted to the follow-up sittings' conditions, filed as decided. No em
dashes; no `%`; a week line never says *"In week N"*.

| Item | Surface | Copy |
|---|---|---|
| `INJURY-RECENCY-01` | injuries step subtitle (replaces *"Old injuries that still show up. Skip if you're clean."*, which told the old-injury runners this follow-up is for not to tick) | *Anything you've had trouble with, even if it's settled. Skip if there's nothing.* |
| `INJURY-RECENCY-01` | field note (replaces *"Select any that are still an issue…"*) | *Tick any you've had. We'll shape the plan around them.* |
| `INJURY-RECENCY-01` | follow-up label, Back / Plantar fasciitis at HM or longer only | **When did it last flare up?** |
| `INJURY-RECENCY-01` | the two answers (unanswered = the first) | **In the last year** · **More than a year ago** |
| `PLAN-NOTE-HEAVIER-WEEK-PLACEMENT-01` | WeekCard line, healthy scope | *This week rises more than we normally allow. Keep the easy days easy, and move the long run rather than shorten it if the week goes badly.* |
| `PLAN-NOTE-HEAVIER-WEEK-PLACEMENT-01` | WeekCard line, injury scope (`non_long`) | *This week rises more than your injury history would normally allow. Keep the easy days easy, and move the long run rather than shorten it if the week goes badly.* |

**Checked:** the action half matches `lib/plan/loadResidualNote.ts`'s existing sentence, so the week card and the plan
tile give the same instruction. The injury line names the injury history, the Coaching Board's binding condition.
*"Last flare up"* is the meaning the Coaching Board ruled (McMillan, Sims).

## `WIZARD-PAID-INPUTS-TIER-01` — decided by the assistant on the founder's delegation

| Item | Surface | Words |
|---|---|---|
| Design follow-up | Wizard + Modify plan terrain, overdo card | As proposed in `design-2026-11-20-wizard-paid-inputs-tier-01.md`: terrain subtitle *Road, trail, or a bit of both. Off-road, effort leads and pace is a guide.* · Road *Pavement, track, mostly flat.* · Trail *Off-road, hills, rough ground. Effort leads, not pace.* · Mixed *Some of each. Off-road, effort leads, not pace.* · Modify plan *Adds a note on pacing off-road. Your sessions stay the same.* · Overdo *Rein me in. I know I'll push too hard if I can.* |
| Coaching follow-up (§40c) | Plan note, `love` × injury history | *You like the hard sessions. With your injury history, the plan keeps them at the standard amount.* |

**Checked:** no em dashes; the §40c line says why the answer had no effect, which is what §40c requires, and claims no outcome.

## `PLAN-NOTE-MULTIWEEK-RAMP-01` — plan tile, more than one heavier week (assistant, on the founder's delegation)

| Surface | Words |
|---|---|
| Plan-level tile, when the plan stamps more than one week | *A few weeks rise more than we normally allow. Each one is marked on its week.* |
| Same, when any stamped week carries the injury scope | *A few weeks rise more than your injury history would normally allow. Each one is marked on its week.* |

**Checked:** no numbers, no em dash; never names one week, so it cannot disagree with the calendar (Collins).
