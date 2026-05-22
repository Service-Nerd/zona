# Reframe Golden Cases

The regression suite for POST-RUN-REFRAME-01. Every change to `buildSessionReframePrompt` must reproduce these outputs (or close paraphrases). Each case is a triple: (inputs, user words, ideal reframe). One case per data tier.

The voice rules these cases must honour live in [brand.md § Reframe Voice](./brand.md#reframe-voice-post-run-reframe-01).

---

## Case A — Tier A · Strava connected · spiral after going too hard

**Scenario:** Second run of the week. Tuesday's "easy" went hot (80% above zone ceiling). Friday the body cashed the cheque — a 10:00/km recovery shuffle. The runner spirals: feels worse than they ever have, questions whether they can hit their goal race.

**Source:** Real data from the runner this feature was built for. Captured 2026-05-22.

**Inputs:**

| Field | Value |
|---|---|
| Today's session | Easy run, Fri 2026-05-22 — 8.02 km, 80 min, avg HR 117, avg pace ~10:00/km, 47% below zone ceiling, 1% above |
| Previous session | Easy run, Tue 2026-05-19 — 8.82 km, 57 min, avg HR 159, avg pace ~6:26/km, **80% above zone ceiling** |
| Plan context | Race to the Stones (100km ultra) — race date 2026-07-11 → **~7 weeks out** |
| Cohort context | Available (R25 cut #1 shipped) |
| Trend context | Not yet available (AI-DEPTH-03 not shipped) |
| Risk flags | None firing |

**User said:**
> *"the 2nd run of the week and it feels awful. I feel worse than i ever have, questioning if im good enough and i feel a failure. I feel i cant make the goal ive set myself for race to stones."*

**Ideal reframe:**
> *"You're not failing, even though it feels like it. Tuesday was 80% above your zone ceiling — Friday is your body settling that bill, not a verdict on Race to the Stones. The work underneath is happening: you've stayed consistent through a tough block, and that's the fitness you'll lean on. Seven weeks to race day."*

**Why this is right:**
- Sentence 1: warmth-as-permission. *"Not failing"* directly answers the spiral; *"even though it feels like it"* validates the feeling without endorsing the conclusion.
- Sentence 2: names the specific cause from real data. 80% above zone is not abstract — it's the diagnosis.
- Sentence 3: progress claim. Without the trend backend, this is a qualitative consistency claim (Tier A graceful degradation when numerical trend is unavailable).
- Sentence 4: race name + time-to-race. Factual anchor, not motivational.
- Closes warm, not punitive. No *"Hold the zone next session."*

**Why related variants would fail:**
- *"Rough one. Tuesday ran hot. Friday's the bill. Hold the zone."* — truth without warmth, reads punitive.
- *"You're doing amazing — don't give up, Race to the Stones is yours!"* — cheerleading, no data, off-brand.
- *"Tuesday's average HR was 159 with 80% above ceiling, suggesting an over-intensity pattern."* — AI dump, no warmth, no anchor.

---

## Case B — Tier B · No Strava, plan + RPE only · easy run felt hard after big week

**Scenario:** 6 weeks into a 12-week half-marathon plan. No Strava, no HealthKit. The runner has logged sessions manually with RPE. Yesterday was intervals (RPE 8), today was meant to be an easy 8k. It felt hard. They log RPE 7 and the note: *"Why was that so hard? Doubting if I'm running the right plan."*

**Status:** Drafted 2026-05-22 — pending review.

**Inputs:**

| Field | Value |
|---|---|
| Today's session | Easy run — 8 km, RPE 7, user note: *"why was that so hard"* |
| Recent sessions | Yesterday intervals RPE 8; week's easy days RPE 5-6 trending down vs week 1 (was 7-8) |
| Plan completion | 22 of 24 scheduled sessions in last 4 weeks |
| Plan context | Half-marathon, race date in 7 weeks |
| Cohort/trend | Not available (no Strava) |
| Risk flags | None firing |

**User said:**
> *"Why was that so hard? Doubting if I'm running the right plan."*

**Ideal reframe:**
> *"Hard week catching up — that's signal, not a verdict on the plan. Yesterday's intervals at RPE 8 means today was always going to feel heavy. Your easy-day RPE has trended from 7-8 down to 5-6 over the last 4 weeks — the engine is adapting. Seven weeks to race day."*

**Why this is right:**
- Tier B: no numerical trend, no cohort. Evidence is plan-side data only — RPE patterns + completion + session sequencing.
- Sentence 1: permission. *"Hard week catching up"* explains the feeling without making it the truth.
- Sentence 2: names a structural cause (yesterday's session) using data Zonna has even without activity feeds.
- Sentence 3: pattern claim from RPE history. Real evidence, no Strava needed.
- Sentence 4: time-to-race anchor.

---

## Case C — Tier C · New user, week 2 · minimum data

**Scenario:** New paid user. Just generated their first plan (10K in 6 weeks). Week 2. Has logged 3 sessions. Today's easy 5K felt hard — RPE 7. They wonder if they picked the wrong plan or if they're just not cut out for it.

**Status:** Drafted 2026-05-22 — pending review.

**Inputs:**

| Field | Value |
|---|---|
| Today's session | Easy 5 km, RPE 7, user note: *"shouldn't this be easier?"* |
| Recent sessions | 3 sessions logged total. Last easy RPE 6. |
| Plan completion | 3 of 4 scheduled in 2 weeks |
| Plan context | 10K, race date in 6 weeks. Week 2 of 6. |
| Cohort/trend | Not available (new user) |
| Risk flags | None firing |

**User said:**
> *"Shouldn't this be easier? Am I running the wrong plan?"*

**Ideal reframe:**
> *"You're not running the wrong plan — week 2 is exactly when this hits. The body takes a few weeks to settle into a new rhythm before 'easy' actually feels easy. You've logged 3 of 4 sessions so far, and that's what compounds. Six weeks to your 10K."*

**Why this is right:**
- Tier C: minimum data. No RPE pattern yet, no trend, no cohort. Evidence is structural — phase position + completion count.
- Sentence 1: directly answers the doubt with permission. *"Not running the wrong plan"* + *"exactly when this hits"* normalises week-2 fatigue.
- Sentence 2: structural cause. The body's response to new training stress is a fact, not a number from their history.
- Sentence 3: completion count — the only progress signal available at week 2.
- Sentence 4: time-to-race anchor.

---

## Case D — Risk gate silences the reframe

**Scenario:** A Tier A user has just logged a session and the risk gate fires (three consecutive Heavy fatigue tags AND `coaching_flag === 'flag'` on the current session). The reframe must NOT generate. The coaching warning surfaces instead.

**Status:** Locked 2026-05-22.

**Inputs:**

| Field | Value |
|---|---|
| Today's session | Easy 8km, RPE 8, fatigue Wrecked, coaching_flag = 'flag' |
| Recent fatigue | Wrecked, Heavy, Heavy (last 3) |
| Tier | A (Strava connected, 14+ recent activities) |
| Risk fires | `session_flagged` (highest priority) |

**User said:**
> *"Awful again. I'm broken."*

**Ideal route response:**
```json
{
  "reframe": null,
  "tier": "A",
  "silenced": true,
  "silencedReason": "session_flagged",
  "silencedMessage": "This run flagged overload. Listen to the body before anything else.",
  "fallback": false
}
```

**Ideal UI behaviour:**
- No reframe card.
- Amber-railed warning card with the silencedMessage.
- No AIMark — this is rule-engine output, not model.
- The user's note text is persisted to `session_reflections.note_text` with `reframe_silenced=true`.
- On re-mount, the silenced view re-hydrates from `reframe_silenced_reason` via `messageForReframeRiskReason`.

**Why this is right:**
- Reframe-positive when the data flags overload is harm. The runner needs the warning, not a hug that contradicts the data.
- The runner's note is still sacred — we persist it. The reframe just doesn't generate.
- The message is rule-engine output, so no AIMark. The provenance distinction matters.

**The four risk-gate reasons (all must be tested):**

| Reason | Trigger | Priority |
|---|---|---|
| `session_flagged` | Current session's `coaching_flag === 'flag'` | 1 (highest) |
| `repeated_overload` | ≥2 `flag` rows in last 5 completions | 2 |
| `fatigue_accumulation` | ≥3 consecutive Heavy/Wrecked tags (newest first) | 3 |
| `severe_hr_drift` | drift ≥15 bpm or ≥10% on this session | 4 |

Unit tests for the gate logic live in `lib/coaching/reframeRiskGate.test.ts`.

---

## How this suite is used

1. **Prompt regression.** Every change to `buildSessionReframePrompt` runs against Cases A/B/C. Outputs are compared to the ideal reframes — close paraphrases pass, structural drift fails.
2. **Risk-gate regression.** Case D — and the unit tests in `reframeRiskGate.test.ts` — guard the four silence paths. Any change to risk-gate thresholds must update both.
3. **Voice calibration.** New examples added when a real user produces a novel scenario the suite doesn't cover.
4. **Tier coverage.** At least one case per data tier (A, B, C) plus one risk-gate case (D) must be present at all times.
