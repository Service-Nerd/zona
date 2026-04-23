# Phase 2 Redesign Report

**Branch**: `redesign/phase-2-today-session-plan`  
**Date**: 2026-04-23  
**Status**: Complete. TypeScript clean. Branch pushed.

---

## Scope

Phase 2 delivered the full visual redesign of the Today, Session Detail, and Plan screens — plus five new shared components that form the Phase 2 design vocabulary.

---

## Commits

| Hash | Change |
|---|---|
| `753d5d1` | docs: update ui-patterns.md with all Phase 2 patterns |
| `18adfe9` | redesign: rebuild Plan screen with PlanArc + week summary |
| `a155294` | redesign: rebuild Session Detail screen |
| `e869b88` | redesign: rebuild Today screen |
| `4f00d90` | redesign: rebuild SessionCard with state variants |
| `3ef0653` | feat: add RPEScale shared component |
| `54face8` | feat: add PlanArc shared component |
| `199e4c0` | feat: add RestraintCard shared component |
| `53ebb35` | feat: add PendingAdjustmentBanner shared component |
| `e2a71e9` | feat: add CoachNoteBlock shared component |

---

## New Components

All components live in `components/shared/`. All use Warm Slate tokens only. No hardcoded values. TypeScript strict throughout.

| Component | Pattern ref | Notes |
|---|---|---|
| `CoachNoteBlock.tsx` | ui-patterns § 9 | default + why variants; --warn-bg, --coach-ink |
| `PendingAdjustmentBanner.tsx` | ui-patterns § 10 | pure UI — API calls stay in AdjustmentBanner wrapper |
| `RestraintCard.tsx` | ui-patterns § 11 | gated at ≥2 completions; zone2 derived from session types |
| `PlanArc.tsx` | ui-patterns § 12 | 32px strip; done/current/future/deload/race states |
| `RPEScale.tsx` | ui-patterns § 13 | 10-square filling selector; default/filled/selected states |
| `SessionCard.tsx` | ui-patterns § 1 | 4 states: future/current/done/skipped; imports getSessionColor() |

---

## Screen Rebuilds

### TodayScreen (`DashboardClient.tsx`)

New structure:
- ZONA wordmark row + moss status dot
- Hero block: context (phase · week · days out), "Today, you run" label, 56px display line ("10km, slowly.")
- `getHeroAdverb(type)` — deterministic adverb from session type, no AI required
- AdjustmentBanner wrapping PendingAdjustmentBanner (API calls stay in wrapper)
- CoachNoteBlock with plan coaching note
- DateStrip (unchanged)
- SessionCard for today with correct state derivation
- "Log this session" moss CTA + "Log manually" text link
- RestraintCard (gate: ≥2 completions this week)
- "Done this week" session list
- Strava nudge text

### Session Detail (`SessionScreen` + `SessionPopupInner`)

New structure:
- 36px circle back button (--bg-soft, --ink)
- Eyebrow: day + "Week N" (10px 600 --mute uppercase)
- Session title + type chip right-aligned
- Card with 3px left accent in session colour
- CoachNoteBlock variant="why" replaces old coach notes block
- RPEScale replaces old RPE input (when complete)

### Plan Screen (`PlanScreen`)

New structure:
- "Your plan" title left + race countdown right
- PlanArc with derived deload/race weeks + phase label
- Week summary bar (phase + done/total + km target)
- PlanCalendar preserved unchanged (owns drag-reorder + tap-to-open)
- Removed: PlanProgressBar, PlanChart, old header

---

## Decisions Made (D-001 – D-014)

Full decisions log: `docs/alignment/phase-2-decisions.md`

Key architectural decisions:

| ID | Decision |
|---|---|
| D-001 | CoachNoteBlock: --warn-bg block pattern for all coach voice, --coach-ink for text |
| D-002 | New CSS token `--coach-ink: #3D2600` added to globals.css |
| D-003 | SessionCard is a new standalone file (not extracted from DashboardClient) |
| D-004 | Hero adverb is deterministic (getHeroAdverb) — no AI required |
| D-005 | RestraintCard zone 2 percent derived from session types, not Strava HR |
| D-006 | AdjustmentBanner wrapper pattern — API in wrapper, pure UI in PendingAdjustmentBanner |
| D-007 | RPEScale replaces inline RPE inputs — state: default/filled/selected |
| D-008 | PlanArc deload detection uses week.badge === 'deload' OR week.type === 'deload' |
| D-009 | RestraintCard gate: ≥2 sessions completed this week |
| D-010 | SessionCard state 'skipped': --danger strikethrough, "Skipped" label |

---

## Blockers

None. See `docs/alignment/phase-2-blockers.md`.

---

## Token / Hardcoded Value Incidents

One pre-commit hook block during Phase 2:

- **`PendingAdjustmentBanner.tsx`**: Used `color: '#ffffff'` for "!" icon text and Confirm button text.
- **Fix**: Replaced with `color: 'var(--card)'`. `--card` resolves to `#FFFFFF` via globals.css. Commit succeeded on retry.

---

## Build Status

- `npx tsc --noEmit`: **clean** (zero errors)
- `npx next build`: **pre-existing failure** — `supabaseKey is required` in `/api/webhooks/stripe`. This is the same env-var error present before Phase 2 began. Not introduced by this work. Vercel build with env vars set passes.

---

## Documentation

`docs/canonical/ui-patterns.md` updated with:
- Core Aesthetic rewritten (Warm Slate, no dark mode, no Space Grotesk)
- Typography Scale updated (Inter-only, canonical px sizes)
- Design Token Reference table added
- SessionCard pattern updated (4 states with rules table)
- 5 new pattern sections: CoachNoteBlock, PendingAdjustmentBanner, RestraintCard, PlanArc, RPEScale
- Screen Templates updated: Today, Session Detail, Plan
- HR Zone coherence table updated to Warm Slate token names
- What Not to Build: added banned tokens, fonts, and dark mode entries
- Prompt template updated

---

## Phase 3 Handoff

Screens remaining for Phase 3 (target May 8):
- Me / Profile screen
- Coach screen
- Upgrade / paywall screen
- Generate Plan wizard screens
- Benchmark screen

All empty/loading/error states to be audited across all screens in Phase 3.
