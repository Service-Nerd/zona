# Final plan read, 2026-11-20 — the discovery pass that triggered the architecture decision

**Founder, before it ran:** *"If we find any more I will suggest a complete new architecture."*
**Result: it found more.** Every slice found new defect classes.

**Method:**
- 5 agents, one slice each.
- Each slice was stratified across every input variant, using the production input shape and the product entry points.
- About 500 full plans were read as a coach would.
- Every objection was turned into a predicate and counted across the corpora.
- Each objection was classified as KNOWN-ITEM / KNOWN-AUDIT / RULED-ACCEPTED / NEW.

Scratch evidence (dumps, scripts, counts): `/private/tmp/claude-501/-Users-russe-rts-training-hub/a8319fbc-b45c-4f4c-b30b-ad88b3e1bc09/scratchpad/planread/<slice>/`.

## NEW defect classes by slice (none covered by an item, a triage row or a ruling)

| Slice | New | Examples (counts are from the slice's corpora) |
|---|---|---|
| Base-build / foundation / walk-run / maintenance block | 7 | Base-build ramp ignores injury: knee/shin 425 of 541 rise more than 5.5%. Post-deload jump about 1.21× on 968 of 1,579. Foundation and plan week 1 have two owners of starting volume (1,219 of 1,828 drop more than 20%; false "coming back from a break" on 246). Foundation weekday cap skipped when duration-anchored. Maximal TT before quality for tendon/knee runners (588). Maintenance block has no pace or HR. Copy defects |
| Half marathon | 11 | §39 race-week run applied to finish goals and longer than the taper weekday runs. Race-week stacking makes the spacing warn fire on every 4-day plan. Peak-length long run 7 days out. Shallow deloads (about 1,060), with no depth check. Goal-pace dose up to 46% of a week. Wizard level recommendation is VDOT-blind. Duplicate and contradictory notes. Prep-weeks off by one. "Zone 2" labels with no zones |
| Marathon / ultra | 12 + 2 corpus | Run-walk stamped on tempo, intervals and the maximal TT. Easy runs of 150–217 min. "No hard sessions" on plans with TTs. "Avoid starts them later" is false. Frequency note false. Contradicting pace notes. Maintenance runs under 2 km, on blocked days, with the long run on a weekday. Off-by-one refusal (Sunday refused, Monday admitted). Walk-break note above the bar. **Corpus:** envelope races always fall on a Monday; half the beginner-marathon grid uses a field the wizard never sends |
| 5K / 10K | 9 + 3 harness | "Gains come from the quality sessions" on plans with none (2,560). "Holds your fitness" on plans that cut (504). A lever that cannot bind (336). Tune-up callout beside a §78 TT (3,312). Undelivered, undeclared taper (888). Slow-goal beginners get contradictory notes and HR bands. Wizard recommendation read as an upward declaration (166 of 300). 2-day plans broken. **Scope correction:** the cut-below-current population is about 70% larger than the triage's (5,524 more plans) |
| Strength | 7 | Blocked run days ignored (100% of plans with blocked days). Per-side plyo contacts exceed the cap (6,466 sessions). Deload and taper sessions are busier than ordinary weeks. Whole weeks with no calf work. No day off (12.1% of weeks). Bodyweight "heavy 5s". Experience ladder flat |

**Total: about 46 new defect classes plus 5 harness/corpus defects**, on top of the 47 build items and the 2,878 triaged
objections.

## Diagnosis: five structural causes, not 46 bugs

Every new class falls under one of these.

1. **Many producers, each applying the rules itself.** The race engine, base-build ramp, foundation block, walk-run
   start, staged path, maintenance block, time-trial pass and strength placement all build plan content separately.
   A rule enforced in one is missing in another.
   - Examples: injury caps are not applied in the ramp; starting volume is computed twice; blocked days do not reach
     strength; maintenance has no pace or session floor.
2. **Rules are enforced on an internal target; the delivered plan is reshaped afterwards.** The volume curve obeys
   §2/§3/§12. Placement and about 12 post-passes then change the sessions without re-checking.
   - Examples: shallow or inverted deloads, binge weeks, undelivered tapers, flat curves, runs over the cap.
3. **Notes are written by fallback chains that read different facts from the sessions.** About a third of the new
   classes are a note that is false about its own plan.
   - Examples: "no hard sessions" with TTs; "gains from quality" with no quality; "holds" on a plan that cuts; wrong
     cause named; duplicate and contradictory notes.
4. **Checks share the producer's logic or skip, and the test corpora are not production-shaped.**
   - Examples: the plyo check repeats the dose's miscount; the taper-depth check skips when there is no room;
     envelope races fall on Mondays; fields the wizard never sends drive half a grid; there are no 2-, 6- or 7-day
     corpora.
5. **The input layer is inconsistent with the engine.**
   - Examples: the wizard's level recommendation ignores the benchmark; weeks are counted off by one; a field
     documented as surfaced is never sent.

**Conclusion:** patching per producer cannot converge, because each new path checked repeats causes 1–4. This meets
the founder's stated trigger.
