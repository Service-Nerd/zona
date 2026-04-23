# Phase 2 — Autonomous Decisions Log

**Branch**: `redesign/phase-2-today-session-plan`
**Started**: 2026-04-23

---

## D-001 — `--coach-ink` token for CoachNoteBlock
**Decision**: Add `--coach-ink: #3D2600` to `globals.css` as a named token.
**Why**: The warm dark brown used inside CoachNoteBlock is semantically distinct — it's the "coach voice" colour against `--warn-bg`. It can't alias to `--ink` (too cold) or `--mute` (too faint). Named token makes it auditable.
**Applied to**: `globals.css`, `CoachNoteBlock.tsx`

## D-002 — `components/shared/` directory
**Decision**: Create `components/shared/` as the home for all new Phase 2 components.
**Why**: Existing structure has `components/training/` (chart/calendar) and `components/strava/`. Shared UI primitives need their own namespace. Using `shared/` not `ui/` to stay consistent with the instruction brief.

## D-003 — SessionCard as new standalone component (not editing DashboardClient inline)
**Decision**: Build `SessionCard` as a proper standalone component in `components/shared/SessionCard.tsx` rather than modifying the inline card JSX inside DashboardClient.
**Why**: The data contract stays stable (prop types match existing usage). This allows TodayScreen and PlanScreen to import it cleanly in Phase 2, and sets up Phase 3 to do the same.

## D-004 — TodayScreen rebuild: hero display text from plan data
**Decision**: The hero display line ("10km, slowly.") is assembled from `selectedSession.distance` + `selectedSession.type` mapped to an adjective ("slowly" / "hard" / "long"). Not from AI copy.
**Why**: No AI route is available at this render point. Plan data is deterministic. Voice adjective map stays in the component and is auditable. Logged as a pattern decision, not a workaround.

## D-005 — Zone 2 percent shown as plan-derived figure (not Strava-computed)
**Decision**: For the RestraintCard on TodayScreen, show zone discipline as the percentage of _completed_ sessions this week that were Zone 2 type (easy/long/recovery), not a Strava HR-computed figure.
**Why**: Strava HR data is only available for connected paid users. The restraint card must work for all users. Plan-derived figure is honest (it represents session intent, which is what Zone 2 discipline means at this level). Label copy adjusted: "of your runs were Zone 2 sessions."
**How to apply**: In Phase 3, if Strava HR is available, the figure can be upgraded. Logged as a known simplification.

## D-006 — PendingAdjustmentBanner: connect to existing AdjustmentBanner usage in TodayScreen
**Decision**: Replace the existing `AdjustmentBanner` component call in TodayScreen with the new `PendingAdjustmentBanner`. The existing `AdjustmentBanner` function in DashboardClient.tsx is renamed to `.old` pattern by commenting — not deleted.
**Why**: Keeps rollback available in Phase 2. Phase 3 removes the commented version.

## D-007 — RPEScale: filling pattern reads "squares 1..N-1 filled, square N selected"
**Decision**: "Filled" squares (1 through value-1) use `--ink` bg/`--bg` text. The "selected" square (at value) uses `--moss` bg/white text. This gives a clear visual progression from cold to warm.
**Why**: Matches the spec exactly. Avoids rainbow colouring which would violate the no-flood-colour rule.

## D-008 — PlanArc: deload weeks shown as reduced opacity bars only, no separate colour
**Decision**: Deload weeks use the same base colour as their position (done/future/current) but at 0.2 opacity, not a separate colour.
**Why**: A separate deload colour adds palette noise. The opacity signal (lighter = back off) communicates the right thing without a new variable. Spec matches this interpretation.

## D-009 — Today screen: RestraintCard only shown after at least 2 completed sessions
**Decision**: RestraintCard on TodayScreen is only rendered when there are 2+ completed sessions in the current week.
**Why**: With 0 or 1 sessions done, showing "0% Zone 2" is misleading and potentially discouraging. The card's message ("the work you didn't do is why you're getting faster") only resonates when there's actual data to show.

## D-010 — SessionCard: SessionType import from lib/session-types
**Decision**: SessionCard imports `SessionType` from `@/lib/session-types` and uses `getSessionColor()` for the accent bar. No colour logic duplicated.
**Why**: D-16 doctrine — `session-types.ts` is the sole colour owner. No parallel semantics.

## D-011 — Plan screen: PlanArc shows plan-level week phases using week.phase field
**Decision**: PlanArc deload detection uses `week.type === 'deload'` from plan JSON, not a computed heuristic.
**Why**: Plan JSON already has this field from R23. Using it is accurate and zero-cost. No heuristic needed.

## D-012 — Session Detail: rebuilt in-place within DashboardClient SessionScreen, not extracted
**Decision**: SessionScreen (lines 4728+) is rebuilt in-place rather than extracted to a new file.
**Why**: SessionScreen already exists as a top-level function. Extracting to `components/shared/` would require threading all props through DashboardClient's screen render. The rebuild touches only the JSX return; data contracts, props, and Supabase calls are untouched. Phase 3 extraction is possible.

## D-013 — Coach note on TodayScreen: use week theme + plan coaching headline
**Decision**: CoachNoteBlock on TodayScreen shows the week headline from `PlanCoachingCard.getWeekHeadline()` logic, surfaced as a prop-computed string at render time.
**Why**: The actual coach layer (AI weekly report) is only available on the Coach screen for paid users. Today screen shows the plan-derived coaching note, which is honest and always available. Label is "PLAN" not "COACH" to distinguish it.

## D-014 — SessionCard 'current' variant: slightly stronger border, no glow
**Decision**: Current state card uses `--line-strong` border (not `--line`) and `--moss-soft` left tint on the 3px accent bar wrapper. No inner glow or shadow.
**Why**: The brief says "don't over-style it." A stronger border and slightly elevated bar tint is readable without being decorative.
