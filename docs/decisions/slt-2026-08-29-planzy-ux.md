# SLT Review — Planzy / Runzy competitive-UX proposals

**Date:** 2026-08-29
**Trigger:** Founder liked several Planzy screens (+ a Runzy chatbot idea) and asked whether Zonna should adopt any of the UX.
**Board:** Sutherland · Fried · Hutchinson (also chairs Coaching Board) · Wood · Traynor
**Gate:** SLT — "should we build it, for whom, at what tier?" (before an item moves into active build)
**Evidence:** `docs/investigations/planzy-*.png` (6 screens)
**Authority:** ADR-017. This is a build/tier/brand decision; coaching-correctness of any greenlit item routes down to the Coaching Board.

**Status:** signed decision. Backlog items opened (see `docs/releases/backlog.md` → "Competitive UX — Planzy/Runzy set").

---

## What was reviewed

Six Planzy screens + a described Runzy feature, distilled to four decisions:

| Item | Proposal | Verdict | Tier |
|---|---|---|---|
| **UX-WIZARD-01** | Per-day time-allocation **sliders** in the plan wizard (one slider/day, NONE→MAX) | **BUILD** | FREE |
| **UX-WIZARD-CHATBOT** | Runzy-style **conversational** plan setup | **DON'T BUILD** | — |
| **UX-PROGRESS-01** | Race-time **projection graph** (today→race curve) | **DON'T BUILD** (value already ships) | n/a |
| **UX-ZONES-01** | Pace-zone **presentation** polish (keep 5 zones) | **BUILD — light polish** | FREE |
| **UX-SESSION-GLYPH-01** | Session-**shape glyph** on plan rows | **BUILD — small** | FREE |

Two Planzy screens (profile / data-source toggles) were dropped outright: Zonna already has the equivalents, and Garmin / Apple Watch direct sync is not buildable (ADR-011).

---

## Registry finding that reshaped the review

**The race-time projection is largely already built, and PAID.** `feature-registry.md` carries **"Estimated race times"** (`RaceTimesCard`, `/api/race-times`, VDOT, 5-state confidence) and **"Target race time delta" (R31)** — current projected finish + improvement delta vs baseline. So the *number* Planzy shows already exists in Zonna, honestly and confidence-tiered. The only net-new element in Planzy is the **graph over time**. Zones (VDOT model, `ZoneBar`/`ZoneRings`/orientation) also already exist — UX-ZONES-01 is presentation, not capability.

---

## The rulings

### UX-WIZARD-01 — per-day time sliders — **BUILD (FREE)**
The standout of the set, and the board was unanimous. Sutherland: "how many days can you run?" is answered aspirationally; "how much time on each day?" is a *budget*, answered honestly — it reframes the commitment as the constraint the overtrained runner is avoiding. Wood: it changes the **context** (concrete, low-load) rather than trying to motivate. Traynor: it's the **activation funnel** — a smoother first run lifts wizard completion → more plans → more trials; cheap, high-leverage, FREE. Fried: it's a *better form*, not a new feature — the good kind of change.

**Routing:** Hutchinson flagged that a per-day **minute budget** is richer than a flat day-count. If the engine begins respecting per-day time caps when placing/sizing sessions, that **changes what it prescribes** → **Coaching Board rules before that slice ships.** The UI itself is free to proceed; the input-semantics change is the gated part.

### UX-WIZARD-CHATBOT — Runzy chatbot — **DON'T BUILD**
Unanimous no. Sutherland: a chatbot is "a form that's decided to have a personality" — feels innovative, is actually more work. Wood: it *raises* cognitive load and hands an anxious Type-A runner a conversation to manage — the illusion of helpfulness. Traynor: expensive to build and run (LLM per setup, latency) and a **conversion risk** on the one flow you can't afford to leak. Recorded as considered-and-rejected so it doesn't resurface.

### UX-PROGRESS-01 — projection graph — **DON'T BUILD**
The honest version already ships (PAID). A smooth downward curve is a **promise the app can't keep** (fitness isn't linear; no per-week GPS/power data to model a real trajectory — ADR-011), and it is the **illusion-of-progress class** (Wood) — a line the Type-A runner fixates on and chases, the exact behaviour Zonna exists to interrupt. It also violates the **"No dashboards or noise"** UI principle. Hutchinson: the honest ceiling is *three points* — baseline → current → target — never an interpolated slope, and **any** trajectory viz is a **Coaching Board correctness question first.**

### UX-ZONES-01 — pace-zone polish — **BUILD light (FREE, low priority)**
Keep the **canonical 5-zone model** — Planzy's 7 zones are a hard Coaching Board veto (INV-COACH-004, the Seiler zone-label trap). A clean 5-zone pace reference from existing VDOT paces, in Warm Slate, is correct — but **embedded where the decision happens** (on the session), not a new standalone reference screen (Wood). Presentation only, no coaching change.

### UX-SESSION-GLYPH-01 — session-shape glyph — **BUILD small (FREE, low priority)**
A glyph (solid = steady, mini bar-chart = intervals) adds "information scent" beyond the existing left-accent colour (Sutherland). Acceptable **provided it is driven by the session's actual structure** (`derived_set`/catalogue, ADR-019), not a guess — a misleading shape is worse than none (Hutchinson).

---

## Conflicts

Unusually few — the board was near-unanimous on every item. The only genuine tension was UX-PROGRESS-01's motivation-vs-honesty, and it **collapsed** because the honest version already ships. The one live open question is narrow and routed, not a disagreement: does UX-WIZARD-01's per-day budget change generation logic? → Coaching Board.

## MUST / NEVER check

- **"No dashboards or noise"** — UX-PROGRESS-01 violates it; the rejection is consistent, not conservative.
- **Warm Slate / no dark mode (ADR-008)** — Planzy/Runzy are dark; adopt *patterns*, never the palette.
- **Five-zone model is canonical (INV-COACH-004)** — UX-ZONES-01 must not import 7 zones.
- **ADR-011 data limits** — the dropped profile screens were correct; Garmin/Apple Watch direct sync isn't buildable.
- No gamification proposed. ✓

## Risks to existing features

- **UX-WIZARD-01 is the real risk surface** — it rebuilds part of `GeneratePlanScreen` (just stabilised: D6/D7/D10) and may change the `GeneratorInput` shape (per-day minutes vs `days_available` + `max_weekday_mins`), rippling into `ruleEngine`, `foundationBlock`, the property sweep, and `zona_wizard_draft`. Scope it as a proper build, not a tweak.
- **UX-PROGRESS-01:** do not touch/duplicate `RaceTimesCard`, `/api/race-times`, or the `race_time_estimates` gate.
- **UX-ZONES-01 / UX-SESSION-GLYPH-01:** extend `ZoneBar`/`ZoneRings` and the session rows (`PlanCalendar`) — don't fork them.

## Downstream Coaching Board routing

- **UX-WIZARD-01** — *iff* per-day time budgets change what the engine prescribes (session placement/sizing). UI is free to proceed.
- **UX-PROGRESS-01** — *iff* ever revisited: any trajectory visualisation needs a correctness ruling before build (expected outcome: reject a fabricated curve; permit at most a 3-point baseline→current→target).
