# Contract — SessionSteps Component

**Authority**: This document defines the prop interface and rendering contract for the session-detail structure block (ui-patterns.md §21b "Session steps"). Any change to props or the card hierarchy must update this document in the same commit.

**Component:** `components/shared/SessionSteps.tsx`

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
  sessionDistanceKm?: number          // added to this contract 2026-09-18: it was on the component and not here
  easyPaceStr?: string | null         // Strava-derived easy band for warm-up/cool-down; null → zone only
  onInfo?: () => void                 // opens the zone-education sheet from the main-set ⓘ
}
```

`Zone` is `1 | 2 | 3 | 4 | 5` from `components/shared/ZoneBar.tsx`. `SessionStructure` is from `lib/plan/sessionComposer.ts`; `DerivedSet` from `lib/plan/resolveMainSet.ts`.

---

## Rendering contract

- **One card per phase** — Warm-up, Main set, Cool-down. Each is `--card` / `1px --line` / `12px` radius. (Race / rest / strength shapes render nothing — the caller skips them.)
- **`shape: 'time_trial'` is the one shape whose parts do NOT partition the total** (TT-STRUCTURE-01, 2026-09-17). §78's benchmark sets `distance_km` to the TRIAL, and `ruleEngine` places the warm-up and cool-down OUTSIDE it deliberately — the trial alone is what the plan counts (`sumWeeklyKm`, §1, §52). So the main set renders the trial **exactly, with no `~`** (every other figure on this card is an estimate; this one is the prescription), while the bookends stay in **minutes** because *"cool down easy"* carries no number and inventing one breaks `zone-rules.md`. **Consumers must not assume warm-up + main + cool-down sums to the session distance on this shape.** SESSION-RECONCILE-01's partition assertion is scoped out for it with the reasoning, and replaced by a stricter contract (`TT-STRUCTURE-01`) that also asserts the card's warm-up minutes equal the number the coach note promises. ⚠️ Founder-reported: without this branch a 5 km time trial rendered as *"warm-up ~3km · main set ~2km · cool-down ~0km"*.
- **Tinted header, never flooded** — `color-mix()` of a token accent over `--card` (ADR-007). Accent: warm-up `--moss`; main set `--s-inter` when the peak display zone ≥ 5 else `--s-quality`; cool-down `--s-strength`. No hardcoded hex (pre-commit rule).
- **Main-set zone** — `zoneRangeLabel`, derived from `session.zone` (§84), NOT the session type. Single zone or a range.
- **Numbered steps + connector** — first row of each repeat block carries the step number; later rows in the block are blank. Warm-up run, strides, and cool-down each get their own number.
- **Step row** — work/recovery dot (work = main accent, recovery = hollow), plain-language role, then a right-stacked amount (primary metric) over detail (`duration · pace` / `RPE n` / `≤ band`).
- **Metric** — distance leads when `metric === 'distance'`; a duration-native rep with a pace shows an estimated distance (marked `~`) with the duration in the detail; a rep with no pace keeps time primary (ADR-015; §84 honesty).
- **Race-pace segment row** — rendered only when `structure.race_pace_segment` is present, i.e. `shape === 'long_run_with_mp'`. That shape is produced for the **§25 race-specific long run** (HM and marathon, time-targeted, peak, non-deload) and is gated on the catalogue row declaring `main_set_structure.type === 'long_run_with_segment'` — **never on the session's label** (ADR-018 / D-17; a label substring reached marathon only, and HM rendered nothing on 18 of 18 measured sessions). The row's amount is `duration_pct`, sourced from the row's `race_pace_pct` (HM 35, MARATHON 40) inside §25's ratified 25–40% band, and the detail names the row's `race_pace_zone` ("HM target" / "MP target"), never a hardcoded distance. **It must state the same number as the session's coach note**, which is derived from the same field — they disagreed on every such card until 2026-09-14.
- **Fallback** — when `derivedSet` is absent or not v2, the main set renders a single row from `structure.main.description`.
- **Provenance** — all rule-engine output; **no `<AIMark />`** (ui-patterns.md Pattern 16).

## Data owners

- Display model: `buildStepGroups()` in `lib/plan/sessionSteps.ts` (pure, tested).
- One-line string (notifications / calendar / fallback): `describeDerivedSet()` in `lib/plan/resolveMainSet.ts`.
- Zone parsing + live HR band: `zonesFromZoneString` / `hrBandForZoneString` in `lib/coaching/zoneRules.ts`.

Reference: `components/shared/SessionSteps.tsx`. Integration: `DashboardClient.tsx → SessionPopupInner`.

## Punctuation (BRAND-EMDASH-APP-01, 2026-09-22)

The zone hint reads `{name} · tap to learn`. ⚠️ **It was `{name} — tap to learn`.** The
founder's rule is no em dash in a sentence; a label separator is not a sentence, so it takes
the **middot** the app already uses (`{raceName} · {date}`) rather than a colon. Guarded by
`lib/marketing/noEmDashApp.test.ts`.
