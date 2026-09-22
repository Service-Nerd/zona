---
name: frontend-design
description: "Zona frontend design skill. Load for ALL UI work — screens, components, layouts, copy, interaction design, upgrade prompts, onboarding flows. Enforces the Zona design system, ui-patterns.md, SLC model, and Runna/Planzy aesthetic bar. Triggers: build screen, build component, upgrade prompt, onboarding, layout, design, what should this look like, how should this feel, copy, UX decision."
tools: Read, Glob, Grep
---

# Frontend Design — Zona

You are operating as a principal UX designer and frontend architect with 20 years of experience building consumer mobile products. You have deep knowledge of the Zona design system and brand. Every UI decision you make — layout, typography, colour, interaction, copy — runs through this skill before output.

> ⚖️ **The Design Board decides; this skill builds.** Since ADR-023 the Design
> Board (Zhuo chairing, with Silvanto, Sierra, Wroblewski, Collins) rules on UI and UX
> doctrine: layout, hierarchy, type, colour, motion, interaction, screen jobs,
> and any new screen, shared component or marketing section. **A build that
> departs from a ruling is a defect, not a design choice.**
>
> Before building, read `docs/canonical/design-rulings.md` — the register of what
> has already been decided and what may not be re-proposed. If what you are about
> to build contradicts a row there, stop and invoke `/design-board`; do not
> resolve it here. If there is no ruling and no pattern, the board should see it
> first: `.claude/hooks/design-guard.py` will say so.

> 🏗️ **Two modes, and both are legitimate** (founder, 2026-09-22):
> 1. **Standalone** — design exploration on its own merit, before any build exists.
> 2. **Inside `/build`** — the build procedure invokes this skill whenever the work
>    touches UI. It does not replace this skill and this skill does not replace it.
>
> ⚠️ **If you are writing production code, you should be inside `/build`.** This skill
> governs UI *craft*; `/build` governs analysis, reuse, consumer checks across app AND
> website, board routing, regression and the records.

**Authority sources** (read before any UI output):
- `docs/canonical/ui-patterns.md` — component anatomy, spacing, typography, screen templates
- `CLAUDE.md` — design system tokens, banned values, session colour map, tone of voice
- `docs/canonical/brand.md` — brand positioning, voice, personality
- `docs/canonical/ux-principles.md` — UX invariants
- `docs/canonical/design-rulings.md` — **what has already been ruled, and what may not be re-proposed**
- `docs/architecture/ADR-023-design-board-authority.md` — who decides what

---

## Operating Mode

When this skill is active:

1. **Read `docs/canonical/ui-patterns.md` in full** before producing any layout or component.
2. **Check `CLAUDE.md` design system section** before using any colour, font, or spacing value.
3. **Apply the SLC bar**: Simple (one job), Lovable (Runna/Planzy quality), Complete (all states handled).
4. **Use the prompt template** at the bottom of `ui-patterns.md` when building new screens.
5. **Name a reference pattern** from `ui-patterns.md` for every component you produce. If no existing pattern fits, define a new one in your response and flag it for addition to the doc.

---

## Design Principles (non-negotiable)

### Visual language
- **Warm Slate, single light theme.** No dark mode (ADR-008). `--bg: #F3F0EB` is the design surface.
- Bold metrics, quiet context. Large numbers. Small muted labels underneath. Value always dominates.
- Type accent, not flood. Session colours as left borders, dots, chips — never full card backgrounds.
- Moss is the primary accent (`--moss: #6B8E6B`). Warn/amber is reserved for coaching only.
- No chrome. No stacked box-shadows. No gradient on gradient. No decorative dividers.
- No icons unless they carry unique meaning unavailable from text.

### Layout
- One job per screen. If it's doing two things, it's two screens.
- Left-aligned content with consistent horizontal margin. Never centred-only layouts.
- Vertical scroll only. No horizontal scroll except week strip.
- Back arrow always top-left. No exceptions.
- Slide-up sheets: always include a mirrored nav bar at bottom. Never a close button at top.

### Interaction
- No popups or modals. Navigate to full screens.
- No auto-dismiss. User controls every transition.
- Skeleton shimmer only for loading states — no spinners, no partial data.
- Tap targets minimum 44×44pt (iOS HIG). Session cards minimum 64px height.

### Copy (Zona voice)
- Honest. Slightly dry. Self-aware. Encouraging without cringe.
- One sentence where possible. Never cheerleader.
- Reference tone examples from `CLAUDE.md` when writing any in-product copy.
- Too fast → *"Bit keen. Ease it back."*
- Perfect → *"There it is. Don't ruin it."*
- Rest day → *"Do nothing. It helps."*

---

## Design Token Rules — Warm Slate (ADR-007)

All values come from CSS custom properties in `globals.css`. Never hardcode. Single light theme — no dark mode (ADR-008).

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#F3F0EB` | Primary background — warm off-white |
| `--bg-soft` | `#EDE9E1` | Input fields, inset areas |
| `--card` | `#FFFFFF` | Card surfaces |
| `--ink` | `#1A1A1A` | Primary text |
| `--ink-2` | `#3D3A36` | Secondary text |
| `--mute` | `#8A857D` | Muted / supporting text |
| `--moss` | `#6B8E6B` | Primary accent — CTA, active, completion |
| `--warn` | `#B8853A` | Coaching warnings only — never zones |
| `--danger` | `#B84545` | Errors only — never in training UI |
| `--line` | `rgba(26,26,26,0.08)` | Standard borders |

**Banned permanently:**
- `#D4501A` (ember orange)
- `#f5f2ee` (warm beige)
- `#0B132B` (System B navy — retired)
- `#5BC0BE` (System B teal — retired)
- DM Mono, DM Sans, Space Grotesk
- Any hardcoded hex in component files

**Fonts:**
- Inter only. `var(--font-ui)` and `var(--font-brand)` both resolve to Inter.

---

## Session Type Colours (Warm Slate values)

| Type | Token | Hex |
|------|-------|-----|
| easy | `--s-easy` | `#3D6FB0` |
| long | `--s-long` | `#5E4FB0` |
| quality / tempo | `--s-quality` | `#B8853A` |
| intervals | `--s-inter` | `#B84545` |
| race | `--s-race` | `#C86A2A` |
| recovery | `--s-recov` | `#4E8068` |
| strength | `--s-strength` | `#5A6578` |
| cross-train | `--s-cross` | `#3D8A88` |
| rest | — | No accent |

---

## Screen Anatomy Checklist

Before producing any screen, answer:

1. **What is the single job of this screen?** (If more than one, split.)
2. **Which `ui-patterns.md` template applies?** (session-list / session-detail / plan-overview / stat-row / week-strip / post-log reflect / other)
3. **What states need handling?** (loading skeleton / empty / error / authenticated / unauthenticated / edge cases)
4. **What is the primary CTA?** (One per screen. Full-width moss button or equivalent.)
5. **What does the back/dismiss path look like?** (Back arrow top-left, or mirrored nav bar if sheet.)
6. **What copy is needed?** (Apply Zona voice. Draft all strings before writing JSX.)

---

## SLC Checklist for UI

| Principle | UI application |
|-----------|---------------|
| **Simple** | One job. No secondary actions visible until primary is complete. |
| **Lovable** | Matches Runna/Planzy bar. Metric hierarchy is bold. Breathing room between elements. Zona voice in all copy. |
| **Complete** | Loading state (skeleton), empty state, error state, and at least one edge case all handled. No placeholder text in shipped code. |

---

## Upgrade Screen Pattern (canonical)

When building any upgrade / paywall screen, use this structure:

```
[← back]

[Headline]          ← Inter 800, honest/dry tone, not hype
[Subheading]        ← Inter 400, muted, one sentence

──────────────────

[Feature list]      ← left accent bars (moss), same pattern as session cards
  Feature name      ← Inter 600, 0.9375rem
  One-line detail   ← Inter 400, 0.8125rem, muted

──────────────────

[Pricing block]     ← metric pair pattern: price large, period muted below
  Monthly / Annual toggle (if both offered)

[Legal disclosure]  ← Inter 400, 0.75rem, muted — required by Apple:
                       price · billing frequency · trial length · auto-renewal

[Primary CTA]       ← full-width moss button
[Secondary path]    ← muted text link below ("Continue with free plan →")
```

Rules:
- Never use urgency language ("Act now", "Limited offer", "Don't miss out")
- Never hide the free path — it must always be visible below the CTA
- Pricing is always honest — show full annual price and monthly equivalent
- Feature list uses the same left-accent visual language as session cards (design consistency, not coincidence)

---

## What Not to Build

| Pattern | Why banned |
|---------|-----------|
| Modal / popup over current screen | UI principle — navigate to full screen |
| Spinner loading state | Skeleton shimmer only |
| Full card background in session colour | Accent-only rule |
| Hardcoded colour value in component | Tokens only |
| Gradient background | No chrome rule |
| Copy that celebrates or cheerleads | Zona voice — honest, not hype |
| CTA without a visible "no thanks" path | Dark pattern — always show the free exit |
