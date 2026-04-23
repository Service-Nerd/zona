# ADR-007 — Warm Slate Palette

**Status**: Accepted  
**Date**: 2026-04-23  
**Supersedes**: ADR-001 (colour values only; ADR-001 principle — tokens in globals.css — retained)

---

## Context

System B (navy `#0B132B`, teal `#5BC0BE`, amber `#F2C14E`, off-white `#F7F9FB`) was the right move away from the old Ember palette. It established design discipline. But as the app matured and the brand positioning sharpened (see `docs/alignment/brand-product-alignment.md`), System B became a liability:

- The dark-on-light-or-light-on-dark dual-mode system added complexity for a solo developer with no apparent product benefit — non-elite runners don't need dark mode in a training app.
- The teal/amber/navy combination reads as "fintech app" or "sports analytics tool" — not "running coach who happens to be honest with you."
- The off-white (`#F7F9FB`) felt cold and clinical. The new positioning calls for warmth and restraint — something that looks like it belongs next to a well-worn running journal, not a Bloomberg terminal.
- Space Grotesk (the brand font) created a two-font system with maintenance overhead. Inter at higher weights does the same job with fewer moving parts.

The Warm Slate palette is the visual answer to the brand-product alignment brief: light, warm, calm, slightly worn — the visual equivalent of "slow down."

---

## Decision

Replace the System B colour token set with the Warm Slate palette in `globals.css`.

### Warm Slate Token Set

| Token | Value | Role |
|---|---|---|
| `--bg` | `#F3F0EB` | Primary background — warm off-white, not clinical |
| `--bg-soft` | `#EDE9E1` | Slightly darker surface for input fields, inset areas |
| `--card` | `#FFFFFF` | Card surfaces — clean white lifts off the warm bg |
| `--ink` | `#1A1A1A` | Primary text — near-black, not pure |
| `--ink-2` | `#3D3A36` | Secondary text — warm dark grey |
| `--mute` | `#8A857D` | Muted text — warm medium grey |
| `--mute-2` | `#B5B0A7` | Dimmed / placeholder / disabled text |
| `--line` | `rgba(26,26,26,0.08)` | Standard borders — ink at 8% |
| `--line-strong` | `rgba(26,26,26,0.15)` | Stronger dividers |
| `--moss` | `#6B8E6B` | Primary accent — muted sage green. CTA, active states. Not "healthy" green — disciplined, measured. |
| `--moss-soft` | `rgba(107,142,107,0.1)` | Soft accent bg for badges, highlights |
| `--moss-mid` | `rgba(107,142,107,0.25)` | Mid-weight accent bg |
| `--warn` | `#B8853A` | Warning / coaching — warm amber, not yellow |
| `--warn-bg` | `#F5EBD4` | Warning background |
| `--danger` | `#B84545` | Error / critical states only — never in training UI |
| `--danger-bg` | `rgba(184,69,69,0.1)` | Error background |

### Session Type Colours

Session types use toned-down versions of the System B session colours — same semantic meaning, lower saturation to fit the warm palette.

| Token | Value | Session |
|---|---|---|
| `--s-easy` | `#3D6FB0` | Easy run |
| `--s-long` | `#5E4FB0` | Long run |
| `--s-quality` | `#B8853A` | Quality / tempo |
| `--s-inter` | `#B84545` | Intervals |
| `--s-race` | `#C86A2A` | Race |
| `--s-recov` | `#4E8068` | Recovery |
| `--s-strength` | `#5A6578` | Strength |
| `--s-cross` | `#3D8A88` | Cross-train |

### Typography

- `--font-ui`: `'Inter', sans-serif`
- `--font-brand`: `'Inter', sans-serif` (Space Grotesk retired — Inter at weight 600–700 does the same job)

### Legacy Aliases

Every retired System B token name is aliased to its Warm Slate equivalent in globals.css. This means existing component code that references `--accent`, `--text-primary`, `--card-bg`, `--border-col`, `--amber`, `--teal`, `--session-easy` etc. continues to work without modification during the Phase 2 component-level migration.

---

## Rationale

1. **Single light theme simplifies the CSS surface.** No `[data-theme="dark"]` block to maintain. No theme-aware token values. One set of values, always correct.
2. **Warm Slate aligns with the brand voice.** "Slow down" should feel warm and unhurried, not clinical and sharp. Navy-and-teal is a high-performance colour scheme. Warm Slate is a restrained one.
3. **Moss green (not teal) as the accent.** Moss reads as "considered, patient, in tune with nature." Teal reads as "tech, smart, dashboard." Wrong connotations for this product.
4. **Warning amber shifted warmer.** `#B8853A` (ochre-amber) instead of `#F2C14E` (yellow-amber). More editorial, less "warning sign."
5. **Inter-only removes a font loading decision.** Google Fonts latency for two families added to first-paint. Inter at 600–800 weight handles headings correctly.
6. **Legacy aliases protect Phase 1 stability.** The visual shift ships immediately; component-level updates happen in Phase 2 without a flag day.

---

## Consequences

- **Positive**: Single theme, single CSS block, simpler mental model.
- **Positive**: Brand-aligned visual system — warm, calm, restrained.
- **Positive**: All existing component token references continue working via aliases.
- **Positive**: Google Fonts request reduced from two families to one.
- **Breaking (mitigated)**: Any component that hardcodes System B hex values (e.g. `#0B132B`, `#5BC0BE`) will look wrong. These are bugs — the pre-commit hook catches new instances; Phase 2 cleans existing ones.
- **Deferred**: OG image (`app/api/og/route.tsx`) uses `BRAND.og.*` for hardcoded hex values (CSS vars can't work in `next/og`). These are marked `// DEPRECATED` in `lib/brand.ts` and updated when the OG image is redesigned in Phase 2.
- **Note on Space Grotesk**: Any component using `var(--font-brand)` will now receive Inter instead of Space Grotesk. Since `--font-brand` now aliases Inter, no component code changes are needed. The font difference is subtle at the weights used; no regression expected.

---

## Migration Path

| Phase | Work |
|---|---|
| Phase 1 (this ADR) | globals.css rewritten. Legacy aliases protect existing components. Visual shift lands immediately. |
| Phase 2 | Each redesigned screen uses new semantic tokens (`--ink`, `--moss`, `--bg-soft`) directly, retiring the alias layer progressively. |
| Phase 3 | All remaining screens updated. Legacy alias block removed from globals.css once no component references old names. |
