# Zona Design Audit
**Date**: 2026-04-19  
**Scope**: All component, page, and lib files. Read-only — no changes made.

---

## 1. CSS Custom Properties — `app/globals.css`

Full token definitions as written in the file.

### Brand colours

| Token | Value | Note |
|---|---|---|
| `--zona-navy` | `#0B132B` | Dark bg, CTA text |
| `--zona-teal` | `#5BC0BE` | Aliases `--teal` |
| `--zona-amber` | `#F2C14E` | Aliases `--amber` |
| `--zona-muted` | `#3A506B` | Aliases `--text-secondary` in dark mode |
| `--zona-red` | `#ff7777` | Error state |
| `--strava-orange` | `#FC4C02` | Aliases `--strava` |

### Semantic: accent (primary CTA, active states)

| Token | Value |
|---|---|
| `--accent` | `#5BC0BE` |
| `--accent-soft` | `rgba(91,192,190,0.08)` |
| `--accent-dim` | `rgba(91,192,190,0.15)` |
| `--accent-mid` | `rgba(91,192,190,0.35)` |

### Semantic: teal (completion, success)

| Token | Value |
|---|---|
| `--teal` | `#5BC0BE` |
| `--teal-soft` | `rgba(91,192,190,0.08)` |
| `--teal-dim` | `rgba(91,192,190,0.15)` |
| `--teal-20` | `rgba(91,192,190,0.2)` |
| `--teal-30` | `rgba(91,192,190,0.3)` |
| `--teal-mid` | `rgba(91,192,190,0.35)` |
| `--teal-bg` | `#0d2d2c` |

> Note: `--teal` and `--accent` resolve to the same value (`#5BC0BE`). All their soft/dim/mid variants are also identical. Functionally there is one accent colour — two naming trees exist for semantic distinction (CTA vs completion) but this creates ambiguity.

### Semantic: amber (coaching, warnings)

| Token | Value |
|---|---|
| `--amber` | `#F2C14E` |
| `--accent-amber` | `#F2C14E` — alias |
| `--amber-soft` | `rgba(242,193,78,0.12)` |
| `--amber-mid` | `rgba(242,193,78,0.35)` |

### Semantic: data colours

| Token | Value | Note |
|---|---|---|
| `--blue` | `#5BC0BE` | **Named 'blue' but resolves to teal** — does not match session-easy blue (#4A90D9) |
| `--red` | `#ff7777` | Alias of `--zona-red` |
| `--strava` | `#FC4C02` | |
| `--strava-soft` | `rgba(252,76,2,0.08)` | |

### Session type colours

| Token | Value | Session types |
|---|---|---|
| `--session-easy` | `#4A90D9` | easy, run (default fallback) |
| `--session-long` | `#7B68EE` | long |
| `--session-quality` | `#F2C14E` | quality, tempo |
| `--session-intervals` | `#E05A5A` | intervals, hard |
| `--session-race` | `#E8833A` | race |
| `--session-recovery` | `#5BAD8C` | recovery |
| `--session-strength` | `#3A506B` | strength |
| `--session-cross` | `#5BC0BE` | cross-train, cross |
| `--coral` | `#E05A5A` | RPE 9–10 (alias of `--session-intervals`) |
| `--session-green` | `#5BAD8C` | RPE 1–3 (alias of `--session-recovery`) |

### Typography tokens

| Token | Value |
|---|---|
| `--font-brand` | `'Space Grotesk', sans-serif` |
| `--font-ui` | `'Inter', sans-serif` |
| `--font-data` | `'Inter', sans-serif` — identical to `--font-ui` |

### Border radius tokens

| Token | Value |
|---|---|
| `--radius-sm` | `8px` |
| `--radius-md` | `12px` |
| `--radius-lg` | `16px` |
| `--radius-xl` | `20px` |

> Border radius tokens exist in globals.css but are **not used anywhere** in the codebase. All components hardcode pixel values directly.

### Light mode (`:root`)

| Token | Value |
|---|---|
| `--bg` | `#F7F9FB` |
| `--card-bg` | `#ffffff` |
| `--border-col` | `#E2E8F0` |
| `--text-primary` | `#0B132B` |
| `--text-secondary` | `#3A506B` |
| `--text-muted` | `#94A3B8` |
| `--nav-bg` | `#F7F9FB` |
| `--input-bg` | `#F7F9FB` |

### Dark mode (`[data-theme="dark"]`)

| Token | Light value → Dark value |
|---|---|
| `--bg` | `#F7F9FB` → `#0B132B` |
| `--card-bg` | `#ffffff` → `#162040` |
| `--border-col` | `#E2E8F0` → `#1e2e55` |
| `--text-primary` | `#0B132B` → `#F7F9FB` |
| `--text-secondary` | `#3A506B` → `#94A3B8` |
| `--text-muted` | `#94A3B8` → `#3A506B` |
| `--nav-bg` | `#F7F9FB` → `#0B132B` |
| `--input-bg` | `#F7F9FB` → `#162040` |

> All brand colours, accent variants, session colours, and typography tokens are **unchanged between light and dark mode**. Only surface colours (`bg`, `card-bg`, `border-col`, `nav-bg`, `input-bg`) and text colours flip.

### Legacy aliases in `:root`

| Token | Resolves to |
|---|---|
| `--black` | `#0B132B` |
| `--off-black` | `#0B132B` |
| `--card` | `var(--card-bg)` |
| `--border` | `var(--border-col)` |
| `--orange` | `var(--accent)` |
| `--orange-dim` | `var(--accent-soft)` |
| `--orange-mid` | `var(--accent-mid)` |
| `--orange-bright` | `var(--accent)` |
| `--green` | `var(--teal)` |
| `--text-dim` | `var(--text-muted)` |
| `--text` | `var(--text-primary)` |
| `--muted` | `var(--text-muted)` |
| `--yellow` | `var(--amber)` |

---

## 2. Colour Usage Audit — Hardcoded Values

All hardcoded colour values found across component and page files, by file.

### `app/layout.tsx`

| Line | Value | Context | Issue |
|---|---|---|---|
| 36 | `#0B132B` | `<meta name="theme-color">` | HTML meta attribute — not a CSS context, technically acceptable but deviates from token |

### `app/dashboard/layout.tsx`

| Line | Value | Context | Issue |
|---|---|---|---|
| 3 | `#111` | `var(--bg, #111)` fallback | Fallback value is neither `--zona-navy` nor any defined token. Should be `var(--bg)` with no fallback, or `var(--bg, #0B132B)` |

### `app/dashboard/DashboardClient.tsx`

| Line | Value | Context | Issue |
|---|---|---|---|
| 578 | `rgba(0,0,0,0.2)` | Onboarding overlay button background | Overlay utility value — no token |
| 627 | `rgba(0,0,0,0.12)` | `boxShadow` on slide-up sheet | Shadow utility — no token |
| 931 | `rgba(0,0,0,0.45)` | Modal scrim background | No `--overlay` token defined |
| 1453 | `rgba(80,80,80,0.08)` | "Skipped" status pill background | Mid-grey tint — no token; `--border-col` at opacity would be theme-aware |
| 1473 | `rgba(255,255,255,0.5)` | Metric toggle inner background | Pure white — will break in dark mode (applies white overlay on dark card) |
| 2076 | `rgba(0,0,0,0.5)` / `rgba(0,0,0,0)` | Manual log modal scrim | No `--overlay` token |
| 2506 | `rgba(0,0,0,0.06)` | SessionHero metric toggle background | Near-transparent dark — no token |
| 2566 | `rgba(80,80,80,0.08)` | "Skipped" pill (duplicate of line 1453) | Same issue, duplicated |
| 3556 | `rgba(252,76,2,0.12)` | Strava icon badge background | `252,76,2` = `--strava` / `--strava-orange`. `--strava-soft` exists at `0.08` opacity — inconsistent value |
| 3708 | `rgba(74,154,90,0.4)` | Saved-state border colour | `#4A9A5A` — a green not in the token system at all. No alpha variant of `--session-recovery` exists |
| 3827 | `rgba(74,154,90,0.4)` | Saved-state border colour (duplicate) | Same gap — duplicated |

### `app/dashboard/GeneratePlanScreen.tsx`

| Line | Value | Context | Issue |
|---|---|---|---|
| 790 | `rgba(224,90,90,0.1)` | Delete/destructive button background | `224,90,90` ≈ `--session-intervals` / `--coral` (`#E05A5A`). No soft variant token (`--coral-soft`) exists |

### `components/strava/StravaPanel.tsx`

| Line | Value | Context | Issue |
|---|---|---|---|
| 176 | `rgba(0,0,0,0.6)` | Activity popup modal scrim | No `--overlay` token |

### `app/auth/login/page.tsx`

No hardcoded colour values. ✓ Clean.

### `components/training/PlanCalendar.tsx`

No hardcoded hex or rgb values. ✓

> **However**: line 394 uses `` `${accent}22` `` — appending a hex alpha suffix to a CSS variable string. This is **invalid CSS** and will silently produce no background colour. `var(--session-easy)22` is not parseable. This should use `color-mix(in srgb, ${accent} 13%, transparent)`.

### `components/training/PlanChart.tsx`

No hardcoded colour values. ✓ Clean.

### `app/dashboard/CalendarOverlay.tsx`

No hardcoded colour values. ✓ Clean.

---

## 3. Component Inventory — Tokens vs Hardcoded

| File | Size | CSS Tokens | Hardcoded Colours | Font via Token | Font Hardcoded | Status |
|---|---|---|---|---|---|---|
| `app/globals.css` | 164L | Source of truth | N/A | N/A | N/A | ✓ |
| `app/layout.tsx` | 47L | — | 1 (`#0B132B` in meta) | — | — | Minor |
| `app/dashboard/layout.tsx` | 9L | `var(--bg)` | 1 (`#111` fallback) | — | — | Minor |
| `app/page.tsx` | 5L | — | None | — | — | ✓ |
| `app/dashboard/page.tsx` | 4L | — | None | — | — | ✓ |
| `app/auth/login/page.tsx` | 209L | All via token | None | `var(--font-brand)`, `var(--font-ui)` | None | ✓ Best practice |
| `app/dashboard/CalendarOverlay.tsx` | 263L | All via token | None | Hardcoded strings | None | Font issue only |
| `app/dashboard/DashboardClient.tsx` | 4362L | Mostly | 11 instances | `var(--font-ui)` × 3 | 228 hardcoded | ⚠ Font/colour issues |
| `app/dashboard/GeneratePlanScreen.tsx` | 925L | Mostly | 1 instance | Hardcoded strings | Many | ⚠ Font issue |
| `components/training/PlanCalendar.tsx` | 444L | All via token | None (1 invalid `22` suffix) | `var(--font-ui)`, `var(--font-brand)` | None | ✓ Best practice (1 CSS bug) |
| `components/training/PlanChart.tsx` | 97L | All via token | None | Hardcoded strings | 2 | Font issue only |
| `components/strava/StravaPanel.tsx` | 229L | Mostly | 1 overlay rgba | Hardcoded strings | Many | Minor |
| `lib/session-types.ts` | 48L | All via `var()` | None | — | — | ✓ |

---

## 4. Font Usage

### Token usage (correct)

The following files use `var(--font-ui)` and/or `var(--font-brand)` as the font specification:

- `app/auth/login/page.tsx` — all font references use tokens ✓
- `components/training/PlanCalendar.tsx` — all font references use tokens ✓
- `app/dashboard/DashboardClient.tsx` — 3 occurrences of `var(--font-ui)` in the nav bar; all others hardcoded

### Hardcoded font strings by file

**`app/dashboard/DashboardClient.tsx`**

| Value | Occurrences | Issue |
|---|---|---|
| `'Inter', sans-serif` | ~189 | Should be `var(--font-ui)` |
| `'Space Grotesk', sans-serif` | ~32 | Should be `var(--font-brand)` |
| `'Inter', monospace` | **7** | **Wrong fallback stack** — `monospace` is not a valid fallback for Inter. Should be `var(--font-ui)` or `'Inter', sans-serif` |

> The `'Inter', monospace` occurrences are in the onboarding/orientation screen copy. `monospace` as a fallback means if Inter fails to load, text renders in the system monospace font — a significant visual regression. This appears to be a copy-paste error.

**`app/dashboard/GeneratePlanScreen.tsx`**

| Value | Occurrences |
|---|---|
| `'Inter', sans-serif` | Many |
| `'Space Grotesk', sans-serif` | Many |

**`app/dashboard/CalendarOverlay.tsx`**

| Value | Occurrences |
|---|---|
| `'Inter', sans-serif` | Many |
| `'Space Grotesk',sans-serif` | 1 (missing space after comma — inconsistent formatting) |

**`components/strava/StravaPanel.tsx`**

| Value | Occurrences |
|---|---|
| `'Inter', sans-serif` | Many |
| `'Space Grotesk', sans-serif` | 3 |

**`components/training/PlanChart.tsx`**

| Value | Occurrences |
|---|---|
| `'Inter', sans-serif` | 2 |

### Font loading

Fonts are loaded in two places:

1. `app/globals.css` line 1: `Space Grotesk` (weights 300–600) + `Inter` (weights 300–600)
2. `app/layout.tsx` lines 40–42: `Space Grotesk` (weights 400, 500) + `Inter` (weights 400, 500)

> **Duplicate font loading** — two separate Google Fonts requests for the same two fonts. The `globals.css` version loads a superset (300–600) while `layout.tsx` loads a subset (400, 500). Both load on every page. The `layout.tsx` load is the one that matters for SSR/preloading; the `globals.css` one is redundant and adds a network request.

---

## 5. Session Type Colours

### `lib/session-types.ts` — Current mapping

| Session type(s) | Token | Resolved value |
|---|---|---|
| `easy`, fallback for unknown | `var(--session-easy)` | `#4A90D9` — blue |
| `run` | `var(--session-long)` | `#7B68EE` — purple |
| `long` | `var(--session-long)` | `#7B68EE` — purple |
| `quality`, `tempo` | `var(--session-quality)` | `#F2C14E` — amber |
| `intervals`, `hard` | `var(--session-intervals)` | `#E05A5A` — coral red |
| `race` | `var(--session-race)` | `#E8833A` — orange |
| `recovery` | `var(--session-recovery)` | `#5BAD8C` — green |
| `strength` | `var(--session-strength)` | `#3A506B` — navy/muted |
| `cross-train`, `cross` | `var(--session-cross)` | `#5BC0BE` — teal |
| `rest` | `transparent` | No colour |

### Discrepancies and notes

1. **`run` maps to `--session-long` (purple)**, not `--session-easy` (blue). The `run` type was likely intended for general runs but is coloured as long runs. This may be intentional (all non-typed runs are treated as long run weight) but is semantically confusing.

2. **`--session-easy` is the default fallback** for unknown session types via `getSessionColor()`. This means any future unrecognised type silently inherits easy-run blue.

3. **`--coral` and `--session-green`** are separate tokens defined in globals.css that alias `--session-intervals` and `--session-recovery` respectively. Used in RPE colouring (`rpeColour()`) but not in the `SESSION_COLORS` map.

4. **`--session-strength` resolves to `#3A506B`** which is the same value as `--zona-muted` and `--text-secondary` in light mode. Strength session rows are therefore visually similar to muted text — low contrast.

5. **No `--session-easy` soft/alpha variant** defined in globals.css. `--session-intervals`, `--session-quality`, etc. also have no soft variants. Only `--teal`, `--accent`, `--amber`, `--strava` have alpha variants. Components needing session-colour soft tints use `color-mix()` inline.

### CLAUDE.md vs actual mapping

CLAUDE.md documents the session type colour map as:

| Type | Colour | Hex |
|---|---|---|
| easy | Blue | `#4A90D9` |
| long | Purple | `#7B68EE` |
| quality/tempo | Amber | `#F2C14E` |
| intervals | Coral | `#E05A5A` |
| race | Orange | `#E8833A` |
| recovery | Green | `#5BAD8C` |
| strength | Navy | `#3A506B` |
| cross-train | Teal | `#5BC0BE` |
| rest | — | No accent |

The actual token values in `globals.css` match this table exactly. `lib/session-types.ts` maps all types to the correct tokens. ✓

---

## 6. Dark/Light Mode Structure

### Mechanism

Theme is applied by setting `data-theme="dark"` on `<html>`. The CSS selector `[data-theme="dark"]` overrides the `:root` surface tokens. Brand colours, session colours, and typography tokens do not change between modes.

### Initialisation (inline script in `app/layout.tsx`)

```js
(function() {
  try {
    var t = localStorage.getItem('rts_theme') || 'light';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = t === 'dark' || (t === 'auto' && prefersDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } catch(e) {}
})();
```

This runs synchronously before render to prevent flash. It reads `rts_theme` from localStorage with three states: `'dark'`, `'light'`, `'auto'`. Auto follows system preference.

### applyTheme() pattern (runtime toggle)

Per CLAUDE.md and ADR-004: `applyTheme()` toggles `data-theme="dark"` on `<html>` only. `setProperty()` calls are banned — the cascade handles everything.

### Login page special case

`app/auth/login/page.tsx` sets `data-theme="dark"` directly on its root `<div>`:

```tsx
<div data-theme="dark" style={{ minHeight: '100dvh', ... }}>
```

This pins the login screen to dark mode regardless of user preference. The CSS `[data-theme="dark"]` selector scopes to this div, overriding any parent `data-theme`. This is intentional (brand-forward dark login) but means the login screen ignores user theme preference.

### What does and does not change between modes

**Changes (surface tokens)**:
- Page background (`--bg`)
- Card backgrounds (`--card-bg`)
- Border colour (`--border-col`)
- Nav background (`--nav-bg`)
- Input background (`--input-bg`)
- Text colours (`--text-primary`, `--text-secondary`, `--text-muted`)

**Does not change (brand + session tokens)**:
- All `--zona-*`, `--accent`, `--teal`, `--amber`
- All `--session-*` colour tokens
- All `--font-*` tokens
- `--strava`, `--strava-soft`
- `--coral`, `--session-green`
- All `--radius-*` tokens

### Dark mode colour gaps

1. **`rgba(255,255,255,0.5)` in DashboardClient line 1473** — This pure-white semi-transparent overlay is applied as a metric toggle background. In dark mode (card-bg = `#162040`), this creates a pale glowing overlay on a dark surface, which is visually inconsistent with the rest of the UI. Should use a theme-aware token.

2. **`rgba(0,0,0,0.06)` in DashboardClient line 2506** — Near-transparent dark overlay for a toggle. In dark mode this darkens an already-dark surface, achieving near-zero visible contrast. Should invert or use a theme-aware semi-transparent value.

3. **`rgba(80,80,80,0.08)` for "Skipped" pills** — Mid-grey at low opacity. Renders acceptably in both modes but is not theme-aware.

---

## 7. Summary of Issues

### Critical (silent bugs or visible regressions)

| # | File | Issue |
|---|---|---|
| C-01 | `components/training/PlanCalendar.tsx` L394 | `` `${accent}22` `` — invalid CSS (hex alpha suffix on a CSS variable string). Session type background tint **does not render**. |
| C-02 | `app/dashboard/DashboardClient.tsx` L1473 | `rgba(255,255,255,0.5)` as toggle background — will appear as a white flash in dark mode |

### Token gaps (values with no token)

| # | Value | Used for | Suggested token |
|---|---|---|---|
| G-01 | `rgba(74,154,90,0.4)` | Saved-state border (2 locations, DashboardClient) | `--session-recovery` at alpha, or new `--status-saved-border` |
| G-02 | `rgba(224,90,90,0.1)` | Destructive button bg (GeneratePlanScreen) | `--coral-soft` (coral = session-intervals) |
| G-03 | `rgba(0,0,0,0.X)` overlays | Modal scrims (4 different opacity values across 3 files) | `--overlay-light`, `--overlay-heavy` |

### Inconsistencies

| # | Issue |
|---|---|
| I-01 | `--teal` and `--accent` are identical values with duplicate alpha variant trees. Semantic intent exists but creates ambiguity in usage |
| I-02 | `--blue` token resolves to teal (`#5BC0BE`), not the blue used for easy runs (`#4A90D9`). `CalendarOverlay.tsx` uses `var(--blue)` in the legend for "Easy" — wrong colour |
| I-03 | `rgba(252,76,2,0.12)` used in DashboardClient — `--strava-soft` is defined at `0.08`. Inconsistent opacity |
| I-04 | Fonts loaded twice — `globals.css` (weights 300–600) and `layout.tsx` (weights 400–500) both issue Google Fonts requests |
| I-05 | `--radius-sm/md/lg/xl` tokens defined but unused. All components hardcode pixel radius values |
| I-06 | `--font-data` is identical to `--font-ui` — redundant token |
| I-07 | `run` session type maps to `--session-long` (purple) not `--session-easy` (blue) — naming vs behaviour mismatch |

### Font issues

| # | File | Issue |
|---|---|---|
| F-01 | `DashboardClient.tsx` L477, L513, L522, L525, L535, L574, L579 | `'Inter', monospace` — incorrect fallback stack. Monospace fallback will render in system monospace if Inter fails |
| F-02 | All files except `login/page.tsx` and `PlanCalendar.tsx` | Font families hardcoded as strings rather than `var(--font-ui)` / `var(--font-brand)` — ~230 occurrences in DashboardClient alone |
| F-03 | `CalendarOverlay.tsx` L193 | `'Space Grotesk',sans-serif` — missing space after comma (style inconsistency) |
| F-04 | `app/globals.css` + `app/layout.tsx` | Duplicate Google Fonts load |

### What is working well

- `lib/session-types.ts` — clean, canonical, all CSS variables, no hardcoded colours ✓
- `components/training/PlanCalendar.tsx` — font tokens used correctly throughout ✓
- `app/auth/login/page.tsx` — font tokens used correctly, no hardcoded colours ✓
- `components/training/PlanChart.tsx` — no hardcoded colours ✓
- `app/dashboard/CalendarOverlay.tsx` — no hardcoded colours ✓
- Dark/light mode cascade architecture is correct and clean ✓
- Session colour map in `globals.css` matches `CLAUDE.md` specification exactly ✓
- Pre-commit hook exists to catch hardcoded hex and banned fonts at commit time ✓

---

## 8. R23 Remediation Status (2026-04-21)

Items surfaced in the R23 Phase 0 audit and their resolution status.

### Blockers being fixed in R23

| ID | File | Violation | Resolution |
|---|---|---|---|
| A-1 | `GeneratePlanScreen.tsx` L160 | `var(--red)` in ConfidenceBadge (score < 5) | Phase 5 — replace with `var(--amber)` |
| A-1 | `GeneratePlanScreen.tsx` L521–524 | `var(--red)` in error card border + text | Phase 3/5 — replace with `var(--amber)` |
| A-1 | `GeneratePlanScreen.tsx` L789–792 | `var(--red)` + `rgba(224,90,90,0.1)` in days-off button active state | Phase 3 — `var(--navy)` bg + `var(--teal)` border |
| A-2 | `GeneratePlanScreen.tsx` L481–488 | Spinner (`genSpin` rotation animation) | Phase 4 — replaced by `GeneratingCeremony.tsx` |
| A-5 | `app/api/generate-plan/route.ts` L475–477 | 403 Subscription required for free users | Phase 5 — route through `lib/plan/generate.ts` |

### Fix-during-R23

| ID | File | Violation | Resolution |
|---|---|---|---|
| A-3 | `GeneratePlanScreen.tsx` (many) | Hardcoded `'Inter', sans-serif` / `'Space Grotesk', sans-serif` | Phase 3/4/5 — replace with `var(--font-ui)` / `var(--font-brand)` as each section is rewritten |
| A-5 | `GeneratePlanScreen.tsx` error screen | "Try again" routes to `setAppStep(4)` — will skip free users | Phase 3 — route to Step 3 for free, Step 4 for paid/trial |

### Token gaps to address in future

| ID | Gap | Suggested fix |
|---|---|---|
| G-02 | `rgba(224,90,90,0.1)` — no `--coral-soft` token | Add `--coral-soft: rgba(224,90,90,0.10)` to `globals.css`, or use `color-mix()` |
| G-03 | `rgba(0,0,0,0.X)` modal scrims — 4 different opacities | Add `--overlay-light: rgba(0,0,0,0.45)` and `--overlay-scrim: rgba(0,0,0,0.5)` |

---

## 9. Token validity reference

| Token | Valid | Notes |
|---|---|---|
| `var(--font-ui)` | ✓ | = `'Inter', sans-serif` |
| `var(--font-brand)` | ✓ | = `'Space Grotesk', sans-serif` |
| `var(--font-display)` | ✗ | **Does not exist.** This is a typo for `var(--font-brand)`. |
| `var(--red)` | Exists but banned from UI states | Use `var(--amber)` for warnings, never red |
| `var(--font-data)` | Exists but redundant | Identical to `--font-ui` — prefer `--font-ui` |

### SLC-blocker pattern list (auto-fail)

Any of the following found in a new component or PR is an automatic SLC blocker:

1. Any rotating spinner or progress percentage as a loading state
2. Any use of `var(--red)` or red-adjacent colour in a UI state
3. Any hardcoded `fontFamily` string (must be `var(--font-ui)` or `var(--font-brand)`)
4. Any popup, modal, or overlay that is not a full-screen navigation
5. Any `setProperty()` call inside theme logic
6. Any reference to `var(--font-display)` (non-existent token)
