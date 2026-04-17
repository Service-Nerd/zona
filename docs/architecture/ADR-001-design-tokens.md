# ADR-001 — Design Tokens: System B Palette and globals.css as Single Source

**Status**: Accepted  
**Date**: 2025 (pre-ZONA rebrand)

---

## Context

The original ZONA palette (Ember orange `#D4501A`, warm beige `#f5f2ee`, DM Mono, DM Sans) was scattered across components as hardcoded values. During a deliberate rebrand to System B (navy, off-white, teal, amber), the lack of centralisation caused palette regressions on every AI-assisted session — the most frequent and wasteful failure mode in the project's history.

---

## Decision

1. **System B palette is locked.** No exceptions, no mixing with the old palette.
2. **All design tokens live in `globals.css` as CSS custom properties.** No hardcoded hex values, font names, or spacing values in any component file.
3. **Old palette values are fully retired.** Any surviving value is a defect, not a legacy concern.

### Locked System B Palette

| Token | Value | Usage |
|---|---|---|
| `--color-bg-primary` | `#0B132B` | Dark mode background |
| `--color-bg-light` | `#F7F9FB` | Light mode background |
| `--color-card-light` | `#ffffff` | Card background (light) |
| `--color-card-dark` | `#162040` | Card background (dark) |
| `--color-cta` | `#5BC0BE` | CTA / active / zones (Teal) |
| `--color-warning` | `#F2C14E` | Warnings / coaching (Amber) |
| `--color-muted` | `#3A506B` | Muted text |
| `--color-border-light` | `#E2E8F0` | Borders (light) |
| `--color-border-dark` | `#1e2e55` | Borders (dark) |

**Banned values:** `#D4501A` (ember orange), `#f5f2ee` (warm beige), DM Mono, DM Sans.

**Fonts:** Inter (metrics/UI), Space Grotesk (headings/brand).

---

## Consequences

- **Positive**: A single file (`globals.css`) controls the entire visual system. Palette drift is detectable and fixable in one place.
- **Positive**: AI-assisted sessions cannot accidentally reintroduce the old palette as long as components reference tokens, not hex values.
- **Constraint**: Any new colour must be added to `globals.css` as a token before use. Never add to a component directly.
- **Ongoing**: Design token centralisation is listed as tech debt — hardcoded values still survive in `DashboardClient`, `login/page`, `PlanChart`, `PlanCalendar`, `StravaPanel`, `layout.tsx` and must be replaced.
