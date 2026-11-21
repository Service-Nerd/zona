# `SessionPopupInner` — contract

**Component:** `components/dashboard/SessionPopupInner.tsx`

The session sheet's whole body: read a prescribed session, log it, skip it, link a run to it,
reflect on it. **The largest component in the tree at ~2,000 lines.** 4 importers.

⚠️ **Written 2026-11-15 (`CONTRACT-COVERAGE-03`, highest reach first).**

## Prop interface

```typescript
interface SessionPopupInnerProps {
  session: any
  weekN: number
  aiNotes: boolean
  preloadedRuns: any[]
  onClose: () => void
  onSaved?: () => void
  preferredUnits: 'km' | 'mi'
  zone2Ceiling: number | null
  preferredMetric?: 'distance' | 'duration'
  onSessionMetricChange?: (weekN: number, sessionKey: string, metric: 'distance' | 'duration' | null) => void
  savedMetricOverride?: 'distance' | 'duration' | null
  restingHR?: number | null
  maxHR?: number | null
  aerobicPace?: string | null
  stravaLoading?: boolean
  hasPaidAccess?: boolean
  onUpgrade?: () => void
  goalPace?: string | null
  guidance?: any | null
  onLinkedComplete?: (data: PostRunData) => void
  autoMatch?: { activity: any; confidence: 'high' | 'medium' } | null
  runAnalysis?: { hr_above_ceiling_pct?: number | null } | null
}
```

⚠️ Declared inline; the name above is the contract's, for the prop-for-prop gate.

🔻 **FOUR PROPS ARE `any` (`session`, `preloadedRuns`, `guidance`, and `autoMatch.activity`), AND
THAT IS DEBT RATHER THAN A DECISION.** `DASHBOARD-SCREEN-EXTRACT-04` lifted this file verbatim
out of `DashboardClient.tsx` — the last of fourteen — so the types came across as they were, and
the file imports `Session` and `StravaActivity` while the two props that most need them are
`any`. 📐 **Writing this contract also found `Plan` and `Week` imported and never used** — their
only other occurrences in the file were inside prose comments — **removed in the same commit.**
Narrowing the four `any`s is behaviour-free but is a separate change; it is recorded here so the
next reader knows it is debt and not a seam that needs the looseness.

## The view machine

`view: 'detail' | 'complete' | 'skip' | 'success' | 'reflect' | 'skip-reflect'`, local state,
starting at `detail`. ⚠️ **`reflect` and `skip-reflect` are different views, not one view with a
flag** — what the runner is asked after a completed session is not what they are asked after a
skipped one.

## Invariants

1. 🔴 **`aiNotes` IS RESOLVED BY THE CALLER AND MUST NEVER BE RE-DERIVED HERE**
   (`AI-PROVENANCE-01`). It answers *"did a MODEL write this session's coach notes?"*, resolved
   by `sessionNotesAreAiAuthored` where the plan is in scope. ⚠️ **And it must never be inferred
   from whether the notes array is non-empty** — the rule engine writes `coach_notes` too, which
   is the exact defect this prop replaced. An `<AIMark />` on rule-engine copy is a false
   provenance claim (CLAUDE.md § UI Principles).
2. 🔴 **`runAnalysis` ABSENT RESOLVES TO `unknown`, NEVER TO `held`** (P-01). `null` is the honest
   majority case — no HR, or a free-tier runner without `activity_intelligence` — and the
   completion pill must say so rather than claim the runner held the zone.
3. **`onLinkedComplete` REPLACES the reflect view, it does not precede it.** When a
   Strava-linked completion is confirmed, the popup closes and routes to `PostRunScreen`, where
   the *"Read of your run"* and the RPE/fatigue collection happen (`POST-RUN-01`). Two reflection
   surfaces exist and `ReflectionInput` is shared between them — **if you change one path, check
   the other** (CLAUDE.md § Post-run Reframe).
4. ⚠️ **`autoMatch` CARRIES TWO CONFIDENCE TIERS AND THE FRAMING IS THE DESIGN**
   (`AUTO-MATCH-02`): `high` (≥70) gets *"Log this run"* as a filled-moss CTA and treats the tap
   as confirmation; `medium` (≥40) gets *"Looks like this one?"* as an outline CTA — same
   handler, but the question framing and softer styling set expectations. `low` candidates are
   deliberately **not passed through**; they are too noisy. `null` when there is no match.
5. ⚠️ **THE MATCH IS COMPUTED BY THE PARENT, NOT HERE.** `rankLinkCandidates` and `isInLinkPool`
   are read for the picker list, but the CTA's match comes in as a prop — the parent already ran
   it, and running it twice is two answers to one question.
6. **The per-session metric override is DB-backed, not localStorage** (ADR-015).
   `savedMetricOverride` seeds the toggle, `onSessionMetricChange` persists it, and `null` means
   *no override* — the plan default or the global preference, which is not the same as `distance`.
7. **`preferredUnits`, `restingHR`, `maxHR`, `zone2Ceiling` and `aerobicPace` are props, not
   hooks** — fetched once at `DashboardClient` level (CLAUDE.md § Global State Pattern). This
   component must not fetch settings.
8. 🔴 **EVERY DISPLAY STRING COMES FROM `lib/format.ts`** — `formatDistance`, `formatDate`,
   `convertDistanceString`, `convertPaceString`, `resolveSessionMetric`. ADR-015 makes that file
   the sole owner, and this file is the largest display surface in the app, so a local
   `.toFixed(1)` here is the highest-reach version of that defect.
9. **Session colour resolves through `getSessionColor(session)`**, passing the whole session —
   never `SESSION_COLORS[session.type]`, which cannot produce `--s-long` for an engine-generated
   plan (`PLAN-LONGRUN-COLOUR-01`).
10. ⚠️ **IT RENDERS `TodayScreen` AND `ManualRunModal`, SO THE IMPORT GRAPH IS CYCLIC-ADJACENT.**
    Both are imported at module scope; `TodayScreen` also reaches this component. Keep any new
    cross-import at module scope rather than dynamic, so the cycle stays visible to the bundler
    rather than resolving differently at runtime.
11. **`hasPaidAccess` gates RICHNESS, never ACCESS** — the session card, the log action and the
    prescription render for everyone; the RPE read and the analysis are the paid additions, and
    `onUpgrade` renders only when `!hasPaidAccess` (CLAUDE.md § Free Users Are Never Abandoned).
12. **No hardcoded colour and no hardcoded font.** `hueText` and the session tokens own every
    accent.

## Pattern

`ui-patterns.md` § session-detail + Sheet. Rulings: `POST-RUN-01`/`-02`, `AUTO-MATCH-02`,
`AI-PROVENANCE-01`, `P-01`, `DASHBOARD-SCREEN-EXTRACT-04`.

## The fatigue row is not this component's (`FATIGUE-CHIP-DUPLICATE-01`, 2026-11-16)

Both reflect views render `<FatigueChips />` (`components/shared/FatigueChips.tsx`); neither holds a
colour scale, a pill geometry or a caption of its own. **This component used to carry TWO hand-rolled
copies of that row, and they disagreed with each other** — one had `Fine → --moss`, the other
rendered **Fresh and Fine in the same token** and painted Wrecked in `--danger`, which the design
system forbids in the training UI. One of them also hand-typed an `11px / uppercase / 0.08em`
caption reading *"Body feeling"* where every other surface said *"Body state"*.

⚠️ **The caller owns the side effects, never the control.** `onChange` emits the tag (or `null` when
the runner clears it); saving, the reflect response and the adjustment call stay here. Contract:
`docs/contracts/components/fatigue-chips.md`.
