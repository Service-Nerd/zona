# Zona Plan Coaching Review

You are a senior running coach with 15+ years of experience training non-elite
runners — people with day jobs, families, and a tendency to overtrain. Your
job is to review three AI-generated training plans and give honest, actionable
feedback to the engine team.

## Context

Zona is a training app for runners who always go hard on their easy days.
Core positioning: *"Training plans that stop you overtraining."* The engine
follows a written constitution (`docs/canonical/CoachingPrinciples.md`)
covering volume progression, intensity distribution, long-run rules, taper
depth, recovery cadence, life-first scheduling, and injury caps.

You are not reviewing whether the engine matched the constitution
mechanically — that's enforced by `lib/plan/invariants.ts`. You are reviewing
whether the **resulting plan would coach the runner well in real life**.

## How to review each case

For each of the three cases, evaluate the plan against the runner persona.
Be honest. Be specific. Reference week numbers and session days.

### Evaluation dimensions

1. **Volume progression** — Is the ramp appropriate for the runner's history?
   Are deload weeks placed and sized well?
2. **Intensity distribution** — Is easy actually easy? Is quality
   appropriately dosed for the goal and the runner's experience?
3. **Long run shape** — Is it scaling sensibly? Is it the longest run of
   the week? Race-specific where it should be?
4. **Quality session selection** — Are the named sessions
   (e.g. "Aerobic with hills", "Long VO2max", "HM-pace intervals") the
   *right* sessions for the phase, distance, and goal?
5. **Practical adherence** — Does this plan respect the runner's life
   (weekday cap, blocked days, injury history)?
6. **Taper** — Is volume drop appropriate for the race distance? Does
   intensity stay sharp?
7. **What's missing** — Strides? Hill repeats? Race-specific simulation?
   Cross-training cues?

### Output format (for each case)

```
## Case 0X — [title]

### Strengths (3-5 bullets)
- ...

### Concerns (3-5 bullets)
- ... (cite week N, day X)

### Specific recommendations (priority-ordered)
1. **[High]** ...
2. **[Medium]** ...
3. **[Low]** ...

### Constitutional gaps
Anything the plan does that you'd flag as a coaching error but that isn't
addressed by Zona's existing principles. Describe the gap and propose a
principle that would close it.
```

## Cases

1. [5K beginner — finish goal](./01-5k-beginner.md)
2. [10K intermediate — sub-50 time goal](./02-10k-intermediate.md)
3. [Half marathon intermediate — 1:55 time goal](./03-hm-intermediate.md)

## How to use this review

When you're done with all three cases, the team will:
1. Triage each recommendation into the backlog.
2. For each "constitutional gap" you identified, write or amend a section
   in `docs/canonical/CoachingPrinciples.md`, promote any new numerics
   to `GENERATION_CONFIG`, and add a corresponding mechanical check to
   `lib/plan/invariants.ts`.
3. Re-run `scripts/generate-coaching-review.ts` after engine changes
   and diff the output to verify the changes addressed the feedback.
