# `ModifyPlanSheet` — contract

**Component:** `components/shared/ModifyPlanSheet.tsx`

P-02 (SLT) · `SHEET-DAY-QUESTION-01`, `BASEBUILD-ADJUST-DOOR-01`,
`BASEBUILD-ADJUST-REBUILD-01` (Design Board)

⚠️ **Written 2026-10-10 because `BASEBUILD-ADJUST-REBUILD-01` changed which rows this
component renders, and it had no contract at all** (part of `CONTRACT-COVERAGE-03`'s
declared debt). `CLAUDE.md`: *"when changing any API route or component prop interface,
update `docs/contracts/` in the same commit."*

## Job

Let a runner change a parameter of a **live** plan without re-running the wizard, which
archives it. Before P-02 the only route was the wizard, so a runner whose life changed
either started over or carried a plan that was now wrong.

## Prop Interface

```typescript
interface ModifyPlanSheetProps {
  plan: Plan                   // the LIVE plan. Its `plan_kind` decides the row set.
  onClose: () => void
  busy?: boolean
  error?: string | null
  /** §44/§52 step two. Mirrors `RefusalView`'s contract deliberately. */
  ackLabel?: string | null
  onAcknowledge?: () => void
  onApply: (next: GeneratorInput, resetsLoggedWeeks: boolean) => void
  hasPaidAccess: boolean       // gates the rows carrying `gate: 'dynamic_reshape_r20'`
  onStartNewPlan?: () => void  // the wizard exit, which ARCHIVES the current plan
  edits: PlanEdits             // owned by the CALLER, which outlives this sheet
  onEditsChange: (next: PlanEdits) => void
  // STRENGTH-ENTRY-01 (2026-10-17) — a DOOR, its own group ("Around your runs"), never a
  // ninth edit row: strength is its own plan and is never part of Apply. Hidden while an edit
  // is pending (leaving mid-edit is leaving unapplied work). Null = not available.
  strengthDoor?: { title: string; subtitle: string; onOpen: () => void } | null
}
```

**Row glyphs (ICON-RULE-01, location):** every edit row leads with one `RowIcon`, from
`ROW_GLYPH`, which is typed `Record<ModifiableKey, GlyphName>` so a new row cannot ship
without one. Check: `lib/marketing/iconRule.test.ts`.

⚠️ **I GOT THIS LIST WRONG ON THE FIRST WRITE AND THE GATE CAUGHT IT.** I documented an
`open` prop that does not exist and omitted `hasPaidAccess` and `onStartNewPlan` — the
component is rendered conditionally by its caller rather than self-gating on a boolean.
`componentContracts.test.ts` compares the contract against the real interface in both
directions, which is the whole reason writing a contract counts as a code review.

⚠️ **`edits` is the caller's state and that is load-bearing.** It used to be local, so
every edit was destroyed the moment the runner reached the diff, and the diff's only exit
was *"Keep my current plan"* — **wanting to change one of two edits cost you both.** The
Design Board's back arrow is only real if the edits survive it.

## Invariants

1. 🔴 **THE ROWS ARE DERIVED PER PLAN KIND, NEVER LISTED HERE.**
   `modifiableRowsFor(plan)` is the single owner. The Design Board made this binding:
   *"withholding must be MECHANICAL, so a key that becomes effective later is a DECISION
   and not an oversight."* A hand-typed list in this component is the repo's
   most-recorded gate failure (`const HOME`, `CONSUMERS`, the six-file `appScreenTitle`
   list).
2. **A `base_build` plan offers TWO rows: `days_available` and `days_cannot_train`.**
   📐 Measured against the real producer on both live base-build plans:
   `days_cannot_train` changes the plan 2/2, `days_available` 1/2, **the other six do
   nothing.** 🧭 Zhuo's standard: *"a control with a measured 0% success rate is not a
   capability, it is an affordance."*
3. ⚠️ **`race_date` is withheld on a base-build plan, so the *"The race"* group does not
   render.** ✋ Silvanto called that group a category error on a plan whose
   `meta.race_date` is deliberately empty so no countdown can claim a start line.
4. 🔴 **`onApply` must be told WHICH PLAN KIND to rebuild.** The caller passes
   `rebuildsBaseBuild(plan)` through to `runModifyPreview`, which sets
   `accept_base_build` on the request. **Do not infer it from a refusal:**
   `accept_base_build` used to be honoured only inside the route's `BaseVolumeError`
   catch, and of 8 edits across the two live plans **one flips §111 from refusing to
   admitting**, which silently returned a **race plan** to a base-build runner.
5. **Two day controls, one question, and the sheet must say so.** `GeneratePlanScreen`
   derives both `days_available` and `days_cannot_train` from a single `WeekGrid`, so
   there they *cannot* contradict; here they are independent controls.
   `SHEET-DAY-QUESTION-01` shipped a live reconciling line rather than collapsing them —
   the board **declined** the collapse, on the sheet's one-row-per-setting architecture.
   ⚠️ **Not a cap on the grid:** blocking six days is a legitimate statement.
6. **Never a disabled primary as the resting state** (P-02). *"Nothing changed"* shows a
   single full-width Close, not a greyed Apply implying the runner has failed to do
   something.
7. **Slide-up sheet rules apply** — mirrored nav at the bottom, never a top-right Cancel;
   it covers the nav (`SHEET-PRESENT-01` as amended, `maxHeightVh = 88`).
8. **`resetsLoggedWeeks` is INHERITED, never re-implemented** — and since PLAN-REBUILD-SUPERSEDE-01 (2026-10-18) it is a
   PREDICTION the preview corrects: once the rebuilt plan is in hand, `DashboardClient.runModifyPreview` also asks
   `calendarChangedWeeks(plan, built)`, the same owner `savePlanForUser` stamps by, so an edit that changes the plan's
   length (every week moves) is warned about rather than promised safe. `editsResetLoggedWeeks`
   asks `isRaceIdentityChange` — the same owner `savePlanForUser` uses — so the warning
   the runner sees and the behaviour they get cannot disagree. `PLAN-WEEK-COLLISION-01`
   put a **94%-pre-completed** plan in front of a real runner by getting this wrong.

## Not this component's

The row LABELS and consequence subtitles live in `lib/plan/modifyPlan.ts →
MODIFIABLE_ROWS`, not here: *"copy in a component is copy no test can see."* Whether the
engine honours an edit is the Coaching Board's.

## Gates

`lib/plan/modifyPlan.test.ts` (25 arms — per-kind row set falsified 3 ways, including a
typo'd key) · `lib/plan/modifySaveRace.test.ts` · `components/ui/buttonGeometry.test.ts`
(`SegmentedControl` floors at 44px here) · `sheetPresentation.test.ts`.

## Step two — MODIFY-WARN-ACK-01 (2026-10-13)

`ackLabel` + `onAcknowledge` render a **secondary** consent button under the refusal
reason, shown only when both are set and `error` is present.

**The prop names mirror `RefusalView` on purpose.** That component already owns this
affordance for the wizard, and a second vocabulary for the same consent step is how two
surfaces start disagreeing about what the runner agreed to. The label always comes from
`ACK_LABEL` — never written at the call site — because it is a **consent, not a build**
(Hutchinson, binding, `PREP-ACK-WARN-OFFER-01`): *"Build my plan"* would make step two
indistinguishable from step one.

Before this the sheet showed a 422's reason with nothing to do about it, and Apply
re-sent the identical request. Measured on a real runner 2026-10-11, twice, ten seconds
apart, both `DaysAvailableError / warn_unacknowledged`.

> 📐 **`ADJUST-JOURNEY-TYPE-01` (2026-10-14) — type only, contract unchanged.** 13px converged to **Body 14/400** and weight 500 → 600. **No prop, no state, no behaviour**, and the 44px tap floor is untouched. Recorded because the docs audit flags any component change and an unanswered flag is indistinguishable from a missed one.
