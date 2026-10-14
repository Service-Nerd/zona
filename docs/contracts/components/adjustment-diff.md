# `AdjustmentDiff` — component contract

**Component:** `components/shared/AdjustmentDiff.tsx`

The day-by-day before/after list shown wherever a plan change is being proposed or
recorded. It renders **only the days that changed** — not a week.

> 🔴 **Written 2026-10-14 because `CTA-COMPACT-SCOPE-01` added a prop to a shared component
> with three consumers and there was no contract to update.** `CLAUDE.md` requires the
> contract to move in the same commit as a prop-interface change; this one did not exist,
> so the rule had nothing to bite on.

## Props

| Prop | Type | Default | Contract |
|---|---|---|---|
| `sessionsBefore` | `SessionLike[]` | — | 🔴 **A 7-ELEMENT ARRAY INDEXED `mon=0 … sun=6`, NOT a compact list.** See the hazard below |
| `sessionsAfter` | `SessionLike[]` | — | Same shape. Compared element-wise against `sessionsBefore` |
| `units` | `'km' \| 'mi'` | `'km'` | Passed to `labelSession`; never formats a distance itself (ADR-015) |
| `scopeLabel` | `string` | `'Changes to this week'` | The list's `aria-label`. Name the SCOPE, because only changed days render |
| `stagger` | `boolean` | `false` | Opt in to `zonna-stagger--late`, the second half of the confirm screen's arriving sequence (`CONFIRM-STAGGER-01`) |

## The interface, as the component declares it

```ts
interface Props {
  sessionsBefore: ReadonlyArray<SessionLike | null | undefined>
  sessionsAfter:  ReadonlyArray<SessionLike | null | undefined>
  units?: DistanceUnits
  scopeLabel?: string
  stagger?: boolean
}
```

## 🔴 The day-index hazard — the defect this component caused

`MODIFY-DIFF-DAY-MAP-01` (2026-10-13). A caller passed `Object.values(week.sessions)`, a
**compact** array, to props whose contract is a **7-element array indexed by weekday**. The
runner trains Mon/Wed/Fri/Sun; the screen rendered **Mon/Tue/Wed/Thu**, and **Sunday's 16.5 km
long run appeared as a Monday 17 km easy run** — on the screen asking him to accept a rewrite
of his whole plan.

**Every distance was correct**, which is why nothing looked wrong. TypeScript could not see it:
both are `SessionLike[]`.

**Now guarded** in `computeSessionDiff`: a non-zero length that is not 7 throws outside
production. ⚠️ **Empty is allowed and is not the same as short** — a caller with nothing to diff
passes `[]`, and the first cut of that guard got it wrong.

**Callers must build the array by day**, e.g. `DIFF_DAY_ORDER.map(d => byDay[d] ?? null)`.

## `stagger` — why it is opt-in

Only the confirm screen was ruled (`CTA-COMPACT-SCOPE-01` / `CONFIRM-STAGGER-01`,
Design Board 2026-10-14). **Hardcoding the class would animate all three consumers**, including
the pending-adjustment banner and the adjustments screen, which no board has looked at.

The delays live in `globals.css` (`--motion-stagger-step`), never in this component: total
≤ 600ms, collapsing to `0s` under `prefers-reduced-motion`. Gate:
`lib/ui/confirmStagger.test.ts`.

## Consumers

| Consumer | `stagger` |
|---|---|
| `ModifyPlanConfirm` | **yes** — the second group of the arriving sequence |
| `PendingAdjustmentBanner` | no |
| `PlanAdjustmentsScreen` | no |

## Renders nothing when

`computeSessionDiff` returns no changes. **An empty list is not rendered** — an empty element
leaves its margin behind and reads as a layout bug.

## Type

Card secondary **12/400 `--mute`** for the day rows. ⚠️ It was 11px until 2026-10-14;
`MICRO-LABEL-DRIFT-01` ruled 11px is not a level, and the residue here survived the first
migration pass because that reading was taken while a falsification mutation was applied.
