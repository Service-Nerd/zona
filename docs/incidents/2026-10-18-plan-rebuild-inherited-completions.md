# Incident — a same-race plan rebuilt on a new calendar inherited the old plan's completions

**Date found:** 2026-10-18 (founder, on his own phone) · **Live since:** 2026-09-18 (the PLAN-WEEK-COLLISION-01 fix,
which covered race changes only) · **Triage:** Systemic
**Fix:** `PLAN-REBUILD-SUPERSEDE-01` (`5708d7c0`, deployed 2026-10-18; clean-up run the same day, re-count 0) · **Catalogue class:** *Hazard solved for one transition, named but not solved
for its twin* (existing; second precedent).

## Symptom
The founder's new plan showed week 3 (2–8 Nov, in the future) as done with linked runs, and week 1 (19–25 Oct) with a
manual log. *"It believes I've already completed plans."*

## What was actually wrong
`savePlanForUser` (`lib/plan.ts`) set the old plan's week-keyed rows aside only when `isRaceIdentityChange` said the
race name or date changed. His 13 Oct plan was the SAME race (Dorney Lake, 12 Dec) rebuilt on a new start date
(21 Sep → 19 Oct), so the save treated it as an edit, while its week numbers now pointed at different calendar weeks.
The old plan's week 1 and week 3 rows landed on the new plan's week 1 and week 3.

## Why it survived
- **The fix for the original incident named the predicate after the case in front of it.** "Race identity" was the
  right test for race → race; a rebuild of the same race is a different transition with the same consequence.
  (The 2026-09-18 incident was also a Dorney Lake plan.)
- **Every test pinned race changes**; none built a same-race plan on a new calendar.
- **The screen also kept old rows in memory after a save** until reload, so even a correct database would have looked
  wrong until the app restarted.

## Blast radius
24 rows across 3 runners, all 7 week-keyed tables measured: 12 completions, 5 run analyses, 1 weekly report, 1 move,
4 distance/duration toggles, 1 pending change. Two of the three runners' plans are finished (races passed).

## Fix
`calendarChangedWeeks(prior, next)` beside `isRaceIdentityChange` (one owner). A save stamps the weeks whose date
moved (scoped `supersedeWeekKeyedRows(…, weekNs)`), archives the old plan, and leaves same-calendar edits alone. The
modify preview asks the same owner once the rebuilt plan exists. The app re-reads completions and moves after every
plan save. One-off clean-up: `scripts/sql/2026-10-18-plan-rebuild-remediation.sql` (dry-run counted 24 / 3).

## What would have caught it
A test that varies the CALENDAR, not just the race. It exists now (`planArchiveGuard.test.ts`, same-race describe).
The structural answer is plan identity on every week-keyed row (`PLAN-IDENTITY-01`), filed for the SLT and an ADR.
