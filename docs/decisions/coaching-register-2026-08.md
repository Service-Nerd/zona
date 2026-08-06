# Coaching Decision Register — August 2026

**For:** SLT and coaching sign-off.
**Written for:** a coach, not an engineer. No code references. Plain training language.
**Trigger:** We regenerated our first real user's half-marathon plan after fixing the previous round of defects. Most of the big problems are fixed. What remains is mostly *coaching* judgement, not code — decisions about how the plans should train people. Nothing below has been built. **This document is the gate: engineering does not proceed until these are signed off.**

**The runner these examples come from ("User A"):** 43, first half marathon, training ~30 km/week, longest recent run 12 km, running less than 6 months, 3 days a week, goal is simply to *finish*. A recent 5K in 29:00. This matters because several decisions below play out differently for a beginner chasing a finish than for an experienced runner chasing a time.

**How to read each item:** what the plan does today · why it's in question · the options · our recommendation · what would change our mind · **which other runners this affects** (because none of these are about User A alone).

---

## The three that matter most

### CD-1 — Every hard session is prescribed at the same pace, whatever it's called

**Today.** The plan contains five differently-named quality sessions — "Continuous tempo", "Cruise intervals", "HM-pace intervals", "Progressive tempo", "Goal-pace sharpener". **Every one of them is prescribed at exactly the same pace and heart rate.** The names change; the effort does not.

**Why it's in question.** Those five names describe genuinely different workouts at genuinely different intensities in the real world. A tempo and a set of VO2 intervals are not the same session. Giving them one pace makes the names decorative — and for an experienced runner, obviously so. It's a credibility problem the moment someone who knows training reads the plan.

**Options.**
- **(a)** Keep one honest "quality" intensity and stop using five names that imply five workouts — rename them to what they are (all threshold).
- **(b)** Prescribe each session type at its proper intensity (tempo ≠ cruise intervals ≠ VO2 ≠ race-pace), derived from the runner's fitness.
- **(c)** A middle tier: two or three distinct intensities (easy-threshold / hard-threshold / race-pace), not five.

**Recommendation: (b), but phased — start by making race-pace and threshold genuinely different, then expand.** The engine already *knows* how to compute these different paces from the runner's data; it simply isn't applying them. The single biggest offender is race-pace (see CD-2). Fixing that alone removes the worst of the dishonesty.
**What would change our mind:** if the coaching view is that a sub-6-month beginner should only ever see one quality intensity (threshold) regardless of the label — then the answer is (a), and we delete the misleading names. That's a legitimate position; it just has to be chosen, not defaulted into.

**Who this affects:** **every plan that contains any quality work** — all fitness levels, all distances, all goals. Systemic. This is the highest-blast-radius decision in the register.

---

### CD-2 — A session named after race pace is not run at race pace

**Today.** The session labelled "HM-pace intervals" — the one that should rehearse goal race pace — is prescribed **20–30 seconds per km *faster* than this runner's actual projected half-marathon pace**, and it lands in the peak block where getting it wrong costs the most. The taper's "Goal-pace sharpener" has the same problem, at the worst possible moment.

**Why it's in question.** This is the opposite of what the session is *for*. Rehearsing race pace means running *at* race pace. Running it 20–30 sec/km too fast in peak/taper teaches the wrong effort and adds fatigue right before the race. This is a live coaching error, not a cosmetic one.

**Options.**
- **(a)** Prescribe race-pace-named sessions at the runner's derived race pace (we can compute it — from the 5K result — for finish-goal runners too, not just those chasing a time).
- **(b)** If we can't stand behind a race pace for finish-goal runners, stop *calling* sessions "race pace" for them and prescribe honest threshold work instead.

**Recommendation: (a).** The runner's race pace is derivable from their benchmark even when their goal is only to finish. Right now the plan withholds it purely because they didn't type a target time — that's an artificial reason. Name it race pace only if it's run at race pace.
**What would change our mind:** if the coaching view is that finish-only beginners shouldn't do race-pace work at all — then (b), and the sessions become honestly-named threshold.

**Who this affects:** **every plan with a goal of "finish"** (the majority of beginners), across 5K/10K/HM/marathon. Also any time-goal plan where the runner's pace and the prescription have drifted apart. Systemic.

---

### CD-13 — The plan promises a time trial "resets your paces," then never changes a pace

**Today.** Weeks 4 and 8 contain a 5K time trial and tell the runner "the result resets your zones and paces for the next block." **No pace in the plan ever changes.** Every pace from week 1 to week 13 is identical. The reset only happens if the runner, unprompted, later goes into their profile and manually re-types the result.

**Why it's in question.** The plan makes a promise it doesn't keep. Either the time trial should actually update the plan, or the plan should stop saying it will. This is a coaching *and* a build decision — it changes whether the plan is a living thing that responds to the runner, or a fixed document.

**Options.**
- **(a)** The time trial result automatically updates the paces for the rest of the plan (the "living plan").
- **(b)** The plan surfaces a clear prompt after the time trial — "enter your result to update your paces" — and updates on confirmation (semi-automatic).
- **(c)** Drop the promise: the time trial informs the *next* plan, not this one, and the copy says so.

**Recommendation: (b).** Fully automatic (a) risks silently rewriting a runner's plan off one bad or mismeasured effort; (c) wastes the most motivating data point in the block. A prompted, confirmed update respects the runner and keeps the promise. This also depends on CD-8 (a time trial we can actually measure).
**What would change our mind:** if we're not confident a single 5K is a reliable enough signal to rewrite paces (it can be noisy), lean to (c) and change the copy — under-promise rather than mis-fire.

**Who this affects:** **every plan that contains a benchmark/time-trial checkpoint** — all distances, mid-length-and-up plans. Also an architectural fork (living vs fixed plan) that other features depend on. Systemic.

---

## Pace and effort

### CD-8 — How a time trial is prescribed and measured

**Today.** The 5K time trial is written as a **63-minute duration session** with no distance and no target pace, and a heart-rate ceiling set to a maximum the runner has never actually hit. It's really an easy run that got relabelled.

**Why it's in question.** A 5K time trial is, by definition, *run 5 km as fast as you can hold* — the distance is fixed and the time is the result you measure. Prescribing it as "63 minutes" and capping heart rate at an unobserved maximum is incoherent: the app has no distance to measure the 5K against, and the HR cap tells the runner to ease off at a number that may not be their real limit.

**Options.**
- **(a)** Distance-fixed 5K, effort led by feel (RPE), heart rate *recorded* not *targeted*, result captured as a time.
- **(b)** Keep it duration-based (e.g. "hard 20 minutes") if we prefer a duration benchmark for beginners.

**Recommendation: (a).** A time trial's whole job is to produce a *time over a known distance* we can turn into fitness. Fix the distance, lead with effort, observe HR, capture the time.
**What would change our mind:** if the coaching view is that beginners shouldn't run all-out 5Ks at all — then this becomes a controlled "hard 20 min" and we reframe accordingly.

**Who this affects:** every plan with a time trial. Ties to CD-13.

### CD-11 — How wide the easy pace band should be

**Today.** The easy band spans 81 seconds per km (e.g. 7:11–8:32). That's arguably too wide to be a target — a runner could run the whole range and think they'd complied.

**Why it's in question.** A band that wide stops being guidance. But narrowing it has a trade-off: easy running genuinely *should* be a range, and for a beginner "anywhere in here is fine, just keep it easy" is kinder than a tight window they'll stress about.

**Options.** (a) Narrow the band. (b) Keep it wide but frame it as "no faster than X" (a ceiling, not a window). (c) Leave as-is.

**Recommendation: (b) — reframe as a ceiling.** For easy runs the only number that matters is the *upper* limit; below it is all fine. "Keep it easier than X" is more honest than a 90-second window pretending to be a target.
**What would change our mind:** if we'd rather show a true target range, narrow it — but then we owe the runner a reason it's a range.

**Who this affects:** every plan (every plan has easy running). Systemic but low-risk — it's a presentation/framing choice more than a training change.

---

## Progression and structure

### CD-3 — How quality work should progress across a block

**Today.** The quality sessions in weeks 6, 7, 9, 10 and 11 are *identical* — same duration, same pace, same effort. Five weeks apart, the runner does the same workout with a different name. It does not get harder, longer, or denser.

**Why it's in question.** A build block should build. Standing still for five weeks of quality is not a build — it's maintenance wearing a build's label.

**Options.** Progress quality by (a) duration, (b) rep length or density, (c) intensity, or (d) some combination across the block.
**Recommendation:** progress by **duration/density first** (safest for a beginner), holding intensity — e.g. the tempo grows from 20 to 30 minutes across the block. Intensity progression is a later, more advanced lever.
**What would change our mind:** if the coaching view is that a sub-6-month beginner's quality should stay constant and only *volume/long run* should progress — a defensible conservative stance — then this is "working as intended" and we close it.

**Who this affects:** every plan with quality work across a multi-week block. Systemic; ties to CD-1.

### CD-4 — Should peak long runs carry a goal-pace finish

**Today.** No long run in the plan contains any race-pace running. Peak long runs are entirely easy.

**Why it's in question.** For many runners the single most valuable session is a long run that finishes at goal pace — it rehearses racing on tired legs. Its absence may be a real gap, or a deliberate beginner-protection choice.

**Options.** (a) Add a goal-pace finish to 1–2 peak long runs (and decide whether it replaces that week's separate quality session). (b) Keep peak long runs entirely easy for finish-goal beginners.
**Recommendation:** for finish-goal beginners, **(b) — keep them easy** (time on feet is the goal; race-pace-on-tired-legs is an intermediate+ tool). Revisit (a) for time-goal and intermediate+ runners.
**What would change our mind:** evidence that finish-goal beginners benefit from a short goal-pace finish more than they're threatened by the added intensity.

**Who this affects:** primarily HM/marathon plans; interacts with CD-1/CD-3. Moderate.

### CD-9 — Should long runs vary across a block

**Today.** Six consecutive peak long runs are the same length (~2h14). No step-back weeks in the long run itself.

**Why it's in question.** Most periodisation steps the long run back periodically to allow absorption, rather than holding the peak for six straight weeks. Holding constant may over-fatigue, or may be fine at this modest duration.
**Recommendation:** introduce a periodic **step-back long run** (e.g. every third long run drops ~20%). Low risk, standard practice.
**What would change our mind:** if ~2h14 is judged low enough that six in a row carries no meaningful fatigue cost for this runner.

**Who this affects:** all plans with a long-run progression. Moderate.

---

## Volume and load

### CD-10 — Is it acceptable for weekly volume to peak in the *base* phase?

**Today.** This runner's weekly volume is highest in the base phase (weeks 3 & 5) and slightly *lower* through build and peak. The "peak" phase is not the highest-volume phase.

**Why it's genuinely a coaching question, not a bug.** We traced the cause and it's real: when we add a 45-minute quality session to a build week, it *replaces* a longer easy run, and — because a hard 45 minutes counts as fewer "kilometres" than the easy hour it displaced — the total weekly number goes *down* slightly. So the moment intensity enters, measured volume dips. The plan already labels itself a "maintenance" shape and knowingly tolerates this. **The question: is "volume peaks in base once intensity is added, and the peak phase is defined by the long run and specificity rather than by more kilometres" acceptable coaching for a beginner — or must the peak phase always carry the most weekly volume?**

**Options.**
- **(a)** Accept it: for beginners, the peak phase progresses via the long run and race-specificity, not weekly tonnage. Make the plan's *labels* say this honestly (don't call it "highest volume").
- **(b)** Require the peak phase to carry the most weekly volume, and change the volume engine to guarantee it (this is a larger change with wide effects — an earlier attempt distorted the plan).
- **(c)** Fix the *measurement* so a hard session isn't undercounted against easy kilometres, which would remove the artefact without forcing volume up.

**Recommendation: (a) + (c).** Accept the beginner model on purpose (it's defensible — the long run is the peak-phase driver for a first-timer), *and* fix the counting so the numbers stop lying about it. Avoid (b) as a blanket rule — forcing every plan's volume to climb into peak raises injury risk for exactly the beginners this product protects.
**What would change our mind:** a coaching consensus that "peak phase = most volume" is non-negotiable across all levels. Then (b), accepting the engineering cost and injury-risk review.

**Who this affects:** **volume logic across every distance and level.** The most systemic decision after CD-1. (This is the item previously tracked as GEN-FIX-13; this register supersedes that framing.)

### CD-6 — Should there be an absolute cap on a beginner's week-1 volume — and is the volume signal even real?

**Today.** Week 1 is 33 km / ~4.3 hours for someone running less than 6 months. There is no absolute cap for a beginner — week 1 simply mirrors the volume the runner *said* they're already doing. **And that number is self-declared** — a wizard choice from a range ("20–40 km"), taken at its midpoint. It is not verified against any synced watch or Strava data.

**Why it's in question — and why it's more serious than it looks.** The runner's entire plan shape — including whether they get *any* hard sessions at all — hinges on this one self-declared number classifying them as "intermediate on volume." If they over-stated it (easy to do from a range), a genuine beginner is handed an intermediate's load and intensity. The safety of the whole plan rests on an unverified tap.

**Options.**
- **(a)** Add an absolute week-1 ceiling for sub-6-month runners regardless of what they declare (belt-and-braces safety).
- **(b)** Where synced data exists (Apple Health), verify the declared volume against it and defer to the lower/observed figure.
- **(c)** Both — cap *and* verify.
**Recommendation: (c).** For a first-timer, a self-declared volume should be treated as a claim, not a fact: cap the early weeks conservatively, and where we have real data, trust the data over the chip.
**What would change our mind:** evidence that our wizard's volume buckets are reliable enough to drive intensity decisions unverified. We don't have that evidence today.

**Who this affects:** **every beginner / low-training-age plan, every distance.** High-importance safety item.

---

## Race week and recovery

### CD-7 — What race week should contain, for a race on any day

**Today.** For this runner (race on a Wednesday, trains 3 days), race week contains **nothing but the race** — the last run is a long run the Saturday before, then four complete rest days before a half marathon. This is technically *correct* under our current rule (we deliberately never place sessions after the race, and for an early-week race there's no room before it). But our own principle says "the week *before* should carry that load instead" — **and that part was never built.** So the runner gets no shakeout and no leg-priming strides in the final days, which our own taper principle warns against.

**Why it's in question.** A runner should arrive at the start line with fresh but *primed* legs — a short shakeout with a few strides in the last 48 hours. Four days of complete rest before a race leaves them flat. The rule that's supposed to prevent this (move the priming into the preceding week) exists on paper only.

**Options.**
- **(a)** When race week can't hold a shakeout (early-week race), place the shakeout + strides in the last few days of the *preceding* week instead — honouring the principle we already wrote.
- **(b)** Accept complete rest before early-week races.
**Recommendation: (a).** It's what our own coaching principle already says; it's just not implemented. Every runner with a Monday–Wednesday race currently gets under-prepared legs.
**What would change our mind:** a coaching view that complete rest is fine (some runners prefer it) — but that should be a choice, not an accident of the calendar.

**Who this affects:** **every plan whose race falls early in the week** — a large minority. Also drives an engineering decision to build the "final stretch" (taper + race week) as one unit rather than week-by-week.

### CD-12 — Default long-run day and spacing between the two hardest sessions

**Today.** Long run on Saturday, then a 106-minute run on Monday — about 36 hours between the two largest aerobic sessions, then a five-day gap.
**Why it's in question.** Back-to-back large sessions with minimal recovery, followed by a long empty stretch, is lumpy. Better spacing distributes load.
**Recommendation:** enforce a **minimum recovery gap** between the two largest sessions of the week, and distribute the week more evenly where the available days allow.
**What would change our mind:** if the runner's fixed available days (here Mon/Wed/Sat) leave no better arrangement — in which case this is a constraint we surface, not a defect.

**Who this affects:** plans on constrained day patterns (3-day especially). Moderate.

### CD-5 — Taper length as a function of volume

**Today.** A three-week taper is applied. For a runner at ~36 km/week, three weeks may be more taper than the fitness warrants.
**Why it's in question.** Taper length should scale with the volume/fatigue you're shedding. A low-volume runner may need less; a longer taper risks detraining.
**Recommendation:** make taper length **scale with peak volume**, not a fixed value per distance. Confirm the thresholds with the coaching view.
**What would change our mind:** evidence that a fixed taper-by-distance is close enough across the volume range we serve.

**Who this affects:** all plans; interacts with volume logic. Moderate–systemic.

---

## Summary — narrow vs systemic

| Decision | Reach |
|---|---|
| CD-1 (pace per session type) | **Systemic** — every plan with quality work |
| CD-2 (race pace = race pace) | **Systemic** — every finish-goal plan |
| CD-13 (time trial updates plan) | **Systemic** — every plan with a checkpoint; architectural fork |
| CD-10 (volume peaks in base) | **Systemic** — all volume logic |
| CD-6 (beginner cap + verify volume) | **High** — every beginner plan; safety |
| CD-5 (taper length) | Moderate–systemic |
| CD-3 (quality progression) | Systemic (with CD-1) |
| CD-8 (time-trial shape) | Narrow (ties CD-13) |
| CD-4, CD-9 (long-run pace/variation) | Moderate |
| CD-7 (race week) | High for early-week races |
| CD-11 (easy band), CD-12 (spacing) | Narrow / presentation |

**Recommended sign-off order:** settle **CD-1, CD-2, CD-10, CD-6** first — they're the widest-reaching and everything else composes around them. CD-13/CD-8 are a paired decision (living plan + measurable time trial). The rest can follow.

---

*No code has been written. Engineering is paused pending sign-off on this register.*
