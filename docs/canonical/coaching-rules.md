# Coaching Framework — Plan Generation Rules (v4 Final)

**Authority**: This is the canonical source for all plan generation rules, phase structure, progression logic, and coaching philosophy. The R23 generator prompt and R20 reshaper must both derive from this document.

---

## 1. User Inputs

All inputs must have sensible defaults and use progressive disclosure.

### Core Inputs

| Input | Type | Notes |
|---|---|---|
| Race date | Date | Required. Anchor for entire plan |
| Race distance | Select | 5K / 10K / Half Marathon / Marathon / 50K / 100K |
| Goal | Select | Finish / Time target |
| Target time | Text | Only if goal = time target |
| Current weekly volume | Number (km) | Average of last 2–4 weeks |
| Longest recent run | Number (km) | Last 4–6 weeks |
| Days available per week | Number (2–6) | Hard constraint |
| Fitness level | Select | Beginner / Intermediate / Experienced |
| Zone 2 HR ceiling | Number | Default = 145 bpm |
| Resting HR | Number | Optional |
| Max HR | Number | Optional |
| Race name | Text | Optional |

### Lifestyle Constraints

**Hard Constraints**

| Input | Type | Notes |
|---|---|---|
| Days cannot train | Multi-select | Must never be scheduled |
| Max weekday training time | Number (mins) | Caps session duration |
| Max weekend training time | Number (mins) | Caps long run duration |
| Travel / holiday dates | Date range | Blocks or reduces training |

**Soft Constraints**

| Input | Type | Notes |
|---|---|---|
| Preferred training days | Multi-select | Try to prioritise |
| Preferred long run day | Select | Default = Sunday |

### Behaviour & Psychology

| Input | Type | Notes |
|---|---|---|
| Training style | Select | Predictable / Variety / Minimalist / Structured |
| Hard session relationship | Select | Avoid / Neutral / Love / Overdo |
| Motivation type | Select | Identity / Achievement / Health / Social |
| Why this race? | Text | Used for tone and engagement |

### Environment & Context

| Input | Type | Notes |
|---|---|---|
| Terrain access | Select | Road / Trail / Mixed |
| Weather constraints | Select | Heat / Cold / None |
| Cross-training options | Select | Bike / Swim / Gym / None |

### Health & Injury

| Input | Type | Notes |
|---|---|---|
| Injury history | Multi-select | Achilles / Knee / Back / Other |
| Current niggles | Text | Adjusts training load |
| Strength experience | Select | None / Some / Regular |

---

## 2. Plan Philosophy

- Life-first, plan-second
- Plans must adapt to constraints, not the user
- Consistency > optimisation
- Adaptation > perfection
- Minimum effective dose
- Time-on-feet > distance (for beginners and ultra runners)

---

## 3. Plan Structure by Distance

### 5K / 10K (8–12 weeks)
- Phase 1 — Base (Weeks 1–3): Zone 2 only
- Phase 2 — Build (Weeks 4–8): Introduce 1 quality session/week
- Phase 3 — Peak (Weeks 9–10): Highest volume, 1–2 quality sessions
- Phase 4 — Taper (Weeks 11–12): Reduce volume 30–40%

### Half Marathon (12–16 weeks)
- Phase 1 — Base (Weeks 1–4)
- Phase 2 — Build (Weeks 5–10)
- Phase 3 — Peak (Weeks 11–13)
- Phase 4 — Taper (Weeks 14–16)

### Marathon (16–20 weeks)
- Phase 1 — Base (Weeks 1–5)
- Phase 2 — Build (Weeks 6–14)
- Phase 3 — Peak (Weeks 15–17)
- Phase 4 — Taper (Weeks 18–20)

### 50K (16–20 weeks)
- Same as marathon
- Back-to-back long runs in peak phase
- Terrain-specific work where applicable

### 100K (20–24 weeks)
- Phase 1 — Base (Weeks 1–6)
- Phase 2 — Build (Weeks 7–16)
- Phase 3 — Peak (Weeks 17–19)
- Phase 4 — Taper (Weeks 20–24)
- Focus: time on feet, back-to-back long runs, terrain specificity

---

## 4. Core Progression Rules

### Volume Rules
- Weekly volume increase ≤ 10%
- Step-back every 3–4 weeks: reduce volume 20–25%
- Long run ≤ 35% of weekly volume
- No simultaneous increase in volume + intensity

### Intensity Distribution
- Beginner: 90% easy / 10% hard
- Intermediate+: 80% easy / 20% hard
- Easy = Zone 1–2 / conversational effort

### Time Cap Rules
- Weekday sessions ≤ user max or 90 mins default
- Long run caps:
  - HM: ≤ 2 hours
  - Marathon: ≤ 3 hours
  - 50K: ≤ 4 hours
  - 100K: ≤ 5–6 hours

### Dual Mode Training

Plans operate in distance-based mode or time-based mode.

Trigger time-based if:
- Beginner
- Limited time availability
- Ultra training focus

---

## 5. Long Run Progression

- Increase by 2–3 km/week OR 5–10 mins/week (time-based)
- Max increase: 20% per week
- Step-back: reduce 15–20%

| Distance | Peak Long Run |
|---|---|
| 5K | 8–10 km |
| 10K | 12–15 km |
| HM | 20–22 km |
| Marathon | 32–35 km |
| 50K | 35–40 km |
| 100K | 45–55 km |

---

## 6. Weekly Structure Engine

### Default Structure

| Day | Type |
|---|---|
| Mon | Rest / Strength |
| Tue | Easy |
| Wed | Quality |
| Thu | Rest / Easy |
| Fri | Easy |
| Sat | Optional / Easy |
| Sun | Long run |

### Placement Rules
- Long run = preferred day
- Quality session = midweek
- Easy runs fill remaining days

### Hard Constraints
- Never schedule on unavailable days
- Respect max session durations
- Respect travel/holiday blocks

### Spacing Rules
- Minimum 48h around quality sessions
- No quality session day before or day after long run
- No stacking high-fatigue days

---

## 7. Quality Session Rules

- None for beginners in first 3–4 weeks
- Standard: 1 per week
- Max: 2 per week
- Maintain frequency in taper, reduce volume
- Adjust based on psychology (avoid/overdo) and injury history

---

## 8. Session Types by Phase

| Phase | Zone 2 | Quality | Long Run | Strength |
|---|---|---|---|---|
| Base | 2–3 | 0 | 1 | 2 |
| Build | 2 | 1 | 1 | 2 |
| Peak | 1–2 | 1–2 | 1 | 1–2 |
| Taper | 1 | 1 | 1 (short) | 1 |

---

## 9. Quality Session Types by Distance

### 5K / 10K
- Tempo: 20–40 min
- Intervals: 400m–800m repeats

### Half Marathon
- Tempo: 30–50 min
- Cruise intervals: 2–3 km reps

### Marathon
- Marathon pace runs
- Threshold runs

### 50K / 100K
- Race-pace long runs
- Back-to-back long runs
- Hill reps

---

## 10. Strength & Cross Training

- Base/Build: 2 sessions/week
- Peak: 1–2 sessions
- Taper: 1 session

Rules:
- Do not precede quality sessions
- Adjust based on experience level

---

## 11. Adaptive Coaching Rules

> Note: Live adaptation logic belongs to R20 (Dynamic Plan Reshaping). See `docs/canonical/adaptation-rules.md`. The rules below define the logic R20 implements — they are not part of the static plan generator (R23).

### Missed Sessions

| Scenario | Action |
|---|---|
| Miss 1 | Continue |
| Miss long run | Reschedule or freeze progression |
| Miss 3+ | Reduce next week by 20% |
| Miss full week | Repeat previous week |
| Miss during taper | Do not compensate |

### Fatigue Adjustment

Triggers:
- Elevated HR vs effort
- High perceived effort
- Poor sleep / high stress

Actions:
- Reduce next week volume 10–20%
- Remove or downgrade quality session

### Consistency Rule
- Track % completion weekly
- Low consistency → slow progression
- High consistency → allow progression

---

## 12. Injury-Aware Adjustments

| Injury | Adjustment |
|---|---|
| Achilles | Reduce speed work and hills |
| Knee | Reduce volume spikes |
| Back | Limit long run duration |

General rule: persistent pain (>3 runs) → reduce load or rest

---

## 13. Environment Adjustments

- Heat: reduce intensity, increase recovery
- Cold: extend warm-up
- Trail: reduce pace expectations, increase effort focus

---

## 14. Race Preparation Rules

- Practice fueling during long runs
- Test race kit
- Include race simulation sessions
- Rehearse pacing and timing

---

## 15. Taper Rules

| Distance | Taper Duration |
|---|---|
| 5K/10K | 1 week |
| HM | 2 weeks |
| Marathon+ | 2–3 weeks |

- Reduce volume 30–40% per week
- Maintain intensity
- No new variables (shoes, food, routine)
- Prioritise sleep and nutrition

---

## 16. Guard Rails

| Scenario | Action |
|---|---|
| Race < 6 weeks (marathon+) | Refuse |
| Race < 3 weeks | Refuse |
| Volume = 0 & race < 8 weeks | Warn |
| Days available < 2 | Refuse |
| Unrealistic target | Flag gap |
| Long run exceeds safe % | Adjust |
| Over-constrained schedule | Simplify plan |
| Weekday time < 45 min | Simplify sessions |

---

## 17. Confidence Scoring

> Note: Confidence scoring is R18. The generator may output an initial score at creation time — decision deferred. See backlog for R18 scope.

Score (1–10) based on:
- Time to race
- Fitness vs goal gap
- Lifestyle constraints
- Consistency likelihood
- Injury risk

Output: score, risks, suggested adjustments

---

## 18. Output Requirements

Each plan must:
- Start on a Monday
- Have continuous weekly structure
- Include all 7 days
- Respect all constraints

Each session must include:
- Type
- Description
- Duration or distance
- Effort (HR / pace / RPE)

---

## 19. Plan Integrity Rules

- Never violate hard constraints
- Never exceed progression limits
- Always prioritise sustainability over optimisation
- If conflict occurs → simplify, don't force complexity
