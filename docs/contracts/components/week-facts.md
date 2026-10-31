# WeekFacts — `components/shared/WeekFacts.tsx`

`COACH-WEEK-FACTS-01` (Design Board 2026-10-31, option C). The foot of Coach's "This week" load card: this week's runs
and strength in one treatment.

## Props

| Prop | Type | Meaning |
|---|---|---|
| `runs` | `{ done: number; planned: number; verdict: { label: string; color: string } } \| null` | Run sessions done / planned this week, and the `sessionsContext` verdict (§65). `null` hides the runs fact |
| `strength` | `StrengthWeekEvidence \| null` | From `strengthWeekEvidence` (STRENGTH-ENTRY-01). `null` hides the strength fact and its next-step line |

## Rendering

- Both `null` → renders nothing.
- A `--line` hairline, then one wrapping line: `2 of 3 runs <verdict>` and `2 of 2 strength`. Counts in ink at 800, same
  style on both. `run` when one is planned. Verdict colour through `hueText`.
- `strength.next` → one `--fs-caption` `--mute` line from `STRENGTH_COACH.heavier/jumps`.
- No tap target of its own. The caller places it **outside** the load-sheet button.

## Consumers

`app/dashboard/DashboardClient.tsx` (CoachScreen, inside the "This week" card) · `app/coach-preview/page.tsx`
(`data-harness="week-facts"`).
