# ADR-004 — Theme System: data-theme Attribute Toggle Only

**Status**: Superseded by ADR-008 — Single light theme only (2026-04-23)  
**Date**: 2025 (established early in project)

---

## Context

Early implementations of dark/light mode used `element.style.setProperty()` calls to switch CSS custom property values at runtime. This caused theme switching to override the stylesheet cascade, breaking token inheritance and causing some surfaces to show the wrong colour after a theme change.

---

## Decision

Theme switching is done **exclusively** by toggling `data-theme="dark"` on the `<html>` element.

- `applyTheme()` toggles the attribute and does nothing else.
- No `setProperty()` calls for theme colour switching. Ever.
- `globals.css` defines all colour values under both `[data-theme="dark"]` and the default (light) selectors.
- Components reference CSS custom property tokens only — they never set theme colours directly.

---

## Rationale

- The attribute toggle lets the CSS cascade handle everything cleanly. The browser applies `[data-theme="dark"]` selectors from `globals.css` without any JavaScript involvement.
- `setProperty()` creates inline styles that override the cascade at every call site, making it impossible to reason about the theme state.
- A single attribute on `<html>` is auditable in DevTools. Scattered `setProperty()` calls are not.

---

## Consequences

- **Positive**: Theme state is inspectable — check `data-theme` on `<html>` and you know exactly what's active.
- **Positive**: Adding a new colour to the theme requires only a `globals.css` entry — no component changes.
- **Constraint**: All theme-variant colours must be declared in `globals.css` under both default and `[data-theme="dark"]` selectors.
- **Constraint**: `applyTheme()` must never grow additional responsibilities. It toggles an attribute. That's its entire job.
