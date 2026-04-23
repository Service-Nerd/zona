# ADR-008 — Single Light Theme Only

**Status**: Accepted  
**Date**: 2026-04-23  
**Supersedes**: ADR-004 (theme system)

---

## Context

ADR-004 established `applyTheme()` as the mechanism for toggling between light, dark, and auto themes via a `data-theme="dark"` attribute on `<html>`. Users could switch themes in the Me screen; the preference was stored in `localStorage` as `rts_theme`.

This worked. But maintaining two complete visual states (light + dark) for every screen, every component, and every redesign iteration doubles the visual QA surface. For a solo developer shipping a redesign under a hard May 10 deadline, that cost is real.

More importantly: the brand positioning resolved in `docs/alignment/brand-product-alignment.md` anchors Zona aesthetically in the Warm Slate palette — warm, analogue, unhurried. Warm Slate is a light theme. Forcing a dark-mode equivalent of `#F3F0EB` and `#6B8E6B` produces something that neither fits the palette nor has been designed. It would be guesswork at scale.

Dark mode is not a user need that has been expressed in feedback. It was an assumption. This ADR retires that assumption.

---

## Decision

Zona runs on a single light theme. Dark mode is removed.

### Implementation

1. **`app/globals.css`**: `[data-theme="dark"]` selector block removed entirely. No dark token overrides. The `:root` block is the only theme declaration.
2. **`applyTheme()` function**: Body replaced with `// Theme system retired — single light theme only (see ADR-008)`. Function left as a no-op; call sites not modified to avoid missed-reference errors.
3. **`saveTheme()` function**: Commented out for one release. Will be deleted in Phase 2 cleanup.
4. **`rts_theme` localStorage key**: Reads and writes marked `// DEPRECATED — rts_theme no longer used (see ADR-008)`. The key is not deleted from storage (harmless) — just ignored.
5. **Theme toggle UI (Me screen)**: The Dark / Light / Auto toggle commented out with `{/* Theme toggle removed per ADR-008 — single light theme only */}`. Component code left in place for one release rollback window.
6. **`app/layout.tsx` theme initialisation script**: Replaced with `// Theme initialisation retired — see ADR-008`. The inline `<script>` that previously set `data-theme` on `<html>` is removed.

### What stays

- The `data-theme` attribute mechanism itself is not conceptually broken. If dark mode is reintroduced in a future release, the same `setAttribute` approach from ADR-004 remains valid.
- `applyTheme()` is left as a declared no-op (not deleted) to prevent TypeScript errors at call sites. Call sites will be cleaned in Phase 2.

---

## Rationale

1. **One theme = one visual QA path.** Every screen redesigned in Phase 2 and 3 needs to look correct in exactly one state. This halves the visual regression surface.
2. **Warm Slate is a light palette by definition.** There is no designed dark mode for Warm Slate. Shipping a speculative dark mode would mean shipping untested, undesigned surfaces.
3. **No user-expressed demand.** No feedback, no support request, no review mentions dark mode as a need. It was added by developer preference, not user need.
4. **The brand call is consistent.** Light, warm, calm, unhurried. Dark athletic dashboards are Runna's space. Zona's space is restraint — which is easier to achieve with a warm light surface.
5. **Reversible.** If dark mode proves to be a real user need post-launch, it can be reintroduced via a `[data-theme="dark"]` block in globals.css and a preference toggle in settings. Nothing structural is lost.

---

## Consequences

- **Positive**: Visual QA surface halved for the entire Phase 2–3 redesign.
- **Positive**: globals.css simplified — no conditional token blocks.
- **Positive**: `applyTheme()` and related machinery becomes dead code that can be removed cleanly in Phase 2.
- **User-visible**: Any user who previously selected Dark or Auto theme will see the light theme on next load. `rts_theme` localStorage key is ignored. No data is deleted.
- **Rollback path**: Re-add `[data-theme="dark"]` block to globals.css; un-comment `saveTheme()` and toggle UI; restore `applyTheme()` body. Estimated: 30 minutes.
