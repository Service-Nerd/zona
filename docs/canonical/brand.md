# Brand — Zona

**Authority**: This document defines Zona's tone of voice, visual principles, and brand rules. These rules apply to all copy, UI decisions, and feature design. When in doubt: honest, calm, useful.

---

## Brand Positioning

**Tagline** (`BRAND.tagline`): "Slow down. You've got a day job."  
**Brand statement** (`BRAND.brandStatement`, editorial/App Store only): "Slow down. You're not Kipchoge."  
**Core truth**: "You're trying hard. That's the problem."  
**Audience**: Non-elite runners who overtrain. They care deeply. That care is the problem.

The tagline names a person, not a training philosophy — it speaks directly to the user's identity. The brand statement is the punchline; used in editorial contexts (App Store description, press, login footer) only. Both acknowledge the user's effort without validating the overtraining.

> **Tagline decision (backlog D5):** "Slow down. You've got a day job." wins because it identifies the person. "Slow down. You're not Kipchoge." is funnier but describes a feeling. Runna would never say either — that's the point. All canonical strings live in `lib/brand.ts`. Never hardcode.

---

## Tone of Voice

Honest, slightly sarcastic, self-aware, encouraging without cringe.

- **Not a cheerleader.** Never over-celebrate. Never use exclamation marks to paper over ordinary moments.
- **Not harsh.** Dry ≠ cold. The app cares — it just doesn't perform caring.
- **Not vague.** "Nice work!" means nothing. "Kept it under control." means something.
- **One sentence.** Zona voice responses are always one sentence. No paragraphs.

### Voice Examples

| Situation | Zona says |
|-----------|-----------|
| Ran too fast | *"Bit keen. Ease it back."* |
| Perfect execution | *"There it is. Don't ruin it."* |
| Rest day | *"Do nothing. It helps."* |
| Post-run, good execution | *"Kept it under control."* |
| Session skipped | *"It happens. Pick it back up."* |
| First run of the plan | *"First one. Start easy."* |
| Fatigue logged as wrecked | *"Body's talking. Listen to it."* |

### What the voice is NOT

- No emojis in app copy (unless explicitly added by a product decision)
- No "Amazing!", "Great job!", "You crushed it!"
- No passive-aggressive guilt about missed sessions
- No false urgency ("You need to run today!")
- No fitness influencer language ("smash", "beast mode", "gains", "push through")
- No AI-sounding hedging ("It seems like...", "Based on your data...")

The canonical response matrix for session-type-aware coaching lives in `getZonaReflectResponse()` in `DashboardClient.tsx` and must stay consistent with these guidelines.

---

## User-First Principle

**Every feature and every screen must be evaluated from the user's perspective before the technical one.**

Before building anything, ask:
1. What does the user need from this screen?
2. What is the one job this screen does?
3. What would make the user feel the app understands them?

Only then ask the technical question. If the technical approach would compromise the UX, the technical approach changes — not the UX.

This is a design gate, not a guideline.

---

## Visual Principles

### Core rules

| Rule | Detail |
|------|--------|
| No red in the training UI | Red implies danger or failure. Zona uses amber for warnings, coral for high-intensity sessions. Form validation errors may use `--zona-red` (`#ff7777`) only. |
| No popups | All interactions navigate to full screens. Modal overlays only for destructive confirmations (delete, disconnect). Never for information. |
| Back arrow top-left | Navigation is always predictable and reversible. |
| One job per screen | Each screen has exactly one primary purpose. No dashboards. No noise. |
| Calm guidance, not alerts | Information is presented; the user decides when to act. |
| Restraint = progress | Whitespace, brevity, and silence are features. Empty means calm, not broken. |
| Slide-up sheets | Mirrored nav bar at bottom, not top. |

### What this looks like in practice

| Pattern | Zona does | Zona does NOT do |
|---------|-----------|------------------|
| Upgrade prompts | Contextual, inline, triggered by action | Banners, countdown timers, forced modals |
| Session feedback | Post-log reflect — calm, invited | Celebratory popups, confetti, toast stacks |
| Errors | Quiet inline text | Red alert boxes, modals |
| Empty states | Simple label explaining the state | Heavy illustration "onboarding" noise |
| Navigation | Persistent bottom nav, predictable | Deep nesting, hamburger menus |

---

## Design System Reference

The visual language is defined in full at:

- `CLAUDE.md` — System B palette (locked, non-negotiable)
- `docs/canonical/ui-patterns.md` — component anatomy, spacing, typography
- `docs/architecture/ADR-001-design-tokens.md` — why `globals.css` is the single source of truth

### Quick reference: banned values

| Banned | Reason |
|--------|--------|
| `#D4501A` (ember orange) | Old palette — fully retired |
| `#f5f2ee` (warm beige) | Old palette — fully retired |
| DM Mono | Old font — fully retired |
| DM Sans | Old font — fully retired |
| Any hardcoded hex in a component | Must come from CSS custom property in `globals.css` |
| Red in training UI | Implies danger; use amber or coral instead |

---

## Invariants

- Tone of voice must be consistent across app copy, coaching copy, empty states, error messages, and onboarding
- Visual rules are non-negotiable without a product decision logged in this file and in `CLAUDE.md`
- User-first principle is a design gate on every feature build — not a suggestion
- All new copy must be reviewed against the voice examples before shipping
