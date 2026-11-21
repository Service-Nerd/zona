# Runbook — adjustments written to the wrong week (ADJUST-WEEK-COORD-01)

**When you need this:** to repair the plan adjustments that `/api/adjust-plan` wrote to the
wrong week before the ADJUST-WEEK-COORD-01 fix, or to check that nothing still needs it.

Nothing in this runbook writes on its own. Step 1 reads; steps 3 and 4 are SQL you decide to
run in the Supabase SQL editor. A production write is refused from the dev machine, so this is
a hand-over by design.

---

## What happened

The route keyed an adjustment on the array position of the current week plus one. It read the
sessions at that position (the runner's week), stored that number as the row's `week_n`, and
wrote the sessions to the week whose `week.n` equals it. On a plan with foundation weeks
(`n = -3, -2, -1` before `n = 1`) that is a later week: three weeks later on every affected row.

Two details make it worse than "a note on the wrong week":

- **The whole written week was replaced, all seven days.** `applyAdjustmentToPlan` writes every
  non-null day of `sessions_after`, and `sessions_after` is the runner's foundation week plus the
  note. So race weeks 1 and 2 now hold copies of foundation weeks -3 and -2. Distance, duration,
  type, label and targets all changed on every day, not just the coach note.
- **The runner's own week never got the note.** The note meant for that week went to a week
  they had not reached.

## Measured, 2026-11-21

`npx tsx --env-file=.env.local scripts/measure-adjust-week-coord.ts`

| | |
|---|---|
| Live plans | 43 |
| Plans whose `week.n` differs from position | 7, all with foundation weeks |
| Live `plan_adjustments` | 9 |
| On shifted plans | **4, all on ONE plan** (ref `0a446b4ade`) |
| Carrying the defect signature (stored `week_n` = position + 1 ≠ the runner's `n`) | 4 of 4 |
| Repaired | 0 of 4 |

| Row ref | Created | Trigger | Runner's week | Stored / written week | Written week starts |
|---|---|---|---|---|---|
| `07c97c2bd6` | 2026-11-11 | `zone_drift` / `flag_for_review`, auto-applied | n = -3 | n = 1 | 2026-11-30 |
| `292bf192bc` | 2026-11-15 | same | n = -3 | n = 1 | 2026-11-30 |
| `4a76a6251a` | 2026-11-18 | same | n = -2 | n = 2 | 2026-12-07 |
| `7072a48192` | 2026-11-18 | same | n = -2 | n = 2 | 2026-12-07 |

For each row the script shows:
- `sessions_before` on the five changed days equals the runner's foundation week as it stands
  now. The only field the change touched is `coach_notes`.
- The written week carries the write on 7 of 7 days.

The two rows on each week wrote the same content, so week 1 holds the 11-15 write and week 2
holds the 11-18 write.

**The runner reaches race week 1 on 2026-11-30.** Until it is repaired, they will be shown
foundation-week sessions for the first two weeks of the race block.

### The restore source: a rebuild, proven against the untouched weeks

- `plan_archive` holds nothing at or after any of the four writes. The nearest earlier archive
  (3 to 10 days before) is **a different generation** (`meta.generated_at` differs), and 21 of
  its other weeks differ from the live plan. It is not this plan's original.
- 🔴 **Corrected 2026-11-21.** This line used to say a rebuild from `meta.generator_input`
  "does not reproduce the live plan on any week". That was wrong. Rebuilt the way Modify rebuilds
  (profile heart rate laid over the input by `withProfileHr`, then `runEngine`), it reproduces
  **18 of 18** race weeks n ≥ 3 on every day by type, distance and duration. What differs is
  AI-enrichment text (label, theme, coach notes) and 8 threshold HR targets from ADR-026. The
  rebuilt weeks 1 and 2 are therefore what the engine prescribed for this runner.

`scripts/repair-adjust-week-coord.ts` re-proves that reproduction every time it runs and refuses
if it no longer holds. Restored weeks 1–2 carry rule-engine coach notes, not enriched ones.

### The cap is also consumed

`MAX_ADJUSTMENTS_PER_WEEK` is 2. Race weeks 1 and 2 each already carry two `auto_applied` rows,
so **no automatic adjustment will fire in either week**, even with the fix deployed.

## What a repair is

0. **The whole repair is one script** (founder instruction 2026-11-21, *"I want you to do this"*):
   `npx tsx --env-file=.env.local scripts/repair-adjust-week-coord.ts` is a dry run;
   add `--apply` to write. It archives the plan, splices the rebuilt weeks 1–2, re-keys the four
   adjustment rows and the two analyses, and **supersedes** (never deletes) the two week-1
   completions. Both are manual entries with no run attached; the real runs are already recorded at
   week -3. Each step is guarded, so a re-run writes nothing. The auto-mode classifier refused
   `--apply` from the assistant's session, so the founder runs it.

   The original options, kept for the record. (b) is now the chosen one, with the rebuild as its
   source:
1. **Restore weeks n = 1 and n = 2 of plan `0a446b4ade`.** The options:
   - (a) regenerate the plan through the product's own path (modify with the same inputs). The
     whole plan is re-prescribed by today's engine, which is the live-plan policy question.
   - (b) regenerate only weeks 1 and 2 and splice them in. A partial plan written by hand, which
     ADR-020 / ARCH-ENG-016 exist to stop.
   - (c) leave the weeks and tell the runner.

   **Founder call.** Live-plan policy is founder-owned ("new plans only").
2. **Re-key the four rows** to the week they were about, so they stop holding race weeks 1 and 2
   at the cap and the change history names the right week:

   ```sql
   -- Full ids: npx tsx --env-file=.env.local scripts/measure-adjust-week-coord.ts --ids
   update public.plan_adjustments set week_n = -3 where id in ('<07c97c2bd6 id>', '<292bf192bc id>');
   update public.plan_adjustments set week_n = -2 where id in ('<4a76a6251a id>', '<7072a48192 id>');
   ```

   The order of steps 1 and 2 does not affect the predicate. It finds the written week from the
   row's creation date, not from `week_n`. After re-keying, a revert of one of these rows writes
   `sessions_before` onto the foundation week it names. That week never received the note, so
   the revert changes nothing there.

⚠️ **Do not let the runner "undo" one of these rows before the repair.** `revert-adjustment`
applies `sessions_before` to the row's stored week (n = 1 or 2) on the changed days. That
writes foundation sessions there again, without the note, and marks the row reverted. It is no
worse in kind, but it leaves the row looking resolved.

## Predicate: is it repaired?

`repairState` in `lib/ops/adjustWeekCoordRepair.ts`, printed per row by the script as
`→ REPAIRED` / `→ NOT REPAIRED`. A row is **repaired** only when BOTH of these hold:

- **The write is gone:** no day of the week the defect wrote (position + 1 at creation) still
  deep-equals `sessions_after`.
- **The key is corrected:** the row's `week_n` equals the runner's `n` at creation.

`lib/ops/adjustWeekCoordRepair.test.ts` proves the four states give different answers. The two
partial repairs both read NOT REPAIRED.

Reading the result:

| Script prints | Means |
|---|---|
| `NOT REPAIRED (write present 7/7, key corrected false)` | Today's state. Nothing done |
| `NOT REPAIRED (write present 0/7, key corrected false)` | Week restored, rows not re-keyed |
| `NOT REPAIRED (write present 7/7, key corrected true)` | Rows re-keyed, week not restored. The worse half to stop at |
| `REPAIRED` | Both done |
| `summary: 0 rows on shifted plans` | The plan was regenerated: its rows were superseded (`superseded_at` set), so they are no longer live. Option (a) leaves this, which is also a pass |

⚠️ **A partial fix also changes the predicate's input.** For example, an edit to week 1 that
leaves one day untouched prints `write present 1/7`. Read the numbers, not only the verdict.

## Four more rows on the same plan, keyed to race week 1

The missed-session prompt keyed its completion on the position plus one too. The script lists
every completion or analysis on a shifted plan that was written before its week began:

| Table | Stored | Written | Runner was in | Row already at the right key? |
|---|---|---|---|---|
| `session_completions` | n = 1, mon | 2026-11-11 | n = -3 | yes, at (-3, mon) |
| `session_completions` | n = 1, wed | 2026-11-15 | n = -3 | yes, at (-3, wed) |
| `run_analysis` | n = 1, mon | 2026-11-09 | n = -3 | no |
| `run_analysis` | n = 1, wed | 2026-11-11 | n = -3 | no |

So race week 1's Monday and Wednesday already read as done, and they carry analyses, before the
runner reaches that week. The 11-11 zone-drift adjustment looked up week 1's analyses by `week_n`,
and these are the week-1 analyses that existed then. That they triggered it is likely, not
verified.

A repair (founder call, SQL hand-over, not run):
- **The two completions:** a row already exists at (-3, same day), so re-keying would collide
  with `(user_id, week_n, session_day)`. Compare each pair first. If they record the same run,
  delete the week-1 row. If not, decide which one stands.
- **The two analyses:** no row at (-3, same day), so re-key them:
  `update public.run_analysis set week_n = -3 where … and week_n = 1 and session_day in ('mon','wed')`.
  Put the runner's `user_id` in place of `…`; the script never prints it.

**Predicate:** the script's `written before their week began` count for both tables reads 0.
Today it reads 2 and 2.

## Context (no repair needed)

- `session_completions`: 9 live rows on shifted plans, 7 on foundation weeks.
- `run_analysis`: 6 rows, 4 on foundation weeks.
- `session_overrides`: none on shifted plans.
- Orphans: 0 live rows in any of the four tables carry a `week_n` their runner's live plan
  lacks. So `findWeekByN` dropping its any-miss positional fallback changes nothing stored.
- Taper recalibration: has never fired on a shifted plan.

## ⚠️ Do not use the in-app "revert" on these four rows

Reverting a misplaced row writes its `sessions_before` onto race week 1 or 2. Those sessions are the runner's
**foundation** week, so the race week stays a foundation copy, just without the note. Revert does not restore
anything here, so repair through the options above. (Code review 2026-11-21 asked for a staleness guard in
`applyAdjustmentDays`. It would not catch these rows, because the target week does hold `sessions_after`, so it was
not added.)
