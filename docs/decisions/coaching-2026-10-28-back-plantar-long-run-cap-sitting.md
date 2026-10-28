# Coaching Board: the 120-minute long-run cap for a back or plantar fasciitis history (2026-10-28, LONG-RUN-BELOW-LONGEST-01)

**Founder:** "Yes to all", answering "take the 2-hour back/plantar long-run cap to the Coaching Board?"

## What was found

Tracing graceemilyhill's plan (London 4:45, 30 km/week, longest recent run 21 km, knee/hip/back/shin history), her
inputs varied one at a time: knee alone → peak long run 24 km; hip alone 24 km; **back alone 13.5 km**. The cause is
`applyLongRunCap` in `ruleEngine.ts`:

```ts
// Injury-specific tighter cap: back + plantar fasciitis cap long run at 120 min.
if ((hasInjury(input, 'back') || hasInjury(input, 'plantar_fasciitis')) && ... result * pace > 120)
```

- **Unratified.** Present since the R23 rebuild (`ca225cbd`, 2026-04-25). No principle explains it; `120` is a literal,
  so `configPrincipleSync`, `configConsumer` and the coaching guard have never seen it (the `peakKmByLevel` class).
- **Applied in one of three sizing paths.** `longRunTimeCapMins()` is §9's single owner of the long-run time cap and is
  used by the maintenance and foundation paths; it does not include this cap, so those weeks can exceed it.
- **It matches a HISTORY, with no recency.** `injury_history` has no date, so a back problem years ago caps every
  marathon long run at two hours, forever.

## Evidence (marathon cohort, 2,243–2,253 plans per row, prototyped in throwaway worktrees, the literal only)

| Cap | mean peak long run | mean peak week | below stated longest | `INV-PLAN-LR-MAX-WEEKLY-PCT` (week-instances) | `INV-PLAN-DELIVERED-RAMP` |
|---|---|---|---|---|---|
| **120 (today)** | **15.7 km** | 40.7 km | 29% | **578** | 627 |
| 150 | 19.1 km | 44.4 km | 18% | 2,451 | 899 |
| 180 | 22.4 km | 46.8 km | 16% | 2,927 | 997 |
| 210 (= healthy §9 cap) | 25.1 km | 48.2 km | 14% | 3,483 | 977 |

Same runners healthy: mean peak long run 25.1 km. No row reaches §24's marathon floor (31.65 km) for these paces; the
§9 time cap governs there already. 0 error violations in every row. Plantar `INV-PLAN-INJURY-CAP-DELIVERED` 957 / 1,450 /
1,138 / 665.

**Read:** every step up lengthens the long run and makes it a far larger share of a week that does not grow with it:
share warnings ×4 at 150 minutes. The cap is also doing a second, unadvertised job: it holds the week down.

## Conflict scan

- **§9** (long run capped by an absolute time ceiling per race distance, 210 min marathon; Willy 2026-09-20: beyond about
  3.5 hours a session buys recovery debt). The injury cap is a §9 tightening that §9 does not mention.
- **§9 / §52** (60% share): the binding constraint every raise collides with.
- **§21** (injury modifies selection; substitution, not removal) and **§90 / §90 Am.2** (load-bearing injuries:
  `DELIVERED_CAP_INJURIES` includes `plantar`, excludes `back` and `hip`, "deliberately absent", generationConfig.ts
  line ~2082). The cap treats back and plantar alike; §90 Am.2 does not.
- **§24 and its amendment**: the marathon floor yields to the time cap; conforming.
- **§106** (never peak below where the runner is): the weekly analogue; no long-run counterpart exists.
- **Configuration Singularity (INV-CFG)**: a coaching numeric outside config with no principle is a defect by doctrine.

## The seats

🏃 **Hutchinson (chair).** Before we argue the number we have to own it: nobody here decided this. A rule that halves a
marathoner's long run, matches a history with no date on it, and is applied in one of three places is not doctrine, it
is an accident that survived. That is fixable today without changing a single plan. Whether 120 is right is a separate
question and the table says we do not have the evidence to move it.

📊 **Seiler.** No distribution question.

🎯 **McMillan.** A back-history runner going to a marathon start line with a 15.7 km longest run is its own injury risk:
the last 26 km are new on the day. But the table is honest: raise the cap and the long run swallows a week the rest of
the plan is holding down. If this comes back it comes back with the week growing with it, scaled by when the injury was.

🩹 **Willy.** I would not have written this rule, and I would not remove it on this evidence. Plantar fasciitis is a
load-tolerance problem where prolonged time on feet is the aggravator, so a duration ceiling has a mechanism; lumbar
pain mostly does not, which is why §90 Am.2 left `back` out of the load-bearing list. So the two are not one rule. My
condition for any change: it must not raise the long run's share of the week; the share warnings say every raise does.
And we cannot do this properly without knowing whether the injury is current: that is a data gap, not a coaching one.

⚕️ **Sims.** Plantar fasciitis is more common in women and in the 40–60 bracket that is most of our marathon entrants.
Whatever the number, the runner must be told the plan is holding her long run and why, or she will run her own 21 km
outside the plan, which is the worst of both.

💪 **Blagrove.** No objection from this seat.

## Recorded disagreements

- **McMillan vs Willy on direction.** McMillan would raise it for the marathon, scaled by recency; Willy will not accept
  any raise that increases the long run's share of the week, and recency is not collected. Not settled by argument.
- **Willy: back and plantar are different.** Recorded; it is the evidence any re-ruling must address.

## Ruling

1. **The cap is ratified AS IS, for now, and made doctrine (CORRECT WITH AMENDMENT).** No plan changes:
   - **Numeric:** `GENERATION_CONFIG` gains the cap by injury (back 120, plantar fasciitis 120), with this sitting as its
     principle.
   - **One owner:** `longRunTimeCapMins()` applies it, so the sizing, maintenance and foundation paths agree. ⚠️ This
     changes foundation and maintenance weeks for back/plantar runners; measure it at build and report the count.
   - **Check:** `INV-PLAN-LONG-CAP-MINS` checks the injury cap too, so a long run over it fails.
2. **The runner is told (CORRECT).** When this cap binds, the plan's note names it in place of "it ran out of weeks"
   (graceemilyhill). Words: the founder's.
3. **The value: INSUFFICIENT EVIDENCE.** Every raise measured increases the long run's share of the week (×4 at 150 min).
   **Reopens on:** a prototype in which the week grows with a raised long run, back and plantar treated separately; and
   injury recency (`injury_history` has no date). Recency is a data dependency, not buildable on the current input.

## SLT escalation

**Yes, one question:** collecting injury recency (a date or "current / past") in the wizard is a product and input
decision. Hutchinson carries it.
