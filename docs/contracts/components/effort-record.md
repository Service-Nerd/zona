# EffortRecord

**Component:** `components/shared/EffortRecord.tsx`

`COACH-EFFORT-PICTURE-01` (Coaching Board §132; Design Board ideas sitting 2026-10-31, option A). Coach's every-run
picture: each run's time in zone over the record's weeks, with the runs mostly in Zone 3 counted.

## Props

```ts
interface Props {
  runs: EffortRun[]
  weeks: number
}
```

| Prop | Type | Meaning |
|---|---|---|
| `runs` | `EffortRun[]` | From `effortRecord(rows, week, weeks, plannedTypeByActivity(completions, plan))` (`lib/coaching/runEffort.ts`), oldest first. Each carries `z1/z2/z3/z45` (%), `kind` (`runEffortKind`, §132) and `thisWeek` |
| `weeks` | `number` | The window shown in the eyebrow (`EASY_SHARE_BARS`, 8) |

## Rendering

- Fewer than `COACH_EFFORT_MIN_RUNS` (6) runs → renders nothing.
- Headline counts `kind === 'grey'` only; `split` and `planned` are drawn, never dotted or counted.
- This week's runs are ringed in `--ink`. No tap target.

## Consumers

`app/dashboard/DashboardClient.tsx` (CoachScreen, after the "This week" card, before the easy run trend) ·
`app/coach-preview/page.tsx` (`data-harness="effort-record"`).
