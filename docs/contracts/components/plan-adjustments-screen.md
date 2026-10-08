# Contract — PlanAdjustmentsScreen

**Authority**: This document defines the Plan adjustments door's props. Any change must update
this document in the same commit — `lib/contracts/componentContracts.test.ts` compares the two
prop-for-prop, both directions.

**Component:** `components/dashboard/PlanAdjustmentsScreen.tsx`

> 🔴 **IT WAS A CALL SITE FOR FOUR DAYS, FOR A REASON THAT STOPPED BEING TRUE.**
> `ME-DOORS-01` moved this block behind a door without extracting it, and said why:
> *"it reads seven identifiers from `MeScreen`'s scope … threading all seven through a new
> boundary is a second change wearing the first one's clothes."* The honest cost it recorded was
> *"it has **no markup test**, because vitest does not collect `app/`."*
>
> **`DASHBOARD-SCREEN-EXTRACT-03` then moved `MeScreen` under `components/`, which IS
> collected** — so the door became testable in place and `ME-ADJUSTMENTS-EXTRACT-01` kept naming
> an impossibility. It was extracted anyway, **on the pattern and not on the test**: every other
> substantial door off Me is a component (`PreferencesScreen`, `SupportScreen`, `FaqScreen`,
> `PlanHistoryScreen`, `DeleteAccountScreen`) and this was the last outlier at ~120 lines inline.
>
> ⚠️ **AND IT READS TEN VALUES, NOT SEVEN. `tsc` said so, not the item and not a careful read.**
> The three the item did not name — `dismissedChanges`, `dismissChange`, `visibleChanges` — are
> one self-contained localStorage-backed mechanism, used at three places inside this door and
> nowhere else, so they moved wholesale rather than becoming props. **A dependency list written
> by reading is a dependency list that goes short.**

---

## Prop Interface

```typescript
interface PlanAdjustmentsScreenProps {
  /** ⚠️ REQUIRED (SWITCH-PRIMITIVE-01). An `undefined` would render the row's copy as "off"
   *  against a real default of ON, and `Switch` would announce the wrong state to a screen
   *  reader. `Switch.checked` being required is what originally surfaced this. */
  dynamicAdjustmentsEnabled: boolean
  /** ⚠️ REQUIRED here though optional on `MeScreen`: it is half of this door's tier gate, so
   *  the branch cannot render without it. */
  onDynamicAdjustmentsChange: (enabled: boolean) => void
  /** A `plan_adjustments` row with status='pending' exists. ⚠️ Mutually exclusive with the
   *  "Last checked" block by design — rendering both would give two different answers to
   *  "did anything happen?". Distinct from `lastAdjustmentCheckFoundChange`, which stays true
   *  after the engine auto-applies silently. */
  hasPendingAdjustment?: boolean
  onOpenReshape?: () => void
  /** ⚠️ DERIVED IN `MeScreen` AND PASSED DOWN, NOT COMPUTED HERE. The INDEX row's subtitle
   *  reads the same value (`subtitle={hasPendingAdjustment ? … : lastCheckedLabel ?? …}`), so
   *  moving the derivation in here would have left the index rendering `undefined` — a silent
   *  defect in code this change never edited, which is the class ME-DOORS-01 shipped five of. */
  lastCheckedLabel: string | null
  lastAdjustmentCheckFoundChange?: boolean | null
  /** Recent auto_applied adjustments, last 14 days, newest first (§69). Rows:
   *  { id, week_n, summary, sessions_before, sessions_after, created_at }. 🔻 Typed `any[]`,
   *  inherited; a real type belongs with the `plan_adjustments` reader, not here. */
  recentChanges?: any[]
  preferredUnits: 'km' | 'mi'
}
```

---

## 🔴 It carries no header, and that is enforced

`ScreenHeader` stays at the call site in `MeScreen`, exactly as it does for `PreferencesScreen`.
Two of `ME-DOORS-01`'s three doors **said their own name twice**, because a card header that
"parallels the row above" becomes a second title the moment the card becomes the screen —
and neither was wrong when written. A component that cannot render a title cannot repeat one.
Held by an arm in `planAdjustmentsScreen.markup.test.ts`, and by `meDoorTitles.test.ts`, which
now **follows an extracted door into its own file** (it previously bounded a door's body by
`MeScreen` and went blind the moment a body moved).

## ⚠️ The tier gate is on the BRANCH, not in the body

`hasPaidAccess && onDynamicAdjustmentsChange` guards the whole `activeSection ===
'plan-adjustments'` branch. It used to guard only the body while `ScreenHeader` rendered
unconditionally, so a free runner arriving via `openSection` would have seen a **titled, empty
screen**. The index's own comment states the intent — *"a free runner sees no door at all rather
than a door onto a locked room"* — so an ungated section now falls through to the index.
**Latent rather than live:** reshape is the only deep-link source and is itself paid.

## Where Back goes

`ScreenHeader onBack` → `setActiveSection('main')`, the Me index. ⚠️ `ReshapeScreen`'s own
`onBack` returns **to this door** (`setMeOpenSection('plan-adjustments')`), which is
`ME-DOORS-01` defect ④ already fixed; that path runs through `MeScreen`'s `openSection` prop and
is unchanged by the extraction.

## Checks

| Check | Where |
|---|---|
| Props match this contract, both directions | `lib/contracts/componentContracts.test.ts` |
| Renders; three "Last checked" states; pending row; collapsed disclosure; no own title; no unguarded browser global | `components/dashboard/planAdjustmentsScreen.markup.test.ts` |
| A door says its name once, following extracted doors | `components/shared/meDoorTitles.test.ts` |
| Seen at 375px, all three states | `/preferences-preview` |

## "What we watch for" — rendered, not disclosed (RESHAPE-MOMENT-01, 2026-10-08)

The eight watched signals render **unconditionally**, as eight rows, from
`lib/coaching/watchedSignals.ts → watchedSignals()`. There is **no disclosure toggle and no
`aria-expanded`** on this block, and the component holds **no copy of its own** for it.

🔴 **It used to be a collapsed `Button` holding one 12px run-on sentence**, and the component
carried this instruction:

> *SYNC RULE: keep in step with TriggerType in lib/coaching/planAdjustment.ts. If you add or
> remove a trigger type, update this copy in the same commit.*

**A sync rule enforced by a comment, which had already failed:** the union declared eleven
members while one could never fire and two are runner-initiated, so the screen described a
taxonomy the engine did not have. The copy is now keyed by the engine's own `DetectedTrigger`
and `watchedSignals.test.ts` fails the build when a new detector has no description.

**Contract for anyone editing this block:**

| Rule | Enforced by |
|---|---|
| Every detected trigger is described; nothing else is | `Record<DetectedTrigger, …>` + `watchedSignals.test.ts` |
| The count is DERIVED, never typed on a surface | `WATCHED_SIGNAL_COUNT` |
| Rows run nearest-horizon first | `WATCHED_SIGNAL_ORDER` |
| No em dash, no stated cause, no promise, no merchandising | `watchedSignals.test.ts`, one arm per board clause |
| The 13px size is declared ONCE on the wrapper | `TYPESCALE-APP-GATE-01`, which caught two attempts |

⚠️ **`adjustmentsDisclosureOpen` no longer exists.** It was local state with one reader, and
the reader went with the chevron.

