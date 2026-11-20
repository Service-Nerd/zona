# SLT: which tier asks about hard sessions and terrain? (2026-11-20, WIZARD-PAID-INPUTS-TIER-01)

**Unparked by the founder 2026-11-20** (parked 2026-10-28, "park point 2 in the backlog for now"), to be ruled today.
**Board order (from the item):** 💼 SLT on the tier first, then 🏃 Coaching Board on what each answer prescribes.
This note is the SLT sitting only. The Coaching Board hand-off is at the end.

**One-line brief:** the wizard asks `hard_session_relationship` (avoid / neutral / love / overdo) and `terrain`
(road / trail / mixed) only when `hasPaidAccess`, and sends `undefined` otherwise; is either answer safety (never paid)
or richness (may be paid)?

**Tier ruled: FREE, both questions, every answer.** Reasons below.

---

## 1. Analysis, before any seat spoke

### 1a. The item's table, re-derived

Command (read-only, plans generated in memory):

```
npx tsx scripts/board-evidence-wizard-paid-inputs-tier-01.ts          # cohort, ~65s
npx tsx scripts/board-evidence-wizard-paid-inputs-tier-01.ts --live   # production SELECT only
```

Population: 2,000 inputs from `cohortGrid()` (the wizard's production shape, 41,472 rows), walked by stride 23, which is
coprime to the grid's 2⁹ × 3⁴ size so the sample spreads across every axis. 76 are designed refusals at baseline, so
**1,924 built**. "No answer" deletes the field, which is what a free runner's payload does. Each answer is compared with
no answer. The 10-28 measurement was not committed as a script, so this is a new one with the same population size.

The item had one "sessions change" column. **I split it, because "safety or richness" depends on what changes:**
*prescription* (session type, catalogue row, label, distance, duration, zone, pace target, weekly km) versus *session
copy* (a session's `coach_notes` only). *Plan notes* = any `meta` field other than the echoed input.

| answer | item (10-28): sessions / notes | prescription changes | session copy only | plan notes change |
|---|---|---|---|---|
| hard sessions: `overdo` | **100%** / 7% | **76 (4.0%)** | 1,848 (96.0%) | 76 (4.0%) |
| hard sessions: `avoid` | 47% / 100% | 868 (45.1%) | 0 | 1,924 (100%) |
| hard sessions: `love` | 13% / 60% | 243 (12.6%) | 0 | 1,138 (59.1%) |
| hard sessions: `neutral` | n/a | 0 | 0 | 0 |
| terrain: `trail` / `mixed` | **0%** / 100% | 0 | 0 | 1,924 (100%) each |
| terrain: `road` | n/a | 0 | 0 | 0 |

**What moved.**
- `overdo`'s 100% holds, but **96 points of it are copy.** The engine puts §24c's Zone 2 ceiling cue on every long run
  (`ruleEngine.ts` ~3649, §96). The prescription changes on 4.0% of plans: §96's veto on §89 early quality onset, which
  only fires for runners who would otherwise have qualified for it. The item's "notes 7%" is 4.0% today.
- `avoid`: 47% → 45.1%; it is the one answer that changes the dose for a large share (§110 Am. 1's reduced quality dose
  and the one-quality cap). `love`: 13% → 12.6% (§35 stretch rung); its notes 60% → 59.1%.
- Terrain: unchanged. It adds `meta.terrain_effort_note` (§40b Am. 3) and nothing else. That note is rendered
  (`lib/plan/planRationale.ts:206`, "Off-road").

### 1b. The engine does not read the tier for either field

Same script, last line: with `overdo` + `trail` on the first 300 sampled inputs, the effect of the answers at tier
`free` and at tier `paid` differs on **0 of 300**. Both tables above are identical at both tiers. The gate exists only in
`GeneratePlanScreen.tsx` (`getStepSequence` line 307, payload lines 1159 and 1161).

### 1c. Found during analysis: the gate is already broken the other way

- **Modify plan already lets a free runner set both.** `MODIFIABLE_ROWS` (`lib/plan/modifyPlan.ts`) lists
  `hard_session_relationship` and `terrain` with no `gate`, and its type says *"`undefined` means free"*.
  `ModifyPlanSheet` accepts `hasPaidAccess` and never reads it. The edit is posted to `/api/generate-plan`, which does not
  strip either field (`app/api/generate-plan/route.ts`, no reference to either). P-02 shipped FREE
  (feature-registry row "P-02").
- **So the policy is split three ways today:** the wizard treats the questions as PAID, Modify plan as FREE, and the
  route as nothing. The item's point (a), "the tier policy is enforced only by the client", is true and understated: a
  free runner reaches both fields through our own UI, not only through a crafted request.
- **A lapsed trial rebuilding through the wizard loses the answer.** The reverse trial gives every new runner paid access,
  so their first plan asks both questions. If they rebuild through the wizard after the trial lapses, the payload sends
  `undefined`, and an `overdo` or `avoid` runner's brake silently disappears from the new plan.
- **The registry already disagrees with itself.** §96 (`overdo` is a brake) and §110 (`avoid` is a floor) are registered
  **FREE**; CB-TERRAIN-01 is registered **PAID**; the R23 row "Wizard Step 4 (terrain / injuries / HR / style)" says
  **PAID** and has been stale on injuries since WIZARD-INJURY-FREE-01. `featureGates.ts` has **no** gate for either field,
  so `lib/marketing/pricing.test.ts` has nothing to require on `/pricing`.

### 1d. Live production (`--live`, SELECT only)

43 plans; **36 carry `generator_input` (36 users).** `hard_session_relationship`: neutral 18 · love 14 · overdo 1 ·
avoid 1 · absent 2. `terrain`: road 25 · mixed 9 · absent 2. Almost every live plan was built with paid or trial access,
so the questions were asked; **2 of 36 were built without them.** Which tier each was built at is not measured (the plan
does not stamp it).

### 1e. Settled ground

- **SLT 2026-09-11**: injury adaptation is never paid (CLAUDE.md "gate richness, never access").
- **SLT 2026-10-28** (`slt-2026-10-28-injury-recency.md`): the precedent. It found the same gate on injuries, called
  fixing it "a promise we already made and did not keep", and set the test for these two: *"measure what each changes in
  the plan, then decide whether they are richness (paid) or safety (free)."*
- **SLT 2026-09-20 P-02** (`2026-09-20-p02-modify-sheet-scope.md`): per-row Pro lock in Modify plan, "gate richness,
  never access". No row was given a lock for these two fields.
- **Coaching Board** §96 (CB-HSR-01), §110 + Am. 1 (CB-HSR-AVOID-01), §40b Am. 3 (CB-TERRAIN-01), §35. All ratified, all
  tier-blind in the engine.

### 1f. What this evidence can and cannot show

It shows what each answer changes in a rule-engine plan for runners with **no injury history** (the grid fixes
`injury_history: []`), which tier the engine reads (none), and where the gate lives. It cannot show adherence: whether an
`overdo` runner actually backs off when the cue appears is unmeasured, and the Coaching Board has said that data does
not exist (§110's McMillan dissent). The injury × answer interaction is not in this sample.

---

## 2. The board

🧠 **Sutherland.** Look at who we are hiding the question from. The brand line is "You're trying hard. That's the
problem." The runner who taps "I overdo it" is the brand's first customer, confessing, in our own words, and the free
tier never gets to confess. Asking costs nothing; it is also the most persuasive moment in the wizard, because the runner
just described themselves the way our marketing describes them. Paywalling the confession is paywalling the moment the
product proves it understands you. Ask everyone. If you want something to sell, sell what we do with the answer over
time, not the question.

📦 **Fried.** Two numbers end this for me. The engine does not know what tier you are on for either field: zero of three
hundred. And Modify plan already gives both to free runners. So the "paid" wizard step sells something free runners can
have one screen later, and the upgrade card says "hard session preferences" as if they were locked. That is not a paid
feature, it is a hurdle with a price tag. Make it free. Terrain I would happily delete: one note, no session changes,
asked of every runner as a whole wizard step. But deleting a step is the Design Board's call, not a tier call, and
tier-wise it is free whatever happens to it.

🏃 **Hutchinson.** Split the answers by what they do. `overdo` and `avoid` are risk declarations: §96 and §110 exist
because the Coaching Board ruled that a runner telling us they cannot self-regulate, or that the last hard session hurt,
is a caution signal. Caution signals are the September ruling's territory: never paid. `love` adds work on 12.6% of
plans; that one, alone, could be argued as richness. I will not argue it, because you cannot ask a question of free
runners and then ignore one of its four answers: the runner who says "love" gets a plan that pretends they said
"neutral", which is a lie told in our engine. One question, one tier. What I want the Coaching Board to look at is the
uncomfortable number: for 96% of `overdo` runners the whole effect is one sentence on the long run. Whether that is
enough for the brand's core runner is a coaching question, and it now applies to every tier.

🔬 **Wood.** The lapsed-trial rebuild is the case I care about. A runner told us during the trial that they overdo it,
got a cue on every long run, and rebuilds the plan in month two as a free runner. The cue vanishes, and nothing tells
them why. The environment that was restraining them was removed without notice. That is the opposite of habit support:
it is removing the context cue at the moment the habit is still forming. Free, and kept across rebuilds. On terrain I
agree with Fried's instinct: a note that changes no session is close to the illusion-of-progress class, but it is a true
note about pace targets off-road and it is cheap. It does not warrant a kill on tier grounds.

🧭 **Zhuo.** Three things are bundled here and only one is ours. The tier: free, I agree. The step order and the upsell
card are a screen: the free flow gains two steps before injuries, the "Unlock more personalisation" card currently sells
"terrain, hard session preferences, and training style" and will be selling nothing, and whether terrain earns a full
step is a structure question. All of that goes to the Design Board, and the words to the founder. I will not let this
table design the wizard. The route enforcement question answers itself once the tier is free: there is nothing to
enforce at the route.

---

## 3. Conflicts

- **Hutchinson on `love`.** He named it as the one answer that could be richness, and declined to split the question.
  Nobody argued to split it. Recorded because a future sitting looking to sell "stretch" work should know it was raised
  and rejected on the grounds that a question's answers cannot carry different tiers.
- **Fried and Wood vs Sutherland on terrain's step.** Fried would delete it, Wood would not kill it, Sutherland did not
  speak to it. **Not settled here:** it is a Design Board structure question. On tier, all five agree: free.

---

## 4. Ruling

**FREE.** Both questions are asked of every runner, and both answers are sent for every tier.

1. **`hard_session_relationship` is safety**, in its two caution answers (`overdo`: §96 brake; `avoid`: §110 floor), and
   the September ruling applies to it as it did to injuries. The question carries one tier for all four answers.
2. **`terrain` is free** because it is a true note about the runner's own pace targets and the engine already applies it
   at every tier; there is no richness behind the lock to sell.
3. **Point (a), route enforcement (ADR-003): resolved by the tier, not by a gate.** A free answer needs no route
   enforcement. The build must not add a route strip.
4. **Point (b), the upsell card and step order: handed to the Design Board** (see §6). The SLT's constraint on it: the card
   may not sell either question, nor any other free input.
5. **Free users are never abandoned:** a lapsed runner's rebuild must not lose an earlier answer.

### What the build carries (not built here)

- `getStepSequence` pushes `hard-sessions` and `terrain` for every tier; the payload sends both regardless of
  `hasPaidAccess`.
- `lib/ui/wizardInjuryFree.test.ts`'s second case (*"hard sessions and terrain stay paid until their tier is decided"*)
  is inverted, and falsified both ways, as WIZARD-INJURY-FREE-01's was.
- Registry: the R23 row "Wizard Step 4 (terrain / injuries / HR / style) | PAID" and CB-TERRAIN-01's PAID tag are
  corrected to FREE.
- Expect `cohort:shape` and parity to be unaffected: the grids already send `neutral` and the engine is tier-blind. The
  change is in who is asked, not what the engine does.

---

## 5. MUST/NEVER check

- "Gate richness, never access" (CLAUDE.md): the current gate violates it for `overdo` and `avoid`; the ruling restores it.
- All new features tagged FREE or PAID: done, FREE.
- No modal, no new screen: the two steps already exist. No colour or copy is set here. The upsell card's words go to the
  founder.
- ADR-003 (auth at the route boundary): satisfied by having nothing tier-dependent to enforce.
- Pricing: `featureGates.ts` has no gate for either field, so `/pricing` needs no row; nothing to remove.

## 6. Hand-offs

- 🏃 **Coaching Board (next, per the item's order): what each answer prescribes.** The SLT does not rule on it. The
  questions it leaves: (1) for 96.0% of `overdo` plans the only effect is one cue per long run; is that the correct dose
  for the runner who says "rein me in", now that every free runner will be asked? (2) the injury × answer interaction is
  unmeasured (the grid carries no injury). Both are on existing doctrine (§96, §110, §35, §40b Am. 3); no new principle is
  assumed.
- 🧭 **Design Board:** the free sequence gains `hard-sessions` and `terrain` before `injuries`; the `TeaserCard` on the
  `weekday-ceiling` step loses its reason to exist in its current words; whether `terrain` earns a full step (Fried) is a
  structure question.
- 👤 **Founder:** the words of whatever replaces the teaser card.

## 7. Risks to existing features

- WIZARD-INJURY-FREE-01's test file holds the current behaviour and must be inverted in the same commit.
- Lapsed-trial rebuilds start sending the answer, so a free rebuild of an `overdo`/`avoid`/`love` runner now keeps the
  effect it had during the trial. That is the intent; it is also a visible change for those runners.
- No schema, no upsert, no shared component change.

## 8. What this does not prove

- Not whether any answer changes behaviour on the road; adherence by answer is unmeasured.
- Not the injury × answer interaction (sample has no injury history).
- Not which tier each of the 36 live plans was generated at; plans do not stamp it.
- Not the wizard's completion rate with two more steps for free runners. That is the Design Board's to weigh and is not
  measured anywhere.
- No commercial reading: the commercial seat (Traynor) is stood down and there is no trial-to-paid data. No seat priced
  what the upgrade card loses by no longer listing these two questions.
