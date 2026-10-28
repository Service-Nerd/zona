# Coaching Board: is 4 km enough marathon-pace work away from the long run? (2026-10-28, MP-WORK-DOSE-01)

**Founder:** "Take MP-WORK-DOSE-01 to the coaching board." Seiler's open question from the morning sitting, which ruled
the 4 km "Marathon-pace run" (M2) and held a larger dose INSUFFICIENT EVIDENCE.

## Evidence (measured 2026-10-28 at `92d7e668`)

Three doses prototyped **in memory only** (the `mp_blocks` row mutated inside the script, no file touched;
`scripts/.tmp/mpdose.ts`), each plan validated under the catalogue that generated it. Populations, marathon time-goal
only: 1,140 cohort-grid plans (every third), 396 slow-runner clones, 515 use-case-envelope plans.

⚠️ **The instrument the board asked for cannot see this question.** `measure:fitness` measures weekly-volume build and
peak long run. It has no measure of race-pace exposure, so it would report a dose change as "no change" either way.
What follows is measured directly.

| | 4 km (now) | 6 km | 8 km | 2 x 4 km / 3 min jog |
|---|---|---|---|---|
| Session, cohort (median) | 44 min | 57 | 70 | 77 |
| Session, slow runners (max) | 64 | 88 | 112 | 119 |
| Share of its week, cohort (median / max) | 14 / 20% | 18 / 24% | 21 / 28% | 23 / 30% |
| **Weekly km in the MP weeks** (median / max change) | | **+2 / +3** | **+4 / +6** | **+5 / +6** |
| Overruns the day's limit, cohort (of ~785) | 268 | 268 | **520** | **520** |
| Overruns, slow (of 138) | 58 | **96** | 96 | 96 |
| New refusals, cohort | | 2 | 4 | 4 |
| `INV-PLAN-INJURY-CAP-DELIVERED` warns, envelope | | +1 | **+11** | **+16** |
| `INV-PLAN-DELIVERED-RAMP` warns, envelope | | −2 | +9 | +6 |
| Long-run share warns (`LR-MAX-WEEKLY-PCT`), cohort | | −58 | −90 | −90 |

**Read:** every larger dose **adds** weekly load. The easy runs do not give the volume back, so the MP weeks grow by
2–6 km. Long-run-share warns fall only because the week is bigger. Day-limit overruns double at 8 km, the injury cap is
breached more often, and a few plans become refusals. **No prototype redistributes the dose inside the week's budget**:
that would need engine work.

**Context, not this question:** at today's 4 km, 268 of 789 cohort MP sessions (34%) already run past the runner's
weekday limit (structured sessions are exempt under §81 and carry the overrun note).

## Conflict scan

- **§19 Am.2 (this morning):** the "Marathon-pace run" is one continuous 4 km with its MP work unchanged. A larger dose
  amends that.
- **§2 / §3 / §90 (ADR-022), the delivered volume ceiling:** every prototype raises delivered weekly volume in peak
  weeks; the injury-cap warns rising is §90's delivered ceiling being crossed.
- **§81:** weekday limits; structured sessions are exempt, and overruns double at 8 km.
- **§25 / `INV-PLAN-RACE-PACE-WEEK-CONCENTRATION`:** an MP long run and an MP run may not share a week; not moved by any
  prototype (0 delta).
- **§105:** marathon pace must exist away from the long run. It does at 4 km; the question is only how much.

## The seats

🏃 **Hutchinson (chair).** The question was fair and the answer is not "more". It is "not like this". Every version we
can build today makes the week bigger, and a peak week getting four or five kilometres bigger is a volume decision, not a
specificity one, made without anyone deciding it. And we have no instrument that measures what the extra marathon-pace
work would buy. I will not rule a dose up on the basis that a different warning went down.

📊 **Seiler.** I raised it and I accept the measurement. My point stands in principle: for a runner with the volume,
marathon-pace work away from the long run is usually more than 4 km. But the version I meant was the same week with more
of it at marathon pace, not a longer week. That is a redistribution, it was not prototyped, and it needs a measure of
race-pace exposure before anyone can say it helps.

🎯 **McMillan.** A 4 km marathon-pace run is on the low side for an experienced marathoner and fine for most of ours.
Doubling the session to 70 minutes on a weekday, and to nearly two hours for the slowest, is not a session these runners
can fit. If this comes back, it comes back scaled by experience, and inside their week.

🩹 **Willy.** The injury-cap warns going from +1 to +16 is the answer for me. The delivered ceiling exists because the
curve and the week diverged before; this re-opens that gap. Against any dose that grows the week.

⚕️ **Sims.** Agree with Willy. The longer weekday session lands hardest on the runners with the least time and the
slowest pace. No objection to a redistributed version being measured.

💪 **Blagrove.** No objection from this seat.

## Recorded disagreement

Seiler holds that 4 km is under-dosed for runners with the volume; the board agrees the measured options are the wrong
way to add it. McMillan would scale any increase by experience. Not a split on the ruling.

## Ruling

- **6 km, 8 km, 2 x 4 km as prototyped: INCORRECT.** Each adds 2–6 km to peak MP weeks (crossing §90's delivered ceiling
  for injury runners) and raises weekday overruns, with no measured benefit.
- **The underlying question: INSUFFICIENT EVIDENCE.** 4 km stands. **What would reopen it:** (1) a prototype that
  redistributes MP work **within** the week's budget (easy volume gives way, the week does not grow), scaled by
  experience; and (2) a measure of race-pace exposure (MP km per plan, inside and away from the long run), which no
  harness has today.
- **No principle, numeric or invariant changes.** The item closes.

## Required artifacts

None: nothing changes. The register row records the ruling and what reopens it.

## SLT escalation

None.
