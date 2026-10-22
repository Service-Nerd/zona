# Incident — tapping a day on Today did nothing

**Date found:** 2026-10-22 (founder report) · **Live since:** 2026-10-17 (`72abb017`, SESSION-SLOTS-01) · **Triage:** Systemic
**Fix commit:** see `TODAY-DAY-TAP-01` in the build log · **Catalogue class:** NEW — a reset keyed on an object that a later change made unstable

---

## Symptom

"In Today I used to be able to tap on the days and it showed me the session or what I had that day: it does nothing now."
Reproduced on `/strength-preview`: a tap on Monday set the selection to Monday and, in the same tick, back to Thursday.

## What was actually wrong

`components/dashboard/TodayScreen.tsx`: the effect commented "Reset selected key on week change" depended on
`[weekIndex, overridesReady, sessions]`. `sessions` is a `useMemo` over `effectiveWs`, which since `72abb017` depends on
`completions`, defined as `allCompletions[weekNum] ?? {}`. With nothing logged that week that is a new object on every
render, so a tap re-rendered, rebuilt `sessions`, re-ran the reset and put the selection back on today. With runs logged
it is stable between parent renders, but any completions refresh (app open, pull-to-refresh, a Health sync) gives a new
object and resets the selection too (inferred; not reproduced on a device).

## Why it survived

- The effect was keyed on an object, not on the event its own comment names, from April; harmless until an unrelated
  change gave that object a per-render input. Nothing in the commit that broke it touched the effect.
- No error and no log: the selection is applied and reverted before a frame paints.
- `vitest.config.ts` is `environment: 'node'`, so no test can run a React effect; the markup tests render once and
  cannot see a reset.
- Nothing has been run on a device.

## Blast radius

Today's day selection only. Plans, tiers, contracts, data and AI surfaces unaffected. Five days live.

## Fix

`lib/ui/todaySelection.ts`: `defaultSelectedKey` (one owner, used by the initial state and the reset) and
`selectionResetKey` (week, readiness and the overrides-resolved days as a string; it does not read completions). The
effect depends on that key only. `lib/ui/todaySelection.test.ts` tests the key as a pure function and the effect's deps
on its bounded region; restoring the old deps turns it red. Twin sweep: 3 selection-reset effects, 1 defective.
