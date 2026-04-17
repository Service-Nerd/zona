# Adaptation Rules — Canonical Reference

**Authority**: This document defines the rules for dynamic plan adaptation. These rules are implemented by R20 (Dynamic Plan Reshaping). They are not part of the static plan generator (R23).

---

## Missed Session Rules

| Scenario | Action |
|---|---|
| Miss 1 session | Continue as planned |
| Miss long run | Reschedule or freeze week progression |
| Miss 3+ sessions | Reduce next week volume by 20% |
| Miss full week | Repeat previous week |
| Miss during taper | Do not compensate — taper integrity is critical |

---

## Fatigue Adjustment

### Trigger Signals
- Elevated HR relative to effort (e.g. high HR on what should be Zone 2 effort)
- High perceived effort (RPE > expected for session type)
- Poor sleep or high stress (self-reported)

### Actions
- Reduce next week volume 10–20%
- Remove or downgrade quality session (e.g. tempo → easy)

---

## Consistency Rule

| Completion Rate | Action |
|---|---|
| Low consistency | Slow or pause volume progression |
| High consistency | Allow progression to continue |

Track % of sessions completed per week. Feed into confidence score (R18).

---

## Injury-Aware Adjustments

| Injury | Adjustment |
|---|---|
| Achilles | Reduce speed work and hills |
| Knee | Reduce volume spikes |
| Back | Limit long run duration |

General rule: persistent pain (>3 consecutive runs) → reduce load or add rest week.

---

## Environment Adjustments

| Condition | Adjustment |
|---|---|
| Heat | Reduce intensity target; increase recovery |
| Cold | Extend warm-up duration |
| Trail | Reduce pace expectations; increase effort focus |

---

## Architecture Note

R20 (reshaper) takes an existing plan JSON + context (completions, RPE, fatigue signals) and produces a modified plan JSON. It does not create plans from scratch — that is R23. Both share the same schema (`docs/canonical/plan-schema.md`) and these adaptation rules.
