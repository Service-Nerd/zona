# ADR-003 — Feature Gating: FREE / PAID Split

**Status**: Accepted  
**Date**: 2026-04-15

---

## Context

Without an explicit tier system, features drifted into paid territory accidentally during builds. The freemium model was being undermined by AI-assisted sessions that built intelligent features without considering monetisation. A hard gate was needed before any feature work began.

---

## Decision

Every feature is tagged FREE or PAID in `docs/canonical/feature-registry.md` **before implementation begins**. An untagged feature is a build blocker.

Gates are enforced in **both** API routes and components. Component-only gates are insufficient — a determined user or a future refactor could bypass them.

### Tier Definitions

**FREE:**
- Generic pre-built plan templates (5K/10K/HM, 8 & 12-week variants)
- Core session display and theme
- Basic profile management
- No AI, no Strava, no dynamic coaching

**PAID:**
- Dynamic plan generation with athlete variables
- Strava integration
- AI coaching and session descriptions
- Plan reshaping (R20)
- Confidence scoring (R18)
- All personalised or intelligent features

### Invariant

Free tier UI must not expose the existence of paid-tier data, even in a disabled/locked state, without an explicit product decision.

---

## Consequences

- **Positive**: Freemium model is enforceable from day one. No accidental paid feature leakage.
- **Positive**: The registry provides a single place to audit tier assignments.
- **Constraint**: Every new feature requires a registry update before a line of code is written.
- **Constraint**: Both API and component layers must enforce gates — duplicating gate logic is required, not optional.
