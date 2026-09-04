# Contract — SessionSteps Component

**Authority**: This document defines the prop interface and rendering contract for the session-detail structure block (ui-patterns.md §21b "Session steps"). Any change to props or the card hierarchy must update this document in the same commit.

Introduced: SESSION-STRUCTURE-REDESIGN, 2026-09-04.

---

## Prop Interface

```typescript
interface SessionStepsProps {
  structure: SessionStructure        // composeSession() result — the phases + totals
  derivedSet?: DerivedSet | null      // session.derived_set (ADR-019); main set renders as steps when present
  sessionType: string
  displayZones: Zone[]                // §84 — main-set zones from displayZonesForSession(session)
  zoneRangeLabel: string              // e.g. "Zone 4–5" — the range label the main header shows
  metric: 'distance' | 'duration'     // the resolved per-session metric (toggle)
  preferredUnits: 'km' | 'mi'
  easyPaceStr?: string | null         // Strava-derived easy band for warm-up/cool-down; null → zone only
  onInfo?: () => void                 // opens the zone-education sheet from the main-set ⓘ
}
```

`Zone` is `1 | 2 | 3 | 4 | 5` from `components/shared/ZoneBar.tsx`. `SessionStructure` is from `lib/plan/sessionComposer.ts`; `DerivedSet` from `lib/plan/resolveMainSet.ts`.

---

## Rendering contract

- **One card per phase** — Warm-up, Main set, Cool-down. Each is `--card` / `1px --line` / `12px` radius. (Race / rest / strength shapes render nothing — the caller skips them.)
- **Tinted header, never flooded** — `color-mix()` of a token accent over `--card` (ADR-007). Accent: warm-up `--moss`; main set `--s-inter` when the peak display zone ≥ 5 else `--s-quality`; cool-down `--s-strength`. No hardcoded hex (pre-commit rule).
- **Main-set zone** — `zoneRangeLabel`, derived from `session.zone` (§84), NOT the session type. Single zone or a range.
- **Numbered steps + connector** — first row of each repeat block carries the step number; later rows in the block are blank. Warm-up run, strides, and cool-down each get their own number.
- **Step row** — work/recovery dot (work = main accent, recovery = hollow), plain-language role, then a right-stacked amount (primary metric) over detail (`duration · pace` / `RPE n` / `≤ band`).
- **Metric** — distance leads when `metric === 'distance'`; a duration-native rep with a pace shows an estimated distance (marked `~`) with the duration in the detail; a rep with no pace keeps time primary (ADR-015; §84 honesty).
- **Fallback** — when `derivedSet` is absent or not v2, the main set renders a single row from `structure.main.description`.
- **Provenance** — all rule-engine output; **no `<AIMark />`** (ui-patterns.md Pattern 16).

## Data owners

- Display model: `buildStepGroups()` in `lib/plan/sessionSteps.ts` (pure, tested).
- One-line string (notifications / calendar / fallback): `describeDerivedSet()` in `lib/plan/resolveMainSet.ts`.
- Zone parsing + live HR band: `zonesFromZoneString` / `hrBandForZoneString` in `lib/coaching/zoneRules.ts`.

Reference: `components/shared/SessionSteps.tsx`. Integration: `DashboardClient.tsx → SessionPopupInner`.
