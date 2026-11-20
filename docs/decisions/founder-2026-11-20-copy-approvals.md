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
