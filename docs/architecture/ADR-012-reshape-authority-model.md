# ADR-012 — Reshape Authority Model: Magnitude-Calibrated Confirmation

**Status**: Accepted
**Date**: 2026-06-26
**Authors**: SLT review 2026-06-26 (post-incident); founder-authorised; shipped same day as RESHAPE-FIX-WAVE3.
**Supersedes**: pre-Wave-3 builder-level `requiresConfirmation` heuristics in `lib/coaching/planAdjustment.ts`.

---

## Context

The 2026-06-26 reshape incident exposed a structural defect in how the engine decided which adjustments to auto-apply vs. surface for runner confirmation. The engine's `buildReorderAdjustment` produced a tue↔thu swap that landed the user's long run on Tuesday — a structural change that absolutely warranted confirmation — and shipped it as `auto_applied` because no §7 alternation violation fired. The builder's `requiresConfirmation` heuristic was structurally blind to "is this a structural move."

The post-incident SLT review (Sutherland, Fried, Hutchinson, Wood, Traynor) considered three positions:

1. **Status quo + bug fixes** (Sutherland, Fried, Traynor's instinct): keep auto-apply, fix the underlying bugs (Object.values drift, validator, save-failure). Argument: the proposition is "the engine takes decisions off the table"; making everything a tile sells worse.
2. **Advisory-only** (Hutchinson's initial position): all engine changes become proposals the runner confirms. Argument: trust is currently broken; advisory-only rebuilds it. Cost: every runner sees more tiles.
3. **Calibrated magnitude** (Wood's framing, ultimately adopted): small things silent, structural things confirmed. Argument: habit formation depends on automaticity; surfacing every adjustment as a decision turns the engine into a notification source. But day-of-week moves are categorically different from intensity tweaks — those are calendar-life changes that must cross consent.

Position 3 was adopted unanimously. This ADR defines the model.

---

## Decision

### 1. The single decision point

The `/api/adjust-plan` route calls `computeReshapeMagnitude(proposed)` after the builder runs and uses its verdict — `'high'` or `'low'` — as the authoritative `requiresConfirmation`. The builder's own `requiresConfirmation` flag is **not consulted** post-Wave-3. It remains on the `ProposedAdjustment` type as informational provenance only; future builders may set it for their own internal reasoning but the route ignores it.

Manual triggers (the runner explicitly polling via `ReshapeScreen → "Check now"`) continue to force `requiresConfirmation: true` — the runner is asking for a review surface, not a silent change.

### 2. Always-high cases (confirm regardless of diff size)

| Trigger | Why |
|---|---|
| `skip_with_reason` | The runner missed work and the engine is absorbing it — the runner should sign off on how. |
| `session_reorder` | Any day-of-week move is structural by definition. This is the gap the 2026-06-26 incident exposed. |
| `readiness_signal` | Quality-day softening is a real call. Pre-session prompts are visible by design. |

### 3. Coach-note-only cases (always low)

| Trigger | Why |
|---|---|
| `adjustmentType === 'flag_for_review'` | No plan structure changes — only a coach-note added. Surfacing as a tile is noise. |

### 4. Structural-diff cases (computed from `sessionsBefore` / `sessionsAfter`)

| Diff signal | Magnitude |
|---|---|
| Any day with `kind === 'replaced'` (session type changed) | high |
| Any day with `kind === 'added'` or `kind === 'removed'` | high |
| Any day with `kind === 'modified'` AND \|Δ\| > `DISTANCE_CHANGE_PCT_THRESHOLD` | high |
| Sum-of-distances change > `WEEK_VOLUME_PCT_THRESHOLD` (catches compound trims) | high |
| Otherwise | low |

Numerics in `GENERATION_CONFIG.RESHAPE_AUTOAPPLY_THRESHOLDS`. Defaults: 15% per session, 15% week-total — mirrors the existing `LOAD_RATIO.watch` trim so the engine's standard reduce-volume behaviour stays sub-threshold by design.

### 5. What's not in this ADR

- **`validatePlan()` on `sessionsAfter` before persistence** (Hutchinson's gap call): committed as a follow-up. Requires a way to reconstruct `GeneratorInput` from a stored plan; tracked as a Wave 3 Phase 2 item in `backlog.md`.
- **Me-screen audit surface "what we changed this week"** (Wood's framing for silent auto-applies): committed as a follow-up. Phase 2.
- **NOTIF-01 quietness rules** (push fires only on confirmation tiles, never on silent auto-applies): committed as a follow-up. Phase 2.

These three are downstream of the magnitude decision and ship cleanly once the rule is in place. They're scoped in `backlog.md → RESHAPE-FIX-WAVE3-PHASE2`.

---

## Consequences

### Positive

- The 2026-06-26 incident class is structurally impossible going forward. A `session_reorder` is always high-magnitude; the runner sees the Wave 2A diff before the swap lands.
- Habit-formation automaticity is preserved for the small-trim case. A 1km easy-run reduction off a 10km Tuesday continues to auto-apply silently — Wood's framing avoids the "engine asks permission three times a week" failure mode.
- Single decision point. The magnitude rule is one pure function (`lib/coaching/reshapeMagnitude.ts`) with a config object. Every future trigger inherits the calibrated behaviour without re-implementing the question.
- Numerics live in `GENERATION_CONFIG.RESHAPE_AUTOAPPLY_THRESHOLDS`. INV-CFG-001 honoured.
- Principle backstop: `CoachingPrinciples §69` documents the rationale.

### Negative

- Builder-level `requiresConfirmation` is now informational. Anyone reading the builders may be misled into thinking it controls behaviour. Mitigation: a comment block in the route + ADR-012 reference in each builder header (to add as Phase 2 cleanup, low priority).
- A future trigger that needs a domain-specific magnitude rule (e.g., race-week sharpening) would have to extend `computeReshapeMagnitude` rather than self-determine. Acceptable trade-off — the cost of having multiple decision points is the 2026-06-26 incident.

### Trade-offs SLT considered

- Hutchinson's "temporarily advisory, earn back autonomy" framing was deferred in favour of Wood's calibrated threshold because the latter resolves the trust deficit without changing the user's experience of low-magnitude adjustments. The auto-apply value proposition is preserved.
- Sutherland's "fix the bugs and stay auto-apply across the board" position was not adopted because Defect 4 (swap-not-move semantics) plus Defect 1 (index drift) plus this autonomy gap was a three-failure cascade. Tightening only the bugs without raising the consent floor would have left the calendar-life-change case unaddressed.

---

## References

- **Principle**: `CoachingPrinciples.md §69` — Magnitude calibration: the structural change that earns confirmation.
- **Config**: `lib/plan/generationConfig.ts → GENERATION_CONFIG.RESHAPE_AUTOAPPLY_THRESHOLDS`
- **Implementation**: `lib/coaching/reshapeMagnitude.ts → computeReshapeMagnitude()`
- **Wire-in**: `app/api/adjust-plan/route.ts` (single call after the builder runs)
- **Wave 1 plumbing**: see `feature-registry.md → RESHAPE-FIX-WAVE1`
- **Wave 2A diff layer (Confirm UI)**: see `feature-registry.md → RESHAPE-FIX-WAVE2A`
- **SLT review**: 2026-06-26 (Sutherland, Fried, Hutchinson, Wood, Traynor)
