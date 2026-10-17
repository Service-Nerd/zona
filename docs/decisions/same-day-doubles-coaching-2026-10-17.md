# Same-day doubles — Coaching Board (2026-10-17) · CORRECT WITH AMENDMENT · RULED, not built

**Item:** `SESSION-SLOTS-01` (ADR-025 §5). **Trigger:** soft, and it qualifies: it changes what a runner may be told to
do on a day. **Proposed:** a runner may make a same-day double only by moving a run onto a day that already has one;
the engine never prescribes doubles.

**Evidence (production, read-only):** 36 plans; 3 runners with live moves (7 rows), 2 of them swaps. **No demand data
for doubles**, so this rules on correctness, not on observed use.

## 🔍 Conflict scan
- **§7** (48 h between two stressors): a double containing a quality session or the long run puts two stressors in one
  day. Cannot hold. Easy + easy is not a stressor pair, so §7 is untouched.
- **§64** (a rest day every week; six training days max): a double comes from a MOVE, so the week's session count is
  unchanged and its training-day count can only FALL. §64 holds by construction. No conflict.
- **§18 / §81** (the weekday cap is the runner's own statement; structured sessions exempt): a double of two easy runs
  can exceed the cap. §81's own stance is "the plan says when they don't fit", not refusal.
- **§6** (race week is for shakeouts) and **§21** (injury-aware selection): race week stays as prescribed.
- **S3 / S4** (one strength session a day; strength after the run, ≥3 h, ideally 6 h): a double-run day plus strength is
  three sessions.
- No zone-model translation issue.

## The board
- **Hutchinson (chair):** the evidence on doubles for recreational runners is thin. Elites double to add easy volume;
  ours would double to fit a week around life. That is defensible only while both runs stay easy. *"A double is a
  scheduling tool, not a training stimulus, and the app should never present it as one."*
- **Seiler:** low-intensity doubles are how high-volume athletes add aerobic work without drifting into Z3; two easy
  runs do not change the session-count distribution (§1 counts sessions, and none were added). No objection to
  easy + easy. Anything harder in a double is exactly the grey-day risk.
- **McMillan:** the real case is *"I can't run Thursday, I'll do two short ones Wednesday"*, or a run commute there and
  back. Keep it to easy runs and make it easy to undo. Don't nag: a weekday-cap warning, not a refusal, because it is
  their stated life and their explicit choice.
- **Willy:** the risk is not the second easy run, it is a hard one stacked on a tired one. **Never** the long run, a
  quality or structured session, a race or the 5K time trial in a double. And no double in race week.
- **Sims:** two sessions in a day raise low-energy-availability risk, more so for women and masters. The advice copy
  must say to eat between them. Advice, not a rule: the app cannot see food.
- **Blagrove:** no strength session on a day that holds two runs. S3 is one strength session a day; three sessions in a
  day is not what S4's stacking rule was written for.

## ⚖️ Ruling: CORRECT WITH AMENDMENT
1. **Allowed:** a double made by the runner moving a run, where **both** runs are easy or recovery runs.
2. **Never:** the long run, a quality or structured session, a race, or the 5K time trial in a double; and no double in
   race week. The move flow does not offer "Do both" for these (it offers the swap, as today).
3. **Gap:** advise at least `DOUBLE_RUN_MIN_GAP_HOURS = 6` between the two runs (S4's ideal), **as advice only**: the
   app has no time of day (ADR-011) and cannot enforce it.
4. **Weekday cap:** two runs whose sum exceeds `max_weekday_mins` are **allowed, with a note** (§81's "the plan says
   when they don't fit"), never refused.
5. **Strength:** no strength session is placed on a day with two runs (strength re-places, S3).
6. **Copy (Sims):** the advice names eating between the runs. No outcome claim (Hutchinson): a double is presented as
   fitting the week, never as extra training.

**Recorded, not a disagreement:** Willy would refuse a weekday-cap breach; McMillan carried "warn", on §81's own
precedent. Willy accepted it on condition that rule 2 is a hard refusal.

## 📦 Artifacts (land with the build, Phase 1–2, in one commit)
1. **Principle:** new §126, *"A double is two easy runs the runner chose"*.
2. **Numeric:** `GENERATION_CONFIG.DOUBLE_RUN_MIN_GAP_HOURS = 6` (advice).
3. **Invariant:** `INV-EFFECTIVE-NO-HARD-DOUBLE` on the EFFECTIVE week (overrides applied), plus strength
   `S-NO-STRENGTH-ON-DOUBLE`. **Not landed today, deliberately:** a constant with no consumer fails
   `configConsumer.test.ts`, and the effective-week check needs Phase 1's owner. This ruling is the input.

**SLT escalation:** none on correctness. FREE or PAID is the SLT's.
